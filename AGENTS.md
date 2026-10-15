## Agent info

Generally speaking, you should browse the codebase to figure out what is going on.

We have a few "philosophies" I want to make sure we honor throughout development:

### 1. Performance above all else

When in doubt, do the thing that makes the app feel the fastest to use.

This includes things like

- Optimistic updates
- Using the custom data loader patterns and custom link components with prewarm on hover
- Avoiding waterfalls in anything from js to file fetching

### 2. Good defaults

Users should expect things to behave well by default. Less config is best.

### 3. Convenience

We should not compromise on simplicity and good ux. We want to be pleasant to use with as little friction as possible. This means things like:

- All links are "share" links by default
- Getting from homepage to latest video should always be fewer than 4 clicks
- Minimize blocking states to let users get into app asap

### 4. Security

We want to make things convenient, but we don't want to be insecure. Be thoughtful about how things are implemented. Check team status and user status before committing changes. Be VERY thoughtful about endpoints exposed "publicly". Use auth and auth checks where they make sense to.

## Agency content workflow

This fork combines assignments, review and the finished-content library for the
agency. Keep changes small and retain fast route loaders. Jacob requested Atrium’s visual
language: navy surfaces, amber action color, Geist sans-serif and restrained borders.
The Head CMO uses an owner/admin account to assign client workloads by count,
deadline and content-team pair. Directors plan the generated slots; assigned members
produce the work. The assigned director or an admin
reviews tracked edits. CMOs can use viewer access to retrieve approved content.
Business assignments do not grant team membership or administrative access.

- `contentItems` tracks briefs and production before uploads exist. Its current
  video supplies review/rework/done status; do not maintain a second approval flag.
- Only the current playable approved version belongs in Ready to use. Uploading,
  failed, processing, rework and replaced versions are not approved deliverables.
- Preserve existing untracked videos, share links, comments and download behavior.
  Enforce new workflow permissions on the server as well as in the interface.
- Use a feature branch against this fork (`TheFormalPickle/lawn`), not upstream.
  Keep the upstream MIT license and attribution. No production deployments, real
  customer imports, billing changes or invitations without specific authorization.
- Verify `bun run test`, `bun run typecheck`, `bun run lint` and `bun run build`.
  Builds require Convex and the selected documented Clerk or Keycloak configuration. Use owned synthetic local
  data and distinguish test doubles, local backend, actual media and live providers.
- Current scope and acceptance live in `docs/agency-workflow.md`. Monday's Assignments
  board is the intended reference; don't invent its fields when access is unavailable.

Visual direction: Jacob's October 15 request to match Atrium supersedes the upstream
cream/monospace/brutalist guidance in docs/philosophy.md. Functionality, speed,
minimal steps and reliability take priority over decoration.

## Approved internal deployment mode

Jacob approved private agency mode on October 15, 2026. The server-only
`LAWN_BILLING_MODE=internal` enables workspace use without SaaS checkout and retains
roles and review gates. October15 follow-up explicitly removes the artificial
100GiB application cap: internal mode defaults to no cap, and the office beta uses
`LAWN_INTERNAL_STORAGE_GB=unlimited`. Positive explicit caps remain supported for
other installations; subscription plan limits are unchanged.
Subscription remains the default. This approval changes local product/configuration
behavior; it does not authorize spending, new subscriptions, arbitrary invitations,
production deployment or modification of Atrium. Do not present internal mode as a
network/privacy boundary or a physical bucket quota. See docs/team-launch.md.

## Workload intake and roles

The Head CMO assigns a client, deliverable count, deadline and director/producer
pair. Generate individual delivery slots atomically; do not make the Head CMO plan
each ad. Directors plan the slots, producers mostly edit, and both film. Content
teams are pairs within the agency workspace, not separate isolated Lawn teams.
Keep roster setup separate from daily workload entry. Existing assignments retain
copied owners when a pair roster changes; do not silently rewrite work. CMOs browse
approved deliverables; the content team uses the distinct member-only raw-asset library.
Raw source references never confer approval. Use existing S3 signing and shared
recorded-file quota; preserve actor-bound upload receipts and removed tombstones.
Validate provider ETag/size/type at preview/download without treating metadata
as proof of current byte availability. Run typecheck:convex for backend changes.

