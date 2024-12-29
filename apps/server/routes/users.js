// Import Multer for file handling
const multer = require('multer');

// @route    GET /users/:id
// @desc     Get current user profile
// @access   Private
const getUserbyEmail = async (req, res, db) => {
  const { id } = req.params;
  try {
      const querySnapshot = await db.collection('users').where('id', '==', id).get();
      if (querySnapshot.empty) {
          return res.status(404).send("User not found");
      }
      const snapshot = querySnapshot.docs[0];
      const user = snapshot.data();
      res.json(user);
  } catch (error) {
      console.error("Error fetching user:", error);
      return res.status(500).send("Internal server error");
  }
};

// @route    GET /users
// @desc     Get all users
// @access   Public
const getAllUsers = async (req, res, db) => {
  try {
      const querySnapshot = await db.collection('users').get();
      if (querySnapshot.empty) {
          return res.status(404).send("No users found.");
      }
      const users = [];
      querySnapshot.forEach((doc) => {
          users.push(doc.data());
      });
      res.json(users);
  } catch (error) {
      console.error("Error fetching users:", error);
      return res.status(500).send("Internal server error");
  }
};

// @route    PUT /users/:email
// @desc     Update current user's profile
// @access   Private
const updateUser = async (req, res, db) => {
  const { id } = req.params;
  const { email, name, birthDate, address } = req.body;

  try {
      const docRef = await db.collection('users').doc(id);
      await docRef.update({
          name: name,
          birthDate: birthDate,
          address: address
      });
      res.json("Success");
  } catch (error) {
      console.error("Error updating user:", error);
      return res.status(500).send("Cannot update user");
  }
};

// @route    POST /users/profile
// @desc     Create user profile
// @access   Private
const handleRegister = async (req, res, db) => {
  const { email, name, id, birthDate, address } = req.body;
  try {
      const docRef = db.collection('users').doc(id);
      await docRef.set({
          id: id,
          name: name,
          birthDate: birthDate,
          email: email,
          address: address,
      });
      res.json("Success");
  } catch (error) {
      console.error("Error registering user:", error);
      return res.status(500).send("Cannot register user");
  }
};

// @route    POST /updateAvatar/:id
// @desc     Update current user's Avatar
// @access   Private
const updateAvatar = async (req, res, bucket) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  const imageFile = req.file;
  const fileName = req.params.id;
  const fileUpload = bucket.file(`profile_pictures/${fileName}`);
  
  try {
    // Check if there is an existing profile picture and delete it
    const [existingFiles] = await bucket.getFiles({ prefix: 'profile_pictures/' });
    
    // Find the file associated with the user, if exists, and delete it
    const userFile = existingFiles.find(file => file.name.includes(req.params.id));
    if (userFile) {
      await bucket.file(userFile.name).delete();
    }
  } catch (error) {
    console.error('Error deleting existing profile picture:', error);
    return res.status(500).send('Internal Server Error');
  }

  const stream = fileUpload.createWriteStream({
    metadata: {
      contentType: imageFile.mimetype
    }
  });

  stream.on('error', (err) => {
    console.error('Error uploading to Firebase Storage:', err);
    return res.status(500).send('Internal Server Error');
  });

  stream.on('finish', () => {
    res.status(200).send('File uploaded successfully');
  });

  stream.end(imageFile.buffer);
};

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

const isUserAFriend = async (req, res, db) => {
  const { id, friendId } = req.params; // Extract userId and friendId from the request parameters
  try {
      // Fetch the user's document from Firestore
      const userDoc = await db.collection('users').doc(id).get();

      if (!userDoc.exists) {
          return res.status(404).json({ message: 'User not found' });
      }

      // Get the friends list from the user document
      const userData = userDoc.data();
      const friendsList = userData.friends || []; // Assuming 'friends' is an array in the Firestore document

      // Check if friendId exists in the friends list
      const isFriend = friendsList.includes(friendId);

      // Respond with the result
      res.status(200).json({ isFriend });
  } catch (error) {
      console.error('Error checking friendship:', error);
      res.status(500).json({ message: 'Internal server error' });
  }
};

