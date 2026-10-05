const User = require('../models/user');
const bcrypt = require('bcrypt');
const { sendOtpEmail } = require('./emailServices');

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// For validating admin login details
const authenticateAdmin = async ({ email, password }) => {
    const admin = await User.findOne({ email });
    if (!admin) return { success: false, message: 'Invalid email or password.' };
    if (admin.role !== 'admin') return { success: false, message: 'Access denied. You are not a admin' };
    const passwordMatch = await bcrypt.compare(password, admin.password);
    if (!passwordMatch) return { success: false, message: 'Invalid email or password.' };
    return { success: true, admin };
};

// For sending an admin password reset OTP
const sendAdminResetOtp = async email => {
    const admin = await User.findOne({ email, role: 'admin' });
    if (!admin) return { statusCode: 404, message: 'Admin account not found with this email' };
    const otp = generateOtp();
    const emailSent = await sendOtpEmail(email, otp);
    return { success: true, emailSent, otp };
};

// For verifying an admin password reset OTP
const verifyAdminResetOtp = ({ otp, expectedOtp, expiresAt }) => {
    if (!expectedOtp) return { statusCode: 400, message: 'Session expired. Please login' };
    if (Date.now() > expiresAt) return { statusCode: 400, message: 'Otp has expired. Please request new one' };
    if (otp !== expectedOtp) return { statusCode: 400, message: 'Invalid Otp' };
    return { success: true };
};

// For updating an admin password
const updateAdminPassword = async ({ email, newPassword, confirmPassword }) => {
    if (newPassword !== confirmPassword) return { statusCode: 400, message: 'Passwords do not match' };
    const securePassword = await bcrypt.hash(newPassword, 10);
    await User.updateOne({ email, role: 'admin' }, { $set: { password: securePassword } });
    return { success: true };
};

// For loading customers with search, filter and pagination
const getCustomers = async ({ page, limit, searchQuery, status }) => {
    const query = { role: 'user' };
    if (status === 'active') query.isBlocked = false;
    if (status === 'blocked') query.isBlocked = true;
    if (searchQuery) {
        query.$or = [
            { name: { $regex: searchQuery, $options: 'i' } },
            { email: { $regex: searchQuery, $options: 'i' } }
        ];
    }
    const [users, totalUsers, activeCount, blockedCount] = await Promise.all([
        User.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        User.countDocuments(query),
        User.countDocuments({ role: 'user', isBlocked: false }),
        User.countDocuments({ role: 'user', isBlocked: true })
    ]);
    return { users, totalUsers, totalPages: Math.ceil(totalUsers / limit), activeCount, blockedCount };
};

// For blocking or unblocking a customer
const toggleCustomerBlock = async userId => {
    const user = await User.findById(userId);
    if (!user) return { statusCode: 404, message: 'Customer not found' };
    user.isBlocked = !user.isBlocked;
    await user.save();
    return {
        success: true,
        isBlocked: user.isBlocked,
        message: user.isBlocked ? 'Customer blocked successfully' : 'Customer unblocked successfully'
    };
};

module.exports = { authenticateAdmin, sendAdminResetOtp, verifyAdminResetOtp, updateAdminPassword, getCustomers, toggleCustomerBlock };
