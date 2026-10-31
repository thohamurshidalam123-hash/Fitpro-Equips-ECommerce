const Cart = require('../models/cartModel');
const Order = require('../models/orderModel');
const Address = require('../models/addressModel');
const Product = require('../models/productModel');
const couponService = require('./couponService');
const { validateAddress } = require('../validators/addressValidators');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const walletService = require('./walletService');
const { getEffectivePrice } = require('../utils/offerPricing');
const settingsService = require('./settingsService');

// For initializing razorpay
const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// For loading checkout data and calculating totals
const getCheckoutData = async ({ userId, addressId, appliedCouponCode }) => {
    const cart = await Cart.findOne({ userId }).populate({ path: 'items.productId', populate: [{ path: 'categoryId', select: 'offerPercentage' }, { path: 'brandId', select: 'offerPercentage' }] });
    if (!cart || !cart.items || cart.items.length === 0) return null;

    const addresses = await Address.find({ userId });
    const activeAddress = addresses.find(address => address._id.toString() === addressId)
        || addresses.find(address => address.isDefault)
        || addresses[0]
        || null;

    let subtotal = 0;
    const formattedItems = cart.items.map(item => {
        const product = item.productId;
        if (!product) return null;
        const variant = item.variantId ? product.variants.id(item.variantId) : null;
        const price = getEffectivePrice(product, variant);
        const itemTotal = price * item.quantity;
        subtotal += itemTotal;
        return {
            productId: product._id,
            name: product.productName,
            quantity: item.quantity,
            image: product.images && product.images.length > 0 ? product.images[0] : '',
            price,
            itemTotal
        };
    }).filter(item => item !== null);

    let appliedCoupon = null;
    if (appliedCouponCode) {
        const couponResult = await couponService.applyCoupon(userId, appliedCouponCode);
        if (couponResult.success) {
            appliedCoupon = {
                id: couponResult.couponId,
                code: couponResult.couponCode,
                name: couponResult.couponName,
                discountAmount: couponResult.discountAmount
            };
        }
    }

    const tax = Number((subtotal * 0.0018).toFixed(2));
    const { shippingCharge, freeShippingThreshold } = await settingsService.getSettings();
    const shipping = subtotal > freeShippingThreshold ? 0 : shippingCharge;
    const discount = appliedCoupon ? appliedCoupon.discountAmount : 0;
    const grandTotal = subtotal + tax + shipping - discount;
    return { cartItems: formattedItems, addresses, activeAddress, appliedCoupon, totals: { subtotal, tax, shipping, discount, grandTotal } };
};

// For adding an address during checkout
const createOrderAddress = async ({ userId, data }) => {
    const formData = {
        fullName: data.fullName,
        phone: data.phone,
        houseName: data.houseName,
        street: data.street,
        city: data.city,
        district: data.district,
        state: data.state,
        pincode: data.pincode,
        landmark: data.landmark,
        addressType: data.addressType
    };
    const errors = await validateAddress(formData);
    if (Object.keys(errors).length) return { success: false, statusCode: 400, errors };

    const addressCount = await Address.countDocuments({ userId });
    const address = await Address.create({
        userId,
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        houseName: formData.houseName.trim(),
        street: formData.street.trim(),
        city: formData.city.trim(),
        district: formData.district.trim(),
        state: formData.state.trim(),
        pincode: formData.pincode.trim(),
        landmark: formData.landmark ? formData.landmark.trim() : '',
        addressType: formData.addressType,
        isDefault: addressCount === 0
    });
    return { success: true, addressId: address._id };
};

