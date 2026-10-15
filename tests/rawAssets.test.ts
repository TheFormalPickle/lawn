import test from "node:test";
import assert from "node:assert/strict";
import { convexTest } from "convex-test";
import { internalActionGeneric } from "convex/server";
import { v } from "convex/values";
import schema from "../convex/schema";
import { api, internal, components } from "../convex/_generated/api";
import stripeSchema from "../node_modules/@convex-dev/stripe/src/component/schema";
import { getTeamStorageUsedBytes } from "../convex/billingHelpers";
import { rawAssetFile } from "../convex/rawAssetPolicy";

const modules = {
  "../convex/_generated/server.js": () => import("../convex/_generated/server"),
  "../convex/rawAssets.ts": () => import("../convex/rawAssets"),
  "../convex/rawAssetActions.ts": () => import("../convex/rawAssetActions"),
  "../convex/projects.ts": () => import("../convex/projects"),
  "../convex/contentItems.ts": () => import("../convex/contentItems"),
  "../convex/videos.ts": () => import("../convex/videos"),
};
async function fixture() {
  const deletedKeys: string[] = [];
  // Metadata/receipt tests stub only the scheduled storage boundary. Actual S3
  // delete/HEAD/PUT/GET effects are checked by separate saved-record acceptance.
  const t = convexTest(schema, {
    ...modules,
    "../convex/rawAssetActions.ts": async () => ({
      deleteBytes: internalActionGeneric({
        args: { key: v.string() },
        handler: async (_ctx, { key }) => {
          deletedKeys.push(key);
        },
      }),
    }),
  });
  const drain = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await t.finishInProgressScheduledFunctions();
  };
  t.registerComponent("stripe", stripeSchema, {
    "./_generated/server.js": () =>
      import("../node_modules/@convex-dev/stripe/src/component/_generated/server"),
    "./public.ts": () =>
      import("../node_modules/@convex-dev/stripe/src/component/public"),
    "./private.ts": () =>
      import("../node_modules/@convex-dev/stripe/src/component/private"),
  });
  const ids = await t.run(async (ctx) => {
    const teamId = await ctx.db.insert("teams", {
      name: "Synthetic raw assets",
      slug: "raw",
      plan: "basic",
      ownerClerkId: "head",
    });
    const otherTeam = await ctx.db.insert("teams", {
      name: "Foreign team",
      slug: "foreign",
      plan: "basic",
      ownerClerkId: "outsider",
    });
    for (const [subject, role] of [
      ["head", "owner"],
      ["director", "member"],
      ["producer", "member"],
      ["colleague", "member"],
      ["cmo", "viewer"],
    ] as const)
      await ctx.db.insert("teamMembers", {
        teamId,
        userClerkId: subject,
        userName: subject,
        userEmail: `${subject}@example.invalid`,
        role,
      });
    const projectId = await ctx.db.insert("projects", {
        teamId,
        name: "Client A",
      }),
      projectB = await ctx.db.insert("projects", { teamId, name: "Client B" }),
      foreign = await ctx.db.insert("projects", {
        teamId: otherTeam,
        name: "Foreign client",
      });
    const itemId = await ctx.db.insert("contentItems", {
      teamId,
      projectId,
      title: "Assigned edit",
      brief: "",
      producerClerkId: "producer",
      directorClerkId: "director",
      productionStatus: "planned",
      createdByClerkId: "head",
      requestKey: "slot",
      requestSignature: "slot",
      updatedAt: 1,
    });
    await ctx.runMutation(components.stripe.private.handleSubscriptionCreated, {
      stripeSubscriptionId: "sub_inert",
      stripeCustomerId: "cus_inert",
      status: "active",
      currentPeriodEnd: 2_000_000_000,
      cancelAtPeriodEnd: false,
      priceId: "price_inert",
      metadata: { orgId: teamId },
    });
    return { teamId, projectId, projectB, foreign, itemId };
  });
  const member = t.withIdentity({
      subject: "producer",
      name: "Synthetic producer",
    }),
    head = t.withIdentity({ subject: "head" }),
    director = t.withIdentity({ subject: "director" }),
    cmo = t.withIdentity({ subject: "cmo" }),
    colleague = t.withIdentity({ subject: "colleague" });
  const input = {
    teamId: ids.teamId,
    projectId: ids.projectId,
    filename: "Opening take.mp4",
    fileSize: 100,
    contentType: "video/mp4",
    requestKey: "same-request",
    expectedActorId: "producer",
  };
  // Local component records only; no provider credentials or live subscriptions.
  const ready = async (overrides: Partial<typeof input> = {}) => {
    const id = await member.mutation(api.rawAssets.create, {
      ...input,
      ...overrides,
    });
    const prepared = await t.mutation(internal.rawAssets.prepare, {
      assetId: id,
      actor: "producer",
      key: `raw/${id}/attempt`,
    });
    await t.mutation(internal.rawAssets.complete, {
      assetId: id,
      actor: "producer",
      etag: "opaque-etag",
      key: prepared.storageKey!,
    });
    return id;
  };
  return {
    t,
    ...ids,
    member,
    head,
    director,
    cmo,
    colleague,
    input,
    ready,
    drain,
    deletedKeys,
  };
}