## Clean foundation and intended hosting

Jacob’s October15 direction: Lawn is the base for a clean future Atrium rebuild,
not a recipient for the old Atrium tree. Current scope stays content assignments,
review, raw sources and approved deliverables. Reuse visual style, not old agents,
analytics, background services or customer data. Add future capabilities only when
separately requested and justified. Intended hosting is an office mini PC on the
NAS switch, using atriumsuite.com. This is direction, not deployment authority.
Do not change that domain or current Atrium services during application development.
October15 follow-up authorizes NAS/mini-PC readiness investigation and organization
preparation: identify TrueNAS and its healthy pool first, preserve existing files,
and use a dedicated owned namespace for any eventual test writes. No broad moves,
deletes, pool upgrades or repair guesses. All media originals must reside on NAS;
never silently fall back to mini-PC disk. See docs/nas-storage.md.
The ignored synthetic preview is never a production/shared-team deployment.

V1 production target is Friday, October 23, 2026. Prioritize the content workflow,
real deployment rehearsal and recovery over new subsystems. Scope, dated preparation
targets and launch evidence gates are in docs/v1-launch.md. Preserve the current
Atrium and NAS while preparing the new installation.

October15 follow-up: Jacob explicitly requested rebranding this build as Atrium
and a closer match to Atrium's actual interface before going online. Prior visual
checks are historical milestones, not his design acceptance. Keep source identity,
roles, pending requests and saved theme preferences during the rebrand. The domain
is open in Safari for later setup; no DNS or production action was requested.

Expected interactions are acceptance criteria: dropping an edit onto its assignment
must route to that exact client/item and advance through the existing upload/review
state without a Start work prerequisite. Raw-library drops retain client scope and
reuse the same receipt queue as the picker. Optional buttons remain accessible.
Local drop targets must prevent duplicate global routing and clear drag feedback.
Preserve review permissions, replacement approval invalidation and source/draft
context while reducing steps. Check the real path, not just styling or callbacks.

October15 13:51 Chicago update: Jacob explicitly authorized an online usable beta
by15:00 today, with team testing over the weekend and production v1 still targeted
October23. Prepare/deploy only an isolated reviewed beta; preserve existing Atrium,
NAS/customer records and unrelated services. This supersedes the earlier planning-
only/no-deploy restriction for that beta. It does not authorize paid commitments,
public fixture/admin identities, weakened auth, arbitrary invitations or local-disk
fallback for required NAS originals. Real service/account setup and safe access are
prerequisites; report unmet gates plainly rather than exposing the synthetic sample.
Jacob also explicitly encouraged subagents to meet the beta timeframe.

## Current self-hosted beta

October15 beta candidate69a1c22 is deployed at beta.atriumsuite.com. Existing
Atrium services remain separate. Private Keycloak sign-in uses PKCE S256 and the
official basic default scope for immutable sub. Backend resource-token validation
requires exact issuer, HTTPS JWKS, RS256 and API audience; never remove checks to
resolve an integration failure. Sign-in alone is not backend readiness: preserve
the workspace-auth gate and explicit Reconnect instead of false empty onboarding.

LAWN_MEDIA_MODE=original uses private NAS-backed browser-supported originals,
without Mux or external share controls. Preserve ETag/size/type checks and fresh
approval after replacement. Browser PUTs are signed before the body exists; do not
reintroduce the SDK's optional empty-body CRC32. Explicit/required checksums and
response checks remain enabled. All originals stay on the verified dedicated NAS
namespace; no local fallback. App/auth metadata backups are separate from originals
and do not establish full/offsite media recovery. Team identity provisioning is
admin-assisted, then exact-email app membership; no SMTP or automatic signup claim.
See docs/beta-deployment.md and docs/v1-launch.md for current evidence and limits.

Account invitations and sign-in identities are separate. Never enable unverified
public signup or return passwords through Convex to bridge that gap. The restricted
Node22/POSIX administrative tool and current manual process are documented in
docs/account-onboarding.md. Preserve original private receipts, refuse ambiguous
creation replay or deleted identity recreation, and never reset existing credentials
to resend a workspace link. Explicit account switching must show sign-in again and
retain the exact invitation; ordinary SSO login can reuse the wrong account.
