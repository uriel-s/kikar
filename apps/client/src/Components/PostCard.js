import React, { useState } from "react";
import { FaThumbsUp, FaComment, FaTrash } from "react-icons/fa";
import * as postsApi from "../api/posts";
import Avatar from "./Avatar";

const PostCard = ({ post, currentUser, onLike, onCommentAdded, onDelete }) => {
  const [newComment, setNewComment] = useState("");
  const [comments, setComments] = useState([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Search results render posts without a delete handler, so the button is
  // hidden there rather than shown and inert.
  const canDelete = Boolean(onDelete) && currentUser?.uid === post.author.id;

  /**
   * Comments load when the reader asks for them, not on mount.
   *
   * Every card used to fetch the full comment list and the author's profile as
   * soon as it rendered, so opening the feed fired two requests per post before
   * anyone had clicked anything.
   */
  const toggleComments = async () => {
    if (showComments) {
      setShowComments(false);
      return;
    }

    setShowComments(true);
    if (commentsLoaded) return;

    try {
      const { comments: loaded } = await postsApi.listComments(post.id);
      setComments(loaded);
      setCommentsLoaded(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCommentSubmit = async (event) => {
    event.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError("");
    try {
      // Render what the server actually stored. The old code pushed the raw
      // input string into a list of comment objects, which is why the markup
      // had a JSON.stringify fallback for comments with no .content.
      const created = await postsApi.addComment(post.id, newComment);
      setComments((current) => [...current, created]);
      setCommentsLoaded(true);
      setShowComments(true);
      setNewComment("");
      onCommentAdded?.(post.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this post?")) {
      onDelete(post.id);
    }
  };

  return (
    <article className="post-card">
      <main className="pa3 black-80">
        <div className="post-card-header">
          <Avatar user={post.author} className="user-img" />
          <h3>{post.author.name}</h3>

          {canDelete && (
            <button className="delete-btn" onClick={handleDelete} title="Delete post">
              <FaTrash className="delete-icon" />
            </button>
          )}
        </div>

        <p className="post-content">{post.content}</p>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="post-actions">
          <button
            className={`like-btn ${post.likedByMe ? "liked" : ""}`}
            onClick={() => onLike(post.id, post.likedByMe)}
          >
            <FaThumbsUp /> {post.likedByMe ? "Unlike" : "Like"}
            {post.likeCount > 0 && ` (${post.likeCount})`}
          </button>

          <button className="comment-btn" onClick={toggleComments}>
            <FaComment /> {post.commentCount}{" "}
            {post.commentCount === 1 ? "comment" : "comments"}
          </button>
        </div>

        {showComments && (
          <div className="comment-section">
            {comments.length === 0 && commentsLoaded && (
              <p className="no-results">No comments yet.</p>
            )}
            {comments.map((comment) => (
              <div key={comment.id} className="comment">
                <p>
                  <strong>{comment.author.name}: </strong>
                  {comment.content}
                </p>
              </div>
            ))}
          </div>
        )}

        <form className="new-comment" onSubmit={handleCommentSubmit}>
          <input
            type="text"
            value={newComment}
            onChange={(event) => setNewComment(event.target.value)}
            placeholder="Write a comment..."
            maxLength={1000}
          />
          <button type="submit" disabled={!newComment.trim() || isSubmitting}>
            {isSubmitting ? "Posting..." : "Post"}
          </button>
        </form>
      </main>
    </article>
  );
};

export default PostCard;
