const { validateName, validatePhone, apostrophePattern } = require('./userValidators');

const fieldPattern = /^[A-Za-z0-9][A-Za-z0-9 .,\/\#-]*$/;
const placePattern = /^[A-Za-z][A-Za-z .-]*$/;

const normalizeState = state => {
    const normalized = String(state || '').toLowerCase().replace(/[^a-z]/g, '');
    const aliases = {
        orissa: 'odisha',
        uttaranchal: 'uttarakhand',
        pondicherry: 'puducherry',
        nctofdelhi: 'delhi',
        nationalcapitalterritoryofdelhi: 'delhi'
    };
    return aliases[normalized] || normalized;
};

const validatePincodeState = async (pincode, state) => {
    try {
        const response = await fetch(`https://api.postalpincode.in/pincode/${encodeURIComponent(pincode)}`, {
            signal: AbortSignal.timeout(5000)
        });
        if (!response.ok) return 'Unable to verify this pincode right now. Please try again.';

        const [result] = await response.json();
        if (result?.Status !== 'Success' || !Array.isArray(result.PostOffice) || !result.PostOffice.length) {
            return 'Please enter a valid pincode';
        }

        const expectedState = normalizeState(state);
        const matchesState = result.PostOffice.some(postOffice => normalizeState(postOffice.State) === expectedState);
        return matchesState ? null : 'Pincode does not match the selected state';
    } catch (error) {
        return 'Unable to verify this pincode right now. Please try again.';
    }
};

const validateTextField = (value, label, maxLength, pattern = fieldPattern) => {
    const text = String(value || '').trim();
    if (!text) return `${label} is required`;
    if (text.length < 2) return `${label} must be at least 2 characters long`;
    if (text.length > maxLength) return `${label} cannot exceed ${maxLength} characters`;
    if (apostrophePattern.test(text) || text.includes('_') || !pattern.test(text)) return `${label} contains unsupported characters`;
    return null;
};

const validateAddress = async (data) => {
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
    else if (!stateError) {
        const pincodeError = await validatePincodeState(pincode, data.state);
        if (pincodeError) errors.pincode = pincodeError;
    }

    const landmark = String(data.landmark || '').trim();
    if (landmark && (landmark.length > 50 || apostrophePattern.test(landmark) || landmark.includes('_') || !fieldPattern.test(landmark))) {
        errors.landmark = 'Landmark contains unsupported characters';
    }

    if (!['Home', 'Work', 'Other'].includes(data.addressType)) errors.addressType = 'Please select a valid address type';
    return errors;
};

module.exports = { validateAddress };
