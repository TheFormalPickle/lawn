import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireProjectAccess, requireTeamAccess } from "./auth";
import {
  canManageContent,
  canProduceContent,
  canReviewContent,
  contentStage,
} from "./contentWorkflow";

const fields = {
  title: v.string(),
  brief: v.string(),
  producerClerkId: v.optional(v.string()),
  producerPendingEmail: v.optional(v.string()),
  directorClerkId: v.optional(v.string()),
  directorPendingEmail: v.optional(v.string()),
  cmoClerkId: v.optional(v.string()),
  dueDate: v.optional(v.string()),
};
type AssignmentFields = {
    title: string;
    brief: string;
    producerClerkId?: string;
    producerPendingEmail?: string;
    directorClerkId?: string;
    directorPendingEmail?: string;
    cmoClerkId?: string;
    dueDate?: string;
};
function normalizedFields(input: AssignmentFields) {
  const title = input.title.trim();
  if (!title || title.length > 200)
    throw new ConvexError("Give this assignment a title of 1–200 characters.");
  if (input.brief.length > 20_000)
    throw new ConvexError("Keep the brief under 20,000 characters.");
  if (
    input.dueDate &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) ||
      !Number.isFinite(new Date(input.dueDate).getTime()) ||
      new Date(input.dueDate).toISOString().slice(0, 10) !== input.dueDate)
  )
    throw new ConvexError("Choose a valid due date.");
  for (const [subject, pending] of [[input.producerClerkId,input.producerPendingEmail],[input.directorClerkId,input.directorPendingEmail]]) {
    if(subject && pending) throw new ConvexError("Select either a current member or an invited person for each role.");
    if(pending && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pending.trim())) throw new ConvexError("Choose a valid invited email address.");
  }
  return {...input,title,brief:input.brief.trim(),producerPendingEmail:input.producerPendingEmail?.trim().toLowerCase()||undefined,directorPendingEmail:input.directorPendingEmail?.trim().toLowerCase()||undefined};
}
export async function validateFields(ctx:MutationCtx,teamId:Id<"teams">,input:AssignmentFields) {
  const normalized=normalizedFields(input);
  for(const email of [normalized.producerPendingEmail,normalized.directorPendingEmail]) {
    if(!email) continue;
    const invitations=await ctx.db.query("teamInvites").withIndex("by_email",q=>q.eq("email",email)).collect();
    const scoped=invitations.filter(invite=>invite.teamId===teamId);
    const invite=scoped[0];
    if(scoped.length!==1 || !invite || invite.expiresAt<=Date.now() || invite.role==="viewer") throw new ConvexError("Pending assignees need a current content-team invitation for this workspace.");
  }
  for (const [kind, subject] of [
    ["producer", input.producerClerkId],
    ["director", input.directorClerkId],
    ["cmo", input.cmoClerkId],
  ]) {
    if (!subject) continue;
    const member = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", teamId).eq("userClerkId", subject!),
      )
      .unique();
    if (!member || (kind !== "cmo" && member.role === "viewer"))
      throw new ConvexError(
        "Assignees must be current members of this team with editing access.",
      );
  }
  return normalized;
}

