/**
 * Single source of truth for TanStack Query cache keys.
 *
 * Data-fetching components read and write the query cache from different
 * files that don't otherwise share code — e.g. AddPost.tsx prepends a newly
 * created post directly into PostsPage.tsx's feed cache via
 * `queryClient.setQueryData`. If each file typed its own key literal, a typo
 * in either one would silently split the cache instead of erroring. Importing
 * from here instead makes that class of bug a compile error.
 */
export const queryKeys = {
  posts: {
    feed: () => ["posts", "feed"] as const,
    search: (query: string) => ["posts", "search", query] as const,
    comments: (postId: string) => ["posts", postId, "comments"] as const,
  },
  users: {
    list: () => ["users", "list"] as const,
    search: (query: string) => ["users", "search", query] as const,
    friends: (uid: string) => ["users", uid, "friends"] as const,
    detail: (uid: string) => ["users", uid] as const,
  },
};
