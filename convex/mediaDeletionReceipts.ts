import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

type RemovalReason =
  | "video_deleted"
  | "project_deleted"
  | "workspace_deleted"
  | "original_replaced";

/** Exact provenance, not authorization to delete bytes or proof they are gone.
 * Signed PUT leases and provider conditional-delete behavior remain unverified.
 * No storage cleanup executor is enabled by these pending-review receipts.
 */
export async function preserveOriginalRemoval(
  ctx: MutationCtx,
  video: Doc<"videos">,
  reason: RemovalReason,
  requestedBySubject?: string,
) {
  if (!video.s3Key) return null;
  const existing = await ctx.db
    .query("mediaDeletionReceipts")
    .withIndex("by_original", (q) =>
      q
        .eq("videoId", video._id)
        .eq("storageKey", video.s3Key!)
        .eq("storageETag", video.s3ETag),
    )
    .unique();
  if (existing) return existing._id;
  const project = await ctx.db.get(video.projectId);
  return await ctx.db.insert("mediaDeletionReceipts", {
    status: "pending_review",
    storageBinding: "unknown",
    uploadLease: "unknown",
    videoId: video._id,
    projectId: video.projectId,
    teamId: project?.teamId,
    contentItemId: video.contentItemId,
    storageKey: video.s3Key,
    storageETag: video.s3ETag,
    fileSize: video.fileSize,
    contentType: video.contentType,
    originalOnly: video.originalOnly,
    videoStatus: video.status,
    uploadedBySubject: video.uploadedByClerkId,
    requestedBySubject,
    reason,
    recordedAt: Date.now(),
  });
}
