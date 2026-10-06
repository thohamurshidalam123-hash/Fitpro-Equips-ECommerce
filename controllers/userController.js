const userService = require('../services/userService');
const walletService = require('../services/walletService');

// Rendering login page
const loadLogin = async (req, res) => {
    try {
        // If user is already logged in, redirect them to profile
        if (req.session.userId) {
            return res.redirect('/userProfile');
        }

        const shouldShowAuthMessage = req.query.authMessage === '1';
        const message = req.session.message && (shouldShowAuthMessage || req.session.messageType === 'success')
            ? req.session.message
            : null;
        const messageType = message ? (req.session.messageType || 'error') : null;
        delete req.session.message;
        delete req.session.messageType;
        return res.render('user/login', { currentPage: 'login', message, messageType });
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Server Error');
    }
};

const loadProfile = async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.redirect('/login');
        }

        const user = await userService.getUserProfile(req.session.userId);
        if (!user) {
            req.session.destroy(() => res.redirect('/login'));
            return;
        }
        const wallet = await walletService.getWalletData(req.session.userId);

        const showOtpVerification = req.query.emailOtp === 'true';
        const pendingEmail = req.session.pendingProfileUpdate ? req.session.pendingProfileUpdate.email : null;
        const message = req.session.message || null;
        delete req.session.message;

        res.render('user/userProfile', {
            user,
            wallet,
            currentPage: 'profile',
            showOtpVerification,
            pendingEmail,
            message
        });
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Server Error');
    }
};

// Handle the registeration form submission
const registerUser = async (req, res) => {
    try {
        const result = await userService.registerUser(req.body);
        if (!result.success) {
            return res.status(result.statusCode || 200).json({ success: false, errors: result.errors, formData: result.formData });
        }

        // Store user data and OTP in session
        req.session.userData = result.userData;
        req.session.otp = result.otp;
        req.session.otpExpiry = Date.now() + 180000; // OTP valid for 3 minutes

        // Return success response
        return res.json({
            success: true,
            redirectUrl: '/verify-otp'
        });

    } catch (error) {
        console.log(error.message);
        return res.status(500).json({
            success: false,
            errors: { form: 'Server error. Please try again.' },
            formData: {}
        });
    }
};

// controller to render the OTP page
const loadOtpPage = async (req, res) => {
    try {
        res.render('user/otpVerification', { currentPage: 'otp' }); // Render your OTP input form
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Server Error');
    }
};

// Handle OTP Verification
const verifyOtp = async (req, res) => {
    try {
        const wantsJson = req.headers.accept && req.headers.accept.includes('application/json');
        const result = await userService.verifyRegistrationOtp({
            otp: req.body.otp,
            expectedOtp: req.session.otp,
            expiresAt: req.session.otpExpiry,
            userData: req.session.userData
        });
        if (!result.success) {
            if (wantsJson) return res.json({ success: false, message: result.message });
            return res.render('user/otpVerification', { message: result.message, currentPage: 'otp' });
        }

        // Clear temporary OTP data from the session
        delete req.session.otp;
        delete req.session.otpExpiry;
        delete req.session.userData;

        // Automatically log the user in using express-session
        req.session.userId = result.user._id;

        if (wantsJson) {
            return req.session.save((saveError) => {
                if (saveError) {
                    console.error('Error saving user session:', saveError.message);
                    return res.status(500).json({ success: false, message: 'Unable to start your login session. Please try again.' });
                }
                return res.json({ success: true, message: 'Registration successful.', redirectUrl: '/userProfile' });
            });
        }

        // Show confirmation before opening the user's profile
        return res.render('user/otpVerification', { registrationSuccess: true, currentPage: 'otp' });

    } catch (error) {
        console.error('Error verifying OTP:', error.message);
        res.status(500).send('Server Error');
    }
};

// Handle Resend OTP
const resendOtp = async (req, res) => {
    try {
        const userData = req.session.userData;

        if (!userData) {
            return res.redirect('/register'); // Session lost, start over
        }

        const result = await userService.resendRegistrationOtp(userData.email);
        req.session.otp = result.otp;
        req.session.otpExpiry = Date.now() + 180000; // Reset the 3-minute timer
        if (result.emailSent) {
            return res.render('user/otpVerification', { message: 'A new OTP has been sent to your email.', currentPage: 'otp' });
        } else {
            return res.render('user/otpVerification', { message: 'Failed to send OTP. Please try again.', currentPage: 'otp' });
        }
    } catch (error) {
        console.error('Error resending OTP:', error.message);
        res.status(500).send('Server Error');
    }
};


