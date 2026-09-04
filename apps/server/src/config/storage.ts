import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import type { Env } from "./env";
import type { AvatarBucket } from "../services/storageService";
import { MAX_AVATAR_BYTES } from "../services/storageService";

type R2Env = Pick<
  Env,
  | "R2_ACCOUNT_ID"
  | "R2_ACCESS_KEY_ID"
  | "R2_SECRET_ACCESS_KEY"
  | "R2_BUCKET_NAME"
  | "R2_PUBLIC_URL"
>;

// A signed upload policy is valid for 5 minutes — long enough for a slow
// mobile upload to start, short enough that a leaked URL (browser history, a
// proxy log) is useless soon after.
const UPLOAD_URL_TTL_SECONDS = 300;

const isNoSuchKey = (err: unknown): boolean =>
  err instanceof Error &&
  (err.name === "NoSuchKey" ||
    (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode ===
      404);

/**
 * Avatar storage on Cloudflare R2, reached through its S3-compatible API.
 *
 * R2 charges nothing for egress, which is why it replaces Firebase Storage
 * here — see docs/REFACTOR-PLAN.md stage 8. `region: "auto"` is R2's own
 * convention: it is ignored once a full `endpoint` is given, R2 routes by
 * account id instead.
 */
export const createR2Bucket = (env: R2Env): AvatarBucket => {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });

  return {
    // A presigned POST, not a bare PUT: its policy conditions are enforced by
    // R2 itself against the upload as it happens, closing the gap a plain PUT
    // left — any object this policy accepts is already within the size cap
    // and declared as an image before the confirm endpoint ever runs. The
    // confirm step's own magic-byte check still runs afterward, since a
    // declared `image/*` Content-Type is not proof of the actual bytes.
    createUploadUrl: async (key) => {
      const { url, fields } = await createPresignedPost(client, {
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
        Conditions: [
          ["content-length-range", 0, MAX_AVATAR_BYTES],
          ["starts-with", "$Content-Type", "image/"],
        ],
        Expires: UPLOAD_URL_TTL_SECONDS,
      });
      return { url, fields };
    },

    headSize: async (key) => {
      try {
        const result = await client.send(
          new HeadObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key })
        );
        return result.ContentLength ?? null;
      } catch (err) {
        if (isNoSuchKey(err)) return null;
        throw err;
      }
    },

    download: async (key) => {
      try {
        const result = await client.send(
          new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key })
        );
        if (!result.Body) return null;
        // transformToByteArray is the SDK's own Node-runtime helper on the
        // response body stream — no manual stream plumbing needed.
        const bytes = await result.Body.transformToByteArray();
        return Buffer.from(bytes);
      } catch (err) {
        if (isNoSuchKey(err)) return null;
        throw err;
      }
    },

    // The policy only constrains the DECLARED Content-Type to an image/*
    // prefix, so the object as R2 first stores it still carries whatever the
    // uploader declared within that prefix, not the detected type. Copying
    // the object onto itself with MetadataDirective "REPLACE" is the S3-API
    // way to retag metadata in place, without re-uploading the bytes.
    retagContentType: async (key, contentType) => {
      await client.send(
        new CopyObjectCommand({
          Bucket: env.R2_BUCKET_NAME,
          CopySource: `${env.R2_BUCKET_NAME}/${encodeURIComponent(key)}`,
          Key: key,
          ContentType: contentType,
          MetadataDirective: "REPLACE",
        })
      );
    },

    delete: async (key) => {
      await client.send(
        new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key })
      );
    },

    publicUrl: (key) => `${env.R2_PUBLIC_URL}/${key}`,
  };
};
