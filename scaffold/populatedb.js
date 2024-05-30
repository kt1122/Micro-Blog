// const sqlite = require('sqlite');
// const sqlite3 = require('sqlite3');

// // File name where the SQLite database will be stored
// const dbFileName = 'data.db';
// let db;

// async function initializeDB() {

//     // Opens connection to the SQLite database
//     db = await sqlite.open({ filename: dbFileName, driver: sqlite3.Database });

//     // Create the two tables
//     await db.exec(`
//         CREATE TABLE IF NOT EXISTS users (
//             id INTEGER PRIMARY KEY AUTOINCREMENT,
//             username TEXT NOT NULL UNIQUE,
//             hashedGoogleId TEXT NOT NULL UNIQUE,
//             avatar_url TEXT,
//             memberSince DATETIME NOT NULL
//         );

//         CREATE TABLE IF NOT EXISTS posts (
//             id INTEGER PRIMARY KEY AUTOINCREMENT,
//             title TEXT NOT NULL,
//             content TEXT NOT NULL,
//             username TEXT NOT NULL,
//             timestamp DATETIME NOT NULL,
//             likes INTEGER NOT NULL
//         );
//     `);

//     const users = [
//         { username: 'I\'veBuriedMyClocks', hashedGoogleId: 'hashedGoogleId1', avatar_url: '', memberSince: '2024-01-01 08:00' },
//         { username: 'LeaveTheRatsAlone', hashedGoogleId: 'hashedGoogleId2', avatar_url: '', memberSince: '2024-01-02 09:00' },
//         { username: 'Don\'tFightThePickles', hashedGoogleId: 'hashedGoogleId3', avatar_url: '', memberSince: '2023-01-15 06:00' },
//         { username: 'AlwaysMeasureTwiceCutOnce', hashedGoogleId: 'hashedGoogleId4', avatar_url: '', memberSince: '2021-09-21 10:00' },
//         { username: 'SampleUser', hashedGoogleId: 'hashedGoogleId5', avatar_url: '', memberSince: '2021-03-19 10:00' },
//     ];

//     const posts = [
//         { title: 'First Post', content: 'This is the first post', username: 'user1', timestamp: '2024-01-01 12:30:00', likes: 0 },
//         { title: 'igpay atinlay', content: 'isthay isyay ayay amplesay ostpay.', username: 'SampleUser', timestamp: '2024-01-01 10:00', likes: 0 },
//         { title: 'What did the fish say when he hit a wall?', content: 'Damn.', username: 'AlwaysMeasureTwiceCutOnce', timestamp: '2023-07-25 7:00', likes: 10 },
//         { title: 'The Latin Pig?', content: 'Not much actual pig themed content here, huh?', username: 'Don\'tFightThePickles', timestamp: '2023-07-21 7:45', likes: 1 },
//         { title: '???', content: 'I don\'t *know* pig latin!', username: 'Don\'tFightThePickles', timestamp: '2023-07-30 4:45', likes: 1 },
//         { title: 'Teacup Pigs!', content: 'Have you ever *seen* a teacup pig?! They\'re adorable!', username: 'LeaveTheRatsAlone', timestamp: '2024-01-02 12:00', likes: 50 },
//         { title: 'Many Aliases', content: 'People say unique aliases defeat the purpose of anonymity, but where\'s the fun in that?', username: 'Don\'tFightThePickles', timestamp: '2023-07-02 10:00', likes: 3 },
//         { title: '🪜', content: 'This is my step ladder. I never knew my real ladder', username: 'AlwaysMeasureTwiceCutOnce', timestamp: '2023-07-27 8:00', likes: 1 },
//     ];

//     await deleteAllUsers();

//     // Insert sample data into the database
//     await Promise.all(users.map(user => {
//         return db.run(
//             'INSERT INTO users (username, hashedGoogleId, avatar_url, memberSince) VALUES (?, ?, ?, ?)',
//             [user.username, user.hashedGoogleId, user.avatar_url, user.memberSince]
//         );
//     }));

//     console.log('users created');
//     await Promise.all(posts.map(post => {
//         return db.run(
//             'INSERT INTO posts (title, content, username, timestamp, likes) VALUES (?, ?, ?, ?, ?)',
//             [post.title, post.content, post.username, post.timestamp, post.likes]
//         );
//     }));

//     console.log('Database populated with initial data.');
//     // await db.close();
// }

// // initializeDB().catch(err => {
// //     console.error('Error initializing database:', err);
// // });

// async function deleteAllUsers() {
//     db.exec('DELETE from users');
//     db.exec('DELETE from posts');
// }

// async function getAllPosts() {
//     return await db.all('SELECT * FROM posts');
// }

// async function getAllUsers() {
//     return await db.all('SELECT * FROM users');
// }

// // These functions other files can call
// module.exports = {
//     initializeDB,
//     getAllPosts, 
//     getAllUsers
// }