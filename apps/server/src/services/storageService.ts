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
   * A short-lived presigned POST the browser can submit bytes to directly,
   * as multipart form data: every entry in `fields` must be included as its
   * own form field (in the same order R2 signed them), and
   * `Content-Type`/`file` come last. Backed by S3 POST policy conditions
   * (size ceiling, `image/*` Content-Type prefix) rather than a bare PUT, so
   * R2 itself rejects an oversized or non-image-declared upload before it
   * can land. The key this is issued for is always a STAGING key (see
   * `stagingKeyFor` in storageService.ts), never the public one an existing
   * avatar is served from — a policy condition constrains declared size and
   * a `Content-Type` prefix, never the actual bytes, so an upload that is
   * still sitting unconfirmed, or that the confirm step's magic-byte check
   * rejects, must never be allowed to land on the key a user's current
   * avatar is already being served from. `promote` below is what moves
   * validated bytes onto that public key.
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
   * Copies the object at `fromKey` onto `toKey` with its Content-Type set to
   * `contentType`, then removes `fromKey`. This is what makes a validated
   * upload become the public object only after the confirm step's magic-byte
   * check has passed — an object that fails validation, or is never
   * confirmed, never touches whatever already exists at `toKey`.
   */
  promote(fromKey: string, toKey: string, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  /** The URL the object is served at once uploaded. */
  publicUrl(key: string): string;
}

/**
 * Avatar storage on Cloudflare R2.
 *
 * Each user has exactly one avatar object at a deterministic public path, so
 * a promoted upload is a plain overwrite — the same invariant the old
 * Firebase Storage implementation kept (see git history for the O(bucket)
 * scan it replaced).
 *
 * Uploading means requesting a presigned POST policy: the browser submits the
 * bytes to R2 directly as multipart form data, never through this server,
 * which is what keeps this API's own request bodies small regardless of how
 * large an avatar is. That POST lands on a STAGING key
 * (`stagingKeyFor`), never the public one — R2's policy conditions (size
 * ceiling, `image/*` Content-Type prefix) constrain what can be declared, not
 * what the bytes actually are, so the object is not trusted, and is not
 * public, until the confirm step's magic-byte check passes. Only then does
 * `promoteAvatar` copy it onto the public key. A rejected or never-confirmed
 * upload therefore never touches whatever was already being served from
 * that key.
 */
export const createStorageService = (bucket: AvatarBucket) => {
  // The public, served key — what publicAvatarUrl and the DB's stored
  // avatarUrl point at. Unchanged by this staging design: only a promoted,
  // already-validated upload ever lands here.
  const keyFor = (uid: string) => `profile_pictures/${uid}`;

  // Where a direct-to-R2 upload lands first, distinct from the public key
  // above, so an in-progress upload can never overwrite an existing avatar
  // before it has been validated.
  const stagingKeyFor = (uid: string) => `avatar_uploads/${uid}`;

  return {
    createAvatarUploadUrl: (
      uid: string
    ): Promise<{ url: string; fields: Record<string, string> }> =>
      bucket.createUploadUrl(stagingKeyFor(uid)),

    pendingUploadSize: (uid: string): Promise<number | null> =>
      bucket.headSize(stagingKeyFor(uid)),

    downloadPendingUpload: (uid: string): Promise<Buffer | null> =>
      bucket.download(stagingKeyFor(uid)),

    discardPendingUpload: (uid: string): Promise<void> =>
      bucket.delete(stagingKeyFor(uid)),

    // Called only once the confirm step's magic-byte check has passed: moves
    // the staged upload onto the public key, retagging its Content-Type to
    // the detected type in the same operation.
    promoteAvatar: (uid: string, contentType: string): Promise<void> =>
      bucket.promote(stagingKeyFor(uid), keyFor(uid), contentType),

    // Cache-bust so the browser picks up the new image immediately.
    publicAvatarUrl: (uid: string): string =>
      `${bucket.publicUrl(keyFor(uid))}?v=${Date.now()}`,
  };
};
