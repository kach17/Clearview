const User = require('./models/user');
const Blog = require('./models/blog');

module.exports.isLoggedIn =  (req,res,next) => {
    if(!req.isAuthenticated()){
        req.session.returnTo = req.originalUrl;
        req.flash('error','You must be logged in');
        return res.redirect('/user/login');
    }
    next();
}

module.exports.isAuthor = async (req,res,next) => {
    const {blogId} = req.params;
    const blog = await Blog.findById(blogId);
    if(!blog.author.equals(req.user._id)){
        req.flash('error','You do not have permission');
        return res.redirect('/home');
    }
    next();
}