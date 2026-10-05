const orderService = require('../services/orderService');

// For loading user orders listing page
const loadOrderHistory = async (req, res) => {
    try{
        const userId = req.session.userId;
        if (!userId) return res.redirect('/login');

        const data = await orderService.getOrderHistory({
            userId,
            requestedPage: Math.max(parseInt(req.query.page, 10) || 1, 1),
            status: req.query.status,
            search: req.query.search
        });

        res.render('user/orders', {
            currentPage: 'orders',
            ...data
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

        const data = await orderService.getOrderDetails({ orderId: req.params.id, userId });

        if (!data) return res.redirect('/orders');

        res.render('user/orderDetails', {
            currentPage: 'orders',
            ...data
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
        const result = await orderService.cancelOrder({ userId, orderId: req.params.id, reason: req.body.reason });
        if (!result.success) return res.status(result.statusCode).json({ success: false, message: result.message });
        res.json(result);

        }catch(error){
            console.error('Error in cancel oreder:'.error);
            res.status(500).json({ success: false, message: 'Server Error'});
    }
};

// For returning order
const returnOrder = async (req, res) => {
    try{
        const userId = req.session.userId;
        const result = await orderService.returnOrder({ userId, orderId: req.params.id, reason: req.body.reason });
        if (!result.success) return res.status(result.statusCode).json({ success: false, message: result.message });
        res.json(result);
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