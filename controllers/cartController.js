const cartService = require('../services/cartService');
const couponService = require('../services/couponService');
const wishlistService = require('../services/wishlistService');

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

const getCartCount = async (req, res) => {
    try {
        if (!req.session.userId) return res.json({ success: true, count: 0 });
        const count = await cartService.getCartBadgeCount(req.session.userId);
        return res.json({ success: true, count });
    } catch (error) {
        console.error('Cart count error:', error.message);
        return res.status(500).json({ success: false, message: 'Unable to load cart count.' });
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
        const count = await cartService.getCartBadgeCount(userId);
        const wishlistCount = await wishlistService.getWishlistBadgeCount(userId);
        return res.json({ ...result, count, wishlistCount });
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

        const data = await cartService.getCartPageData({ userId });
        const item = data.cartItems.find(cartItem => String(cartItem._id) === String(req.body.itemId));
        let discount = 0;
        let appliedCoupon = req.session.appliedCoupon || null;
        if (appliedCoupon) {
            const couponResult = await couponService.applyCoupon(userId, appliedCoupon.code);
            if (couponResult.success) {
                discount = couponResult.discountAmount;
                appliedCoupon.id = couponResult.couponId;
                appliedCoupon.code = couponResult.couponCode;
                appliedCoupon.name = couponResult.couponName;
                appliedCoupon.discountAmount = discount;
            } else {
                delete req.session.appliedCoupon;
                appliedCoupon = null;
            }
        }

        return res.json({
            success: true,
            item: item ? {
                id: String(item._id),
                quantity: item.quantity,
                price: item.price,
                totalPrice: item.totalPrice,
                isAvailable: item.isAvailable,
                hasStock: item.hasStock,
                outOfStock: item.outOfStock,
                warning: !item.isAvailable
                    ? 'This item is currently unlisted and cannot be purchased.'
                    : item.outOfStock
                        ? 'Out of Stock'
                        : !item.hasStock
                            ? `Only ${item.variant ? item.variant.stock : item.productId.availableStock} units left. Reduce quantity.`
                            : ''
            } : null,
            cart: {
                itemCount: data.itemCount,
                subtotal: data.subtotal,
                tax: data.tax,
                shipping: data.shipping,
                discount,
                total: data.subtotal + data.tax + data.shipping - discount,
                canCheckout: data.canCheckout,
                couponName: appliedCoupon ? appliedCoupon.name || appliedCoupon.code : null
            }
        });
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
        const count = await wishlistService.getWishlistBadgeCount(userId);
        res.json({ ...result, count });
    } catch (error) {
        console.error('Move to wishlist error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

module.exports = {
    loadCartPage,
    getCartCount,
    addToCart,
    updateQuantity,
    removeFromCart,
    moveToWishlist
};