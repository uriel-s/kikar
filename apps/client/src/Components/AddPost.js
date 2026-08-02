import React, { useState } from "react";
import * as postsApi from "../api/posts";

const MAX_LENGTH = 5000;

const AddPostForm = ({ onPostCreated }) => {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormVisible, setFormVisible] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!text.trim()) {
      setError("Post content cannot be empty.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      // The author is taken from the verified token server-side, so nothing
      // about identity is sent from here.
      const post = await postsApi.createPost(text);
      onPostCreated(post);
      setText("");
      setFormVisible(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="add-post-form">
      {error && <div className="alert alert-error">{error}</div>}

      <button onClick={() => setFormVisible(!isFormVisible)} className="toggle-form-btn">
        {isFormVisible ? "Close Post Form" : "Create New Post"}
      </button>

      {isFormVisible && (
        <form onSubmit={handleSubmit}>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Write your post here..."
            maxLength={MAX_LENGTH}
            required
          />
          <div className="char-count">
            {text.length} / {MAX_LENGTH}
          </div>

          <div className="buttons">
            <button type="submit" disabled={isSubmitting || !text.trim()}>
              {isSubmitting ? "Posting..." : "Post"}
            </button>
            <button
              type="button"
              onClick={() => {
                setText("");
                setError("");
                setFormVisible(false);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default AddPostForm;
