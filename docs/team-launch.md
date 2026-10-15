# First agency installation

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
The cap counts recorded nonfailed video sizes, following the existing quota model.
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
7. Create test clients/projects, set up the two content-team pairs and assign a
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

Run test, typecheck, lint and build. GitHub checks use frozen dependencies, Node22
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
