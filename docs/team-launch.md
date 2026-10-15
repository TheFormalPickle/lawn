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

## Self-hosted beta configuration

Jacob chose to pursue self-hosting on October 15 rather than require new cloud
accounts. Convex can run as its official isolated Docker backend without a cloud
account. The authentication candidate uses Keycloak's standard OIDC authorization
code flow with PKCE S256 and keeps the existing backend membership/actor checks.
This is an implementation path, not proof that the online sign-in/media workflow
has passed acceptance yet.

Frontend configuration:

```text
VITE_AUTH_PROVIDER=keycloak
VITE_CONVEX_URL=https://beta.atriumsuite.com
VITE_CONVEX_SITE_URL=https://beta.atriumsuite.com
VITE_OIDC_URL=https://beta.atriumsuite.com/auth
VITE_OIDC_REALM=atrium
VITE_OIDC_CLIENT_ID=atrium-web
```

Backend authentication configuration:

```text
AUTH_PROVIDER=oidc
OIDC_ISSUER_DOMAIN=https://beta.atriumsuite.com/auth/realms/atrium
OIDC_AUDIENCE=atrium-api
LAWN_MEDIA_MODE=original
```

Original-only mode uses private, short-lived signed originals and preserves review
permissions. It needs no Mux account, but playback requires a browser-supported
codec/container; it does not transcode arbitrary camera footage. External share
controls are unavailable for these private originals. Captured ETag/size/type are
rechecked before playback and approved download; this is an issuance-time identity
check, not a full-file checksum or revocation of an already issued short lease.

The API origin has no `/api` suffix: the Convex client adds its own API paths.
The issuer and audience must match the actual signed access token. Never omit the
audience check or put an OIDC client secret/admin key in frontend variables.
Unknown provider modes fail closed. Existing installations retain Clerk behavior,
but must explicitly set backend `AUTH_PROVIDER=clerk` before publishing this
configuration: Convex rejects an unset environment variable read from an auth
configuration even when the JavaScript includes a fallback. An unset value is not
a successful upgrade or permission to bypass authentication.

Use an isolated Keycloak realm with public registration disabled, public SPA
client `atrium-web`, standard code flow and enforced S256 PKCE, explicit access-token
audience `atrium-api`, exact redirect origins and profile/email claims.
Disable implicit/password grants and duplicate emails. Administrators provision
only authorized identities; email editing stays admin-only until verified email
change/recovery is configured. Tokens remain in memory and are refreshed through
the official browser adapter; they are not saved in localStorage.

The Keycloak account and Atrium workspace membership are separate. The agency
administrator creates the exact identity in Keycloak, the person establishes
their own credential through its normal account flow, and the workspace owner
shares Atrium's email-bound membership link with the intended role. Creating an
identity grants no workspace membership. Initial credential recovery is supervised
administrator recovery until an actual SMTP reset flow is configured and tested.
Do not describe an account as invited by email when no email has been sent.

## Existing managed-provider setup

The following is the upstream alternative, preserved for existing Clerk/Mux
installations. It is not a requirement to create cloud accounts for the selected
self-hosted beta.

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

## Same-day isolated beta — October 15

Jacob requested an online beta for team evaluation by 3pm Central on October 15.
This authorizes preparing an isolated, authenticated beta; it does not turn the
synthetic port5297 preview into a deployable environment. Do not copy its admin
key, identity chooser, fixture functions or loopback media provider into the beta.
Keep existing Atrium processes and data separate. All original media must remain
NAS-backed; lack of a verified NAS endpoint is not permission to substitute the
mini PC disk or an unrelated cloud bucket.

The beta needs actual services behind these responsibilities before end-to-end
acceptance. Fixture services are not substitutes:

