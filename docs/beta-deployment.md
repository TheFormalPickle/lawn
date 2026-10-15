# Isolated office beta

The current web stack is prepared for an isolated Docker beta on the mini PC.
It uses the normal compiled application, not localhost5297 or its ignored sample.
The web container's loopback port is5298. The existing nginx/Atrium/PostgreSQL,
production domain and NAS are separate; do not replace their configuration.

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

Do not execute public routing until the actual backend, restricted sign-in,
original storage and intended network route pass. The build does not configure
the backend, authentication or storage. The selected arrangement is dedicated
self-hosted Convex plus Keycloak, NAS-backed S3-compatible originals, and explicit
`LAWN_MEDIA_MODE=original` playback. The backend needs `AUTH_PROVIDER=oidc`, the
exact public realm issuer and `OIDC_AUDIENCE=atrium-api`; configure these before
publishing functions. Do not disable JWT issuer/audience/signature/expiry checks.
Closed admin-provisioned users and email editing restrictions belong in the real
Keycloak realm, not in a hidden frontend signup button. See team-launch.md and
nas-storage.md. The earlier prepared dependency-only image is not a deployed beta.

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
