import request from "supertest";
import { buildTestApp, authHeader } from "./helpers/testApp";
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
    expect(detectImageType(Buffer.from("PKzip"))).toBeNull();
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

describe("PUT /api/users/:id/avatar", () => {
  const appWith = (setAvatarUrl: jest.Mock = jest.fn(async () => ({ id: "alice" }))) =>
    buildTestApp({ prisma: { user: { update: setAvatarUrl } } });

  it("stores a real PNG", async () => {
    const update = jest.fn(async () => ({ id: "alice", name: "Alice" }));
    const res = await request(appWith(update))
      .put("/api/users/alice/avatar")
      .set(authHeader("alice"))
      .attach("avatar", PNG, { filename: "me.png", contentType: "image/png" });

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalled();
  });

  /**
   * The check that matters: declaring image/png gets a payload past multer's
   * fileFilter, so the bytes have to be inspected before anything is stored.
   *
   * "MZ" is the DOS executable magic - definitively not an image. The bytes
   * after it are written as "\u0090\0" escapes rather than literal control
   * characters: a literal NUL made git classify this file as binary, so every
   * edit to a security test showed up in review as "Bin nnnn -> nnnn bytes"
   * instead of a readable diff.
   */
  it("rejects a non-image disguised with an image Content-Type", async () => {
    const update = jest.fn();
    const res = await request(appWith(update))
      .put("/api/users/alice/avatar")
      .set(authHeader("alice"))
      .attach("avatar", Buffer.from("MZ\u0090\0not an image at all"), {
        filename: "payload.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/not a valid/i);
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses to let one user replace another user's avatar", async () => {
    const update = jest.fn();
    const res = await request(appWith(update))
      .put("/api/users/bob/avatar")
      .set(authHeader("alice"))
      .attach("avatar", PNG, { filename: "me.png", contentType: "image/png" });

    expect(res.status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    const res = await request(appWith())
      .put("/api/users/alice/avatar")
      .attach("avatar", PNG, { filename: "me.png", contentType: "image/png" });

    expect(res.status).toBe(401);
  });

  it("rejects a request with no file", async () => {
    const res = await request(appWith())
      .put("/api/users/alice/avatar")
      .set(authHeader("alice"));

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/no image uploaded/i);
  });
});
