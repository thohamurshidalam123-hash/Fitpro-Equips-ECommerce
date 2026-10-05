const User = require('../models/user');
const Address = require('../models/addressModel');
const bcrypt = require('bcrypt');
const { OAuth2Client } = require('google-auth-library');
const { sendOtpEmail } = require('./emailServices');
const { validateName, validateEmail, validatePhone, validatePassword, validateDateOfBirth } = require('../validators/userValidators');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// For fetching a user's profile
const getUserProfile = async userId => User.findById(userId).lean();

// For registering a user and sending verification OTP
const registerUser = async data => {
    const { name, email, password, confirmPassword, phone, gender, dateOfBirth, consent } = data;
    const trimmedName = name ? name.trim() : '';
    const trimmedEmail = email ? email.trim().toLowerCase() : '';
    const trimmedPassword = password ? password.trim() : '';
    const trimmedConfirmPassword = confirmPassword ? confirmPassword.trim() : '';
    const rawPhone = phone ? phone.trim() : '';
    const normalizedPhone = '+91 ' + rawPhone.replace(/\s+/g, '').replace(/^\+91/, '');
    const formData = { name: trimmedName, email: trimmedEmail, phone: rawPhone, gender, dateOfBirth };
    const errors = {};
    const fieldErrors = {
        name: validateName(trimmedName, 'Full Name'),
        email: validateEmail(trimmedEmail),
        phone: validatePhone(rawPhone),
        dateOfBirth: validateDateOfBirth(dateOfBirth),
        password: validatePassword(trimmedPassword)
    };
    Object.keys(fieldErrors).forEach(field => { if (fieldErrors[field]) errors[field] = fieldErrors[field]; });
    if (!gender || !['male', 'female', 'other', 'Male', 'Female', 'Other'].includes(gender)) errors.gender = 'Please select a valid gender';
    if (!trimmedConfirmPassword) errors.confirmPassword = 'Confirm Password is required';
    else if (trimmedPassword !== trimmedConfirmPassword) errors.confirmPassword = 'Passwords do not match';
    if (!consent || consent !== 'on') errors.consent = 'You must agree to the Privacy Policy and Terms of Service';
    if (Object.keys(errors).length) return { success: false, statusCode: 400, errors, formData };

    if (await User.findOne({ email: trimmedEmail })) {
        return { success: false, errors: { email: 'Email already registered' }, formData };
    }
    if (await User.findOne({ phone: normalizedPhone })) {
        return { success: false, errors: { phone: 'This phone number is already registered' }, formData };
    }

    const securePassword = await bcrypt.hash(trimmedPassword, 10);
    const otp = generateOtp();
    const emailSent = await sendOtpEmail(trimmedEmail, otp);
    if (!emailSent) return { success: false, errors: { form: 'Failed to send OTP. Please try again.' }, formData };

    return {
        success: true,
        otp,
        userData: { name: trimmedName, email: trimmedEmail, phone: normalizedPhone, password: securePassword, gender, dateOfBirth }
    };
};

// For creating user after OTP verification
const createRegisteredUser = async userData => {
    const newUser = new User({
        name: userData.name,
        email: userData.email,
        phone: userData.phone || '',
        password: userData.password,
        gender: userData.gender,
        dateOfBirth: userData.dateOfBirth,
        role: 'user',
        isBlocked: false
    });
    await newUser.save();
    return newUser;
};

// For verifying registration OTP before creating a user
const verifyRegistrationOtp = async ({ otp, expectedOtp, expiresAt, userData }) => {
    if (!expectedOtp || !userData) return { status: 'session', message: 'Session expired. Please sign up again.' };
    if (Date.now() > expiresAt) return { status: 'expired', message: 'OTP has expired. Please try again.' };
    if (otp !== expectedOtp) return { status: 'invalid', message: 'Wrong OTP. Please try again.' };
    return { success: true, user: await createRegisteredUser(userData) };
};

// For sending a new registration OTP
const resendRegistrationOtp = async email => {
    const otp = generateOtp();
    return { otp, emailSent: await sendOtpEmail(email, otp) };
};

// For validating user login details
const authenticateUser = async ({ email, password }) => {
    const user = await User.findOne({ email });
    if (!user) return { success: false, message: 'Invalid email or password' };
    if (user.isBlocked) return { success: false, message: 'Your account has been blocked by the administrator.' };
    if (!user.password) return { success: false, message: 'Please log in using Google.' };
    if (!await bcrypt.compare(password, user.password)) return { success: false, message: 'Invalid email or password' };
    return { success: true, user };
};

// For sending a password reset OTP
const requestPasswordReset = async email => {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const emailError = validateEmail(normalizedEmail);
    if (emailError) return { status: 'invalid', message: emailError };
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return { status: 'notFound' };
    const otp = generateOtp();
    const emailSent = await sendOtpEmail(normalizedEmail, otp);
    return { status: emailSent ? 'sent' : 'failed', email: normalizedEmail, otp };
};

// For resending a password reset OTP
const resendPasswordResetOtp = async email => {
    const otp = generateOtp();
    return { otp, emailSent: await sendOtpEmail(email, otp) };
};

// For verifying OTP and updating a password
const resetUserPassword = async ({ email, otp, expectedOtp, expiresAt, newPassword, confirmPassword }) => {
    const passwordError = validatePassword(newPassword, 'New password');
    if (passwordError) return { success: false, errors: { newPassword: passwordError } };
    if (newPassword !== confirmPassword) return { success: false, errors: { confirmPassword: 'Passwords do not match.' } };
    if (Date.now() > expiresAt) return { success: false, errors: { otp: 'OTP expired. Please request a new one.' } };
    if (otp !== expectedOtp) return { success: false, errors: { otp: 'Invalid OTP. Please try again.' } };

    const securePassword = await bcrypt.hash(newPassword, 10);
    await User.updateOne({ email }, { $set: { password: securePassword } });
    return { success: true };
};

