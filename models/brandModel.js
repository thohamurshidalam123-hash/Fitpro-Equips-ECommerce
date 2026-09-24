const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
    slug: { type: String, unique: true, trim: true },
    description: { type: String, required: true, trim: true, maxlength: 250 },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    logo: { type: String, default: '' },
    featured: { type: Boolean, default: false },
    status: { type: String, enum: ['Active', 'Disabled'], default: 'Active' }
}, { timestamps: true });

module.exports = mongoose.model('Brand', brandSchema);
