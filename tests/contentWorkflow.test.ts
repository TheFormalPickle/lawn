import test from "node:test";
import assert from "node:assert/strict";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

const modules = {
  "../convex/_generated/server.js": () => import("../convex/_generated/server"),
  "../convex/contentItems.ts": () => import("../convex/contentItems"),
  "../convex/videos.ts": () => import("../convex/videos"),
  "../convex/projects.ts": () => import("../convex/projects"),
};
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const teamId = await ctx.db.insert("teams", {
      name: "Synthetic agency",
      slug: "synthetic",
      ownerClerkId: "head",
      plan: "basic",
    });
    const otherTeam = await ctx.db.insert("teams", {
      name: "Other agency",
      slug: "other",
      ownerClerkId: "outsider",
      plan: "basic",
    });
    for (const [subject, role] of [
      ["head", "owner"],
      ["director", "member"],
      ["producer", "member"],
      ["unassigned", "member"],
      ["cmo", "viewer"],
    ] as const)
      await ctx.db.insert("teamMembers", {
        teamId,
        userClerkId: subject,
        userEmail: `${subject}@example.invalid`,
        userName: subject,
        role,
      });
    const projectId = await ctx.db.insert("projects", {
      teamId,
      name: "Synthetic client",
    });
    const otherProjectId = await ctx.db.insert("projects", {
      teamId: otherTeam,
      name: "Other client",
    });
    const secondProjectId = await ctx.db.insert("projects", {
      teamId,
      name: "Different campaign",
    });
    return { teamId, projectId, otherProjectId, secondProjectId };
  });
  const head = t.withIdentity({ subject: "head" });
  const producer = t.withIdentity({ subject: "producer" });
  const director = t.withIdentity({ subject: "director" });
  const cmo = t.withIdentity({ subject: "cmo" });
  const input = {
    projectId: ids.projectId,
    requestKey: "original-request",
    expectedActorId: "head",
    title: "Product launch edit",
    brief: "Make the benefit clear.",
    producerClerkId: "producer",
    directorClerkId: "director",
    cmoClerkId: "cmo",
    dueDate: "2026-10-30",
  };
  const video = (
    projectId = ids.projectId,
    workflowStatus: "review" | "rework" | "done" = "review",
    status: "ready" | "processing" | "failed" = "ready",
  ) =>
    t.run((ctx) =>
      ctx.db.insert("videos", {
        projectId,
        uploadedByClerkId: "producer",
        uploaderName: "Producer",
        title: "Synthetic edit",
        visibility: "private",
        publicId: crypto.randomUUID(),
        status,
        workflowStatus,
      }),
    );
  const current = (itemId: Id<"contentItems">) =>
    t.run((ctx) => ctx.db.get(itemId));
  return { t, ...ids, head, producer, director, cmo, input, video, current };
}

test("original create retries once, rejects changed payload/account and survives later edits", async () => {
  const f = await fixture();
  const id = await f.head.mutation(api.contentItems.create, f.input);
  assert.equal(await f.head.mutation(api.contentItems.create, f.input), id);
  assert.equal(
    (await f.t.run((ctx) => ctx.db.query("contentItems").collect())).length,
    1,
  );
  await assert.rejects(
    f.head.mutation(api.contentItems.create, {
      ...f.input,
      title: "Different",
    }),
    /original assignment/,
  );
  await assert.rejects(
    f.head.mutation(api.contentItems.create, {
      ...f.input,
      expectedActorId: "other",
    }),
    /account changed/,
  );
  const item = await f.current(id);
  await f.head.mutation(api.contentItems.update, {
    itemId: id,
    expectedUpdatedAt: item!.updatedAt,
    title: "Updated brief",
    brief: "Newer requirements",
  });
  assert.equal(await f.head.mutation(api.contentItems.create, f.input), id);
  assert.equal((await f.current(id))!.title, "Updated brief");
});

test("only administrators assign; team boundaries and anonymous access fail closed", async () => {
  const f = await fixture();
  await assert.rejects(
    f.producer.mutation(api.contentItems.create, f.input),
    /admin/,
  );
  await assert.rejects(
    f.cmo.mutation(api.contentItems.create, f.input),
    /admin/,
  );
  await assert.rejects(
    f.t.query(api.contentItems.list, { teamId: f.teamId }),
    /authenticated/,
  );
  await assert.rejects(
    f.head.query(api.contentItems.list, {
      teamId: (await f.t.run((ctx) => ctx.db.get(f.otherProjectId)))!.teamId,
    }),
    /team member/,
  );
  assert.equal(
    (await f.cmo.query(api.contentItems.list, { teamId: f.teamId })).canManage,
    false,
  );
});

