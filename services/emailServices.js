const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config();

// Configure the email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Reusable function to send OTP
const sendOtpEmail = async (toEmail, otp) => {
    try {
        const { storeName } = await require('./settingsService').getSettings();
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: toEmail,
            subject: `${storeName} - OTP Verification`,
            text: `Welcome to ${storeName}! Your OTP for registration is: ${otp}. Do not share this with anyone.`
        };

        await transporter.sendMail(mailOptions);
        console.log(`OTP sent successfully to ${toEmail}`);
        return true;
    } catch (error) {
        console.error('Error sending OTP email:', error.message);
        return false;
    }
};

const sendAdminEmailChangeOtp = async (toEmail, otp) => {
    try {
        const { storeName } = await require('./settingsService').getSettings();
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: toEmail,
            subject: `${storeName} - Admin Email Change OTP`,
            text: `Your OTP to change the ${storeName} admin email is ${otp}. It expires in 3 minutes. Do not share it with anyone.`
        });
        return true;
    } catch (error) {
        console.error('Error sending admin email change OTP:', error.message);
        return false;
    }
};

module.exports = {
    sendOtpEmail,
    sendAdminEmailChangeOtp
};