const mongoose = require('mongoose');
const {Schema} = mongoose;
const passportLocalMongoose = require('passport-local-mongoose');


const userSchema = new Schema({
    email:{
        type:String, 
        require:true,
        unique:true
    },
    followers:{
        type:[Schema.Types.ObjectId],
        ref:'User'
    },
    following:{
        type:[Schema.Types.ObjectId],
        ref:'User'
    }
});

//username and emailId are added by passport;

userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model('User',userSchema);