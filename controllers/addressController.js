// controllers/addressController.js
const Address = require('../models/addressModel');

const addAddress = async (req, res) => {
    try {
        const userId = req.session.userId;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please log in first.' });
        }

        const { fullName, phone, houseName, street, city, district, state, pincode, landmark, addressType } = req.body;

        // Check if the user already has any addresses. If not, make this one the default.
        const addressCount = await Address.countDocuments({ userId });
        const isDefault = addressCount === 0;


        const newAddress = new Address({
            userId,
            fullName,
            phone,
            houseName,
            street,
            city,
            district,
            state,
            pincode,
            landmark,
            addressType,
            isDefault
        });

        // Save to MongoDB
        await newAddress.save();

        return res.json({ success: true, message: 'Address added successfully!' });

    } catch (error) {
        console.error('Add address error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to add address. Please try again.' });
    }
};

module.exports = {
    addAddress
};