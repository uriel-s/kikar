const updateUser = async (req, res, db) => {
  console.log("🔹 updateUser called with:", req.params.id, req.body);
  const { id } = req.params;
  const { name, birthDate, address } = req.body;

  try {
    const docRef = await db.collection("users").doc(id);
    await docRef.update({
      name: name,
      birthDate: birthDate,
      address: address,
    });
    res.status(200).json({ message: "Success" });
  } catch (error) {
    console.error("Error updating user:", error);
    return res.status(500).json({ message: "Cannot update user" });
  }
};

const handleRegister = async (req, res, db) => {
  const { email, name, id, birthDate, address } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Missing required fields" });
  }
  try {
    const docRef = db.collection("users").doc(id);
    await docRef.set({
      id: id,
      name: name,
      birthDate: birthDate,
      email: email,
      address: address,
    });
    res.status(201).json({
      message: "Success",
      user: { id, email },
    });
  } catch (error) {
    console.error("Error registering user:", error);
    return res.status(500).json({ message: "Cannot register user" });
  }
};

const getUserbyID = async (req, res, db) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "ID is required" });
    }
    const querySnapshot = await db.collection("users").where("id", "==", id).get();
    if (querySnapshot.empty) {
      return res.status(404).json({ message: "User not found" });
    }
    const snapshot = querySnapshot.docs[0];
    const user = snapshot.data();
    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

const getAllUsers = async (req, res, db) => {
  try {
    const querySnapshot = await db.collection("users").get();
    if (querySnapshot.empty) {
      return res.status(404).json({ message: "No users found." });
    }
    const users = [];
    querySnapshot.forEach((doc) => {
      users.push(doc.data());
    });
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const isUserAFriend = async (req, res, db) => {
  const { id, friendId } = req.params;
  try {
    const userDoc = await db.collection("users").doc(id).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const userData = userDoc.data();
    const friendsList = userData.friends || [];
    const isFriend = friendsList.includes(friendId);

    res.status(200).json({ isFriend });
  } catch (error) {
    console.error("Error checking friendship:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const addNewFriend = async (req, res, db) => {
  const { id } = req.params;
  const { friendId } = req.body;
  try {
    const userDoc = await db.collection("users").doc(id).get();
    const friendDoc = await db.collection("users").doc(friendId).get();

    if (!userDoc.exists || !friendDoc.exists) {
      return res.status(404).json({ message: "User or Friend not found" });
    }

    const userData = userDoc.data();
    const friendsList = userData.friends || [];

    if (friendsList.includes(friendId)) {
      return res.status(400).json({ message: "Already friends" });
    }

    await db
      .collection("users")
      .doc(id)
      .update({
        friends: [...friendsList, friendId],
      });

    const friendData = friendDoc.data();
    const friendList = friendData.friends || [];
    await db
      .collection("users")
      .doc(friendId)
      .update({
        friends: [...friendList, id],
      });

    res.status(200).json({ message: "Friend added successfully" });
  } catch (error) {
    console.error("Error adding friend:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const removeFriend = async (req, res, db) => {
  const { id, friendId } = req.params;
  try {
    const userDoc = await db.collection("users").doc(id).get();
    if (!userDoc.exists) return res.status(404).json({ message: "User not found" });

    const userData = userDoc.data();
    const userFriendsList = userData.friends || [];
    const userFriendIndex = userFriendsList.indexOf(friendId);
    if (userFriendIndex === -1)
      return res.status(404).json({ message: "Friend not found" });

    userFriendsList.splice(userFriendIndex, 1);
    await db.collection("users").doc(id).update({
      friends: userFriendsList,
    });

    const friendDoc = await db.collection("users").doc(friendId).get();
    if (!friendDoc.exists) return res.status(404).json({ message: "Friend not found" });

    const friendData = friendDoc.data();
    const friendFriendsList = friendData.friends || [];
    const friendIndex = friendFriendsList.indexOf(id);
    if (friendIndex === -1)
      return res.status(404).json({ message: "User not found in friend's list" });

    friendFriendsList.splice(friendIndex, 1);
    await db.collection("users").doc(friendId).update({
      friends: friendFriendsList,
    });

    res
      .status(200)
      .json({ message: "Friend removed successfully from both users' lists" });
  } catch (error) {
    console.error("Error removing friend:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getUserFriends = async (req, res, db) => {
  const { id } = req.params;
  try {
    const userDoc = await db.collection("users").doc(id).get();
    if (!userDoc.exists) return res.status(404).json({ message: "User not found" });

    const userData = userDoc.data();
    const friendsList = userData.friends || [];
    res.status(200).json({ friends: friendsList });
  } catch (error) {
    console.error("Error retrieving friends list:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const updateAvatar = async (req, res, bucket) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  const imageFile = req.file;
  const fileName = req.params.id;
  const fileUpload = bucket.file(`profile_pictures/${fileName}`);

  try {
    // Check if there is an existing profile picture and delete it
    const [existingFiles] = await bucket.getFiles({
      prefix: "profile_pictures/",
    });

    // Find the file associated with the user, if exists, and delete it
    const userFile = existingFiles.find((file) => file.name.includes(req.params.id));
    if (userFile) {
      await bucket.file(userFile.name).delete();
    }
  } catch (error) {
    console.error("Error deleting existing profile picture:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }

  const stream = fileUpload.createWriteStream({
    metadata: {
      contentType: imageFile.mimetype,
    },
  });

  stream.on("error", (err) => {
    console.error("Error uploading to Firebase Storage:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  });

  stream.on("finish", () => {
    res.status(200).json({ message: "File uploaded successfully" });
  });

  stream.end(imageFile.buffer);
};

module.exports = {
  handleRegister,
  getUserbyID,
  updateUser,
  isUserAFriend,
  addNewFriend,
  removeFriend,
  getUserFriends,
  updateAvatar,
  getAllUsers,
};
