const { Prisma } = require("../generated/prisma");
const ApiError = require("../lib/ApiError");
const { detectImageType } = require("../lib/imageType");

const UNIQUE_VIOLATION = "P2002";
const RECORD_NOT_FOUND = "P2025";
const FOREIGN_KEY_VIOLATION = "P2003";

const isPrismaError = (err, code) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;

const createUserController = ({ users, storage }) => ({
  /**
   * Creates the profile row for the caller's own Firebase account.
   *
   * Identity is taken from the verified token rather than the request body. The
   * old endpoint accepted whatever `id` and `email` the client sent, so anyone
   * could create or overwrite a profile under another person's uid.
   */
  register: async (req, res) => {
    try {
      const user = await users.create({
        id: req.user.uid,
        email: req.user.email,
        ...req.body,
      });
      return res.status(201).json({ user });
    } catch (err) {
      if (isPrismaError(err, UNIQUE_VIOLATION)) {
        throw ApiError.conflict("A profile already exists for this account");
      }
      throw err;
    }
  },

  getById: async (req, res) => {
    const isSelf = req.params.id === req.user.uid;
    const user = await users.findById(req.params.id, { includePrivate: isSelf });

    if (!user) {
      throw ApiError.notFound("User not found");
    }
    return res.json({ user });
  },

  update: async (req, res) => {
    try {
      const user = await users.update(req.params.id, req.body);
      return res.json({ user });
    } catch (err) {
      if (isPrismaError(err, RECORD_NOT_FOUND)) {
        throw ApiError.notFound("User not found");
      }
      throw err;
    }
  },

  list: async (req, res) => {
    const { items, nextCursor } = await users.list(req.query);
    return res.json({ users: items, nextCursor });
  },

  search: async (req, res) => {
    const { items } = await users.search({
      query: req.query.q,
      limit: req.query.limit,
    });
    return res.json({ users: items });
  },

  listFriends: async (req, res) => {
    const friends = await users.listFriends(req.params.id);
    return res.json({ friends });
  },

  isFriend: async (req, res) => {
    const isFriend = await users.areFriends(req.params.id, req.params.friendId);
    return res.json({ isFriend });
  },

  addFriend: async (req, res) => {
    const { friendId } = req.body;

    if (friendId === req.user.uid) {
      throw ApiError.badRequest("You cannot befriend yourself");
    }

    try {
      await users.addFriend(req.user.uid, friendId);
      return res.status(201).json({ message: "Friend added" });
    } catch (err) {
      if (isPrismaError(err, UNIQUE_VIOLATION)) {
        throw ApiError.conflict("Already friends");
      }
      // The friendship row references a user that does not exist.
      if (isPrismaError(err, FOREIGN_KEY_VIOLATION)) {
        throw ApiError.notFound("User not found");
      }
      throw err;
    }
  },

  removeFriend: async (req, res) => {
    try {
      await users.removeFriend(req.user.uid, req.params.friendId);
      return res.status(204).send();
    } catch (err) {
      if (isPrismaError(err, RECORD_NOT_FOUND)) {
        throw ApiError.notFound("You are not friends with this user");
      }
      throw err;
    }
  },

  /**
   * Replaces the caller's avatar and stores the resulting URL.
   *
   * The old handler listed every object under profile_pictures/ and deleted the
   * first whose name merely *contained* the uid — so a user whose id was a
   * prefix of another's could delete somebody else's picture. It also wrote the
   * response inside a stream callback after already having returned on error,
   * which could send headers twice.
   */
  updateAvatar: async (req, res) => {
    if (!req.file) {
      throw ApiError.badRequest("No image uploaded");
    }

    // multer's fileFilter only saw the Content-Type the client claimed. This is
    // the check that actually holds: the bytes have to be a real JPEG, PNG, or
    // WebP, and the type we store is the one we detected, never the declared one.
    const contentType = detectImageType(req.file.buffer);
    if (!contentType) {
      throw ApiError.badRequest("File is not a valid JPEG, PNG, or WebP image");
    }

    const avatarUrl = await storage.uploadAvatar({
      uid: req.user.uid,
      buffer: req.file.buffer,
      contentType,
    });

    const user = await users.setAvatarUrl(req.user.uid, avatarUrl);
    return res.json({ user });
  },
});

module.exports = { createUserController };
