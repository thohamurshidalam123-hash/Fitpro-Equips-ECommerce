const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    balance: {
        type: Number,
        default: 0,
        min: 0
    },
    transactions: [{
        type: {
            type: String,
            enum: ['credit', 'debit'],
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order'
        },
        razorpayOrderId: String,
        razorpayPaymentId: String,
        date: {
            type: Date,
            default: Date.now
        }
    }],
    pendingTopUps: [{
        razorpayOrderId: { type: String, required: true },
        amount: { type: Number, required: true, min: 1 },
        status: { type: String, enum: ['pending', 'credited'], default: 'pending' },
        createdAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

module.exports = mongoose.model('Wallet', walletSchema);