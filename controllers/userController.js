const User = require('../models/user');
const bcrypt = require('bcrypt');
const { sendOtpEmail } = require('../services/emailServices');
const Address= require('../models/addressModel');
const { OAuth2Client } = require('google-auth-library');
const { validateName, validateEmail, validatePhone, validatePassword, validateDateOfBirth } = require('../validators/userValidators');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


// Rendering login page
const loadLogin = async (req, res) => {
    try {
        // If user is already logged in, redirect them to profile
        if (req.session.userId) {
            return res.redirect('/userProfile');
        }

        const message = req.session.message || null;
        const messageType = req.session.messageType || 'error';
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

        const user = await User.findById(req.session.userId).lean();
        if (!user) {
            req.session.destroy(() => res.redirect('/login'));
            return;
        }

        const showOtpVerification = req.query.emailOtp === 'true';
        const pendingEmail = req.session.pendingProfileUpdate ? req.session.pendingProfileUpdate.email : null;
        const message = req.session.message || null;
        delete req.session.message;

        res.render('user/userProfile', {
            user,
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

// Generate a random 6-digit OTP
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// Handle the registeration form submission
const registerUser = async (req, res) => {
    try {
        const { name, email, password, confirmPassword, phone, gender, dateOfBirth, consent } = req.body;
        const trimmedName = name ? name.trim() : '';
        const trimmedEmail = email ? email.trim().toLowerCase() : '';
        const trimmedPassword = password ? password.trim() : '';
        const trimmedConfirmPassword = confirmPassword ? confirmPassword.trim() : '';
        const rawPhone = phone ? phone.trim() : '';
        const sanitizedPhone = rawPhone.replace(/\s+/g, '').replace(/^\+91/, '');
        const normalizedPhone = '+91 ' + sanitizedPhone;
        const errors = {};
        const fieldErrors = { name: validateName(trimmedName, 'Full Name'), email: validateEmail(trimmedEmail), phone: validatePhone(rawPhone), dateOfBirth: validateDateOfBirth(dateOfBirth), password: validatePassword(trimmedPassword) };
        Object.keys(fieldErrors).forEach((field) => { if (fieldErrors[field]) errors[field] = fieldErrors[field]; });
        if (!gender || !['male', 'female', 'other', 'Male', 'Female', 'Other'].includes(gender)) errors.gender = 'Please select a valid gender';
        if (!trimmedConfirmPassword) errors.confirmPassword = 'Confirm Password is required';
        else if (trimmedPassword !== trimmedConfirmPassword) errors.confirmPassword = 'Passwords do not match';

        if (!consent || consent !== 'on') {
            errors.consent = 'You must agree to the Privacy Policy and Terms of Service';
        }
                                                    
        // If there are validation errors, return them
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                errors: errors,
                formData: {
                    name: trimmedName,
                    email: trimmedEmail,
                    phone: rawPhone,
                    gender: gender,
                    dateOfBirth: dateOfBirth
                }
            });
        }

        // Check if user already exists by email
        const emailExists = await User.findOne({ email: trimmedEmail });
        if (emailExists) {
            return res.json({
                success: false,
                errors: { email: 'Email already registered' },
                formData: {
                    name: trimmedName,
                    email: trimmedEmail,
                    phone: rawPhone,
                    gender: gender,
                    dateOfBirth: dateOfBirth
                }
            });
        }

        // Check if phone already exists
        const phoneExists = await User.findOne({ phone: normalizedPhone });
        if (phoneExists) {
            return res.json({
                success: false,
                errors: { phone: 'This phone number is already registered' },
                formData: {
                    name: trimmedName,
                    email: trimmedEmail,
                    phone: rawPhone,
                    gender: gender,
                    dateOfBirth: dateOfBirth
                }
            });
        }

        // Hash the password
        const securePassword = await bcrypt.hash(trimmedPassword, 10);

        // Generate OTP
        const otp = generateOtp();

        // Send the OTP via Email
        const emailSent = await sendOtpEmail(trimmedEmail, otp);

        if (!emailSent) {
            return res.json({
                success: false,
                errors: { form: 'Failed to send OTP. Please try again.' },
                formData: {
                    name: trimmedName,
                    email: trimmedEmail,
                    phone: rawPhone,
                    gender: gender,
                    dateOfBirth: dateOfBirth
                }
            });
        }

        // Store user data and OTP in session
        req.session.userData = {
            name: trimmedName,
            email: trimmedEmail,
            phone: normalizedPhone,
            password: securePassword,
            gender,
            dateOfBirth
        };
        req.session.otp = otp;
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
        const { otp } = req.body;
        const sessionOtp = req.session.otp;
        const sessionOtpExpiry = req.session.otpExpiry;
        const userData = req.session.userData;

        // 1. Check if the session data still exists
        if (!sessionOtp || !userData) {
            if (wantsJson) return res.json({ success: false, message: 'Session expired. Please sign up again.' });
            return res.render('user/otpVerification', { message: 'Session expired. Please sign up again.', currentPage: 'otp' });
        }

        // 2. Check if the OTP has expired
        if (Date.now() > sessionOtpExpiry) {
            if (wantsJson) return res.json({ success: false, message: 'OTP has expired. Please try again.' });
            return res.render('user/otpVerification', { message: 'OTP has expired. Please try again.', currentPage: 'otp' });
        }

        // 3. Verify the OTP matches
        if (otp === sessionOtp) {
            // Save the user to MongoDB
            const newUser = new User({
                name: userData.name,
                email: userData.email,
                phone: userData.phone || '',
                password: userData.password, // This was hashed in the previous step
                gender: userData.gender,
                dateOfBirth: userData.dateOfBirth,
                role: 'user', 
                isBlocked: false
            });

            await newUser.save();

            // Clear temporary OTP data from the session
            delete req.session.otp;
            delete req.session.otpExpiry;
            delete req.session.userData;

            // Automatically log the user in using express-session
            req.session.userId = newUser._id;

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
        } else {
            if (wantsJson) return res.json({ success: false, message: 'Invalid OTP. Please try again.' });
            return res.render('user/otpVerification', { message: 'Invalid OTP. Please try again.', currentPage: 'otp' });
        }

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

        // Generate a new OTP and expiry
        const newOtp = generateOtp();
        req.session.otp = newOtp;
        req.session.otpExpiry = Date.now() + 180000; // Reset the 3-minute timer

        // Send the new OTP
        const emailSent = await sendOtpEmail(userData.email, newOtp);

        if (emailSent) {
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
        const { email, password } = req.body;

        // 1. Find the user by email
        const user = await User.findOne({ email });

        if (!user) {
            return res.render('user/login', { message: 'Invalid email or password', currentPage: 'login' });
        }

        // 2. Business Rule: Prevent blocked users from logging in
        if (user.isBlocked) {
            return res.render('user/login', { message: 'Your account has been blocked by the administrator.', currentPage: 'login' });
        }

        // 3. Handle users who signed up exclusively with Google (no password)
        if (!user.password) {
            return res.render('user/login', { message: 'Please log in using Google.', currentPage: 'login' });
        }

        // 4. Compare the entered password with the hashed password in MongoDB
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (passwordMatch) {
            // 5. Set the session and redirect
            req.session.userId = user._id;
            return res.redirect('/userProfile');
        } else {
            return res.render('user/login', { message: 'Invalid email or password', currentPage: 'login' });
        }

    } catch (error) {
        console.log(error.message);
        res.status(500).send('Server Error');
    }
};

const logout=async (req, res) => {
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

        const otp = generateOtp();
        const emailSent = await sendOtpEmail(email, otp);
        if (!emailSent) {
            return res.status(500).render('user/resetPassword', {
                currentPage: 'reset-password',
                message: 'Failed to send OTP. Please try again later.'
            });
        }

        req.session.resetOtp = otp;
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
        const email = String(req.body.email || '').trim().toLowerCase();
        const emailError = validateEmail(email);
        if (emailError) {
            return res.status(400).render('user/forgotPassword', {
                currentPage: 'forgot-password',
                message: emailError
            });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.render('user/forgotPassword', {
                currentPage: 'forgot-password',
                message: 'If the email is registered, an OTP has been sent.'
            });
        }

        const otp = generateOtp();
        const emailSent = await sendOtpEmail(email, otp);

        if (emailSent) {
            req.session.resetEmail = email;
            req.session.resetOtp = otp;
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
        const { otp, newPassword, confirmPassword } = req.body;

        if (!req.session.resetEmail || !req.session.resetOtp) {
            return res.redirect('/forgot-password');
        }

        const passwordError = validatePassword(newPassword, 'New password');
        if (passwordError) {
            return res.render('user/resetPassword', { currentPage: 'reset-password', message: passwordError });
        }

        if (newPassword !== confirmPassword) {
            return res.render('user/resetPassword', {
                currentPage: 'reset-password',
                message: 'Password do not match.'
            });
        }

        if (Date.now() > req.session.resetOtpExpiry) {
            return res.render('user/resetPassword', {
                currentPage: 'reset-password',
                message: 'OTP expired. Please request a new one.'
            });
        }

        if (otp !== req.session.resetOtp) {
            return res.render('user/resetPassword', {
                currentPage: 'reset-password',
                message: 'Invalid OTP. Please try again.'
            });
        }

        const securePassword = await bcrypt.hash(newPassword, 10);

        await User.updateOne(
            {email:req.session.resetEmail},
            {$set:{password:securePassword}}
        );

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

// For submitting updated profile data
const validateProfileUpdate = (data) => {
    const errors = {};
    const fieldErrors = {
        name: validateName(data.name, 'Username'),
        email: validateEmail(data.email),
        phone: validatePhone(data.phone),
        dateOfBirth: validateDateOfBirth(data.dateOfBirth)
    };
    Object.keys(fieldErrors).forEach((field) => { if (fieldErrors[field]) errors[field] = fieldErrors[field]; });
    if (!['Male', 'Female', 'Other', 'male', 'female', 'other'].includes(data.gender)) errors.gender = 'Please select a valid gender';
    return errors;
};

const updateProfile = async (req, res) => {
    try {
        const userId = req.session.userId;
        const { name, email, phone, gender, dateOfBirth } = req.body;
        const profileImage = req.file ? `/uploads/profile-pics/${req.file.filename}` : null;

        const user = await User.findById(userId);
        if (!user) return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });

        // Validate profile data
        const errors = validateProfileUpdate({ name, email, phone, gender, dateOfBirth });
        
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please correct the errors below',
                errors,
                formData: { name, email, phone, gender, dateOfBirth }
            });
        }

        const normalizedEmail = email ? email.trim() : '';
        const normalizedPhone = phone ? phone.trim() : '';

        const updateData = {
            name: name.trim(),
            email: normalizedEmail,
            phone: normalizedPhone,
            gender,
            dateOfBirth
        };

        if (profileImage) {
            updateData.profile_image = profileImage;
        }

        if (normalizedEmail && normalizedEmail !== user.email) {
            const emailExists = await User.findOne({ email: normalizedEmail });
            if (emailExists) {
                return res.status(400).json({ success: false, message: 'Email is already in use' });
            }

            const otp = generateOtp();
            const emailSent = await sendOtpEmail(normalizedEmail, otp);

            if (!emailSent) {
                return res.status(500).json({ success: false, message: 'Failed to send OTP' });
            }

            req.session.pendingProfileUpdate = {
                ...updateData,
                profile_image: profileImage || user.profile_image
            };
            req.session.profileOtp = otp;
            req.session.profileOtpExpiry = Date.now() + 180000;

            // Send JSON telling frontend to open OTP modal
            return res.json({ success: true, requireOtp: true, pendingEmail: normalizedEmail });
        }

        await User.findByIdAndUpdate(userId, updateData);

        // Send JSON telling frontend it was completely successful
        return res.json({ success: true, requireOtp: false });
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
        const { otp } = req.body;
        const pendingData = req.session.pendingProfileUpdate;

        if (!pendingData || !req.session.profileOtp) {
            return res.status(400).json({ success: false, message: 'Session expired. Please try editing again.' });
        }

        if (Date.now() > req.session.profileOtpExpiry) {
            return res.status(400).json({ success: false, message: 'OTP expired. Please try editing again.' });
        }

        if (otp === req.session.profileOtp) {
            const userId = req.session.userId;

            await User.findByIdAndUpdate(userId, {
                name: pendingData.name,
                email: pendingData.email,
                phone: pendingData.phone,
                gender: pendingData.gender,
                dateOfBirth: pendingData.dateOfBirth,
                profile_image: pendingData.profile_image || undefined
            });

            delete req.session.pendingProfileUpdate;
            delete req.session.profileOtp;
            delete req.session.profileOtpExpiry;

            delete req.session.userId;
            req.session.message = 'Your email was updated. Please log in with your new email.';
            req.session.messageType = 'success';
            return res.json({ success: true, redirectUrl: '/login' });
        } else {
            return res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
        }
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

        // fetching user and address
        const user = await User.findById(req.session.userId).lean();
        const addresses = await Address.find({ userId: req.session.userId }).lean();
        addresses.forEach((address) => {
            address.addressType = address.addressType || 'Home';
        });

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
        // The token send from the frontend fetch request
        const { credential } = req.body;

        if(!credential){
            return res.status(400).json({ success: false, message: 'No credential provided'})
        }

        // Verifying token with google
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        // Extract user info from Google's verified payload
        const payload = ticket.getPayload();
        const { email, name, sub: googleId } = payload;

        // check if the user already exist
        let user = await User.findOne({ email });

        if (user){
            // Checking if the user is blocked, the deny entry
            if(user.isBlocked){
                return res.status(403).json({ success: false, message:'Your account has been blocked'});
            }

            // If they previously signed up manually link thier new google id
            if(!user.googleId){
                user.googleId = googleId;
                await user.save();
            }
        } else {
            // If there is a new user, create their account
            user = new User({
                name: name,
                email: email,
                googleId: googleId,
            });
            await user.save();
        }

        //Log them in using your standard Express Session
        req.session.userId = user._id;

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

        const user = await User.findById(req.session.userId).lean();
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
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const errors = {};

        if (!req.session.userId) return res.status(401).json({ success: false, message: 'Please log in first.' });
        if (!currentPassword || !currentPassword.trim()) errors.currentPassword = 'Current password is required';

        const passwordError = validatePassword(newPassword, 'New password');
        if (passwordError) errors.newPassword = passwordError;

        if (!confirmPassword || !confirmPassword.trim()) {
            errors.confirmPassword = 'Confirm password is required';
        } else if (newPassword !== confirmPassword) {
            errors.confirmPassword = 'Passwords do not match.';
        }

        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Please correct the errors below',
                errors,
                formData: { currentPassword, newPassword, confirmPassword }
            });
        }

        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(401).json({ success: false, message: 'Please log in again.' });
        }

        const currentPasswordMatches = await bcrypt.compare(currentPassword, user.password);
        if (!currentPasswordMatches) {
            return res.status(400).json({
                success: false,
                message: 'Please correct the errors below',
                errors: { currentPassword: 'Current password is incorrect' },
                formData: { currentPassword, newPassword, confirmPassword }
            });
        }

        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            return res.status(400).json({
                success: false,
                message: 'Please correct the errors below',
                errors: { newPassword: 'Enter a new password' },
                formData: { currentPassword, newPassword, confirmPassword }
            });
        }

        const securePassword = await bcrypt.hash(newPassword, 10);

        await User.updateOne(
            { _id: req.session.userId },
            { $set: { password: securePassword } }
        );

        req.session.message = 'Password changed !';
        return res.json({ success: true, message: 'Password changed !', redirectUrl: '/userProfile' });
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

