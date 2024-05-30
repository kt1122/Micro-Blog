const express = require('express');
const expressHandlebars = require('express-handlebars');
const session = require('express-session');
const { createCanvas } = require('canvas');
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const dotenv = require('dotenv');
dotenv.config();
const crypto = require('crypto');


//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Configuration and Setup
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

const app = express();
const PORT = 3000;
const dbFileName = 'data.db';
let db;


const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const EMOJI_API_KEY = process.env.EMOJI_API_KEY;

passport.use(new GoogleStrategy({
    clientID: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    callbackURL: `http://localhost:${PORT}/auth/google/callback`
}, (accessToken, refreshToken, profile, done) => {
    findOrCreateUser(profile, done);
}));

function hashGoogleID(id) {
    return crypto.createHash('sha256').update(id).digest('hex');
}

async function findOrCreateUser(profile, done) {
    const hashedGoogleId = hashGoogleID(profile.id);  // Hash the Google ID

    try {
        let user = await db.get("SELECT * FROM users WHERE hashedGoogleId = ?", [hashedGoogleId]);

        if (!user) {
            // User not found in database, create a new user entry
            const result = await db.run("INSERT INTO users (username, hashedGoogleId, memberSince) VALUES (?, ?, ?)", [profile.displayName, hashedGoogleId, new Date().toISOString()]);
            user = { id: result.lastID, username: profile.displayName, hashedGoogleId: hashedGoogleId, memberSince: new Date().toISOString() };
        }

        done(null, user);
    } catch (error) {
        console.error('Error in findOrCreateUser:', error);
        done(error);
    }
}



passport.serializeUser((user, done) => {
    done(null, user.id); // Serialize by user.id assumed to be unique
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await db.get("SELECT * FROM users WHERE id = ?", [id]);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});


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

app.set('views', './views');
app.set('view engine', 'handlebars');


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
app.get('/', async (req, res) => {
    const sort = req.query.sort || 'recent';
    const posts = await getPosts(sort);
    const users = await getUsers();
    const user = await getCurrentUser(req) || {};
    console.log("I am ", user, "!");
    const apiKey = EMOJI_API_KEY;
    res.render('home', { posts, users, user, apiKey, activeSort: sort });
});

// Register GET route is used for error response from registration
//
// app.get('/register', (req, res) => {
//     let googleProfile = tempUsers[req.query.googleId];
//     if (googleProfile) {
//         // Render a specific registration page for Google-authenticated users
//         res.render('googleRegister', { profile: googleProfile });
//     } else {
//         res.render('register', { error: 'No Google profile found. Please try again.' });
//     }
// });

app.get('/register', (req, res) => {
    // res.render('loginRegister', { regError: req.query.error });
    res.redirect('/');
});

// Login route GET route is used for error response from login
//
app.get('/login', (req, res) => {
    //res.render('loginRegister', { loginError: req.query.error });
    // res.send('<a href="/auth/google">Authenticate with Google</a>')
    res.redirect('/auth/google'); 
});

app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile'] })
)

app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/login' }),
    function(req, res) {
        // Successful authentication
        req.session.userId = req.user.id; // Set session user ID
        req.session.loggedIn = true; // Set logged in status

        // Check if the user has been registered
        if (req.user.isRegistered) {
            res.redirect('/'); // Redirect to the home page if registered
        } else {
            res.render('loginRegister', { loginError: req.query.error }); // Render login/register page if not registered
        }
    }
);

// Error route: render error page
//
app.get('/error', (req, res) => {
    res.render('error');
});

// Get post content
app.get('/post/:id', async (req, res) => {
    const postId = req.params.id;
    const post = await getPostById(postId);
    res.json({ success: true, content: post.content });
});

async function getPostById(postId) {
    return await db.get('SELECT content FROM posts WHERE id = ?', [postId]);
}

// Additional routes that you must implement

app.post('/posts', async (req, res) => {
    const { title, content } = req.body;
    if (!title || !content) {
        return res.redirect('/?error=Title+and+content+are+required');
    }

    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
        return res.redirect('/login');
    }

    try {
        await addPost(title, content, currentUser.username);
        res.redirect('/');
    } catch (error) {
        console.error('Error adding post:', error);
        res.redirect('/?error=Failed+to+add+post');
    }
});


