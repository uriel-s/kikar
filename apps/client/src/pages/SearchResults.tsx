import React, { useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import UserCard from "../Components/UserCard";
import PostCard from "../Components/PostCard";
import { useAuth } from "../contexts/AuthContext";
import { queryKeys } from "../lib/queryKeys";
import * as usersApi from "../api/users";
import * as postsApi from "../api/posts";

/**
 * The partial author shape a post carries — the same fields Avatar's own
 * `AvatarUser` accepts, and structurally the same shape PostCard.tsx's own
 * (non-exported) `PostAuthor` declares locally, for the same reason:
 * `api/posts.ts` still returns an untyped row, so this is not the place a
 * shared, stricter `User` type gets invented.
 */
interface PostAuthor {
  id?: string;
  name?: string;
  avatarUrl?: string | null;
}

/**
 * The feed shape this page reads and passes straight into `<PostCard
 * post={...} />` — structurally compatible with PostCard's own (non-exported)
 * local `Post` interface, which is not exported from PostCard.tsx.
 */
interface Post {
  id: string;
  author: PostAuthor;
  content: string;
  createdAt?: Date | string | number | null;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

/**
 * The user shape this page reads and passes straight into `<UserCard
 * user={...} />` — structurally compatible with UserCard's own (non-exported)
 * local `UserCardUser`, which is not exported from UserCard.tsx.
 */
interface SearchUser {
  id: string;
  name?: string;
  avatarUrl?: string | null;
}

const SearchResults = () => {
  // Covers only the like mutation's own failure — the search queries' own
  // errors are read straight off `usersQuery`/`postsQuery` each render rather
  // than mirrored into state. Combined with `loadError` below into the SAME
  // one `error` value the render ternary always used, so a failed like still
  // replaces the whole results view with `.search-error`, exactly like the
  // old single `error` state did — this page's error handling has always been
  // coarser than PostsPage's own top-banner pattern, and that quirk is
  // preserved rather than "fixed" here.
  const [actionError, setActionError] = useState("");
  const location = useLocation();
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();

  const { query, type } = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return {
      query: params.get("q") ?? "",
      type: params.get("type") ?? "all",
    };
  }, [location.search]);

  const trimmedOk = query.trim().length >= 2;
  const wantUsers = type === "all" || type === "users";
  const wantPosts = type === "all" || type === "posts";

  // Each result set is requested by its own query instead of being matched to
  // a position in a conditionally-built array, which is what made an earlier
  // version of this page assign post results to the users list for
  // type=posts. A distinct cache key per `query` also means an abandoned
  // in-flight request for an old search string can never clobber what's
  // rendered for the current one — the manual `cancelled` guard the old
  // effect needed for exactly that race is unnecessary by construction here.
  const usersQuery = useQuery<SearchUser[]>({
    queryKey: queryKeys.users.search(query),
    queryFn: () => usersApi.searchUsers(query),
    enabled: trimmedOk && wantUsers,
  });
  const postsQuery = useQuery<Post[]>({
    queryKey: queryKeys.posts.search(query),
    queryFn: () => postsApi.searchPosts(query),
    enabled: trimmedOk && wantPosts,
  });

  const users = usersQuery.data ?? [];
  const posts = postsQuery.data ?? [];

  // A disabled query's `isLoading` is always false, so when `type` excludes a
  // category that category never blocks this combined flag — matching the
  // old code's `Promise.resolve([])` stand-in for the unwanted category, which
  // always resolved instantly.
  const isLoading = usersQuery.isLoading || postsQuery.isLoading;

  // `strict` types a query's `error` as `unknown`, not `any` — narrow it
  // before reading `.message` rather than reaching for a cast.
  const loadError =
    (usersQuery.error instanceof Error
      ? usersQuery.error.message
      : usersQuery.error
        ? String(usersQuery.error)
        : "") ||
    (postsQuery.error instanceof Error
      ? postsQuery.error.message
      : postsQuery.error
        ? String(postsQuery.error)
        : "");
  const error = actionError || loadError;

  // Patches one post inside the posts-search query cache — the query-cache
  // equivalent of the old local-state `patchPost` helper, same call sites and
  // the same `Partial<Post>` merge semantics. Unlike PostsPage's feed cache,
  // the search cache holds a plain `Post[]`, not paginated data.
  const patchSearchPost = (postId: string, changes: Partial<Post>) => {
    queryClient.setQueryData<Post[]>(queryKeys.posts.search(query), (old) =>
      old?.map((post) => (post.id === postId ? { ...post, ...changes } : post))
    );
  };

  /**
   * Applies the like optimistically and rolls back if the request fails.
   *
   * The server owns the count, so its response is what finally lands — two
   * people liking at once no longer produces two different totals on screen.
   */
  const likeMutation = useMutation({
    mutationFn: ({ postId, isLiked }: { postId: string; isLiked: boolean }) =>
      isLiked ? postsApi.unlikePost(postId) : postsApi.likePost(postId),
    onMutate: ({ postId, isLiked }) => {
      const post = posts.find((candidate) => candidate.id === postId);
      if (post) {
        patchSearchPost(postId, {
          likedByMe: !isLiked,
          likeCount: post.likeCount + (isLiked ? -1 : 1),
        });
      }
      return { previous: post };
    },
    onSuccess: (likeCount, { postId }) => patchSearchPost(postId, { likeCount }),
    onError: (err, { postId }, context) => {
      if (context?.previous) {
        patchSearchPost(postId, {
          likedByMe: context.previous.likedByMe,
          likeCount: context.previous.likeCount,
        });
      }
      // `strict` types the catch binding `unknown`, not `any` — narrow it
      // before reading `.message` rather than reaching for a cast.
      setActionError(err instanceof Error ? err.message : String(err));
    },
  });
  const handleLike = (postId: string, isLiked: boolean) =>
    likeMutation.mutate({ postId, isLiked });

  const handleCommentAdded = (postId: string) => {
    const post = posts.find((candidate) => candidate.id === postId);
    if (post) patchSearchPost(postId, { commentCount: post.commentCount + 1 });
  };

  const total = users.length + posts.length;

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
              <h2>Users ({users.length})</h2>
              {users.length > 0 ? (
                /* A ul, not a div: UserCard renders a <li> now (see PostCard's
                   own comment below for why the same fix applies here). */
                <ul
                  className="search-results-grid"
                  style={{ listStyle: "none", margin: 0, padding: 0 }}
                >
                  {users.map((user) => (
                    <UserCard key={user.id} user={user} />
                  ))}
                </ul>
              ) : (
                <p className="no-results">No users found matching &quot;{query}&quot;</p>
              )}
            </section>
          )}

          {(type === "all" || type === "posts") && (
            <section className="search-results-section">
              <h2>Posts ({posts.length})</h2>
              {posts.length > 0 ? (
                /* A ul, not a div: PostCard renders a <li> now, and an <li>
                   with no list around it is an orphan — the browser keeps it
                   but assistive technology loses the "N items" the list
                   semantics carry. The legacy grid class still owns the
                   layout; only the element changed. */
                <ul
                  className="search-results-grid"
                  style={{ listStyle: "none", margin: 0, padding: 0 }}
                >
                  {posts.map((post) => (
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
