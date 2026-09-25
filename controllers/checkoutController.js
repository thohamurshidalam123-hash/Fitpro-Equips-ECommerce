const Cart = require('../models/cartModel');
const Order = require('../models/orderModel');
const Address = require('../models/addressModel');
const Product = require('../models/productModel');

// For loading checkout page
const loadCheckout = async (req, res) => {
    try {
        const userId = req.session.userId;

        // Check user login
        if (!userId) {
            return res.redirect('/login');
        }

        // ================================
        // 1. Fetch cart and product details
        // ================================
        const cart = await Cart.findOne({ userId })
            .populate('items.productId');

        // If cart doesn't exist or is empty
        if (!cart || !cart.items || cart.items.length === 0) {
            return res.redirect('/cart');
        }

        // ================================
        // 2. Fetch user addresses
        // ================================
        const addresses = await Address.find({ userId });

        // Find default address
        let activeAddress = null;

        if (addresses && addresses.length > 0) {
            activeAddress =
                addresses.find(address => address.isDefault) ||
                addresses[0];
        }

        // ================================
        // 3. Calculate subtotal
        // ================================
        let subtotal = 0;

        const formattedItems = cart.items.map(item => {
            const product = item.productId;

            // Safety check in case product was deleted
            if (!product) {
                return null;
            }

            const price =
                product.salePrice > 0
                    ? product.salePrice
                    : product.regularPrice;

            const itemTotal = price * item.quantity;

            subtotal += itemTotal;

            return {
                productId: product._id,
                name: product.productName,
                quantity: item.quantity,
                image: product.images && product.images.length > 0
                    ? product.images[0]
                    : '',
                price: price,
                itemTotal: itemTotal
            };
        }).filter(item => item !== null);

        // ================================
        // 4. Calculate checkout totals
        // ================================
        const tax = Math.round(subtotal * 0.18);

        const shipping = subtotal > 5000
            ? 0
            : 500;

        const discount = 0;

        const grandTotal =
            subtotal +
            tax +
            shipping -
            discount;

        // ================================
        // 5. Render checkout page
        // ================================
        res.render('user/checkout', {
            currentPage: 'shop',

            cartItems: formattedItems,

            addresses: addresses,

            activeAddress: activeAddress,

            totals: {
                subtotal,
                tax,
                shipping,
                discount,
                grandTotal
            }
        });

    } catch (error) {

        console.error('Error in load checkout:', error);

        res.status(500).send('Server Error');
    }
};


module.exports = {
    loadCheckout
};
