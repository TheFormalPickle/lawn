import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  mutation,
  query,
  internalMutation,
  type MutationCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { requireTeamAccess, requireProjectAccess } from "./auth";
import { assertTeamCanStoreBytes, adjustRawAssetBytes } from "./billingHelpers";
import { rawAssetFile } from "./rawAssetPolicy";
import { canManageContent, canProduceContent } from "./contentWorkflow";

const kind = v.union(
  v.literal("video"),
  v.literal("photo"),
  v.literal("audio"),
);
export const list = query({
  args: {
    teamId: v.id("teams"),
    projectId: v.optional(v.id("projects")),
    sharedOnly: v.optional(v.boolean()),
    kind: v.optional(kind),
    search: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireTeamAccess(ctx, args.teamId, "member");
    if (args.projectId) {
      const { project } = await requireProjectAccess(
        ctx,
        args.projectId,
        "member",
      );
      if (project.teamId !== args.teamId)
        throw new Error("Client is outside this workspace.");
    }
    const search = args.search.trim();
    if (search.length > 200)
      throw new Error("Keep searches under 200 characters.");
    const base = search
      ? ctx.db.query("rawAssets").withSearchIndex("search_files", (q) => {
          const scoped = q
            .search("searchText", search)
            .eq("teamId", args.teamId)
            .eq("status", "ready");
          const projectScoped =
            args.projectId || args.sharedOnly
              ? scoped.eq("projectId", args.projectId)
              : scoped;
          return args.kind
            ? projectScoped.eq("kind", args.kind)
            : projectScoped;
        })
      : args.projectId || args.sharedOnly
        ? ctx.db
            .query("rawAssets")
            .withIndex("by_team_status_scope_kind", (q) => {
              const scoped = q
                .eq("teamId", args.teamId)
                .eq("status", "ready")
                .eq("projectId", args.projectId);
              return args.kind ? scoped.eq("kind", args.kind) : scoped;
            })
            .order("desc")
        : args.kind
          ? ctx.db
              .query("rawAssets")
              .withIndex("by_team_status_kind", (q) =>
                q
                  .eq("teamId", args.teamId)
                  .eq("status", "ready")
                  .eq("kind", args.kind!),
              )
              .order("desc")
          : ctx.db
              .query("rawAssets")
              .withIndex("by_team_status", (q) =>
                q.eq("teamId", args.teamId).eq("status", "ready"),
              )
              .order("desc");
    const result = await base.paginate({
      cursor: args.paginationOpts.cursor,
      numItems: Math.min(50, Math.max(1, args.paginationOpts.numItems)),
    });
    return {
      ...result,
      page: result.page.map(
        ({
          _id,
          _creationTime,
          projectId,
          filename,
          fileSize,
          kind,
          uploadedByName,
        }) => ({
          _id,
          _creationTime,
          projectId,
          filename,
          fileSize,
          kind,
          uploadedByName,
        }),
      ),
    };
  },
});

export const get = query({
  args: { assetId: v.id("rawAssets") },
  handler: async (ctx, { assetId }) => {
    const asset = await ctx.db.get(assetId);
    if (!asset) throw new Error("Asset not found.");
    const { user, membership } = await requireTeamAccess(
      ctx,
      asset.teamId,
      "member",
    );
    if (asset.status === "removed")
      throw new Error("This asset was removed from the library.");
    if (asset.projectId) {
      const project = await ctx.db.get(asset.projectId);
      if (!project || project.teamId !== asset.teamId)
        throw new Error("This asset’s client is unavailable.");
    }
    return {
      ...asset,
      canRemove:
        canManageContent(membership.role) ||
        user.subject === asset.uploadedByClerkId,
    };
  },
});

