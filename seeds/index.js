const mongoose = require('mongoose');
const Blog = require('../models/blog');

mongoose.connect('mongodb://localhost:27017/blog-app', {useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on("error",console.error.bind(console,"console error:"));
db.once("open",()=>{
    console.log("Database connected");
})


const newBlog = async()=>{
    await Blog.deleteMany({});

    for(let i=0;i<10;i++){
        const newblog = new Blog({
            title:"New post",
            body:"this is my first blog post",
            description:"Awesome post"
        })
        await newblog.save();
    }
    
}

newBlog().then(()=>{
    mongoose.connection.close();
    console.log("connection closed")
})