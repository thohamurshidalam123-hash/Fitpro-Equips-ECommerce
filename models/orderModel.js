const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true},
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Products' },
        variantId: { type: mongoose.Schema.Types.ObjectId },
        name: String,
        image: String,
        price: Number,
        quantity: Number,
        itemTotal: Number
    }],
    shippingAddress: new mongoose.Schema({
        name: String,
        phone: String,
        fullAddress: String,
        type: String
    }, { _id: false }),
    paymentMethod: { type: String, required: true },
    paymentStatus: { type: String, default: 'Pending'},
    orderStatus: { type: String, default: 'Pending'},
    subtotal: Number,
    tax: Number,
    shippingCost: Number,
    discount: Number,
    grandTotal: Number
},{ timestamps: true });

module.exports = mongoose.model('Order', orderSchema);