test("supported media, aliases and omitted MIME retain exact safe types; invalid names and bytes fail", () => {
  assert.equal(rawAssetFile("PHOTO.JPG", 20, "").contentType, "image/jpeg");
  assert.equal(
    rawAssetFile("voice.wav", 20, "audio/x-wav").contentType,
    "audio/wav",
  );
  assert.equal(
    rawAssetFile("track.m4a", 20, "application/octet-stream").kind,
    "audio",
  );
  for (const input of [
    ["page.svg", 20, "image/svg+xml"],
    ["../take.mp4", 20, "video/mp4"],
    ["take.mp4", 0, "video/mp4"],
    ["take.mp4", 1.5, "video/mp4"],
    ["take.jpg", 20, "text/html"],
    ["take.mp4", 5 * 1024 ** 3 + 1, "video/mp4"],
  ] as const)
    assert.throws(() => rawAssetFile(input[0], input[1], input[2]));
});

test("create retries the original receipt without duplicate reservation; payload/account/client and role gates persist", async () => {
  const f = await fixture();
  const id = await f.member.mutation(api.rawAssets.create, f.input);
  assert.equal(await f.member.mutation(api.rawAssets.create, f.input), id);
  assert.equal(
    await f.t.run((ctx) => getTeamStorageUsedBytes(ctx, f.teamId)),
    100,
  );
  assert.equal(
    (await f.member.query(api.rawAssets.unfinished, { teamId: f.teamId })).items
      .length,
    1,
  );
  await assert.rejects(
    f.member.mutation(api.rawAssets.create, { ...f.input, fileSize: 101 }),
    /original file/,
  );
  await assert.rejects(
    f.director.mutation(api.rawAssets.create, f.input),
    /account changed/,
  );
  await assert.rejects(
    f.cmo.mutation(api.rawAssets.create, {
      ...f.input,
      expectedActorId: "cmo",
    }),
    /member role/,
  );
  await assert.rejects(
    f.member.mutation(api.rawAssets.create, {
      ...f.input,
      projectId: f.foreign,
      requestKey: "foreign",
    }),
    /team member/,
  );
  assert.equal(
    (
      await f.member.query(api.rawAssets.findUpload, {
        teamId: f.teamId,
        requestKey: f.input.requestKey,
      })
    )?.assetId,
    id,
  );
  assert.equal(
    await f.director.query(api.rawAssets.findUpload, {
      teamId: f.teamId,
      requestKey: f.input.requestKey,
    }),
    null,
  );
});