test("assignments accept current CMO viewers but reject foreign or read-only producers", async () => {
  const f = await fixture();
  await f.head.mutation(api.contentItems.create, f.input);
  await assert.rejects(
    f.head.mutation(api.contentItems.create, {
      ...f.input,
      requestKey: "other",
      producerClerkId: "cmo",
    }),
    /current members/,
  );
  await assert.rejects(
    f.head.mutation(api.contentItems.create, {
      ...f.input,
      requestKey: "foreign",
      directorClerkId: "outsider",
    }),
    /current members/,
  );
  for (const dueDate of ["2026-02-30", "tomorrow"])
    await assert.rejects(
      f.head.mutation(api.contentItems.create, {
        ...f.input,
        requestKey: dueDate,
        dueDate,
      }),
    );
});

test("only the assigned content team can start or attach edits", async () => {
  const f = await fixture();
  const id = await f.head.mutation(api.contentItems.create, f.input);
  await assert.rejects(
    f.t
      .withIdentity({ subject: "unassigned" })
      .mutation(api.contentItems.start, { itemId: id }),
    /assigned content team/,
  );
  await assert.rejects(
    f.cmo.mutation(api.contentItems.start, { itemId: id }),
    /member/,
  );
  await f.producer.mutation(api.contentItems.start, { itemId: id });
  assert.equal((await f.current(id))!.productionStatus, "in_progress");
  await assert.rejects(
    f.producer.mutation(api.contentItems.linkVideo, {
      itemId: id,
      videoId: await f.video(f.otherProjectId),
    }),
    /assignment’s project/,
  );
  await assert.rejects(
    f.producer.mutation(api.contentItems.linkVideo, {
      itemId: id,
      videoId: await f.video(f.secondProjectId),
    }),
    /assignment’s project/,
  );
});

test("review is authoritative; the assigned director approves, producer and CMOs cannot self-approve", async () => {
  const f = await fixture();
  const id = await f.head.mutation(api.contentItems.create, f.input);
  const videoId = await f.video();
  await f.producer.mutation(api.contentItems.linkVideo, {
    itemId: id,
    videoId,
  });
  assert.equal(
    (await f.producer.query(api.contentItems.list, { teamId: f.teamId }))
      .items[0].stage,
    "review",
  );
  assert.equal(
    (await f.producer.query(api.videos.get, { videoId })).canReview,
    false,
  );
  assert.equal(
    (await f.director.query(api.videos.get, { videoId })).canReview,
    true,
  );
  await assert.rejects(
    f.producer.mutation(api.videos.updateWorkflowStatus, {
      videoId,
      workflowStatus: "done",
    }),
    /assigned director/,
  );
  await assert.rejects(
    f.cmo.mutation(api.videos.updateWorkflowStatus, {
      videoId,
      workflowStatus: "done",
    }),
    /member/,
  );
  await f.director.mutation(api.videos.updateWorkflowStatus, {
    videoId,
    workflowStatus: "done",
  });
  assert.equal(
    (await f.cmo.query(api.contentItems.list, { teamId: f.teamId }))
      .readyVideos[0]._id,
    videoId,
  );
  assert.equal(
    (await f.cmo.query(api.contentItems.getReadyVideo, { videoId }))._id,
    videoId,
  );
  await f.director.mutation(api.videos.updateWorkflowStatus, {
    videoId,
    workflowStatus: "rework",
  });
  assert.equal(
    (await f.cmo.query(api.contentItems.list, { teamId: f.teamId })).readyVideos
      .length,
    0,
  );
  await assert.rejects(
    f.cmo.query(api.contentItems.getReadyVideo, { videoId }),
    /not currently approved/,
  );
});

test("replacement and failed processing hide previous approvals; an old approval cannot finish the new edit", async () => {
  const f = await fixture();
  const id = await f.head.mutation(api.contentItems.create, f.input);
  const old = await f.video(f.projectId, "done");
  await f.producer.mutation(api.contentItems.linkVideo, {
    itemId: id,
    videoId: old,
  });
  const replacement = await f.video(f.projectId, "review", "processing");
  await f.producer.mutation(api.contentItems.linkVideo, {
    itemId: id,
    videoId: replacement,
  });
  let data = await f.cmo.query(api.contentItems.list, { teamId: f.teamId });
  assert.equal(data.items[0].stage, "in_progress");
  assert.equal(data.readyVideos.length, 0);
  await assert.rejects(
    f.director.mutation(api.videos.updateWorkflowStatus, {
      videoId: replacement,
      workflowStatus: "done",
    }),
    /finish processing/,
  );
  await f.director.mutation(api.videos.updateWorkflowStatus, {
    videoId: old,
    workflowStatus: "done",
  });
  await assert.rejects(
    f.cmo.query(api.contentItems.getReadyVideo, { videoId: old }),
    /newer edit/,
  );
  await f.t.run((ctx) => ctx.db.patch(replacement, { status: "failed" }));
  data = await f.cmo.query(api.contentItems.list, { teamId: f.teamId });
  assert.equal(data.readyVideos.length, 0);
  assert.equal(data.items[0].video!.status, "failed");
});

