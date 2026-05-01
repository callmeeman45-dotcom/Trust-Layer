const mongoose=require('mongoose');
const ProductSchema=new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    price:{     
        type:Number,
        required:true
    },
    description:{
        type:String,
        required:true
    },
    batchNumber: {
               type: "string",
            },
    manufacturingDate: {
            type: "date",
            },
    expiryDate: {
               type: "date",
            },
    status: {
               type: "string",
               enum: ["Genuine", "Counterfeit"],
               default: "Genuine",
            },
     Createdat: {
               type: Date,
               default: Date.now,
            },
     Updatedat: {
               type: Date,  
               default: Date.now,
            },
            image: {
               type: String,
            },
          
            
            brandname:{
                type: String,
                required:true,
            },
            qrCodeUrl: {
               type: String,
            },
            Recall:{
                enum:{
                    type: String,
                    enum: ["Recalled", "Not Recalled"],
                    default: "Not Recalled",
                }
            }
        });
module.exports=mongoose.model('Product',ProductSchema);      