test("a first prepared path wins and a removed receipt cannot be revived by retries or late completion", async () => {
  const f = await fixture(),
    id = await f.ready();
  const original = await f.member.query(api.rawAssets.get, { assetId: id });
  const retry = await f.t.mutation(internal.rawAssets.prepare, {
    assetId: id,
    actor: "producer",
    key: `raw/${id}/another-attempt`,
  });
  assert.equal(retry.storageKey, original.storageKey);
  await assert.rejects(
    f.t.mutation(internal.rawAssets.complete, {
      assetId: id,
      actor: "producer",
      etag: "opaque-etag",
      key: `raw/${id}/wrong`,
    }),
    /no longer current/,
  );
  await assert.rejects(
    f.colleague.mutation(api.rawAssets.remove, { assetId: id }),
    /uploader/,
  );
  await f.member.mutation(api.rawAssets.remove, { assetId: id });
  await f.drain();
  assert.deepEqual(f.deletedKeys, [original.storageKey]);
  await f.member.mutation(api.rawAssets.remove, { assetId: id });
  assert.equal(
    await f.t.run((ctx) => getTeamStorageUsedBytes(ctx, f.teamId)),
    0,
  );
  await assert.rejects(
    f.member.query(api.rawAssets.get, { assetId: id }),
    /removed/,
  );
  await assert.rejects(
    f.member.mutation(api.rawAssets.create, f.input),
    /removed/,
  );
  await assert.rejects(
    f.t.mutation(internal.rawAssets.complete, {
      assetId: id,
      actor: "producer",
      etag: "opaque-etag",
      key: original.storageKey!,
    }),
    /no longer current/,
  );
});

test("viewer/anonymous/foreign reads are denied; unfinished files never enter the raw or approved library", async () => {
  const f = await fixture(),
    id = await f.member.mutation(api.rawAssets.create, f.input);
  const list = {
    teamId: f.teamId,
    search: "",
    paginationOpts: { cursor: null, numItems: 50 },
  };
  assert.equal((await f.member.query(api.rawAssets.list, list)).page.length, 0);
  for (const caller of [f.cmo, f.t, f.t.withIdentity({ subject: "outsider" })])
    await assert.rejects(caller.query(api.rawAssets.get, { assetId: id }));
  await assert.rejects(f.cmo.query(api.rawAssets.list, list), /member role/);
  const tracker = await f.cmo.query(api.contentItems.list, {
    teamId: f.teamId,
  });
  assert.equal(tracker.canBrowseRaw, false);
  assert.deepEqual(tracker.readyVideos, []);
});

test("paginated scope and filename search preserve ready file identity and genuine empty across more than fifty rows", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    const { expectedActorId: _actor, ...saved } = f.input;
    for (let i = 0; i < 61; i++)
      await ctx.db.insert("rawAssets", {
        ...saved,
        filename: `Scene ${i}.mp4`,
        requestSignature: "seed",
        searchText: `scene ${i} meadow`,
        kind: "video",
        uploadedByClerkId: "producer",
        uploadedByName: "Producer",
        status: "ready",
        projectId: i < 60 ? f.projectId : f.projectB,
      });
  });
  const args = {
    teamId: f.teamId,
    projectId: f.projectId,
    kind: "video" as const,
    search: "",
    paginationOpts: { numItems: 50, cursor: null as string | null },
  };
  const first = await f.member.query(api.rawAssets.list, args);
  assert.equal(first.page.length, 50);
  assert.equal(first.isDone, false);
  const second = await f.member.query(api.rawAssets.list, {
    ...args,
    paginationOpts: { ...args.paginationOpts, cursor: first.continueCursor },
  });
  assert.equal(second.page.length, 10);
  assert.equal(second.isDone, true);
  assert.equal(
    new Set([...first.page, ...second.page].map((x) => x._id)).size,
    60,
  );
  assert.equal(
    (await f.member.query(api.rawAssets.list, { ...args, kind: "photo" })).page
      .length,
    0,
  );
  const search = await f.member.query(api.rawAssets.list, {
    ...args,
    projectId: f.projectB,
    search: "meadow",
  });
  assert.equal(search.page.length, 1);
  assert.equal(search.page[0].projectId, f.projectB);
  assert.equal(
    (
      await f.member.query(api.rawAssets.list, {
        ...args,
        projectId: undefined,
        sharedOnly: true,
      })
    ).page.length,
    0,
  );
});

