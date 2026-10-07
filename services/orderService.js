const Order = require('../models/orderModel');
const Product = require('../models/productModel');
const Razorpay = require('razorpay'); 
const mongoose = require('mongoose');
const walletService = require('./walletService');

// For adjusting stock of order items
const adjustOrderItemStock = async (item, quantityChange) => {
    const product = await Product.findById(item.productId);
    if (!product) return;

    let variant = item.variantId ? product.variants.id(item.variantId) : null;
    if (!variant && !item.variantId && product.variants.length > 0) {
        let matchingVariants = item.image
            ? product.variants.filter(productVariant => productVariant.images.includes(item.image))
            : [];
        if (matchingVariants.length !== 1) {
            matchingVariants = product.variants.filter(productVariant => Number(productVariant.price) === Number(item.price));
        }
        if (matchingVariants.length === 1) variant = matchingVariants[0];
    }

    if (variant) {
        variant.stock = Math.max(0, (Number(variant.stock) || 0) + quantityChange);
        if (variant.stock > 0 && variant.status === 'Out of Stock') variant.status = 'Active';
        product.availableStock = product.variants.reduce(
            (total, productVariant) => total + (Number(productVariant.stock) || 0),
            0
        );
    } else if (product.variants.length === 0) {
        product.availableStock = Math.max(0, (Number(product.availableStock) || 0) + quantityChange);
    }

    if (product.availableStock > 0 && product.status === 'Out of Stock') product.status = 'Active';
    await product.save();
};

// For loading user orders with statistics and pagination
const getOrderHistory = async ({ userId, requestedPage, status, search }) => {
    const limit = 10;
    const currentStatus = ['all', 'pending', 'shipped', 'delivered'].includes(String(status || 'all').toLowerCase())
        ? String(status || 'all').toLowerCase()
        : 'all';
    const currentSearch = String(search || '').trim();
    const pendingStatuses = ['Pending', 'Processing', 'Packed', 'Shipped'];
    const listQuery = { userId };
    if (currentStatus === 'pending') listQuery.orderStatus = { $in: ['Pending', 'Processing', 'Packed'] };
    else if (currentStatus === 'shipped') listQuery.orderStatus = 'Shipped';
    else if (currentStatus === 'delivered') listQuery.orderStatus = 'Delivered';
    if (currentSearch) {
        listQuery.$or = [
            { orderId: { $regex: currentSearch, $options: 'i' } },
            { 'items.name': { $regex: currentSearch, $options: 'i' } }
        ];
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const [total, completed, pending, spentResult, filteredOrderCount] = await Promise.all([
        Order.countDocuments({ userId }),
        Order.countDocuments({ userId, orderStatus: 'Delivered' }),
        Order.countDocuments({ userId, orderStatus: { $in: pendingStatuses } }),
        Order.aggregate([
            { $match: { userId: userObjectId, orderStatus: { $nin: ['Cancelled', 'Returned'] } } },
            { $group: { _id: null, spent: { $sum: '$grandTotal' } } }
        ]),
        Order.countDocuments(listQuery)
    ]);
    const stats = { total, completed, pending, spent: spentResult[0]?.spent || 0 };
    const totalPages = Math.ceil(filteredOrderCount / limit);
    const page = Math.min(requestedPage, Math.max(totalPages, 1));
    const orders = await Order.find(listQuery).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
    return { orders, stats, currentSearch, currentStatus, page, limit, totalPages, totalOrders: filteredOrderCount };
};

// For loading order details and estimated delivery
const getOrderDetails = async ({ orderId, userId }) => {
    const order = await Order.findOne({ _id: orderId, userId }).lean();
    if (!order) return null;
    const deliveryStart = new Date(order.createdAt);
    deliveryStart.setDate(deliveryStart.getDate() + 3);
    const estimatedDelivery = deliveryStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return { order, estimatedDelivery };
};

// For cancelling an order and restoring stock
const cancelOrder = async ({ orderId, userId, reason }) => {
    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) return { statusCode: 404, message: 'Order not found' };
    if (['Delivered', 'Cancelled', 'Returned', 'Return requested'].includes(order.orderStatus)) {
        return { statusCode: 400, message: 'This order cannot be cancelled' };
    }
    order.orderStatus = 'Cancelled';
    if (reason) order.cancellationReason = reason;
    
    //For refunding to wallet for paid orders
    if (order.paymentMethod !== 'Cash on Delivery') {
        await walletService.creditWallet(
            userId,
            order.grandTotal,
            `Refund for cancelled order ${order.orderId}`,
            order>_id
        );
        order.paymentStatus = 'Refunded';
    } 

    await order.save();
    for (const item of order.items) await adjustOrderItemStock(item, item.quantity);
    return { success: true, message: 'Order cancelled successfully.' };
};

// For returning an order and restoring stock
const returnOrder = async ({ orderId, userId, reason }) => {
    if (!reason || reason.trim() === '') return { statusCode: 400, message: 'Reason for return is mandatory' };
    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) return { statusCode: 404, message: 'Order not found' };
    if (order.orderStatus !== 'Delivered') return { statusCode: 400, message: 'Only delivered order can be returned' };

    // For changing status to requested.
    order.orderStatus = 'Returned requested';
    order.returnReason = reason;
    await order.save();
    
    return { success: true, message: 'Order return initiates successfully' };
};

// For initiating razorpay
const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const initiateRetryPayment = async ({ orderId, userId }) => {
    const order = await Order.findOne({ _id: orderId, userId });

    if(!order) return { statusCode: 404, message: 'Order not found'}

    if(order.paymentStatus !== 'Failed') {
        return { statusCode: 400, message: 'Payment for this order is not in a failed state.'};
    }

    try{
            const options = {
                amount: Math.round(order.grandTotal * 100),
                currency: 'INR',
                receipt: `${order._id}${Date.now()}`
        };

            const razorpayOrder = await razorpayInstance.orders.create(options);

        return{
            success: true,
            razorpayOrderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            key: process.env.RAZORPAY_KEY_ID,
            orderId: order._id
        };
    }catch (error) {
        console.error('Error in razorpay retrying:',error);
            return { statusCode: 500, message: 'Failed to initialize payment gateway.'};
    }
};

module.exports = { 
    getOrderHistory, 
    getOrderDetails, 
    cancelOrder, 
    returnOrder ,
    initiateRetryPayment
};
