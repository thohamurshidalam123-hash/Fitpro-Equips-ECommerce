const Cart = require('../models/cartModel');
const Order = require('../models/orderModel');
const Address = require('../models/addressModel');
const Product = require('../models/productModel');
const couponService = require('./couponService');
const { validateAddress } = require('../validators/addressValidators');
const Razorpay = require('razorpay');
const crypto = require('crypto');

// For initializing razorpay
const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// For loading checkout data and calculating totals
const getCheckoutData = async ({ userId, addressId, appliedCouponCode }) => {
    const cart = await Cart.findOne({ userId }).populate('items.productId');
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
        const price = variant ? variant.price : (product.salePrice > 0 ? product.salePrice : product.regularPrice);
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
    const shipping = subtotal > 5000 ? 0 : 500;
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
    const errors = validateAddress(formData);
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
const placeOrder = async ({ userId, addressId, paymentMethod, couponCode }) => {
    if (!['cod', 'razorpay', 'wallet'].includes(paymentMethod)) {
        return { statusCode: 400, message: 'Invalid payment method selected'}
    }

    const cart = await Cart.findOne({ userId }).populate('items.productId');
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

        const price = variant ? variant.price : (product.salePrice > 0 ? product.salePrice : product.regularPrice);
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
    const shippingCost = subtotal > 5000 ? 0 : 500;
    const discount = appliedCoupon ? appliedCoupon.discountAmount : 0;
    const grandTotal = subtotal + tax + shippingCost - discount;
    const year = new Date().getFullYear();
    const randomId = Math.floor(10000 + Math.random() * 90000);
    const orderId = `FP-${year}-${randomId}`;

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
        paymentStatus: 'Pending',
        subtotal,
        tax,
        shippingCost,
        couponId: appliedCoupon ? appliedCoupon.couponId : undefined,
        couponCode: appliedCoupon ? appliedCoupon.couponCode : undefined,
        discount,
        grandTotal
    });

    let razorpayOrder = null;
    if (paymentMethod === 'razorpay') {
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
    }

    await newOrder.save();

    for (const item of cart.items) {
        if (item.variantId) {
            await Product.updateOne(
                { _id: item.productId._id, 'variants._id': item.variantId },
                { $inc: { 'variants.$.stock': -item.quantity } }
            );
            const updatedProduct = await Product.findById(item.productId._id);
            if (updatedProduct) {
                updatedProduct.availableStock = updatedProduct.variants.reduce(
                    (total, productVariant) => total + (Number(productVariant.stock) || 0),
                    0
                );
                await updatedProduct.save();
            }
        } else {
            await Product.findByIdAndUpdate(item.productId._id, { $inc: { availableStock: -item.quantity } });
        }
    }
    await Cart.findOneAndDelete({ userId });

    if (paymentMethod === 'razorpay') {
        return {
            success: true,
            orderId: newOrder._id,
            paymentMethod: 'razorpay',
            razorpayOrderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            key: process.env.RAZORPAY_KEY_ID
        };
    }
    return { success: true, orderId: newOrder._id, paymentMethod: 'cod' };
};

// For verifying razorpay payment signature
const verifyRazorpayPayment = async ({ orderId, paymentData }) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = paymentData;

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(sign.toString())
    .digest("hex");

    if (razorpay_signature === expectedSign) {
        await Order.findByIdAndUpdate(orderId, { paymentStatus: 'Completed', orderStatus: 'Processing' });
        return { success: true }; 
    }else{
        await Order.findByIdAndUpdate(orderId, { paymentStatus:  'Failed' });
        return { success: false, message: 'Invalid payment signature.'};
    }
};

// For handling payment failure/ modal close
const handlePaymentFailure = async ({ orderId }) => {
    await Order.findByIdAndUpdate(orderId, { paymentStatus: 'Failed' });
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