export const list = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, { teamId }) => {
    const { user, membership } = await requireTeamAccess(ctx, teamId);
    const [items, projects, members, productionTeams, batches, invitations] = await Promise.all([
      ctx.db
        .query("contentItems")
        .withIndex("by_team", (q) => q.eq("teamId", teamId))
        .collect(),
      ctx.db
        .query("projects")
        .withIndex("by_team", (q) => q.eq("teamId", teamId))
        .collect(),
      ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", teamId))
        .collect(),
      ctx.db.query("productionTeams").withIndex("by_team", q => q.eq("teamId", teamId)).collect(),
      ctx.db.query("contentBatches").withIndex("by_team", q => q.eq("teamId", teamId)).collect(),
      canManageContent(membership.role) ? ctx.db.query("teamInvites").withIndex("by_team",q=>q.eq("teamId",teamId)).collect() : Promise.resolve([]),
    ]);
    const videos = (
      await Promise.all(
        projects.map((project) =>
          ctx.db
            .query("videos")
            .withIndex("by_project", (q) => q.eq("projectId", project._id))
            .collect(),
        ),
      )
    ).flat();
    const byId = new Map(videos.map((video) => [video._id, video]));
    const itemsById = new Map(items.map((item) => [item._id, item]));
    const sourceIds = membership.role === "viewer" ? [] : [...new Set(items.flatMap(item => item.sourceAssetIds ?? []))];
    const sources = new Map((await Promise.all(sourceIds.map(id => ctx.db.get(id)))).filter(source => source !== null).map(source => [source._id, source]));
    return {
      canManage: canManageContent(membership.role),
      canBrowseRaw: membership.role !== "viewer",
      subject: user.subject,
      pendingMembers: invitations.filter(invite=>invite.expiresAt>Date.now() && invite.role!=="viewer").map(({email,role})=>({email:email.trim().toLowerCase(),role})).sort((a,b)=>a.email.localeCompare(b.email)),
      productionTeams, batches: batches.sort((a,b) => b._creationTime-a._creationTime),
      projects,
      members: members.map(({ userClerkId, userName, role }) => ({
        userClerkId,
        userName,
        role,
      })),
      items: items
        .map((item) => {
          const video = item.currentVideoId
            ? (byId.get(item.currentVideoId) ?? null)
            : null;
          const exact =
            video?.projectId === item.projectId &&
            video?.contentItemId === item._id
              ? video
              : null;
          return {
            ...item,
            sourceAssets: membership.role === "viewer" ? [] : (item.sourceAssetIds ?? []).map(id => {
              const source = sources.get(id);
              const exact = source?.teamId === teamId && (!source.projectId || source.projectId === item.projectId) && source.status === "ready";
              return { _id: id, filename: exact ? source.filename : "Unavailable source", available: exact };
            }),
            stage: contentStage(item, exact),
            video: exact,
            canProduce: canProduceContent(item, user.subject, membership.role),
            canPlan: canReviewContent(item, user.subject, membership.role),
          };
        })
        .sort(
          (a, b) =>
            (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
            (a.batchId && a.batchId === b.batchId ? (a.sequence ?? 0) - (b.sequence ?? 0) : 0) ||
            b._creationTime - a._creationTime,
        ),
      // Existing approved videos remain discoverable. Earlier tracked versions
      // cannot reappear as unrelated approved deliverables after a new upload.
      readyVideos: videos.filter(
        (video) =>
          video.status === "ready" &&
          video.workflowStatus === "done" &&
          (!video.contentItemId ||
            (itemsById.get(video.contentItemId)?.currentVideoId === video._id &&
              itemsById.get(video.contentItemId)?.projectId ===
                video.projectId)),
      ),
      linkableVideos: videos.map(
        ({ _id, projectId, title, contentItemId, status }) => ({
          _id,
          projectId,
          title,
          contentItemId,
          status,
        }),
      ),
    };
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    requestKey: v.string(),
    expectedActorId: v.string(),
    ...fields,
  },
  handler: async (ctx, args) => {
    const { user, project } = await requireProjectAccess(
      ctx,
      args.projectId,
      "admin",
    );
    if (args.expectedActorId !== user.subject)
      throw new ConvexError(
        "Your account changed. Return to the original account to confirm this assignment.",
      );
    if (!args.requestKey || args.requestKey.length > 100)
      throw new ConvexError("Missing assignment request identity.");
    const input = normalizedFields({
      title: args.title,
      brief: args.brief,
      producerClerkId: args.producerClerkId,
      producerPendingEmail: args.producerPendingEmail,
      directorClerkId: args.directorClerkId,
      directorPendingEmail: args.directorPendingEmail,
      cmoClerkId: args.cmoClerkId,
      dueDate: args.dueDate,
    });
    const requestSignature = JSON.stringify({
      projectId: args.projectId,
      ...input,
    });
    const existing = await ctx.db
      .query("contentItems")
      .withIndex("by_creator_request", (q) =>
        q
          .eq("teamId", project.teamId)
          .eq("createdByClerkId", user.subject)
          .eq("requestKey", args.requestKey),
      )
      .unique();
    if (existing) {
      if (existing.requestSignature !== requestSignature)
        throw new ConvexError(
          "Confirm the original assignment before changing its details.",
        );
      return existing._id;
    }
    const data = await validateFields(ctx, project.teamId, input);
    return ctx.db.insert("contentItems", {
      ...data,
      projectId: args.projectId,
      teamId: project.teamId,
      productionStatus: "planned",
      createdByClerkId: user.subject,
      requestKey: args.requestKey,
      requestSignature,
      updatedAt: Date.now(),
    });
  },
});
export const update = mutation({
  args: {
    itemId: v.id("contentItems"),
    expectedUpdatedAt: v.number(),
    ...fields,
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item) throw new ConvexError("Assignment not found.");
    await requireTeamAccess(ctx, item.teamId, "admin");
    if (item.updatedAt !== args.expectedUpdatedAt)
      throw new ConvexError(
        "This assignment changed. Reopen it to use the latest details.",
      );
    const data = await validateFields(ctx, item.teamId, {
      title: args.title,
      brief: args.brief,
      producerClerkId: args.producerClerkId,
      producerPendingEmail: args.producerPendingEmail,
      directorClerkId: args.directorClerkId,
      directorPendingEmail: args.directorPendingEmail,
      cmoClerkId: args.cmoClerkId,
      dueDate: args.dueDate,
    });
    await ctx.db.patch(item._id, {
      ...data,
      updatedAt: Math.max(Date.now(), item.updatedAt + 1),
    });
  },
});
export const start = mutation({
  args: { itemId: v.id("contentItems") },
  handler: async (ctx, { itemId }) => {
    const item = await ctx.db.get(itemId);
    if (!item) throw new ConvexError("Assignment not found.");
    const { user, membership } = await requireTeamAccess(
      ctx,
      item.teamId,
      "member",
    );
    if (!canProduceContent(item, user.subject, membership.role))
      throw new ConvexError(
        "Only the assigned content team can start this work.",
      );
    await ctx.db.patch(itemId, {
      productionStatus: "in_progress",
      updatedAt: Math.max(Date.now(), item.updatedAt + 1),
    });
  },
});
export const linkVideo = mutation({
  args: { itemId: v.id("contentItems"), videoId: v.id("videos") },
  handler: async (ctx, { itemId, videoId }) => {
    const item = await ctx.db.get(itemId);
    if (!item) throw new ConvexError("Assignment not found.");
    const { user, membership } = await requireTeamAccess(
      ctx,
      item.teamId,
      "member",
    );
    if (!canProduceContent(item, user.subject, membership.role))
      throw new ConvexError(
        "Only the assigned content team can attach an edit.",
      );
    const video = await ctx.db.get(videoId);
    if (!video || video.projectId !== item.projectId)
      throw new ConvexError("Choose a video from this assignment’s project.");
    if (video.contentItemId && video.contentItemId !== itemId)
      throw new ConvexError("That video belongs to another assignment.");
    await ctx.db.patch(videoId, { contentItemId: itemId });
    await ctx.db.patch(itemId, {
      currentVideoId: videoId,
      productionStatus: "in_progress",
      updatedAt: Math.max(Date.now(), item.updatedAt + 1),
    });
  },
});

