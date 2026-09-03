import type { Prisma, PrismaClient } from "../generated/prisma";
import { PUBLIC_FIELDS, page } from "./userRepository";
import type { ListOptions } from "./userRepository";

// Same reason as PUBLIC_FIELDS in userRepository: `as const` keeps each member
// at `true` instead of widening to `boolean`, which is what lets PostRow below
// be derived from this selection rather than written out by hand and drifting
// from it.
const selectFor = (viewerId: string) =>
  ({
    id: true,
    content: true,
    createdAt: true,
    authorId: true,
    author: { select: PUBLIC_FIELDS },
    _count: { select: { likes: true, comments: true } },
    likes: { where: { userId: viewerId }, select: { userId: true } },
  }) as const satisfies Prisma.PostSelect;

/** A post row exactly as `selectFor` asks for it — the input toApiPost shapes. */
type PostRow = Prisma.PostGetPayload<{ select: ReturnType<typeof selectFor> }>;

export interface PostSearchOptions {
  query: string;
  viewerId: string;
  limit: number;
}

export interface CreatePostInput {
  authorId: string;
  content: string;
  viewerId: string;
}

export interface AddCommentInput {
  postId: string;
  authorId: string;
  content: string;
}

/**
 * Shapes a Prisma post row into the API response.
 *
 * likeCount and commentCount come from Prisma's _count, so the feed never ships
 * every liker's id to the browser just to render a number. `likedByMe` is
 * derived from a filtered include scoped to the caller.
 */
const toApiPost = (row: PostRow) => ({
  id: row.id,
  content: row.content,
  createdAt: row.createdAt,
  author: row.author,
  likeCount: row._count.likes,
  commentCount: row._count.comments,
  likedByMe: row.likes.length > 0,
});

const createPostRepository = (prisma: PrismaClient) => ({
  findById: (id: string) => prisma.post.findUnique({ where: { id } }),

  create: async ({ authorId, content, viewerId }: CreatePostInput) => {
    const row = await prisma.post.create({
      data: { authorId, content },
      select: selectFor(viewerId),
    });
    return toApiPost(row);
  },

  delete: (id: string) => prisma.post.delete({ where: { id } }),

  /** Newest-first feed, keyset-paginated. The old endpoint returned every post. */
  list: async ({ viewerId, limit, cursor }: ListOptions & { viewerId: string }) => {
    const rows = await prisma.post.findMany({
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: selectFor(viewerId),
    });
    const result = page(rows, limit, (row) => row.id);
    return { items: result.items.map(toApiPost), nextCursor: result.nextCursor };
  },

  search: async ({ query, viewerId, limit }: PostSearchOptions) => {
    const rows = await prisma.post.findMany({
      where: { content: { contains: query, mode: "insensitive" } },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: selectFor(viewerId),
    });
    return { items: rows.map(toApiPost) };
  },

  /**
   * Adds a like, reporting whether it was new.
   *
   * The unique constraint does the work: a second like from the same user is a
   * P2002 violation rather than a lost update. The old code read the likes
   * array, pushed to it, and wrote it back, so two simultaneous likes each saw
   * the pre-write state and one vanished.
   */
  like: async (postId: string, userId: string) => {
    const result = await prisma.like.createMany({
      data: [{ postId, userId }],
      skipDuplicates: true,
    });
    return { added: result.count > 0, likeCount: await countLikes(prisma, postId) };
  },

  unlike: async (postId: string, userId: string) => {
    const result = await prisma.like.deleteMany({ where: { postId, userId } });
    return { removed: result.count > 0, likeCount: await countLikes(prisma, postId) };
  },

  addComment: ({ postId, authorId, content }: AddCommentInput) =>
    prisma.comment.create({
      data: { postId, authorId, content },
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: { select: PUBLIC_FIELDS },
      },
    }),

  listComments: async ({ postId, limit, cursor }: ListOptions & { postId: string }) => {
    const rows = await prisma.comment.findMany({
      where: { postId },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: { select: PUBLIC_FIELDS },
      },
    });
    return page(rows, limit, (row) => row.id);
  },
});

const countLikes = (prisma: PrismaClient, postId: string) =>
  prisma.like.count({ where: { postId } });

export { createPostRepository, toApiPost };