test("one edit cannot belong to two assignments and invalid saved links do not certify readiness", async () => {
  const f = await fixture();
  const first = await f.head.mutation(api.contentItems.create, f.input);
  const second = await f.head.mutation(api.contentItems.create, {
    ...f.input,
    requestKey: "second",
    title: "Other edit",
  });
  const videoId = await f.video(f.projectId, "done");
  await f.producer.mutation(api.contentItems.linkVideo, {
    itemId: first,
    videoId,
  });
  await assert.rejects(
    f.producer.mutation(api.contentItems.linkVideo, {
      itemId: second,
      videoId,
    }),
    /another assignment/,
  );
  await f.t.run((ctx) => ctx.db.patch(second, { currentVideoId: videoId }));
  const data = await f.cmo.query(api.contentItems.list, { teamId: f.teamId });
  assert.equal(
    data.items.find((item) => item._id === second)!.stage,
    "in_progress",
  );
});

test("stale assignment edits fail instead of overwriting another person’s update", async () => {
  const f = await fixture();
  const id = await f.head.mutation(api.contentItems.create, f.input);
  const before = await f.current(id);
  await f.producer.mutation(api.contentItems.start, { itemId: id });
  await assert.rejects(
    f.head.mutation(api.contentItems.update, {
      itemId: id,
      expectedUpdatedAt: before!.updatedAt,
      title: "Stale title",
      brief: "Stale brief",
    }),
    /assignment changed/,
  );
  assert.equal((await f.current(id))!.title, f.input.title);
});

test("deleting a current edit leaves work in production and removing a project removes its assignments", async () => {
  const f = await fixture();
  const id = await f.head.mutation(api.contentItems.create, f.input);
  const videoId = await f.video(f.projectId, "done");
  await f.producer.mutation(api.contentItems.linkVideo, {
    itemId: id,
    videoId,
  });
  await f.head.mutation(api.videos.remove, { videoId });
  assert.equal((await f.current(id))!.currentVideoId, undefined);
  assert.equal(
    (await f.cmo.query(api.contentItems.list, { teamId: f.teamId })).items[0]
      .stage,
    "in_progress",
  );
  await f.head.mutation(api.projects.remove, { projectId: f.projectId });
  assert.equal(await f.current(id), null);
});

test("existing untracked approved videos remain available and retain member review access", async () => {
  const f = await fixture();
  const videoId = await f.video(f.projectId, "done");
  assert.equal(
    (await f.cmo.query(api.contentItems.list, { teamId: f.teamId }))
      .readyVideos[0]._id,
    videoId,
  );
  assert.equal(
    (await f.producer.query(api.videos.get, { videoId })).canReview,
    true,
  );
  await f.producer.mutation(api.videos.updateWorkflowStatus, {
    videoId,
    workflowStatus: "review",
  });
  assert.equal(
    (await f.cmo.query(api.contentItems.list, { teamId: f.teamId })).readyVideos
      .length,
    0,
  );
});


test("replacing bytes on the same video clears approval before processing can complete", async () => {
  const f = await fixture();
  const id = await f.head.mutation(api.contentItems.create, f.input);
  const videoId = await f.video(f.projectId, "done");
  await f.producer.mutation(api.contentItems.linkVideo, { itemId: id, videoId });
  await f.t.mutation(internal.videos.setUploadInfo, { videoId, s3Key: "synthetic/replaced.mp4", fileSize: 123, contentType: "video/mp4" });
  assert.equal((await f.producer.query(api.videos.get, { videoId })).workflowStatus, "review");
  await f.t.mutation(internal.videos.markAsProcessing, { videoId, uploadId: "synthetic/replaced.mp4" });
  await f.t.mutation(internal.videos.markAsReady, { videoId, uploadId: "synthetic/replaced.mp4", muxAssetId: "synthetic-asset", muxPlaybackId: "synthetic-playback" });
  assert.equal((await f.cmo.query(api.contentItems.list, { teamId: f.teamId })).readyVideos.length, 0);
  await assert.rejects(f.cmo.query(api.contentItems.getReadyVideo, { videoId }), /not currently approved/);
  const unassigned = f.t.withIdentity({ subject: "unassigned" });
  assert.equal((await unassigned.query(api.videos.get, { videoId })).canUpload, false);
  assert.equal((await f.producer.query(api.videos.get, { videoId })).canUpload, true);
  await f.director.mutation(api.videos.updateWorkflowStatus, { videoId, workflowStatus: "done" });
  assert.equal((await f.cmo.query(api.contentItems.list, { teamId: f.teamId })).readyVideos[0]._id, videoId);
});

