

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

module.exports = {
    handleRegister: handleRegister,
    getUserbyEmail : getUserbyEmail,
    updateUser :  updateUser
  };
