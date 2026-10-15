"use node";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { BUCKET_NAME, getS3Client } from "./s3";
import { rawAssetFilename } from "./rawAssetPolicy";

export const uploadUrl = action({
  args: { assetId: v.id("rawAssets"), expectedActorId: v.string() },
  handler: async (
    ctx,
    { assetId, expectedActorId },
  ): Promise<{ url: string | null; key: string; ready: boolean }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== expectedActorId)
      throw new Error("Your account changed. Retry from the original account.");
    const asset = await ctx.runQuery(api.rawAssets.get, { assetId });
    if (asset.uploadedByClerkId !== identity.subject)
      throw new Error("Only the original uploader can send this file.");
    const prepared = await ctx.runMutation(internal.rawAssets.prepare, {
      assetId,
      actor: identity.subject,
      key: `raw/${assetId}/${crypto.randomUUID()}`,
    });
    const key = prepared.storageKey!;
    if (prepared.status === "ready") return { url: null, key, ready: true };
    return {
      key,
      ready: false,
      url: await getSignedUrl(
        getS3Client(),
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          ContentType: asset.contentType,
          ContentLength: asset.fileSize,
        }),
        { expiresIn: 900 },
      ),
    };
  },
});
export const confirm = action({
  args: {
    assetId: v.id("rawAssets"),
    key: v.string(),
    expectedActorId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.expectedActorId)
      throw new Error("Your account changed. Retry from the original account.");
    const asset = await ctx.runQuery(api.rawAssets.get, {
      assetId: args.assetId,
    });
    if (
      asset.uploadedByClerkId !== identity.subject ||
      asset.storageKey !== args.key
    )
      throw new Error("This upload is no longer current.");
    const head = await getS3Client().send(
      new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: args.key }),
    );
    if (
      !head.ETag ||
      head.ContentLength !== asset.fileSize ||
      head.ContentType?.split(";")[0].toLowerCase() !== asset.contentType
    )
      throw new Error(
        "The original file is missing or its size/type does not match. Retry the original transfer.",
      );
    await ctx.runMutation(internal.rawAssets.complete, {
      assetId: args.assetId,
      key: args.key,
      actor: identity.subject,
      etag: head.ETag,
    });
    return { success: true };
  },
});
export const readUrl = action({
  args: { assetId: v.id("rawAssets"), download: v.boolean() },
  handler: async (
    ctx,
    { assetId, download },
  ): Promise<{ url: string; filename: string; expiresAt: number }> => {
    const asset = await ctx.runQuery(api.rawAssets.get, { assetId });
    if (asset.status !== "ready" || !asset.storageKey || !asset.storageETag)
      throw new Error("This original is not ready yet.");
    const head = await getS3Client()
      .send(
        new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: asset.storageKey }),
      )
      .catch(() => {
        throw new Error(
          "The original file is unavailable. Retry after storage access is restored.",
        );
      });
    if (
      head.ETag !== asset.storageETag ||
      head.ContentLength !== asset.fileSize ||
      head.ContentType?.split(";")[0].toLowerCase() !== asset.contentType
    )
      throw new Error(
        "The original file is unavailable or has changed. Retry after storage is restored.",
      );
    const current = await ctx.runQuery(api.rawAssets.get, { assetId });
    if (current.status !== "ready" || current.storageKey !== asset.storageKey)
      throw new Error("This original is no longer available.");
    const expiresAt = Date.now() + 600_000;
    const filename = rawAssetFilename(asset.filename);
    return {
      filename,
      expiresAt,
      url: await getSignedUrl(
        getS3Client(),
        new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: asset.storageKey,
          ResponseContentType: asset.contentType,
          ResponseContentDisposition: `${download ? "attachment" : "inline"}; filename="${filename}"`,
        }),
        { expiresIn: 600 },
      ),
    };
  },
});
export const deleteBytes = internalAction({
  args: { key: v.string() },
  handler: async (_ctx, { key }) => {
    if (!/^raw\/[^/]+\/[^/]+$/.test(key))
      throw new Error("Invalid raw asset key.");
    await getS3Client().send(
      new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
    );
  },
});
