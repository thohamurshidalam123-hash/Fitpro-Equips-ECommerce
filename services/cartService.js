const Cart = require('../models/cartModel');
const Product = require('../models/productModel');
const Wishlist = require('../models/wishlistModel');
const { getEffectivePrice } = require('../utils/offerPricing');

// For loading a cart with stock and price details
const getCartPageData = async ({ userId, requestedPage }) => {
    const cart = await Cart.findOne({ userId }).populate({
        path: 'items.productId',
        populate: [
            { path: 'categoryId', select: 'name offerPercentage' },
            { path: 'brandId', select: 'name offerPercentage' }
        ]
    }).lean();

    let subtotal = 0;
    let canCheckout = true;
    const cartItems = cart ? cart.items : [];
    const itemsPerPage = 5;
    const totalPages = Math.max(Math.ceil(cartItems.length / itemsPerPage), 1);
    const page = Math.min(Math.max(parseInt(requestedPage, 10) || 1, 1), totalPages);

    cartItems.forEach(item => {
        const product = item.productId;
        if (!product) {
            item.isAvailable = false;
            item.hasStock = false;
            item.outOfStock = true;
            canCheckout = false;
            return;
        }

        const variant = item.variantId ? product.variants.find(productVariant => String(productVariant._id) === String(item.variantId)) : null;
        item.variant = variant;
        const availableStock = item.variantId && !variant ? 0 : (variant ? variant.stock : product.availableStock);
        item.price = getEffectivePrice(product, variant);
        item.totalPrice = item.quantity * item.price;
        item.isAvailable = product.status === 'Active' && (!variant || variant.status !== 'Out of Stock') && availableStock >= item.quantity;
        item.hasStock = availableStock >= item.quantity;
        item.outOfStock = availableStock === 0;

        if (!item.isAvailable || !item.hasStock) canCheckout = false;
        else subtotal += item.totalPrice || 0;
    });

    const tax = Number((subtotal * 0.0018).toFixed(2));
    const shipping = subtotal > 0 && subtotal < 1500 ? 500 : 0;
    const total = subtotal + tax + shipping;
    const cartPageItems = cartItems.slice((page - 1) * itemsPerPage, page * itemsPerPage);
    return { cartItems, cartPageItems, subtotal, tax, shipping, total, canCheckout, itemCount: cartItems.length, page, totalPages };
};

// For adding a product to cart
const addToCart = async ({ userId, productId, variantId, quantity }) => {
    const requestQuantity = Number(quantity) || 1;
    const maxLimitPerUser = 5;
    const product = await Product.findById(productId).populate('categoryId', 'offerPercentage').populate('brandId', 'offerPercentage');
    if (!product || product.status !== 'Active') return { statusCode: 400, message: 'This product is currently unavailable.' };

    const variant = variantId ? product.variants.id(variantId) : null;
    if (product.variants.length && !variant) return { statusCode: 400, message: 'Please select a valid product variant.' };
    if (variant && (variant.status === 'Out of Stock' || variant.stock <= 0)) {
        return { statusCode: 400, message: 'This product variant is out of stock.' };
    }

    const activePrice = getEffectivePrice(product, variant);
    const availableStock = variant ? variant.stock : product.availableStock;
    let cart = await Cart.findOne({ userId });
    if (!cart) cart = new Cart({ userId, items: [], cartTotal: 0 });

    const existingItemIndex = cart.items.findIndex(item => item.productId.toString() === productId && String(item.variantId || '') === String(variantId || ''));
    if (existingItemIndex > -1) {
        const newQuantity = cart.items[existingItemIndex].quantity + requestQuantity;
        if (newQuantity > maxLimitPerUser) return { statusCode: 400, message: `You can add only maximum of ${maxLimitPerUser}.` };
        if (newQuantity > availableStock) return { statusCode: 400, message: `Only ${availableStock} units left in stock` };
        cart.items[existingItemIndex].quantity = newQuantity;
        cart.items[existingItemIndex].totalPrice = newQuantity * activePrice;
    } else {
        if (requestQuantity > maxLimitPerUser) return { statusCode: 400, message: `You can only add a maximum of ${maxLimitPerUser} units of this item.` };
        if (requestQuantity > availableStock) return { statusCode: 400, message: `Only ${availableStock} units of product is available` };
        cart.items.push({ productId, variantId: variant ? variant._id : undefined, quantity: requestQuantity, price: activePrice, totalPrice: requestQuantity * activePrice });
    }

    cart.cartTotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);
    await cart.save();
    await Wishlist.updateOne({ userId }, { $pull: { products: { productId } } });
    return { success: true, message: 'Product added to cart successfully!' };
};

// For updating the quantity of a cart item
const updateQuantity = async ({ userId, itemId, action }) => {
    const maxLimitPerUser = 5;
    const cart = await Cart.findOne({ userId });
    if (!cart) return { statusCode: 404, message: 'Cart not found' };
    const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);
    if (itemIndex === -1) return { statusCode: 404, message: 'Item not found in cart' };

    const item = cart.items[itemIndex];
    const product = await Product.findById(item.productId).populate('categoryId', 'offerPercentage').populate('brandId', 'offerPercentage');
    if (!product || product.status !== 'Active') return { statusCode: 400, message: 'This product is currently unavailable.' };
    const variant = item.variantId ? product.variants.find(productVariant => String(productVariant._id) === String(item.variantId)) : null;
    const availableStock = variant ? variant.stock : product.availableStock;
    item.price = getEffectivePrice(product, variant);

    if (action === 'increase') {
        if (item.quantity >= maxLimitPerUser) return { statusCode: 400, message: `You can only add ${maxLimitPerUser} units of product` };
        if (item.quantity >= availableStock) return { statusCode: 400, message: `Only ${availableStock} units left in stock.` };
        item.quantity += 1;
    } else if (action === 'decrease') {
        if (item.quantity > 1) item.quantity -= 1;
        else return { statusCode: 400, message: 'Minimum quantity is 1' };
    }

    item.totalPrice = item.quantity * item.price;
    await cart.save();
    return { success: true };
};

// For removing a cart item
const removeFromCart = async ({ userId, itemId }) => {
    await Cart.updateOne({ userId }, { $pull: { items: { _id: itemId } } });
};

// For moving a cart item to wishlist
const moveToWishlist = async ({ userId, itemId, productId, variantId }) => {
    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) wishlist = new Wishlist({ userId, products: [] });
    const inWishlist = wishlist.products.some(item =>
        item.productId.toString() === productId && String(item.variantId || '') === String(variantId || '')
    );
    if (inWishlist) {
        return {
            statusCode: 409,
            message: variantId ? 'This product variant is already in your wishlist.' : 'This product is already in your wishlist.'
        };
    }

    wishlist.products.push({ productId, variantId: variantId || undefined });
    await wishlist.save();
    await Cart.updateOne({ userId }, { $pull: { items: { _id: itemId } } });
    return { success: true, message: 'Moved to wishlist !' };
};

module.exports = { getCartPageData, addToCart, updateQuantity, removeFromCart, moveToWishlist };
