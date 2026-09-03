import type { z } from "zod";
import { Prisma } from "../generated/prisma";
import { ApiError } from "../lib/ApiError";
import { authenticated } from "../middleware/auth";
import type { PathParams } from "../middleware/auth";
import type { createPostRepository } from "../repositories/postRepository";
import { schemas } from "../schemas";

const FOREIGN_KEY_VIOLATION = "P2003";

const isPrismaError = (err: unknown, code: string): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;

// Read off the schemas the routes are wired with — see the note in
// userController: validate() has already produced these shapes, so a schema
// change is a compile error here rather than a runtime surprise.
type CreatePostBody = z.infer<typeof schemas.createPost.body>;
type CreateCommentBody = z.infer<typeof schemas.createComment.body>;
type PostIdParams = z.infer<typeof schemas.postId.params>;
type ListQuery = z.infer<typeof schemas.listPosts.query>;
type SearchQuery = z.infer<typeof schemas.search.query>;

export interface PostControllerDeps {
  posts: ReturnType<typeof createPostRepository>;
}

const createPostController = ({ posts }: PostControllerDeps) => ({
  /** The author is always the authenticated caller, never a body field. */
  create: authenticated<PathParams, CreatePostBody>(async (req, res) => {
    const post = await posts.create({
      authorId: req.user.uid,
      content: req.body.content,
      viewerId: req.user.uid,
    });
    return res.status(201).json({ post });
  }),

  /** Returns 200 with an empty array when there is nothing — not 404. */
  list: authenticated<PathParams, unknown, ListQuery>(async (req, res) => {
    const { items, nextCursor } = await posts.list({
      viewerId: req.user.uid,
      ...req.query,
    });
    return res.json({ posts: items, nextCursor });
  }),

  search: authenticated<PathParams, unknown, SearchQuery>(async (req, res) => {
    const { items } = await posts.search({
      query: req.query.q,
      viewerId: req.user.uid,
      limit: req.query.limit,
    });
    return res.json({ posts: items });
  }),

  remove: authenticated<PostIdParams>(async (req, res) => {
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
  }),

  like: authenticated<PostIdParams>(async (req, res) => {
    try {
      const { added, likeCount } = await posts.like(req.params.postId, req.user.uid);
      return res.status(added ? 201 : 200).json({ liked: true, likeCount });
    } catch (err) {
      if (isPrismaError(err, FOREIGN_KEY_VIOLATION)) {
        throw ApiError.notFound("Post not found");
      }
      throw err;
    }
  }),

  unlike: authenticated<PostIdParams>(async (req, res) => {
    const post = await posts.findById(req.params.postId);
    if (!post) {
      throw ApiError.notFound("Post not found");
    }

    const { likeCount } = await posts.unlike(req.params.postId, req.user.uid);
    return res.json({ liked: false, likeCount });
  }),

  /** Responds with the created comment, which is what the client renders. */
  addComment: authenticated<PostIdParams, CreateCommentBody>(async (req, res) => {
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
  }),

  listComments: authenticated<PostIdParams, unknown, ListQuery>(async (req, res) => {
    const post = await posts.findById(req.params.postId);
    if (!post) {
      throw ApiError.notFound("Post not found");
    }

    const { items, nextCursor } = await posts.listComments({
      postId: req.params.postId,
      ...req.query,
    });
    return res.json({ comments: items, nextCursor });
  }),
});

export { createPostController };
