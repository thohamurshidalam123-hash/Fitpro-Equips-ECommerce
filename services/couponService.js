const Coupon = require('../models/couponModel');
const Cart = require('../models/cartModel');
const { getEffectivePrice } = require('../utils/offerPricing');

// For fetching active coupon (Not expired)
const getAvailableCoupons = async () => {
    const currentDate = new Date();
    return await Coupon.find({
        isActive: true,
        expiryDate: { $gt: currentDate }
    }).sort({ createdAt: -1 });
};

// For validating and calculate discount for a coupon
const applyCoupon = async (userId, couponCode) => {
    if (typeof couponCode !== 'string' || !couponCode.trim()) {
        return { success: false, message: 'Please enter a coupon code.' };
    }

    const coupon = await Coupon.findOne({ couponCode: couponCode.trim().toUpperCase() });

    if(!coupon) {
        return { success: false, message: 'Invalid coupon code. '};
    }

    if (!coupon.isActive || new Date(coupon.expiryDate) < new Date()) {
        return { success: false, message: 'This coupon has expired.'}
    }

    // For checking user haven't used the limit
    const userUsage = coupon.usedBy.find(u => u.userId.toString() === userId.toString());
    if(userUsage && userUsage.usedCount >= coupon.usageLimitPerUser) {
        return { success: false, message: 'You have already reached the usage limit for this coupon.'};
    }

    // Get the user cart to check the total
    const cart = await Cart.findOne({ userId }).populate({ path: 'items.productId', populate: [{ path: 'categoryId', select: 'offerPercentage' }, { path: 'brandId', select: 'offerPercentage' }] });
    if (!cart || cart.items.length === 0) {
        return { success: false, message: 'Your cart is empty.'};
    }

    // Calculate cart subtotal (re-using logic from checkoutService)
    let subtotal = 0;
    for (const item of cart.items) {
        const product = item.productId;
        const variant = item.variantId ? product.variants.id(item.variantId) : null;
        const price = getEffectivePrice(product, variant);
        subtotal += price * item.quantity;
    }

    if (subtotal < coupon.minPurchaseAmount) {
        return {
            success: false,
            message: `A minimum purchase of ₹${Number(coupon.minPurchaseAmount).toLocaleString('en-IN')} is required to use this coupon.`
        };
    }

    // For calculating discount
    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
        discountAmount = (subtotal * coupon.discountValue) / 100;
        if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
            discountAmount = coupon.maxDiscountAmount;
        }
    }else{
        discountAmount = coupon.discountValue;
    }

    // Ensure discount doesn't exceed subtotal
    discountAmount = Math.min(discountAmount.toFixed(2));

    return {
        success: true,
        couponId: coupon._id,
        couponCode: coupon.couponCode,
        couponName: coupon.couponName,
        discountAmount: Number(discountAmount.toFixed(2)),
        message: 'Coupon applied successfully!'
    };
};

module.exports = {
    getAvailableCoupons,
    applyCoupon
};