// Handle login form submission
const loginUser = async (req, res) => {
    try {
        const result = await userService.authenticateUser(req.body);
        if (result.success) {
            // Set the session and show the landing page after login
            req.session.userId = result.user._id;
            return res.redirect('/');
        }
        return res.render('user/login', { message: result.message, currentPage: 'login' });

    } catch (error) {
        console.log(error.message);
        res.status(500).send('Server Error');
    }
};

const logout = async (req, res) => {
    req.session.destroy((err) => {
        if (err) console.log('Error destroying session:', err);
        res.redirect('/login');
    });
}
// render forget password page
const loadForgotPassword = async (req, res) => {
    try {
        res.render('user/forgotPassword', { currentPage: 'forgot-password' });
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Server Error');
    }
};

const loadResetPassword = async (req, res) => {
    try {
        if (!req.session.resetEmail || !req.session.resetOtp) {
            return res.redirect('/forgot-password');
        }

        res.render('user/resetPassword', {
            currentPage: 'reset-password',
            message: req.session.resetMessage || ''
        });
        delete req.session.resetMessage;
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Server Error');
    }
};

const resendResetOtp = async (req, res) => {
    try {
        const email = req.session.resetEmail;
        if (!email) return res.redirect('/forgot-password');

        const result = await userService.resendPasswordResetOtp(email);
        if (!result.emailSent) {
            return res.status(500).render('user/resetPassword', {
                currentPage: 'reset-password',
                message: 'Failed to send OTP. Please try again later.'
            });
        }

        req.session.resetOtp = result.otp;
        req.session.resetOtpExpiry = Date.now() + 180000;
        req.session.resetMessage = 'A new OTP has been sent to your email.';
        return res.redirect('/reset-password');
    } catch (error) {
        console.log(error.message);
        return res.status(500).render('user/resetPassword', {
            currentPage: 'reset-password',
            message: 'Server error. Please try again later.'
        });
    }
};

// handling email submission & send OTP
const processForgotPassword = async (req, res) => {
    try {
        const result = await userService.requestPasswordReset(req.body.email);
        if (result.status === 'invalid') {
            return res.status(400).render('user/forgotPassword', {
                currentPage: 'forgot-password',
                fieldErrors: { email: result.message }
            });
        }
        if (result.status === 'notFound') {
            return res.render('user/forgotPassword', {
                currentPage: 'forgot-password',
                message: 'If the email is registered, an OTP has been sent.'
            });
        }

        if (result.status === 'sent') {
            req.session.resetEmail = result.email;
            req.session.resetOtp = result.otp;
            req.session.resetOtpExpiry = Date.now() + 180000;
            req.session.resetMessage = 'OTP sent successfully. Please check your email.';

            return res.redirect('/reset-password');
        }

        return res.render('user/forgotPassword', {
            currentPage: 'forgot-password',
            message: 'Failed to send OTP. Please try again later.'
        });
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Server Error');
    }
};

// verify Otp and update password in one step
const updatePassword = async (req, res) => {
    try {
        if (!req.session.resetEmail || !req.session.resetOtp) {
            return res.redirect('/forgot-password');
        }
        const result = await userService.resetUserPassword({
            email: req.session.resetEmail,
            otp: req.body.otp,
            expectedOtp: req.session.resetOtp,
            expiresAt: req.session.resetOtpExpiry,
            newPassword: req.body.newPassword,
            confirmPassword: req.body.confirmPassword
        });
        if (!result.success) {
            return res.render('user/resetPassword', {
                currentPage: 'reset-password',
                fieldErrors: result.errors
            });
        }

        // cleaning up the session variables
        delete req.session.resetEmail;
        delete req.session.resetOtp;
        delete req.session.resetOtpExpiry;

        // log the user them out before sending them back to login
        if (req.session.userId) {
            req.session.destroy((err) => {
                if (err) {
                    console.log('Session destroy error:', err.message);
                }
                return res.render('user/login', { currentPage: 'login', message: 'Password changed successfully. Please login.', messageType: 'success' });
            });
            return;
        }

        // Redirect to login page upon success
        req.session.message = 'Password changed successfully. Please login.';
        req.session.messageType = 'success';
        return res.redirect('/login');
    }catch(error){
        console.log(error.message);
        res.status(500).send('Server Error');
    }
}

