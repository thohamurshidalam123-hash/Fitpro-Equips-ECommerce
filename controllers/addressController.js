const addressService = require('../services/addressService');
const { validateAddress: validateAddressFields } = require('../validators/addressValidators');

const addAddress = async (req, res) => {
    try{
        const userId = req.session.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login first.' });
        }

        // For validate address data
        const errors = validateAddressFields(req.body);
        if(Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Please correct the errors below',
                errors,
                formData: req.body
            });
        }

        // For delegating adding address to service layer
        const address = await addressService.createAddress(userId, req.body);

        return res.status(201).json({ success: true, message: 'Address added successfully', address });
    
    }catch (error) {
        console.error('Add address error:', error.message);
        return res.status(500).json({ success: false, message: error.message || 'Failed to add address.' });
    }
};

const editAddress = async (req, res) => {
    try{
        const userId = req.session.userId;
        const addressId = req.params.id;

        if (!userId){
            return res.status(401).json({ success: false, message: 'Please log in first'});
        }

        const errors = validateAddressFields(req.body);
        if(Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Please correct the errors below',
                errors,
                formData: req.body
            });
        }

        // For delegating editing address to service layer
        const address = await addressService.updateAddress(addressId, userId, req.body);

        return res.status(200).json({ success: true, message: 'Address updated successfully', address });
    
    }catch(error){
        console.error('Edit address error:',error.message);
        const statusCode = error.message.includes('not found') ? 404 : 500;
        return res.status(statusCode).json({ success: false, message: error.message || 'Failed to update address.'});
    }
};

const deleteAddress = async (req, res) => {
    try{
        const userId = req.session.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please log in first'});
        }

        // For delegating deleting address to service layer
        await addressService.removeAddress(req.params.id, userId);

        return res.status(200).json({ success: true, message: 'Address deleted successfully !'});

    }catch(error) {
        console.error('Delete address error:', error.message);
        return res.status(500).json({ success: false, message: 'Server Error'});
    }
};

module.exports = {
    addAddress,
    editAddress,
    deleteAddress
};