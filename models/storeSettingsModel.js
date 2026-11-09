const mongoose = require('mongoose');

const storeSettingsSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true, default: 'global' },
    storeName: { type: String, required: true, default: 'Fitpro Equips' },
    supportPhone: { type: String, required: true, default: '+91 6238833963' },
    supportEmail: { type: String, required: true, default: 'fitproequips.test1@gmail.com' },
    shippingCharge: { type: Number, required: true, default: 500, min: 0 },
    freeShippingThreshold: { type: Number, required: true, default: 5000, min: 0 }
}, { timestamps: true });

module.exports = mongoose.model('StoreSettings', storeSettingsSchema);