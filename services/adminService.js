const User = require('../models/user');
const Order = require('../models/orderModel');
const Cart = require('../models/cartModel');
const Wishlist = require('../models/wishlistModel');
const Address = require('../models/addressModel');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { sendOtpEmail } = require('./emailServices');
const { isOtpExpired } = require('../helpers/otpResend');

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
    if (isOtpExpired(expiresAt)) return { statusCode: 400, message: 'OTP has timed out. Please request a new OTP.' };
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
    const orderCounts = users.length ? await Order.aggregate([
        { $match: { userId: { $in: users.map(user => user._id) } } },
        { $group: { _id: '$userId', count: { $sum: 1 } } }
    ]) : [];
    const orderCountMap = new Map(orderCounts.map(item => [String(item._id), item.count]));
    users.forEach(user => { user.orderCount = orderCountMap.get(String(user._id)) || 0; });

    return { users, totalUsers, totalPages: Math.ceil(totalUsers / limit), activeCount, blockedCount };
};

const getCustomerDetails = async userId => {
    if (!mongoose.isValidObjectId(userId)) return null;

    const customer = await User.findOne({ _id: userId, role: 'user' }).select('-password').lean();
    if (!customer) return null;

    const [summaryRows, orders, cart, wishlist, address] = await Promise.all([
        Order.aggregate([
            { $match: { userId: customer._id } },
            {
                $project: {
                    returnedItems: { $size: { $filter: { input: { $ifNull: ['$items', []] }, as: 'item', cond: { $eq: ['$$item.itemStatus', 'Returned'] } } } },
                    cancelledItems: { $size: { $filter: { input: { $ifNull: ['$items', []] }, as: 'item', cond: { $eq: ['$$item.itemStatus', 'Cancelled'] } } } },
                    returnRequests: { $size: { $filter: { input: { $ifNull: ['$items', []] }, as: 'item', cond: { $eq: ['$$item.itemStatus', 'Return requested'] } } } },
                    totalSpend: {
                        $sum: {
                            $map: {
                                input: {
                                    $filter: {
                                        input: { $ifNull: ['$items', []] },
                                        as: 'item',
                                        cond: { $not: [{ $in: [{ $ifNull: ['$$item.itemStatus', ''] }, ['Cancelled', 'Returned']] }] }
                                    }
                                },
                                as: 'item',
                                in: { $ifNull: ['$$item.itemTotal', { $multiply: [{ $ifNull: ['$$item.price', 0] }, { $ifNull: ['$$item.quantity', 0] }] }] }
                            }
                        }
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    returnedItems: { $sum: '$returnedItems' },
                    cancelledItems: { $sum: '$cancelledItems' },
                    returnRequests: { $sum: '$returnRequests' },
                    totalSpend: { $sum: '$totalSpend' }
                }
            }
        ]),
        Order.find({ userId: customer._id }).sort({ createdAt: -1 }).limit(8).select('orderId orderStatus grandTotal createdAt').lean(),
        Cart.findOne({ userId: customer._id }).select('items').lean(),
        Wishlist.findOne({ userId: customer._id }).select('products').lean(),
        Address.findOne({ userId: customer._id }).sort({ isDefault: -1, updatedAt: -1 }).lean()
    ]);

    const cartItems = cart?.items || [];
    return {
        customer,
        summary: summaryRows[0] || { totalOrders: 0, returnedItems: 0, cancelledItems: 0, returnRequests: 0, totalSpend: 0 },
        orders,
        cartProductCount: cartItems.length,
        cartUnitCount: cartItems.reduce((total, item) => total + Number(item.quantity || 0), 0),
        wishlistCount: wishlist?.products?.length || 0,
        address
    };
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

module.exports = { authenticateAdmin, sendAdminResetOtp, verifyAdminResetOtp, updateAdminPassword, getCustomers, getCustomerDetails, toggleCustomerBlock };
