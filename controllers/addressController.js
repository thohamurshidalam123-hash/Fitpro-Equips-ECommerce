// controllers/addressController.js
const Address = require('../models/addressModel');

// Validation helper function
const validateAddress = (data) => {
    const errors = {};
    
    // Full Name validation
    if (!data.fullName || !data.fullName.trim()) {
        errors.fullName = 'Full Name is required';
    } else if (data.fullName.trim().length < 2) {
        errors.fullName = 'Full Name must be at least 2 characters long';
    } else if (data.fullName.trim().length > 50) {
        errors.fullName = 'Full Name cannot exceed 50 characters';
    } else if (!/^[a-zA-Z\s]+$/.test(data.fullName.trim())) {
        errors.fullName = 'Full Name can only contain letters and spaces';
    }
    
    // Phone validation
    if (!data.phone || !data.phone.trim()) {
        errors.phone = 'Phone Number is required';
    } else {
        const sanitizedPhone = data.phone.trim().replace(/\s+/g, '').replace(/^\+91/, '');
        const phonePattern = /^\+91\s?[6-9]\d{9}$/;
        const normalizedPhone = '+91 ' + sanitizedPhone;
        if (!/^[6-9]\d{9}$/.test(sanitizedPhone)) {
            errors.phone = 'Please enter a valid Indian mobile number (e.g., +91 98765 43210)';
        }
    }
    
    // House Name validation
    if (!data.houseName || !data.houseName.trim()) {
        errors.houseName = 'House Name / Flat No. is required';
    } else if (data.houseName.trim().length < 2) {
        errors.houseName = 'House Name must be at least 2 characters long';
    } else if (data.houseName.trim().length > 50) {
        errors.houseName = 'House Name cannot exceed 50 characters';
    }
    
    // Street validation
    if (!data.street || !data.street.trim()) {
        errors.street = 'Street / Area is required';
    } else if (data.street.trim().length < 2) {
        errors.street = 'Street / Area must be at least 2 characters long';
    } else if (data.street.trim().length > 50) {
        errors.street = 'Street / Area cannot exceed 50 characters';
    }
    
    // City validation
    if (!data.city || !data.city.trim()) {
        errors.city = 'City is required';
    } else if (data.city.trim().length < 2) {
        errors.city = 'City must be at least 2 characters long';
    } else if (data.city.trim().length > 30) {
        errors.city = 'City cannot exceed 30 characters';
    }
    
    // District validation
    if (!data.district || !data.district.trim()) {
        errors.district = 'District is required';
    } else if (data.district.trim().length < 2) {
        errors.district = 'District must be at least 2 characters long';
    } else if (data.district.trim().length > 30) {
        errors.district = 'District cannot exceed 30 characters';
    }
    
    // State validation
    if (!data.state || !data.state.trim()) {
        errors.state = 'State is required';
    } else if (data.state.trim().length < 2) {
        errors.state = 'State must be at least 2 characters long';
    } else if (data.state.trim().length > 30) {
        errors.state = 'State cannot exceed 30 characters';
    }
    
    // Pincode validation
    if (!data.pincode || !data.pincode.trim()) {
        errors.pincode = 'Pincode is required';
    } else if (!/^\d{6}$/.test(data.pincode.trim())) {
        errors.pincode = 'Pincode must be a 6-digit number';
    }
    
    // Landmark validation (optional)
    if (data.landmark && data.landmark.trim().length > 50) {
        errors.landmark = 'Landmark cannot exceed 50 characters';
    }
    
    // Address Type validation
    if (!['Home', 'Work', 'Other'].includes(data.addressType)) {
        errors.addressType = 'Please select a valid address type';
    }
    
    return errors;
};

const addAddress = async (req, res) => {
    try {
        const userId = req.session.userId;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please log in first.' });
        }

        const { fullName, phone, houseName, street, city, district, state, pincode, landmark, addressType } = req.body;

        // Validate address data
        const errors = validateAddress({
            fullName, phone, houseName, street, city, district, state, pincode, landmark, addressType
        });

        if (Object.keys(errors).length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please correct the errors below',
                errors,
                formData: { fullName, phone, houseName, street, city, district, state, pincode, landmark, addressType }
            });
        }

        // Check if the user already has any addresses. If not, make this one the default.
        const addressCount = await Address.countDocuments({ userId });
        const isDefault = addressCount === 0;

        const newAddress = new Address({
            userId,
            fullName: fullName.trim(),
            phone: phone.trim(),
            houseName: houseName.trim(),
            street: street.trim(),
            city: city.trim(),
            district: district.trim(),
            state: state.trim(),
            pincode: pincode.trim(),
            landmark: landmark ? landmark.trim() : '',
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

// For editing address
const editAddress = async (req,res) => {
    try{
        const userId = req.session.userId;
        const addressId = req.params.id;

        if(!userId){
            return res.status(401).json({success:false,message:'Please login first'});
        }

        // Verifying address exists and belongs to userId
        const address=await Address.findOne({_id:addressId, userId });
        if(!address){
            return res.status(404).json({ success: false, message: 'Address not found or unauthorized'});
        }

        const { fullName, phone, houseName, street, city, district, state, pincode, landmark, addressType } = req.body;

        // Validate address data
        const errors = validateAddress({
            fullName, phone, houseName, street, city, district, state, pincode, landmark, addressType
        });

        if (Object.keys(errors).length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please correct the errors below',
                errors,
                formData: { fullName, phone, houseName, street, city, district, state, pincode, landmark, addressType }
            });
        }

        // Update in MongoDB
        await Address.findByIdAndUpdate(
            addressId, {
                fullName: fullName.trim(),
                phone: phone.trim(),
                houseName: houseName.trim(),
                street: street.trim(),
                city: city.trim(),
                district: district.trim(),
                state: state.trim(),
                pincode: pincode.trim(),
                landmark: landmark ? landmark.trim() : '',
                addressType
            }
        );

        return res.json({ success:true, message: 'Address updated successfully !'})

    }catch(error) {
        console.error('Edit address error: ', error.message);
        res.status(500).json({ success: false, message : 'Failed to update address.'});
    }
};

// For deleting an Address
const deleteAddress = async (req,res) => {
    try {
        const userId = req.session.userId;
        const addressId = req.params.id;

        if(!userId){
            return res.status(401).json({ success: false, message: 'Please login first. '});
        }

        const address = await Address.findOneAndDelete({ _id: addressId, userId});

        if(!address){
            return res.status(404).json({ success:false, message: ' Address not found or already deleted. '})
        }

        return res.json({ success: true, message: 'Address deleted successfully !'});

    } catch(error){
        console.error('Delete address error', error.message);
        res.status(500).json({ success: false, message: 'Failde to delete address. '});
    }
};

module.exports = {
    addAddress,
    editAddress,
    deleteAddress
};