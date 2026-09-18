const mongoose = require ('mongoose');

const productSchema = new mongoose.Schema({
    productName : { type:String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand' },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref:'Category', required: true },
    regularPrice: { type: Number, required: true, min: 0},
    salePrice: { type: Number, default:0, min: 0},
    offerPercentage : { type: Number, default: 0},
    availableStock: { type: Number, required: true, min: 0},
    images: {
        type: [String],
        required: true,
        validate: [arrayLimit, 'A minimum of 3 images is required']
    },

    variants : [{
        name: { type: String},
        price: { type: Number},
        status : { type: String, Enum: ['In Stock','Low Stock','Out of Stock']},
    }],

    highlights: [{
        title: { type: String, trim: true }
    }],

    status:{
        type: String,
        enum:['Active', 'Out of Stock', 'Low Stock'],
        default:'Active'
    }
},{ timestamps: true});

function arrayLimit(val){
    return val.length >= 3 ;
}

module.exports = mongoose.model('Product',productSchema);