const validateProfileUpdate = data => {
    const errors = {};
    const fieldErrors = {
        name: validateName(data.name, 'Username'),
        email: validateEmail(data.email),
        phone: validatePhone(data.phone),
        dateOfBirth: validateDateOfBirth(data.dateOfBirth)
    };
    Object.keys(fieldErrors).forEach(field => { if (fieldErrors[field]) errors[field] = fieldErrors[field]; });
    if (!['Male', 'Female', 'Other', 'male', 'female', 'other'].includes(data.gender)) errors.gender = 'Please select a valid gender';
    return errors;
};

// For updating profile information and verifying changed email
const updateUserProfile = async ({ userId, data, profileImage }) => {
    const user = await User.findById(userId);
    if (!user) return { statusCode: 401, message: 'Unauthorized. Please log in.' };
    if (user.isBlocked) return { statusCode: 403, blocked: true, message: 'Your account has been blocked by the administrator. Profile changes cannot be saved.' };

    const { name, email, phone, gender, dateOfBirth } = data;
    const errors = validateProfileUpdate(data);
    if (Object.keys(errors).length) return { statusCode: 400, errors, formData: { name, email, phone, gender, dateOfBirth } };

    const normalizedEmail = email ? email.trim() : '';
    const normalizedPhone = phone ? phone.trim() : '';
    const updateData = { name: name.trim(), email: normalizedEmail, phone: normalizedPhone, gender, dateOfBirth };
    if (profileImage) updateData.profile_image = profileImage;

    if (normalizedEmail && normalizedEmail !== user.email) {
        if (await User.findOne({ email: normalizedEmail })) return { statusCode: 400, message: 'Email is already in use' };
        const otp = generateOtp();
        const emailSent = await sendOtpEmail(normalizedEmail, otp);
        if (!emailSent) return { statusCode: 500, message: 'Failed to send OTP' };
        return {
            success: true,
            requireOtp: true,
            pendingProfileUpdate: { ...updateData, profile_image: profileImage || user.profile_image },
            otp,
            pendingEmail: normalizedEmail
        };
    }

    await User.findByIdAndUpdate(userId, updateData);
    return { success: true, requireOtp: false };
};

// For verifying a profile email OTP
const verifyProfileEmailOtp = async ({ userId, pendingData, otp, expectedOtp, expiresAt }) => {
    if (!pendingData || !expectedOtp) return { statusCode: 400, message: 'Session expired. Please try editing again.' };
    if (Date.now() > expiresAt) return { statusCode: 400, message: 'OTP expired. Please try editing again.' };
    if (otp !== expectedOtp) return { statusCode: 400, message: 'Invalid OTP. Please try again.' };
    await User.findByIdAndUpdate(userId, {
        name: pendingData.name,
        email: pendingData.email,
        phone: pendingData.phone,
        gender: pendingData.gender,
        dateOfBirth: pendingData.dateOfBirth,
        profile_image: pendingData.profile_image || undefined
    });
    return { success: true };
};

// For Google login and linking an existing account
const authenticateGoogleUser = async credential => {
    if (!credential) return { statusCode: 400, message: 'No credential provided' };
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const { email, name, sub: googleId } = payload;
    let user = await User.findOne({ email });
    if (user) {
        if (user.isBlocked) return { statusCode: 403, message: 'Your account has been blocked' };
        if (!user.googleId) {
            user.googleId = googleId;
            await user.save();
        }
    } else {
        user = new User({ name, email, googleId });
        await user.save();
    }
    return { success: true, user };
};

// For changing a logged-in user's password
const changeUserPassword = async ({ userId, currentPassword, newPassword, confirmPassword }) => {
    const errors = {};
    if (!currentPassword || !currentPassword.trim()) errors.currentPassword = 'Current password is required';
    const passwordError = validatePassword(newPassword, 'New password');
    if (passwordError) errors.newPassword = passwordError;
    if (!confirmPassword || !confirmPassword.trim()) errors.confirmPassword = 'Confirm password is required';
    else if (newPassword !== confirmPassword) errors.confirmPassword = 'Passwords do not match.';
    if (Object.keys(errors).length) return { statusCode: 400, errors, formData: { currentPassword, newPassword, confirmPassword } };

    const user = await User.findById(userId);
    if (!user) return { statusCode: 401, message: 'Please log in again.' };
    if (!await bcrypt.compare(currentPassword, user.password)) {
        return { statusCode: 400, errors: { currentPassword: 'Current password is incorrect' }, formData: { currentPassword, newPassword, confirmPassword } };
    }
    if (await bcrypt.compare(newPassword, user.password)) {
        return { statusCode: 400, errors: { newPassword: 'Enter a new password' }, formData: { currentPassword, newPassword, confirmPassword } };
    }

    const securePassword = await bcrypt.hash(newPassword, 10);
    await User.updateOne({ _id: userId }, { $set: { password: securePassword } });
    return { success: true, message: 'Password changed !' };
};

// For loading user and saved addresses
const getAddressPageData = async userId => {
    const user = await User.findById(userId).lean();
    const addresses = await Address.find({ userId }).lean();
    addresses.forEach(address => { address.addressType = address.addressType || 'Home'; });
    return { user, addresses };
};

module.exports = {
    getUserProfile,
    registerUser,
    createRegisteredUser,
    verifyRegistrationOtp,
    resendRegistrationOtp,
    authenticateUser,
    requestPasswordReset,
    resendPasswordResetOtp,
    resetUserPassword,
    updateUserProfile,
    verifyProfileEmailOtp,
    authenticateGoogleUser,
    changeUserPassword,
    getAddressPageData
};
