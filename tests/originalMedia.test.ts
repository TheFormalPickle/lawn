import test from "node:test";
import assert from "node:assert/strict";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { mediaMode } from "../convex/mediaPolicy";

const modules = {
  "../convex/_generated/server.js": () => import("../convex/_generated/server"),
  "../convex/videos.ts": () => import("../convex/videos"),
  "../convex/contentItems.ts": () => import("../convex/contentItems"),
};

test("original playback mode is an explicit server choice; unknown configuration fails closed", () => {
  assert.equal(mediaMode({}), "mux");
  assert.equal(mediaMode({ LAWN_MEDIA_MODE: "original" }), "original");
  assert.equal(mediaMode({ LAWN_MEDIA_MODE: "mux" }), "mux");
  assert.throws(
    () => mediaMode({ LAWN_MEDIA_MODE: "originl" }),
    /mux or original/,
  );
});

test("original readiness needs the exact captured object identity and replacement requires a fresh review", async () => {
  const previousMode = process.env.LAWN_MEDIA_MODE;
  process.env.LAWN_MEDIA_MODE = "original";
  const t = convexTest(schema, modules);
  try {
    const ids = await t.run(async (ctx) => {
      const teamId = await ctx.db.insert("teams", {
        name: "Synthetic original agency",
        slug: "original-test",
        ownerClerkId: "head",
        plan: "basic",
      });
      for (const [subject, role] of [
        ["head", "owner"],
        ["director", "member"],
        ["producer", "member"],
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
      const itemId = await ctx.db.insert("contentItems", {
        teamId,
        projectId,
        title: "Exact original",
        brief: "Synthetic only",
        producerClerkId: "producer",
        directorClerkId: "director",
        cmoClerkId: "cmo",
        productionStatus: "planned",
        createdByClerkId: "head",
        requestKey: "original",
        requestSignature: "original",
        updatedAt: 1,
      });
      const videoId = await ctx.db.insert("videos", {
        projectId,
        contentItemId: itemId,
        uploadedByClerkId: "producer",
        uploaderName: "Producer",
        title: "Original",
        visibility: "private",
        publicId: "exact-original",
        status: "uploading",
        workflowStatus: "review",
        s3Key: "videos/original/one.mp4",
        fileSize: 123,
        contentType: "video/mp4",
      });
      await ctx.db.patch(itemId, { currentVideoId: videoId });
      return { videoId, projectId };
    });
    const read = () => t.run((ctx) => ctx.db.get(ids.videoId));
    const complete = (uploadId: string) =>
      t.mutation(internal.videos.markOriginalReady, {
        videoId: ids.videoId,
        uploadId,
      });
    const record = (uploadId: string, storageETag: string) =>
      t.mutation(internal.videos.reconcileUploadedObjectMetadata, {
        videoId: ids.videoId,
        uploadId,
        fileSize: 123,
        contentType: "video/mp4",
        storageETag,
      });
    assert.equal(await complete("videos/original/wrong.mp4"), false);
    assert.equal(await complete("videos/original/one.mp4"), false);
    assert.equal(await record("videos/original/wrong.mp4", '"wrong"'), false);
    assert.equal(await record("videos/original/one.mp4", '"one"'), true);
    assert.equal(await complete("videos/original/one.mp4"), true);
    assert.equal(await complete("videos/original/one.mp4"), false);
    let video = await read();
    assert.equal(video!.status, "ready");
    assert.equal(video!.originalOnly, true);
    assert.equal(video!.s3ETag, '"one"');
    assert.equal(video!.muxAssetId, undefined);
    assert.equal(video!.muxPlaybackId, undefined);
    await assert.rejects(
      record("videos/original/one.mp4", '"changed"'),
      /original changed/,
    );
    assert.equal((await read())!.s3ETag, '"one"');
    await assert.rejects(
      t
        .withIdentity({ subject: "producer" })
        .mutation(api.videos.updateWorkflowStatus, {
          videoId: ids.videoId,
          workflowStatus: "done",
        }),
      /director|review|permission|assigned/i,
    );
    await t
      .withIdentity({ subject: "director" })
      .mutation(api.videos.updateWorkflowStatus, {
        videoId: ids.videoId,
        workflowStatus: "done",
      });
    assert.equal((await read())!.workflowStatus, "done");
    await t.mutation(internal.videos.setUploadInfo, {
      videoId: ids.videoId,
      s3Key: "videos/original/two.mp4",
      fileSize: 123,
      contentType: "video/mp4",
    });
    video = await read();
    assert.equal(video!.workflowStatus, "review");
    assert.equal(video!.status, "uploading");
    assert.equal(video!.s3ETag, undefined);
    assert.equal(video!.originalOnly, undefined);
    assert.equal(await complete("videos/original/one.mp4"), false);
    assert.equal(await complete("videos/original/two.mp4"), false);
    assert.equal(await record("videos/original/two.mp4", '"two"'), true);
    assert.equal(await complete("videos/original/two.mp4"), true);
    assert.equal((await read())!.workflowStatus, "review");
  } finally {
    if (previousMode === undefined) delete process.env.LAWN_MEDIA_MODE;
    else process.env.LAWN_MEDIA_MODE = previousMode;
  }
});
