import { api } from "../lib/apiClient";

export const registerProfile = async ({
  name,
  birthDate,
  address,
}: {
  name: string;
  birthDate: string | null;
  address: string | null;
}) => {
  // The server takes id and email from the verified token, so they are not sent.
  const { data } = await api.post("/users", { name, birthDate, address });
  return data.user;
};

export const getUser = async (id: string) => {
  const { data } = await api.get(`/users/${id}`);
  return data.user;
};

export const listUsers = async ({
  limit = 20,
  cursor,
}: { limit?: number; cursor?: string } = {}) => {
  const { data } = await api.get("/users", { params: { limit, cursor } });
  return { users: data.users, nextCursor: data.nextCursor };
};

export const updateProfile = async (id: string, changes: Record<string, unknown>) => {
  const { data } = await api.patch(`/users/${id}`, changes);
  return data.user;
};

export const searchUsers = async (query: string) => {
  const { data } = await api.get("/users/search", { params: { q: query } });
  return data.users;
};

export const listFriends = async (id: string) => {
  const { data } = await api.get(`/users/${id}/friends`);
  return data.friends;
};

export const addFriend = async (userId: string, friendId: string) => {
  await api.post(`/users/${userId}/friends`, { friendId });
};

export const removeFriend = async (userId: string, friendId: string) => {
  await api.delete(`/users/${userId}/friends/${friendId}`);
};

const requestAvatarUploadUrl = async (id: string): Promise<string> => {
  const { data } = await api.post(`/users/${id}/avatar/upload-url`);
  return data.uploadUrl;
};

const confirmAvatarUpload = async (id: string) => {
  const { data } = await api.put(`/users/${id}/avatar`);
  return data.user;
};

/**
 * Uploads a new avatar in three steps: ask this API for a presigned R2 URL,
 * PUT the file straight to R2 with it, then tell this API the upload is done
 * so it can validate and record it. The middle step deliberately bypasses
 * `api` (apiClient's axios instance) — R2 is a different origin than this
 * app's own API, and the presigned URL already carries its own authorization
 * in its query string, so attaching a Firebase bearer token here would be
 * meaningless and could break the URL's signature.
 */
export const uploadAvatar = async (id: string, file: File) => {
  const uploadUrl = await requestAvatarUploadUrl(id);

  const putResponse = await fetch(uploadUrl, { method: "PUT", body: file });
  if (!putResponse.ok) {
    throw new Error("Failed to upload image");
  }

  return confirmAvatarUpload(id);
};
