const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();
const userController = require('../controllers/userController');
const addressController = require('../controllers/addressController');
const passport = require('passport');
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

router.get('/', (req, res) => {
    res.render('user/landing', { currentPage: 'home' });
});

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
router.get('/userProfile', userController.loadProfile);
router.post('/userProfile', upload.single('profile_image'), userController.updateProfile);
router.get('/verify-profile-otp', userController.loadProfileOtpModal);
router.post('/verify-profile-otp', userController.verifyProfileOtp);

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

router.get('/addresses', userController.loadAddressPage);
router.post('/add-address', addressController.addAddress);

module.exports = router;