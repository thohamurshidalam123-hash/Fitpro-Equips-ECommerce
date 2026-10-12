const adminService = require('../services/adminService');
const { getOtpResendSeconds, setOtpResendAvailableAt } = require('../helpers/otpResend');

// Render admin login page
const loadLogin = async (req,res) => {
    try{
        if( req.session.adminId ){
            return res.redirect( '/admin/dashboard' );
        }
        res.render('admin/login', {
            message: null,
            adminOtpActive: Boolean(req.session.adminResetOtp),
            adminResetEmail: req.session.adminResetEmail || '',
            otpResendSeconds: getOtpResendSeconds(req.session.adminResetOtpResendAt)
        });
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
        if (!result.emailSent) return res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again.' });
        req.session.adminResetEmail = email;
        req.session.adminResetOtp = result.otp;
        req.session.adminResetOtpExpiry = Date.now() + 180000;
        setOtpResendAvailableAt(req.session, 'adminResetOtpResendAt');
        
        return res.json({ success: true, message: 'OTP sent successfully.', resendSeconds: 60 });
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
            delete req.session.adminResetOtpResendAt;
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
        delete req.session.adminResetOtpResendAt;

        return res.json({ success: true, message: 'Password updated successfully.'});
    
    }catch(error){
        console.error('Admin password reset error:',error.message);
        res.status(500).json({  success: false, message: 'Server Error'});
    }
};

// Resending OTP for forgot password
const resendForgotOtp = async (req,res) => {
    try{
        const email = req.session.adminResetEmail;
        if (!email || !req.session.adminResetOtp) {
            return res.status(400).json({ success: false, message: 'Password reset session expired. Please start again.' });
        }

        const resendSeconds = getOtpResendSeconds(req.session.adminResetOtpResendAt);
        if (resendSeconds > 0) {
            return res.status(429).json({ success: false, message: 'Please wait before requesting another OTP.', resendSeconds });
        }

        const result = await adminService.sendAdminResetOtp(email);
        if (!result.success) return res.status(result.statusCode).json({ success: false, message: result.message });
        if (result.emailSent) {
            req.session.adminResetOtp = result.otp;
            req.session.adminResetOtpExpiry = Date.now() + 180000; // 3 minutes
            setOtpResendAvailableAt(req.session, 'adminResetOtpResendAt');
        } else {
            return res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again.' });
        }

        return res.json({ success: true, message: 'OTP resent successfully to your email.', resendSeconds: 60 });

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