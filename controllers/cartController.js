const Cart = require('../models/cartModel');
const Product = require('../models/productModel');
const Wishlist = require('../models/wishlistModel');

const loadCartPage = async (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) return res.redirect('/login');

        // For fetching cart from db
        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            populate: { path: 'categoryId', select: 'name' }
        }).lean();

        // Setting up variables for math calculations and checkout validation
        let subtotal = 0;
        let canCheckout = true;
        const cartItems = cart ? cart.items : [];

        // For validating stock and status for every item in the cart
        cartItems.forEach((item) => {
            const product = item.productId;

            if (!product) {
                item.isAvailable = false;
                item.hasStock = false;
                item.outOfStock = true;
                canCheckout = false;
                return;
            }

            // Checking the product is still active
            item.isAvailable = product.availableStock >= item.quantity;

            // Checking the requested cart quantity is available in stock
            item.hasStock = product.availableStock >= item.quantity;

            // For identifying if the product is completely out of stock
            item.outOfStock = product.availableStock === 0;

            // For blocking checkout while the item is unavailable or not having enough stock
            if (!item.isAvailable || !item.hasStock) {
                canCheckout = false;
            } else {
                subtotal += item.totalPrice || 0;
            }
        });

        const tax = Math.round(subtotal * 0.18);
        const shipping = subtotal > 0 && subtotal < 1500 ? 500 : 0;
        const total = subtotal + tax + shipping;

        // For rendering cart
        return res.render('user/cart', {
            cartItems,
            subtotal,
            tax,
            shipping,
            total,
            canCheckout,
            itemCount: cartItems.length,
            currentPage: 'cart'
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

        const { productId, quantity } = req.body;
        const requestQuantity = Number(quantity) || 1;
        const MAX_LIMIT_PER_USER = 5;

        // For preventing adding inactive products
        const product = await Product.findById(productId);

        if (!product || product.status !== 'Active') {
            return res.status(400).json({ success: false, message: 'This product is currently unavailable.' });
        }

        // For determaining which price to be used
        const activePrice = product.salePrice > 0 ? product.salePrice : product.regularPrice;

        // For getting or creating user cart
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            // If user has no cart
            cart = new Cart({ userId, items: [], cartTotal: 0 });
        }

        //For checking if product is already in the cart
        const existingItemIndex = cart.items.findIndex(item => item.productId.toString() === productId);

        if (existingItemIndex > -1) {
            // If product is already exists then increasing the quantity
            const newQuantity = cart.items[existingItemIndex].quantity + requestQuantity;

            // Checking if the new quantity exceeds maximum limit(5)
            if (newQuantity > MAX_LIMIT_PER_USER) {
                return res.status(400).json({ success: false, message: `You can add only maximum of ${MAX_LIMIT_PER_USER}.` });
            }

            // Validating against total stock of product
            if (newQuantity > product.availableStock) {
                return res.status(400).json({ success: false, message: `Only ${product.availableStock} units left in stock` });
            }

            // For updating existing item's quantity and total price
            cart.items[existingItemIndex].quantity = newQuantity;
            cart.items[existingItemIndex].totalPrice = newQuantity * activePrice;
        } else {
            // For adding a product which is new to cart
            if (requestQuantity > MAX_LIMIT_PER_USER) {
                return res.status(400).json({ success: false, message: `You can only add a maximum of ${MAX_LIMIT_PER_USER} units of this item.` });
            }
            if (requestQuantity > product.availableStock) {
                return res.status(400).json({ success: false, message: `Only ${product.availableStock} units of product is available` });
            }

            // For pushing new item into items array(cart)
            cart.items.push({
                productId,
                quantity: requestQuantity,
                price: activePrice,
                totalPrice: requestQuantity * activePrice
            });
        }

        // For recalculating total amount based on all items
        cart.cartTotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);
        await cart.save();

        // For removng product from wishlist after adding to cart
        await Wishlist.updateOne(
            { userId },
            { $pull: { products: { productId } } }
        );

        return res.json({ success: true, message: 'Product added to cart successfully!' });
    } catch (error) {
        console.error('Add to cart error:', error.message);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// For updating quantity of product in cart
const updateQuantity = async (req, res) => {
    try {
        const { itemId, action } = req.body;
        const userId = req.session.userId;

        const MAX_LIMIT_PER_USER = 5;

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        // For finding the specific item's exact index inside the cart's items array
        const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);
        if (itemIndex === -1) {
            return res.status(404).json({ success: false, message: 'Item not found in cart' });
        }

        const item = cart.items[itemIndex];

        // For getting the latest product details from DB to check stock
        const product = await Product.findById(item.productId);

        // For increasing quantity
        if (action === 'increase') {
            // Validating maximum limit of unit per 
            if (item.quantity >= MAX_LIMIT_PER_USER) {
                return res.status(400).json({ success: false, message: `You can only add ${MAX_LIMIT_PER_USER} units of product` });
            }

            // Validating stock of product
            if (item.quantity >= product.availableStock) {
                return res.status(400).json({ success: false, message: `Only ${product.availableStock} units left in stock.` });
            }

            item.quantity += 1;

            // For decreasing quantity
        } else if (action === 'decrease') {
            // Ensuring quantity never goes below 1 (for zer user need to remove product)
            if (item.quantity > 1) {
                item.quantity -= 1;
            } else {
                return res.status(400).json({ success: false, message: 'Minimum quantity is 1' });
            }
        }

        // For recalculating the total price for thespecific item
        item.totalPrice = item.quantity * item.price;

        await cart.save();

        return res.json({ success: true });
    } catch (error) {
        console.error('Update quantity error:', error.message);
        return res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const removeFromCart = async (req, res) => {
    try {
        const { itemId } = req.body;
        const userId = req.session.userId;

        //Removing specific product
        await Cart.updateOne(
            { userId },
            { $pull: { items: { _id: itemId } } }
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Remove item erro:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const moveToWishlist = async (req, res) => {
    try {

        const { itemId, productId } = req.body;
        const userId = req.session.userId;

        // For adding product to user's wishlist
        let wishlist = await Wishlist.findOne({ userId });

        // Creating empty wishlist if user doesn't have a wishlist
        if (!wishlist) {
            wishlist = new Wishlist({ userId, products: [] });
        }

        // For checking if the product is already in the wishlist to avoide duplication
        const inWishlist = wishlist.products.some(p => p.productId.toString() === productId);

        if (!inWishlist) {
            wishlist.products.push({ productId });
            await wishlist.save();
        }

        // Removing item from the cart
        await Cart.updateOne(
            { userId },
            { $pull: { items: { _id: itemId } } }
        );

        res.json({ success: true, message: 'Moved to wishlist !' });
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