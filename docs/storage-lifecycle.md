# Original-file removal tracking

This candidate preserves cleanup provenance; it does **not** automatically delete
edited originals, reclaim NAS space or certify that a file is gone. The online
`69a1c22` beta is unchanged until a separately verified deployment.

## Why preserve a receipt

The existing video, project and workspace removal paths delete an edit's metadata
without deleting its S3 original. Replacing an original on the same video also
overwrites the previous key. Once that last reference disappears, a future cleanup
cannot safely distinguish those bytes from unrelated or customer files. The beta
acceptance cleanup encountered this directly and removed only independently known
fixture keys; that is not a basis for a bucket-wide cleanup.

The additive `mediaDeletionReceipts` table captures the exact source reference in
the same database transaction as those metadata changes. It retains video,
project and available workspace/assignment IDs, the uploader, authenticated
requester when available, reason, recorded status and available size/type/ETag.
Legacy references remain opaque and unchanged. Distinct videos or recorded ETags
retain separate provenance even when their stored keys collide. Repeating an
identical capture cannot replace the first receipt's evidence.

An edit without a stored key creates no receipt. A same-key upload retry is not
classified as a retired original. Deleting a parent preserves its receipts;
there is no public receipt endpoint, cleanup action, scheduled deletion or sweep.
Existing access checks still authorize every public metadata-removal operation.

Every receipt stays `pending_review`, with storage binding and outstanding upload
lease explicitly `unknown`. A recorded ETag is historical metadata, not proof of
the current object or permission to delete it. This does not backfill references
already lost by older code and does not introduce a complete retention policy.

## Before enabling actual byte cleanup

Future work must establish the exact account/bucket/endpoint binding and recorded
object version, reject live/shared references, and verify conditional-delete
behavior on the **actual pinned storage provider**. AWS SDK fields alone do not
prove SeaweedFS honors them. Signed PUT expiration also does not prove an upload
that began earlier has finished. Changed, missing, uncertain or still-writable
objects must not become successful deletion claims.

The executor also needs durable retry/confirmation, bounded work, permission and
restore tests, and a defined retention decision. Do not normalize a legacy URL
into a guessed bucket key, enumerate unknown objects to reconstruct ownership, or
silently approve every pending receipt. No such executor is included here.

Raw-asset deletion remains a separate existing path: it uses a key-only scheduled
delete. Its late-upload, retry and cascade-receipt behavior still needs review;
the edited-original tracking candidate does not claim to repair it. Managed Mux
derivative deletion is also outside this increment.

## Verification and rollout boundary

Six focused cases and the full 66-test suite pass, along with root/strict backend
types, lint and the normal build. An actual isolated SQLite backend verifies
video/project/workspace removal and original replacement: six new exact receipts
survive their source parents, while three known setup-probe receipts remain
unchanged. A fresh backend process using the same database retains all nine
receipts byte-for-byte; official before/after snapshot exports also match. All
six owned loopback originals retain their exact bytes and there are zero DELETE
requests, as expected with no cleanup executor.

This uses synthetic administrator impersonation and a local storage fixture,
not public OIDC, TrueNAS, provider conditional deletion or the live beta. Early
probe failures involved CLI empty-table formatting and a configured/default
bucket mismatch; those are retained as harness/setup evidence, not passing
checks or diagnosed production defects. Later fixture configuration explicitly
matches the observed bucket. The bucket initialization/cache behavior remains
an unresolved setup lead if deployment configuration is changed.

Keep the online beta unchanged until that evidence is reviewed and deployment
access is available. Preserve any deployed receipts during rollback; do not drop
the table or sweep stored files to make an older schema fit.
