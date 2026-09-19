const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();
const User = require('../models/user');
const userController = require('../controllers/userController');
const addressController = require('../controllers/addressController');
const passport = require('passport');
const userShopController = require('../controllers/userShopController');
const cartController = require ('../controllers/cartController')
require('../configuration/passport');


const uploadDir = path.join(__dirname, '..', 'uploads', 'profile-pics');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed.'));
        }
    }
});

const requireUserSession = async (req, res, next) => {
    if (!req.session || !req.session.userId) {
        req.session.message = 'Your session has expired. Please log in again.';
        req.session.messageType = 'error';
        return res.redirect('/login');
    }

    try {
        const user = await User.findById(req.session.userId).select('_id isBlocked');

        if (!user || user.isBlocked) {
            delete req.session.userId;
            req.session.message = user ? 'Your account has been blocked.' : 'Your session has expired. Please log in again.';
            req.session.messageType = 'error';
            return res.redirect('/login');
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('User session validation error:', error.message);
        req.session.message = 'Session validation failed. Please log in again.';
        req.session.messageType = 'error';
        return res.redirect('/login');
    }
};

router.get('/', userShopController.loadLandingPage);

// Authentication Routes
router.get('/login', userController.loadLogin);
router.post('/login', userController.loginUser);
router.get('/register', (req, res) => {
    res.render('user/register', { currentPage: 'register' });
});
router.post('/register', userController.registerUser);
router.get('/verify-otp', userController.loadOtpPage);
router.post('/verify-otp', userController.verifyOtp);
router.post('/resend-otp', userController.resendOtp);
router.get('/logout', userController.logout);
router.get('/userProfile', requireUserSession, userController.loadProfile);
router.post('/userProfile', requireUserSession, upload.single('profile_image'), userController.updateProfile);
router.get('/verify-profile-otp', requireUserSession, userController.loadProfileOtpModal);
router.post('/verify-profile-otp', requireUserSession, userController.verifyProfileOtp);

router.get('/auth/google', 
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/auth/google/callback', 
    passport.authenticate('google', { session: false, failureRedirect: '/login' }),
    (req, res) => {
        // Tie the authenticated Google user to your standard Express session
        req.session.userId = req.user._id;
        res.redirect('/');
    }
);

router.get('/forgot-password', userController.loadForgotPassword);
router.post('/forgot-password', userController.processForgotPassword);
router.get('/reset-password', userController.loadResetPassword);
router.post('/reset-password', userController.updatePassword);
router.post('/resend-reset-otp', userController.resendResetOtp);
router.get('/profile-reset-password', requireUserSession, userController.loadProfileResetPassword);
router.post('/profile-reset-password', requireUserSession, userController.updateProfilePassword);

router.get('/addresses', requireUserSession, userController.loadAddressPage);
router.post('/add-address', requireUserSession, addressController.addAddress);
router.post('/edit-address/:id', requireUserSession, addressController.editAddress);
router.delete('/delete-address/:id', requireUserSession, addressController.deleteAddress);

router.post('/google-login', userController.googleLogin);

// Shop page routes
router.get('/shop',userShopController.loadShopPage);
router.get('/products/:id',userShopController.productDetailsPage)

// Cart page routes
router.get('/cart',cartController.loadCartPage);
router.post('/cart/add',cartController.addToCart);
router.post('/cart/update',cartController.updateQuantity);
router.post('/cart/remove',cartController.removeFromCart);
router.post('/cart/moveToWishlist',cartController.moveToWishlist);

module.exports = router;