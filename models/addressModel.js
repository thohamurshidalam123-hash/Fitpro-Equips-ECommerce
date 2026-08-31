const mongoose = require ('mongoose');

const addressSchema = new mongoose.Schema({
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        ref:'User',
        required:true
    },
    fullName:{type:String,required:true},
    phone:{type:String,required:true},
    houseName:{type:String,required:true},
    street:{type:String,required:true},
    city:{type:String,required:true},
    district:{type:String,required:true},
    state:{type:String,required:true},
    pincode:{type:String,required:true},
    landmark:{type:String},
    addressType:{
        type:String,
        enum:['Home','Work','Other'],
        default:'Home'
    },
    isDefault:{type:Boolean,default:false}
},{timestamps:true});

module.exports = mongoose.model('Address', addressSchema);