// For placing an order and updating stock
const placeOrder = async ({ userId, addressId, paymentMethod, couponCode, paymentVerified = false }) => {
    if (!['cod', 'razorpay', 'wallet'].includes(paymentMethod)) {
        return { statusCode: 400, message: 'Invalid payment method selected'}
    }

    const cart = await Cart.findOne({ userId }).populate({ path: 'items.productId', populate: [{ path: 'categoryId', select: 'offerPercentage' }, { path: 'brandId', select: 'offerPercentage' }] });
    if (!cart || cart.items.length === 0) return { statusCode: 400, message: 'Your cart is empty.' };

    const selectedAddress = await Address.findOne({ _id: addressId, userId });
    if (!selectedAddress) return { statusCode: 400, message: 'Please select a valid delivery address.' };

    const orderItems = [];
    let subtotal = 0;
    for (const item of cart.items) {
        const product = item.productId;
        if (!product || product.status !== 'Active') {
            return { statusCode: 400, message: 'A product in your cart is no longer available.' };
        }
        const variant = item.variantId ? product.variants.id(item.variantId) : null;
        if (item.variantId && !variant) {
            return { statusCode: 400, message: `The selected variant for ${product.productName} is unavailable.` };
        }
        const availableStock = variant ? variant.stock : product.availableStock;
        if (item.quantity > availableStock) return { statusCode: 400, message: `Insufficient stock for ${product.productName}.` };

        const price = getEffectivePrice(product, variant);
        const itemTotal = price * item.quantity;
        subtotal += itemTotal;
        orderItems.push({
            productId: product._id,
            variantId: item.variantId,
            name: product.productName,
            image: (variant && variant.images[0]) || product.images[0] || '',
            price,
            quantity: item.quantity,
            itemTotal
        });
    }

    const fullAddress = [
        selectedAddress.houseName,
        selectedAddress.street,
        selectedAddress.landmark,
        selectedAddress.city,
        selectedAddress.district,
        selectedAddress.state
    ].filter(Boolean).join(', ') + ` - ${selectedAddress.pincode}`;

    let appliedCoupon = null;
    if (couponCode) {
        const couponResult = await couponService.applyCoupon(userId, couponCode);
        if (!couponResult.success) return { statusCode: 400, message: couponResult.message };
        appliedCoupon = couponResult;
    }

    const tax = Number((subtotal * 0.0018).toFixed(2));
    const { shippingCharge, freeShippingThreshold } = await settingsService.getSettings();
    const shippingCost = subtotal > freeShippingThreshold ? 0 : shippingCharge;
    const discount = appliedCoupon ? appliedCoupon.discountAmount : 0;
    const grandTotal = subtotal + tax + shippingCost - discount;
    if (paymentMethod === 'cod' && grandTotal > 5000) {
        return { statusCode: 400, message: "Can't continue with COD for orders above 5000, Select another payment method" };
    }
    const year = new Date().getFullYear();
    const randomId = Math.floor(10000 + Math.random() * 90000);
    const orderId = `FP-${year}-${randomId}`;

    // For checking wallet balance
    if ( paymentMethod === 'wallet') {
        const wallet = await walletService.getWalletData(userId);
        if (!wallet || wallet.balance < grandTotal ) {
            return { statusCode: 400, message: 'Insuffiecient balance in your wallet, Please select another payment method'}
        }
    }


    let formattedPaymentMethod = 'Cash on Delivery';
    if(paymentMethod === 'razorpay') formattedPaymentMethod = 'Razorpay';
    if(paymentMethod === 'wallet') formattedPaymentMethod = 'wallet';

    const newOrder = new Order({
        orderId,
        userId,
        items: orderItems,
        shippingAddress: {
            name: selectedAddress.fullName,
            phone: selectedAddress.phone,
            fullAddress,
            type: selectedAddress.addressType
        },
        paymentMethod: formattedPaymentMethod,
        paymentStatus: paymentMethod === 'cod' ? 'Pending' : 'Completed',
        orderStatus: paymentMethod === 'cod' ? 'Pending' : 'Processing',
        subtotal,
        tax,
        shippingCost,
        couponId: appliedCoupon ? appliedCoupon.couponId : undefined,
        couponCode: appliedCoupon ? appliedCoupon.couponCode : undefined,
        discount,
        grandTotal
    });

    let razorpayOrder = null;
    if (paymentMethod === 'razorpay' && !paymentVerified) {
        try {
            razorpayOrder = await razorpayInstance.orders.create({
                amount: Math.round(grandTotal * 100),
                currency: 'INR',
                receipt: newOrder._id.toString()
            });
        } catch (error) {
            console.error('Razorpay order initialization error:', error.message);
            return { statusCode: 502, message: 'Failed to initialize payment gateway. Your cart has not been changed.' };
        }
        return {
            success: true,
            paymentMethod: 'razorpay',
            razorpayOrderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            key: process.env.RAZORPAY_KEY_ID
        };
    }

    // For debit before saving so a failed wallet payment cannot leave an unpaid order.
    if (paymentMethod === 'wallet') {
        try{
            await walletService.debitWallet(
                userId,
                grandTotal,
                `Payment for order ${orderId}`,
                newOrder._id
            );
        }catch(error) {
            console.error("Error in updating wallet after order creation:",error);
            return { statusCode: 500, message: 'Failed to update wallet balance'}
        }
    }

    try {
        await newOrder.save();
    } catch (error) {
        if (paymentMethod === 'wallet') {
            try {
                await walletService.creditWallet(userId, grandTotal, `Refund for failed order ${orderId}`, newOrder._id);
            } catch (refundError) {
                console.error('Error refunding wallet after order save failure:', refundError);
            }
        }
        throw error;
    }

    for (const item of cart.items) {
        const product = await Product.findById(item.productId._id);
        if (!product) continue;

        if (item.variantId) {
            const variant = product.variants.id(item.variantId);
            if (variant) {
                variant.stock = Math.max(0, (Number(variant.stock) || 0) - item.quantity);
                variant.status = variant.stock === 0 ? 'Out of Stock' : (variant.status === 'Out of Stock' ? 'Active' : variant.status);
            }
            product.availableStock = product.variants.reduce(
                (total, productVariant) => total + (Number(productVariant.stock) || 0),
                0
            );
        } else {
            product.availableStock = Math.max(0, (Number(product.availableStock) || 0) - item.quantity);
        }

        if (product.availableStock === 0) product.status = 'Out of Stock';
        else if (product.status === 'Out of Stock') product.status = 'Active';
        await product.save();
    }
    await Cart.findOneAndDelete({ userId });

    return {
        success: true,
        orderId: newOrder._id,
        paymentMethod,
        amount: paymentMethod === 'wallet' ? grandTotal : undefined
    };
};

