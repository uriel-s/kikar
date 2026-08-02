import { api } from "../lib/apiClient";

export const registerProfile = async ({ name, birthDate, address }) => {
  // The server takes id and email from the verified token, so they are not sent.
  const { data } = await api.post("/users", { name, birthDate, address });
  return data.user;
};

export const getUser = async (id) => {
  const { data } = await api.get(`/users/${id}`);
  return data.user;
};

export const listUsers = async ({ limit = 20, cursor } = {}) => {
  const { data } = await api.get("/users", { params: { limit, cursor } });
  return { users: data.users, nextCursor: data.nextCursor };
};

export const updateProfile = async (id, changes) => {
  const { data } = await api.patch(`/users/${id}`, changes);
  return data.user;
};

export const searchUsers = async (query) => {
  const { data } = await api.get("/users/search", { params: { q: query } });
  return data.users;
};

export const listFriends = async (id) => {
  const { data } = await api.get(`/users/${id}/friends`);
  return data.friends;
};

export const addFriend = async (userId, friendId) => {
  await api.post(`/users/${userId}/friends`, { friendId });
};

export const removeFriend = async (userId, friendId) => {
  await api.delete(`/users/${userId}/friends/${friendId}`);
};

export const uploadAvatar = async (id, file) => {
  const form = new FormData();
  form.append("avatar", file);

  const { data } = await api.put(`/users/${id}/avatar`, form);
  return data.user;
};
