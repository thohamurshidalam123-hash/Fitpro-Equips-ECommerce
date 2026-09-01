const User = require('../models/user');
const bcrypt = require('bcrypt');

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

const loadForgotPassword = async (req,res) => {

    if()
}

module.exports = {
    loadLogin,
    adminLogin,
    adminLogout,
    loadDashboard
}