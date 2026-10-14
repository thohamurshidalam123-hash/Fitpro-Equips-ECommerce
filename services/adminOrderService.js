const Order = require('../models/orderModel');
const walletService = require('./walletService');
const Product = require('../models/productModel');
const unpaidStatusMessage = 'Only paid orders can be updated to corresspondant status';
const isOrderPaid = order => ['paid', 'completed'].includes(String(order.paymentStatus || '').trim().toLowerCase());

// For listing orders with search, filter, sort and pagination
const getAdminOrders = async ({ page = 1, search = '', status = 'all', payment = 'all', limit = 10 }) => {
    const validStatuses = ['Processing', 'Packed', 'Shipped', 'Delivered', 'Cancelled', 'Returned', 'Return requested'];
    const validPaymentStatuses = ['Completed', 'Pending', 'Refunded'];
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
    if (!isOrderPaid(order)) {
        return { success: false, statusCode: 403, message: 'Only return requests for paid orders can be approved.' };
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
    const validStatuses = ['Pending', 'Processing', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];
    if (!validStatuses.includes(status)) return { statusCode: 400, message: 'Invalid status value' };

    const order = await Order.findById(orderId);
    if (!order) return { statusCode: 404, message: 'Order not found' };

    const currentStatus = order.orderStatus;
    // lock any status changes if the order is already in an end state
    if(['Delivered','Returned','Cancelled','Return requested'].includes(currentStatus)) {
        return{ statusCode: 400, message: 'Changing status is not allowed for this order'}
    }

    // Admin cancellation logic
    if(status === 'Cancelled') {
        order.orderStatus = 'Cancelled';

        // For auto refund if paid via digital methods
        if(['Razorpay','Wallet'].includes(order.paymentMethod) && isOrderPaid(order)) {
            await walletService.creditWallet(
                order.userId,
                order.grandTotal,
                `Refund for cancelled order ${order.orderId}`,
                order._id
            );
            order.paymentStatus = 'Refunded';
        }

        // For restoring stock
        for (const item of order.items) {
            if (item.variantId) {
                await Product.updateOne(
                    { _id: item.productId, 'variants._id' : item.variantId },
                    { $inc: { 'variants.$.stock': item.quantity }}
                );
            }else {
                await Product.findByIdAndUpdate(item.productId, { $inc: { availableStock: item.quantity }});
            }
        }
        await order.save();
        return { success: true };
    }

    // For Strict forward status movement
    const statusFlow = ['Pending', 'Processing', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'];
    const currentStatusIndex = statusFlow.indexOf(currentStatus);
    const selectedStatusIndex = statusFlow.indexOf(status);
    
    if ( selectedStatusIndex <= currentStatusIndex) {
        return {
            statusCode: 400,
            message: `Can't update status to ${status} from ${currentStatus}. Select an upcoming order stage.`
        };
    }

    // For delivered orders in cash on delivery
    if(status === 'Delivered') {
        if (order.paymentMethod === 'Cash on Delivery') {
            order.paymentStatus = 'Completed';
        }else if (!isOrderPaid(order)) {
            return { statusCode: 403, message: 'Only paid orders can be marked as Delivered.' };
        }
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
