"use node";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v } from "convex/values";
import { action, ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import {
  buildMuxPlaybackUrl,
  buildMuxThumbnailUrl,
  createMuxAssetFromInputUrl,
  createPublicPlaybackId,
  getMuxAsset,
} from "./mux";
import { mediaMode } from "./mediaPolicy";
import { BUCKET_NAME, getS3Client } from "./s3";

const GIBIBYTE = 1024 ** 3;
const MAX_PRESIGNED_PUT_FILE_SIZE_BYTES = 5 * GIBIBYTE;
const ALLOWED_UPLOAD_CONTENT_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
]);

function getExtensionFromKey(key: string, fallback = "mp4") {
  let source = key;
  if (key.startsWith("http://") || key.startsWith("https://")) {
    try {
      source = new URL(key).pathname;
    } catch {
      source = key;
    }
  }

  const ext = source.split(".").pop();
  if (!ext) return fallback;
  if (ext.length > 8 || /[^a-zA-Z0-9]/.test(ext)) return fallback;
  return ext.toLowerCase();
}

function sanitizeFilename(input: string) {
  const trimmed = input.trim();
  const base = trimmed.length > 0 ? trimmed : "video";
  const sanitized = base
    .replace(/["']/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_");
  return sanitized.slice(0, 120);
}

function buildDownloadFilename(title: string | undefined, key: string) {
  const ext = getExtensionFromKey(key);
  const safeTitle = sanitizeFilename(title ?? "video");
  return safeTitle.endsWith(`.${ext}`) ? safeTitle : `${safeTitle}.${ext}`;
}

function normalizeBucketKey(key: string): string {
  if (key.startsWith("http://") || key.startsWith("https://")) {
    try {
      const pathname = new URL(key).pathname.replace(/^\/+/, "");
      const bucketPrefix = `${BUCKET_NAME}/`;
      return pathname.startsWith(bucketPrefix)
        ? pathname.slice(bucketPrefix.length)
        : pathname;
    } catch {
      return key;
    }
  }
  return key;
}

async function buildSignedBucketObjectUrl(
  key: string,
  options?: {
    expiresIn?: number;
    filename?: string;
    contentType?: string;
  },
): Promise<string> {
  const normalizedKey = normalizeBucketKey(key);
  const s3 = getS3Client();
  const filename = options?.filename;
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: normalizedKey,
    ResponseContentDisposition: filename
      ? `attachment; filename="${filename}"`
      : undefined,
    ResponseContentType: options?.contentType,
  });
  return await getSignedUrl(s3, command, {
    expiresIn: options?.expiresIn ?? 600,
  });
}

function getValueString(value: unknown, field: string): string | null {
  const raw = (value as Record<string, unknown>)[field];
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

function normalizeContentType(contentType: string | null | undefined): string {
  if (!contentType) return "";
  return contentType.split(";")[0].trim().toLowerCase();
}

function isAllowedUploadContentType(contentType: string): boolean {
  return ALLOWED_UPLOAD_CONTENT_TYPES.has(contentType);
}

function validateUploadRequestOrThrow(args: {
  fileSize: number;
  contentType: string;
}) {
  if (!Number.isFinite(args.fileSize) || args.fileSize <= 0) {
    throw new Error("Video file size must be greater than zero.");
  }

  if (args.fileSize > MAX_PRESIGNED_PUT_FILE_SIZE_BYTES) {
    throw new Error("Video file is too large for direct upload.");
  }

  const normalizedContentType = normalizeContentType(args.contentType);
  if (!isAllowedUploadContentType(normalizedContentType)) {
    throw new Error("Unsupported video format. Allowed: mp4, mov, webm, mkv.");
  }

  return normalizedContentType;
}

function shouldDeleteUploadedObjectOnFailure(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("Unsupported video format") ||
    error.message.includes("Video file is too large") ||
    error.message.includes("Uploaded video file not found") ||
    error.message.includes("Storage limit reached")
  );
}

async function requireVideoMemberAccess(ctx: ActionCtx, videoId: Id<"videos">) {
  const video = (await ctx.runQuery(api.videos.get, { videoId })) as {
    role?: string;
    canUpload?: boolean;
  } | null;
  if (!video || video.role === "viewer" || video.canUpload === false) {
    throw new Error("Requires member role or higher");
  }
}

function buildPublicPlaybackSession(playbackId: string): {
  url: string;
  posterUrl: string;
} {
  return {
    url: buildMuxPlaybackUrl(playbackId),
    posterUrl: buildMuxThumbnailUrl(playbackId),
  };
}

