import request from "supertest";
import { buildTestApp, authHeader } from "./helpers/testApp";

describe("request validation", () => {
  it("rejects an empty post", async () => {
    const create = jest.fn();
    const app = buildTestApp({ prisma: { post: { create } } });

    const res = await request(app)
      .post("/api/posts")
      .set(authHeader("alice"))
      .send({ content: "   " });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toContainEqual(
      expect.objectContaining({ field: "content" })
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a post over the length limit", async () => {
    const app = buildTestApp({ prisma: { post: { create: jest.fn() } } });

    const res = await request(app)
      .post("/api/posts")
      .set(authHeader("alice"))
      .send({ content: "x".repeat(5001) });

    expect(res.status).toBe(400);
  });

  it("rejects a malformed post id before touching the database", async () => {
    const findUnique = jest.fn();
    const app = buildTestApp({ prisma: { post: { findUnique } } });

    const res = await request(app)
      .delete("/api/posts/not-a-uuid")
      .set(authHeader("alice"));

    expect(res.status).toBe(400);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("rejects a one-character search query", async () => {
    const app = buildTestApp({ prisma: { user: { findMany: jest.fn() } } });

    const res = await request(app).get("/api/users/search?q=a").set(authHeader("alice"));

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].message).toMatch(/at least 2 characters/i);
  });

  it("caps the page size so a client cannot ask for everything", async () => {
    const findMany = jest.fn(async () => []);
    const app = buildTestApp({ prisma: { post: { findMany } } });

    const res = await request(app)
      .get("/api/posts?limit=100000")
      .set(authHeader("alice"));

    expect(res.status).toBe(400);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("applies a default page size when none is given", async () => {
    const findMany = jest.fn(async () => []);
    const app = buildTestApp({ prisma: { post: { findMany } } });

    await request(app).get("/api/posts").set(authHeader("alice"));

    // take is limit + 1: one extra row is what reveals whether a next page exists.
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 21 }));
  });

  it("rejects unknown fields instead of silently dropping them", async () => {
    const app = buildTestApp({ prisma: { user: { update: jest.fn() } } });

    const res = await request(app)
      .patch("/api/users/alice")
      .set(authHeader("alice"))
      .send({ name: "Alice", isAdmin: true });

    expect(res.status).toBe(400);
  });

  it("rejects a birth date that is not a real calendar date", async () => {
    const app = buildTestApp({ prisma: { user: { update: jest.fn() } } });

    const res = await request(app)
      .patch("/api/users/alice")
      .set(authHeader("alice"))
      .send({ birthDate: "2024-13-45" });

    expect(res.status).toBe(400);
  });

  it("answers malformed JSON with 400, not 500", async () => {
    const app = buildTestApp({ prisma: {} });

    const res = await request(app)
      .post("/api/posts")
      .set(authHeader("alice"))
      .set("Content-Type", "application/json")
      .send("{ not json");

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/not valid json/i);
  });

  it("returns an empty list rather than 404 when there are no posts", async () => {
    const app = buildTestApp({ prisma: { post: { findMany: async () => [] } } });

    const res = await request(app).get(`/api/posts`).set(authHeader("alice"));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ posts: [], nextCursor: null });
  });

  it("does not leak internal error details to the client", async () => {
    const app = buildTestApp({
      prisma: {
        post: {
          findMany: async () => {
            throw new Error("connection to db-prod-1.internal:5432 refused");
          },
        },
      },
    });

    const res = await request(app).get("/api/posts").set(authHeader("alice"));

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { message: "Internal server error" } });
    expect(JSON.stringify(res.body)).not.toMatch(/db-prod-1/);
  });

  it("routes /posts/search to search rather than treating it as a post id", async () => {
    const findMany = jest.fn(async () => []);
    const app = buildTestApp({ prisma: { post: { findMany } } });

    const res = await request(app)
      .get("/api/posts/search?q=hello")
      .set(authHeader("alice"));

    expect(res.status).toBe(200);
    expect(res.body.posts).toEqual([]);
  });
});

describe("pagination shape", () => {
  it("reports a next cursor only when more rows exist", async () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({
      id: `id-${i}`,
      content: "x",
      createdAt: new Date(0),
      authorId: "alice",
      author: { id: "alice", name: "Alice" },
      _count: { likes: 0, comments: 0 },
      likes: [],
    }));
    const app = buildTestApp({ prisma: { post: { findMany: async () => rows } } });

    const res = await request(app).get("/api/posts").set(authHeader("alice"));

    expect(res.body.posts).toHaveLength(20);
    expect(res.body.nextCursor).toBe("id-19");
  });

  it("reports a null cursor on the last page", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({
      id: `id-${i}`,
      content: "x",
      createdAt: new Date(0),
      authorId: "alice",
      author: { id: "alice", name: "Alice" },
      _count: { likes: 2, comments: 1 },
      likes: [{ userId: "alice" }],
    }));
    const app = buildTestApp({ prisma: { post: { findMany: async () => rows } } });

    const res = await request(app).get("/api/posts").set(authHeader("alice"));

    expect(res.body.nextCursor).toBeNull();
    // Counts, not raw arrays of every liker.
    expect(res.body.posts[0]).toMatchObject({
      likeCount: 2,
      commentCount: 1,
      likedByMe: true,
    });
  });
});
