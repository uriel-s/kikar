/**
 * Avatar storage on Firebase Storage.
 *
 * Each user has exactly one avatar object at a deterministic path, so replacing
 * it is a plain overwrite. The old code instead listed the whole bucket prefix
 * and deleted the first object whose name *contained* the uid — an O(bucket)
 * scan per upload, and a substring match that could delete another user's file.
 */
const createStorageService = (bucket) => ({
  uploadAvatar: async ({ uid, buffer, contentType }) => {
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

module.exports = { createStorageService };
