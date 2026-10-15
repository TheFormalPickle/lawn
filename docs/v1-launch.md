# V1 production target: Friday, October 23, 2026

Jacob set this deadline on Thursday, October 15. This is the target date, not a
claim that production acceptance is complete. An isolated usable beta is now
online at https://beta.atriumsuite.com; production remains a separate decision.

## Scope for the first release

The Lawn-based build is now branded Atrium. V1 stays focused on the agency's
content work. Keep the Atrium visual language; do not port its analytics, agents,
integrations, services or historical data to meet this deadline.

- Head CMO assigns client, quantity, due date and content-team pair once.
- Directors plan generated slots; directors and producers use shared raw sources.
- Producers/directors upload edits, receive review and revisions, and retain the
  current approved version as the authority for finished content.
- CMOs find and download approved originals; content members also upload, find,
  preview and reuse raw video, photos and audio.
- Interrupted transfers, missing originals and uncertain confirmations have clear
  recovery without duplicates, lost source identity or bypassed review permissions.

No Monday import is needed to launch the new workflow. Preserve the old board;
reconcile its fields when connector access is restored. Google/Meta/Shopify metrics,
AI workflows, a general Atrium migration and new asset transcoding are outside v1.

## Working sequence

These are preparation targets, not claims of completed work. Pull any prerequisite
forward when access is available; do not leave infrastructure testing until launch.

| Date                  | Intended result                                                       | Acceptance                                                                                                                                                            |
| --------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Thu Oct 15–Fri Oct 16 | Finish the shared-library candidate and settle deployment arrangement | Current source checks and saved-record workflow pass; office PC OS/capacity/access and backend/auth/storage/media owners identified.                                  |
| Mon Oct 19            | Rehearse the normal authenticated app on the intended arrangement     | Actual owner, director, producer and CMO sign in; generated source upload, review playback and approved original download succeed through the intended network route. |
| Tue Oct 20            | Team workflow rehearsal and v1 feature freeze                         | Two pairs receive client workloads; a revision/replacement cannot leak into approved content; raw reuse and failed-upload recovery work without duplicate records.    |
| Wed Oct 21            | Recovery and candidate verification                                   | Backup/restore is exercised; unavailable storage fails honestly; restart and access revocation are checked; reviewed candidate and rollback procedure are recorded.   |
| Thu Oct 22            | Go/no-go review                                                       | Close release-blocking defects, run final candidate checks and obtain launch authority for the exact host/domain/change. Defer optional enhancements.                 |
| Fri Oct 23            | Production cutover and smoke test                                     | Only after approval: deploy the reviewed candidate, verify real sign-in/upload/review/download, and retain the working rollback.                                      |

## Current release gates

The local sample at localhost:5297 uses synthetic identities and loopback media.
It is useful product evidence and must never be exposed as the team installation.
See [team-launch.md](team-launch.md) for the existing provider setup and limitations.

Before production, record evidence for:

1. **Deployment arrangement.** Office mini PC OS, resources, secure administrative
   access, service supervision, TLS and the intended use of atriumsuite.com. The
   beta now runs dedicated self-hosted Convex and closed Keycloak sign-in,
   NAS-backed S3-compatible originals and explicit original-only browser playback.
   No Clerk, Convex cloud or Mux account is required for that selected mode. All media originals must live on
   TrueNAS; a NAS share is not an S3 endpoint. Inventory existing storage before
   organizing a dedicated managed area; see [nas-storage.md](nas-storage.md).
   SSH verifies Debian12 and available local capacity; existing services are
   preserved. The clock was corrected and token checks pass, but persistent NTP
   installation remains open. Package preparation requiring nine unrelated
   upgrades was stopped rather than changing the host broadly.
2. **Real accounts and roles.** Agency-controlled sign-in, intended membership,
   director approval and CMO raw-library denial. No arbitrary invitations.
3. **Real media.** Upload generated video/photo/audio, decode the intended formats,
   review an edit and retrieve byte-identical originals through the chosen storage
   and media services. Record unsupported browser codecs clearly.
4. **Persistence and recovery.** A tested data/object backup and restore, restart
   behavior, unavailable storage recovery, upload retry and access revocation.
   Metadata quotas and signed links are not a retention or backup policy.
5. **Release control.** Reviewed fork PR, exact candidate checks, configuration
   without fixture code/secrets, supervised launch authority and a rollback plan.

Authorized beta DNS/TLS and dedicated app/auth/storage services are now configured.
Existing Atrium services and databases are preserved. A deadline does not turn beta
acceptance into production readiness; retain the separate production gates above.

## Expected daily interactions

Edits can be dropped directly onto an assignment or its open details. The existing
upload/processing/review state advances automatically; there is no Start work
prerequisite. Raw-library drops retain the selected client scope and use the same
recoverable queue as the file picker. Source previews return to the same assignment.
Current public-beta acceptance covers normal OIDC sign-in and stable roles, bulk
assignment, actual browser drag upload, original playback, comment/rework/revised
approval, exact CMO approved downloads with old versions excluded, raw PNG/WAV
upload/decoded preview/download, raw reuse and CMO raw-read denial. Desktop and
390px views were inspected. This does not establish native OS drag behavior,
universal codec support, full NAS restore or offsite recovery.

## Accelerated beta — October15, 15:00 Chicago

Jacob requested a usable online beta by3pm today at1:51pm, so the team can test it
over the weekend before next week's production work. Freeze optional changes and
prioritize actual sign-in, workspace/client/pair assignment, file upload/review,
approved-original retrieval and recovery. This authorizes isolated beta deployment;
it does not permit publishing the synthetic local preview as real team access.
The October23 production target remains separate. Missing actual accounts, healthy
NAS-backed originals or secure network access cannot be replaced by passing fixture
tests. Preserve existing Atrium services and record the exact beta/rollback state.

## October15 beta handoff

The public `acc3cab` candidate passes the real authenticated assignment → upload →
review/revision → approved-library journey. Auth tests also reject wrong-audience,
corrupted, anonymous and naturally expired credentials, and actual retry restores
access without false empty onboarding. Independent host/container mount records verify the dedicated NAS CIFS path,
and all four transferred application objects match saved lengths/SHA256. Browser
bytes alone were not used to infer physical storage.

Team access is administrator-assisted: provision each chosen exact identity, have
the person establish their own password, then share the app membership link with
Content team, CMO or Admin permissions. App invitations do not create identity
accounts. No arbitrary teammates are invited. SMTP delivery/reset is not configured;
supervised recovery is the current boundary.

Before unattended operation and October23 production acceptance, finish persistent
time synchronization, retain the installed six-hour private app/auth metadata backup job and exercise
full application/storage restart, restore and rollback. The first backup run
and isolated current auth/application metadata restores pass. The application
restore re-export matches all 14 tables and 65 saved records exactly; it does not
establish full media recovery, live restart or an atomic cross-service restore.
Full NAS/offsite restore remains open.
Use [beta-deployment.md](beta-deployment.md) for the current arrangement and its
limitations; update the canonical checkpoint with final host proof.
