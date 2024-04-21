const express = require('express');
const bodyParser =require('body-parser')
const cors = require('cors');
const user_route = require('./routes/users');
const PORT = process.env.PORT || 5000
const app = express();
//const { initializeApp } = require('firebase-admin');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');
const multer = require('multer');

const { doc, getDoc ,collection,addDoc}  = require( "firebase/firestore");
const serviceAccount = require('./serviceAccountKey');

require("dotenv/config");
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

//connect firestore with serviceAccountKey details
try {
    initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: "gs://moveo-de052.appspot.com"
    });
    console.log("Firebase initialized successfully");
} catch (error) {
    console.error("Error initializing Firebase 29", error);
} 
    
const db = getFirestore();
const bucket = admin.storage().bucket();

const AvatarMulter = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // Limit file size to 5MB
    },
  });

console.log("connect to db")

//routrs
app.post('/add'        ,(req, res) =>  { user_route.handleRegister(req, res, db,collection,addDoc ) })
app.get('/users/:id',(req, res) => {user_route.getUserbyEmail(req, res, db, )})
app.put('/update/:id',(req, res) => {user_route.updateUser(req, res, db, )})

app.post('/uploadAvatar/:id', AvatarMulter.single('avatar'), (req, res) => {
    user_route.updateAvatar(req, res, bucket);
});

app.listen(PORT, ()=>{
    console.log(`Server runing on port ${PORT}`)});








    
// make all vallidation with frontend and firebase no need other validation


    //const validRegister = () =>
//[
  //  check('email' ,'Email is not valid' ).isEmail().normalizeEmail(),
    //check('name', 'Name is required').notEmpty(),
    // check('password',"password is not valid").isLength({ min: 6, }).matches(
    // /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]/ 
    // ) 
//] 