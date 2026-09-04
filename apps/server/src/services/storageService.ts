// R2 enforces this ceiling itself via the presigned POST's own
// `content-length-range` condition, so an oversized object can never land in
// the first place — this is also the backstop the confirm step re-checks
// (belt-and-suspenders: the policy condition is R2's word, not this
// process's, and a confirm call still runs against a real HEAD).
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/**
 * The four operations this service performs against avatar storage, and
 * nothing else.
 *
 * Structural and minimal on purpose, rather than `@aws-sdk/client-s3`'s own
 * `S3Client`: tests/helpers/testApp.ts injects an in-memory fake, and a
 * signature demanding the real client could only be satisfied by casting that
 * fake — which is how a type-checked refactor stops checking the dependency
 * injection it exists to protect.
 */
export interface AvatarBucket {
  /**
   * A short-lived presigned POST the browser can submit the avatar bytes to
   * directly, as multipart form data: every entry in `fields` must be
   * included as its own form field (in the same order R2 signed them), and
   * `Content-Type`/`file` come last. Backed by S3 POST policy conditions
   * (size ceiling, `image/*` Content-Type prefix) rather than a bare PUT, so
   * R2 itself rejects an oversized or non-image-declared upload — the
   * previous PUT-based URL bound no such constraint, meaning a caller who
   * uploaded and simply never called the confirm endpoint left an
   * unvalidated object sitting at a permanent public URL indefinitely.
   */
  createUploadUrl(key: string): Promise<{ url: string; fields: Record<string, string> }>;
  /**
   * The object's size in bytes, or null if nothing has been uploaded to `key`
   * yet — cheap enough (a HEAD, not a GET) to check before deciding whether the
   * object is even worth downloading.
   */
  headSize(key: string): Promise<number | null>;
  /** The object's current bytes, or null if nothing has been uploaded to `key` yet. */
  download(key: string): Promise<Buffer | null>;
  /**
   * Re-tags the stored object's Content-Type metadata to `contentType`, in
   * place, without touching its bytes. The presigned POST's policy only
   * constrains the DECLARED Content-Type to an `image/*` prefix — it does not
   * inspect the bytes — so this is what makes the detected type, not
   * whatever the direct-to-R2 caller declared, the one that is actually
   * served.
   */
  retagContentType(key: string, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  /** The URL the object is served at once uploaded. */
  publicUrl(key: string): string;
}

/**
 * Avatar storage on Cloudflare R2.
 *
 * Each user has exactly one avatar object at a deterministic path, so a new
 * upload is a plain overwrite — the same invariant the old Firebase Storage
 * implementation kept (see git history for the O(bucket) scan it replaced).
 *
 * Uploading means requesting a presigned POST policy: the browser submits the
 * bytes to R2 directly as multipart form data, never through this server,
 * which is what keeps this API's own request bodies small regardless of how
 * large an avatar is. The policy's own conditions (size ceiling, `image/*`
 * Content-Type prefix) are enforced by R2 itself, so an upload that never
 * gets confirmed still can't land arbitrary or oversized content. The
 * magic-byte check that used to run before the save now runs in the
 * controller after the browser reports the upload done, against the bytes
 * this service reads back — R2's conditions narrow what can land, but only
 * this check proves what the bytes actually are.
 */
export const createStorageService = (bucket: AvatarBucket) => {
  const keyFor = (uid: string) => `profile_pictures/${uid}`;

  return {
    createAvatarUploadUrl: (
      uid: string
    ): Promise<{ url: string; fields: Record<string, string> }> =>
      bucket.createUploadUrl(keyFor(uid)),

    avatarSize: (uid: string): Promise<number | null> => bucket.headSize(keyFor(uid)),

    downloadAvatar: (uid: string): Promise<Buffer | null> => bucket.download(keyFor(uid)),

    setAvatarContentType: (uid: string, contentType: string): Promise<void> =>
      bucket.retagContentType(keyFor(uid), contentType),

    deleteAvatarObject: (uid: string): Promise<void> => bucket.delete(keyFor(uid)),

    // Cache-bust so the browser picks up the new image immediately.
    publicAvatarUrl: (uid: string): string =>
      `${bucket.publicUrl(keyFor(uid))}?v=${Date.now()}`,
  };
};
