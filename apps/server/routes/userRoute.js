const multer = require('multer');
const { updateAvatar, handleRegister, getUserbyID, getAllUsers, updateUser, isUserAFriend, addNewFriend, removeFriend, getUserFriends } = require('../controllers/userController');
const { AvatarMulter } = require('../utils/multer');

// Routes functions
const userRoute = (app, db, bucket) => {
    // Register a new user
    app.post('/users', (req, res) => handleRegister(req, res, db));
    
    // Get user details by  (ID)
    app.get('/users/:id', (req, res) => getUserbyID(req, res, db));

    // Get all users
    app.get('/users', (req, res) => getAllUsers(req, res, db));

    // Update user details
    app.put('/users/:id', async (req, res) =>   updateUser(req, res, db));

    // Add a new friend
    app.post('/users/:id/friends', (req, res) => addNewFriend(req, res, db));

    // Remove a friend
    app.delete('/users/:id/friends/:friendId', (req, res) => removeFriend(req, res, db));

    // Get user's friends list
    app.get('/users/:id/friends', (req, res) => getUserFriends(req, res, db));

    // Check if a user is a friend
    app.get('/users/:id/isFriend/:friendId', (req, res) => isUserAFriend(req, res, db));

    // Upload avatar
    app.post('/users/avatar/:id', AvatarMulter.single('avatar'), async (req, res) => {
        try {
            await updateAvatar(req, res, bucket);
        } catch (error) {
            res.status(500).send('Error uploading avatar');
        }
    });
};

module.exports = userRoute;