test("reuse is an idempotent exact-client reference, never approval, and shared sources can serve another assigned client", async () => {
  const f = await fixture(),
    source = await f.ready();
  await f.director.mutation(api.rawAssets.useInAssignment, {
    assetId: source,
    itemId: f.itemId,
  });
  await f.member.mutation(api.rawAssets.useInAssignment, {
    assetId: source,
    itemId: f.itemId,
  });
  assert.deepEqual(
    (await f.t.run((ctx) => ctx.db.get(f.itemId)))?.sourceAssetIds,
    [source],
  );
  await assert.rejects(
    f.colleague.mutation(api.rawAssets.useInAssignment, {
      assetId: source,
      itemId: f.itemId,
    }),
    /assigned content team/,
  );
  await assert.rejects(
    f.cmo.mutation(api.rawAssets.useInAssignment, {
      assetId: source,
      itemId: f.itemId,
    }),
    /member role/,
  );
  const wrong = await f.ready({
    projectId: f.projectB,
    requestKey: "client-b",
  });
  await assert.rejects(
    f.member.mutation(api.rawAssets.useInAssignment, {
      assetId: wrong,
      itemId: f.itemId,
    }),
    /this client/,
  );
  const shared = await f.ready({
    projectId: undefined,
    requestKey: "shared",
    filename: "Sound.wav",
    contentType: "audio/wav",
  });
  await f.member.mutation(api.rawAssets.useInAssignment, {
    assetId: shared,
    itemId: f.itemId,
  });
  const member = await f.member.query(api.contentItems.list, {
    teamId: f.teamId,
  });
  assert.equal(member.items[0].stage, "planned");
  assert.equal(member.readyVideos.length, 0);
  assert.equal(member.items[0].sourceAssets.length, 2);
  const viewer = await f.cmo.query(api.contentItems.list, { teamId: f.teamId });
  assert.deepEqual(viewer.items[0].sourceAssets, []);
  await f.member.mutation(api.rawAssets.remove, { assetId: source });
  await f.drain();
  assert.equal(
    (await f.member.query(api.contentItems.list, { teamId: f.teamId })).items[0]
      .sourceAssets[0].available,
    false,
  );
});

test("revoked membership cannot prepare or confirm an already created file", async () => {
  const f = await fixture(),
    id = await f.member.mutation(api.rawAssets.create, f.input),
    key = `raw/${id}/original`;
  await f.t.mutation(internal.rawAssets.prepare, {
    assetId: id,
    actor: "producer",
    key,
  });
  await f.t.run(async (ctx) => {
    const member = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", f.teamId).eq("userClerkId", "producer"),
      )
      .unique();
    await ctx.db.patch(member!._id, { role: "viewer" });
  });
  await assert.rejects(
    f.t.mutation(internal.rawAssets.prepare, {
      assetId: id,
      actor: "producer",
      key,
    }),
    /membership/,
  );
  await assert.rejects(
    f.t.mutation(internal.rawAssets.complete, {
      assetId: id,
      actor: "producer",
      key,
      etag: "opaque-etag",
    }),
    /membership/,
  );
});

