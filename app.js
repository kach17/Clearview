require('dotenv').config('session');
const express = require('express');
const app = express();
const path = require('path');
const ejsMate = require('ejs-mate')
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('passport');
const multer = require('multer')
const cloudinary = require('cloudinary').v2;
const { storage } = require('./cloudinary/index')
const upload = multer({ storage })
const localStrategy = require('passport-local').Strategy;
const methodOverride = require('method-override')
const { isLoggedIn, isAuthor } = require('./middleware')
const User = require('./models/user')
const Blog = require('./models/blog');
const Tag = require('./models/tags');
const dbUrl = "mongodb+srv://" + process.env.dbUrl ;;
const SECRET = process.env.SECRET
const MongoDBStore = require('connect-mongo');
const moment = require("moment");
app.locals.moment = require('moment');



mongoose.connect(dbUrl, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true });
const db = mongoose.connection;
db.on("error", console.error.bind(console, "console error:"));
db.once("open", () => {
    console.log("Database connected");
})

app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser())
app.use(methodOverride('_method'));

app.use(session({
    store: MongoDBStore.create({ mongoUrl: dbUrl }),
    name: 'sessionAuth',
    secret: SECRET,
    resave: 'false',
    touchAfter: 24 * 60 * 60,
    saveUninitialized: true,
    cookie: {
        httpOnly: true
    }
}))
app.use(flash());


//passport middlewares
app.use(passport.initialize());
app.use(passport.session());

passport.use(new localStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.currentUser = req.user;
    next();
})

app.get('/', (req, res) => {
    res.redirect('/home');
})

//home page
app.get('/home', async (req, res) => {
    const isLoggedIn = (req.user === undefined ? false : true);

    if (isLoggedIn) {
        const { following } = await User.findById(req.user._id);
        const blogs = await Blog.find({ author: { $in: following } }).populate('author').sort('-createdAt');
        const tags = await Tag.find({});
        res.render('blog/home', { blogs, tags, global: false, tag: false})
    } else {
        res.redirect('/global');
    }
})

//global
app.get('/global', async (req, res) => {
    const blogs = await Blog.find({}).populate('author').sort('-createdAt');
    const tags = await Tag.find({});
    res.render('blog/home', { blogs, tags, global: true, tag: false})
})

//Profile page
app.get('/profile/:authorId', async (req, res) => {
    const {authorId } = req.params;
    var user = await User.find({_id: authorId})
    var followers = user[0].followers.length;
    var following = user[0].followers.length;
    var authorName = user[0].username
    const currentUserId = req.user && req.user._id;
    if (isLoggedIn && currentUserId == authorId) {
        return  res.render('profile/account', { authorId: authorId, following: following, followers: followers, authorName: authorName, loggedIn: true })
    }
    else{
        return  res.render('profile/account', { authorId: authorId, following: following, followers: followers, authorName: authorName, loggedIn: false })

    }
})


//Users post page
app.get('/profile/:authorId/posts', async (req, res) => {
    const {authorId } = req.params;
    var user = await User.find({_id: authorId})
    var followers = user[0].followers.length;
    var following = user[0].followers.length;
    var authorName = user[0].username
    const tags = await Tag.find({});
    const blogsByAuthor = await Blog.find({ author: authorId }).populate('author').sort('-createdAt');
    res.render('blog/usersBlog', { contentType:"Blogs by ", blogs:blogsByAuthor, authorName: authorName, tags: tags})
})


// my posts
// app.get('/profile/posts', async (req, res) => {
//     var user = await User.find({_id: req.user._id})
//     var authorName = user[0].username
//     const blogsByAuthor = await Blog.find({ author: req.user._id }).populate('author').sort('-createdAt');
//     res.render('blog/usersBlog', {contentType:"Blogs by ", blogs:blogsByAuthor, authorName: authorName})
// })

// saved posts
app.get('/profile/:authorId/saved', async (req, res) => {
    var user = await User.find({_id: req.user._id})
    var authorName = user[0].username
    var savedPosts = req.user.saved;
    const tags = await Tag.find({});
    const blogsByAuthor = await Blog.find({_id:{$in: savedPosts}}).populate('author').sort('-createdAt');
    res.render('blog/usersBlog', { contentType:"Saved posts", blogs:blogsByAuthor, authorName: authorName, tags})
})

app.get('/new/info', async (req, res) => {
    res.render('profile/userInfo', {})
})

    // authorId = Blog Writer
    // req.user._id = Account Owner

// new blog creation
app.get('/blog/new', isLoggedIn, (req, res) => {
    res.render('blog/new');
})
app.post('/blog/new', isLoggedIn, upload.single('coverImage'), async (req, res) => {
    const { title, description, tags, body, createdAt } = req.body;
    const tagsArray =  (tags.replace('#','').replace(' ','_')).split(',').map(tag => tag.trim());
    const newBlog = new Blog({
        title,
        coverImage: (req.file ?  {
            url: req.file.path,
            filename: req.file.filename
        } : null),
        description,
        body,
        tagList: [...tagsArray],
        author: req.user._id,
        createdAt
    });
    await newBlog.save();
    tagsArray.forEach(async (tag) => {
        const newTag = new Tag({
            tag
        })
        await newTag.save();
    })
    req.flash('success', 'New blog post added');
    // res.redirect(`/blog/${newBlog._id}`);
    res.redirect('/global')
})