async function ensurePublicPlaybackId(
  ctx: ActionCtx,
  params: {
    videoId?: Id<"videos">;
    muxAssetId?: string | null;
    muxPlaybackId: string;
  },
): Promise<string> {
  const { videoId, muxAssetId, muxPlaybackId } = params;
  if (!muxAssetId) return muxPlaybackId;

  const asset = await getMuxAsset(muxAssetId);
  const playbackIds = (asset.playback_ids ?? []) as Array<{
    id?: string;
    policy?: string;
  }>;

  let publicPlaybackId = playbackIds.find(
    (entry) => entry.policy === "public" && entry.id,
  )?.id;
  if (!publicPlaybackId) {
    const created = await createPublicPlaybackId(muxAssetId);
    publicPlaybackId = created.id;
  }

  const resolvedPlaybackId = publicPlaybackId ?? muxPlaybackId;
  if (videoId && resolvedPlaybackId !== muxPlaybackId) {
    await ctx.runMutation(internal.videos.setMuxPlaybackId, {
      videoId,
      muxAssetId,
      muxPlaybackId: resolvedPlaybackId,
      thumbnailUrl: buildMuxThumbnailUrl(resolvedPlaybackId),
    });
  }

  return resolvedPlaybackId;
}

export const getUploadUrl = action({
  args: {
    videoId: v.id("videos"),
    filename: v.string(),
    fileSize: v.number(),
    contentType: v.string(),
  },
  returns: v.object({
    url: v.string(),
    uploadId: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireVideoMemberAccess(ctx, args.videoId);
    const normalizedContentType = validateUploadRequestOrThrow({
      fileSize: args.fileSize,
      contentType: args.contentType,
    });

    const s3 = getS3Client();
    const ext = getExtensionFromKey(args.filename);
    const key = `videos/${args.videoId}/${crypto.randomUUID()}.${ext}`;
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: normalizedContentType,
    });
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

    await ctx.runMutation(internal.videos.setUploadInfo, {
      videoId: args.videoId,
      s3Key: key,
      fileSize: args.fileSize,
      contentType: normalizedContentType,
    });

    return { url, uploadId: key };
  },
});

export const markUploadComplete = action({
  args: {
    videoId: v.id("videos"),
    uploadId: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireVideoMemberAccess(ctx, args.videoId);

    const video = await ctx.runQuery(api.videos.getVideoForPlayback, {
      videoId: args.videoId,
    });

    if (!video || !video.s3Key) {
      throw new Error("Original bucket file not found for this video");
    }
    if (args.uploadId && video.s3Key !== args.uploadId)
      throw new Error("This upload was replaced. Use the current edit.");
    if (video.status === "ready" || video.status === "processing")
      return { success: true };
    if (video.status === "failed")
      throw new Error("This upload failed. Upload a new edit to retry.");

    try {
      const s3 = getS3Client();
      const head = await s3.send(
        new HeadObjectCommand({
          Bucket: BUCKET_NAME,
          Key: video.s3Key,
        }),
      );
      const contentLengthRaw = head.ContentLength;
      if (
        typeof contentLengthRaw !== "number" ||
        !Number.isFinite(contentLengthRaw) ||
        contentLengthRaw <= 0
      ) {
        throw new Error("Uploaded video file not found or empty.");
      }
      const contentLength = contentLengthRaw;
      if (contentLength > MAX_PRESIGNED_PUT_FILE_SIZE_BYTES) {
        throw new Error("Video file is too large for direct upload.");
      }

      const normalizedContentType = normalizeContentType(
        head.ContentType ?? video.contentType,
      );
      if (!isAllowedUploadContentType(normalizedContentType)) {
        throw new Error(
          "Unsupported video format. Allowed: mp4, mov, webm, mkv.",
        );
      }

      if (!head.ETag?.trim())
        throw new Error("Storage did not confirm the original file identity.");
      const metadataApplied = await ctx.runMutation(
        internal.videos.reconcileUploadedObjectMetadata,
        {
          videoId: args.videoId,
          uploadId: video.s3Key,
          fileSize: contentLength,
          contentType: normalizedContentType,
          storageETag: head.ETag,
        },
      );

      if (!metadataApplied) throw new Error("This upload was replaced.");
      if (mediaMode() === "original") {
        await ctx.runMutation(internal.videos.markOriginalReady, {
          videoId: args.videoId,
          uploadId: video.s3Key,
        });
        const current = await ctx.runQuery(api.videos.getVideoForPlayback, {
          videoId: args.videoId,
        });
        if (
          !current ||
          current.s3Key !== video.s3Key ||
          current.status !== "ready" ||
          !current.originalOnly
        )
          throw new Error(
            "This upload was replaced or could not be confirmed.",
          );
        return { success: true };
      }
      const shouldIngest = await ctx.runMutation(
        internal.videos.markAsProcessing,
        {
          videoId: args.videoId,
          uploadId: video.s3Key,
        },
      );
      if (!shouldIngest) return { success: true };

      const ingestUrl = await buildSignedBucketObjectUrl(video.s3Key, {
        expiresIn: 60 * 60 * 24,
      });
      const asset = await createMuxAssetFromInputUrl(
        args.videoId,
        ingestUrl,
        video.s3Key,
      );
      if (asset.id) {
        await ctx.runMutation(internal.videos.setMuxAssetReference, {
          videoId: args.videoId,
          uploadId: video.s3Key,
          muxAssetId: asset.id,
        });
      }
    } catch (error) {
      const shouldDeleteObject = shouldDeleteUploadedObjectOnFailure(error);
      if (shouldDeleteObject) {
        const s3 = getS3Client();
        try {
          await s3.send(
            new DeleteObjectCommand({
              Bucket: BUCKET_NAME,
              Key: video.s3Key,
            }),
          );
        } catch {
          // No-op: preserve original processing failure.
        }
      }

      const uploadError =
        shouldDeleteObject && error instanceof Error
          ? error.message
          : "Mux ingest failed after upload.";
      await ctx.runMutation(internal.videos.markAsFailed, {
        videoId: args.videoId,
        uploadId: video.s3Key,
        uploadError,
      });
      throw error;
    }

    return { success: true };
  },
});

