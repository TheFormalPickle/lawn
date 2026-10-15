# Lawn · agency content workflow

This agency fork adds a lightweight content tracker to [Lawn](https://github.com/pingdotgg/lawn),
the open-source video review platform by Theo / Ping Labs. Lawn stays standalone;
Atrium integration is future work. The upstream MIT license and attribution are retained.

**Assign → produce → review → ready to use.** A brief, producer, director/reviewer,
CMO and deadline stay linked to the current edit. Existing review, comments,
sharing and original-file downloads remain the foundation.

- [Agency workflow, permissions and acceptance](docs/agency-workflow.md)
- [Developer setup](docs/setup.md)
- [Deployment](docs/deployment.md)
- [Design philosophy](docs/philosophy.md)

```sh
bun install --frozen-lockfile
bun run dev
```

Configure Convex and Clerk first, then object storage and Mux for media workflows;
see the setup guide. Use a local/dev deployment with synthetic data for evaluation.
Never point development commands at production to test a feature.

```sh
bun run test
bun run typecheck
bun run lint
bun run build
```

Open feature PRs against **TheFormalPickle/lawn**, not upstream. This is an agency
adaptation, not an official Frame.io product. Monday's Assignments board has not
been imported; its app/field parity remains a separate acceptance step.
