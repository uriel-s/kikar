import request from "supertest";
import { buildTestApp, authHeader } from "./helpers/testApp";
import type { PrismaCallArgs } from "./helpers/testApp";

const POST_ID = "6f1a2b3c-4d5e-4f60-8123-456789abcdef";

/**
 * Authentication proves who is calling; these assert the separate question of
 * what that caller is allowed to touch. Each case is something the original API
 * permitted.
 */
describe("authorization", () => {
  describe("profiles", () => {
    const app = buildTestApp({
      prisma: {
        user: {
          update: jest.fn(async () => {
            throw new Error("must not reach the database");
          }),
        },
      },
    });

    it("refuses to let one user edit another user's profile", async () => {
      const res = await request(app)
        .patch("/api/users/bob")
        .set(authHeader("alice"))
        .send({ name: "Owned By Alice" });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/only modify your own account/i);
    });

    it("ignores an id in the registration body and uses the token's uid", async () => {
      // The <return, args> generics are what give the destructured `{ data }`
      // a type: jest infers a mock's parameters from its implementation, and a
      // stub that ignores them would otherwise infer none at all.
      const create = jest.fn<Promise<unknown>, [PrismaCallArgs]>(async ({ data }) => ({
        id: data.id,
        ...data,
      }));
      const scoped = buildTestApp({ prisma: { user: { create } } });

      await request(scoped)
        .post("/api/users")
        .set(authHeader("alice"))
        .send({ name: "Alice", id: "bob", email: "bob@example.test" });

      // The strict schema rejects the extra keys outright rather than letting
      // them silently reach the database.
      expect(create).not.toHaveBeenCalled();
    });

    it("registers using the identity carried by the verified token", async () => {
      const create = jest.fn<Promise<unknown>, [PrismaCallArgs]>(
        async ({ data }) => data
      );
      const scoped = buildTestApp({ prisma: { user: { create } } });

      const res = await request(scoped)
        .post("/api/users")
        .set(authHeader("alice"))
        .send({ name: "Alice" });

      expect(res.status).toBe(201);
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ id: "alice", email: "alice@example.test" }),
        })
      );
    });
  });

  describe("posts", () => {
    const appWithPostBy = (authorId: string, deleteSpy: jest.Mock = jest.fn()) =>
      buildTestApp({
        prisma: {
          post: {
            findUnique: async () => ({ id: POST_ID, authorId, content: "hi" }),
            delete: deleteSpy,
          },
        },
      });

    it("refuses to delete a post the caller does not own", async () => {
      const remove = jest.fn();
      const res = await request(appWithPostBy("bob", remove))
        .delete(`/api/posts/${POST_ID}`)
        .set(authHeader("alice"));

      expect(res.status).toBe(403);
      expect(remove).not.toHaveBeenCalled();
    });

    it("ignores a userId in the body when deciding ownership", async () => {
      const remove = jest.fn();
      const res = await request(appWithPostBy("bob", remove))
        .delete(`/api/posts/${POST_ID}`)
        .set(authHeader("alice"))
        .send({ userId: "bob" });

      expect(res.status).toBe(403);
      expect(remove).not.toHaveBeenCalled();
    });

    it("allows the author to delete their own post", async () => {
      const remove = jest.fn(async () => ({}));
      const res = await request(appWithPostBy("alice", remove))
        .delete(`/api/posts/${POST_ID}`)
        .set(authHeader("alice"));

      expect(res.status).toBe(204);
      expect(remove).toHaveBeenCalledWith({ where: { id: POST_ID } });
    });

    it("returns 404 rather than 403 when the post does not exist", async () => {
      const app = buildTestApp({
        prisma: { post: { findUnique: async () => null } },
      });

      const res = await request(app)
        .delete(`/api/posts/${POST_ID}`)
        .set(authHeader("alice"));

      expect(res.status).toBe(404);
    });
  });

  describe("friendships", () => {
    it("refuses to add friends on another user's behalf", async () => {
      const app = buildTestApp({ prisma: { friendship: { create: jest.fn() } } });

      const res = await request(app)
        .post("/api/users/bob/friends")
        .set(authHeader("alice"))
        .send({ friendId: "carol" });

      expect(res.status).toBe(403);
    });

    it("rejects befriending yourself", async () => {
      const app = buildTestApp({ prisma: { friendship: { create: jest.fn() } } });

      const res = await request(app)
        .post("/api/users/alice/friends")
        .set(authHeader("alice"))
        .send({ friendId: "alice" });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/cannot befriend yourself/i);
    });
  });

  describe("field visibility", () => {
    it("hides email, address, and birth date from other users", async () => {
      const findUnique = jest.fn<Promise<unknown>, [PrismaCallArgs]>(async () => ({
        id: "bob",
        name: "Bob",
      }));
      const app = buildTestApp({ prisma: { user: { findUnique } } });

      await request(app).get("/api/users/bob").set(authHeader("alice"));

      const { select } = findUnique.mock.calls[0][0];
      expect(select.email).toBeUndefined();
      expect(select.address).toBeUndefined();
      expect(select.birthDate).toBeUndefined();
    });

    it("includes them when a user reads their own profile", async () => {
      const findUnique = jest.fn<Promise<unknown>, [PrismaCallArgs]>(async () => ({
        id: "alice",
        name: "Alice",
      }));
      const app = buildTestApp({ prisma: { user: { findUnique } } });

      await request(app).get("/api/users/alice").set(authHeader("alice"));

      const { select } = findUnique.mock.calls[0][0];
      expect(select.email).toBe(true);
      expect(select.address).toBe(true);
      expect(select.birthDate).toBe(true);
    });
  });
});
