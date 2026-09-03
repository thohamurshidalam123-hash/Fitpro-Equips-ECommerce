const User = require('../models/user');
const bcrypt = require('bcrypt');
const { sendOtpEmail } = require('../services/emailServices');
const Address= require('../models/addressModel');
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


// Render the login page
const loadLogin = async (req, res) => {
    try {
        // If user is already logged in, redirect them to profile
        if (req.session.userId) {
            return res.redirect('/userProfile');
        }

        const message = req.query.message || null;
        return res.render('user/login', { currentPage: 'login', message });
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

        res.render('user/userProfile', {
            user,
            currentPage: 'profile',
            showOtpVerification,
            pendingEmail
        });
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Server Error');
    }
};

// Generate a random 6-digit OTP
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// Handle the signup form submission
const registerUser = async (req, res) => {
    try {
        const { name, email, password, confirmPassword, phone, gender, dateOfBirth, consent } = req.body;
        const trimmedName = name ? name.trim() : '';
        const trimmedEmail = email ? email.trim() : '';
        const trimmedPassword = password ? password.trim() : '';
        const trimmedConfirmPassword = confirmPassword ? confirmPassword.trim() : '';
        const rawPhone = phone ? phone.trim() : '';
        const sanitizedPhone = rawPhone.replace(/\s+/g, '').replace(/^\+91/, '');
        const normalizedPhone = '+91 ' + sanitizedPhone;
        const phonePattern = /^\+91\s?[6-9]\d{9}$/;
        const emailPattern = /^[^\s@]+@gmail\.com$/i;
        const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

        const errors = {};

        // Validate all fields
        if (!trimmedName) {
            errors.name = 'Full Name is required';
        }

        if (!trimmedEmail) {
            errors.email = 'Email Address is required';
        } else if (!emailPattern.test(trimmedEmail)) {
            errors.email = 'Please enter a valid Gmail address (example: name@gmail.com)';
        }

        if (!rawPhone) {
            errors.phone = 'Phone Number is required';
        } else if (!sanitizedPhone || !/^[6-9]\d{9}$/.test(sanitizedPhone)) {
            errors.phone = 'Please enter a valid Indian mobile number';
        }

        if (!dateOfBirth) {
            errors.dateOfBirth = 'Date of Birth is required';
        }

        if (!gender) {
            errors.gender = 'Gender is required';
        }

        if (!trimmedPassword) {
            errors.password = 'Password is required';
        } else if (!passwordPattern.test(trimmedPassword)) {
            errors.password = 'Password must be at least 8 characters long and include uppercase, lowercase, and a number';
        }

        if (!trimmedConfirmPassword) {
            errors.confirmPassword = 'Confirm Password is required';
        } else if (trimmedPassword !== trimmedConfirmPassword) {
            errors.confirmPassword = 'Passwords do not match';
        }

        if (!consent || consent !== 'on') {
            errors.consent = 'You must agree to the Privacy Policy and Terms of Service';
        }

        // If there are validation errors, return them
        if (Object.keys(errors).length > 0) {
            return res.json({
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
            message: 'OTP sent to your email. Please verify to complete registration.',
            redirectUrl: '/verify-otp'
        });

    } catch (error) {
        console.log(error.message);
        return res.json({
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
            message: ''
        });
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Server Error');
    }
};

// handling email submission & send OTP
const processForgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
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
                return res.redirect('/login?message=' + encodeURIComponent('Password changed successfully. Please login.'));
            });
            return;
        }

        // Redirect to login page upon success
        return res.redirect('/login?message=' + encodeURIComponent('Password changed successfully. Please login.'));
    }catch(error){
        console.log(error.message);
        res.status(500).send('Server Error');
    }
}

