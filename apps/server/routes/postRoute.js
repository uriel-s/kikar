const {
  createPost,
  likePost,
  commentOnPost,
  getPosts,
  unlikePost,
  getFirstComment,
  getAllComments,
  deletePost,
} = require("../controllers/postController");

const postRoute = (app, db) => {
  // Create a new post
  app.post("/posts", (req, res) => createPost(req, res, db));

  // Route to get all posts (sorted by createdAt, from newest to oldest)
  app.get("/posts", (req, res) => getPosts(req, res, db));

  // Like a post
  app.post("/posts/like", (req, res) => likePost(req, res, db));

  // UnLike a post
  app.post("/posts/unlike", (req, res) => unlikePost(req, res, db));

  // Comment on a post
  app.post("/posts/comment", (req, res) => commentOnPost(req, res, db));

  // Delete a post
  app.delete("/posts/:postId", (req, res) => deletePost(req, res, db));

  //get first comment
  app.get("/posts/comment/:postID", (req, res) => getFirstComment(req, res, db));

  //get all comment
  app.get("/posts/comments/:postId", (req, res) => getAllComments(req, res, db));
};

module.exports = postRoute;
