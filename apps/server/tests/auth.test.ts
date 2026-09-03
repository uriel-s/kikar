import request from "supertest";
import { buildTestApp, authHeader } from "./helpers/testApp";

/**
 * These cover the hole that made the original API unsafe: every data route was
 * reachable with no credentials at all.
 */
describe("authentication", () => {
  const app = buildTestApp({ prisma: {} });

  // Narrowed to the four verbs actually listed, so `request(app)[method]` below
  // is a real lookup on supertest's agent rather than an index into a bare
  // string. A typo in the table is a compile error now.
  const protectedRoutes: ["get" | "post" | "patch" | "delete", string][] = [
    ["get", "/api/users"],
    ["get", "/api/users/search?q=ab"],
    ["get", "/api/users/someuid"],
    ["post", "/api/users"],
    ["patch", "/api/users/someuid"],
    ["get", "/api/posts"],
    ["post", "/api/posts"],
    ["delete", "/api/posts/6f1a2b3c-4d5e-4f60-8123-456789abcdef"],
  ];

  it.each(protectedRoutes)(
    "%s %s rejects a request with no token",
    async (method, path) => {
      const res = await request(app)[method](path);

      expect(res.status).toBe(401);
      expect(res.body.error.message).toMatch(/missing bearer token/i);
    }
  );

  it.each(protectedRoutes)("%s %s rejects a forged token", async (method, path) => {
    const res = await request(app)[method](path).set("Authorization", "Bearer forged");

    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/invalid or expired/i);
  });

  it("rejects an Authorization header that is not a bearer token", async () => {
    const res = await request(app)
      .get("/api/posts")
      .set("Authorization", "Basic dXNlcjpwYXNz");

    expect(res.status).toBe(401);
  });

  it("leaves /health open so load balancers can poll it", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("returns 404 as JSON for unknown routes", async () => {
    const res = await request(app).get("/api/nope").set(authHeader("alice"));

    expect(res.status).toBe(404);
    expect(res.body.error.message).toMatch(/no route matches/i);
  });
});
