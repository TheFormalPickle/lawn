# V1 production target: Friday, October 23, 2026

Jacob set this deadline on Thursday, October 15. This is the target date, not a
claim that production acceptance or hosting setup is already complete.

## Scope for the first release

Lawn is the clean foundation for a future Atrium. V1 stays focused on the agency's
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
   current app still needs Convex, Clerk, S3-compatible storage and Mux; hosting its
   web process locally does not replace them. A NAS share is not an S3 endpoint.
   Read-only SSH now verifies Debian12 and available local capacity. Existing
   services must be preserved; the observed unsynchronized clock needs correction
   and verification during supervised host preparation.
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

No DNS, NAS, existing Atrium services, paid services or production configuration
have been changed by this plan. A deadline does not turn local fixture evidence
into production readiness. Continue fixing verified v1 defects while deployment
details are established.
