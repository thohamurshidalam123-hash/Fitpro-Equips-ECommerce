const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const namePattern = /^[A-Za-z]+(?:[ -][A-Za-z]+)*$/;
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
const indianPhonePattern = /^[6-9]\d{9}$/;
const apostrophePattern = /['’]/;

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizePhone = (value) => String(value || '').trim().replace(/\s+/g, '').replace(/^\+91/, '');

const validateEmail = (value) => {
    const email = normalizeEmail(value);
    if (!email) return 'Email Address is required';
    if (!emailPattern.test(email)) return 'Please enter a valid email address';
    return null;
};

const validateName = (value, label = 'Name') => {
    const name = String(value || '').trim();
    if (!name) return `${label} is required`;
    if (name.length < 2) return `${label} must be at least 2 characters long`;
    if (name.length > 50) return `${label} cannot exceed 50 characters`;
    if (apostrophePattern.test(name) || !namePattern.test(name)) return `${label} can contain only letters, spaces, and hyphens`;
    return null;
};

const validatePhone = (value) => {
    const phone = normalizePhone(value);
    if (!phone) return 'Phone Number is required';
    if (!indianPhonePattern.test(phone)) return 'Please enter a valid Indian mobile number';
    return null;
};

const validatePassword = (value, label = 'Password') => {
    const password = String(value || '').trim();
    if (!password) return `${label} is required`;
    if (apostrophePattern.test(password)) return `${label} cannot contain apostrophes`;
    if (!passwordPattern.test(password)) {
        return `${label} must be at least 8 characters long and include uppercase, lowercase, a number, and a special character`;
    }
    return null;
};

const validateDateOfBirth = (value) => {
    const input = String(value || '').trim();
    if (!input) return 'Date of Birth is required';

    const date = new Date(`${input}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input) {
        return 'Please enter a valid date of birth';
    }

    const today = new Date();
    if (date.getUTCFullYear() === today.getUTCFullYear()) return 'Current year not accepted in DOB';
    const minimumBirthDate = new Date(Date.UTC(today.getUTCFullYear() - 13, today.getUTCMonth(), today.getUTCDate()));
    const maximumBirthDate = new Date(Date.UTC(today.getUTCFullYear() - 120, today.getUTCMonth(), today.getUTCDate()));
    if (date > minimumBirthDate) return 'You must be at least 13 years old';
    if (date < maximumBirthDate) return 'Please enter a valid date of birth';
    return null;
};

const validateUserFields = (data, { requireConsent = false } = {}) => {
    const errors = {};
    const nameError = validateName(data.name, 'Full Name');
    const emailError = validateEmail(data.email);
    const phoneError = validatePhone(data.phone);
    const dobError = validateDateOfBirth(data.dateOfBirth);
    const passwordError = validatePassword(data.password);

    if (nameError) errors.name = nameError;
    if (emailError) errors.email = emailError;
    if (phoneError) errors.phone = phoneError;
    if (dobError) errors.dateOfBirth = dobError;
    if (!data.gender || !['male', 'female', 'other', 'Male', 'Female', 'Other'].includes(data.gender)) errors.gender = 'Please select a valid gender';
    if (passwordError) errors.password = passwordError;
    if (data.confirmPassword === undefined || !String(data.confirmPassword || '').trim()) errors.confirmPassword = 'Confirm Password is required';
    else if (String(data.password || '').trim() !== String(data.confirmPassword).trim()) errors.confirmPassword = 'Passwords do not match';
    if (requireConsent && data.consent !== 'on') errors.consent = 'You must agree to the Privacy Policy and Terms of Service';
    return errors;
};

module.exports = {
    normalizeEmail,
    normalizePhone,
    apostrophePattern,
    validateEmail,
    validateName,
    validatePhone,
    validatePassword,
    validateDateOfBirth,
    validateUserFields
};
