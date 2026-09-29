const Wishlist = require('../models/wishlistModel');
const Product = require('../models/productModel');

// For loading wishlist page
const loadWishlist = async (req, res) => {
    try{
        const userId = req.session.userId;
        if(!userId) return res.redirect('/login');

        const limit = 12;
        const requestedPage = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const wishlistSummary = await Wishlist.findOne({ userId }).select('products').lean();
        const itemCount = wishlistSummary?.products?.length || 0;
        const totalPages = Math.ceil(itemCount / limit);
        const page = Math.min(requestedPage, Math.max(totalPages, 1));
        const wishlist = await Wishlist.findOne({ userId }).populate({
            path: 'products.productId',
            populate: [
                { path: 'categoryId', select: 'name' },
                { path: 'brandId', select: 'name' }
            ]
        }).slice('products', [(page - 1) * limit, limit]).lean();

        // For filtering out any product that deleted from db
        const validItems = wishlist && wishlist.products ? wishlist.products.filter(item => item.productId !== null) : [];

        res.render('user/wishlist', {
            wishlistItems: validItems,
            itemCount,
            page,
            limit,
            totalPages,
            currentPage: 'wishlist'
        });
    }catch(error){
        console.error('Error loading wishlist:', error.message);
        res.status(500).send('Server Error');
    }
};

// For toggling wishlist
const toggleWishlist = async (req, res) => {
    try{
        const { productId, variantId } = req.body;
        const userId = req.session.userId;

        if(!userId) {
            return res.status(401).json({ success:false, message: 'Please log in to use the wishlist. '});
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product is currently not available' });
        }
        const variant = variantId ? product.variants.id(variantId) : null;
        if (product.variants.length && !variant) {
            return res.status(400).json({ success: false, message: 'Please select a valid product variant.' });
        }

        let wishlist = await Wishlist.findOne({ userId });
        const requestedVariantId = variant ? String(variant._id) : '';
        const duplicate = wishlist?.products.some(item =>
            item.productId.toString() === String(productId) && String(item.variantId || '') === requestedVariantId
        );
        if (duplicate) {
            return res.status(409).json({
                success: false,
                message: variant ? 'This product variant is already in your wishlist.' : 'This product is already in your wishlist.'
            });
        }

        if (variant && (variant.stock <= 0 || variant.status === 'Out of Stock')) {
            return res.status(400).json({ success: false, message: 'Please select an available product variant.' });
        }
        if (product.status !== 'Active' || product.availableStock <= 0) {
            return res.status(400).json({ success: false, message: 'Product is currently not available' });
        }

        if (!wishlist) {
            wishlist = new Wishlist({ userId, products: [] });
        }

        wishlist.products.push({ productId, variantId: variant?._id });
        await wishlist.save();
        return res.json({ success: true, action: 'added', message: 'Added to wishlist' });
    }catch(error){
        console.error('Error in toggle wishlist:',error.message);
        res.status(500).json({ success: false, message:'Server Error'});
    }
};

// For removing single item from wishlist
const removeWishlistItem = async (req, res) => {
    try{
        const { productId, variantId } = req.body;
        const userId = req.session.userId;

        await Wishlist.updateOne(
            { userId },
            { $pull: { products: { productId, variantId: variantId || null } } }
        );
        res.json({ success: true, message: 'Product removed from wishlist' });
    }catch(error){
        console.error('Remove wishlist item error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error'});
    }
};

// For clearing entire wishlist
const clearWishlist = async (req, res) => {
    try{
        const userId = req.session.userId;
        await Wishlist.updateOne({ userId }, { $set: { products: [] } });
        res.json({ success: true, message: 'Wishlist cleared successfully'});
    }catch(error){
        console.error('Clear wishlist error:',error.message);
        res.status(500).json({ success: false, message: 'Server Error'});
    }
};

module.exports = {
    loadWishlist,
    toggleWishlist,
    removeWishlistItem,
    clearWishlist
}
