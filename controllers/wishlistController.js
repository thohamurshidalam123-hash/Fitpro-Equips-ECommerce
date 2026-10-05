const wishlistService = require('../services/wishlistService');

// For loading wishlist page
const loadWishlist = async (req, res) => {
    try{
        const userId = req.session.userId;
        if(!userId) return res.redirect('/login');

        const data = await wishlistService.getWishlist({
            userId,
            page: Math.max(parseInt(req.query.page, 10) || 1, 1),
            limit: 12
        });

        res.render('user/wishlist', {
            ...data,
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
        const userId = req.session.userId;

        if(!userId) {
            return res.status(401).json({ success:false, message: 'Please log in to use the wishlist. '});
        }

        const result = await wishlistService.addWishlistItem({ ...req.body, userId });
        if (!result.success) return res.status(result.statusCode).json({ success: false, message: result.message });
        return res.json(result);
    }catch(error){
        console.error('Error in toggle wishlist:',error.message);
        res.status(500).json({ success: false, message:'Server Error'});
    }
};

// For removing single item from wishlist
const removeWishlistItem = async (req, res) => {
    try{
        const userId = req.session.userId;
        await wishlistService.removeWishlistItem({ ...req.body, userId });
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
        await wishlistService.clearWishlist(userId);
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
