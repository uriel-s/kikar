import React, { useState, useEffect } from "react";
import axios from "axios";
import PostCard from "../Components/PostCard";
import AddPostForm from "../Components/AddPost";
import { apiUrl } from "../Global/config";
import { useAuth } from "../contexts/AuthContext";

const PostsPage = () => {
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const { currentUser } = useAuth();

  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${apiUrl}/posts`);
      setPosts(response.data.posts);
    } catch (error) {
      console.error("Error fetching posts:", error);
      setError("Failed to load posts.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleLike = async (postId, isLiked) => {
    if (!currentUser) {
      alert("You need to be logged in to like a post.");
      return;
    }
    try {
      const post = posts.find((p) => p.id === postId);
      if (isLiked) {
        await axios.post(`${apiUrl}/posts/unlike`, { postId, userId: currentUser.uid });
        setPosts((prevPosts) =>
          prevPosts.map((p) =>
            p.id === postId
              ? { ...p, likes: p.likes.filter((id) => id !== currentUser.uid) }
              : p
          )
        );
      } else {
        await axios.post(`${apiUrl}/posts/like`, { postId, userId: currentUser.uid });
        setPosts((prevPosts) =>
          prevPosts.map((p) =>
            p.id === postId ? { ...p, likes: [...p.likes, currentUser.uid] } : p
          )
        );
      }
    } catch (error) {
      console.error("Error handling like/unlike:", error);
    }
  };

  const handleComment = async (postId, commentText) => {
    if (!currentUser) {
      alert("You need to be logged in to comment.");
      return;
    }

    try {
      const userName = (await axios.get(`${apiUrl}/users/${currentUser.uid}`)).data.name;

      const response = await axios.post(`${apiUrl}/posts/comment`, {
        postId,
        userName: userName,
        userId: currentUser.uid,
        text: commentText,
      });

      const newComment = response.data.comment;

      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === postId
            ? {
                ...post,
                comments: post.comments ? [...post.comments, newComment] : [newComment],
              }
            : post
        )
      );
    } catch (error) {
      console.error("Error submitting comment:", error);
    }
  };

  const handleDelete = async (postId) => {
    if (!currentUser) {
      alert("You need to be logged in to delete a post.");
      return;
    }

    try {
      // Get the authentication token
      const token = await currentUser.getIdToken();

      // Debug logging
      console.log("Deleting post ID:", postId);
      console.log("Current user ID:", currentUser.uid);

      // Call the delete endpoint with the postId and userId
      await axios.delete(`${apiUrl}/posts/${postId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: {
          userId: currentUser.uid, // Add user ID in request body as a fallback
        },
      });

      // Update local state to remove the deleted post
      setPosts((prevPosts) => prevPosts.filter((post) => post.id !== postId));
    } catch (error) {
      console.error("Error deleting post:", error);

      if (error.response) {
        if (error.response.status === 403) {
          alert("You are not authorized to delete this post.");
        } else if (error.response.status === 404) {
          alert("Post not found.");
          setPosts((prevPosts) => prevPosts.filter((post) => post.id !== postId));
        } else {
          alert("Failed to delete post. Please try again.");
        }
      } else {
        alert("Failed to delete post. Please check your connection.");
      }
    }
  };

  if (isLoading) {
    return <div>Loading posts...</div>;
  }

  return (
    <div className="posts-page">
      {error && <div className="alert alert-error">{error}</div>}
      <AddPostForm setPosts={fetchPosts} />
      <div className="posts-container">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onLike={handleLike}
            onComment={handleComment}
            onDelete={handleDelete}
            currentUser={currentUser}
          />
        ))}
      </div>
    </div>
  );
};

export default PostsPage;