const addNewFriend = async (req, res, db) => {
  const { id } = req.params;
  const { friendId } = req.body;
  try {
    const userDoc = await db.collection('users').doc(id).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found' });
    }

    const friendDoc = await db.collection('users').doc(friendId).get();
    if (!friendDoc.exists) {
      return res.status(404).json({ message: 'Friend not found' });
    }

    const userData = userDoc.data();
    const friendsList = userData.friends || [];

    if (friendsList.includes(friendId)) {
      return res.status(400).json({ message: 'Already friends' });
    }

    await db.collection('users').doc(id).update({
      friends: [...friendsList, friendId],
    });

    const friendData = friendDoc.data();
    const friendList = friendData.friends || [];
    await db.collection('users').doc(friendId).update({
      friends: [...friendList, id],
    });

    res.status(200).json({ message: 'Friend added successfully' });
  } catch (error) {
    console.error('Error adding friend:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// @route    DELETE /users/:id/friends/:friendId
// @desc     Remove a friend from both the user's and the friend's friend list
// @access   Private
const removeFriend = async (req, res, db) => {
  const { id, friendId } = req.params;  // Extract userId and friendId from the request parameters
 
  try {

      // Fetch the user's document from Firestore
      const userDoc = await db.collection('users').doc(id).get();
      if (!userDoc.exists) {
          return res.status(404).json({ message: 'User not found' });
      }

      const userData = userDoc.data();
      const userFriendsList = userData.friends || [];  // Assuming 'friends' is an array in the Firestore document
      // Check if friendId exists in the user's friends list
      const userFriendIndex = userFriendsList.indexOf(friendId);
      if (userFriendIndex === -1) {
          return res.status(404).json({ message: 'Friend not found in user\'s list' });
      }

      // Remove the friendId from the user's friends list
      userFriendsList.splice(userFriendIndex, 1);

      // Update the user's friends list in the Firestore database
      await db.collection('users').doc(id).update({
          friends: userFriendsList
      });

      // Now, update the friend's friends list (remove the user from friend's list)
      const friendDoc = await db.collection('users').doc(friendId).get();
      if (!friendDoc.exists) {
          return res.status(404).json({ message: 'Friend not found' });
      }

      const friendData = friendDoc.data();
      const friendFriendsList = friendData.friends || [];  // Assuming 'friends' is an array in the Firestore document

      // Check if userId exists in the friend's friends list
      const friendIndex = friendFriendsList.indexOf(id);
      if (friendIndex === -1) {
          return res.status(404).json({ message: 'User not found in friend\'s list' });
      }

      // Remove the userId from the friend's friends list
      friendFriendsList.splice(friendIndex, 1);

      // Update the friend's friends list in the Firestore database
      await db.collection('users').doc(friendId).update({
          friends: friendFriendsList
      });

      res.status(200).json({ message: 'Friend removed successfully from both users\' lists' });
  } catch (error) {
      console.error('Error removing friend:', error);
      res.status(500).json({ message: 'Internal server error' });
  }
};



const getUserFriends = async (req, res, db) => {
  const { id } = req.params; // Extract userId from the request parameters

  try {
      // Fetch the user's document from Firestore
      const userDoc = await db.collection('users').doc(id).get();

      if (!userDoc.exists) {
          return res.status(404).json({ message: 'User not found' });
      }

      // Get the friends list from the user document
      const userData = userDoc.data();
      const friendsList = userData.friends || []; // Assuming 'friends' is an array in the Firestore document

      // Respond with the friends list
      res.status(200).json({ friends: friendsList });
  } catch (error) {
      console.error('Error retrieving friends list:', error);
      res.status(500).json({ message: 'Internal server error' });
  }
};
module.exports = {
    handleRegister,
    getUserbyEmail,
    updateUser,
    updateAvatar,
    getAllUsers,
    isUserAFriend,
    getUserFriends,
    addNewFriend,
    removeFriend,
    AvatarMulter,
};
