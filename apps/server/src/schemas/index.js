const { z } = require("zod");

const uuid = z.string().uuid("Must be a valid UUID");

// Firebase UIDs are 28-character alphanumeric strings, but the length is not
// contractual, so this stays a loose sanity check rather than an exact match.
const firebaseUid = z
  .string()
  .trim()
  .min(1, "User id is required")
  .max(128, "User id is too long")
  .regex(/^[A-Za-z0-9_-]+$/, "User id contains invalid characters");

const pagination = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().trim().min(1).optional(),
});

const searchQuery = z.object({
  q: z
    .string()
    .trim()
    .min(2, "Search query must be at least 2 characters long")
    .max(100, "Search query is too long"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Birth date must be in YYYY-MM-DD format")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Birth date is not a real date")
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

const userProfile = {
  name: z.string().trim().min(1, "Name is required").max(80, "Name is too long"),
  birthDate: isoDate.nullish(),
  address: z.string().trim().max(200, "Address is too long").nullish(),
};

const schemas = {
  registerUser: {
    // The uid and email come from the verified token, never from the body — a
    // client could otherwise register a profile under someone else's id.
    body: z.object(userProfile).strict(),
  },

  updateUser: {
    params: z.object({ id: firebaseUid }),
    body: z.object(userProfile).partial().strict(),
  },

  userId: {
    params: z.object({ id: firebaseUid }),
  },

  friendPair: {
    params: z.object({ id: firebaseUid, friendId: firebaseUid }),
  },

  addFriend: {
    params: z.object({ id: firebaseUid }),
    body: z.object({ friendId: firebaseUid }).strict(),
  },

  listUsers: { query: pagination },
  search: { query: searchQuery },

  createPost: {
    body: z
      .object({
        content: z
          .string()
          .trim()
          .min(1, "Post content cannot be empty")
          .max(5000, "Post content is too long"),
      })
      .strict(),
  },

  postId: {
    params: z.object({ postId: uuid }),
  },

  listPosts: { query: pagination },

  createComment: {
    params: z.object({ postId: uuid }),
    body: z
      .object({
        content: z
          .string()
          .trim()
          .min(1, "Comment cannot be empty")
          .max(1000, "Comment is too long"),
      })
      .strict(),
  },

  listComments: {
    params: z.object({ postId: uuid }),
    query: pagination,
  },
};

module.exports = { schemas, firebaseUid, uuid, pagination, searchQuery };
