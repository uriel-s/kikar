import { api } from "../lib/apiClient";

/**
 * Posts arrive with the author embedded and likes/comments as counts, so
 * rendering a feed is one request. Each PostCard used to fetch its own author
 * and its own comment list, turning a 20-post feed into 41 requests.
 */
export const listPosts = async ({
  limit = 20,
  cursor,
}: { limit?: number; cursor?: string } = {}) => {
  const { data } = await api.get("/posts", { params: { limit, cursor } });
  return { posts: data.posts, nextCursor: data.nextCursor };
};

export const searchPosts = async (query: string) => {
  const { data } = await api.get("/posts/search", { params: { q: query } });
  return data.posts;
};

export const createPost = async (content: string) => {
  const { data } = await api.post("/posts", { content });
  return data.post;
};

export const deletePost = async (postId: string) => {
  await api.delete(`/posts/${postId}`);
};

export const likePost = async (postId: string) => {
  const { data } = await api.put(`/posts/${postId}/like`);
  return data.likeCount;
};

export const unlikePost = async (postId: string) => {
  const { data } = await api.delete(`/posts/${postId}/like`);
  return data.likeCount;
};

export const listComments = async (
  postId: string,
  { limit = 20, cursor }: { limit?: number; cursor?: string } = {}
) => {
  const { data } = await api.get(`/posts/${postId}/comments`, {
    params: { limit, cursor },
  });
  return { comments: data.comments, nextCursor: data.nextCursor };
};

export const addComment = async (postId: string, content: string) => {
  const { data } = await api.post(`/posts/${postId}/comments`, { content });
  return data.comment;
};
