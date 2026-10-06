const checkoutService = require('../services/checkoutService');

// For loading checkout page
const loadCheckout = async (req, res) => {
    try {
        const userId = req.session.userId;

        if (!userId) {
            return res.redirect('/login');
        }
        const data = await checkoutService.getCheckoutData({
            userId,
            addressId: req.query.addressId,
            appliedCouponCode: req.session.appliedCoupon?.code
        });
        if (!data) return res.redirect('/cart');
        if (req.session.appliedCoupon && !data.appliedCoupon) delete req.session.appliedCoupon;

        // For rendering checkout page
        res.render('user/checkout', {
            currentPage: 'shop',
            ...data
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

        const result = await checkoutService.createOrderAddress({ userId, data: req.body });
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: 'Please correct the address details.',
                errors: result.errors
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Address added successfully.',
            addressId: result.addressId
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

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please log in first.' });
        }
        const result = await checkoutService.placeOrder({
            ...req.body,
            userId,
            couponCode: req.session.appliedCoupon?.code
        });
        if (!result.success) return res.status(result.statusCode).json({ success: false, message: result.message });
        delete req.session.appliedCoupon;
        return res.status(201).json(result);
    } catch (error) {
        console.error('Error in place order:', error);
        return res.status(500).json({ success: false, message: 'Server error while placing your order.' });
    }
};

// For loading order success page
const loadOrderSuccess = async (req, res) => {
    try {
        const data = await checkoutService.getOrderSuccessData({ orderId: req.params.id, userId: req.session.userId });
        if (!data) return res.redirect('/');

        return res.render('user/orderSuccess', {
            ...data,
            currentPage: 'shop'
        });
    } catch (error) {
        console.error('Success page error:', error);
        res.redirect('/');
    }
};

// For verifying payment
const verifyPayment = async (req, res) => {
    try{
        const { orderId, paymentData } = req.body;
        const result = await checkoutService.verifyRazorpayPayment({ orderId, paymentData });

        if (result.success) {
            return res.status(200).json({ success: true, message: 'Payment verified successfully.'});
        }else{
            return res.status(400).json({ success: false, message: result.message });
        }
    } catch (error) {
        console.error('Error verifying payment:',error);
        return res.status(500).json({ success: false, message: 'Server error during payment verification.'});
    }
};

// For handling payment fialure callback
const paymentFailure = async (req, res) => {
    try{
        await checkoutService.handlePaymentFailure({ orderId: req.body.orderId });
        return res.status(200).json({ success: true});
    }catch(error) {
        console.error('Error handling payment failure:',error);
        return res.status(500).json({ success: false, message: 'Server Error in handling payment failure'});
    }
};

// For loading payment failed page
const loadPaymentFailed = async (req, res) => {
    try{
        res.render('user/paymentFailed', {
            orderId: req.params.id,
            currentPage: 'shop'
        });
    }catch(error) {
        res.redirect('/checkout');
    }
};

module.exports = {
    loadCheckout,
    addOrderAddress,
    placeOrder,
    verifyPayment,
    paymentFailure,
    loadOrderSuccess,
    loadPaymentFailed
};
