const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true},
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Products' },
        name: String,
        image: String,
        price: Number,
        quantity: Number,
        itemTotal: Number
    }],
    shippingAddress: {
        name: String,
        phone: String,
        fullAddress: String,
        type: String
    },
    paymentMethod: { type: String, required: true },
    paymentStatus: { type: String, defualt: 'Pending'},
    orderStatus: { type: String, defualt: 'Pending'},
    subtotal: Number,
    tax: Number,
    shippingCost: Number,
    discount: Number,
    grandTotal: Number
},{ timestamps: true });

module.exports = mongoose.model('Order', orderSchema);