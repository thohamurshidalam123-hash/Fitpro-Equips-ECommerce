const Address = require('../models/addressModel');

const createAddress = async( userId, addressData) => {
    const { fullName, phone, houseName, street, city, district, state, pincode, landmark, addressType } = addressData;

    // check if user already has addresses to determine if this defualt
    const addressCount = await Address.countDocuments({ userId });
    const isDefault = addressCount === 0 ;

    const newAddress = new Address({
        userId,
        fullName: fullName.trim(),
        phone:phone.trim(),
        houseName : houseName.trim(),
        street: street.trim(),
        city: city.trim(),
        district: district.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        landmark: landmark ? landmark.trim() : '',
        addressType,
        isDefault
    });

    await newAddress.save();
    return newAddress;
};

const updateAddress = async (addressId, userId, addressData) => {
    const { fullName, phone, houseName, street, city, district, state, pincode, landmark, addressType } = addressData;

    const formData = {
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
    };

    const address = await Address.findOneAndUpdate(
        { _id: addressId, userId },
        formData,
        { new: true, runValidators: true }
    );
    if (!address) {
        throw new Error('Address not found.');
    }
    return address;
};

const removeAddress = async ( addressId, userId) => {
    const address = await Address.findOneAndDelete({ _id: addressId, userId });
    if (!address) {
        throw new Error('Address not found or already deleted.');
    }
    return address;
} ;

module.exports = {
    createAddress,
    updateAddress,
    removeAddress
};