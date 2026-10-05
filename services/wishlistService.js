const Wishlist = require('../models/wishlistModel');
const Product = require('../models/productModel');

// For loading a user's wishlist page
const getWishlist = async ({ userId, page, limit }) => {
    const wishlistSummary = await Wishlist.findOne({ userId }).select('products').lean();
    const itemCount = wishlistSummary?.products?.length || 0;
    const totalPages = Math.ceil(itemCount / limit);
    const currentPage = Math.min(page, Math.max(totalPages, 1));
    const wishlist = await Wishlist.findOne({ userId }).populate({
        path: 'products.productId',
        populate: [
            { path: 'categoryId', select: 'name' },
            { path: 'brandId', select: 'name' }
        ]
    }).slice('products', [(currentPage - 1) * limit, limit]).lean();
    const validItems = wishlist?.products ? wishlist.products.filter(item => item.productId !== null) : [];
    return { wishlistItems: validItems, itemCount, page: currentPage, limit, totalPages };
};

// For adding a product to wishlist
const addWishlistItem = async ({ userId, productId, variantId }) => {
    const product = await Product.findById(productId);
    if (!product) return { statusCode: 404, message: 'Product is currently not available' };

    const variant = variantId ? product.variants.id(variantId) : null;
    if (product.variants.length && !variant) return { statusCode: 400, message: 'Please select a valid product variant.' };

    let wishlist = await Wishlist.findOne({ userId });
    const requestedVariantId = variant ? String(variant._id) : '';
    const duplicate = wishlist?.products.some(item =>
        item.productId.toString() === String(productId) && String(item.variantId || '') === requestedVariantId
    );
    if (duplicate) {
        return {
            statusCode: 409,
            message: variant ? 'This product variant is already in your wishlist.' : 'This product is already in your wishlist.'
        };
    }
    if (variant && (variant.stock <= 0 || variant.status === 'Out of Stock')) {
        return { statusCode: 400, message: 'Please select an available product variant.' };
    }
    if (product.status !== 'Active' || product.availableStock <= 0) {
        return { statusCode: 400, message: 'Product is currently not available' };
    }

    if (!wishlist) wishlist = new Wishlist({ userId, products: [] });
    wishlist.products.push({ productId, variantId: variant?._id });
    await wishlist.save();
    return { success: true, action: 'added', message: 'Added to wishlist' };
};

// For removing one product from wishlist
const removeWishlistItem = async ({ userId, productId, variantId }) => {
    await Wishlist.updateOne(
        { userId },
        { $pull: { products: { productId, variantId: variantId || null } } }
    );
};

// For clearing a user's wishlist
const clearWishlist = async userId => {
    await Wishlist.updateOne({ userId }, { $set: { products: [] } });
};

module.exports = { getWishlist, addWishlistItem, removeWishlistItem, clearWishlist };
