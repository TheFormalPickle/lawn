import test from "node:test";
import assert from "node:assert/strict";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { preserveOriginalRemoval } from "../convex/mediaDeletionReceipts";
import stripeSchema from "../node_modules/@convex-dev/stripe/src/component/schema";

const modules = {
  "../convex/_generated/server.js": () => import("../convex/_generated/server"),
  "../convex/videos.ts": () => import("../convex/videos"),
  "../convex/projects.ts": () => import("../convex/projects"),
  "../convex/teams.ts": () => import("../convex/teams"),
};

async function fixture() {
  const t = convexTest(schema, modules);
  t.registerComponent("stripe", stripeSchema, {
    "./_generated/server.js": () =>
      import("../node_modules/@convex-dev/stripe/src/component/_generated/server"),
    "./public.ts": () =>
      import("../node_modules/@convex-dev/stripe/src/component/public"),
  });
  const ids = await t.run(async (ctx) => {
    const teamId = await ctx.db.insert("teams", {
      name: "Owned cleanup",
      slug: "owned-cleanup",
      ownerClerkId: "owner",
      plan: "basic",
    });
    const otherTeamId = await ctx.db.insert("teams", {
      name: "Other workspace",
      slug: "other-cleanup",
      ownerClerkId: "other",
      plan: "basic",
    });
    for (const [userClerkId, role] of [
      ["owner", "owner"],
      ["producer", "member"],
      ["cmo", "viewer"],
    ] as const)
      await ctx.db.insert("teamMembers", {
        teamId,
        userClerkId,
        userEmail: `${userClerkId}@example.invalid`,
        userName: userClerkId,
        role,
      });
    await ctx.db.insert("teamMembers", {
      teamId: otherTeamId,
      userClerkId: "other",
      userEmail: "other@example.invalid",
      userName: "Other",
      role: "owner",
    });
    const projectId = await ctx.db.insert("projects", {
      teamId,
      name: "Owned project",
    });
    const secondProjectId = await ctx.db.insert("projects", {
      teamId,
      name: "Second project",
    });
    const otherProjectId = await ctx.db.insert("projects", {
      teamId: otherTeamId,
      name: "Other project",
    });
    return { teamId, otherTeamId, projectId, secondProjectId, otherProjectId };
  });
  const owner = t.withIdentity({ subject: "owner" });
  const file = (
    projectId = ids.projectId,
    key: string | undefined = "videos/exact-original/file.mp4",
    etag: string | undefined = '"original-etag"',
  ) =>
    t.run((ctx) =>
      ctx.db.insert("videos", {
        projectId,
        title: "Owned edit",
        uploadedByClerkId: "producer",
        uploaderName: "Producer",
        publicId: crypto.randomUUID(),
        visibility: "private",
        status: "ready",
        workflowStatus: "done",
        s3Key: key,
        s3ETag: etag,
        fileSize: 1234,
        contentType: "video/mp4",
        originalOnly: true,
      }),
    );
  const receipts = () =>
    t.run((ctx) => ctx.db.query("mediaDeletionReceipts").collect());
  return { t, ...ids, owner, file, receipts };
}

test("authorized deletion preserves exact immutable original provenance, never a completed-cleanup claim", async () => {
  const f = await fixture();
  const opaque =
    "https://legacy.example.invalid/private-bucket/path%2Funchanged?original=1";
  const id = await f.file(f.projectId, opaque);
  const original = await f.t.run((ctx) => ctx.db.get(id));
  await f.owner.mutation(api.videos.remove, { videoId: id });
  assert.equal(await f.t.run((ctx) => ctx.db.get(id)), null);
  const [receipt] = await f.receipts();
  assert.equal(receipt.storageKey, opaque);
  assert.equal(receipt.storageETag, '"original-etag"');
  assert.equal(receipt.fileSize, 1234);
  assert.equal(receipt.contentType, "video/mp4");
  assert.equal(receipt.videoId, id);
  assert.equal(receipt.projectId, f.projectId);
  assert.equal(receipt.teamId, f.teamId);
  assert.equal(receipt.uploadedBySubject, "producer");
  assert.equal(receipt.requestedBySubject, "owner");
  assert.equal(receipt.reason, "video_deleted");
  assert.equal(receipt.status, "pending_review");
  assert.equal(receipt.storageBinding, "unknown");
  assert.equal(receipt.uploadLease, "unknown");
  await f.t.run((ctx) =>
    preserveOriginalRemoval(ctx, original!, "project_deleted", "other"),
  );
  assert.deepEqual(await f.receipts(), [receipt]);
  assert.equal(
    (
      await f.t.run((ctx) =>
        ctx.db.system.query("_scheduled_functions").collect(),
      )
    ).length,
    0,
  );
});

