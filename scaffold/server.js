const express = require('express');
const expressHandlebars = require('express-handlebars');
const session = require('express-session');
const { createCanvas } = require('canvas');
const initializeDB = require('./populatedb')
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const dotenv = require('dotenv');
dotenv.config();

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Configuration and Setup
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

const app = express();
const PORT = 3000;


const CLIENT_ID = '513266850474-mk0caohdbcmt358l0s88lsgofb8n5k3c.apps.googleusercontent.com'
const CLIENT_SECRET = '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';
const EMOJI_API_KEY = '0960e467224eab16ed93d22d7f45378bc99177c1'

passport.use(new GoogleStrategy({
    clientID: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    callbackURL: `http://localhost:${PORT}/auth/google/callback`
}, (accessToken, refreshToken, profile, done) => {
    findOrCreateUser(profile, done);
}));

function findOrCreateUser(profile, done) {
    // Placeholder for user search by Google ID or email
    let user = users.find(u => u.googleId === profile.id);

    if (!user) {
        user = {
            id: users.length + 1, // increment for new user
            username: profile.displayName,
            googleId: profile.id, // save Google ID for future logins
            memberSince: new Date().toISOString()
        };
        users.push(user);
    }

    done(null, user);
}

passport.serializeUser((user, done) => {
    done(null, user.id); // Serialize by user.id assumed to be unique
});

passport.deserializeUser((id, done) => {
    const user = users.find(u => u.id === id); // Deserialize the session by searching for the id
    done(null, user);
});

async function startServer() {
    try {
        await initializeDB();
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to initialize the database:', error);
    }
}

startServer();


