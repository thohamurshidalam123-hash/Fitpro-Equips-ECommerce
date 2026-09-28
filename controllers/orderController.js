const Order =require('../models/orderModel');
const Product = require('../models/productModel');

const loadOrderHistory = async (req, res) => {
    try{
        const userId = req.session.userId;
        if (!userId) return res.redirect('/login');

        // For fetching all orders (newest will come first)
        const allOrders = await Order.find({ userId })
            .sort({ createdAt: -1 })
            .lean();

        // For calculating dynamic statistics for the top cards
        const stats = {
            total: allOrders.length,
            completed: allOrders.filter(o => o.orderStatus === 'Delivered').length,
            pending: allOrders.filter(o => ['Pending', 'Processing', 'Packed', 'Shipped'].includes(o.orderStatus)).length,
            // Sum grand totals of orders that aren't cancelled or return
            spent: allOrders.filter(o => o.orderStatus !== 'Cancelled' && o.orderStatus !== 'Returned')
                        .reduce((sum, o) => sum + (o.grandTotal || 0), 0)
            };

            // For implement searching
            let listQuery = { userId };

            // For status filter
            const currentStatus = req.query.status || 'all';
            if(currentStatus === 'pending'){
                // Capitalizing for match enum values
                listQuery.orderStatus = currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1);
            }

            // Handle search filter
           const currentSearch = req.query.search ? req.query.search.trim() : '';
        if (currentSearch) {
            listQuery.$or = [
                { orderId: { $regex: currentSearch, $options: 'i' } },
                { 'items.name': { $regex: currentSearch, $options: 'i' } }
            ];
        }

        // For fetching the specifically requested orders
        const orders = await Order.find(listQuery)
        .sort({ createdAt: -1 })
        .lean();

        res.render('user/orders',{
            currentPage: 'orders',
            orders,
            stats,
            currentSearch,
            currentStatus
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
            await Product.findByIdAndUpdate(item.productId, {
                $inc: { availableStock: item.quantity}
            });

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
            await Product.findByIdAndUpdate(item.productId, {
                $inc: { availableStock: item.quantity }
            });
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