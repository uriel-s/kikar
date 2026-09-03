import type { ImageMimeType } from "../lib/imageType";

/**
 * The three file operations this service performs, and nothing else.
 *
 * Structural and minimal on purpose, rather than @google-cloud/storage's
 * `Bucket`: tests/helpers/testApp.ts injects a fake whose `file()` returns only
 * `save`, `makePublic` and `publicUrl`, and a signature demanding the real
 * class could only be satisfied by casting that fake — which is how a
 * type-checked refactor stops checking the dependency injection it exists to
 * protect.
 */
export interface AvatarFile {
  save(data: Buffer, options: AvatarSaveOptions): Promise<unknown>;
  makePublic(): Promise<unknown>;
  publicUrl(): string;
}

export interface AvatarSaveOptions {
  contentType: ImageMimeType;
  resumable: boolean;
  metadata: { cacheControl: string };
}

export interface AvatarBucket {
  file(name: string): AvatarFile;
}

export interface UploadAvatarInput {
  uid: string;
  buffer: Buffer;
  // The type detected from the bytes, never the Content-Type the client
  // declared — see lib/imageType.
  contentType: ImageMimeType;
}

/**
 * Avatar storage on Firebase Storage.
 *
 * Each user has exactly one avatar object at a deterministic path, so replacing
 * it is a plain overwrite. The old code instead listed the whole bucket prefix
 * and deleted the first object whose name *contained* the uid — an O(bucket)
 * scan per upload, and a substring match that could delete another user's file.
 */
export const createStorageService = (bucket: AvatarBucket) => ({
  uploadAvatar: async ({
    uid,
    buffer,
    contentType,
  }: UploadAvatarInput): Promise<string> => {
    const file = bucket.file(`profile_pictures/${uid}`);

    await file.save(buffer, {
      contentType,
      resumable: false,
      metadata: {
        // Avatars change rarely; let browsers cache but revalidate.
        cacheControl: "public, max-age=3600",
      },
    });
    await file.makePublic();

    // Cache-bust so the browser picks up the new image immediately.
    return `${file.publicUrl()}?v=${Date.now()}`;
  },
});
