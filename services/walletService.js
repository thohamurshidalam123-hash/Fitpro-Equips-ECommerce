const Wallet = require('../models/walletModel');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// For ensuring a user has a wallet, creating if don't have
const getOrCreateWallet = async (userId) => {
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
        wallet = new Wallet({ userId, balance: 0, transactions: [] });
        await wallet.save();
    }
    return wallet;
};

// For crediting money to wallet from refund
const creditWallet = async (userId, amount, description, orderId = null ) => {
    const wallet = await getOrCreateWallet(userId);
    wallet.balance += amount;

    wallet.transactions.push({
        type: 'credit',
        amount: amount,
        description: description,
        orderId: orderId
    });

    await wallet.save();
    return wallet;
};

// For debiting money from wallet for paying order
const debitWallet = async (userId, amount, description, orderId = null) => {
    const wallet = await getOrCreateWallet(userId);

    if (wallet.balance < amount ) {
        throw new Error('Insufficient wallet balance');
    }

    wallet.balance -= amount;

    wallet.transactions.push({
        type: 'debit',
        amount: amount,
        description: description,
        orderId: orderId
    });

    await wallet.save();
    return wallet;
};

// For fetching wallet data for the user profile page
const getWalletData = async (userId) => {
    const wallet = await getOrCreateWallet(userId);
    // For sorting transactions from newest to oldest
    wallet.transactions.sort((a, b) => b.date - a.date);
    return wallet;
};

const createTopUpOrder = async (userId, requestedAmount) => {
    const amount = Number(requestedAmount);
    if (!Number.isFinite(amount) || amount < 1 || amount > 100000) {
        return { success: false, statusCode: 400, message: 'Enter an amount between ₹1 and ₹1,00,000.' };
    }

    const amountInPaise = Math.round(amount * 100);
    const wallet = await getOrCreateWallet(userId);
    try {
        const razorpayOrder = await razorpayInstance.orders.create({
            amount: amountInPaise,
            currency: 'INR',
            receipt: `wallet-${String(userId).slice(-12)}-${Date.now()}`,
            notes: { purpose: 'wallet_top_up', userId: String(userId) }
        });

        wallet.pendingTopUps.push({
            razorpayOrderId: razorpayOrder.id,
            amount: amountInPaise / 100,
            status: 'pending'
        });
        await wallet.save();

        return {
            success: true,
            key: process.env.RAZORPAY_KEY_ID,
            razorpayOrderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency
        };
    } catch (error) {
        console.error('Wallet top-up order creation error:', error.message);
        return { success: false, statusCode: 502, message: 'Unable to start wallet payment. Please try again.' };
    }
};

const verifyTopUpPayment = async (userId, paymentData = {}) => {
    const { razorpay_order_id: razorpayOrderId, razorpay_payment_id: razorpayPaymentId, razorpay_signature: signature } = paymentData;
    if (!razorpayOrderId || !razorpayPaymentId || !signature) {
        return { success: false, statusCode: 400, message: 'Payment verification details are incomplete.' };
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return { success: false, statusCode: 500, message: 'Payment verification is not configured.' };

    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');
    const expectedBuffer = Buffer.from(expectedSignature);
    const receivedBuffer = Buffer.from(String(signature));
    if (expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
        return { success: false, statusCode: 400, message: 'Wallet payment verification failed.' };
    }

    const wallet = await Wallet.findOne({ userId });
    if (!wallet) return { success: false, statusCode: 404, message: 'Wallet top-up was not found.' };

    const existingTransaction = wallet.transactions.find(transaction =>
        transaction.razorpayPaymentId === razorpayPaymentId
        && transaction.razorpayOrderId === razorpayOrderId
    );
    if (existingTransaction) {
        return { success: true, balance: wallet.balance, message: 'Wallet balance is up to date.' };
    }

    const pendingTopUp = wallet.pendingTopUps.find(topUp =>
        topUp.razorpayOrderId === razorpayOrderId && topUp.status === 'pending'
    );
    if (!pendingTopUp) {
        return { success: false, statusCode: 400, message: 'This wallet payment has already been processed or is invalid.' };
    }

    const amount = pendingTopUp.amount;
    const updatedWallet = await Wallet.findOneAndUpdate(
        {
            userId,
            pendingTopUps: { $elemMatch: { razorpayOrderId, status: 'pending' } }
        },
        {
            $inc: { balance: amount },
            $push: {
                transactions: {
                    type: 'credit',
                    amount,
                    description: 'Wallet balance added through Razorpay',
                    razorpayOrderId,
                    razorpayPaymentId
                }
            },
            $set: { 'pendingTopUps.$.status': 'credited' }
        },
        { new: true }
    );

    if (!updatedWallet) {
        const latestWallet = await Wallet.findOne({ userId });
        const wasCredited = latestWallet?.transactions.some(transaction =>
            transaction.razorpayPaymentId === razorpayPaymentId
            && transaction.razorpayOrderId === razorpayOrderId
        );
        if (wasCredited) {
            return { success: true, balance: latestWallet.balance, message: 'Wallet balance is up to date.' };
        }
        return { success: false, statusCode: 400, message: 'This wallet payment has already been processed or is invalid.' };
    }

    return { success: true, balance: updatedWallet.balance, message: 'Wallet balance added successfully.' };
};

module.exports = {
    getOrCreateWallet,
    creditWallet,
    debitWallet,
    getWalletData,
    createTopUpOrder,
    verifyTopUpPayment
};