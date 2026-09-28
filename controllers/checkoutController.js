const Cart = require('../models/cartModel');
const Order = require('../models/orderModel');
const Address = require('../models/addressModel');
const Product = require('../models/productModel');
const { validateAddress } = require('../validators/addressValidators');

// For loading checkout page
const loadCheckout = async (req, res) => {
    try {
        const userId = req.session.userId;

        if (!userId) {
            return res.redirect('/login');
        }
        // For fetching cart and product details
        const cart = await Cart.findOne({ userId })
            .populate('items.productId');

        //For checking if cart doesn't exist or is empty
        if (!cart || !cart.items || cart.items.length === 0) {
            return res.redirect('/cart');
        }

        const addresses = await Address.find({ userId });

        // Find default address
        let activeAddress = null;

        if (addresses && addresses.length > 0) {
            activeAddress =
                addresses.find(address => address._id.toString() === req.query.addressId) ||
                addresses.find(address => address.isDefault) ||
                addresses[0];
        }

        // For calculating subtotal
        let subtotal = 0;

        const formattedItems = cart.items.map(item => {
            const product = item.productId;

            // Safety check in case product was deleted
            if (!product) {
                return null;
            }

            const price =
                product.salePrice > 0
                    ? product.salePrice
                    : product.regularPrice;

            const itemTotal = price * item.quantity;

            subtotal += itemTotal;

            return {
                productId: product._id,
                name: product.productName,
                quantity: item.quantity,
                image: product.images && product.images.length > 0
                    ? product.images[0]
                    : '',
                price: price,
                itemTotal: itemTotal
            };
        }).filter(item => item !== null);

        //For calculating checkout total
        const tax = Number((subtotal * 0.0018).toFixed(2));

        const shipping = subtotal > 5000
            ? 0
            : 500;

        const discount = 0;

        const grandTotal =
            subtotal +
            tax +
            shipping -
            discount;

        // For rendering checkout page
        res.render('user/checkout', {
            currentPage: 'shop',

            cartItems: formattedItems,

            addresses: addresses,

            activeAddress: activeAddress,

            totals: {
                subtotal,
                tax,
                shipping,
                discount,
                grandTotal
            }
        });

    } catch (error) {

        console.error('Error in load checkout:', error);

        res.status(500).send('Server Error');
    }
};

// For adding address
const addOrderAddress = async (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please log in first.' });
        }

        const formData = {
            fullName: req.body.fullName,
            phone: req.body.phone,
            houseName: req.body.houseName,
            street: req.body.street,
            city: req.body.city,
            district: req.body.district,
            state: req.body.state,
            pincode: req.body.pincode,
            landmark: req.body.landmark,
            addressType: req.body.addressType
        };
        const errors = validateAddress(formData);
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Please correct the address details.',
                errors
            });
        }

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

        return res.status(201).json({
            success: true,
            message: 'Address added successfully.',
            addressId: address._id
        });
    } catch (error) {
        console.error('Error in adding address:', error.message);
        return res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// For placing the order
const placeOrder = async (req, res) => {
    try {
        const userId = req.session.userId;
        const { addressId, paymentMethod } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please log in first.' });
        }

        if (paymentMethod !== 'cod') {
            return res.status(400).json({ success: false, message: 'Only cash on delivery is currently available.' });
        }

        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: 'Your cart is empty.' });
        }

        const selectedAddress = await Address.findOne({ _id: addressId, userId });
        if (!selectedAddress) {
            return res.status(400).json({ success: false, message: 'Please select a valid delivery address.' });
        }

        const orderItems = [];
        let subtotal = 0;

        for (const item of cart.items) {
            const product = item.productId;
            if (!product || product.status !== 'Active') {
                return res.status(400).json({ success: false, message: 'A product in your cart is no longer available.' });
            }

            const variant = item.variantId ? product.variants.id(item.variantId) : null;
            if (item.variantId && !variant) {
                return res.status(400).json({ success: false, message: `The selected variant for ${product.productName} is unavailable.` });
            }

            const availableStock = variant ? variant.stock : product.availableStock;
            if (item.quantity > availableStock) {
                return res.status(400).json({ success: false, message: `Insufficient stock for ${product.productName}.` });
            }

            const price = variant ? variant.price : (product.salePrice > 0 ? product.salePrice : product.regularPrice);
            const itemTotal = price * item.quantity;
            subtotal += itemTotal;
            orderItems.push({
                productId: product._id,
                variantId: item.variantId,
                name: product.productName,
                image: (variant && variant.images[0]) || product.images[0] || '',
                price: price,
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

        const tax = Number((subtotal * 0.0018).toFixed(2));
        const shippingCost = subtotal > 5000 ? 0 : 500;
        const grandTotal = subtotal + tax + shippingCost;

        // For genrating an order id
        const year = new Date().getFullYear();
        const randomId = Math.floor(10000 + Math.random() * 90000);
        const orderId = `FP-${year}-${randomId}`;

        const newOrder = new Order({
            orderId,
            userId,
            items: orderItems,
            shippingAddress: {
                name: selectedAddress.fullName,
                phone: selectedAddress.phone,
                fullAddress: fullAddress,
                type: selectedAddress.addressType
            },
            paymentMethod: 'Cash on Delivery',
            paymentStatus: 'Pending',
            subtotal, tax, shippingCost, discount: 0, grandTotal
        });

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
                await Product.findByIdAndUpdate(item.productId._id, {
                    $inc: { availableStock: -item.quantity }
                });
            }
        }

        await Cart.findOneAndDelete({ userId });
        return res.status(201).json({ success: true, orderId: newOrder._id });
    } catch (error) {
        console.error('Error in place order:', error);
        return res.status(500).json({ success: false, message: 'Server error while placing your order.' });
    }
};

// For loading order success page
const loadOrderSuccess = async (req, res) => {
    try {
        const order = await Order.findOne({ _id: req.params.id, userId: req.session.userId });
        if (!order) {
            return res.redirect('/');
        }

        // Estimate delivery 3-5 days after the order date.
        const deliveryStart = new Date(order.createdAt);
        deliveryStart.setDate(deliveryStart.getDate() + 3);
        const deliveryEnd = new Date(order.createdAt);
        deliveryEnd.setDate(deliveryEnd.getDate() + 5);

        const options = { month: 'short', day: 'numeric' };
        const estimatedDelivery = `${deliveryStart.toLocaleDateString('en-US', options)} - ${deliveryEnd.toLocaleDateString('en-US', options)}`;

        return res.render('user/orderSuccess', {
            order,
            estimatedDelivery,
            currentPage: 'shop'
        });
    } catch (error) {
        console.error('Success page error:', error);
        res.redirect('/');
    }
};


module.exports = {
    loadCheckout,
    addOrderAddress,
    placeOrder,
    loadOrderSuccess
};
