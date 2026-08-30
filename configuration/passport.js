const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/user');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
}, async (profile, done) => {
    try {
        // 1. Check if user already exists
        let user = await User.findOne({ googleId: profile.id });
        
        if (!user) {
            // 2. Create new user if they don't exist
            user = new User({
                name: profile.displayName,
                email: profile.emails[0].value,
                googleId: profile.id,
                authProvider: 'google',
                role: 'user',
                status: 'active'
                // Note: phone, gender, and dateOfBirth are missing here.
            });
            // Bypass strict validation temporarily since Google doesn't provide phone/DOB
            await user.save({ validateBeforeSave: false }); 
        }
        return done(null, user);
    } catch (error) {
        return done(error, false);
    }
}));