// For submitting updated profile data
const validateProfileUpdate = (data) => {
    const errors = {};
    
    // Name validation
    if (!data.name || !data.name.trim()) {
        errors.name = 'Username is required';
    } else if (data.name.trim().length < 2) {
        errors.name = 'Username must be at least 2 characters long';
    } else if (data.name.trim().length > 50) {
        errors.name = 'Username cannot exceed 50 characters';
    } else if (!/^[a-zA-Z\s]+$/.test(data.name.trim())) {
        errors.name = 'Username can only contain letters and spaces';
    }
    
    // Email validation
    if (!data.email || !data.email.trim()) {
        errors.email = 'Email is required';
    } else {
        const emailPattern = /^[^\s@]+@gmail\.com$/i;
        if (!emailPattern.test(data.email.trim())) {
            errors.email = 'Please enter a valid Gmail address (example: name@gmail.com)';
        }
    }
    
    // Phone validation
    if (!data.phone || !data.phone.trim()) {
        errors.phone = 'Phone Number is required';
    } else {
        const sanitizedPhone = data.phone.trim().replace(/\s+/g, '').replace(/^\+91/, '');
        if (!/^[6-9]\d{9}$/.test(sanitizedPhone)) {
            errors.phone = 'Please enter a valid Indian mobile number (e.g., 98765 43210)';
        }
    }
    
    // Gender validation
    if (!data.gender || !['Male', 'Female', 'Other'].includes(data.gender)) {
        errors.gender = 'Please select a valid gender';
    }
    
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
        const errors = validateProfileUpdate({ name, email, phone, gender });
        
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

            req.session.destroy((err) => {
                if (err) {
                    console.log('Session destroy error:', err.message);
                }
                // Send JSON telling frontend to redirect the user to login
                const redirectUrl = '/login?message=' + encodeURIComponent('Your email was updated. Please log in with your new email.');
                return res.json({ success: true, redirectUrl });
            });
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

// Load profile reset password page - sends OTP automatically
const loadProfileResetPassword = async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.redirect('/login');
        }

        const user = await User.findById(req.session.userId).lean();
        if (!user) {
            req.session.destroy(() => res.redirect('/login'));
            return;
        }

        const otp = generateOtp();
        const emailSent = await sendOtpEmail(user.email, otp);

        if (!emailSent) {
            return res.render('user/profileResetPassword', {
                currentPage: 'profile-reset-password',
                message: 'Failed to send OTP. Please try again later.',
                userEmail: user.email,
                otpSent: false
            });
        }

        req.session.profileResetEmail = user.email;
        req.session.profileResetOtp = otp;
        req.session.profileResetOtpExpiry = Date.now() + 180000;

        return res.render('user/profileResetPassword', {
            currentPage: 'profile-reset-password',
            message: `OTP sent to your ${user.email}`,
            userEmail: user.email,
            otpSent: true
        });
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Server Error');
    }
};

// Update password from profile reset
const updateProfilePassword = async (req, res) => {
    try {
        const { otp, newPassword, confirmPassword } = req.body;
        const errors = {};

        if (!req.session.profileResetEmail || !req.session.profileResetOtp) {
            return res.status(400).json({ success: false, message: 'Session expired. Please try again.' });
        }

        if (!otp || !otp.trim()) {
            errors.otp = 'OTP is required';
        } else if (otp !== req.session.profileResetOtp) {
            errors.otp = 'Invalid OTP. Please try again.';
        }

        if (!newPassword || !newPassword.trim()) {
            errors.newPassword = 'New password is required';
        } else if (newPassword.trim().length < 8) {
            errors.newPassword = 'Password must be at least 8 characters long';
        }

        if (!confirmPassword || !confirmPassword.trim()) {
            errors.confirmPassword = 'Confirm password is required';
        } else if (newPassword !== confirmPassword) {
            errors.confirmPassword = 'Passwords do not match.';
        }

        if (Date.now() > req.session.profileResetOtpExpiry) {
            errors.otp = 'OTP expired. Please request a new one.';
        }

        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Please correct the errors below',
                errors,
                formData: { otp, newPassword, confirmPassword }
            });
        }

        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(400).json({ success: false, message: 'User not found.' });
        }

        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            return res.status(400).json({
                success: false,
                message: 'Please correct the errors below',
                errors: { newPassword: 'Enter a new password' },
                formData: { otp, newPassword, confirmPassword }
            });
        }

        const securePassword = await bcrypt.hash(newPassword, 10);

        await User.updateOne(
            { _id: req.session.userId },
            { $set: { password: securePassword } }
        );

        // Clean up session variables
        delete req.session.profileResetEmail;
        delete req.session.profileResetOtp;
        delete req.session.profileResetOtpExpiry;

        // Destroy session and return success JSON
        req.session.destroy((err) => {
            if (err) {
                console.log('Session destroy error:', err.message);
            }
        });

        return res.json({ success: true, message: 'Password changed successfully.' });
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

