const multer = require('multer');



// @route    GET /users/:id
// @desc     Get current user profile
// @access   Private
const getUserbyEmail = async (req ,res ,db ,) =>{
    const  id = await req.params.id
    try { 
      const query = await db.collection('users').where('id', '==', id).get()
      if (query.empty) {
          return res.status(500).send("user not exist");
        }
      const snapshot = query.docs[0];
      const user = snapshot.data();
      res.json(user)
    }
    catch
    {
      return res.status(500).send("email not exist");
    }
  
  }
  // @route    put /users/:email
  // @desc     update current users profile
  // @access   Private
  const updateUser = async (req ,res ,db ,) =>{
    const  fireBaseid = await req.params.id
    const { email, name,  birthDate, address} = await req.body;
  
    try
    {
      const docRef =  db.collection('users').doc(fireBaseid);
      var user = docRef.update({
        email: email,
        name : name, 
        birthDate : birthDate,
        address : address
      });
      res.json("succses")
    }
    catch
    {
      return res.status(500).send("can not update");
    }
  
  }
  
  
  // @route    POST users/profile
  // @desc     Create  user profile
  // @access   Private
  const  handleRegister = async (req, res, db,  ) => {
    const { email, name, id ,birthDate,address} = await req.body;
    try{
        const docRef =  db.collection('users').doc(id);
        const newUser =  docRef.set({
          id :id,
          name: name,
          birthDate: birthDate,
          email: email,
          address : address,
          });
          res.json("success");
        }
    catch{
      return res.status(500).send("can not register");
    }
  
  }
  
// @route    POST/updateAvatar/:id
  // @desc     update current users Avatar
  // @access   Private
  const updateAvatar = async (req ,res ,bucket ) => {
    //Sconsole.log("req",req.file)
    if (!req.file || !req.file) {
      console.log("no file!!" ,req.file)
      return res.status(400).send('No file uploaded.');
  }   
  const imageFile = req.file;
  const fileName = req.params.id//Date.now() + '_' + imageFile.originalname;
  const fileUpload = bucket.file('profile_pictures/' + fileName); // Specify the prefix here
    
  // Delete existing profile picture if it exists
  try {
    console.log("id = ",req.params.id)
    const [existingFiles] = await bucket.getFiles({ prefix: 'profile_pictures/fileName' });
    console.log("new pic 1",existingFiles.length)
    if (existingFiles.length > 0) {
        await bucket.file(existingFiles[0].name).delete();
        console.log("new pic 2")
    }
  } catch (error) {
    console.log("new pic 3")

    console.error('Error deleting existing profile picture:', error);
    return res.status(500).send('Internal Server Error');
  }
  const stream = fileUpload.createWriteStream({
        metadata: {
            contentType: imageFile.mimetype
        }
    });
    console.log("new pic 4")

    stream.on('error', (err) => {
      console.log("new pic 5")

        console.error('Error uploading to Firebase Storage:', err);

        return res.status(500).send('Internal Server Error');
    });

    stream.on('finish', () => {
      console.log("new pic 6");
      res.status(200).send('File uploaded successfully');
  });
  
  console.log("new pic 7");
  stream.end(imageFile.buffer);
    
}


  module.exports = {
      handleRegister: handleRegister,
      getUserbyEmail : getUserbyEmail,
      updateUser :  updateUser,
      updateAvatar :updateAvatar
    };