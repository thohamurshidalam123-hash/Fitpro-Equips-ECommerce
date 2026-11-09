const { randomInt } = require('crypto');
const StoreSettings = require('../models/storeSettingsModel');
const User = require('../models/user');
const { sendAdminEmailChangeOtp } = require('./emailServices');

const COMPANY_EMAIL = 'fitproequips.test1@gmail.com';
const DEFAULT_SETTINGS = {
    key: 'global',
    storeName: 'Fitpro Equips',
    supportPhone: '+91 6238833963',
    supportEmail: 'fitproequips.test1@gmail.com',
    shippingCharge: 500,
    freeShippingThreshold: 5000
};

const getSettings = async () => {
    const settings = await StoreSettings.findOne({ key: 'global' }).lean();
    if (settings) return {
        ...DEFAULT_SETTINGS,
        ...settings,
        supportPhone: settings.supportPhone || DEFAULT_SETTINGS.supportPhone,
        supportEmail: settings.supportEmail || DEFAULT_SETTINGS.supportEmail
    };

    return StoreSettings.findOneAndUpdate(
        { key: 'global' },
        { $setOnInsert: DEFAULT_SETTINGS },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
};

const validateSettings = data => {
    const errors = {};
    const storeName = String(data.storeName || '').trim();
    if (!storeName) errors.storeName = 'Store name is required.';
    else if (storeName.length < 2 || storeName.length > 80) errors.storeName = 'Store name must be between 2 and 80 characters.';
    else if (!/^[A-Za-z0-9][A-Za-z0-9 &'().-]*$/.test(storeName)) errors.storeName = 'Store name contains unsupported characters.';

    const supportPhone = String(data.supportPhone || '').trim();
    const phoneDigits = supportPhone.replace(/\D/g, '');
    if (!supportPhone) errors.supportPhone = 'Support phone is required.';
    else if (!/^\+?[0-9][0-9\s()-]*$/.test(supportPhone) || phoneDigits.length < 7 || phoneDigits.length > 15) {
        errors.supportPhone = 'Enter a valid phone number with 7 to 15 digits.';
    }

    const supportEmail = String(data.supportEmail || '').trim().toLowerCase();
    if (!supportEmail) errors.supportEmail = 'Support email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) errors.supportEmail = 'Enter a valid support email address.';

    for (const field of ['shippingCharge', 'freeShippingThreshold']) {
        const value = Number(data[field]);
        if (data[field] === '' || !Number.isSafeInteger(value) || value < 0 || value > 10000000) {
            errors[field] = 'Enter a whole amount between 0 and 10,000,000.';
        }
    }
    return errors;
};

const saveSettings = async data => {
    const errors = validateSettings(data);
    if (Object.keys(errors).length) return { success: false, statusCode: 400, errors };

    const settings = await StoreSettings.findOneAndUpdate(
        { key: 'global' },
        { $set: {
            storeName: String(data.storeName).trim(),
            supportPhone: String(data.supportPhone).trim(),
            supportEmail: String(data.supportEmail).trim().toLowerCase(),
            shippingCharge: Number(data.shippingCharge),
            freeShippingThreshold: Number(data.freeShippingThreshold)
        }, $setOnInsert: { key: 'global' } },
        { upsert: true, new: true, runValidators: true }
    ).lean();
    return { success: true, settings };
};

const requestAdminEmailChangeOtp = async ({ adminId, email }) => {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return { success: false, statusCode: 400, message: 'Enter a valid email address.', errors: { email: 'Enter a valid email address.' } };
    }

    const admin = await User.findOne({ _id: adminId, role: 'admin' }).select('email');
    if (!admin) return { success: false, statusCode: 401, message: 'Admin account not found.' };
    if (admin.email.toLowerCase() === normalizedEmail) {
        return { success: false, statusCode: 400, message: 'This is already the admin email address.' };
    }
    if (await User.exists({ email: normalizedEmail, _id: { $ne: adminId } })) {
        return { success: false, statusCode: 409, message: 'That email address is already in use.' };
    }

    const otp = String(randomInt(100000, 1000000));
    const emailSent = await sendAdminEmailChangeOtp(COMPANY_EMAIL, otp);
    if (!emailSent) return { success: false, statusCode: 502, message: 'Could not send the OTP. Please try again.' };
    return { success: true, email: normalizedEmail, otp, companyEmail: COMPANY_EMAIL };
};

const updateAdminEmail = async ({ adminId, email }) => {
    try {
        const admin = await User.findOneAndUpdate(
            { _id: adminId, role: 'admin' },
            { $set: { email } },
            { new: true, runValidators: true }
        ).select('email');
        return admin ? { success: true, email: admin.email } : { success: false, statusCode: 401, message: 'Admin account not found.' };
    } catch (error) {
        if (error.code === 11000) return { success: false, statusCode: 409, message: 'That email address is already in use.' };
        throw error;
    }
};

module.exports = { COMPANY_EMAIL, getSettings, validateSettings, saveSettings, requestAdminEmailChangeOtp, updateAdminEmail };