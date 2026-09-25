const Wishlist = require('../models/wishlistModel');
const Product = require('../models/productModel');

// For loading wishlist page
const loadWishlist = async (req, res) => {
    try{
        const userId = req.session.userId;
        if(!userId) return res.redirect('/login');

        const wishlist = await Wishlist.findOne({ userId }).populate({
            path: 'products.productId',
            populate: [
                { path: 'categoryId', select: 'name' },
                { path: 'brandId', select: 'name' }
            ]
        }).lean();

        // For filtering out any product that deleted from db
        const validItems = wishlist && wishlist.products ? wishlist.products.filter(item => item.productId !== null) : [];

        res.render('user/wishlist', {
            wishlistItems: validItems,
            itemCount: validItems.length,
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
        const { productId } = req.body;
        const userId = req.session.userId;

        if(!userId) {
            return res.status(401).json({ success:false, message: 'Please log in to use the wishlist. '});
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product is currently not available' });
        }

        let wishlist = await Wishlist.findOne({ userId });
        const existingIndex = wishlist ? wishlist.products.findIndex(p => p.productId.toString() === productId) : -1;

        if (existingIndex > -1) {
            wishlist.products.splice(existingIndex, 1);
            await wishlist.save();
            return res.json({ success: true, action: 'removed', message: 'Removed from wishlist' });
        }

        if (product.status !== 'Active' || product.availableStock <= 0) {
            return res.status(400).json({ success: false, message: 'Product is currently not available' });
        }

        if (!wishlist) {
            wishlist = new Wishlist({ userId, products: [] });
        }

        wishlist.products.push({ productId });
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
        const { productId } = req.body;
        const userId = req.session.userId;

        await Wishlist.updateOne(
            { userId },
            { $pull: { products: { productId } } }
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