test("producer, CMO, foreign and anonymous deletion attempts cannot write receipts or remove files", async () => {
  const f = await fixture(),
    id = await f.file();
  for (const subject of ["producer", "cmo", "other"])
    await assert.rejects(
      f.t
        .withIdentity({ subject })
        .mutation(api.videos.remove, { videoId: id }),
    );
  await assert.rejects(f.t.mutation(api.videos.remove, { videoId: id }));
  assert.ok(await f.t.run((ctx) => ctx.db.get(id)));
  assert.deepEqual(await f.receipts(), []);
});

test("project and workspace cascades retain only their originals after parent removal", async () => {
  const oldMode = process.env.LAWN_BILLING_MODE;
  process.env.LAWN_BILLING_MODE = "internal";
  try {
    const f = await fixture(),
      first = await f.file(),
      second = await f.file(f.secondProjectId),
      foreign = await f.file(f.otherProjectId);
    await f.owner.mutation(api.projects.remove, { projectId: f.projectId });
    assert.equal(await f.t.run((ctx) => ctx.db.get(f.projectId)), null);
    assert.deepEqual(
      (await f.receipts()).map((r) => [r.videoId, r.reason]),
      [[first, "project_deleted"]],
    );
    await f.owner.mutation(api.teams.deleteTeam, { teamId: f.teamId });
    assert.equal(await f.t.run((ctx) => ctx.db.get(f.teamId)), null);
    const receipts = await f.receipts();
    assert.equal(receipts.length, 2);
    assert.ok(
      receipts.some(
        (r) =>
          r.videoId === second &&
          r.reason === "workspace_deleted" &&
          r.teamId === f.teamId,
      ),
    );
    assert.ok(await f.t.run((ctx) => ctx.db.get(foreign)));
    assert.ok(await f.t.run((ctx) => ctx.db.get(f.otherTeamId)));
  } finally {
    if (oldMode === undefined) delete process.env.LAWN_BILLING_MODE;
    else process.env.LAWN_BILLING_MODE = oldMode;
  }
});

test("replacement retires only a different old key; unknown fields stay unknown", async () => {
  const f = await fixture(),
    id = await f.file();
  const replace = (s3Key: string) =>
    f.t.mutation(internal.videos.setUploadInfo, {
      videoId: id,
      s3Key,
      fileSize: 555,
      contentType: "video/mp4",
    });
  await replace("videos/exact-original/file.mp4");
  assert.deepEqual(await f.receipts(), []);
  await replace("videos/exact-original/new.mp4");
  assert.equal((await f.receipts()).length, 1);
  await replace("videos/exact-original/third.mp4");
  const receipts = await f.receipts();
  assert.equal(receipts.length, 2);
  const pending = receipts.find((r) => r.storageKey.endsWith("new.mp4"))!;
  assert.equal(pending.storageETag, undefined);
  assert.equal(pending.originalOnly, undefined);
  assert.equal(pending.requestedBySubject, undefined);
  assert.equal(pending.videoStatus, "uploading");
  assert.equal(pending.status, "pending_review");
});

test("colliding keys and recorded versions preserve separate ownership; no-key edits create no receipt", async () => {
  const f = await fixture();
  const a = await f.file(),
    b = await f.file(f.otherProjectId);
  await f.owner.mutation(api.videos.remove, { videoId: a });
  assert.ok(await f.t.run((ctx) => ctx.db.get(b)));
  await f.t
    .withIdentity({ subject: "other" })
    .mutation(api.videos.remove, { videoId: b });
  assert.equal((await f.receipts()).length, 2);
  const empty = await f.file();
  await f.t.run((ctx) => ctx.db.patch(empty, { s3Key: undefined }));
  await f.owner.mutation(api.videos.remove, { videoId: empty });
  assert.equal((await f.receipts()).length, 2);
  const versioned = await f.file();
  const original = await f.t.run((ctx) => ctx.db.get(versioned));
  await f.t.run((ctx) =>
    preserveOriginalRemoval(ctx, original!, "original_replaced"),
  );
  await f.t.run((ctx) =>
    preserveOriginalRemoval(
      ctx,
      { ...original!, s3ETag: '"different-version"' },
      "original_replaced",
    ),
  );
  assert.equal(
    (await f.receipts()).filter((r) => r.videoId === versioned).length,
    2,
  );
});

test("late ready events cannot revive deleted metadata or complete a cleanup receipt", async () => {
  const f = await fixture(),
    id = await f.file();
  await f.owner.mutation(api.videos.remove, { videoId: id });
  const oldMode = process.env.LAWN_MEDIA_MODE;
  process.env.LAWN_MEDIA_MODE = "original";
  try {
    assert.equal(
      await f.t.mutation(internal.videos.markOriginalReady, {
        videoId: id,
        uploadId: "videos/exact-original/file.mp4",
      }),
      false,
    );
    assert.equal(await f.t.run((ctx) => ctx.db.get(id)), null);
    assert.equal((await f.receipts())[0].status, "pending_review");
  } finally {
    if (oldMode === undefined) delete process.env.LAWN_MEDIA_MODE;
    else process.env.LAWN_MEDIA_MODE = oldMode;
  }
});
