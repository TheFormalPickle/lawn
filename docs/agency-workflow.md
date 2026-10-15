# Agency content workflow

Lawn is the clean foundation for a future Atrium rebuild. The immediate scope is
one content workflow: client workloads, planning, production, review, raw sources
and approved retrieval. Keep it standalone for now. Reuse Atrium’s visual language;
do not port its old subsystems, agents, analytics or data wholesale.

## Working model

- Keep existing Lawn teams and projects. Use a project for a client or campaign;
  the tracker shows the project context alongside every assignment.
- The Head CMO selects a client/project, deliverable count, due date and content
  team. A single atomic request generates the slots; no per-ad entry is required.
  Content teams are director/producer pairs configured once within the workspace.
- Assigned directors plan each slot’s title and brief. Producers mostly edit;
  both roles can start work and upload footage/edits. The director cannot change
  assignment owners/deadlines through the planning API. Admin edits retain their
  existing authority. A roster change affects new requests; existing work keeps
  its saved assigned people until explicitly edited.
- The existing video review status is authoritative: Review, Rework and Done map
  to In review, Changes requested and Ready to use. Assigned directors/admins review
  tracked edits. Existing untracked videos retain member review permissions.
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

The regression suite passes 37 tests across six files. It exercises Convex
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
large imported boards or production billing/subscription setup. Quota and role gates remain in place. The original sample uses inert subscriptions;
a separate fresh-team acceptance uses the approved internal mode with no subscription.
Type checking, lint and a configured production build are checked separately.

Before team adoption: restore Monday read access and reconcile the real fields;
configure and verify Clerk sign-in, Convex, object storage and Mux for the intended
environment; rehearse roles with real test accounts; verify original-file upload,
playback, comments and downloads. No production deployment or customer migration
is authorized by local acceptance.

## Interrupted uploads and processing events

Processing notifications carry the exact original-file attempt, not just a video
ID. Old ready/error/created events cannot advance, fail or remap a replacement.
Legacy notifications require a matching saved asset/upload reference; an old bare
video ID alone is insufficient. Repeated created events cannot move ready media
back to processing. Invalid webhook signatures remain rejected. There is no new
provider polling or per-file background job.

After a successful byte transfer, a lost confirmation is labeled unconfirmed.
**Retry confirmation** reuses the same video and original-file identity; it does
not create another video or upload the bytes again. A failed transfer and an
uncertain acknowledgment remain distinct. Failed media stays out of review and
the finished library; the assignment explains how to upload a new version.
These pending confirmations live in the current page, not durable crash/restart
storage. Already issued signed download URLs retain their original expiry.

Actual local-backend acceptance covers old and current signed events, cancellation,
invalid signatures, exact replacement download bytes and both before/after-commit
lost confirmation boundaries through the actual uploader and progress component.
The full assignment/review/CMO journey was rerun after these changes. Local
synthetic identities/media remain distinct from real Clerk and live providers.

## Private agency mode

Jacob approved server-configured internal mode for the new agency installation.
A fresh saved team now creates its first project, assigns work and completes
upload/review/download without a fake Stripe customer or subscription. Checkout
and portal actions reject internal mode before provider calls. Existing role and
recorded-byte storage guards remain enforced. Settings show Agency/Internal and
the actual configured cap instead of Unpaid or trial offers. Team deletion also
removes the new assignment records. Default subscription behavior is retained.
See [the first-install checklist](team-launch.md); no cloud accounts, paid services
or production deployment have been created. The exact hosted Clerk sign-in and
real media integrations remain unverified.

## Client workloads and director planning

The Head CMO's client/count/due/team request creates 1–100 slots in one mutation.
An exact actor-bound receipt prevents duplicate batches after a lost reply; the
original pending request survives refresh in session storage and requires explicit
confirmation. No auto-save/replay occurs. This is per-browser-tab recovery, not
cross-device durability. Changing the original payload cannot replay its key.

The actual two-team/two-client local workflow passed: five slots generated from
two requests; one committed reply suppressed then page refreshed and confirmed
without duplicates; own-team director planning; foreign-team/producer denial;
producer upload; actual playback and saved review comment; director approval;
CMO exact original download. The finished library uses the planned deliverable
name instead of an opaque export filename. Head/producer/director/CMO all use the
same saved work. Filled brief fields have explicit accessible labels. Workload
and deliverable views use the same My work filter scope.

Raw video/photo/audio browsing is implemented as a separate member-only library. The user’s
workflow definition is authoritative; Monday’s unavailable board reader does not
block this implementation or imply an import. No Atrium services/data are linked.
Atrium's checked design-system source/screens are a read-only style reference.

## Low-friction Atrium-style interface

The tracker now uses Atrium’s navy/amber/Geist visual language with restrained
borders, one filter toolbar, workload rows and responsive navigation. No fake
metrics or new workflow state were added. Head intake remains one request, director
planning edits the existing slot, and finished content retains server-checked
approval/download gates. Geist is locally served with its OFL license. Explicit
light preference and the theme toggle remain. See [interface direction and
verification](interface-direction.md) for the concept comparison and limits.

