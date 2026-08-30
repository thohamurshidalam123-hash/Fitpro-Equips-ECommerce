const express = require('express');
const session = require('express-session');
const path = require('path');
const passport = require('passport');
const userRoutes = require('./routes/userRoutes');

const app = express();

// 1. Set up the View Engine (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 2. Body Parsing Middleware (to read form data and JSON)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Static Files (CSS, JS, frontend images, and user uploads)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 4. Session Configuration (Crucial since we are NOT using JWT)
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // true if on HTTPS
        httpOnly: true, // Prevents XSS attacks
        maxAge: 1000 * 60 * 60 * 24 // 1 day session
    }
}));
app.use(passport.initialize());
app.use('/', userRoutes);
module.exports = app;