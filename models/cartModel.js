const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
    productId :{ type: mongoose.Schema.Types.ObjectId, ref:'Product', required: true},
    quantity: { type: Number, required: true, min: 1, max: 5 },
    price:{ type: Number, required: true},
    totalPrice: { type: Number, required: true }
});

const cartSchema  = new mongoose.Schema({
    userId : { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    items: [cartItemSchema],
    cartTotal : { type: Number, default: 0 }
},{ timestamps: true });

module.exports = mongoose.model('Cart',cartSchema);