// For verifying razorpay payment signature
const verifyRazorpayPayment = async ({ gatewayOrderId, paymentData, pendingPayment, userId }) => {
    if (!pendingPayment || pendingPayment.userId !== userId || pendingPayment.gatewayOrderId !== gatewayOrderId) {
        return { success: false, message: 'This payment attempt is invalid or has expired.' };
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = paymentData || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || razorpay_order_id !== gatewayOrderId) {
        return { success: false, message: 'Payment verification details are incomplete.' };
    }

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(sign.toString())
    .digest("hex");

    const expectedBuffer = Buffer.from(expectedSign);
    const receivedBuffer = Buffer.from(String(razorpay_signature));
    if (expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
        return { success: false, message: 'Invalid payment signature.' };
    }

    let gatewayPayment;
    try {
        gatewayPayment = await razorpayInstance.payments.fetch(razorpay_payment_id);
    } catch (error) {
        console.error('Razorpay payment lookup error:', error.message);
        return { success: false, message: 'Unable to confirm payment status.' };
    }
    if (
        gatewayPayment.order_id !== gatewayOrderId
        || gatewayPayment.status !== 'captured'
        || gatewayPayment.amount !== pendingPayment.amount
    ) {
        return { success: false, message: 'Payment has not been completed.' };
    }

    const result = await placeOrder({
        userId,
        addressId: pendingPayment.addressId,
        paymentMethod: 'razorpay',
        couponCode: pendingPayment.couponCode,
        paymentVerified: true
    });
    if (!result.success) return { success: false, message: result.message };
    return { success: true, orderId: result.orderId };
};

// For handling payment failure/ modal close
const handlePaymentFailure = async ({ gatewayOrderId, pendingPayment }) => {
    if (!pendingPayment || pendingPayment.gatewayOrderId !== gatewayOrderId) {
        return { success: false, message: 'Payment attempt not found.' };
    }
    return { success: true };
};


// For loading order success page
const getOrderSuccessData = async ({ orderId, userId }) => {
    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) return null;
    const deliveryStart = new Date(order.createdAt);
    deliveryStart.setDate(deliveryStart.getDate() + 3);
    const deliveryEnd = new Date(order.createdAt);
    deliveryEnd.setDate(deliveryEnd.getDate() + 5);
    const options = { month: 'short', day: 'numeric' };
    const estimatedDelivery = `${deliveryStart.toLocaleDateString('en-US', options)} - ${deliveryEnd.toLocaleDateString('en-US', options)}`;
    return { order, estimatedDelivery };
};

module.exports = {
    getCheckoutData, 
    createOrderAddress, 
    placeOrder, 
    verifyRazorpayPayment,
    handlePaymentFailure,
    getOrderSuccessData 
};
