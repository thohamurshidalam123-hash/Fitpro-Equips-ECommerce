const Order = require('../models/orderModel');
const Product = require('../models/productModel');
const Razorpay = require('razorpay'); 
const mongoose = require('mongoose');
const walletService = require('./walletService');
const { validateOrderReason } = require('../validators/orderValidators');


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

// For calculating proportional refund
const calculateItemRefund = (item, order) => {
    const proportion = item.itemTotal / order.subtotal;
    const proportionalDiscount = order.discount * proportion;
    const proportionalTax = order.tax * proportion;
    // For disabling shipping charge refund for partial cancellation, enabling only if it is last item
    return item.itemTotal + proportionalTax - proportionalDiscount;

};

// For cancelling an order and restoring stock
const cancelOrder = async ({ orderId, userId, itemId, reason }) => {
    const normalizedReason = typeof reason === 'string' ? reason.trim() : '';
    const reasonError = validateOrderReason(normalizedReason);
    if (reasonError) return { statusCode: 400, message: reasonError, errors: { reason: reasonError } };

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) return { statusCode: 404, message: 'Order not found' };
    
    const paymentWasCompleted = ['paid', 'completed'].includes(String(order.paymentStatus || '').trim().toLowerCase());
    
    let refundAmount = 0;
    // For partial cancellation
    if(itemId) {
        const item = order.items.id(itemId);
        if(!item) return { statusCode: 404, message: 'Item not found in order'};
        if([ 'Delivered', 'Cancelled', 'Returned', 'Return requested'].includes(item.itemStatus)){
            return { statusCode: 400, message: 'This item cannot be cancelled'};
        }

        item.itemStatus = 'Cancelled';
        item.cancellationReason = normalizedReason;
        refundAmount = calculateItemRefund(item, order);
        await adjustOrderItemStock(item, item.quantity);

        // For marking full order cancelled if all items are cancelled
        const allCancelled = order.items.every(i => i.itemStatus === 'Cancelled');
        if (allCancelled) order.orderStatus = 'Cancelled';
    }
    else {
        // For full order cancellation
        if ([ 'Delivered', 'Cancelled', 'Returned', 'Return requested'].includes(order.orderStatus)) {
            return { statusCode: 400, message: 'This order cannot be cancelled'};
        }
        const refundableItems = order.items.filter(item => !['Cancelled', 'Returned'].includes(item.itemStatus));
        if (!refundableItems.length) {
            return { statusCode: 400, message: 'No refundable items remain in this order.' };
        }

        const previouslyRefundedAmount = order.items
            .filter(item => ['Cancelled', 'Returned'].includes(item.itemStatus))
            .reduce((total, item) => total + Math.round((calculateItemRefund(item, order) + Number.EPSILON) * 100) / 100, 0);
        const remainingOrderBalance = Math.max(0, Number((Number(order.grandTotal) - previouslyRefundedAmount).toFixed(2)));
        order.orderStatus = 'Cancelled';
        if (normalizedReason) order.cancellationReason = normalizedReason;
        refundAmount = Math.min(refundableItems.reduce(
            (total, item) => total + calculateItemRefund(item, order),
            Number(order.shippingCost) || 0
        ), remainingOrderBalance);

        for (const item of refundableItems) {
            item.itemStatus = 'Cancelled';
            item.cancellationReason = normalizedReason;
            await adjustOrderItemStock(item, item.quantity);
        }
    }


    //For refunding to wallet for paid orders
    if (paymentWasCompleted && refundAmount > 0) {
        await walletService.creditWallet(
            userId,
            refundAmount,
            `Refund for cancelled order ${itemId ? 'item' : 'order'} from #${order.orderId}`,
            order._id
        );
        if (order.orderStatus === 'Cancelled') order.paymentStatus = 'Refunded';
    } 

    await order.save();
    return {
        success: true,
        message: paymentWasCompleted
            ? `Order cancelled successfully. The refund amount of ₹${refundAmount.toFixed(2)} has been credited to your wallet.`
            : 'Order cancelled successfully'
    };
};

// For returning an order and restoring stock
const returnOrder = async ({ orderId, userId, itemId, reason }) => {
    const normalizedReason = typeof reason === 'string' ? reason.trim() : '';
    const reasonError = validateOrderReason(normalizedReason, { required: true });
    if (reasonError) return { statusCode: 400, message: reasonError, errors: { reason: reasonError } };

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) return { statusCode: 404, message: 'Order not found' };

    const isOrderDelivered = order.orderStatus === 'Delivered';

    if (itemId) {
        // For partial return
        const item = order.items.id(itemId);
        if (!item) return { statusCode: 404, message: 'Item not found'};
        if (item.returnRejected) {
            return { statusCode: 400, message: 'This product\'s return request was rejected and cannot be resubmitted.' };
        }
        if (item.itemStatus === 'Return requested') {
            return { statusCode: 400, message: 'A return request has already been submitted for this product.' };
        }
        if (['Cancelled', 'Returned'].includes(item.itemStatus)) {
            return { statusCode: 400, message: 'This product cannot be returned.' };
        }
        // If the order is delivered , the item is delivered
        if (!isOrderDelivered && item.itemStatus !== 'Delivered') {
            return { statusCode: 400, message: 'Only delivered items can be returned'}
        }
        item.itemStatus = 'Return requested';
        item.returnReason = normalizedReason;
    } else {
        // Full return
        if (!isOrderDelivered) return { statusCode: 400, message: 'Only delivered orders can be returned'};
        if (order.items.some(item => item.returnRejected)) {
            return {
                statusCode: 400,
                message: 'A full return cannot be requested because a return request for one or more products was rejected.'
            };
        }
        for (const item of order.items) {
            if (item.itemStatus !== 'Cancelled' && item.itemStatus !== 'Returned') {
                item.itemStatus = 'Return requested';
                item.returnReason = normalizedReason;
            }
        }
    }

    // For changing status to requested.
    order.orderStatus = 'Return requested';
    await order.save();
    
    return { success: true, message: 'Order return initiated successfully' };
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
