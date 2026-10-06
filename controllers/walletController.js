const walletService = require('../services/walletService');

const createTopUpOrder = async (req, res) => {
    try {
        const result = await walletService.createTopUpOrder(req.session.userId, req.body.amount);
        return res.status(result.statusCode || 200).json(result);
    } catch (error) {
        console.error('Wallet top-up order error:', error);
        return res.status(500).json({ success: false, message: 'Unable to start wallet payment.' });
    }
};

const verifyTopUpPayment = async (req, res) => {
    try {
        const result = await walletService.verifyTopUpPayment(req.session.userId, req.body.paymentData);
        return res.status(result.statusCode || 200).json(result);
    } catch (error) {
        console.error('Wallet top-up verification error:', error);
        return res.status(500).json({ success: false, message: 'Unable to verify wallet payment.' });
    }
};

module.exports = { createTopUpOrder, verifyTopUpPayment };