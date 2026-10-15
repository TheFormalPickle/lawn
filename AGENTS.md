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
The head of CMOs uses an owner/admin account to assign a producer, director/reviewer,
CMO and deadline. Members produce assigned work; the assigned director or an admin
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
  Builds require the documented Convex/Clerk environment. Use owned synthetic local
  data and distinguish test doubles, local backend, actual media and live providers.
- Current scope and acceptance live in `docs/agency-workflow.md`. Monday's Assignments
  board is the intended reference; don't invent its fields when access is unavailable.

Visual direction: Jacob's October 15 request to match Atrium supersedes the upstream
cream/monospace/brutalist guidance in docs/philosophy.md. Functionality, speed,
minimal steps and reliability take priority over decoration.

## Approved internal deployment mode

Jacob approved private agency mode on October 15, 2026. The server-only
`LAWN_BILLING_MODE=internal` enables workspace use without SaaS checkout and retains
roles, review gates and `LAWN_INTERNAL_STORAGE_GB` (100 GiB per team by default).
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
approved deliverables; the content team also needs a distinct raw-asset library.