/*
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    Handlebars Helpers

    Handlebars helpers are custom functions that can be used within the templates 
    to perform specific tasks. They enhance the functionality of templates and 
    help simplify data manipulation directly within the view files.

    In this project, two helpers are provided:
    
    1. toLowerCase:
       - Converts a given string to lowercase.
       - Usage example: {{toLowerCase 'SAMPLE STRING'}} -> 'sample string'

    2. ifCond:
       - Compares two values for equality and returns a block of content based on 
         the comparison result.
       - Usage example: 
            {{#ifCond value1 value2}}
                <!-- Content if value1 equals value2 -->
            {{else}}
                <!-- Content if value1 does not equal value2 -->
            {{/ifCond}}
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/

// Set up Handlebars view engine with custom helpers
//
app.engine(
    'handlebars',
    expressHandlebars.engine({
        helpers: {
            toLowerCase: function (str) {
                return str.toLowerCase();
            },
            ifCond: function (v1, v2, options) {
                if (v1 === v2) {
                    return options.fn(this);
                }
                return options.inverse(this);
            },
        },
    })
);

app.set('view engine', 'handlebars');
app.set('views', './views');

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Middleware
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

app.use(
    session({
        secret: 'oneringtorulethemall',     // Secret key to sign the session ID cookie
        resave: false,                      // Don't save session if unmodified
        saveUninitialized: false,           // Don't create session until something stored
        cookie: { secure: false },          // True if using https. Set to false for development without https
    })
);

// Replace any of these variables below with constants for your application. These variables
// should be used in your template files. 
// 
app.use((req, res, next) => {
    res.locals.appName = 'The Latin Piglet';
    res.locals.copyrightYear = 2024;
    res.locals.postNeoType = 'Oink';
    res.locals.loggedIn = req.session.loggedIn || false;
    res.locals.userId = req.session.userId || '';
    next();
});

app.use(express.static('public'));                  // Serve static files
app.use(express.urlencoded({ extended: true }));    // Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.json());                            // Parse JSON bodies (as sent by API clients)

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Routes
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Home route: render home view with posts and user
// We pass the posts and user variables into the home
// template
//
app.get('/', (req, res) => {
    const posts = getPosts();
    const users = getUsers(); // Get all users
    const user = getCurrentUser(req) || {};
    const apiKey = EMOJI_API_KEY;
    res.render('home', { posts, users, user, apiKey });
});

// Register GET route is used for error response from registration
//
app.get('/register', (req, res) => {
    res.render('loginRegister', { regError: req.query.error });
});

// Login route GET route is used for error response from login
//
app.get('/login', (req, res) => {
    //res.render('loginRegister', { loginError: req.query.error });
    res.send('<a href="/auth/google">Authenticate with Google</a>')
});

app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile'] })
)

app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/login' }),
    function(req, res) {
        // Successful authentication
        req.session.userId = req.user.id; // Or whatever your user identifier is
        req.session.loggedIn = true;
        res.redirect('/'); // Redirect to the home page for logged-in users
    }
);

// Error route: render error page
//
app.get('/error', (req, res) => {
    res.render('error');
});

// Additional routes that you must implement

app.post('/posts', (req, res) => {
    // TODO: Add a new post and redirect to home
    const { title, content } = req.body;
    if (!title || !content) {
        return res.redirect('/?error=Title+and+content+are+required');
    }

    addPost(title, content, findUserById(req.session.userId).username)
    res.redirect('/');
});


app.post('/like/:id', (req, res) => {
    if (!req.session.userId) {
        return res.json({ success: false, message: 'You must be logged in to like a post.' });
    }

    const postId = parseInt(req.params.id);
    const post = posts.find(post => post.id === postId);

    // Initialize likedPosts in session if it doesn't exist
    if (!req.session.likedPosts) {
        req.session.likedPosts = [];
    }

    if (post && !req.session.likedPosts.includes(postId)) {
        post.likes++;
        req.session.likedPosts.push(postId); // Add the post ID to the session's likedPosts array
        res.json({ success: true, likes: post.likes });
    } else {
        res.json({ success: false, message: 'You have already liked this post or post does not exist.' });
    }
});




app.get('/profile', isAuthenticated, (req, res) => {
    // TODO: Render profile page
    const currentUser = findUserById(req.session.userId);
    if (!currentUser) {
        return res.redirect('/login');
    }

    const userPosts = posts.filter(post => post.username === currentUser.username);
    res.render('profile', {
        user: currentUser,
        posts: userPosts
    });
});


app.get('/avatar/:username', handleAvatar);

app.post('/register', (req, res) => {
    // TODO: Register a new user
    const { username } = req.body;
    
    // Check if the user already exists
    const userExists = findUserByUsername(username);
    if (userExists) {
        return res.redirect('/register?error=User+already+exists');
    }

    // Add the new user
    const newUser = {
        id: users.length + 1,
        username,
        memberSince: new Date().toISOString()
    };
    users.push(newUser);

    // Log the user in (set session data)
    req.session.userId = newUser.id;
    req.session.loggedIn = true;

    // Redirect to home page or profile page
    res.redirect('/');
});


app.post('/login', (req, res) => {
    const { username } = req.body;
    const user = findUserByUsername(username);
    if (user) {
        req.session.userId = user.id;
        req.session.loggedIn = true;
        res.redirect('/'); // Redirect to the home page for logged-in users
    } else {
        res.redirect('/login?error=Invalid+credentials');
    }
});


app.get('/logout', (req, res) => {
    // TODO: Logout the user
    req.session.destroy(() => {
        res.redirect('/');
    })
});


app.post('/delete/:id', isAuthenticated, (req, res) => {
    // TODO: Delete a post if the current user is the owner
    const postId = parseInt(req.params.id);
    const postIndex = posts.findIndex(post => post.id === postId && post.username === findUserById(req.session.userId).username);
    if (postIndex !== -1) {
        posts.splice(postIndex, 1);  // Remove the post from the array
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: "Post not found or user unauthorized" });
    }
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Server Activation
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Support Functions and Variables
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Function to find a user by username
function findUserByUsername(username) {
    return users.find(user => user.username === username);
}

// Function to find a user by user ID
function findUserById(userId) {
    return users.find(user => user.id === userId);
}

// Function to get all users
function getUsers() {
    return users;
}

// Function to add a new user
function addUser(username) {
    // TODO: Create a new user object and add to users array
}

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    console.log(req.session.userId);
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Function to register a user
function registerUser(req, res) {
    // TODO: Register a new user and redirect appropriately
    const { username } = req.body;
    const existingUser = findUserByUsername(username);
    if (existingUser) {
        return res.redirect('/register?error=User+already+exists');
    }

    const newUser = {
        id: users.length + 1,  // Simple way to generate a new ID
        username: username,
        memberSince: new Date().toISOString()
    };

    users.push(newUser);
    req.session.userId = newUser.id;
    req.session.loggedIn = true;
    res.redirect('/');
}

// Function to login a user
function loginUser(req, res) {
    const username = req.body;
    const user = findUserByUsername(username);
    
    if (user) {
        req.session.userId = user.id;
        req.session.loggedIn = true;
        res.redirect('/');
    } else {
        res.redirect('/login?error=Invalid+username');
    }
}

// Function to logout a user
function logoutUser(req, res) {
    // TODO: Destroy session and redirect appropriately
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/error');  // Redirect to an error page if session destruction fails
        }
        res.redirect('/login');  // Redirect to login page after successful logout
    });
}

// Function to render the profile page
function renderProfile(req, res) {
    // TODO: Fetch user posts and render the profile page
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
        return res.redirect('/login');
    }
    
    const userPosts = posts.filter(post => post.username === currentUser.username);
    res.render('profile', {
        user: currentUser,
        posts: userPosts
    });
}

// Function to update post likes
function updatePostLikes(req, res) {
    // TODO: Increment post likes if conditions are met
    const postId = parseInt(req.params.id);
    const post = posts.find(post => post.id === postId);
    if (post && req.session.userId !== findUserById(req.session.userId).id) {
        post.likes++;
        res.json({ success: true, likes: post.likes });
    } else {
        res.redirect('/error?message=Cannot like your own post or post does not exist');
    }
}

// Function to generate an image avatar
let colors = ["#2D5D7B", "#80CED7", "#B2CEDE", "#8CDFD6", "#46B1C9", "#6DC0D5", 
"#837CB6", "#68A357", "#629677", "#3581B8", "#AF3800", "#392F5A", "#757761", "#654F6F"]

function generateAvatar(letter, width = 100, height = 100) {
    try {
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)]; // background color
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#FBFBF3';  // text color
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(letter.toUpperCase(), width / 2, height / 2);

        return canvas.toBuffer();
    } catch (error) {
        console.error('Error generating avatar:', error);
        throw error;  // Re-throw the error after logging it
    }
}

// Function to handle avatar generation and serving
function handleAvatar(req, res) {
    try {
        const user = findUserByUsername(req.params.username);
        if (!user) {
            console.log('User not found:', req.params.username);  // Debugging statement
            res.status(404).send('User not found');
            return;
        }

        console.log('Generating avatar for user:', user.username);  // Debugging statement
        const avatar = generateAvatar(user.username[0]);
        res.setHeader('Content-Type', 'image/png');
        res.send(avatar);
    } catch (error) {
        console.error('Error handling avatar request:', error);
        res.status(500).send('Internal Server Error');  // Send a 500 status code for server errors
    }
}

// Function to get the current user from session
function getCurrentUser(req) {
    return findUserById(req.session.userId);
}

// Function to get all posts, sorted by latest first
function getPosts() {
    return posts.slice().reverse();
}

// Function to add a new post
function addPost(title, content, username) {
    const newPost = {
        id: posts.length + 1,
        title,
        content,
        username,
        timestamp: new Date().toISOString(),
        likes: 0
    };
    posts.push(newPost);
    return newPost;
}