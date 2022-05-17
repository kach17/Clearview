const mongoose = require('mongoose');
const {Schema} = mongoose;

const tagsSchema = new Schema({
    tag:{
        type:String
    }
})

module.exports = mongoose.model('tag',tagsSchema);