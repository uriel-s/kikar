const Post = require("../models/postModel");

const createPost = async (req, res, db) => {
  try {
    const { author, content } = req.body;
    if (!author || !content) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const newPost = new Post(author, content);
    const docRef = await db.collection("posts").add(newPost.toJSON()); // Use collection() and add() for Firebase v8
    res.status(201).json({ message: "Post created", post: newPost });
  } catch (error) {
    res.status(500).json({ message: "Error creating post", error: error.message });
  }
};

const unlikePost = async (req, res, db) => {
  const { postId, userId } = req.body;

  try {
    const postRef = db.collection("posts").doc(postId);
    const postSnapshot = await postRef.get();

    if (postSnapshot.exists) {
      const post = postSnapshot.data();

      // Make sure 'likes' is initialized as an array
      if (!Array.isArray(post.likes)) {
        post.likes = []; // Initialize likes as an empty array if it is not an array
      }

      // Check if the user has liked the post
      if (post.likes.includes(userId)) {
        // Remove userId from the likes array
        post.likes = post.likes.filter((like) => like !== userId);

        // Update the post in Firestore
        await postRef.update({ likes: post.likes });
        res.status(200).json({ message: "Like removed", likes: post.likes.length });
      } else {
        res.status(400).json({ message: "User has not liked this post yet" });
      }
    } else {
      res.status(404).json({ message: "Post not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error unliking post", error: error.message });
  }
};

const likePost = async (req, res, db) => {
  const { postId, userId } = req.body;

  try {
    const postRef = db.collection("posts").doc(postId);
    const postSnapshot = await postRef.get();

    if (postSnapshot.exists) {
      const post = postSnapshot.data();

      // Make sure 'likes' is initialized as an array
      if (!Array.isArray(post.likes)) {
        post.likes = []; // Initialize likes as an empty array if it is not an array
      }

      if (!post.likes.includes(userId)) {
        post.likes.push(userId);

        // Update the post in Firestore
        await postRef.update({ likes: post.likes });
        res.status(200).json({ message: "Like added", likes: post.likes.length });
      } else {
        res.status(400).json({ message: "User has already liked this post" });
      }
    } else {
      res.status(404).json({ message: "Post not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error liking post", error: error.message });
  }
};

const commentOnPost = async (req, res, db) => {
  const { postId, userId, text, userName } = req.body;
  try {
    const postRef = db.collection("posts").doc(postId); // Use doc() for Firebase v8
    const postSnapshot = await postRef.get(); // Use get() for Firebase v8

    if (postSnapshot.exists) {
      const post = postSnapshot.data();
      const newComment = {
        userId: userId,
        content: text,
        userName: userName,
        createdAt: new Date(),
      };
      if (!post.comments) {
        post.comments = [];
      }
      post.comments.push(newComment);

      // Update the post in Firestore
      await postRef.update({ comments: post.comments });
      res.status(200).json({ message: "Comment added", comments: post.comments });
    } else {
      res.status(404).json({ message: "Post not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error commenting on post", error: error.message });
  }
};

const getPosts = async (req, res, db) => {
  try {
    // Get all posts from Firestore, sorted by createdAt (descending)
    const postsRef = db.collection("posts");
    const snapshot = await postsRef.orderBy("createdAt", "desc").get(); // Use orderBy for sorting

    if (snapshot.empty) {
      return res.status(404).json({ message: "No posts found" });
    }

    const posts = snapshot.docs.map((doc) => {
      return { id: doc.id, ...doc.data() }; // Add the document ID to each post
    });

    res.status(200).json({ posts }); // Return the posts in descending order of createdAt
  } catch (error) {
    res.status(500).json({ message: "Error fetching posts", error: error.message });
  }
};

const getAllComments = async (req, res, db) => {
  const { postId } = req.params;
  try {
    const postRef = db.collection("posts").doc(postId);
    const postSnapshot = await postRef.get();
    if (!postSnapshot.exists) {
      return res.status(404).json({ message: "Post not found" });
    }
    const post = postSnapshot.data();
    res.status(200).json({ comments: post.comments || [] });
  } catch (error) {
    res.status(500).json({ message: "Error fetching comments", error: error.message });
  }
};

const getFirstComment = async (req, res, db) => {
  const { commnetID } = req.params;
  try {
    const snapshot = await db
      .collection("posts")
      .where("comments", "array-contains", { id: commnetID })
      .get();
    if (snapshot.empty) {
      return res.status(404).json({ message: "Comment not found" });
    }
    const post = snapshot.docs[0].data();
    const comment = post.comments.find((c) => c.id === commnetID);
    res.status(200).json({ comment });
  } catch (error) {
    res.status(500).json({ message: "Error fetching comment", error: error.message });
  }
};

const deletePost = async (req, res, db) => {
  const { postId } = req.params;

  // Try to get userId from multiple sources (in order of preference)
  let userId;
  if (req.user && req.user.uid) {
    userId = req.user.uid; // From Firebase Auth middleware
  } else if (req.body && req.body.userId) {
    userId = req.body.userId; // From request body as fallback
  } else {
    return res.status(401).json({ message: "Unauthorized: User ID not found" });
  }

  console.log("Using user ID:", userId);

  if (!postId) {
    return res.status(400).json({ message: "Post ID is required" });
  }

  try {
    const postRef = db.collection("posts").doc(postId);
    const postSnapshot = await postRef.get();

    if (!postSnapshot.exists) {
      return res.status(404).json({ message: "Post not found" });
    }

    const post = postSnapshot.data();
    console.log("Post author:", post.author, "User ID:", userId);

    // Verify that the user making the request is the owner of the post
    if (post.author !== userId) {
      return res
        .status(403)
        .json({ message: "You are not authorized to delete this post" });
    }

    // Delete the post from Firestore
    await postRef.delete();
    res.status(200).json({ message: "Post deleted successfully" });
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({ message: "Error deleting post", error: error.message });
  }
};

module.exports = {
  getPosts,
  createPost,
  likePost,
  commentOnPost,
  unlikePost,
  getFirstComment,
  getAllComments,
  deletePost,
};
