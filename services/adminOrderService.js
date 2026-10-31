const Order = require('../models/orderModel');
const walletService = require('./walletService');
const Product = require('../models/productModel');
const { validateOrderReason } = require('../validators/orderValidators');
const unpaidStatusMessage = 'Only paid orders can be updated to corresspondant status';
const isOrderPaid = order => ['paid', 'completed'].includes(String(order.paymentStatus || '').trim().toLowerCase());

const restoreOrderItemStock = async item => {
    const product = await Product.findById(item.productId);
    if (!product) return;

    let variant = item.variantId ? product.variants.id(item.variantId) : null;
    if (!variant && product.variants.length > 0) {
        let matchingVariants = item.image
            ? product.variants.filter(productVariant => productVariant.images.includes(item.image))
            : [];
        if (matchingVariants.length !== 1) {
            matchingVariants = product.variants.filter(productVariant => Number(productVariant.price) === Number(item.price));
        }
        if (matchingVariants.length === 1) variant = matchingVariants[0];
    }

    if (variant) {
        variant.stock = Math.max(0, (Number(variant.stock) || 0) + (Number(item.quantity) || 0));
        if (variant.stock > 0 && variant.status === 'Out of Stock') variant.status = 'Active';
        product.availableStock = product.variants.reduce(
            (total, productVariant) => total + (Number(productVariant.stock) || 0),
            0
        );
    } else if (product.variants.length === 0) {
        product.availableStock = Math.max(0, (Number(product.availableStock) || 0) + (Number(item.quantity) || 0));
    }

    if (product.availableStock === 0) product.status = 'Out of Stock';
    else if (product.status === 'Out of Stock') product.status = 'Active';
    await product.save();
};

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

// For calculating proportional refund for an item
const calculateItemRefund = (item, order) => {
    const proportion = item.itemTotal / order.subtotal;
    const proportionalDiscount = order.discount * proportion;
    const proportionalTax = order.tax * proportion;
    // For avoiding refunding of shipping charges for partial cancellation
    return item.itemTotal + proportionalTax - proportionalDiscount;
};

// For approving return requests
const approveReturn = async (orderId, itemId = null) => {
    const order = await Order.findById(orderId);
    if (!order || order.orderStatus !== 'Return requested') {
        return { success: false, message: 'Invalid return request' };
    }
    if (!isOrderPaid(order)) {
        return { success: false, statusCode: 403, message: 'Only return requests for paid orders can be approved.' };
    }

    let refundAmount = 0;

    // For individual item return approval
    if (itemId) {
        const item = order.items.id(itemId);
        if (!item || item.itemStatus !== 'Return requested') {
            return { success: false, message: 'Invalid return request for this item' };
        }

        item.itemStatus = 'Returned';
        refundAmount = calculateItemRefund(item, order);

        // For restoring stock
        await restoreOrderItemStock(item);

        // For checking if all item are returned or cancelled
        const allEnded = order.items.every(i => ['Returned', 'Cancelled'].includes(i.itemStatus));
        if (allEnded) {
            const allReturned = order.items.every(i => i.itemStatus === 'Returned');
            order.orderStatus = allReturned ? 'Returned' : 'Cancelled';
            order.paymentStatus = 'Refunded';
        } else if (!order.items.some(i => i.itemStatus === 'Return requested')) {
            order.orderStatus = 'Delivered';
        }
    } else {
        // For full order return approval
        if (order.orderStatus !== 'Return requested') {
            return { success: false, message: 'Invalid full order return request' };
        }

        order.orderStatus = 'Returned';
        order.paymentStatus = 'Refunded';
        refundAmount = order.grandTotal;

        for (const item of order.items) {
            if (['Return requested', 'Return requsted'].includes(item.itemStatus)) {
                item.itemStatus = 'Returned';
                await restoreOrderItemStock(item);
            }
        }
    }

    if (refundAmount > 0) {
        await walletService.creditWallet(
            order.userId,
            refundAmount,
            `Refund for returned ${itemId ? 'item' : 'order'} #${order.orderId}`,
            order._id
        );
    }

    await order.save();
    return { success: true, message: 'Return approved and refund successfully.'}
};

// For rejecting return requests
const rejectReturn = async (orderId, itemId = null, reason) => {
    const normalizedReason = typeof reason === 'string' ? reason.trim() : '';
    const reasonError = validateOrderReason(normalizedReason, { required: true });
    if (reasonError) {
        return { success: false, statusCode: 400, message: reasonError, errors: { reason: reasonError } };
    }

    const order = await Order.findById(orderId);
    if (!order || order.orderStatus !== 'Return requested') {
        return { success: false, message: 'Invalid return request' };
    }

    if (itemId) {
        const item = order.items.id(itemId);
        if (!item || item.itemStatus !== 'Return requested') {
            return { success: false, message: 'Invalid return request for this item'};
        }
        item.itemStatus = 'Delivered';
        item.returnRejected = true;
        item.returnRejectionReason = normalizedReason;

        // For reverting overall order status if necessary
        if (order.orderStatus === 'Return requested') {
            const anyOtherRequested = order.items.some(i => i.itemStatus === 'Return requested');
            if (!anyOtherRequested) order.orderStatus = 'Delivered';
        }
    } else {
        if (order.orderStatus !== 'Return requested') {
            return { success: false, message: 'Invalid return request'};
        }
        order.orderStatus = 'Delivered';
        for (const item of order.items) {
            if (item.itemStatus === 'Return requested') {
                item.itemStatus = 'Delivered';
                item.returnRejected = true;
                item.returnRejectionReason = normalizedReason;
            }
        }
    }

    await order.save();
    return { success: true, message: 'Return request rejected' };

};

