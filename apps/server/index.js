const express = require('express');
const bodyParser =require('body-parser')
const cors = require('cors');
const user_route = require('./routes/users');
const PORT = process.env.PORT || 5000
const app = express();
const { initializeApp,  cert } = require('firebase-admin/app');
const { getFirestore} = require('firebase-admin/firestore');
const { doc, getDoc ,collection}  = require( "firebase/firestore");
const serviceAccount = require('./serviceAccountKey');


require("dotenv/config");
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

//connect firestore with serviceAccountKey details
initializeApp({
      credential: cert(serviceAccount)
});
    
const db = getFirestore();
console.log("connect to db")

//routrs
app.post('/add'        ,(req, res) =>  { user_route.handleRegister(req, res, db, ) })
app.get('/users/:id',(req, res) => {user_route.getUserbyEmail(req, res, db, )})
app.put('/update/:id',(req, res) => {user_route.updateUser(req, res, db, )})


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