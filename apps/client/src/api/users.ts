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

interface AvatarUploadPolicy {
  url: string;
  fields: Record<string, string>;
}

const requestAvatarUploadUrl = async (id: string): Promise<AvatarUploadPolicy> => {
  const { data } = await api.post(`/users/${id}/avatar/upload-url`);
  return { url: data.url, fields: data.fields };
};

const confirmAvatarUpload = async (id: string) => {
  const { data } = await api.put(`/users/${id}/avatar`);
  return data.user;
};

/**
 * Uploads a new avatar in three steps: ask this API for a presigned R2 POST
 * policy, submit the file straight to R2 as multipart form data, then tell
 * this API the upload is done so it can validate and record it. The middle
 * step deliberately bypasses `api` (apiClient's axios instance) — R2 is a
 * different origin than this app's own API, and the policy's fields already
 * carry their own authorization, so attaching a Firebase bearer token here
 * would be meaningless and could break the policy's signature.
 *
 * R2's own policy (a size ceiling, an `image/*` Content-Type prefix) rejects
 * a bad upload outright, before this app's confirm step ever runs — every
 * field the policy returned must be included as its own form field, and
 * `Content-Type` plus the file itself must come last, or R2 rejects the
 * whole submission.
 */
export const uploadAvatar = async (id: string, file: File) => {
  const { url, fields } = await requestAvatarUploadUrl(id);

  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => formData.append(key, value));
  formData.append("Content-Type", file.type);
  formData.append("file", file);

  const postResponse = await fetch(url, { method: "POST", body: formData });
  if (!postResponse.ok) {
    throw new Error("Failed to upload image");
  }

  return confirmAvatarUpload(id);
};
