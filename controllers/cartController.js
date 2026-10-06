const cartService = require('../services/cartService');
const couponService = require('../services/couponService');

const loadCartPage = async (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) return res.redirect('/login');

        const data = await cartService.getCartPageData({ userId, requestedPage: req.query.page });
        const { subtotal, tax, shipping } = data;

        const availableCoupons = await couponService.getAvailableCoupons();
        const appliedCoupon = req.session.appliedCoupon || null;
        let discount = 0;
        if (appliedCoupon) {
            const couponResult = await couponService.applyCoupon(userId, appliedCoupon.code);

            if (couponResult.success) {
                discount = couponResult.discountAmount;
                req.session.appliedCoupon.id = couponResult.couponId;
                req.session.appliedCoupon.code = couponResult.couponCode;
                req.session.appliedCoupon.name = couponResult.couponName;
                req.session.appliedCoupon.discountAmount = discount;
            } else {
                delete req.session.appliedCoupon;
            }
        }
        const finalTotal = subtotal + tax + shipping - discount;

        // For rendering cart
        return res.render('user/cart', {
            ...data,
            currentPage: 'cart',
            availableCoupons,
            appliedCoupon: req.session.appliedCoupon,
            discount: discount,
            total: finalTotal
        });
    } catch (error) {
        console.error('Cart load error:', error.message);
        return res.status(500).send('Server Error');
    }
};

const addToCart = async (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to add items to cart' });
        }

        const result = await cartService.addToCart({ ...req.body, userId });
        if (!result.success) return res.status(result.statusCode).json({ success: false, message: result.message });
        return res.json(result);
    } catch (error) {
        console.error('Add to cart error:', error.message);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// For updating quantity of product in cart
const updateQuantity = async (req, res) => {
    try {
        const userId = req.session.userId;
        const result = await cartService.updateQuantity({ ...req.body, userId });
        if (!result.success) return res.status(result.statusCode).json({ success: false, message: result.message });
        return res.json({ success: true });
    } catch (error) {
        console.error('Update quantity error:', error.message);
        return res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const removeFromCart = async (req, res) => {
    try {
        const userId = req.session.userId;
        await cartService.removeFromCart({ ...req.body, userId });

        res.json({ success: true });
    } catch (error) {
        console.error('Remove item erro:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const moveToWishlist = async (req, res) => {
    try {

        const userId = req.session.userId;
        const result = await cartService.moveToWishlist({ ...req.body, userId });
        if (!result.success) return res.status(result.statusCode).json({ success: false, message: result.message });
        res.json(result);
    } catch (error) {
        console.error('Move to wishlist error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

module.exports = {
    loadCartPage,
    addToCart,
    updateQuantity,
    removeFromCart,
    moveToWishlist
};