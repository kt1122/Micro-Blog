const express = require('express');
const expressHandlebars = require('express-handlebars');
const session = require('express-session');
const canvas = require('canvas');

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Configuration and Setup
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

const app = express();
const PORT = 3000;

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
    const user = getCurrentUser(req) || {};
    res.render('home', { posts, user });
});

// Register GET route is used for error response from registration
//
app.get('/register', (req, res) => {
    res.render('loginRegister', { regError: req.query.error });
});

// Login route GET route is used for error response from login
//
app.get('/login', (req, res) => {
    res.render('loginRegister', { loginError: req.query.error });
});

// Error route: render error page
//
app.get('/error', (req, res) => {
    res.render('error');
});

// Additional routes that you must implement


app.get('/post/:id', (req, res) => {
    // TODO: Render post detail page
    const postId = parseInt(req.params.id);
    const post = posts.find(post => post.id === postId);
    if (post) {
        res.render('postDetail', { post });
    } else {
        res.redirect('/error?message=Post not found');
    }
});


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
    const postId = parseInt(res.params.id);
    const post = posts.find(post => post.id === postId);
    if (post && req.session.userId !== post.username) {
        posts.likes++;
        res.json({ success: true, likes: post.likes});
    } else {
        res.redirect('/error?message=Cannot like your own post or post does not exist');
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


app.get('/avatar/:username', (req, res) => {
    // TODO: Serve the avatar image for the user
    const user = findUserByUsername(req.params.username);
    if (!user) {
        return res.status(404).send('User not found');
    }

    const avatar = generateAvatar(user.username[0]);  // Assuming first letter is used for avatar
    res.setHeader('Content-Type', 'image/png');
    res.send(avatar);
});


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
    // TODO: Login a user
    const { username } = req.body;

    // Find user by username
    const user = findUserByUsername(username);
    if (user) {
        req.session.userId = user.id;
        req.session.loggedIn = true;
        res.redirect('/');
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
    const postIndex = posts.findIndex(post => post.id === postId && post.username === req.session.userId);
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

// Example data for posts and users
let posts = [
    { id: 1, title: 'igpay atinlay', content: 'isthay isyay ayay amplesay ostpay.', username: 'SampleUser', timestamp: '2024-01-01 10:00', likes: 0 },
    { id: 2, title: 'Teacup Pigs!', content: 'Have you ever *seen* a teacup pig?! They\'re adorable!', username: 'AnotherUser', timestamp: '2024-01-02 12:00', likes: 0 },
];
let users = [
    { id: 1, username: 'SampleUser', avatar_url: undefined, memberSince: '2024-01-01 08:00' },
    { id: 2, username: 'AnotherUser', avatar_url: undefined, memberSince: '2024-01-02 09:00' },
];

// Function to find a user by username
function findUserByUsername(username) {
    return users.find(user => user.username === username);
}

// Function to find a user by user ID
function findUserById(userId) {
    return users.find(user => user.id === userId);
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

// Function to handle avatar generation and serving
function handleAvatar(req, res) {
    // TODO: Generate and serve the user's avatar image
    const user = findUserByUsername(req.params.username);
    if (!user) {
        res.status(404).send('User not found');
        return;
    }

    const avatar = generateAvatar(user.username[0]);  // Assuming the avatar uses the first letter
    res.setHeader('Content-Type', 'image/png');
    res.send(avatar);
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

// Function to generate an image avatar
function generateAvatar(letter, width = 100, height = 100) {
    // TODO: Generate an avatar image with a letter
    // Steps:
    // 1. Choose a color scheme based on the letter
    // 2. Create a canvas with the specified width and height
    // 3. Draw the background color
    // 4. Draw the letter in the center
    // 5. Return the avatar as a PNG buffer

    const canvas = canvas.createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Set background color
    ctx.fillStyle = '#f4f4f4';  // Light grey background
    ctx.fillRect(0, 0, width, height);

    // Draw the letter
    ctx.fillStyle = '#333';  // Dark text color
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter.toUpperCase(), width / 2, height / 2);

    return canvas.toBuffer();
}