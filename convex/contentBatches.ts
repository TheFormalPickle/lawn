import { v, ConvexError } from "convex/values";
import { mutation } from "./_generated/server";
import { requireProjectAccess, requireTeamAccess } from "./auth";
import { validateFields } from "./contentItems";

export const saveProductionTeam = mutation({
  args: {
    teamId: v.id("teams"),
    productionTeamId: v.optional(v.id("productionTeams")),
    expectedUpdatedAt: v.optional(v.number()),
    name: v.string(),
    directorClerkId: v.string(),
    producerClerkId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireTeamAccess(ctx, args.teamId, "admin");
    if (
      !args.directorClerkId ||
      !args.producerClerkId ||
      args.name.trim().length > 100
    )
      throw new ConvexError(
        "Name the content team and select its director and producer.",
      );
    const validated = await validateFields(ctx, args.teamId, {
      title: args.name,
      brief: "",
      directorClerkId: args.directorClerkId,
      producerClerkId: args.producerClerkId,
    });
    const existing = args.productionTeamId
      ? await ctx.db.get(args.productionTeamId)
      : null;
    if (args.productionTeamId && (!existing || existing.teamId !== args.teamId))
      throw new ConvexError("Content team not found.");
    if (existing && existing.updatedAt !== args.expectedUpdatedAt)
      throw new ConvexError("This team changed. Reopen its latest roster.");
    const data = {
      name: validated.title,
      directorClerkId: args.directorClerkId,
      producerClerkId: args.producerClerkId,
      updatedAt: Math.max(Date.now(), (existing?.updatedAt ?? 0) + 1),
    };
    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }
    // A lost create reply must not duplicate an unchanged pair/name.
    const teams = await ctx.db
      .query("productionTeams")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();
    const match = teams.find(
      (team) =>
        team.name === data.name &&
        team.directorClerkId === data.directorClerkId &&
        team.producerClerkId === data.producerClerkId,
    );
    return match
      ? match._id
      : ctx.db.insert("productionTeams", { teamId: args.teamId, ...data });
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    productionTeamId: v.id("productionTeams"),
    quantity: v.number(),
    dueDate: v.string(),
    notes: v.string(),
    requestKey: v.string(),
    expectedActorId: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, project } = await requireProjectAccess(
      ctx,
      args.projectId,
      "admin",
    );
    if (user.subject !== args.expectedActorId)
      throw new ConvexError(
        "Your account changed. Confirm this request from the original account.",
      );
    if (!args.requestKey || args.requestKey.length > 100)
      throw new ConvexError("Missing workload request identity.");
    if (
      !Number.isInteger(args.quantity) ||
      args.quantity < 1 ||
      args.quantity > 100
    )
      throw new ConvexError(
        "Request between 1 and 100 deliverables at a time.",
      );
    const signature = JSON.stringify({
      projectId: args.projectId,
      productionTeamId: args.productionTeamId,
      quantity: args.quantity,
      dueDate: args.dueDate,
      notes: args.notes.trim(),
    });
    const existing = await ctx.db
      .query("contentBatches")
      .withIndex("by_creator_request", (q) =>
        q
          .eq("teamId", project.teamId)
          .eq("createdByClerkId", user.subject)
          .eq("requestKey", args.requestKey),
      )
      .unique();
    if (existing) {
      if (existing.requestSignature !== signature)
        throw new ConvexError(
          "Confirm the original workload before changing its details.",
        );
      return existing._id;
    }
    const pair = await ctx.db.get(args.productionTeamId);
    if (!pair || pair.teamId !== project.teamId)
      throw new ConvexError("Select a content team from this agency.");
    if (!args.dueDate) throw new ConvexError("Choose a due date.");
    const validated = await validateFields(ctx, project.teamId, {
      title: project.name.slice(0, 160),
      brief: args.notes,
      dueDate: args.dueDate,
      directorClerkId: pair.directorClerkId,
      producerClerkId: pair.producerClerkId,
    });
    const batchId = await ctx.db.insert("contentBatches", {
      teamId: project.teamId,
      projectId: project._id,
      productionTeamId: pair._id,
      productionTeamName: pair.name,
      quantity: args.quantity,
      dueDate: args.dueDate,
      notes: validated.brief,
      createdByClerkId: user.subject,
      requestKey: args.requestKey,
      requestSignature: signature,
    });
    for (let index = 1; index <= args.quantity; index++)
      await ctx.db.insert("contentItems", {
        teamId: project.teamId,
        projectId: project._id,
        batchId,
        sequence: index,
        title: `${validated.title} · Deliverable ${index}`,
        brief: validated.brief,
        producerClerkId: pair.producerClerkId,
        directorClerkId: pair.directorClerkId,
        dueDate: args.dueDate,
        productionStatus: "planned",
        createdByClerkId: user.subject,
        requestKey: `${args.requestKey}:${index}`,
        requestSignature: signature,
        updatedAt: Date.now(),
      });
    return batchId;
  },
});
