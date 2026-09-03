const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    email: { 
        type: String, 
        required: true, 
        unique: true  
    },
    phone: { 
        type: String,
        unique: true,
        sparse: true
    },
    password: { 
        type: String, 
        required: function() { return !this.googleId; }
    },
    gender: { 
        type: String,
        required:function() { return !this.googleId; }
    },
    dateOfBirth: { 
        type: Date,
        required: function() { return !this.googleId; }
    },
    isBlocked: { 
        type: Boolean, 
        default: false 
    },
    role: { 
        type: String, 
        enum: ['user', 'admin'], 
        default: 'user' 
    },
    lastLogin: { 
        type: String
    },
    profile_image: { 
        type: String
    },
    googleId: { 
        type: String,
        sparse: true 
    }
}, { 
    timestamps: true
});

module.exports = mongoose.model('User', userSchema);