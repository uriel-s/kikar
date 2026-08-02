import React, { useState, useEffect, useCallback } from "react";
import PostCard from "../Components/PostCard";
import AddPostForm from "../Components/AddPost";
import { useAuth } from "../contexts/AuthContext";
import * as postsApi from "../api/posts";

const PostsPage = () => {
  const [posts, setPosts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const { currentUser } = useAuth();

  const loadFirstPage = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const { posts: page, nextCursor: cursor } = await postsApi.listPosts();
      setPosts(page);
      setNextCursor(cursor);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  const loadMore = async () => {
    if (!nextCursor || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const { posts: page, nextCursor: cursor } = await postsApi.listPosts({
        cursor: nextCursor,
      });
      setPosts((current) => [...current, ...page]);
      setNextCursor(cursor);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const patchPost = (postId, changes) =>
    setPosts((current) =>
      current.map((post) => (post.id === postId ? { ...post, ...changes } : post))
    );

  const handlePostCreated = (post) => {
    setPosts((current) => [post, ...current]);
  };

  /**
   * Applies the like optimistically and rolls back if the request fails.
   *
   * The server owns the count, so its response is what finally lands — two
   * people liking at once no longer produces two different totals on screen.
   */
  const handleLike = async (postId, isLiked) => {
    const post = posts.find((candidate) => candidate.id === postId);
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
    const post = posts.find((candidate) => candidate.id === postId);
    if (post) {
      patchPost(postId, { commentCount: post.commentCount + 1 });
    }
  };

  const handleDelete = async (postId) => {
    const snapshot = posts;
    setPosts((current) => current.filter((post) => post.id !== postId));

    try {
      await postsApi.deletePost(postId);
    } catch (err) {
      // A post someone else already deleted should stay gone on screen.
      if (err.status !== 404) {
        setPosts(snapshot);
      }
      setError(err.message);
    }
  };

  if (isLoading) {
    return <div className="loading">Loading posts...</div>;
  }

  return (
    <div className="posts-page">
      {error && <div className="alert alert-error">{error}</div>}

      <AddPostForm onPostCreated={handlePostCreated} />

      <div className="posts-container">
        {posts.length === 0 ? (
          <p className="no-results">No posts yet. Be the first to write one.</p>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUser={currentUser}
              onLike={handleLike}
              onCommentAdded={handleCommentAdded}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {nextCursor && (
        <button className="load-more-btn" onClick={loadMore} disabled={isLoadingMore}>
          {isLoadingMore ? "Loading..." : "Load more"}
        </button>
      )}
    </div>
  );
};

export default PostsPage;
