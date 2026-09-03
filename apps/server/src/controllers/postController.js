const { Prisma } = require("../generated/prisma");
const { ApiError } = require("../lib/ApiError");

const FOREIGN_KEY_VIOLATION = "P2003";

const isPrismaError = (err, code) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;

const createPostController = ({ posts }) => ({
  /** The author is always the authenticated caller, never a body field. */
  create: async (req, res) => {
    const post = await posts.create({
      authorId: req.user.uid,
      content: req.body.content,
      viewerId: req.user.uid,
    });
    return res.status(201).json({ post });
  },

  /** Returns 200 with an empty array when there is nothing — not 404. */
  list: async (req, res) => {
    const { items, nextCursor } = await posts.list({
      viewerId: req.user.uid,
      ...req.query,
    });
    return res.json({ posts: items, nextCursor });
  },

  search: async (req, res) => {
    const { items } = await posts.search({
      query: req.query.q,
      viewerId: req.user.uid,
      limit: req.query.limit,
    });
    return res.json({ posts: items });
  },

  remove: async (req, res) => {
    const post = await posts.findById(req.params.postId);

    if (!post) {
      throw ApiError.notFound("Post not found");
    }
    // Ownership is checked against the verified token. The old handler fell back
    // to req.body.userId when no middleware had populated req.user — and no
    // middleware ever did — so any caller could delete any post by naming its
    // author.
    if (post.authorId !== req.user.uid) {
      throw ApiError.forbidden("You can only delete your own posts");
    }

    await posts.delete(req.params.postId);
    return res.status(204).send();
  },

  like: async (req, res) => {
    try {
      const { added, likeCount } = await posts.like(req.params.postId, req.user.uid);
      return res.status(added ? 201 : 200).json({ liked: true, likeCount });
    } catch (err) {
      if (isPrismaError(err, FOREIGN_KEY_VIOLATION)) {
        throw ApiError.notFound("Post not found");
      }
      throw err;
    }
  },

  unlike: async (req, res) => {
    const post = await posts.findById(req.params.postId);
    if (!post) {
      throw ApiError.notFound("Post not found");
    }

    const { likeCount } = await posts.unlike(req.params.postId, req.user.uid);
    return res.json({ liked: false, likeCount });
  },

  /** Responds with the created comment, which is what the client renders. */
  addComment: async (req, res) => {
    try {
      const comment = await posts.addComment({
        postId: req.params.postId,
        authorId: req.user.uid,
        content: req.body.content,
      });
      return res.status(201).json({ comment });
    } catch (err) {
      if (isPrismaError(err, FOREIGN_KEY_VIOLATION)) {
        throw ApiError.notFound("Post not found");
      }
      throw err;
    }
  },

  listComments: async (req, res) => {
    const post = await posts.findById(req.params.postId);
    if (!post) {
      throw ApiError.notFound("Post not found");
    }

    const { items, nextCursor } = await posts.listComments({
      postId: req.params.postId,
      ...req.query,
    });
    return res.json({ comments: items, nextCursor });
  },
});

module.exports = { createPostController };