test("old processing events cannot certify, fail or remap a new original", async () => {
  const f = await fixture();
  const videoId = await f.video();
  await f.t.mutation(internal.videos.setUploadInfo, { videoId, s3Key: "current.mp4", fileSize: 100, contentType: "video/mp4" });
  for (const uploadId of [undefined, "old.mp4"]) {
    assert.equal(await f.t.mutation(internal.videos.markAsReady, { videoId, uploadId, muxAssetId: "old", muxPlaybackId: "old-playback" }), false);
    assert.equal(await f.t.mutation(internal.videos.setMuxAssetReference, { videoId, uploadId, muxAssetId: "old" }), false);
    assert.equal(await f.t.mutation(internal.videos.markAsFailed, { videoId, uploadId, muxAssetId: "old", uploadError: "old error" }), false);
  }
  assert.equal((await f.producer.query(api.videos.get, { videoId })).status, "uploading");
  assert.equal(await f.t.mutation(internal.videos.markAsProcessing, { videoId, uploadId: "current.mp4" }), true);
  assert.equal(await f.t.mutation(internal.videos.markAsProcessing, { videoId, uploadId: "current.mp4" }), false);
  assert.equal(await f.t.mutation(internal.videos.setMuxAssetReference, { videoId, uploadId: "current.mp4", muxAssetId: "current" }), true);
  assert.equal(await f.t.mutation(internal.videos.markAsReady, { videoId, uploadId: "current.mp4", muxAssetId: "different", muxPlaybackId: "wrong" }), false);
  assert.equal(await f.t.mutation(internal.videos.markAsReady, { videoId, uploadId: "current.mp4", muxAssetId: "current", muxPlaybackId: "current-playback" }), true);
  assert.equal(await f.t.mutation(internal.videos.setMuxAssetReference, { videoId, uploadId: "current.mp4", muxAssetId: "current" }), false);
  assert.equal(await f.t.mutation(internal.videos.markAsFailed, { videoId, uploadId: "old.mp4", muxAssetId: "old" }), false);
  assert.equal((await f.producer.query(api.videos.get, { videoId })).status, "ready");
});

test("cancellation keeps late ready events from reviving an abandoned upload", async () => {
  const f = await fixture(); const videoId = await f.video();
  await f.t.mutation(internal.videos.setUploadInfo, { videoId, s3Key: "cancelled.mp4", fileSize: 100, contentType: "video/mp4" });
  await f.t.mutation(internal.videos.markAsProcessing, { videoId, uploadId: "cancelled.mp4" });
  assert.equal(await f.t.mutation(internal.videos.markAsFailed, { videoId, uploadId: "cancelled.mp4" }), true);
  assert.equal(await f.t.mutation(internal.videos.markAsReady, { videoId, uploadId: "cancelled.mp4", muxAssetId: "late", muxPlaybackId: "late" }), false);
  assert.equal((await f.producer.query(api.videos.get, { videoId })).status, "failed");
});

test("legacy events require a concrete current asset or upload reference", async () => {
  const f = await fixture(); const videoId = await f.video(f.projectId, "review", "processing");
  await f.t.run(ctx => ctx.db.patch(videoId, { muxAssetId: "legacy-asset", muxUploadId: "legacy-upload" }));
  assert.equal(await f.t.mutation(internal.videos.markAsReady, { videoId, muxAssetId: "legacy-asset", muxPlaybackId: "legacy-playback" }), true);
  assert.equal(await f.t.mutation(internal.videos.markAsFailed, { videoId, muxUploadId: "foreign-upload" }), false);
  assert.equal(await f.t.mutation(internal.videos.markAsFailed, { videoId, muxUploadId: "legacy-upload" }), true);
});

test("stale original metadata and playback resolutions cannot overwrite a replacement", async () => {
  const f = await fixture(); const videoId = await f.video();
  await f.t.mutation(internal.videos.setUploadInfo, { videoId, s3Key: "current.mp4", fileSize: 100, contentType: "video/mp4" });
  assert.equal(await f.t.mutation(internal.videos.reconcileUploadedObjectMetadata, { videoId, uploadId: "old.mp4", fileSize: 3, contentType: "video/webm" }), false);
  await assert.rejects(f.t.mutation(internal.videos.markAsProcessing, { videoId, uploadId: "old.mp4" }), /replaced/);
  await f.t.mutation(internal.videos.setMuxPlaybackId, { videoId, muxAssetId: "old", muxPlaybackId: "old-playback" });
  const current = await f.producer.query(api.videos.get, { videoId });
  assert.equal(current.fileSize, 100); assert.equal(current.contentType, "video/mp4"); assert.equal(current.muxPlaybackId, undefined);
});
