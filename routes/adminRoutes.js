const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();
const adminController = require('../controllers/adminController');
const categoryController = require('../controllers/categoryControllers')
const productController = require('../controllers/productController');

const categoryUploadDir = path.join(__dirname, '..', 'uploads', 'categories');
fs.mkdirSync(categoryUploadDir, { recursive: true });
const categoryUpload = multer({
	limits: { fileSize: 5 * 1024 * 1024 },
	storage: multer.diskStorage({
		destination: (req, file, cb) => cb(null, categoryUploadDir),
		filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`)
	}),
	fileFilter: (req, file, cb) => cb(null, true)
});
const parseCategoryUpload = (req, res, next) => categoryUpload.single('image')(req, res, error => {
	if (error) {
		return res.status(400).json({
			success: false,
			message: 'Please correct the errors below',
			errors: { image: error.code === 'LIMIT_FILE_SIZE' ? 'Image cannot exceed 5 MB' : 'Unable to process the category image' }
		});
	}
	next();
});

router.get('/login',adminController.loadLogin);
router.post('/login',adminController.adminLogin);
router.get('/logout',adminController.adminLogout);
router.get('/dashboard',adminController.loadDashboard);


router.post('/forgot-password',adminController.forgotPassword);
router.post('/verify-forgot-otp',adminController.verifyForgotOtp);
router.post('/reset-password',adminController.resetPassword);
router.post('/resend-otp',adminController.resendForgotOtp);

router.get('/customers',adminController.loadCustomers)
router.post('/toggle-block/:id',adminController.toggleBlockUser);

// Category management routes
router.get('/category',categoryController.loadCategories);
router.get('/categories', categoryController.loadCategories);
router.post('/category/add', parseCategoryUpload, categoryController.addCategory);
router.post('/category/edit', parseCategoryUpload, categoryController.editCategory);
router.patch('/category/status/:id',categoryController.toggleCategoryStatus);

// Product management routes
router.get('/products', productController.loadProducts);



module.exports = router;