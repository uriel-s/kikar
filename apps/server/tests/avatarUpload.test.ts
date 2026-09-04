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
 * this API hands out, and only reports back afterward. That POST lands on a
 * STAGING key, distinct from the PUBLIC key an existing avatar is already
 * served from — confirm only promotes staged bytes onto the public key once
 * its magic-byte check passes, which is what these tests seed and assert
 * against with `bucket.seed(...)` / `bucket.download(...)` /
 * `bucket.contentTypeOf(...)`, the fake's extras with no counterpart on the
 * real AvatarBucket, standing in for bytes and metadata that in production
 * never pass through this server at all.
 */
describe("avatar upload", () => {
  const PUBLIC_KEY = "profile_pictures/alice";
  const STAGING_KEY = "avatar_uploads/alice";

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
    // Simulates the browser's direct POST to R2 landing on the staging key —
    // that upload never reaches this server, so a test recreates it by
    // seeding the bucket directly rather than through the app.
    const appWith = (buffer?: Buffer) => {
      const bucket = fakeBucket();
      if (buffer) bucket.seed(STAGING_KEY, buffer);
      const setAvatarUrl = jest.fn(async () => ({ id: "alice", name: "Alice" }));
      const app = buildTestApp({ bucket, prisma: { user: { update: setAvatarUrl } } });
      return { app, bucket, setAvatarUrl };
    };

    it("promotes a real PNG that was uploaded directly to R2 onto the public key", async () => {
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
      // The promoted object's Content-Type must be tagged to what the magic
      // bytes actually are, never left as whatever the direct POST declared.
      expect(await bucket.download(PUBLIC_KEY)).toEqual(PNG);
      expect(bucket.contentTypeOf(PUBLIC_KEY)).toBe("image/png");
      // Promotion cleans up the staged object — nothing is left behind at
      // the staging key once it becomes the public one.
      expect(await bucket.download(STAGING_KEY)).toBeNull();
    });

    /**
     * The check that matters: R2 will store any bytes a client POSTs to a
     * presigned URL regardless of what it claims to be, so what is actually a
     * DOS executable ("MZ") has to be caught here, after the fact, rather than
     * trusted because a JPEG made it through. Written as "\u0090\0" escapes
     * rather than literal control characters for the same reason the original
     * test was: a literal NUL made git classify this file as binary, so every
     * edit to a security test showed up in review as "Bin nnnn -> nnnn bytes"
     * instead of a readable diff.
     */
    it("rejects a confirmed upload that is not a valid image, and discards the staged object", async () => {
      const { app, bucket, setAvatarUrl } = appWith(
        Buffer.from("MZ\u0090\0not an image at all")
      );
      const res = await request(app)
        .put("/api/users/alice/avatar")
        .set(authHeader("alice"));

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/not a valid/i);
      expect(setAvatarUrl).not.toHaveBeenCalled();
      expect(await bucket.download(STAGING_KEY)).toBeNull();
    });

    /**
     * The size check runs off a HEAD, not a downloaded buffer — see
     * config/storage.ts's `headSize` — so an oversized object is rejected
     * without this process ever pulling the full bytes into memory. The
     * download spy proves that: it must never be reached once the size check
     * alone was enough to reject and discard the staged object.
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
      expect(await bucket.download(STAGING_KEY)).toBeNull();
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

  /**
   * The regression this whole staging design exists to prevent: before it,
   * confirm validated a re-upload in place, at the SAME key an existing good
   * avatar was already being served from, so a rejected re-upload deleted
   * that pre-existing avatar along with the bad bytes. Now a re-upload lands
   * on the staging key, so a rejection can discard only the staged object —
   * the public key, and the DB row pointing at it, must be untouched.
   */
  describe("does not disturb an existing avatar when a re-upload is rejected", () => {
    const EXISTING_CONTENT_TYPE = "image/png";

    const appWithExistingAvatarAnd = (badUpload: Buffer) => {
      const bucket = fakeBucket();
      bucket.seed(PUBLIC_KEY, PNG, EXISTING_CONTENT_TYPE);
      bucket.seed(STAGING_KEY, badUpload);
      const setAvatarUrl = jest.fn(async () => ({ id: "alice", name: "Alice" }));
      const app = buildTestApp({ bucket, prisma: { user: { update: setAvatarUrl } } });
      return { app, bucket, setAvatarUrl };
    };

    it("survives a re-upload rejected for invalid magic bytes", async () => {
      const { app, bucket, setAvatarUrl } = appWithExistingAvatarAnd(
        Buffer.from("MZ\0not an image at all")
      );

      const res = await request(app)
        .put("/api/users/alice/avatar")
        .set(authHeader("alice"));

      expect(res.status).toBe(400);
      expect(setAvatarUrl).not.toHaveBeenCalled();
      expect(await bucket.download(PUBLIC_KEY)).toEqual(PNG);
      expect(bucket.contentTypeOf(PUBLIC_KEY)).toBe(EXISTING_CONTENT_TYPE);
      expect(await bucket.download(STAGING_KEY)).toBeNull();
    });

    it("survives a re-upload rejected for exceeding the 5MB cap", async () => {
      const { app, bucket, setAvatarUrl } = appWithExistingAvatarAnd(
        Buffer.alloc(5 * 1024 * 1024 + 1)
      );

      const res = await request(app)
        .put("/api/users/alice/avatar")
        .set(authHeader("alice"));

      expect(res.status).toBe(413);
      expect(setAvatarUrl).not.toHaveBeenCalled();
      expect(await bucket.download(PUBLIC_KEY)).toEqual(PNG);
      expect(bucket.contentTypeOf(PUBLIC_KEY)).toBe(EXISTING_CONTENT_TYPE);
      expect(await bucket.download(STAGING_KEY)).toBeNull();
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