The built local workflow passes the same five-slot/two-team journey, including
refresh after a lost workload confirmation and actual review/download persistence.
Source checks use pinned Bun 1.3.6 and Node 22. Hosted Linux and Windows
install/test/types/lint/build passed interface commit d04dbf2; the shared-library
candidate requires its own exact-head hosted result. The raw-asset library is now implemented; intended sign-in/media-provider rehearsal
remains before shared team adoption.

## Shared raw asset library

Content members have **Raw assets** beside Assignments and Ready to use. Upload
one or multiple files (up to100 per selection) without entering per-file records.
The selected client is the upload destination; All clients/Shared across clients
uploads become agency-shared sources. Search filenames and filter by client/media.
Open a file once to preview/download it or attach it to assigned work. Assignment
source links reopen that exact original; Remove reference detaches it without
removing the library asset. References do not copy media or change review approval.
Client sources cannot be attached to another client’s work; shared sources can.
CMOs/viewers land directly in Ready to use and cannot call raw-library APIs.

The existing S3-compatible bucket, credentials and signing authority are reused.
Raw files are private signed originals, not public share links or Mux jobs. Common
MP4/MOV/WebM, JPEG/PNG/WebP/AVIF/HEIC and supported audio files use original browser
preview. Unsupported browser codecs retain download/retry guidance; this is not
universal camera-RAW or transcoding support. Maximum original5GiB, nonempty only.
Raw pending/ready reservations share the existing team storage cap with edits.
Their byte counter updates in the same database transaction as creation/removal.
The cap is recorded-file accounting; it is not a physical bucket/retention audit.

Upload receipts bind the original actor, client, filename, size, type and key.
A lost create reply replays that request; a lost completion checks the same stored
object without a second PUT. Pending requests are saved on the server: after a
refresh, confirm a file already sent or select the original file to resume the
request. Interrupted transfers resend the whole file; this is not multipart or
byte-offset resume. File handles/progress remain page-local. Internal view changes
keep the upload queue mounted; leaving the page warns about pending work. Removed
receipts remain tombstones, so retries/late confirmations cannot resurrect them.
Uploader/admin removal requests object cleanup; earlier signed links retain expiry.

Successful confirmation stores the provider ETag. Preview/download rechecks current
access, readiness, size, MIME and that ETag, then rechecks current metadata before
issuing a ten-minute link. Missing/changed originals produce explicit retryable
errors and keep selected context. This is an object-version check at link issuance,
not a full-file cryptographic checksum, immutable bucket guarantee or atomic
cross-provider snapshot. Original signed PUT links expire after15minutes; previously
issued GET links retain their lease. No provider polling occurs for library cards.

Catalog reads use indexed scope/type or full-text filename search and bounded
50-row pages. Failed refreshes keep qualified last-loaded rows; access failures
hide them. Retry preserves the exact page cursor. A one-minute receipt labels the
snapshot stale without background provider/read loops. Refresh invalidates older
completed pages; pages are not one atomic cross-page snapshot. Counts are not
invented from partial lists. Preview link expiry asks for a new verified link.

Actual fresh compiled/local-backend acceptance covers generated photo/audio/video
uploads, decoded previews, browser download plus exact original/Range bytes,
committed lost replies, saved unfinished-request recovery after remount, source
references, changed same-size originals, missing-file restoration, role denial and
real object removal. A separate62-record metadata-only run covers50+11 exact-client
pages, controlled503/retry, actual one-minute expiry without background reads,
late-page rejection across client filters, search and genuine empty. It does not
claim those metadata fixtures have playable files. Desktop/390px captures inspected.
Synthetic auth and loopback S3/Mux remain distinct from actual Clerk/live providers.

CMO approved-original downloads now check availability/known size/type and recheck
current approval/version before signing. A missing/truncated original cannot yield
a knowingly broken download link; recorded review approval remains intact. Recovery
uses the same client selection and Download original action. Legacy records without
known file size retain compatibility, with availability checked on demand.

Run `bun run typecheck:convex` as well as root types, tests, lint and build. It now
runs the actual strict Convex TypeScript project without deploying; Linux/Windows
CI includes this independent backend check. Earlier root-only types could pass a
candidate rejected by the local backend’s stricter target. No checks were relaxed.

## Shared-library change awareness

A producer's completed upload or removal now advances a workspace catalog revision
inside the same transaction as its visible metadata. Catalog pages include that
revision; a small member-only reactive subscription tells colleagues the library
changed without fetching every file or polling storage. Existing files, filters
and open previews stay in place; Refresh retrieves the latest view. A known change,
failed live-update read or expired snapshot cannot keep claiming the view is empty.
A page read after a newer revision cannot be appended to an older head. Exact
confirmation/removal replay does not invent another change. Notifications are
workspace-wide, not a claim that every active filter gained a match.

Client-filtered untyped pages now use an index without media kind as an ordering
prefix. New photos/audio are no longer buried behind older videos. Typed filters
retain their exact index. Actual saved-record/browser acceptance verifies a
separate producer's original upload, immediate director notification, no automatic
catalog polling, controlled503/exact-client retry, unchanged open decoded preview,
replay/removal and a completed newer-revision page rejected while preserving the
loaded50. The existing62-record/actual60-second expiry/paging recovery also passes.
This is local synthetic-auth/loopback-storage evidence, not live provider proof.
