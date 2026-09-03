import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import UserCard from "../Components/UserCard";
import PostCard from "../Components/PostCard";
import { useAuth } from "../contexts/AuthContext";
import * as usersApi from "../api/users";
import * as postsApi from "../api/posts";

const SearchResults = () => {
  const [results, setResults] = useState({ users: [], posts: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const location = useLocation();
  const { currentUser } = useAuth();

  const { query, type } = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return {
      query: params.get("q") ?? "",
      type: params.get("type") ?? "all",
    };
  }, [location.search]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (query.trim().length < 2) {
        setResults({ users: [], posts: [] });
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError("");
      try {
        // Each result set is requested by name instead of being matched to a
        // position in a conditionally-built array, which is what made the old
        // version assign post results to the users list for type=posts.
        const wantUsers = type === "all" || type === "users";
        const wantPosts = type === "all" || type === "posts";

        const [users, posts] = await Promise.all([
          wantUsers ? usersApi.searchUsers(query) : Promise.resolve([]),
          wantPosts ? postsApi.searchPosts(query) : Promise.resolve([]),
        ]);

        if (!cancelled) {
          setResults({ users, posts });
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    // Guards against an earlier, slower search overwriting a later one.
    return () => {
      cancelled = true;
    };
  }, [query, type]);

  const patchPost = (postId, changes) =>
    setResults((current) => ({
      ...current,
      posts: current.posts.map((post) =>
        post.id === postId ? { ...post, ...changes } : post
      ),
    }));

  const handleLike = async (postId, isLiked) => {
    const post = results.posts.find((candidate) => candidate.id === postId);
    if (!post) return;

    patchPost(postId, {
      likedByMe: !isLiked,
      likeCount: post.likeCount + (isLiked ? -1 : 1),
    });

    try {
      const likeCount = isLiked
        ? await postsApi.unlikePost(postId)
        : await postsApi.likePost(postId);
      patchPost(postId, { likeCount });
    } catch (err) {
      patchPost(postId, { likedByMe: post.likedByMe, likeCount: post.likeCount });
      setError(err.message);
    }
  };

  const handleCommentAdded = (postId) => {
    const post = results.posts.find((candidate) => candidate.id === postId);
    if (post) patchPost(postId, { commentCount: post.commentCount + 1 });
  };

  const total = results.users.length + results.posts.length;

  return (
    <div className="search-results-container">
      <div className="search-results-header">
        <h1>Search results for &quot;{query}&quot;</h1>
        {!isLoading && (
          <p className="search-results-info">
            Found {total} {total === 1 ? "result" : "results"} in{" "}
            {type === "all" ? "users and posts" : type}
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="search-loader">Loading...</div>
      ) : error ? (
        <div className="search-error">{error}</div>
      ) : (
        <>
          {(type === "all" || type === "users") && (
            <section className="search-results-section">
              <h2>Users ({results.users.length})</h2>
              {results.users.length > 0 ? (
                <div className="search-results-grid">
                  {results.users.map((user) => (
                    <UserCard key={user.id} user={user} />
                  ))}
                </div>
              ) : (
                <p className="no-results">No users found matching &quot;{query}&quot;</p>
              )}
            </section>
          )}

          {(type === "all" || type === "posts") && (
            <section className="search-results-section">
              <h2>Posts ({results.posts.length})</h2>
              {results.posts.length > 0 ? (
                /* A ul, not a div: PostCard renders a <li> now, and an <li>
                   with no list around it is an orphan — the browser keeps it
                   but assistive technology loses the "N items" the list
                   semantics carry. The legacy grid class still owns the
                   layout; only the element changed. */
                <ul
                  className="search-results-grid"
                  style={{ listStyle: "none", margin: 0, padding: 0 }}
                >
                  {results.posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      currentUser={currentUser}
                      onLike={handleLike}
                      onCommentAdded={handleCommentAdded}
                    />
                  ))}
                </ul>
              ) : (
                <p className="no-results">No posts found matching &quot;{query}&quot;</p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default SearchResults;
