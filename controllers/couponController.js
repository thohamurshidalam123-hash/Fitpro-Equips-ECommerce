const couponService = require('../services/couponService');

// For apllying coupon
const applyCoupon = async (req, res) => {
    try{
        const userId =req.session.userId;
        const { couponCode } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to apply coupons.'});
        }

        const result = await couponService.applyCoupon(userId, couponCode);

        if (result.success) {
        // Save coupon state in the user's session
        req.session.appliedCoupon = {
            id: result.couponId,
            code: result.couponCode,
            discountAmount: result.discountAmount
        };
        return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error applying coupon:',error);
        res.status(500).json({ success: false, message: 'Server Error'});
    }
};

// For removing coupon
const removeCoupon = async (req, res) => {
    try{
        if (req.session.appliedCoupon) {
            delete req.session.appliedCoupon;
        }
        res.status(200).json({ success: true, message: 'Coupon removed successfully.'});
    }catch(error) {
        console.error('Error in removing coupon:',error);
        res.status(500).json({ success: false, message: 'Server Error'});
    }
};

module.exports = {
    applyCoupon,
    removeCoupon
};