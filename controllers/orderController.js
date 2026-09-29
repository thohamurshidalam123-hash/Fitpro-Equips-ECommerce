const Order =require('../models/orderModel');
const Product = require('../models/productModel');
const mongoose = require('mongoose');

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

const loadOrderHistory = async (req, res) => {
    try{
        const userId = req.session.userId;
        if (!userId) return res.redirect('/login');

        const requestedPage = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = 10;
        const currentStatus = ['all', 'pending', 'shipped', 'delivered'].includes(String(req.query.status || 'all').toLowerCase())
            ? String(req.query.status || 'all').toLowerCase()
            : 'all';
        const currentSearch = String(req.query.search || '').trim();
        const pendingStatuses = ['Pending', 'Processing', 'Packed', 'Shipped'];

        // For implement searching
        const listQuery = { userId };

        // For status filter
        if (currentStatus === 'pending') {
            // Capitalizing for match enum values
            listQuery.orderStatus = { $in: ['Pending', 'Processing', 'Packed'] };
        } else if (currentStatus === 'shipped') {
            listQuery.orderStatus = 'Shipped';
        } else if (currentStatus === 'delivered') {
            listQuery.orderStatus = 'Delivered';
        }

        // Handle search filter
        if (currentSearch) {
            listQuery.$or = [
                { orderId: { $regex: currentSearch, $options: 'i' } },
                { 'items.name': { $regex: currentSearch, $options: 'i' } }
            ];
        }

        // For calculating dynamic statistics for the top cards
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

        // For fetching the specifically requested orders
        const orders = await Order.find(listQuery)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        res.render('user/orders',{
            currentPage: 'orders',
            orders,
            stats,
            currentSearch,
            currentStatus,
            page,
            limit,
            totalPages,
            totalOrders: filteredOrderCount
        });
        }catch(error) {
            console.error('Error in load order details:',error);
            res.status(500).send('Server Error');
        }
};

// For loading order details page
const loadOrderDetails = async (req, res) => {
    try{
        const userId = req.session.userId;
        if (!userId) return res.redirect('/login');

        const orderId = req.params.id;
        const order = await Order.findOne({ _id: orderId, userId }).lean();

        if(!order) return res.redirect('/orders');

        // For calculating estimated delivery
        const deliveryStart = new Date(order.createdAt);
        deliveryStart.setDate(deliveryStart.getDate() + 3);
        const options = { month: 'short', day: 'numeric' };
        const estimatedDelivery = deliveryStart.toLocaleDateString('en-US', options);

        res.render('user/orderDetails',{
            currentPage: 'orders',
            order,
            estimatedDelivery
        });
    }catch(error) {
        console.error('Error in load order details page:',error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// For order cancellation
const cancelOrder = async (req, res) => {
    try{
        const userId = req.session.userId;
        const orderId = req.params.id;
        const { reason } = req.body;

        const order = await Order.findOne({ _id: orderId, userId});
        if(!order) return res.status(404).json({ success: false, message: 'Order not found'});

        if (['Delivered', 'Cancelled', 'Returned'].includes(order.orderStatus)){
            return res.status(400).json({ success: false, message: 'This order cannot be cancelled'});
        }

        // For updating status and reason
        order.orderStatus = 'Cancelled';
        if(reason) order.cancellationReason = reason;
        await order.save();

        // For incrementing stock for all items
        for (let item of order.items){
            await adjustOrderItemStock(item, item.quantity);

        }

        res.json({ success: true, message: 'Order cancelled successfully.'});

        }catch(error){
            console.error('Error in cancel oreder:'.error);
            res.status(500).json({ success: false, message: 'Server Error'});
    }
};

// For returning order
const returnOrder = async (req, res) => {
    try{
        const userId = req.session.userId;
        const orderId = req.params.id;
        const {reason} = req.body;

        if (!reason || reason.trim() === '') {
            return res.status(400).json({ success: false, message: 'Reason for return is mandatory'});
        }

        const order = await Order.findOne({ _id: orderId, userId});
        if (!order) return res.status(404).json({ success: false, message: 'Order not found'});

        if (order.orderStatus !== 'Delivered') {
            return res.status(400).json({ success: false, message: 'Only delivered order can be returned'});
        }

        // For updating status to returned
        order.orderStatus = 'Returned';
        order.returnReason = reason;
        await order.save();

        // For incrementing stock of returned item
        for (let item of order.items) {
            await adjustOrderItemStock(item, item.quantity);
        }

        res.json({ success: true, message: 'Order return initiates successfully'});
    }catch(error) {
        console.error('Error in returning order:',error);
        res.status(500).json({ success: false, message: 'Server Error'})
    }
}

module.exports = {
    loadOrderHistory,
    loadOrderDetails,
    cancelOrder,
    returnOrder
}