export const unfinished = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, { teamId }) => {
    const { user, membership } = await requireTeamAccess(ctx, teamId, "member");
    const source = canManageContent(membership.role)
      ? ctx.db
          .query("rawAssets")
          .withIndex("by_team_status", (q) =>
            q.eq("teamId", teamId).eq("status", "uploading"),
          )
      : ctx.db
          .query("rawAssets")
          .withIndex("by_team_status_uploader", (q) =>
            q
              .eq("teamId", teamId)
              .eq("status", "uploading")
              .eq("uploadedByClerkId", user.subject),
          );
    const rows = await source.order("desc").take(101);
    return {
      items: rows.slice(0, 100).map((asset) => ({
        ...asset,
        canConfirm: asset.uploadedByClerkId === user.subject,
      })),
      hasMore: rows.length > 100,
    };
  },
});
export const findUpload = query({
  args: { teamId: v.id("teams"), requestKey: v.string() },
  handler: async (ctx, { teamId, requestKey }) => {
    const { user } = await requireTeamAccess(ctx, teamId, "member");
    const row = await ctx.db
      .query("rawAssets")
      .withIndex("by_creator_request", (q) =>
        q
          .eq("teamId", teamId)
          .eq("uploadedByClerkId", user.subject)
          .eq("requestKey", requestKey),
      )
      .unique();
    return row ? { assetId: row._id, status: row.status } : null;
  },
});

export const create = mutation({
  args: {
    teamId: v.id("teams"),
    projectId: v.optional(v.id("projects")),
    filename: v.string(),
    fileSize: v.number(),
    contentType: v.string(),
    requestKey: v.string(),
    expectedActorId: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireTeamAccess(ctx, args.teamId, "member");
    if (user.subject !== args.expectedActorId)
      throw new Error("Your account changed. Retry from the original account.");
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(args.requestKey))
      throw new Error("Missing upload request identity.");
    const file = rawAssetFile(args.filename, args.fileSize, args.contentType);
    const signature = JSON.stringify([
      args.projectId ?? null,
      args.filename,
      args.fileSize,
      file.contentType,
    ]);
    const original = await ctx.db
      .query("rawAssets")
      .withIndex("by_creator_request", (q) =>
        q
          .eq("teamId", args.teamId)
          .eq("uploadedByClerkId", user.subject)
          .eq("requestKey", args.requestKey),
      )
      .unique();
    if (original) {
      if (original.requestSignature !== signature)
        throw new Error(
          "Retry the original file before starting another upload.",
        );
      if (original.status === "removed")
        throw new Error(
          "This upload was removed. Start a new upload explicitly.",
        );
      return original._id;
    }
    if (args.projectId) {
      const { project } = await requireProjectAccess(
        ctx,
        args.projectId,
        "member",
      );
      if (project.teamId !== args.teamId)
        throw new Error("Client is outside this workspace.");
    }
    await assertTeamCanStoreBytes(ctx, args.teamId, args.fileSize);
    await adjustRawAssetBytes(ctx, args.teamId, args.fileSize);
    return ctx.db.insert("rawAssets", {
      teamId: args.teamId,
      projectId: args.projectId,
      filename: args.filename,
      fileSize: args.fileSize,
      contentType: file.contentType,
      kind: file.kind,
      searchText: args.filename.replace(/[._-]+/g, " "),
      uploadedByClerkId: user.subject,
      uploadedByName: typeof user.name === "string" ? user.name : "Team member",
      requestKey: args.requestKey,
      requestSignature: signature,
      status: "uploading",
    });
  },
});

export const prepare = internalMutation({
  args: { assetId: v.id("rawAssets"), actor: v.string(), key: v.string() },
  handler: async (ctx, { assetId, actor, key }) => {
    const asset = await ctx.db.get(assetId);
    if (
      !asset ||
      asset.uploadedByClerkId !== actor ||
      asset.status === "removed"
    )
      throw new Error("Upload unavailable.");
    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", asset.teamId).eq("userClerkId", actor),
      )
      .unique();
    if (!membership || membership.role === "viewer")
      throw new Error("Editing membership is required.");
    if (asset.projectId && !(await ctx.db.get(asset.projectId)))
      throw new Error("Client no longer exists.");
    if (asset.status === "ready") return asset;
    if (!key.startsWith(`raw/${assetId}/`))
      throw new Error("Invalid asset path.");
    if (!asset.storageKey) await ctx.db.patch(assetId, { storageKey: key });
    return { ...asset, storageKey: asset.storageKey ?? key };
  },
});
export const complete = internalMutation({
  args: {
    assetId: v.id("rawAssets"),
    actor: v.string(),
    key: v.string(),
    etag: v.string(),
  },
  handler: async (ctx, { assetId, actor, key, etag }) => {
    const asset = await ctx.db.get(assetId);
    if (
      !asset ||
      asset.uploadedByClerkId !== actor ||
      asset.status === "removed" ||
      asset.storageKey !== key
    )
      throw new Error("This upload is no longer current.");
    // Revalidate access inside the transaction after the provider check.
    const member = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", asset.teamId).eq("userClerkId", actor),
      )
      .unique();
    if (!member || member.role === "viewer")
      throw new Error("Editing membership is required.");
    if (asset.projectId && !(await ctx.db.get(asset.projectId)))
      throw new Error("Client no longer exists.");
    if (
      !etag.trim() ||
      etag.length > 1024 ||
      (asset.status === "ready" && asset.storageETag !== etag)
    )
      throw new Error(
        "The confirmed original has changed. Upload a new source explicitly.",
      );
    await ctx.db.patch(assetId, { status: "ready", storageETag: etag });
  },
});

