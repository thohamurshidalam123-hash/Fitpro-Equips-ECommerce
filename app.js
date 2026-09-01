const express = require('express');
const session = require('express-session');
const path = require('path');
const passport = require('passport');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

//Set up the View Engine (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

//Body Parsing Middleware (to read form data and JSON)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//Static Files (CSS, JS, frontend images, and user uploads)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

//Session Configuration (Crucial since we are NOT using JWT)
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // true if on HTTPS
        httpOnly: true, // Prevents attacks
        maxAge: 1000 * 60 * 60 * 24 // 1 day session
    }
}));


app.use(passport.initialize());
app.use('/', userRoutes);
app.use('/admin',adminRoutes)


module.exports = app;