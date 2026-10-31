const User = require('../models/user');
const settingsService = require('../services/settingsService');
const { getOtpExpiryTimestamp, isOtpExpired } = require('../helpers/otpResend');

const loadSettings = async (req, res) => {
    try {
        const [settings, admin] = await Promise.all([
            settingsService.getSettings(),
            User.findOne({ _id: req.session.adminId, role: 'admin' }).select('email')
        ]);
        if (!admin) return res.redirect('/admin/login');
        const pendingEmailChange = req.session.adminEmailChange;
        return res.render('admin/settings', {
            currentPage: 'settings',
            settings: pendingEmailChange && pendingEmailChange.settings
                ? { ...settings, ...pendingEmailChange.settings }
                : settings,
            adminEmail: admin.email,
            pendingAdminEmail: pendingEmailChange ? pendingEmailChange.email : admin.email,
            emailOtpActive: Boolean(pendingEmailChange),
            pendingEmailOtpExpiresAt: pendingEmailChange ? pendingEmailChange.expiresAt : ''
        });
    } catch (error) {
        console.error('Settings page load error:', error.message);
        return res.status(500).send('Unable to load settings.');
    }
};

const saveSettings = async (req, res) => {
    try {
        const result = await settingsService.saveSettings(req.body);
        if (!result.success) return res.status(result.statusCode).json(result);
        return res.json({ success: true, message: 'Settings saved successfully.', settings: result.settings });
    } catch (error) {
        console.error('Settings save error:', error.message);
        return res.status(500).json({ success: false, message: 'Unable to save settings.' });
    }
};

const sendEmailChangeOtp = async (req, res) => {
    try {
        const settingsErrors = settingsService.validateSettings(req.body.settings || {});
        if (Object.keys(settingsErrors).length) {
            return res.status(400).json({ success: false, message: 'Please correct the settings before continuing.', errors: settingsErrors });
        }
        const result = await settingsService.requestAdminEmailChangeOtp({
            adminId: req.session.adminId,
            email: req.body.email
        });
        if (!result.success) return res.status(result.statusCode).json(result);

        const expiresAt = getOtpExpiryTimestamp();
        req.session.adminEmailChange = {
            email: result.email,
            otp: result.otp,
            expiresAt,
            settings: req.body.settings
        };
        return res.json({
            success: true,
            message: `OTP sent to company mail ID: ${result.companyEmail}`,
            expiresAt
        });
    } catch (error) {
        console.error('Admin email OTP error:', error.message);
        return res.status(500).json({ success: false, message: 'Unable to send the OTP.' });
    }
};

const verifyEmailChangeOtp = async (req, res) => {
    const pendingChange = req.session.adminEmailChange;
    if (!pendingChange) return res.status(400).json({ success: false, message: 'Request a new OTP to continue.' });
    if (isOtpExpired(pendingChange.expiresAt)) {
        return res.status(400).json({ success: false, message: 'OTP expired. Request a new OTP.' });
    }
    if (!/^\d{6}$/.test(String(req.body.otp || '')) || req.body.otp !== pendingChange.otp) {
        return res.status(400).json({ success: false, message: 'Invalid OTP.' });
    }
    if (!pendingChange.settings) {
        delete req.session.adminEmailChange;
        return res.status(400).json({ success: false, message: 'Settings session expired. Please start again.' });
    }

    try {
        const settingsResult = await settingsService.saveSettings(pendingChange.settings);
        if (!settingsResult.success) return res.status(settingsResult.statusCode).json(settingsResult);

        const result = await settingsService.updateAdminEmail({
            adminId: req.session.adminId,
            email: pendingChange.email
        });
        if (!result.success) return res.status(result.statusCode).json(result);

        return res.json({
            success: true,
            message: 'Settings saved and admin email updated successfully.',
            email: result.email,
            redirectUrl: `/admin/logout?email=${encodeURIComponent(result.email)}`
        });
    } catch (error) {
        console.error('Admin email update error:', error.message);
        return res.status(500).json({ success: false, message: 'Unable to update the admin email.' });
    }
};

const resendEmailChangeOtp = async (req, res) => {
    try {
        const pendingChange = req.session.adminEmailChange;
        if (!pendingChange) return res.status(400).json({ success: false, message: 'Email change request expired. Start again.' });
        if (!isOtpExpired(pendingChange.expiresAt)) {
            return res.status(429).json({ success: false, message: 'You can resend the OTP after it expires.' });
        }

        const result = await settingsService.requestAdminEmailChangeOtp({
            adminId: req.session.adminId,
            email: pendingChange.email
        });
        if (!result.success) return res.status(result.statusCode).json(result);

        const expiresAt = getOtpExpiryTimestamp();
        req.session.adminEmailChange = {
            email: result.email,
            otp: result.otp,
            expiresAt,
            settings: pendingChange.settings
        };
        return res.json({
            success: true,
            message: `OTP resent to company mail ID: ${result.companyEmail}`,
            expiresAt
        });
    } catch (error) {
        console.error('Admin email OTP resend error:', error.message);
        return res.status(500).json({ success: false, message: 'Unable to resend the OTP.' });
    }
};

const cancelEmailChangeOtp = (req, res) => {
    delete req.session.adminEmailChange;
    return res.json({ success: true });
};

module.exports = { loadSettings, saveSettings, sendEmailChangeOtp, resendEmailChangeOtp, verifyEmailChangeOtp, cancelEmailChangeOtp };