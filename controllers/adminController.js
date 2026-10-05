const adminService = require('../services/adminService');

// Render admin login page
const loadLogin = async (req,res) => {
    try{
        if( req.session.adminId ){
            return res.redirect( '/admin/dashboard' );
        }
        res.render( 'admin/login', {message:null});
    }catch(error) {
        console.log( 'Admin login render error:', error.message);
        res.status(500).send('Server Error');
    }
};

// For admin's login submission
const adminLogin = async (req,res) => {
    try{
        const result = await adminService.authenticateAdmin(req.body);
        if (result.success) {
            // Setting admin session
            req.session.adminId = result.admin._id;
            return res.redirect('/admin/dashboard');
        }
        return res.render('admin/login', { message: result.message });
        }catch(error){
            console.log( 'Admin login error:',error.message);
            res.status(500).send('Server Error');
        }
};

// For admin logout
const adminLogout = async (req,res) => {
    try{
        req.session.destroy((err) => {
                if(err) console.log('Error destroying admin session: ',err);
                res.redirect('/admin/login');
            });
        }catch(error) {
            console.log('Admin logout error:',error.message);
            res.status(500).send('Server Error');
        }
};

const loadDashboard = async (req,res) => {
    if(!req.session.adminId) return res.redirect('/admin/login');
    res.render('admin/dashboard', { currentPage: 'dashboard' }); 
};

// Sending otp for forgot password
const forgotPassword = async (req,res) => {
    try{
        const { email } = req.body

        const result = await adminService.sendAdminResetOtp(email);
        if (!result.success) return res.status(result.statusCode).json({ success: false, message: result.message, errors: { email: result.message } });
        if (result.emailSent) {
            req.session.adminResetEmail = email;
            req.session.adminResetOtp = result.otp;
            req.session.adminResetOtpExpiry = Date.now() + 180000;
        }
        
        return res.json({ success: true, message: 'OTP sent successfully.'});
    }catch(error){
        return res.status(500).json({ success: false, message: 'Server Error'})
    }
}

// Verifying otp entered by admin
const verifyForgotOtp = async (req,res) => {
    try{
         const result = adminService.verifyAdminResetOtp({
             otp: req.body.otp,
             expectedOtp: req.session.adminResetOtp,
             expiresAt: req.session.adminResetOtpExpiry
         });
            if (!result.success) {
                const errors = req.session.adminResetOtp ? { otp: result.message } : null;
                return res.status(result.statusCode).json({ success: false, message: result.message, errors });
            }
        return res.status(200).json({ success: true, message: 'OTP verified successfully'});
    }catch(error){
            console.error('Admin verify OTP error:',error.message);
            res.status(500).json({ success: false, message: 'Server Error'})
     }
};

// Update admin password
const resetPassword = async (req,res) => {
    try{
        if(!req.session.adminResetEmail){
            return res.status(400).json({ success: false, message: 'Session expired. Please start over'});
        }
        const result = await adminService.updateAdminPassword({ ...req.body, email: req.session.adminResetEmail });
        if (!result.success) {
            const errors = /passwords do not match/i.test(result.message) ? { confirmPassword: result.message } : null;
            return res.status(result.statusCode).json({ success: false, message: result.message, errors });
        }

        // Deleting session data to make not reusable
        delete req.session.adminResetEmail;
        delete req.session.adminResetOtp;
        delete req.session.adminResetOtpExpiry;

        return res.json({ success: true, message: 'Password updated successfully.'});
    
    }catch(error){
        console.error('Admin password reset error:',error.message);
        res.status(500).json({  success: false, message: 'Server Error'});
    }
};

// Resending OTP for forgot password
const resendForgotOtp = async (req,res) => {
    try{
        const { email } = req.body;

        if(!email){
            return res.status(400).json({ success: false, message: 'Email is required'});
        }

        const result = await adminService.sendAdminResetOtp(email);
        if (!result.success) return res.status(result.statusCode).json({ success: false, message: result.message });
        if (result.emailSent) {
            req.session.adminResetEmail = email;
            req.session.adminResetOtp = result.otp;
            req.session.adminResetOtpExpiry = Date.now() + 180000; // 3 minutes
        }

        return res.json({ success: true, message: 'OTP resent successfully to your email.'});

    }catch(error){
        console.error('Admin resend OTP error:',error.message);
        res.status(500).json({ success: false, message: 'Server Error'});
    }
};

// Load Customers Page
const loadCustomers = async (req, res) => {
    try{
        if(!req.session.adminId) return res.redirect('/admin/login');

        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const searchQuery = req.query.search || '';
        const status = ['active', 'blocked'].includes(req.query.status) ? req.query.status : '';
        const data = await adminService.getCustomers({ page, limit, searchQuery, status });

        // For showing customer management page
        res.render('admin/customers', {
            users: data.users,
            page: page,
            totalPages: data.totalPages,
            searchQuery: searchQuery,
            status: status,
            totalUsers: data.totalUsers,
            activeCount: data.activeCount,
            blockedCount: data.blockedCount,
            currentPage: 'customers'
        });
    }catch(error){
        console.log('Error in loading customer management page:', error.message);
        res.status(500).send('Server Error');
    }
};

// Block/Unblock user
const toggleBlockUser = async (req,res) => {
    try{
        if(!req.session.adminId){
            return res.status(401).json({ success: false, message:'Unauthorized'});
        }

        const result = await adminService.toggleCustomerBlock(req.params.id);
        if (!result.success) return res.status(result.statusCode).json({ success: false, message: result.message });
        res.json(result);
    }catch(error){
        console.error('Block/Unblock error:',error.message);
        res.status(500).json({ success: false, message:'Server Error'});
    }
};



module.exports = {
    loadLogin,
    adminLogin,
    adminLogout,
    loadDashboard,
    forgotPassword,
    verifyForgotOtp,
    resetPassword,
    resendForgotOtp,
    loadCustomers,
    toggleBlockUser,

}