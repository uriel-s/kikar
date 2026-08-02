import React, { useState } from "react";
import axios from "axios";
import { apiUrl } from "../Global/config";
import { useAuth } from "../contexts/AuthContext";

const AddPostForm = ({ setPosts }) => {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isFormVisible, setFormVisible] = useState(false);
  const { currentUser } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    currentUser.getIdToken(true).then((token) => {
      console.log("Firebase Token:", token);
    });

    if (!currentUser) {
      alert("You need to be logged in to post.");
      return;
    }

    if (!text.trim()) {
      setError("Post content cannot be empty.");
      return;
    }

    try {
      const response = await axios.post(
        `${apiUrl}/posts`,
        { content: text, author: currentUser.uid },
        { headers: { "Content-Type": "application/json" } }
      );

      setPosts((prevPosts) => [response.data.post, ...prevPosts]);
      setText("");
      setSuccessMessage("Post added successfully!");
      setError("");
      setFormVisible(false); // Close the form after adding a post
    } catch (error) {
      setError("Error submitting post. Please try again.");
      console.error("Error submitting post:", error);
    }
  };

  return (
    <div className="add-post-form">
      {/* Feedback messages */}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Toggle button */}
      <button onClick={() => setFormVisible(!isFormVisible)} className="toggle-form-btn">
        {isFormVisible ? "Close Post Form" : "Create New Post"}
      </button>

      {isFormVisible && (
        <form onSubmit={handleSubmit}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write your post here..."
            required
          ></textarea>

          <div className="buttons">
            <button type="submit">Post</button>
            <button
              type="button"
              onClick={() => {
                setText("");
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
