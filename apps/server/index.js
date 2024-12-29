// Importing necessary modules
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const user_route = require('./routes/users');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');
const multer = require('multer');
const serviceAccount = require('./serviceAccountKey.json');
require('dotenv').config();

const PORT = process.env.PORT || 5000;
const app = express();

// Firebase initialization using async/await
const initializeFirebase = async () => {
    try {
        console.log("Attempting to initialize Firebase...");
        
        if (!admin.apps.length) {
            await initializeApp({
                credential: admin.credential.cert(serviceAccount),
                storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "palhan-b30d2.appspot.com",
            });
            console.log("Firebase initialized successfully");

            // Initialize Firestore and Storage after Firebase is initialized
            const db = getFirestore();
            const bucket = admin.storage().bucket();

            // Middleware
            app.use(cors());
            app.use(express.json());
            app.use(bodyParser.json());

            // Avatar upload middleware with file validation
            const AvatarMulter = multer({
                storage: multer.memoryStorage(),
                limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
                fileFilter: (req, file, cb) => {
                    const filetypes = /jpeg|jpg|png/;
                    const mimetype = filetypes.test(file.mimetype);
                    if (mimetype) {
                        return cb(null, true);
                    }
                    cb(new Error('Only images are allowed!'), false);
                },
            });

            // Routes
            app.post('/users', (req, res) => user_route.handleRegister(req, res, db)); // Register a new user
            app.get('/users/:id', (req, res) => user_route.getUserbyEmail(req, res, db)); // Get user details by email (ID)
            app.get('/users', (req, res) => user_route.getAllUsers(req, res, db)); // Get a list of all users
            app.put('/users/:id', (req, res) => user_route.updateUser(req, res, db)); // Update user profile by ID
            app.post('/users/:id/friends', (req, res) => user_route.addNewFriend(req, res, db)); // Add a new friend to the user's friend list
            app.delete('/users/:id/friends/:friendId', (req, res) => user_route.removeFriend(req, res, db));
            app.get('/users/:id/friends', (req, res) => user_route.getUserFriends(req, res, db)); // Get the user's list of friends
            app.get('/users/:id/isFriend/:friendId', (req, res) => user_route.isUserAFriend(req, res, db)); // Check if a specific user is a friend of the current user
           
            app.post('/users/avatar/:id/', AvatarMulter.single('avatar'), async (req, res) => {
                try {
                    await user_route.updateAvatar(req, res, bucket);
                } catch (error) {
                    res.status(500).send('Error uploading avatar');
                }
            });

            // Error handling middleware
            app.use((err, req, res, next) => {
                console.error(err.stack);
                res.status(500).send('Something went wrong!');
            });

            // Start server
            app.listen(PORT, () => {
                console.log(`Server running on port ${PORT}`);
            });

        } else {
            console.log("Firebase already initialized");
        }
    } catch (error) {
        console.error("Error initializing Firebase", error);
    }
};

// Call to initialize Firebase
initializeFirebase();
