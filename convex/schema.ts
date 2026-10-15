import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  teams: defineTable({
    rawAssetBytes: v.optional(v.number()),
    name: v.string(),
    slug: v.string(),
    ownerClerkId: v.string(),
    plan: v.union(
      v.literal("basic"),
      v.literal("pro"),
      v.literal("free"),
      v.literal("team"),
    ),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    stripePriceId: v.optional(v.string()),
    billingStatus: v.optional(v.string()),
  })
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerClerkId"])
    .index("by_stripe_customer_id", ["stripeCustomerId"])
    .index("by_stripe_subscription_id", ["stripeSubscriptionId"]),

  teamMembers: defineTable({
    teamId: v.id("teams"),
    userClerkId: v.string(),
    userEmail: v.string(),
    userName: v.string(),
    userAvatarUrl: v.optional(v.string()),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer"),
    ),
  })
    .index("by_team", ["teamId"])
    .index("by_user", ["userClerkId"])
    .index("by_team_and_user", ["teamId", "userClerkId"])
    .index("by_team_and_email", ["teamId", "userEmail"]),

  teamInvites: defineTable({
    teamId: v.id("teams"),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
    invitedByClerkId: v.string(),
    invitedByName: v.string(),
    token: v.string(),
    expiresAt: v.number(),
  })
    .index("by_team", ["teamId"])
    .index("by_email", ["email"])
    .index("by_token", ["token"]),

  projects: defineTable({
    teamId: v.id("teams"),
    name: v.string(),
    description: v.optional(v.string()),
  }).index("by_team", ["teamId"]),

  productionTeams: defineTable({
    teamId: v.id("teams"), name: v.string(),
    directorClerkId: v.string(), producerClerkId: v.string(), updatedAt: v.number(),
  }).index("by_team", ["teamId"]),

  contentBatches: defineTable({
    teamId: v.id("teams"), projectId: v.id("projects"),
    productionTeamId: v.id("productionTeams"), productionTeamName: v.string(),
    quantity: v.number(), dueDate: v.string(), notes: v.string(),
    createdByClerkId: v.string(), requestKey: v.string(), requestSignature: v.string(),
  }).index("by_team", ["teamId"]).index("by_project", ["projectId"])
    .index("by_creator_request", ["teamId", "createdByClerkId", "requestKey"]),

  contentItems: defineTable({
    sourceAssetIds: v.optional(v.array(v.id("rawAssets"))),
    batchId: v.optional(v.id("contentBatches")),
    plannedAt: v.optional(v.number()),
    sequence: v.optional(v.number()),
    teamId: v.id("teams"),
    projectId: v.id("projects"),
    title: v.string(),
    brief: v.string(),
    producerClerkId: v.optional(v.string()),
    directorClerkId: v.optional(v.string()),
    cmoClerkId: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    productionStatus: v.union(v.literal("planned"), v.literal("in_progress")),
    currentVideoId: v.optional(v.id("videos")),
    createdByClerkId: v.string(),
    requestKey: v.string(),
    requestSignature: v.string(),
    updatedAt: v.number(),
  })
    .index("by_team", ["teamId"])
    .index("by_project", ["projectId"])
    .index("by_creator_request", ["teamId", "createdByClerkId", "requestKey"]),

  rawAssets: defineTable({
    teamId: v.id("teams"),
    projectId: v.optional(v.id("projects")),
    filename: v.string(),
    fileSize: v.number(),
    contentType: v.string(),
    kind: v.union(v.literal("video"), v.literal("photo"), v.literal("audio")),
    searchText: v.string(),
    uploadedByClerkId: v.string(),
    uploadedByName: v.string(),
    requestKey: v.string(),
    requestSignature: v.string(),
    storageKey: v.optional(v.string()),
    storageETag: v.optional(v.string()),
    status: v.union(v.literal("uploading"), v.literal("ready"), v.literal("removed")),
  }).index("by_team", ["teamId"])
    .index("by_project", ["projectId"])
    .index("by_team_status", ["teamId", "status"])
    .index("by_team_status_scope_kind", ["teamId", "status", "projectId", "kind"])
    .index("by_team_status_kind", ["teamId", "status", "kind"])
    .index("by_team_status_uploader", ["teamId", "status", "uploadedByClerkId"])
    .index("by_creator_request", ["teamId", "uploadedByClerkId", "requestKey"])
    .searchIndex("search_files", { searchField: "searchText", filterFields: ["teamId", "projectId", "kind", "status"] }),

  videos: defineTable({
    projectId: v.id("projects"),
    contentItemId: v.optional(v.id("contentItems")),
    uploadedByClerkId: v.string(),
    uploaderName: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    visibility: v.union(v.literal("public"), v.literal("private")),
    publicId: v.string(),
    // Mux video references
    muxUploadId: v.optional(v.string()),
    muxAssetId: v.optional(v.string()),
    muxPlaybackId: v.optional(v.string()),
    muxAssetStatus: v.optional(
      v.union(v.literal("preparing"), v.literal("ready"), v.literal("errored")),
    ),
    // Metadata
    s3Key: v.optional(v.string()),
    duration: v.optional(v.number()),
    thumbnailUrl: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    contentType: v.optional(v.string()),
    uploadError: v.optional(v.string()),
    status: v.union(
      v.literal("uploading"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    workflowStatus: v.union(
      v.literal("review"),
      v.literal("rework"),
      v.literal("done"),
    ),
  })
    .index("by_project", ["projectId"])
    .index("by_public_id", ["publicId"])
    .index("by_mux_upload_id", ["muxUploadId"])
    .index("by_mux_asset_id", ["muxAssetId"])
    .index("by_mux_playback_id", ["muxPlaybackId"]),

  comments: defineTable({
    videoId: v.id("videos"),
    userClerkId: v.string(),
    userName: v.string(),
    userAvatarUrl: v.optional(v.string()),
    text: v.string(),
    timestampSeconds: v.number(),
    parentId: v.optional(v.id("comments")),
    resolved: v.boolean(),
  })
    .index("by_video", ["videoId"])
    .index("by_video_and_timestamp", ["videoId", "timestampSeconds"])
    .index("by_parent", ["parentId"]),

  shareLinks: defineTable({
    videoId: v.id("videos"),
    token: v.string(),
    createdByClerkId: v.string(),
    createdByName: v.string(),
    expiresAt: v.optional(v.number()),
    allowDownload: v.boolean(),
    password: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
    failedAccessAttempts: v.optional(v.number()),
    lockedUntil: v.optional(v.number()),
    viewCount: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_video", ["videoId"]),

  shareAccessGrants: defineTable({
    shareLinkId: v.id("shareLinks"),
    token: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_share_link", ["shareLinkId"]),
});
