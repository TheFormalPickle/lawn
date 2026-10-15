# First agency installation

**V1 target: Friday, October 23, 2026.** See [v1-launch.md](v1-launch.md)
for the bounded release scope, preparation sequence and remaining acceptance gates.

This is a new standalone Lawn installation. Do not reuse Atrium's database, mounts,
provider keys, processes or production configuration. The sample at localhost:5297
is a local workflow preview, not a shared team environment or real sign-in.

## Chosen configuration

Jacob approved **private agency mode** on October 15, 2026. Set these on the
selected Convex deployment, never as browser-controlled `VITE_` values:

```text
LAWN_BILLING_MODE=internal
LAWN_INTERNAL_STORAGE_GB=100
```

This enables projects/uploads without Lawn subscription checkout and retains
team authentication, roles, assignment/review gates and a per-team storage cap.
Default mode remains `subscription`; an unknown mode or invalid cap fails closed.
The cap counts recorded nonfailed video sizes plus pending/ready raw originals.
It is not a physical bucket quota, archival/retention policy or full storage audit.
Hosting, storage and Mux still incur their own infrastructure costs. Internal mode
does not restrict signup, change public share defaults, cancel old subscriptions,
or make the installation private on the network. Use it for this new installation;
do not switch a live paid customer deployment without reconciling its billing.

## Set up development before shared access

1. Install the pinned Bun version from package.json and Node 22. Clone this fork,
   check out the reviewed feature branch until it is merged, and run
   `bun install --frozen-lockfile`.
2. Create a dedicated **development** Convex project/deployment in the team's
   account using `bunx convex dev`. Verify its identity before applying schema or
   provider variables. The CLI writes local deployment/URL configuration.
3. Create a Clerk development application. Configure the existing Convex JWT
   template (`convex`) and its issuer domain to match `convex/auth.config.ts`.
   Use `.env.example` for web variables; `.env.convex.example` lists deployment
   variables. Those templates contain no credentials. Do not share secrets in chat.
4. Configure agency-controlled sign-in and access, then create the owner account.
   Add only the intended people. Head CMO: owner/admin; assigned directors and
   producers: members; retrieval-only CMOs: viewers. Assignment selectors never
   grant membership or elevated privileges. Do not invite arbitrary usernames.
5. Create a dedicated S3-compatible bucket and a Mux development environment.
   Configure the existing upload endpoint/keys and a Mux webhook at
   `https://<development-deployment>.convex.site/webhooks/mux`. Store its signing
   secret in Convex. Configure bucket CORS for the exact dev web origin, PUT/GET/HEAD,
   Content-Type and the headers required by that provider; keep write credentials
   out of the browser. Use provider-issued signed URLs through the server.
6. Set internal mode and its cap, then run `bun run dev`. Open the normal app at
   localhost:5296/dashboard and sign in with the actual Clerk test accounts. The
   synthetic identity chooser at port5297 is excluded from Git and deployment.
7. Rehearse source files too: upload generated video/photo/audio as a content member,
   preview/download, attach/detach an assigned source, retry interrupted confirmation,
   and verify a CMO cannot browse raw assets. Check S3 HEAD and ETag support, private
   GET/signing, correct Content-Type and byte Range for original previews. No new
   transcoder is used for raw sources. Then create test clients/projects, set up the two content-team pairs and assign a
   client/count/due-date workload. Let its director plan a slot; upload generated noncustomer
   footage, request a revision, upload the revised edit, approve as director and
   retrieve it as a CMO. Check actual playback and original-file byte equality;
   verify producer/CMO approval denial and failed upload recovery. Compare this to
   the local acceptance in agency-workflow.md without treating fixtures as live
   provider proof.
8. Restore Monday connector access and read Assignments18416704806 to reconcile
   real fields and statuses before any import. Preserve Monday's records during
   evaluation; no import or destructive migration has been performed.

## Quality and promotion

Run test, typecheck, typecheck:convex, lint and build. GitHub checks use frozen dependencies, Node22
and Bun1.3.6 with inert build configuration, no deployment credentials. A green
source build is not sign-in/media-provider acceptance. Local frozen install and all source checks also pass with the exact pinned Bun1.3.6
on this Mac. Hosted Linux/Windows execution is reported separately when it runs.

After development acceptance, review the PR, intended hosting project/domain,
provider costs, backups, access policy and retention. Deploy only with explicit
production authority. `docs/deployment.md` describes the existing Vercel/Convex
build integration; production deploy keys belong in the hosting secret store.
No hosting projects, subscriptions, paid services or production deployments were
created by this local pass.

References: [Convex hosting](https://docs.convex.dev/production/hosting/vercel),
[Clerk TanStack Start setup](https://clerk.com/docs/tanstack-react-start/getting-started/quickstart),
[Bun CI setup](https://bun.sh/guides/runtime/cicd).

## Office hosting direction — October15

Jacob intends the new Lawn-based Atrium to run on an office mini PC connected to
the same switch as the NAS, using atriumsuite.com. Read-only SSH inspection on
October15 verified Debian12/x86_64, a Ryzen7 5700U, about28GiB RAM and557GiB free
local disk. It already runs nginx, Docker/PostgreSQL and Atrium-related services;
prepare an isolated Lawn installation rather than replacing their configuration.
The intended backend/auth/storage/access arrangement remains to be settled. This direction does
not authorize deploying, changing DNS, moving the current Atrium, mounting the NAS
or importing customer records. Preserve the original systems during evaluation.

The current source uses Convex, Clerk, S3-compatible object storage and Mux. Hosting
the web app on the mini PC alone does not replace those dependencies or make the
system fully local/offline. A NAS share is not the S3 API the current code expects.
Choose and rehearse the intended backend/auth/storage/media arrangement before
preparing the office launch. Do not quietly bring over old Atrium infrastructure
to fill these gaps. Keep new work limited to the content tracker/library/review hub.

The local5297 sample uses synthetic admin identities and ignored fixture config;
it must never be exposed at atriumsuite.com or promoted as real sign-in. Production
needs the normal authenticated application, protected secrets/storage, TLS, tested
backup/recovery and real role/media acceptance. Those are a separate reviewed
launch step, not claims made by the local library tests.

The same inspection found the host clock roughly nine minutes behind the local
reference, `System clock synchronized: no` and no NTP service listed. No clock or
service changes were made. Correct and verify time synchronization as a supervised
host-preparation step before real authentication or signed-media acceptance; do
not compensate by weakening token/signature checks. Both rely on valid time:
[Clerk verification](https://clerk.com/docs/reference/backend/verify-token) and
[S3 signed URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html).
