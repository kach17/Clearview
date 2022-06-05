const mongoose = require('mongoose');
const {Schema} = mongoose;

const tagsSchema = new Schema({
    tag:{
        type:String,
        unique: false
    }
})

module.exports = mongoose.model('tag',tagsSchema);