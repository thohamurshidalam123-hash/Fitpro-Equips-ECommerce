const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();
const adminController = require('../controllers/adminController');
const categoryController = require('../controllers/categoryControllers')
const productController = require('../controllers/productController');
const brandController = require('../controllers/brandController');
const adminOrderController = require('../controllers/adminOrderController')
const invoiceController = require('../controllers/invoiceController');
const couponController = require('../controllers/couponController');

const productUploadDir = path.join(__dirname, '..', 'uploads', 'products');
fs.mkdirSync(productUploadDir, { recursive: true });
const productUpload = multer({
	limits: { fileSize: 5 * 1024 * 1024 },
	storage: multer.diskStorage({
		destination: productUploadDir,
		filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`)
	}),
	fileFilter: (req, file, cb) => cb(['image/png', 'image/jpeg'].includes(file.mimetype) ? null : new Error('UNSUPPORTED_FILE_TYPE'), true)
});
const parseProductUpload = (req, res, next) => productUpload.array('images', 8)(req, res, error => {
	if (error) {
		return res.status(400).json({ success: false, message: 'Please correct the errors below', errors: { images: error.code === 'LIMIT_FILE_SIZE' ? 'Image cannot exceed 5 MB' : 'File not supported' } });
	}
	next();
});

const categoryUploadDir = path.join(__dirname, '..', 'uploads', 'categories');
fs.mkdirSync(categoryUploadDir, { recursive: true });
const categoryUpload = multer({
	limits: { fileSize: 5 * 1024 * 1024 },
	storage: multer.diskStorage({
		destination: (req, file, cb) => cb(null, categoryUploadDir),
		filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`)
	}),
	fileFilter: (req, file, cb) => cb(['image/png', 'image/jpeg'].includes(file.mimetype) ? null : new Error('UNSUPPORTED_FILE_TYPE'), true)
});
const parseCategoryUpload = (req, res, next) => categoryUpload.single('image')(req, res, error => {
	if (error) {
		return res.status(400).json({
			success: false,
			message: 'Please correct the errors below',
			errors: { image: error.code === 'LIMIT_FILE_SIZE' ? 'Image cannot exceed 5 MB' : 'File not supported' }
		});
	}
	next();
});

const brandUploadDir = path.join(__dirname, '..', 'uploads', 'brands');
fs.mkdirSync(brandUploadDir, { recursive: true });
const parseBrandUpload = (req, res, next) => multer({ dest: brandUploadDir, limits: { fileSize: 5 * 1024 * 1024 } }).single('logo')(req, res, error => {
	if (error) return res.status(400).json({ success: false, errors: { logo: error.code === 'LIMIT_FILE_SIZE' ? 'Image cannot exceed 5 MB' : 'File not supported' } });
	if (req.file) {
		const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${req.file.mimetype === 'image/png' ? '.png' : '.jpg'}`;
		const target = path.join(brandUploadDir, filename);
		fs.renameSync(req.file.path, target);
		req.file.filename = filename;
		req.file.path = target;
	}
	next();
});

const requireAdminSession = (req, res, next) => {
	if (!req.session.adminId) return res.status(401).json({ success: false, message: 'Admin authentication required.' });
	next();
};

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

// Brand management routes
router.get('/brands/:id', brandController.loadBrandDetails);
router.get('/brands', brandController.loadBrands);
router.post('/brands/add', parseBrandUpload, brandController.addBrand);
router.post('/brands/edit', parseBrandUpload, brandController.editBrand);
router.patch('/brands/status/:id', brandController.toggleBrandStatus);

// Product management routes
router.get('/products', productController.loadProducts);
router.post('/products/add', parseProductUpload, productController.addProduct);
router.post('/products/edit/:id', parseProductUpload, productController.editProduct);
router.get('/products/:id', productController.loadProductDetails);
router.post('/products/:productId/variants/add', parseProductUpload, productController.addVariant);
router.put('/products/:productId/variants/edit/:variantId', parseProductUpload, productController.editVariant);
router.delete('/products/:productId/variants/delete/:variantId',productController.deleteVariant);

// Order management routes
router.get('/orders',adminOrderController.loadAdminOrders);
router.get('/orders/:id/invoice', invoiceController.downloadAdminInvoice);
router.get('/orders/:id',adminOrderController.loadAdminOrderDetails);
router.post('/orders/:id/status',adminOrderController.updateOrderStatus)

// Coupon management routes
router.get('/coupons', couponController.getCoupons);
router.post('/coupons', requireAdminSession, couponController.createCoupon);
router.put('/coupons/:id', requireAdminSession, couponController.updateCoupon);
router.delete('/coupons/:id', requireAdminSession, couponController.deleteCoupon);

module.exports = router;