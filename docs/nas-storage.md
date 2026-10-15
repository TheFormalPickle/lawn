# NAS-backed media for Atrium v1

Jacob's October15 requirement is that raw sources and deliverable originals live
on the agency's TrueNAS and are managed by this application. NAS organization and
host readiness are part of preparing the release. Existing media must retain its
identity and references; inventory and map it before moving or importing anything.
The mini PC hosts the application, not an unnoticed alternative media repository.

## Storage authority and organization

Prepare a dedicated Atrium-managed dataset/bucket on a healthy verified pool.
Keep existing agency folders intact during inventory. The application already
records workspace, client/shared scope, uploader, filename, size, original attempt
and assignment links; those are the library's authoritative organization. Stable
object keys (`raw/<asset-id>/<attempt>` and existing edit keys) prevent filename
collisions and must not change simply because a client or deliverable is renamed.
The original filename remains visible and is used for download.

Keep these responsibilities distinct in the proposed NAS layout:

- **Existing agency material:** inventory in place, then map client/source identity
  and reconcile duplicates before an explicit ingest or relocation.
- **Managed originals:** a dedicated dataset/bucket owned by the app's restricted
  service identity. Raw and finished content are organized by application metadata;
  direct out-of-band renames/removals can invalidate tracked objects.
- **Import staging:** a separately bounded area for reviewed imports, with original
  paths and import receipts retained. No automatic recursive sweep of customer data.
- **Recovery:** dataset snapshots plus separately recoverable application metadata,
  configuration and object-to-client mappings. A snapshot alone is not a verified
  backup/restore, and another directory on the same pool is not an independent backup.

Do not build duplicate client/filename trees that quietly copy large originals.
If the team needs a human-readable SMB export, design it from the same metadata
and measure the additional storage before enabling it. CMOs should retrieve the
approved original through Atrium without managing NAS directories themselves.

## Connection to the current application

The current storage implementation is S3-compatible, despite its legacy
`RAILWAY_*` environment names. A dedicated S3 service backed by TrueNAS can preserve
one storage authority and the existing signing/upload code. An SMB path by itself
is not the expected API. First verify the installed TrueNAS version and available
services; do not upgrade it or install a random storage product to fit a tutorial.
See [TrueNAS S3 documentation](https://www.truenas.com/docs/scale/shares/s3/configurings3/)
and [app storage guidance](https://apps.truenas.com/getting-started/app-storage/);
version availability must be checked against the actual machine.

The service must use the intended NAS dataset, retain object metadata/ETag and
Range behavior, and fail closed when that storage is missing. Never let an absent
mount become a newly created empty directory on the mini PC. Reuse the existing
role checks, storage cap, exact upload receipts, private signing and approval gates.
Do not infer byte availability from a database `ready` flag.

The current review pipeline also uses Mux. Hosted playback copies are different
from authoritative originals on the NAS. Its necessity, privacy, availability and
original-file path must be reconciled before calling this an all-NAS installation.
No live media provider was configured or tested by the local fixture acceptance.

## Required rehearsal

Use a dedicated owned noncustomer namespace only after identifying the NAS,
checking pool/dataset health, free capacity, access and backup configuration.

1. Upload generated video/photo/audio through the normal authenticated application;
   verify their actual storage destination and exact retrieved bytes.
2. Exercise browser previews, Range, a reviewed edit and the CMO's approved download.
   Confirm forbidden roles and expired URLs do not widen access.
3. Interrupt a transfer, lose a confirmation and retry. Check original identity,
   quota and absence of duplicate objects/records.
4. Make only the isolated test storage unavailable. Reads/writes must fail honestly,
   with no local fallback; restore access and retry in the same selected context.
5. Restart the intended service and rehearse backup/restore including metadata and
   originals. Confirm a sample restored assignment still reaches its source and
   current approved version. Preserve any existing production services throughout.

## Current inspection boundary

The Linux mini PC is verified over ordinary SSH and already hosts Atrium-related
services. Its clock is unsynchronized; privileged access is needed for supervised
host corrections. On October15 the user clarified TrueNAS had been off following a
power event and had just been powered on. The old NAS address did not respond and
the old mount was failed. Bounded LAN/mDNS/service discovery has not yet verified a
TrueNAS identity or its current address. A discovered SMB host named THINKPAD was
not identified as TrueNAS. No NAS data, pool, share, mount or service has been changed.
A powered machine is not yet evidence that its storage is online or healthy.
