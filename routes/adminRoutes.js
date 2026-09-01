const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.get('/login',adminController.loadLogin);
router.post('/login',adminController.adminLogin);
router.get('/logout',adminController.adminLogout);
router.get('/dashboard',adminController.loadDashboard);






module.exports = router;