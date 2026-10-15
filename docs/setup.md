# Setup

## Development

Install dependencies:

```bash
bun install --frozen-lockfile
```

Run app + Convex locally:

```bash
bun run dev
```

Run only the web app:

```bash
bun run dev:web
```

## Build / Run

```bash
bun run build
bun run start
```

## Quality checks

```bash
bun run typecheck
bun run lint
```

## Environment variables

- `VITE_CONVEX_URL`
- `VITE_CONVEX_SITE_URL`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `MUX_TOKEN_ID`
- `MUX_TOKEN_SECRET`
- `MUX_WEBHOOK_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_BASIC_MONTHLY`
- `STRIPE_PRICE_PRO_MONTHLY`
- Convex deployment vars as needed (`CONVEX_DEPLOYMENT`, etc.)

Stripe webhook endpoint (for the Convex Stripe component):

- `https://<your-deployment>.convex.site/stripe/webhook`

## Agency tracker

Open a team, then **Content tracker**. An owner/admin creates assignments. Producers
and directors use member access; a CMO who only retrieves content can use viewer
access. See [agency workflow](agency-workflow.md) for the exact permission model.
Existing teams and videos need no destructive migration. New assignment records
and the optional video-to-assignment link are additive schema changes.

`bun run test` includes existing route-loader checks and the tracker regression
suite. It uses a mock Convex backend for fast role/data assertions. Run the actual
local backend and media/browser rehearsal separately; passing those tests alone
is not evidence that Clerk, object storage or Mux is configured correctly.

Media also requires the existing Railway/S3 variables:

- `RAILWAY_ENDPOINT`, `RAILWAY_BUCKET_NAME`
- `RAILWAY_ACCESS_KEY_ID`, `RAILWAY_SECRET_ACCESS_KEY`
- `RAILWAY_REGION` (defaults to `us-east-1`)
- Optional `RAILWAY_PUBLIC_URL`, `RAILWAY_PUBLIC_URL_INCLUDE_BUCKET`

Provider variables belong in the selected Convex deployment. `VITE_` variables
are browser configuration; never put a secret in a `VITE_` variable. No `.env`
files, local admin keys, customer assets or preview fixture data belong in Git.
The development web server binds port5296. Use a separate owned local/dev backend;
do not reuse a production deploy key.

For a new agency deployment, follow [the first-install checklist](team-launch.md).
Keep web and Convex configuration separate; never copy the local sample credentials.
