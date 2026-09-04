const { validateName, validatePhone, apostrophePattern } = require('./userValidators');

const fieldPattern = /^[A-Za-z0-9][A-Za-z0-9 .,\/\#-]*$/;
const placePattern = /^[A-Za-z][A-Za-z .-]*$/;

const validateTextField = (value, label, maxLength, pattern = fieldPattern) => {
    const text = String(value || '').trim();
    if (!text) return `${label} is required`;
    if (text.length < 2) return `${label} must be at least 2 characters long`;
    if (text.length > maxLength) return `${label} cannot exceed ${maxLength} characters`;
    if (apostrophePattern.test(text) || text.includes('_') || !pattern.test(text)) return `${label} contains unsupported characters`;
    return null;
};

const validateAddress = (data) => {
    const errors = {};
    const fullNameError = validateName(data.fullName, 'Full Name');
    const phoneError = validatePhone(data.phone);
    const cityError = validateTextField(data.city, 'City', 30, placePattern);
    const districtError = validateTextField(data.district, 'District', 30, placePattern);
    const stateError = validateTextField(data.state, 'State', 30, placePattern);
    const houseError = validateTextField(data.houseName, 'House Name / Flat No.', 50);
    const streetError = validateTextField(data.street, 'Street / Area', 50);

    if (fullNameError) errors.fullName = fullNameError;
    if (phoneError) errors.phone = phoneError;
    if (houseError) errors.houseName = houseError;
    if (streetError) errors.street = streetError;
    if (cityError) errors.city = cityError;
    if (districtError) errors.district = districtError;
    if (stateError) errors.state = stateError;

    const pincode = String(data.pincode || '').trim();
    if (!pincode) errors.pincode = 'Pincode is required';
    else if (!/^\d{6}$/.test(pincode)) errors.pincode = 'Pincode must be a 6-digit number';

    const landmark = String(data.landmark || '').trim();
    if (landmark && (landmark.length > 50 || apostrophePattern.test(landmark) || landmark.includes('_') || !fieldPattern.test(landmark))) {
        errors.landmark = 'Landmark contains unsupported characters';
    }

    if (!['Home', 'Work', 'Other'].includes(data.addressType)) errors.addressType = 'Please select a valid address type';
    return errors;
};

module.exports = { validateAddress };