test("raw and edited video reservations share the cap and project deletion restores only its raw allowance", async () => {
  const f = await fixture();
  const oldMode = process.env.LAWN_BILLING_MODE;
  const old = process.env.LAWN_INTERNAL_STORAGE_GB;
  process.env.LAWN_INTERNAL_STORAGE_GB = "1";
  process.env.LAWN_BILLING_MODE = "internal";
  try {
    await f.member.mutation(api.rawAssets.create, {
      ...f.input,
      fileSize: 1024 ** 3 - 20,
    });
    await assert.rejects(
      f.member.mutation(api.videos.create, {
        projectId: f.projectId,
        title: "Too much",
        fileSize: 21,
      }),
      /storage limit/,
    );
    await f.member.mutation(api.videos.create, {
      projectId: f.projectId,
      title: "Real boundary",
      fileSize: 20,
    });
    await assert.rejects(
      f.member.mutation(api.rawAssets.create, {
        ...f.input,
        requestKey: "overflow",
        fileSize: 1,
      }),
      /storage limit/,
    );
    await assert.rejects(
      f.member.mutation(api.rawAssets.create, f.input),
      /original file/,
    );
  } finally {
    if (old === undefined) delete process.env.LAWN_INTERNAL_STORAGE_GB;
    else process.env.LAWN_INTERNAL_STORAGE_GB = old;
    if (oldMode === undefined) delete process.env.LAWN_BILLING_MODE;
    else process.env.LAWN_BILLING_MODE = oldMode;
  }
  const id = await f.ready({
    projectId: f.projectB,
    requestKey: "other-client",
    fileSize: 7,
  });
  await f.head.mutation(api.projects.remove, { projectId: f.projectId });
  assert.equal(
    await f.t.run((ctx) => getTeamStorageUsedBytes(ctx, f.teamId)),
    7,
  );
  assert.equal(
    (await f.member.query(api.rawAssets.get, { assetId: id })).fileSize,
    7,
  );
});

test("confirmed ETag is immutable and detaching a source preserves the file and workflow", async () => {
  const f = await fixture(),
    id = await f.ready();
  const file = await f.member.query(api.rawAssets.get, { assetId: id });
  await assert.rejects(
    f.t.mutation(internal.rawAssets.complete, {
      assetId: id,
      actor: "producer",
      key: file.storageKey!,
      etag: "changed-etag",
    }),
    /original has changed/,
  );
  assert.equal(
    (await f.member.query(api.rawAssets.get, { assetId: id })).storageETag,
    "opaque-etag",
  );
  await f.member.mutation(api.rawAssets.useInAssignment, {
    itemId: f.itemId,
    assetId: id,
  });
  await assert.rejects(
    f.colleague.mutation(api.rawAssets.detachFromAssignment, {
      itemId: f.itemId,
      assetId: id,
    }),
    /assigned content team/,
  );
  await assert.rejects(
    f.cmo.mutation(api.rawAssets.detachFromAssignment, {
      itemId: f.itemId,
      assetId: id,
    }),
    /member role/,
  );
  await f.director.mutation(api.rawAssets.detachFromAssignment, {
    itemId: f.itemId,
    assetId: id,
  });
  await f.director.mutation(api.rawAssets.detachFromAssignment, {
    itemId: f.itemId,
    assetId: id,
  });
  assert.deepEqual(
    (await f.t.run((ctx) => ctx.db.get(f.itemId)))?.sourceAssetIds,
    [],
  );
  assert.equal(
    (await f.member.query(api.rawAssets.get, { assetId: id })).status,
    "ready",
  );
  assert.equal(
    (await f.member.query(api.contentItems.list, { teamId: f.teamId })).items[0]
      .stage,
    "planned",
  );
});

