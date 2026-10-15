# Isolated office beta

The isolated beta is online at https://beta.atriumsuite.com as of October 15, 2026. The deployed application candidate is `acc3cab`, with dedicated self-hosted
Convex, Keycloak and NAS-backed S3-compatible originals. It uses the normal Linux
Docker build, not localhost5297 or its ignored sample. The web container's loopback
port is5298. Existing Atrium services and databases remain separate. This is a
weekend beta, not the October23 production acceptance.

`deploy/Dockerfile.beta` installs pinned Bun1.3.6 on Node22 and builds from a clean
source context. `.dockerignore` excludes local environments, fixture code, private
preview bundles and dependencies. Build arguments are browser-public backend URLs
and public authentication configuration. The selected self-hosted beta uses
`VITE_AUTH_PROVIDER=keycloak`, the `/auth` base URL, realm `atrium` and public client
`atrium-web`; it needs no Clerk account or publishable key. The optional Clerk mode
remains compatible when explicitly configured. Missing provider configuration or
an unknown mode fails the image build. Never pass S3/Mux/Clerk/Keycloak write secrets as
build arguments or VITE variables. The container runs as the unprivileged node
user with no capabilities and bounded logs/resources. Its static healthcheck is
only transport evidence, not proof of sign-in/backend/media health.
Vite permits only the intended additional public hostname `beta.atriumsuite.com`;
do not set `allowedHosts=true` or use a wildcard to work around routing failures.
The Convex browser URL is the origin without an extra `/api` suffix.

From the reviewed release directory, supply a private deployment environment file:

```sh
docker compose --env-file /home/rdc/atrium-beta/config/web.env \
  -f deploy/compose.beta.yml config --quiet
docker compose --env-file /home/rdc/atrium-beta/config/web.env \
  -f deploy/compose.beta.yml build web
docker compose --env-file /home/rdc/atrium-beta/config/web.env \
  -f deploy/compose.beta.yml up -d web
```

For a replacement deployment, verify the backend, restricted sign-in, originals
and intended network route before routing users to it. Building the web image
does not configure the backend, authentication or storage. The arrangement is dedicated
self-hosted Convex plus Keycloak, NAS-backed S3-compatible originals, and explicit
`LAWN_MEDIA_MODE=original` playback. The backend needs `AUTH_PROVIDER=oidc`, the
exact public realm issuer and `OIDC_AUDIENCE=atrium-api`; configure these before
publishing functions. Do not disable JWT issuer/audience/signature/expiry checks.
Closed admin-provisioned users and email editing restrictions belong in the real
Keycloak realm, not in a hidden frontend signup button. See team-launch.md and
nas-storage.md. Preserve the official Keycloak `basic` default client scope so
access tokens retain their immutable subject; the backend verifies their exact
issuer, resource audience and RS256 signature through the configured JWKS.

Use separate persistent service volumes and private owner-only secrets for the
Convex backend, Keycloak database and signing/admin keys. Their admin dashboards
are not team-facing endpoints. Existing Atrium services/databases remain separate.
An ordinary web health response does not prove real OIDC login, membership,
storage identity, processing, review, approved download or backup recovery; record
those acceptance results separately against the exact built source.

Keep the previous reviewed release/image and private environment configuration
for rollback. Reverting the web image does not undo a database/schema/storage
change. Capture a restorable metadata/original backup and verify compatibility
before changing those boundaries. No data deletion is part of a web rollback.

## Current beta evidence and boundaries

Actual public-TLS browser/OIDC acceptance verifies owner sign-in, stable identity,
email-bound member and viewer invitations, reload, logout/relogin and protected
backend reads/writes. Wrong-audience signed tokens, tampered signatures, anonymous
writes and naturally expired tokens are rejected. An isolated invalid-token browser
shows Reconnect instead of empty workspace onboarding; normal retry recovers.
Public registration is closed. During DNS propagation, bounded browser resolver
mapping retained the exact public hostname and normal certificate verification;
ordinary client DNS resolution was also verified after repairing this Mac's wired
resolver cache path. Other clients can retain the old router negative DNS cache
until its TTL expires; no office-wide DNS settings were changed.

The current public application journey passes two-slot bulk assignment, assigned
member-director review, producer drag upload and decoded original playback,
comment/rework/replacement approval, CMO byte-identical approved download with the
old version excluded, raw PNG/WAV upload and decoded preview/download, CMO raw-read
denial and saved raw reuse. Desktop and390px rendered states were inspected with
no horizontal overflow. These are actual saved records and transferred bytes;
the host and storage-container mount records prove the dedicated NAS CIFS backing,
and all four application originals independently match their saved lengths and
SHA256 through the actual storage service.
Original playback relies on browser-supported codecs; this mode does not promise
transcoding or universal browser codec support.

Account onboarding is administrator-assisted: first provision only the exact
chosen person in the closed identity service, let them establish their own password,
then share the app's exact-email workspace membership link with the intended role.
An app invitation alone does not create a sign-in account. SMTP invitation delivery
and self-service password-reset mail are not configured; initial recovery remains
supervised administration. Do not publish credentials or administrative endpoints.

The host clock was corrected and JWT validation retested. Persistent NTP is not yet
installed: the attempted package preparation would require nine unrelated upgrades
and was stopped. Verify continued clock accuracy before relying on unattended
weekend operation. A dedicated six-hour app/auth metadata backup timer is enabled. Its first actual
run passed official Convex ZIP CRC, Keycloak custom archive validation and SHA256
checks with private0600 files/0700 directories. An isolated restore of the current
auth database retains closed registration and the official subject scope. The
actual application snapshot was imported into a fresh pinned backend on a private
Docker network, then re-exported with the official CLI. All 14 tables and 65 saved
records match exactly. Its disposable container, volume and network were removed;
live services were not restarted. The four exact generated acceptance originals
were also removed after their workspace cleanup, with final object absence checked.
These are metadata protections; they do not copy originals or provide an atomic
cross-database backup. A full NAS restore and offsite recovery have not
been exercised. Do not describe metadata dumps or a healthy web response as that
acceptance; final host evidence belongs in the launch checkpoint.