export const markUploadFailed = action({
  args: {
    videoId: v.id("videos"),
    uploadId: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireVideoMemberAccess(ctx, args.videoId);

    const video = await ctx.runQuery(api.videos.getVideoForPlayback, {
      videoId: args.videoId,
    });
    if (!video?.s3Key) return { success: true };
    await ctx.runMutation(internal.videos.markAsFailed, {
      videoId: args.videoId,
      uploadId: args.uploadId ?? video.s3Key,
      uploadError: "Upload failed before Mux could process the asset.",
    });

    return { success: true };
  },
});

export const getPlaybackSession = action({
  args: { videoId: v.id("videos") },
  returns: v.object({
    url: v.string(),
    posterUrl: v.string(),
  }),
  handler: async (ctx, args): Promise<{ url: string; posterUrl: string }> => {
    const video = await ctx.runQuery(api.videos.getVideoForPlayback, {
      videoId: args.videoId,
    });

    if (!video || !video.muxPlaybackId || video.status !== "ready") {
      throw new Error("Video not found or not ready");
    }

    const playbackId = await ensurePublicPlaybackId(ctx, {
      videoId: args.videoId,
      muxAssetId: video.muxAssetId,
      muxPlaybackId: video.muxPlaybackId,
    });
    return buildPublicPlaybackSession(playbackId);
  },
});

export const getPlaybackUrl = action({
  args: { videoId: v.id("videos") },
  returns: v.object({
    url: v.string(),
  }),
  handler: async (ctx, args): Promise<{ url: string }> => {
    const video = await ctx.runQuery(api.videos.getVideoForPlayback, {
      videoId: args.videoId,
    });

    if (!video || !video.muxPlaybackId || video.status !== "ready") {
      throw new Error("Video not found or not ready");
    }

    const playbackId = await ensurePublicPlaybackId(ctx, {
      videoId: args.videoId,
      muxAssetId: video.muxAssetId,
      muxPlaybackId: video.muxPlaybackId,
    });
    const session = buildPublicPlaybackSession(playbackId);
    return { url: session.url };
  },
});

export const getOriginalPlaybackUrl = action({
  args: { videoId: v.id("videos") },
  returns: v.object({
    url: v.string(),
    contentType: v.string(),
  }),
  handler: async (ctx, args): Promise<{ url: string; contentType: string }> => {
    const video = await ctx.runQuery(api.videos.getVideoForPlayback, {
      videoId: args.videoId,
    });

    if (!video || !video.s3Key) {
      throw new Error("Original bucket file not found for this video");
    }

    if (video.s3ETag) {
      const head = await getS3Client()
        .send(
          new HeadObjectCommand({
            Bucket: BUCKET_NAME,
            Key: normalizeBucketKey(video.s3Key),
          }),
        )
        .catch(() => {
          throw new Error(
            "The original is unavailable. Restore storage and retry.",
          );
        });
      if (
        head.ETag !== video.s3ETag ||
        head.ContentLength !== video.fileSize ||
        normalizeContentType(head.ContentType) !==
          normalizeContentType(video.contentType)
      )
        throw new Error(
          "The original has changed. Restore the reviewed file or upload a new edit.",
        );
      const current = await ctx.runQuery(api.videos.getVideoForPlayback, {
        videoId: args.videoId,
      });
      if (current?.s3Key !== video.s3Key || current?.s3ETag !== video.s3ETag)
        throw new Error("This original was replaced. Reopen the current edit.");
    }
    const contentType = video.contentType ?? "video/mp4";
    return {
      url: await buildSignedBucketObjectUrl(video.s3Key, {
        expiresIn: 600,
        contentType,
      }),
      contentType,
    };
  },
});