| Responsibility       | Required setup                                                                           | Verification before inviting the team                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Convex               | Dedicated self-hosted backend or explicitly chosen cloud deployment                      | Protected operations deny anonymous users; the real signed-in owner creates a workspace against this exact schema/functions |
| Authentication       | Dedicated closed Keycloak realm, or an explicitly chosen Clerk application               | Normal sign-in, sign-out, token refresh and stable actor identity; actual second-account role boundaries                    |
| NAS S3 API           | Dedicated agency namespace, private object access, HEAD/ETag/Range and exact-origin CORS | Generated video/photo/audio exact bytes; restart/outage recovery and no silent local-disk fallback                          |
| Deliverable playback | Explicit original-only configuration, or a dedicated Mux environment                     | Actual edit playback, revisions/current approval and exact original download through the chosen path                        |

Do not place provider credentials in chat or browser build variables. Backend
configuration is listed in `.env.convex.example`, including `MUX_SIGNING_KEY` and
`MUX_PRIVATE_KEY`, which are required by the existing signed-token paths. The
normal frontend uses public Convex/OIDC configuration in self-hosted mode, or
Clerk's publishable key in Clerk mode. Clerk's server secret remains server-side. Provider variables must be set on the
dedicated deployment before its functions are published. Check names and presence
without printing their values. A successful build with inert keys proves source
compatibility, not provider readiness.

Clerk development instances can support an isolated test beta, but the provider
explicitly describes them as unsuitable for production workloads and limits them
to 100 users. Treat evaluation accounts/data accordingly; production activation
and domain configuration remain distinct. Mux documents a no-credit-card
development starting tier; do not enable a paid plan or unlimited spending to
meet the deadline. Account sign-in, any required legal acceptance and actual
provider credentials must be established by the authorized account owner.

For the managed alternative, configure Clerk's **Invite-only** access mode before
publishing the address. Merely sending invitations does not restrict open signup,
and `LAWN_BILLING_MODE=internal` does not do so either. Jacob chooses the actual
recipients; test both an invited account and an uninvited signup attempt without
inventing teammate identities or widening access.

There are two independent invitation systems. Atrium's Team members dialog
creates only a Convex email-bound membership link; it sends no email and does not
create a Clerk invitation. A new person cannot use that link alone to register
when Clerk is Invite-only. Use this explicit managed-alternative onboarding sequence:

1. The authorized Clerk application owner adds their own account through Clerk's
   dashboard invitation or manual-user flow, completes normal sign-in, and creates
   the agency workspace in Atrium.
2. For each teammate Jacob chooses, the owner creates a Clerk application
   invitation to the exact email. The teammate accepts that provider invitation
   and completes their own account credentials; agents do not set passwords.
3. In Atrium, the workspace owner/admin creates the matching email-bound Team
   members link with Content team, CMO or Admin as intended and shares that link
   with that person. The teammate opens it while signed in with that email and
   accepts the workspace membership. Clerk registration alone grants no Atrium
   workspace membership or review permission.
4. Check the actual new account in a separate browser session: its role, access
   to the intended workspace and forbidden operations. A separate uninvited
   visitor must be unable to register. Revoking either type of invitation affects
   that system only; an existing user or membership needs its own access review.

This sequence is derived from the current application code and Clerk's documented
invitation behavior. It still requires real end-to-end beta verification; the
synthetic identity tests do not prove that the two systems work together.

Final beta acceptance is the real normal route, not the preview: owner sign-in →
client/count/due/pair assignment → member edit upload → director revision/replaced
version approval → viewer download of that exact approved original. Also test raw
source upload/preview/reuse, denied approval/raw access, outage recovery and a
second browser session. Invite no arbitrary accounts; Jacob chooses teammates.

References: [Convex–Clerk setup](https://docs.convex.dev/auth/clerk),
[Clerk environment boundaries](https://clerk.com/docs/guides/development/managing-environments),
[Clerk access modes](https://clerk.com/docs/guides/secure/restricting-access),
[Mux account/API setup](https://www.mux.com/docs/core/ai-agents).

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

## Confirmed NAS requirement

The October15 follow-up requires NAS-backed media and permits NAS/mini-PC readiness
investigation and organization preparation. Follow [nas-storage.md](nas-storage.md)
for the dedicated namespace, existing-file mapping and outage/restore acceptance.
Do not substitute the mini PC's free SSD capacity for this requirement. The user
clarified the NAS had been powered off and is now booting; identify its actual
online service before attributing an outage to application code or changing mounts.
