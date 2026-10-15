import test from "node:test";
import assert from "node:assert/strict";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { deploymentBillingPolicy } from "../convex/deploymentBilling";
import { api } from "../convex/_generated/api";
import stripeSchema from "../node_modules/@convex-dev/stripe/src/component/schema";

const modules = {
  "../convex/_generated/server.js": () => import("../convex/_generated/server"),
  "../convex/billing.ts": () => import("../convex/billing"),
  "../convex/teams.ts": () => import("../convex/teams"),
  "../convex/projects.ts": () => import("../convex/projects"),
  "../convex/videos.ts": () => import("../convex/videos"),
  "../convex/contentItems.ts": () => import("../convex/contentItems"),
};

test("internal policy is explicit, capped and fail-closed; subscription remains the default", () => {
  assert.equal(deploymentBillingPolicy({}).mode, "subscription");
  assert.equal(
    deploymentBillingPolicy({ LAWN_BILLING_MODE: "internal" })
      .storageLimitBytes,
    100 * 1024 ** 3,
  );
  assert.equal(
    deploymentBillingPolicy({
      LAWN_BILLING_MODE: "internal",
      LAWN_INTERNAL_STORAGE_GB: "250",
    }).storageLimitBytes,
    250 * 1024 ** 3,
  );
  for (const value of [
    "0",
    "-1",
    "1.5",
    "Infinity",
    "NaN",
    "99999999999999999999",
  ])
    assert.throws(
      () =>
        deploymentBillingPolicy({
          LAWN_BILLING_MODE: "internal",
          LAWN_INTERNAL_STORAGE_GB: value,
        }),
      /positive whole/,
    );
  assert.throws(
    () => deploymentBillingPolicy({ LAWN_BILLING_MODE: "interal" }),
    /internal or subscription/,
  );
});

test("fresh internal team needs no fake subscription, retains roles/cap and cannot start checkout", async () => {
  const originalMode = process.env.LAWN_BILLING_MODE;
  const originalCap = process.env.LAWN_INTERNAL_STORAGE_GB;
  const t = convexTest(schema, modules);
  t.registerComponent("stripe", stripeSchema, {
    "./_generated/server.js": () =>
      import("../node_modules/@convex-dev/stripe/src/component/_generated/server"),
    "./public.ts": () =>
      import("../node_modules/@convex-dev/stripe/src/component/public"),
  });
  try {
    process.env.LAWN_BILLING_MODE = "subscription";
    const head = t.withIdentity({ subject: "head" });
    const { teamId } = await head.mutation(api.teams.create, {
      name: "Synthetic agency",
    });
    await assert.rejects(
      head.mutation(api.projects.create, { teamId, name: "Client" }),
      /active Basic or Pro/,
    );
    process.env.LAWN_BILLING_MODE = "internal";
    process.env.LAWN_INTERNAL_STORAGE_GB = "1";
    const billing = await head.query(api.billing.getTeamBilling, { teamId });
    assert.equal(billing.canUseWorkspace, true);
    assert.equal(billing.hasActiveSubscription, false);
    assert.equal(billing.stripeCustomerId, null);
    assert.equal(billing.monthlyPriceUsd, 0);
    assert.equal(billing.storageLimitBytes, 1024 ** 3);
    const projectId = await head.mutation(api.projects.create, {
      teamId,
      name: "Client",
    });
    const videoId = await head.mutation(api.videos.create, {
      projectId,
      title: "Edit",
      fileSize: 1024 ** 3 - 10,
    });
    await assert.rejects(
      head.mutation(api.videos.create, {
        projectId,
        title: "Too much",
        fileSize: 11,
      }),
      /storage limit/,
    );
    await t.run((ctx) =>
      ctx.db.insert("teamMembers", {
        teamId,
        userClerkId: "cmo",
        userEmail: "cmo@example.invalid",
        userName: "CMO",
        role: "viewer",
      }),
    );
    await assert.rejects(
      t
        .withIdentity({ subject: "cmo" })
        .mutation(api.projects.create, { teamId, name: "Denied" }),
      /member/,
    );
    await assert.rejects(
      t.query(api.billing.getTeamBilling, { teamId }),
      /authenticated/,
    );
    await assert.rejects(
      head.action(api.billing.createSubscriptionCheckout, {
        teamId,
        plan: "basic",
        successUrl: "https://example.invalid/success",
        cancelUrl: "https://example.invalid/cancel",
      }),
      /disabled/,
    );
    await assert.rejects(
      head.action(api.billing.createCustomerPortalSession, {
        teamId,
        returnUrl: "https://example.invalid",
      }),
      /disabled/,
    );
    const itemId = await head.mutation(api.contentItems.create, {
      projectId,
      title: "Assigned",
      brief: "Synthetic",
      expectedActorId: "head",
      requestKey: "unique",
    });
    await head.mutation(api.teams.deleteTeam, { teamId });
    assert.equal(await t.run((ctx) => ctx.db.get(itemId)), null);
    assert.equal(await t.run((ctx) => ctx.db.get(videoId)), null);
  } finally {
    if (originalMode === undefined) delete process.env.LAWN_BILLING_MODE;
    else process.env.LAWN_BILLING_MODE = originalMode;
    if (originalCap === undefined) delete process.env.LAWN_INTERNAL_STORAGE_GB;
    else process.env.LAWN_INTERNAL_STORAGE_GB = originalCap;
  }
});