test("catalog revisions certify the same saved page and advance only visible changes, with member-only access", async () => {
  const f = await fixture();
  assert.equal(
    await f.director.query(api.rawAssets.revision, { teamId: f.teamId }),
    0,
  );
  const initial = await f.member.query(api.rawAssets.list, {
    teamId: f.teamId,
    search: "",
    paginationOpts: { numItems: 50, cursor: null },
  });
  assert.equal(initial.catalogRevision, 0);
  assert.equal(initial.page.length, 0);
  const pending = await f.member.mutation(api.rawAssets.create, f.input);
  assert.equal(
    await f.director.query(api.rawAssets.revision, { teamId: f.teamId }),
    0,
  );
  const id = await f.ready();
  assert.equal(id, pending);
  const readyPage = await f.director.query(api.rawAssets.list, {
    teamId: f.teamId,
    search: "",
    paginationOpts: { numItems: 50, cursor: null },
  });
  assert.equal(readyPage.catalogRevision, 1);
  assert.deepEqual(
    readyPage.page.map((row) => row._id),
    [id],
  );
  await f.ready(); // Exact confirmation replay is not a new visible change.
  assert.equal(
    await f.director.query(api.rawAssets.revision, { teamId: f.teamId }),
    1,
  );
  const other = await f.ready({ requestKey: "next-file" });
  assert.equal(
    await f.director.query(api.rawAssets.revision, { teamId: f.teamId }),
    2,
  );
  await f.member.mutation(api.rawAssets.remove, { assetId: id });
  await f.member.mutation(api.rawAssets.remove, { assetId: id });
  assert.equal(
    await f.director.query(api.rawAssets.revision, { teamId: f.teamId }),
    3,
  );
  const final = await f.director.query(api.rawAssets.list, {
    teamId: f.teamId,
    search: "",
    paginationOpts: { numItems: 50, cursor: null },
  });
  assert.equal(final.catalogRevision, 3);
  assert.deepEqual(
    final.page.map((row) => row._id),
    [other],
  );
  await assert.rejects(
    f.cmo.query(api.rawAssets.revision, { teamId: f.teamId }),
    /member role/,
  );
  await assert.rejects(
    f.t.query(api.rawAssets.revision, { teamId: f.teamId }),
    /authenticated/,
  );
  await f.drain();
});

test("pending discards do not invent changes and project removal invalidates a previously certified catalog", async () => {
  const f = await fixture();
  const pending = await f.member.mutation(api.rawAssets.create, f.input);
  await f.member.mutation(api.rawAssets.remove, { assetId: pending });
  assert.equal(
    await f.director.query(api.rawAssets.revision, { teamId: f.teamId }),
    0,
  );
  await f.ready({ requestKey: "ready-after-discard" });
  const old = await f.director.query(api.rawAssets.revision, {
    teamId: f.teamId,
  });
  await f.head.mutation(api.projects.remove, { projectId: f.projectId });
  assert(
    (await f.director.query(api.rawAssets.revision, { teamId: f.teamId })) >
      old,
  );
  const result = await f.director.query(api.rawAssets.list, {
    teamId: f.teamId,
    search: "",
    paginationOpts: { numItems: 50, cursor: null },
  });
  assert.equal(result.page.length, 0);
  assert.equal(
    result.catalogRevision,
    await f.director.query(api.rawAssets.revision, { teamId: f.teamId }),
  );
  await f.drain();
});

test("unfiltered client pages keep newer photos and audio ahead of older video, including beyond the first page", async () => {
  const f = await fixture();
  for (let index = 0; index < 51; index++)
    await f.ready({
      requestKey: `old-video-${index}`,
      filename: `Old video ${index}.mp4`,
    });
  const photo = await f.ready({
    requestKey: "new-photo",
    filename: "New source.png",
    contentType: "image/png",
  });
  const audio = await f.ready({
    requestKey: "new-audio",
    filename: "New source.wav",
    contentType: "audio/wav",
  });
  const first = await f.director.query(api.rawAssets.list, {
    teamId: f.teamId,
    projectId: f.projectId,
    search: "",
    paginationOpts: { numItems: 50, cursor: null },
  });
  assert.deepEqual(
    first.page.slice(0, 2).map((row) => row._id),
    [audio, photo],
  );
  assert.equal(first.page.length, 50);
  assert.equal(first.isDone, false);
  const next = await f.director.query(api.rawAssets.list, {
    teamId: f.teamId,
    projectId: f.projectId,
    search: "",
    paginationOpts: { numItems: 50, cursor: first.continueCursor },
  });
  assert.equal(next.page.length, 3);
  assert.equal(
    new Set([...first.page, ...next.page].map((row) => row._id)).size,
    53,
  );
  const videos = await f.director.query(api.rawAssets.list, {
    teamId: f.teamId,
    projectId: f.projectId,
    kind: "video",
    search: "",
    paginationOpts: { numItems: 50, cursor: null },
  });
  assert(videos.page.every((row) => row.kind === "video"));
});
