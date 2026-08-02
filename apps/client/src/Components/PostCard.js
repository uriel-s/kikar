import React, { useState, useEffect } from "react";
import { FaThumbsUp, FaComment, FaThumbsDown, FaTrash, FaTimes } from "react-icons/fa";
import axios from "axios";
import { apiUrl } from "../Global/config";
import { getStorage, ref, getDownloadURL } from "firebase/storage";
import { useAuth } from "../contexts/AuthContext"; // To access currentUser

const PostCard = ({ post, onLike, onComment, onDelete, currentUser }) => {
  const [user, setUser] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [isLiked, setIsLiked] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [showAllComments, setShowAllComments] = useState(false);
  const [comments, setComments] = useState([]);

  // Fetch user data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await axios.get(`${apiUrl}/users/${post.author}`);
        setUser(response.data);
      } catch (error) {
        console.error("Error fetching user data", error);
      }
    };

    fetchUser();
  }, [post.author, apiUrl]);

  // Fetch profile picture
  useEffect(() => {
    if (user) {
      const fetchImageUrl = async () => {
        try {
          const storage = getStorage();
          const profilePictureRef = ref(storage, `profile_pictures/${user.id}`);
          const url = await getDownloadURL(profilePictureRef);
          setImageUrl(url);
        } catch (error) {
          if (error.code === "storage/object-not-found") {
            setImageUrl(null);
          } else {
            console.error("Error getting profile picture:", error);
          }
        }
      };

      fetchImageUrl();
    }
  }, [user]);

  // Check if the current user has already liked the post
  useEffect(() => {
    if (currentUser) {
      const isUserLiked = post.likes.includes(currentUser.uid);
      setIsLiked(isUserLiked);
    }
  }, [post.likes, currentUser]);

  // Fetch comments for the post
  useEffect(() => {
    const fetchComments = async () => {
      try {
        const response = await axios.get(`${apiUrl}/posts/comments/${post.id}`);
        setComments(response.data.comments);
      } catch (error) {
        console.error("Error fetching comments", error);
      }
    };
    fetchComments();
  }, [post.id, post.comments.length]);

  const handleLike = () => {
    if (!currentUser) {
      alert("You need to be logged in to like a post.");
      return;
    }

    onLike(post.id, isLiked); // Pass the current like status (isLiked) to handleLike in PostsPage
  };

  const handleCommentSubmit = () => {
    onComment(post.id, newComment);
    setComments((prevComments) => [...prevComments, newComment]);
  };

  const handleCommentToggle = () => {
    setShowAllComments(!showAllComments);
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this post?")) {
      onDelete(post.id);
    }
  };

  if (!user) return <div>Loading...</div>;

  return (
    <article className="post-card">
      <main className="pa3 black-80">
        <div className="post-card-header">
          <div className="avatar-container">
            <img
              src={imageUrl || "/default-profile-pic.jpg"}
              alt="Author"
              className="user-img"
            />
          </div>
          <h3>{user.name}</h3>

          {/* Keep only one delete button */}
          {currentUser && currentUser.uid === post.author && (
            <button className="delete-btn" onClick={handleDelete} title="Delete post">
              <FaTrash className="delete-icon" />
            </button>
          )}
        </div>
        <p>{post.content}</p>
        <div className="like-count">{post.likes.length} Likes</div>
        <div className="post-actions">
          <button className={`like-btn ${!isLiked ? "" : "liked"}`} onClick={handleLike}>
            {isLiked ? <FaThumbsDown /> : <FaThumbsUp />}
            {isLiked ? "Unlike" : "Like"}
          </button>
        </div>

        <div className="comment-section">
          {comments.length > 0 && (
            <>
              <div className="comment">
                <p>
                  <strong>{comments[0]?.userName || "Unknown"}: </strong>
                  {comments[0]?.content
                    ? comments[0].content
                    : JSON.stringify(comments[0])}
                </p>
              </div>

              {showAllComments && (
                <div className="all-comments">
                  <hr className="comment-divider" />
                  {comments.slice(1).map((comment, index) => (
                    <div key={index} className="comment">
                      <p>
                        <strong>{comment.userName || "Unknown"}: </strong>
                        {comment.content ? comment.content : JSON.stringify(comment)}
                      </p>
                      {index !== comments.length - 1 && (
                        <hr className="comment-divider" />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {comments.length > 1 && (
                <button className="see-all-comments-btn" onClick={handleCommentToggle}>
                  {showAllComments ? "Show less" : "Show all comments"}
                </button>
              )}
            </>
          )}

          <div className="new-comment">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
            />
            <button onClick={handleCommentSubmit} disabled={!newComment}>
              Post
            </button>
          </div>
        </div>
      </main>
    </article>
  );
};

export default PostCard;
