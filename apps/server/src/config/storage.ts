import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Env } from "./env";
import type { AvatarBucket } from "../services/storageService";

type R2Env = Pick<
  Env,
  | "R2_ACCOUNT_ID"
  | "R2_ACCESS_KEY_ID"
  | "R2_SECRET_ACCESS_KEY"
  | "R2_BUCKET_NAME"
  | "R2_PUBLIC_URL"
>;

// A signed PUT is valid for 5 minutes — long enough for a slow mobile upload
// to start, short enough that a leaked URL (browser history, a proxy log) is
// useless soon after.
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
    createUploadUrl: (key) =>
      getSignedUrl(
        client,
        new PutObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }),
        {
          expiresIn: UPLOAD_URL_TTL_SECONDS,
        }
      ),

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

    delete: async (key) => {
      await client.send(
        new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key })
      );
    },

    publicUrl: (key) => `${env.R2_PUBLIC_URL}/${key}`,
  };
};
