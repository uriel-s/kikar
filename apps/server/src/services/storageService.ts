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
  /** A short-lived presigned URL the browser can PUT the avatar bytes to directly. */
  createUploadUrl(key: string): Promise<string>;
  /** The object's current bytes, or null if nothing has been uploaded to `key` yet. */
  download(key: string): Promise<Buffer | null>;
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
 * Uploading means requesting a presigned URL: the browser PUTs bytes to R2
 * directly, never through this server, which is what keeps this API's own
 * request bodies small regardless of how large an avatar is. The magic-byte
 * check that used to run before the save now runs in the controller after the
 * browser reports the upload done, against the bytes this service reads back.
 */
export const createStorageService = (bucket: AvatarBucket) => {
  const keyFor = (uid: string) => `profile_pictures/${uid}`;

  return {
    createAvatarUploadUrl: (uid: string): Promise<string> =>
      bucket.createUploadUrl(keyFor(uid)),

    downloadAvatar: (uid: string): Promise<Buffer | null> => bucket.download(keyFor(uid)),

    deleteAvatarObject: (uid: string): Promise<void> => bucket.delete(keyFor(uid)),

    // Cache-bust so the browser picks up the new image immediately.
    publicAvatarUrl: (uid: string): string => `${bucket.publicUrl(keyFor(uid))}?v=${Date.now()}`,
  };
};