export async function removeProjectAssets(
  ctx: MutationCtx,
  projectId: Id<"projects">,
) {
  for (const asset of await ctx.db
    .query("rawAssets")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .collect()) {
    if (asset.status !== "removed")
      await adjustRawAssetBytes(ctx, asset.teamId, -asset.fileSize);
    if (asset.storageKey)
      await ctx.scheduler.runAfter(0, internal.rawAssetActions.deleteBytes, {
        key: asset.storageKey,
      });
    await ctx.db.delete(asset._id);
  }
}
export const remove = mutation({
  args: { assetId: v.id("rawAssets") },
  handler: async (ctx, { assetId }) => {
    const asset = await ctx.db.get(assetId);
    if (!asset) throw new Error("Asset not found.");
    const { user, membership } = await requireTeamAccess(
      ctx,
      asset.teamId,
      "member",
    );
    if (
      !canManageContent(membership.role) &&
      user.subject !== asset.uploadedByClerkId
    )
      throw new Error(
        "Only the uploader or an administrator can remove this asset.",
      );
    if (asset.status === "removed") return;
    // Retain the request receipt: a late retry cannot resurrect removed content.
    await adjustRawAssetBytes(ctx, asset.teamId, -asset.fileSize);
    await ctx.db.patch(assetId, { status: "removed" });
    if (asset.storageKey)
      await ctx.scheduler.runAfter(0, internal.rawAssetActions.deleteBytes, {
        key: asset.storageKey,
      });
  },
});
export const useInAssignment = mutation({
  args: { assetId: v.id("rawAssets"), itemId: v.id("contentItems") },
  handler: async (ctx, { assetId, itemId }) => {
    const item = await ctx.db.get(itemId),
      asset = await ctx.db.get(assetId);
    if (!item || !asset || asset.status !== "ready")
      throw new Error("Source asset or assignment is unavailable.");
    const { user, membership, project } = await requireProjectAccess(
      ctx,
      item.projectId,
      "member",
    );
    if (
      asset.teamId !== project.teamId ||
      (asset.projectId && asset.projectId !== item.projectId)
    )
      throw new Error(
        "Choose an asset for this client or a shared agency asset.",
      );
    if (!canProduceContent(item, user.subject, membership.role))
      throw new Error(
        "Only the assigned content team or an administrator can attach source assets.",
      );
    const ids = item.sourceAssetIds ?? [];
    if (ids.includes(assetId)) return;
    if (ids.length >= 20)
      throw new Error("Use up to 20 source assets per assignment.");
    await ctx.db.patch(itemId, {
      sourceAssetIds: [...ids, assetId],
      updatedAt: Math.max(Date.now(), item.updatedAt + 1),
    });
  },
});

export const detachFromAssignment = mutation({
  args: { assetId: v.id("rawAssets"), itemId: v.id("contentItems") },
  handler: async (ctx, { assetId, itemId }) => {
    const item = await ctx.db.get(itemId);
    if (!item) throw new Error("Assignment is unavailable.");
    const { user, membership } = await requireProjectAccess(
      ctx,
      item.projectId,
      "member",
    );
    if (!canProduceContent(item, user.subject, membership.role))
      throw new Error(
        "Only the assigned content team or an administrator can change source references.",
      );
    if (!(item.sourceAssetIds ?? []).includes(assetId)) return;
    await ctx.db.patch(itemId, {
      sourceAssetIds: item.sourceAssetIds!.filter((id) => id !== assetId),
      updatedAt: Math.max(Date.now(), item.updatedAt + 1),
    });
  },
});
