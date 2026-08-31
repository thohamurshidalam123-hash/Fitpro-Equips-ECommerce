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

// For editing address
const editAddress = async (req,res) => {
    try{
        const userId = req.session.userId;
        const addressId = req.params.id;

        if(!userId){
            return res.status(401).json({success:false,message:'Plesase login first'});
        }

        // Verifying address is exist and belongs to userId
        const address=await Address.findOne({_id:addressId, userId });
        if(!address){
            return res.status(404).json({ success: false, message: 'Address is not found or unauthorized'});
        }

        const { fullName, phone, houseName, street, city, district, state, pincode, landmark, addressType } = req.body;

        // update in mongoDb
        await Address.findByIdAndUpdate(
            addressId, {
                fullName,
                phone,
                houseName,
                street,
                city,
                district,
                state,
                pincode,
                landmark,
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