// For updating order status
const updateOrderStatus = async (orderId, status, itemId = null) => {
    const validStatuses = ['Pending', 'Processing', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];
    if (!validStatuses.includes(status)) return { statusCode: 400, message: 'Invalid status value' };

    const order = await Order.findById(orderId);
    if (!order) return { statusCode: 404, message: 'Order not found' };

    const statusFlow = ['Pending', 'Processing', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'];

    if (itemId) {
        // For partial staus updation
        const item = order.items.id(itemId);
        if (!item) return { statusCode: 404, message: 'Item not found' };
        
        const currentItemStatus = item.itemStatus || order.orderStatus;

        if (['Delivered', 'Returned', 'Cancelled', 'Return requested'].includes(currentItemStatus)) {
            return { statusCode: 400, message: 'Changing status is not allowed for this item' };
        }

        if (status === 'Cancelled') {
            item.itemStatus = 'Cancelled';
            let refundAmount = 0;
            if (['Razorpay', 'Wallet'].includes(order.paymentMethod) && isOrderPaid(order)) {
                refundAmount = calculateItemRefund(item, order);
                if (refundAmount > 0) {
                     await walletService.creditWallet(
                         order.userId,
                         refundAmount,
                         `Refund for cancelled item from #${order.orderId}`,
                         order._id
                     );
                }
            }

            // For restoring Stock
            await restoreOrderItemStock(item);

            // For checking if all items are cancelled
            if (order.items.every(i => i.itemStatus === 'Cancelled')) {
                order.orderStatus = 'Cancelled';
                if (isOrderPaid(order)) order.paymentStatus = 'Refunded';
            }
        } else {
             // For checking forward move of status
             const currentStatusIndex = statusFlow.indexOf(currentItemStatus);
             const selectedStatusIndex = statusFlow.indexOf(status);
             if (selectedStatusIndex <= currentStatusIndex && currentStatusIndex !== -1) {
                  return { statusCode: 400, message: `Can't update item status to ${status} from ${currentItemStatus}.` };
             }
             item.itemStatus = status;

             // For auto-update order status if all items match the new status
             if (order.items.every(i => i.itemStatus === status || i.itemStatus === 'Cancelled')) {
                 order.orderStatus = status;
                 if (status === 'Delivered') {
                     if (order.paymentMethod === 'Cash on Delivery') order.paymentStatus = 'Completed';
                 }
             }
        }

    } else {
        // For updating full order status 
        const currentStatus = order.orderStatus;
        if (['Delivered', 'Returned', 'Cancelled', 'Return requested'].includes(currentStatus)) {
            return { statusCode: 400, message: 'Changing status is not allowed for this order' };
        }

        if (status === 'Cancelled') {
            const refundableItems = order.items.filter(item => !['Cancelled', 'Returned'].includes(item.itemStatus));
            if (!refundableItems.length) {
                return { statusCode: 400, message: 'No refundable items remain in this order.' };
            }

            order.orderStatus = 'Cancelled';
            if (['Razorpay', 'Wallet'].includes(order.paymentMethod) && isOrderPaid(order)) {
                const previouslyRefundedAmount = order.items
                    .filter(item => ['Cancelled', 'Returned'].includes(item.itemStatus))
                    .reduce((total, item) => total + Math.round((calculateItemRefund(item, order) + Number.EPSILON) * 100) / 100, 0);
                const remainingOrderBalance = Math.max(0, Number((Number(order.grandTotal) - previouslyRefundedAmount).toFixed(2)));
                const remainingItemsRefund = refundableItems.reduce(
                    (total, item) => total + calculateItemRefund(item, order),
                    Number(order.shippingCost) || 0
                );
                const refundAmount = Math.min(remainingItemsRefund, remainingOrderBalance);
                if (refundAmount > 0) {
                    await walletService.creditWallet(order.userId, refundAmount, `Refund for cancelled order ${order.orderId}`, order._id);
                }
                order.paymentStatus = 'Refunded';
            }

            for (const item of refundableItems) {
                item.itemStatus = 'Cancelled';
                await restoreOrderItemStock(item);
            }
        } else {
            const currentStatusIndex = statusFlow.indexOf(currentStatus);
            const selectedStatusIndex = statusFlow.indexOf(status);
            if (selectedStatusIndex <= currentStatusIndex) {
                return { statusCode: 400, message: `Can't update status to ${status} from ${currentStatus}. Select an upcoming order stage.` };
            }

            if (status === 'Delivered') {
                if (order.paymentMethod === 'Cash on Delivery') {
                    order.paymentStatus = 'Completed';
                } else if (!isOrderPaid(order)) {
                    return { statusCode: 403, message: 'Only paid orders can be marked as Delivered.' };
                }
            }

            order.orderStatus = status;
            // For updating status of non-cancelled/returned items
            for (const item of order.items) {
                if (!['Cancelled', 'Returned', 'Return requested'].includes(item.itemStatus)) {
                    item.itemStatus = status;
                }
            }
        }
    }

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
