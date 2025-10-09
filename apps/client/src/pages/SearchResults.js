// SearchResults.js
import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import UserCard from "../Components/UserCard";
import PostCard from "../Components/PostCard";
import { useAuth } from "../contexts/AuthContext";
import { apiUrl } from "../Global/config";

const SearchResults = () => {
  const [results, setResults] = useState({ users: [], posts: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const location = useLocation();
  const { currentUser } = useAuth();

  // Parse query parameters
  const getQueryParams = () => {
    const searchParams = new URLSearchParams(location.search);
    return {
      query: searchParams.get("q") || "",
      type: searchParams.get("type") || "all",
    };
  };

  const { query, type } = getQueryParams();

  useEffect(() => {
    const fetchSearchResults = async () => {
      if (!query.trim()) {
        setResults({ users: [], posts: [] });
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        // Determine which endpoints to call based on search type
        const endpoints = [];
        if (type === "all" || type === "users") {
          endpoints.push(
            axios.get(`${apiUrl}/users/search?q=${encodeURIComponent(query)}`)
          );
        }
        if (type === "all" || type === "posts") {
          endpoints.push(
            axios.get(`${apiUrl}/posts/search?q=${encodeURIComponent(query)}`)
          );
        }

        const responses = await Promise.all(endpoints);

        // Process responses based on search type
        let newResults = { users: [], posts: [] };

        if (type === "all" || type === "users") {
          // First response is user results if users were included
          const userResponse =
            type === "users" ? responses[0] : type === "all" ? responses[0] : null;
          if (userResponse && userResponse.data && userResponse.data.users) {
            newResults.users = userResponse.data.users;
          }
        }

        if (type === "all" || type === "posts") {
          // Get post results from the appropriate response
          const postResponse =
            type === "posts" ? responses[0] : type === "all" ? responses[1] : null;
          if (postResponse && postResponse.data && postResponse.data.posts) {
            newResults.posts = postResponse.data.posts;
          }
        }

        setResults(newResults);
      } catch (err) {
        console.error("Error fetching search results:", err);
        setError("Error during search. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSearchResults();
  }, [query, type]);

  const handleLike = async (postId, isLiked) => {
    try {
      const endpoint = isLiked ? `${apiUrl}/posts/unlike` : `${apiUrl}/posts/like`;
      await axios.post(endpoint, { postId, userId: currentUser.uid });

      // Update the posts in the state to reflect the change
      setResults((prevResults) => ({
        ...prevResults,
        posts: prevResults.posts.map((post) => {
          if (post.id === postId) {
            const likes = [...post.likes];
            if (isLiked) {
              // Remove user from likes array
              const userIndex = likes.indexOf(currentUser.uid);
              if (userIndex !== -1) likes.splice(userIndex, 1);
            } else {
              // Add user to likes array
              likes.push(currentUser.uid);
            }
            return { ...post, likes };
          }
          return post;
        }),
      }));
    } catch (err) {
      console.error("Error updating like status:", err);
    }
  };

  const handleComment = async (postId, comment) => {
    try {
      await axios.post(`${apiUrl}/posts/comment`, {
        postId,
        userId: currentUser.uid,
        content: comment,
      });

      // Refresh the post data to show the new comment
      const response = await axios.get(
        `${apiUrl}/posts/search?q=${encodeURIComponent(query)}`
      );
      if (response.data && response.data.posts) {
        setResults((prevResults) => ({
          ...prevResults,
          posts: response.data.posts,
        }));
      }
    } catch (err) {
      console.error("Error adding comment:", err);
    }
  };

  // Calculate total results
  const totalResults = results.users.length + results.posts.length;

  return (
    <div className="search-results-container">
      <div className="search-results-header">
        <h1>Search Results for "{query}"</h1>
        <p className="search-results-info">
          Found {totalResults} results in {type === "all" ? "users and posts" : type}
        </p>
      </div>

      {isLoading ? (
        <div className="search-loader">Loading...</div>
      ) : error ? (
        <div className="search-error">{error}</div>
      ) : (
        <div>
          {/* Display User Results */}
          {(type === "all" || type === "users") && (
            <div className="search-results-section">
              <h2>Users ({results.users.length})</h2>
              {results.users.length > 0 ? (
                <div className="search-results-grid">
                  {results.users.map((user) => (
                    <UserCard key={user.id} user={user} />
                  ))}
                </div>
              ) : (
                <p className="no-results">No users found matching "{query}"</p>
              )}
            </div>
          )}

          {/* Display Post Results */}
          {(type === "all" || type === "posts") && (
            <div className="search-results-section">
              <h2>Posts ({results.posts.length})</h2>
              {results.posts.length > 0 ? (
                <div className="search-results-grid">
                  {results.posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      currentUser={currentUser}
                      onLike={handleLike}
                      onComment={handleComment}
                    />
                  ))}
                </div>
              ) : (
                <p className="no-results">No posts found matching "{query}"</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchResults;
