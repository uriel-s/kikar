import type { z } from "zod";
import { Prisma } from "../generated/prisma";
import { ApiError } from "../lib/ApiError";
import { detectImageType } from "../lib/imageType";
import { authenticated } from "../middleware/auth";
import type { PathParams } from "../middleware/auth";
import type { createUserRepository } from "../repositories/userRepository";
import { schemas } from "@kikar/shared";
import { createStorageService, MAX_AVATAR_BYTES } from "../services/storageService";

const UNIQUE_VIOLATION = "P2002";
const RECORD_NOT_FOUND = "P2025";
const FOREIGN_KEY_VIOLATION = "P2003";

const isPrismaError = (err: unknown, code: string): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;

// The shapes validate() has already produced by the time a handler runs, read
// off the very schemas the routes are wired with. Deriving them means a schema
// change lands here as a compile error instead of as a runtime surprise, and
// keeps the promise that controllers never re-validate.
type RegisterBody = z.infer<typeof schemas.registerUser.body>;
type UpdateBody = z.infer<typeof schemas.updateUser.body>;
type UserIdParams = z.infer<typeof schemas.userId.params>;
type FriendPairParams = z.infer<typeof schemas.friendPair.params>;
type AddFriendBody = z.infer<typeof schemas.addFriend.body>;
type ListQuery = z.infer<typeof schemas.listUsers.query>;
type SearchQuery = z.infer<typeof schemas.search.query>;

export interface UserControllerDeps {
  users: ReturnType<typeof createUserRepository>;
  storage: ReturnType<typeof createStorageService>;
}

const createUserController = ({ users, storage }: UserControllerDeps) => ({
  /**
   * Creates the profile row for the caller's own Firebase account.
   *
   * Identity is taken from the verified token rather than the request body. The
   * old endpoint accepted whatever `id` and `email` the client sent, so anyone
   * could create or overwrite a profile under another person's uid.
   */
  register: authenticated<PathParams, RegisterBody>(async (req, res) => {
    try {
      const user = await users.create({
        id: req.user.uid,
        // Acknowledged cast, in the manner of the one in config/firebase.ts.
        // DecodedIdToken.email is optional — a phone- or custom-token account
        // has none — while users.email is NOT NULL, so such a token has always
        // produced a Prisma validation error and a generic 500. Turning that
        // into a 4xx would change behaviour, which this stage may not do, so
        // the cast records the gap rather than hiding it.
        email: req.user.email as string,
        ...req.body,
      });
      return res.status(201).json({ user });
    } catch (err) {
      if (isPrismaError(err, UNIQUE_VIOLATION)) {
        throw ApiError.conflict("A profile already exists for this account");
      }
      throw err;
    }
  }),

  getById: authenticated<UserIdParams>(async (req, res) => {
    const isSelf = req.params.id === req.user.uid;
    const user = await users.findById(req.params.id, { includePrivate: isSelf });

    if (!user) {
      throw ApiError.notFound("User not found");
    }
    return res.json({ user });
  }),

  update: authenticated<UserIdParams, UpdateBody>(async (req, res) => {
    try {
      const user = await users.update(req.params.id, req.body);
      return res.json({ user });
    } catch (err) {
      if (isPrismaError(err, RECORD_NOT_FOUND)) {
        throw ApiError.notFound("User not found");
      }
      throw err;
    }
  }),

  list: authenticated<PathParams, unknown, ListQuery>(async (req, res) => {
    const { items, nextCursor } = await users.list(req.query);
    return res.json({ users: items, nextCursor });
  }),

  search: authenticated<PathParams, unknown, SearchQuery>(async (req, res) => {
    const { items } = await users.search({
      query: req.query.q,
      limit: req.query.limit,
    });
    return res.json({ users: items });
  }),

  listFriends: authenticated<UserIdParams>(async (req, res) => {
    const friends = await users.listFriends(req.params.id);
    return res.json({ friends });
  }),

  isFriend: authenticated<FriendPairParams>(async (req, res) => {
    const isFriend = await users.areFriends(req.params.id, req.params.friendId);
    return res.json({ isFriend });
  }),

  addFriend: authenticated<UserIdParams, AddFriendBody>(async (req, res) => {
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
  }),

  removeFriend: authenticated<FriendPairParams>(async (req, res) => {
    try {
      await users.removeFriend(req.user.uid, req.params.friendId);
      return res.status(204).send();
    } catch (err) {
      if (isPrismaError(err, RECORD_NOT_FOUND)) {
        throw ApiError.notFound("You are not friends with this user");
      }
      throw err;
    }
  }),

  requestAvatarUploadUrl: authenticated<UserIdParams>(async (req, res) => {
    const { url, fields } = await storage.createAvatarUploadUrl(req.user.uid);
    return res.json({ url, fields });
  }),

  /**
   * Confirms a direct-to-R2 avatar upload and records its URL.
   *
   * The browser already POSTed the bytes to R2 using the presigned policy
   * from requestAvatarUploadUrl — this server never saw them in a request
   * body. What used to be multer's fileFilter plus this handler's own
   * magic-byte check, both before the save, is now one check after it:
   * download the object back and inspect its actual bytes, because a
   * declared `image/*` Content-Type (the policy's own condition) is not proof
   * of what the bytes actually are.
   *
   * The size check runs first, and against a HEAD rather than the downloaded
   * buffer. The presigned POST's own `content-length-range` condition already
   * stops an oversized object from landing in the first place, but this
   * backstop still runs — the confirm call is what proves the object is
   * within bounds from this process's own point of view, not R2's word alone.
   */
  updateAvatar: authenticated<UserIdParams>(async (req, res) => {
    const size = await storage.avatarSize(req.user.uid);
    if (size === null) {
      throw ApiError.badRequest("No image uploaded");
    }

    if (size > MAX_AVATAR_BYTES) {
      await storage.deleteAvatarObject(req.user.uid);
      throw ApiError.payloadTooLarge("Image must be 5MB or smaller");
    }

    const buffer = await storage.downloadAvatar(req.user.uid);
    if (!buffer) {
      throw ApiError.badRequest("No image uploaded");
    }

    const contentType = detectImageType(buffer);
    if (!contentType) {
      await storage.deleteAvatarObject(req.user.uid);
      throw ApiError.badRequest("File is not a valid JPEG, PNG, or WebP image");
    }

    // The detected type, never whatever the direct-to-R2 PUT declared, is what
    // gets served — see the "Avatar uploads" invariant in CLAUDE.md.
    await storage.setAvatarContentType(req.user.uid, contentType);

    const avatarUrl = storage.publicAvatarUrl(req.user.uid);
    const user = await users.setAvatarUrl(req.user.uid, avatarUrl);
    return res.json({ user });
  }),
});

export { createUserController };
