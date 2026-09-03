const express = require('express');
const session = require('express-session');
const path = require('path');
const passport = require('passport');
const User = require('./models/user');
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

//Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret_key',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // true if on HTTPS
        httpOnly: true, // Prevents attacks
        maxAge: 1000 * 60 * 60 * 24 // 1 day session
    }
}));


app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
    });
    next();
});

// Reject blocked users before serving any user-side route.
app.use(async (req, res, next) => {
    if (!req.session.userId || req.path.startsWith('/admin')) return next();

    try {
        const user = await User.findById(req.session.userId).select('isBlocked');

        if (!user || user.isBlocked) {
            return req.session.destroy(() => {
                res.redirect('/login?message=' + encodeURIComponent('Account is blocked'));
            });
        }

        next();
    } catch (error) {
        console.error('User session check error:', error.message);
        res.status(500).send('Server Error');
    }
});

app.use('/', userRoutes);
app.use('/admin',adminRoutes)


module.exports = app;