// delete blog
app.delete('/blog/:blogId/delete', isLoggedIn, isAuthor, async (req, res) => {
    const { blogId } = req.params;
    
    const blog = await Blog.findByIdAndRemove(blogId, { useFindAndModify: false });
    if (blog.coverImage) {
        try{
            await cloudinary.uploader.destroy(blog.coverImage.filename);
        }catch(err){
            // console.log(err);
        }
    }
    res.redirect('/home');
})

//edit blog
app.get('/blog/:blogId/edit', isLoggedIn, isAuthor, async (req, res) => {
    const blog = await Blog.findById(req.params.blogId);
    res.render('blog/edit', { blog });
})
app.put('/blog/:blogId/edit',upload.single('coverImage'), isLoggedIn, isAuthor, async (req, res) => {
    const { title, description, tags, body} = req.body;
    const tagsArray = (tags.replace('#','').replace(' ','_')).split(',').map(tag => tag.trim());
    const { blogId } = req.params;
    // console.log(req.file);
    const updatedBlog = {
        title,
        coverImage: ( req.file ?  {
            url: req.file.path,
            filename: req.file.filename
        } : null),
        description,
        body,
        tagList: [...tagsArray]
    };

    const blog = await Blog.findByIdAndUpdate(blogId, updatedBlog, { useFindAndModify: false });
    // console.log(blog.coverImage);
    if (blog.coverImage) {
        try { await cloudinary.uploader.destroy(blog.coverImage.filename); }
        catch(err) { console.log(err)}
    }
    res.redirect(`/blog/${blog._id}`);
})

//show page
app.get('/blog/:blogId', async (req, res) => {
    const { blogId } = req.params;
    const blog = await Blog.findById(blogId).populate('author').lean();

    const currentUserId = req.user && req.user._id;
    if (currentUserId === undefined) {
        return res.render('blog/show', { blog, loggedIn: false });
    }


    let following = false;
    for (let i = 0; i < blog.author.followers.length; i++) {
        if (blog.author.followers[i].equals(currentUserId)) {
            following = true;
            break;
        }
    }

    let saved = false;
    for (let i = 0; i < req.user.saved.length; i++) {
        if (req.user.saved[i].equals(blogId)) {
            saved = true;
            break;
        }
    }
    const authorEqualCurrentUser = (blog.author._id.equals(req.user._id));
    res.render('blog/show', { blog, following, saved, loggedIn: true, authorEqualCurrentUser });
})

//tag
app.get('/tag/:tagname', async (req, res) => {
    const { tagname } = req.params;
    const blogs = await Blog.find({ tagList: { $eq: tagname } }).populate('author').sort('-createdAt').limit(20);
    const tags = await Tag.find({});
    res.render('blog/home', { blogs, tag: tagname, tags})
    // res.send(blogs);
})



// // delete user
// app.delete('/account/delete', isLoggedIn, async (req, res) => {
//     Blog.deleteMany({_id: req.user._id});
//     User.findByIdAndRemove(req.user._id);  
//     req.flash('success', 'Account deleted successfully!')
//     res.redirect('/home');
// })

//User registeration
app.get('/user/register', (req, res) => {
    res.render('user/register')
})

app.post('/user/register', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const newUser = new User({
            email,
            username
        })
        const registeredUser = await User.register(newUser, password);
        req.login(registeredUser, (err) => {
            if (err) return next(err);
            req.flash('success', "Welcome to ClearView");
            res.redirect('/home')
        })

    } catch (err) {
        req.flash('error', err.message);
        res.redirect('/user/register');
    }
})

//User login
app.get('/user/login', (req, res) => {
    res.render('user/login');
})
app.post('/user/login', passport.authenticate('local', { session: true, failureFlash: true, failureRedirect: '/user/login' }), (req, res) => {
    const redirectUrl = req.session.returnTo || '/home';
    req.flash('success', 'Welcome back to ClearView');
    res.redirect(redirectUrl);
})

//User logout 
app.get('/user/logout', (req, res) => {
    req.logout();
    req.flash('success', 'Logged out successfully')
    res.redirect('/home');
})

// save a post
app.post('/:blogId/save', isLoggedIn, async (req, res) => {
    const { blogId} = req.params;
    await User.updateOne({ _id: req.user._id }, { $push: { saved: blogId } });
    req.flash('success', 'Saved to read later!')
    res.redirect(`/blog/${blogId}`);

})

app.post('/:blogId/unsave', isLoggedIn, async (req, res) => {
    const { blogId} = req.params;
    await User.updateOne({ _id: req.user._id }, { $pull: { saved: blogId } });
    req.flash('success', 'Removed from read later!')
    res.redirect(`/blog/${blogId}`);

})


//follow a user
app.post('/:blogId/:authorId/follow', isLoggedIn, async (req, res) => {
    const { blogId, authorId } = req.params;

    await User.updateOne({ _id: authorId }, { $push: { followers: req.user._id } })
    // authorId = Blog Writer
    // req.user._id = Account Owner
    await User.updateOne({ _id: req.user._id }, { $push: { following: authorId } });
    res.redirect(`/blog/${blogId}`);

})
app.post('/:blogId/:authorId/unfollow', isLoggedIn, async (req, res) => {
    const { blogId, authorId } = req.params;

    await User.updateOne({ _id: authorId }, { $pull: { followers: req.user._id } })
    await User.updateOne({ _id: req.user._id }, { $pull: { following: authorId } });
    res.redirect(`/blog/${blogId}`);

})


const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log('listening to port ', port);
})
