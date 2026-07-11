const mongoose=require('mongoose');
const Product=require('./product');
const scanrecordSchema=new mongoose.Schema({
    productId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    scanDate:{
        type: Date,
        default: Date.now
    },
    location:{
        type: String,
        required: true
    },
    ipAddress:{
        type: String,
        required: true
    },
    deviceId:  
        { type: String, required: true },
    productstatus:{
        type:String,
        required:true
    },
    brandname:{
        type: String,
        required:true,
    }
});
const ScanRecord=mongoose.model('ScanRecord',scanrecordSchema);
module.exports=ScanRecord;