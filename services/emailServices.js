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
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: toEmail,
            subject: 'Fitpro Equips - OTP Verification',
            text: `Welcome to Fitpro Equips! Your OTP for registration is: ${otp}. Do not share this with anyone.`
        };

        await transporter.sendMail(mailOptions);
        console.log(`OTP sent successfully to ${toEmail}`);
        return true;
    } catch (error) {
        console.error('Error sending OTP email:', error.message);
        return false;
    }
};

module.exports = {
    sendOtpEmail
};