export const getReadyVideo = query({
  args: { videoId: v.id("videos") },
  handler: async (ctx, { videoId }) => {
    const video = await ctx.db.get(videoId);
    if (!video) throw new ConvexError("Video not found.");
    await requireProjectAccess(ctx, video.projectId);
    if (video.status !== "ready" || video.workflowStatus !== "done")
      throw new ConvexError(
        "This edit is not currently approved and ready to use.",
      );
    if (video.contentItemId) {
      const item = await ctx.db.get(video.contentItemId);
      if (
        !item ||
        item.projectId !== video.projectId ||
        item.currentVideoId !== videoId
      )
        throw new ConvexError(
          "A newer edit replaced this version. Use the current approved edit.",
        );
      return { ...video, title: item.title };
    }
    return video;
  },
});

export const plan = mutation({
  args: { itemId: v.id("contentItems"), expectedUpdatedAt: v.number(), title: v.string(), brief: v.string() },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item) throw new ConvexError("Assignment not found.");
    const {user,membership} = await requireTeamAccess(ctx,item.teamId,"member");
    if (!canReviewContent(item,user.subject,membership.role)) throw new ConvexError("Only the assigned director or an administrator can plan this ad.");
    if (item.updatedAt !== args.expectedUpdatedAt) throw new ConvexError("This assignment changed. Reopen it to use the latest details.");
    const data = await validateFields(ctx,item.teamId,{ title:args.title,brief:args.brief });
    await ctx.db.patch(item._id,{ title:data.title,brief:data.brief,plannedAt:Date.now(),updatedAt:Math.max(Date.now(),item.updatedAt+1) });
  },
});