const updateProfile = async (req, res) => {
    try {
        const userId = req.session.userId;
        const profileImage = req.file ? `/uploads/profile-pics/${req.file.filename}` : null;
        const result = await userService.updateUserProfile({ userId, data: req.body, profileImage });
        if (!result.success) {
            return res.status(result.statusCode).json({
                success: false,
                blocked: result.blocked,
                message: result.message || 'Please correct the errors below',
                errors: result.errors,
                formData: result.formData
            });
        }

        if (result.requireOtp) {
            req.session.pendingProfileUpdate = result.pendingProfileUpdate;
            req.session.profileOtp = result.otp;
            req.session.profileOtpExpiry = Date.now() + 180000;
            // Send JSON telling frontend to open OTP modal
            return res.json({ success: true, requireOtp: true, pendingEmail: result.pendingEmail });
        }

        // Send JSON telling frontend it was completely successful
        return res.json({ success: true, requireOtp: result.requireOtp });
    } catch (error) {
        console.error('Update profile error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// Render the Profile otp verification modal
const loadProfileOtpModal=async(req,res)=>{
    try{
        if(!req.session.pendingProfileUpdate) return res.redirect('/userProfile');
        return res.redirect('/userProfile?emailOtp=true');
    }catch(error){
        console.log(error.message);
        res.status(500).send('Server Error');
    }
};

const verifyProfileOtp = async (req, res) => {
    try {
        const result = await userService.verifyProfileEmailOtp({
            userId: req.session.userId,
            pendingData: req.session.pendingProfileUpdate,
            otp: req.body.otp,
            expectedOtp: req.session.profileOtp,
            expiresAt: req.session.profileOtpExpiry
        });
        if (!result.success) return res.status(result.statusCode).json({ success: false, message: result.message });
            delete req.session.pendingProfileUpdate;
            delete req.session.profileOtp;
            delete req.session.profileOtpExpiry;

            delete req.session.userId;
            req.session.message = 'Your email was updated. Please log in with your new email.';
            req.session.messageType = 'success';
            return res.json({ success: true, redirectUrl: '/login' });
    } catch (error) {
        console.error('Profile OTP verification error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const loadAddressPage = async (req, res)=>{
    try{
        if(!req.session.userId){
            return res.redirect('/login');
        }

        const { user, addresses } = await userService.getAddressPageData(req.session.userId);

        res.render('user/addressPage',{
            user,
            addresses,
            currentPage:'addresses'
        });
    }catch(error){
        console.log(error.message);
        res.status(500).send('Server Error');
    }
}

// Google authentication controller
const googleLogin = async (req,res) => {
    try{
        const result = await userService.authenticateGoogleUser(req.body.credential);
        if (!result.success) return res.status(result.statusCode).json({ success: false, message: result.message });

        //Log them in using your standard Express Session
        req.session.userId = result.user._id;

        return res.json({ success: true, message: 'Google Login successful!' });

    } catch (error) {
        console.error('Google Auth Error:', error.message);
        console.error('Full Error:', error);
        res.status(500).json({ success: false, message: `Google authentication failed: ${error.message}` });
    }
};

// Load the logged-in user's change-password page
const loadProfileResetPassword = async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.redirect('/login');
        }

        const user = await userService.getUserProfile(req.session.userId);
        if (!user) {
            return req.session.destroy(() => res.redirect('/login'));
        }

        return res.render('user/profileResetPassword', {
            currentPage: 'profile-reset-password'
        });
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Server Error');
    }
};

// Change password for a logged-in user
const updateProfilePassword = async (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ success: false, message: 'Please log in first.' });
        const result = await userService.changeUserPassword({ ...req.body, userId: req.session.userId });
        if (!result.success) {
            if (result.errors) {
                return res.status(result.statusCode).json({ success: false, message: 'Please correct the errors below', errors: result.errors, formData: result.formData });
            }
            return res.status(result.statusCode).json({ success: false, message: result.message });
        }

        req.session.message = 'Password changed !';
        return res.json({ success: true, message: result.message, redirectUrl: '/userProfile' });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

module.exports = {
    loadLogin,
    registerUser,
    loadOtpPage,
    verifyOtp,
    resendOtp,
    loginUser,
    logout,
    loadForgotPassword,
    processForgotPassword,
    loadResetPassword,
    resendResetOtp,
    updatePassword,
    loadProfile,
    updateProfile,
    loadProfileOtpModal,
    verifyProfileOtp,
    loadProfileResetPassword,
    updateProfilePassword,
    loadAddressPage,
    googleLogin
};

