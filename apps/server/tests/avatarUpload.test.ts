import request from "supertest";
import { buildTestApp, authHeader, fakeBucket } from "./helpers/testApp";
import { detectImageType } from "../src/lib/imageType";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from("WEBP"),
  Buffer.from("VP8 "),
]);

describe("detectImageType", () => {
  it("recognizes the formats we accept", () => {
    expect(detectImageType(PNG)).toBe("image/png");
    expect(detectImageType(JPEG)).toBe("image/jpeg");
    expect(detectImageType(WEBP)).toBe("image/webp");
  });

  it("rejects anything else", () => {
    expect(detectImageType(Buffer.from("#!/bin/sh\nrm -rf /"))).toBeNull();
    expect(detectImageType(Buffer.from("PKzip"))).toBeNull();
    expect(detectImageType(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
    expect(detectImageType(undefined)).toBeNull();
  });

  it("does not accept a RIFF container that is not WebP", () => {
    // A .wav is also RIFF; only the WEBP form type may pass.
    const wav = Buffer.concat([
      Buffer.from("RIFF"),
      Buffer.from([0x24, 0x00, 0x00, 0x00]),
      Buffer.from("WAVE"),
    ]);
    expect(detectImageType(wav)).toBeNull();
  });
});

/**
 * Avatars now upload directly to R2: the browser POSTs to a presigned policy
 * this API hands out, and only reports back afterward. These tests simulate
 * that direct upload with `bucket.seed(...)` and inspect the result with
 * `bucket.contentTypeOf(...)` — the fake's two extras with no counterpart on
 * the real AvatarBucket, standing in for bytes and metadata that in
 * production never pass through this server at all.
 */
describe("avatar upload", () => {
  const AVATAR_KEY = "profile_pictures/alice";

  describe("POST /api/users/:id/avatar/upload-url", () => {
    it("returns a presigned upload policy for the caller's own avatar", async () => {
      const res = await request(buildTestApp())
        .post("/api/users/alice/avatar/upload-url")
        .set(authHeader("alice"));

      expect(res.status).toBe(200);
      expect(typeof res.body.url).toBe("string");
      expect(res.body.url.length).toBeGreaterThan(0);
      expect(res.body.fields).toEqual(
        expect.objectContaining({ key: expect.any(String) })
      );
    });
  });

  describe("PUT /api/users/:id/avatar (confirms a direct upload)", () => {
    const appWith = (buffer?: Buffer) => {
      const bucket = fakeBucket();
      if (buffer) bucket.seed(AVATAR_KEY, buffer);
      const setAvatarUrl = jest.fn(async () => ({ id: "alice", name: "Alice" }));
      const app = buildTestApp({ bucket, prisma: { user: { update: setAvatarUrl } } });
      return { app, bucket, setAvatarUrl };
    };

    it("stores a real PNG that was uploaded directly to R2", async () => {
      const { app, bucket, setAvatarUrl } = appWith(PNG);
      const res = await request(app)
        .put("/api/users/alice/avatar")
        .set(authHeader("alice"));

      expect(res.status).toBe(200);
      expect(res.body.user).toEqual({ id: "alice", name: "Alice" });
      expect(setAvatarUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "alice" },
          data: expect.objectContaining({
            avatarUrl: expect.stringContaining("profile_pictures/alice"),
          }),
        })
      );
      // The stored object's Content-Type must be re-tagged to what the magic
      // bytes actually are, never left as whatever the direct PUT declared.
      expect(bucket.contentTypeOf(AVATAR_KEY)).toBe("image/png");
    });

    /**
     * The check that matters: R2 will store any bytes a client PUTs to a
     * presigned URL regardless of what it claims to be, so what is actually a
     * DOS executable ("MZ") has to be caught here, after the fact, rather than
     * trusted because a JPEG made it through. Written as "\u0090\0" escapes
     * rather than literal control characters for the same reason the original
     * test was: a literal NUL made git classify this file as binary, so every
     * edit to a security test showed up in review as "Bin nnnn -> nnnn bytes"
     * instead of a readable diff.
     */
    it("rejects a confirmed upload that is not a valid image, and removes it from storage", async () => {
      const { app, bucket, setAvatarUrl } = appWith(
        Buffer.from("MZ\u0090\0not an image at all")
      );
      const res = await request(app)
        .put("/api/users/alice/avatar")
        .set(authHeader("alice"));

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/not a valid/i);
      expect(setAvatarUrl).not.toHaveBeenCalled();
      expect(await bucket.download(AVATAR_KEY)).toBeNull();
    });

    /**
     * The size check runs off a HEAD, not a downloaded buffer — see
     * config/storage.ts's `headSize` — so an oversized object is rejected
     * without this process ever pulling the full bytes into memory. The
     * download spy proves that: it must never be reached once the size check
     * alone was enough to reject and delete the object.
     */
    it("rejects a confirmed upload over the 5MB avatar cap, without downloading it", async () => {
      const { app, bucket, setAvatarUrl } = appWith(Buffer.alloc(5 * 1024 * 1024 + 1));
      const downloadSpy = jest.spyOn(bucket, "download");

      const res = await request(app)
        .put("/api/users/alice/avatar")
        .set(authHeader("alice"));

      expect(res.status).toBe(413);
      expect(setAvatarUrl).not.toHaveBeenCalled();
      expect(downloadSpy).not.toHaveBeenCalled();
      expect(await bucket.download(AVATAR_KEY)).toBeNull();
    });

    it("rejects confirmation when nothing has been uploaded yet", async () => {
      const { app, setAvatarUrl } = appWith();
      const res = await request(app)
        .put("/api/users/alice/avatar")
        .set(authHeader("alice"));

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/no image uploaded/i);
      expect(setAvatarUrl).not.toHaveBeenCalled();
    });
  });

  it("rejects unauthenticated or cross-user requests on both avatar endpoints", async () => {
    const app = buildTestApp();

    const noToken = await request(app).post("/api/users/alice/avatar/upload-url");
    expect(noToken.status).toBe(401);

    const noTokenConfirm = await request(app).put("/api/users/alice/avatar");
    expect(noTokenConfirm.status).toBe(401);

    const crossUserUploadUrl = await request(app)
      .post("/api/users/bob/avatar/upload-url")
      .set(authHeader("alice"));
    expect(crossUserUploadUrl.status).toBe(403);

    const crossUserConfirm = await request(app)
      .put("/api/users/bob/avatar")
      .set(authHeader("alice"));
    expect(crossUserConfirm.status).toBe(403);
  });
});