export const getPublicPlaybackSession = action({
  args: { publicId: v.string() },
  returns: v.object({
    url: v.string(),
    posterUrl: v.string(),
  }),
  handler: async (ctx, args): Promise<{ url: string; posterUrl: string }> => {
    const result = await ctx.runQuery(api.videos.getByPublicId, {
      publicId: args.publicId,
    });

    if (!result?.video?.muxPlaybackId) {
      throw new Error("Video not found or not ready");
    }

    const playbackId = await ensurePublicPlaybackId(ctx, {
      videoId: result.video._id,
      muxAssetId: result.video.muxAssetId,
      muxPlaybackId: result.video.muxPlaybackId,
    });
    return buildPublicPlaybackSession(playbackId);
  },
});

export const getSharedPlaybackSession = action({
  args: { grantToken: v.string() },
  returns: v.object({
    url: v.string(),
    posterUrl: v.string(),
  }),
  handler: async (ctx, args): Promise<{ url: string; posterUrl: string }> => {
    const result = await ctx.runQuery(api.videos.getByShareGrant, {
      grantToken: args.grantToken,
    });

    if (!result?.video?.muxPlaybackId) {
      throw new Error("Video not found or not ready");
    }

    const playbackId = await ensurePublicPlaybackId(ctx, {
      videoId: result.video._id,
      muxAssetId: result.video.muxAssetId,
      muxPlaybackId: result.video.muxPlaybackId,
    });
    return buildPublicPlaybackSession(playbackId);
  },
});

export const getDownloadUrl = action({
  args: { videoId: v.id("videos"), approvedOnly: v.optional(v.boolean()) },
  returns: v.object({
    url: v.string(),
    filename: v.string(),
  }),
  handler: async (ctx, args): Promise<{ url: string; filename: string }> => {
    const video = await ctx.runQuery(
      args.approvedOnly
        ? api.contentItems.getReadyVideo
        : api.videos.getVideoForPlayback,
      {
        videoId: args.videoId,
      },
    );

    if (!video) {
      throw new Error("Video not found");
    }

    if (video.status !== "ready") {
      throw new Error("Video not found or not ready");
    }

    const key = getValueString(video, "s3Key");
    if (!key) {
      throw new Error("Original bucket file not found for this video");
    }

    const filename = buildDownloadFilename(video.title, key);

    if (args.approvedOnly || video.s3ETag) {
      // Review approval is recorded evidence, not proof that the original is
      // currently reachable. Check on demand rather than polling every card.
      const head = await getS3Client()
        .send(
          new HeadObjectCommand({
            Bucket: BUCKET_NAME,
            Key: normalizeBucketKey(key),
          }),
        )
        .catch(() => {
          throw new Error(
            "The approved original is unavailable. Retry after storage access is restored.",
          );
        });
      if (
        (video.s3ETag && head.ETag !== video.s3ETag) ||
        typeof head.ContentLength !== "number" ||
        !Number.isFinite(head.ContentLength) ||
        head.ContentLength <= 0 ||
        (typeof video.fileSize === "number" &&
          video.fileSize > 0 &&
          head.ContentLength !== video.fileSize) ||
        (video.contentType &&
          normalizeContentType(head.ContentType) !==
            normalizeContentType(video.contentType))
      )
        throw new Error(
          "The approved original is unavailable or has changed. Retry after storage is restored.",
        );
      // Access/current-version approval may change during the storage read.
      const current = await ctx.runQuery(
        args.approvedOnly
          ? api.contentItems.getReadyVideo
          : api.videos.getVideoForPlayback,
        {
          videoId: args.videoId,
        },
      );
      if (
        !current ||
        current.s3Key !== video.s3Key ||
        current.s3ETag !== video.s3ETag
      )
        throw new Error(
          "This approved edit was replaced. Open the current deliverable.",
        );
    }

    return {
      url: await buildSignedBucketObjectUrl(key, {
        expiresIn: 600,
        filename,
        contentType: video.contentType ?? "video/mp4",
      }),
      filename,
    };
  },
});
