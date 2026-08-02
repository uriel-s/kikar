const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

const initializeFirebase = () => {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "palhan-b30d2.appspot.com",
        });
        console.log("Firebase initialized successfully");
    }
};

module.exports = initializeFirebase;
