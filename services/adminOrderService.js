const Order = require('../models/orderModel');
const walletService = require('./walletService');
const Product = require('../models/productModel');

// For listing orders with search, filter, sort and pagination
const getAdminOrders = async ({ page = 1, search = '', status = 'all', payment = 'all', limit = 10 }) => {
    const validStatuses = ['Processing', 'Packed', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];
    const validPaymentStatuses = ['Paid', 'Pending'];
    const normalizedStatus = validStatuses.includes(status) ? status : 'all';
    const normalizedPayment = validPaymentStatuses.includes(payment) ? payment : 'all';
    const query = {};

    if (normalizedStatus !== 'all') query.orderStatus = normalizedStatus;
    if (normalizedPayment !== 'all') query.paymentStatus = normalizedPayment;
    if (search) {
        query.$or = [
            { orderId: { $regex: search, $options: 'i' } },
            { 'shippingAddress.name': { $regex: search, $options: 'i' } }
        ];
    }

    const [totalOrders, processingOrders, shippedOrders, deliveredOrders, count, orders] = await Promise.all([
        Order.countDocuments({}),
        Order.countDocuments({ orderStatus: 'Processing' }),
        Order.countDocuments({ orderStatus: 'Shipped' }),
        Order.countDocuments({ orderStatus: 'Delivered' }),
        Order.countDocuments(query),
        Order.find(query)
            .populate('userId', 'name email')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean()
    ]);

    return {
        orders,
        stats: { total: totalOrders, processing: processingOrders, shipped: shippedOrders, delivered: deliveredOrders },
        pagination: { page, totalPages: Math.ceil(count / limit), totalEntries: count },
        filters: { search, status: normalizedStatus, payment: normalizedPayment }
    };
};

// For loading order details page
const getAdminOrderDetails = async (orderId) => Order.findById(orderId).populate('userId').lean();

const approveReturn = async (orderId) => {
    const order = await Order.findById(orderId);
    if (!order || order.orderStatus !== 'Return requested') {
        return { success: false, message: 'Invalid return request' };
    }

    order.orderStatus = 'Returned';
    order.paymentStatus = 'Refunded';
    await order.save();

    // For refunding to Wallet (Applies to COD, Razorpay, and Wallet payments)
    await walletService.creditWallet(
        order.userId, 
        order.grandTotal, 
        `Refund for returned order ${order.orderId}`, 
        order._id
    );

    //For incrementing Stock Back
    for (const item of order.items) {
        if (item.variantId) {
            await Product.updateOne(
                { _id: item.productId, 'variants._id': item.variantId },
                { $inc: { 'variants.$.stock': item.quantity } }
            );
        } else {
            await Product.findByIdAndUpdate(item.productId, { $inc: { availableStock: item.quantity } });
        }
    }
    return { success: true, message: 'Order return confirmed, Order amount credited to user wallet' };
};

const rejectReturn = async (orderId) => {
    const order = await Order.findById(orderId);
    if (!order || order.orderStatus !== 'Return requested') {
        return { success: false, message: 'Invalid return request' };
    }

    order.orderStatus = 'Delivered'; // For status updating back to delivered
    await order.save();
    return { success: true, message: 'Return request rejected' };
};

// For updating order status
const updateOrderStatus = async (orderId, status) => {
    const validStatuses = ['Pending', 'Processing', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Returned'];
    if (!validStatuses.includes(status)) return { statusCode: 400, message: 'Invalid status value' };

    const order = await Order.findById(orderId);
    if (!order) return { statusCode: 404, message: 'Order not found' };

    const statusFlow = ['Pending', 'Processing', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Returned'];
    const currentStatusIndex = statusFlow.indexOf(order.orderStatus);
    const selectedStatusIndex = statusFlow.indexOf(status);
    const canCancel = status === 'Cancelled' && currentStatusIndex >= 0 && currentStatusIndex < statusFlow.indexOf('Delivered');
    if (!canCancel && (selectedStatusIndex <= currentStatusIndex || currentStatusIndex < 0)) {
        return {
            statusCode: 400,
            message: `Can't update status to ${status} from ${order.orderStatus}. Select an upcoming order stage.`
        };
    }

    order.orderStatus = status;
    await order.save();
    return { success: true };
};

module.exports = { 
    getAdminOrders, 
    getAdminOrderDetails, 
    updateOrderStatus,
    approveReturn,
    rejectReturn
 };
