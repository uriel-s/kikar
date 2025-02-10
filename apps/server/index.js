const express = require('express');
const cors = require('cors');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');
const fs = require('fs');
require('dotenv').config();
const helmet = require('helmet'); // הוספת Helmet
                            
const userRoute = require('./routes/userRoute');

const PORT = process.env.PORT || 5000;
const app = express();

const initializeFirebase = async () => {
    try {
        // Ensure required environment variables are set
        const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
        const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

        if (!serviceAccountPath) {
            throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_PATH environment variable.");
        }

        if (!storageBucket) {
            throw new Error("Missing FIREBASE_STORAGE_BUCKET environment variable.");
        }

        // Reading the Firebase JSON file
        const serviceAccount = JSON.parse(await fs.promises.readFile(serviceAccountPath, 'utf8'));

        // Initializing Firebase
        initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket,
        });

        console.log("Firebase initialized successfully");
        return {
            db: getFirestore(),
            bucket: admin.storage().bucket(),
        };
    } catch (error) {
        console.error("Error initializing Firebase:", error.message);
        return null; // Return null instead of exiting the process
    }
};

const startServer = async () => {
    const firebaseConfig = await initializeFirebase();

    if (!firebaseConfig) {
        console.error("Failed to initialize Firebase. Server will not start.");
        return; // Prevent server from starting if Firebase initialization failed
    }

    const { db, bucket } = firebaseConfig;

    // Middleware
    app.use(express.json());
    app.use(helmet()); // הוספת Helmet
    app.use(cors());
  

    // Routes
    userRoute(app, db, bucket);

    // Error handling
    app.use((err, req, res, next) => {
        console.error("Internal Server Error:", err.stack);
        res.status(500).send({ message: 'Something went wrong!', error: err.message });
    });

    // Start the server
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
};

startServer();
module.exports = app;