app.post('/like/:id', async (req, res) => {
    const postId = parseInt(req.params.id);

    if (!req.session.userId) {
        return res.json({ success: false, message: 'You must be logged in to like a post.' });
    }

    try {
        const post = await db.get('SELECT * FROM posts WHERE id = ?', [postId]);
        if (post) {
            await db.run('UPDATE posts SET likes = likes + 1 WHERE id = ?', [postId]);
            res.json({ success: true, likes: post.likes + 1 });
        } else {
            res.json({ success: false, message: 'Post not found.' });
        }
    } catch (error) {
        console.error('Error updating likes:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


app.get('/profile', isAuthenticated, async (req, res) => {
    const currentUser = await findUserById(req.session.userId);
    if (!currentUser) {
        return res.redirect('/login');
    }

    const userPosts = await db.all('SELECT * FROM posts WHERE username = ?', [currentUser.username]);
    res.render('profile', {
        user: currentUser,
        posts: userPosts // Make sure this is correctly queried and passed
    });
});

app.post('/register', async (req, res) => {
    const { username } = req.body;

    try {
        // Check if the user already exists
        const userExists = await findUserByUsername(username);
        if (userExists) {
            return res.redirect('/register?error=User+already+exists');
        }

        // Create the new user in the database
        const newUser = await addUser({
            username: username,
            hashedGoogleId: '',  
            avatar_url: '',      
            memberSince: new Date().toISOString()
        });

        req.session.userId = newUser.id;
        req.session.loggedIn = true;

        res.redirect('/');
    } catch (error) {
        console.error('Registration failed:', error);
        res.redirect('/register?error=Registration+failed');
    }
});



app.get('/avatar/:username', async(req, res) => {
    try {
        const username = req.params.username;
        const avatar = await generateAvatar(username);
        res.setHeader('Content-Type', 'image/png');
        res.send(avatar);
    } catch (error) {
        console.error('Error handling avatar request:', error);
        res.status(500).send('Internal Server Error');
    }
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
    
    req.session.destroy(() => {
        res.redirect('/');
    })
});


app.post('/delete/:id', isAuthenticated, (req, res) => {
    const postId = parseInt(req.params.id);
    const postIndex = posts.findIndex(post => post.id === postId && post.username === findUserById(req.session.userId).username);
    if (postIndex !== -1) {
        posts.splice(postIndex, 1);  // Remove the post from the array
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: "Post not found or user unauthorized" });
    }
});

app.post('/delete-account', async (req, res) => {
    const username = req.body.username;
    const isOrphanPost = req.body.orphanPosts;

    try {
        if (isOrphanPost) {
            await db.run(`UPDATE posts SET username = 'Orphaned_Account' WHERE username = ?`, [username]);
        } else {
            await db.run(`DELETE FROM posts WHERE username = ?`, [username]);
        }
        await db.run(`DELETE FROM users WHERE username = ?`, [username]);

        await logoutUser(req, res); // This will handle the redirect and end the response
    } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Server Activation
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

async function initializeDB() {

    // Opens connection to the SQLite database
    db = await sqlite.open({ filename: dbFileName, driver: sqlite3.Database });

    // Create the two tables
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            hashedGoogleId TEXT NOT NULL UNIQUE,
            avatar_url TEXT,
            memberSince DATETIME NOT NULL
        );

        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            username TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            likes INTEGER NOT NULL
        );
    `);

    const users = [
        { username: 'I\'veBuriedMyClocks', hashedGoogleId: 'hashedGoogleId1', avatar_url: '', memberSince: '2024-01-01 08:00' },
        { username: 'LeaveTheRatsAlone', hashedGoogleId: 'hashedGoogleId2', avatar_url: '', memberSince: '2024-01-02 09:00' },
        { username: 'Don\'tFightThePickles', hashedGoogleId: 'hashedGoogleId3', avatar_url: '', memberSince: '2023-01-15 06:00' },
        { username: 'AlwaysMeasureTwiceCutOnce', hashedGoogleId: 'hashedGoogleId4', avatar_url: '', memberSince: '2021-09-21 10:00' },
        { username: 'SampleUser', hashedGoogleId: 'hashedGoogleId5', avatar_url: '', memberSince: '2021-03-19 10:00' },
    ];

    const posts = [
        { title: 'First Post', content: 'This is the first post', username: 'user1', timestamp: '2018-01-01 12:30:00', likes: 0 },
        { title: 'igpay atinlay', content: 'isthay isyay ayay amplesay ostpay.', username: 'SampleUser', timestamp: '2024-01-01 10:00', likes: 0 },
        { title: 'What did the fish say when he hit a wall?', content: 'Damn.', username: 'AlwaysMeasureTwiceCutOnce', timestamp: '2023-07-25 7:00', likes: 10 },
        { title: 'The Latin Pig?', content: 'Not much actual pig themed content here, huh?', username: 'Don\'tFightThePickles', timestamp: '2023-07-21 7:45', likes: 1 },
        { title: '???', content: 'I don\'t *know* pig latin!', username: 'Don\'tFightThePickles', timestamp: '2023-07-30 4:45', likes: 1 },
        { title: 'Teacup Pigs!', content: 'Have you ever *seen* a teacup pig?! They\'re adorable!', username: 'LeaveTheRatsAlone', timestamp: '2023-01-02 12:00', likes: 50 },
        { title: 'Many Aliases', content: 'People say unique aliases defeat the purpose of anonymity, but where\'s the fun in that?', username: 'Don\'tFightThePickles', timestamp: '2023-07-02 10:00', likes: 3 },
        { title: '🪜', content: 'This is my step ladder. I never knew my real ladder', username: 'AlwaysMeasureTwiceCutOnce', timestamp: '2023-07-27 8:00', likes: 1 },
    ];

    /*
        I added deleteAll() because once the database was created, any subsequent calls of 
        initializeDB() would result in a uniqueness error. deleteAll() deletes the content
        of the database and then puts the data back onto the file.
    */
    // await deleteAll();

    // Insert sample data into the database
    await Promise.all(users.map(user => {
        return db.run(
            'INSERT INTO users (username, hashedGoogleId, avatar_url, memberSince) VALUES (?, ?, ?, ?)',
            [user.username, user.hashedGoogleId, user.avatar_url, user.memberSince]
        );
    }));

    console.log('users created');
    await Promise.all(posts.map(post => {
        return db.run(
            'INSERT INTO posts (title, content, username, timestamp, likes) VALUES (?, ?, ?, ?, ?)',
            [post.title, post.content, post.username, post.timestamp, post.likes]
        );
    }));

    console.log('Database populated with initial data.');
    // await db.close();
}

async function deleteAll() {
    db.exec('DELETE from users');
    db.exec('DELETE from posts');
}


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

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Support Functions and Variables
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Function to find a user by username
async function findUserByUsername(username) {
    try {
        const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
        return user;
    } catch (error) {
        console.error('Failed to find user:', error);
        return null;
    }}

// Function to find a user by user ID
async function findUserById(userId) {
    try {
        const user = await db.get("SELECT * FROM users WHERE id = ?", [userId]);
        return user;
    } catch (error) {
        console.error('Failed to find user by ID:', error);
        return null;
    }
}

// Function to get all users
async function getUsers() {
    return await db.all('SELECT * FROM users');
}

// Function to add a new user
async function addUser(user) {
    const { username, hashedGoogleId, avatar_url, memberSince } = user;
    try {
        const result = await db.run(
            'INSERT INTO users (username, hashedGoogleId, avatar_url, memberSince) VALUES (?, ?, ?, ?)',
            [username, hashedGoogleId, avatar_url, memberSince]
        );
        return { id: result.lastID, ...user };
    } catch (error) {
        console.error('Error adding user to the database:', error);
        throw error;  // Propagate the error back to the caller
    }
}


// Middleware to check if user is authenticated
async function isAuthenticated(req, res, next) {
    console.log(req.session.userId);
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Function to register a user
async function registerUser(req, res) {
    const { username } = req.body;
    try {
        const existingUser = await findUserByUsername(username);
        if (existingUser) {
            return res.redirect('/register?error=User+already+exists');
        }

        const result = await db.run(
            'INSERT INTO users (username, hashedGoogleId, avatar_url, memberSince) VALUES (?, ?, ?, ?)',
            [username, '', '', new Date().toISOString()]
        );

        req.session.userId = result.lastID; // Use the ID of the newly created user
        req.session.loggedIn = true;
        res.redirect('/');
    } catch (error) {
        console.error('Registration failed:', error);
        res.redirect('/register?error=Registration+failed');
    }
}

// Function to login a user
async function loginUser(req, res) {
    const { username } = req.body;
    try {
        const user = await findUserByUsername(username);
        if (user) {
            req.session.userId = user.id;
            req.session.loggedIn = true;
            res.redirect('/'); // Redirect to the home page for logged-in users
        } else {
            res.redirect('/login?error=Invalid+username');
        }
    } catch (error) {
        console.error('Login failed:', error);
        res.redirect('/login?error=Login+failed');
    }
}

// Function to logout a user
async function logoutUser(req, res) {
    return new Promise((resolve) => {
        req.session.destroy(() => {
            res.redirect('/');
            resolve();
        })
    })
}

// Function to render the profile page
async function renderProfile(req, res) {
    const userId = req.session.userId;
    if (!userId) {
        return res.redirect('/login');
    }

    try {
        const user = await findUserById(userId);
        const userPosts = await db.all('SELECT * FROM posts WHERE username = ?', [user.username]);

        if (!user) {
            return res.redirect('/login');
        }
        res.render('profile', { user, posts: userPosts });
    } catch (error) {
        console.error('Failed to render profile:', error);
        res.redirect('/error');
    }
}

// Function to update post likes
async function updatePostLikes(req, res) {
    try {
        // Check if the user has already liked the post
        const userLikes = await db.get('SELECT * FROM likes WHERE postId = ? AND userId = ?', [postId, userId]);
        if (!userLikes) {
            await db.run('UPDATE posts SET likes = likes + 1 WHERE id = ?', [postId]);
            await db.run('INSERT INTO likes (postId, userId) VALUES (?, ?)', [postId, userId]);
            return { success: true };
        } else {
            return { success: false, message: 'Post already liked' };
        }
    } catch (error) {
        console.error('Failed to update likes:', error);
        return { success: false, message: 'Error updating likes' };
    }
}

// Function to generate an image avatar
let colors = ["#2D5D7B", "#80CED7", "#B2CEDE", "#8CDFD6", "#46B1C9", "#6DC0D5", 
"#837CB6", "#68A357", "#629677", "#3581B8", "#AF3800", "#392F5A", "#757761", "#654F6F"]

async function generateAvatar(username, width = 100, height = 100) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    if (username === 'Orphaned_Account') {
        ctx.fillStyle = '#CCCCCC'; // Default background color for orphaned accounts
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#FBFBF3';  // Default text color
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', width / 2, height / 2);
    } else {
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)]; // background color
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#FBFBF3';  // text color
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(username[0].toUpperCase(), width / 2, height / 2);
    }
   
    return canvas.toBuffer();
}

// Function to get the current user from session
async function getCurrentUser(req) {
    const user = await findUserById(req.session.userId);
    return user;
}

// Function to get all posts, sorted by latest first
async function getPosts(sortType) {
    let query = 'SELECT * FROM posts ORDER BY timestamp DESC';  // Default: recent
    if (sortType === 'likes') {
        query = 'SELECT * FROM posts ORDER BY likes DESC, timestamp DESC';  // Sort by likes and then by recent
    }
    try {
        const posts = await db.all(query);
        return posts;
    } catch (error) {
        console.error('Failed to fetch posts:', error);
        throw error;
    }
}

// Function to add a new post
async function addPost(title, content, username) {
    try {
        const result = await db.run(
            'INSERT INTO posts (title, content, username, timestamp, likes) VALUES (?, ?, ?, ?, ?)',
            [title, content, username, new Date().toISOString(), 0]
        );
        console.log(`A post has been inserted with rowid ${result.lastID}`);
        return result.lastID; // Returns the ID of the newly inserted post
    } catch (error) {
        console.error('Failed to add post:', error);
        throw error;
    }
}