const User = require('../models/user');
const bcrypt = require('bcrypt');
const { sendOtpEmail } = require('../services/emailServices');
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

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
        const {email, password} = req.body;
        const admin = await User.findOne({ email });

        if( !admin ){
            return res.render( 'admin/login', { message: 'Invalid email or password.'});
        }
        // checking is the user admin or not
        if ( admin.role !== 'admin') {
            return res.render( 'admin/login', { message: 'Access denied. You are not a admin' });
        }

        const passwordMatch = await bcrypt.compare( password, admin.password);

        if( passwordMatch ){
            // Setting admin session
            req.session.adminId = admin._id;
            return res.redirect('/admin/dashboard');
         }else{
            return res.render('admin/login', { message: 'Invalid email or password.'});
         }
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
    res.render('admin/dashboard'); 
};

// Sending otp for forgot password
const forgotPassword = async (req,res) => {
    try{
        const { email } = req.body

        const admin = await User.findOne({ email, role:'admin'});

        if(!admin){
            return res.status(404).json({ success: false, message: 'Admin account not found with this email'});
        }

        const otp= generateOtp();
        const emailSent = await sendOtpEmail(email, otp);

        if(emailSent){
            req.session.adminResetEmail = email;
            req.session.adminResetOtp = otp;
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
         const {otp} = req.body;

         if (!req.session.adminResetEmail || !req.session.adminResetOtp){
            return res.status(400).json({ success: false, message: 'Session expired. Please login'})
         }

         if ( Date.now() > req.session.adminResetOtpExpiry){
          return res.status(400).json({ success: false, message: 'Otp has expired. Please request new one'})
        }
        if (otp !== req.session.adminResetOtp){
            return res.status(400).json({ success: false, message: 'Invalid Otp'});
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
        const { newPassword, confirmPassword } = req.body;

        if(!req.session.adminResetEmail){
            return res.status(400).json({ success: false, message: 'Session expired. Please start over'});
        }

        if(newPassword !== confirmPassword){
            return res.status(400).json({ success: false, message: 'Passwords do not match'});
        }

        const securePassword = await bcrypt.hash(newPassword, 10);

        // updating in database
        await User.updateOne(
            {email:req.session.adminResetEmail, role:'admin'},{$set: {password: securePassword}}
        );

        // Deleting session data to make not reusable
        delete req.session.adminResetEmail;
        delete req.session.adminresetOtp;
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

        const admin = await User.findOne({ email, role:'admin'});

        if(!admin){
            return res.status(404).json({ success: false, message: 'Admin account not found with this email'});
        }

        const otp = generateOtp();
        const emailSent = await sendOtpEmail(email, otp);

        if(emailSent){
            req.session.adminResetEmail = email;
            req.session.adminResetOtp = otp;
            req.session.adminResetOtpExpiry = Date.now() + 180000; // 3 minutes
        }

        return res.json({ success: true, message: 'OTP resent successfully to your email.'});

    }catch(error){
        console.error('Admin resend OTP error:',error.message);
        res.status(500).json({ success: false, message: 'Server Error'});
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
    resendForgotOtp

}