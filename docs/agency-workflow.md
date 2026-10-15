# Agency content workflow

Lawn remains a standalone application. The immediate goal is one route from a brief
and assignment through production, review and CMO retrieval. Atrium integration is
future work.

## Working model

- Keep existing Lawn teams and projects. Use a project for a client or campaign;
  the tracker shows the project context alongside every assignment.
- The head of CMOs uses owner/admin access to create assignments and select a
  producer, director/reviewer, CMO, deadline and brief. Business assignments refer
  to existing team members; they do not create accounts or grant privileges.
- Assigned producers/directors can start work, upload an edit, or attach an existing
  project video. A new upload uses Lawn's existing upload and processing pipeline.
- The existing video review status is authoritative: Review, Rework and Done map
  to In review, Changes requested and Ready to use. Assigned directors and admins
  review tracked work. Existing untracked videos retain member review permissions.
- CMOs can have viewer access. Ready to use includes current, playable, approved
  edits and existing approved untracked videos. Earlier tracked versions stay out.
  Download requests recheck approval/current-version eligibility on the server.

The tracker has project/status/search/My work filters. Assignment edits use a
version check to prevent stale overwrite. Create retries retain a request identity
and original actor; a lost reply must not silently create another assignment.

## Monday reference

The intended replacement is the **Assignments** board:
https://warrens-team6.monday.com/boards/18416704806

On October 15 the connected Monday reader rejected access because reauthentication
was required. Its actual statuses, custom columns, links, app data and item history
have not been inspected or imported. The five initial stages above reflect Lawn's
existing review model and the described agency workflow; they are not a claim of
exact Monday parity. Match the board after access is restored. Keep Monday records
unchanged during evaluation.

## Local preview and evidence boundaries

Development is isolated from Atrium and production. The interactive sample at
`http://127.0.0.1:5297/` uses the actual tracker, review controls, player and comments
against an owned local Convex backend. Its role chooser supplies synthetic identities;
it is not Clerk sign-in verification. Sample storage/Mux services are loopback
fixtures, not live provider validation or production configuration.

The normal application dev server is `http://127.0.0.1:5296/` and requires real
Clerk/Convex configuration. See setup.md for environment requirements. Temporary
preview files are excluded from Git; they contain only local fixture configuration.
They must never be deployed or copied into production.

## Verification and remaining acceptance

The regression suite passes 15 tests across three files. It exercises Convex
handlers against an in-memory test backend: roles, cross-team/project linking,
create replay identity, current-version approval, stale edits, deletion cleanup,
existing-video compatibility and same-ID original-file replacement.

A separate fresh local-backend/browser check passed the actual assignment → start
work → failed upload/retry → playback → saved comment → requested revision → new
version → director approval → CMO download path. The downloaded original matched
all 1,396,087 uploaded bytes. Replacing the original under the same video ID also
clears approval: processing completion alone cannot put it back in Ready to use;
a director must review it again. The replacement download then matched the new
bytes. Desktop and 390px views were inspected without horizontal overflow.

This uses actual saved local Convex records, real browser uploads, the existing
player and signed synthetic ready webhooks. Authentication supplies synthetic
local identities; object storage and Mux endpoints are owned loopback fixtures.
It does not verify real Clerk accounts, live provider processing, deployment,
large imported boards or production billing/subscription setup. Upstream quota
and subscription gates remain in place; local fixtures supply inert subscriptions.
Type checking, lint and a configured production build are checked separately.

Before team adoption: restore Monday read access and reconcile the real fields;
configure and verify Clerk sign-in, Convex, object storage and Mux for the intended
environment; rehearse roles with real test accounts; verify original-file upload,
playback, comments and downloads. No production deployment or customer migration
is authorized by local acceptance.
