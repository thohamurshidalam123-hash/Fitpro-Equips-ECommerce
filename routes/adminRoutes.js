const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.get('/login',adminController.loadLogin);
router.post('/login',adminController.adminLogin);
router.get('/logout',adminController.adminLogout);
router.get('/dashboard',adminController.loadDashboard);

router.post('/forgot-password',adminController.forgotPassword);
router.post('/verify-forgot-otp',adminController.verifyForgotOtp);
router.post('/reset-password',adminController.resetPassword);
router.post('/resend-otp',adminController.resendForgotOtp);

router.get('/customers',adminController.loadCustomers)






module.exports = router;