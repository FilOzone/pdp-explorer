# Operational Readiness

This answers the questions tracked in [issue #87 — GA Operational readiness](https://github.com/FilOzone/pdp-explorer/issues/87). Each answer is marked as either confirmed from the repo/infra config, or an open item still needing a decision or follow-up — nothing here is guessed.

## Components

- **`subgraph/`** — the indexer. There is no separate "API server" process: Goldsky's hosted GraphQL endpoint (`https://api.goldsky.com/api/public/<project_id>/subgraphs/pdp-explorer/<network>_<version>/gn`) is the API.
- **`subgraph-client/`** — the website (https://pdp.vxb.ai), a Vite/React SPA that queries the Goldsky endpoint directly from the browser.

See [Subgraph Deployment](subgraph/deployment.md) for full build/deploy mechanics.

## Indexer / Website deployment

**Is there a single explorer instance for both networks, or a staging/production split (like Dealbot)?**
Single instance, confirmed. `subgraph-client/src/contexts/NetworkContext.tsx` lets a user switch between `mainnet` and `calibration` client-side (persisted to `localStorage`, also settable via a `?network=` query param). There is no separate staging vs. production *website* deployment — one deployed site serves both networks, and this repo does not use the calibration=staging/mainnet=production split the issue calls out for Dealbot.

**What infrastructure runs the website, and how is it deployed?**
*Open item.* This repo previously had a `subgraph-client/Dockerfile`, but it wasn't used by any workflow or deploy path — it's been removed to cut maintenance burden. `.github/workflows/subgraph-client-ci.yml` only typechecks/builds the app for CI; it doesn't deploy anywhere. `FilOzone/infra`'s `prod/apps/` directory (which does have an entry for `dealbot`, a comparable service) has no `pdp`/`pdp-explorer` entry either. So the actual mechanism serving `pdp.vxb.ai` is unverified from either repo — whoever operates the site should document the real deploy path here.

**Where is the database hosted?**
There is no self-hosted database. All subgraph indexing and storage is managed by Goldsky, a hosted indexing service — see [Subgraph Deployment](subgraph/deployment.md).

## Subgraph change management and deployment

Full mechanics: [Subgraph Deployment](subgraph/deployment.md). Direct answers to the issue's questions:

- **How are subgraph changes deployed?** Automatically. A conventional commit merged to `main` under `subgraph/**` is picked up by release-please (`.github/workflows/release-please.yml`), which maintains a rolling release PR. Merging that PR tags a version and, in the same workflow run, builds and deploys to both Goldsky networks.
- **How are they verified for correctness?** `.github/workflows/subgraph-ci.yml` runs Matchstick unit tests and builds both `calibration` and `mainnet` on every PR touching `subgraph/**`, required before merge.
- **How are they promoted from calibration to mainnet?** They aren't "promoted" — both networks deploy together, same version, in the same workflow run (a matrix job). This is deliberate: no separate staging→production promotion step.
- **How are new subgraph URLs shared?** *Open item.* Endpoint URLs follow a predictable scheme (`pdp-explorer/<network>_<version>` on Goldsky), and the version is visible in the GitHub Release/tag release-please creates, but nothing currently pushes the URL to consumers (e.g. a Slack message or release note). Worth deciding whether to add that to the `deploy` job.

## Monitoring

- **Website uptime:** confirmed configured. Gatus checks `https://pdp.vxb.ai/` every 60s (HTTP 200-299) and alerts to Slack — see `FilOzone/infra`, `prod/apps/gatus/configmap.yaml` ("PDP VXB" entry), publicly visible at https://status.filoz.org/endpoints/foc-websites_pdp-vxb.
- **Subgraph freshness (calibration + mainnet):** *Open item — not yet configured.* `filecoin-pay-explorer` has an equivalent check in the same `configmap.yaml` ("Filecoin Pay Subgraph (Mainnet/Calibration)") that POSTs `{ _meta { hasIndexingErrors } }` to its Goldsky endpoint and alerts if that isn't `false`. No PDP equivalent exists yet. Adding one needs a decision on whether to point at a fixed `<version>` (must be bumped every release) or a Goldsky tag alias that always resolves to the current production version.

## Access

*Open item.* StorSwift team members may need access to the FOC Operational Excellence Notion space and the `FilOzone/infra` repo (per issue #87's notes) — a people/permissions action, not something a doc can resolve on its own; flagged here so it isn't lost.

## Related

- [Issue #87 — GA Operational readiness](https://github.com/FilOzone/pdp-explorer/issues/87)
- [Subgraph Deployment Guide](subgraph/deployment.md)
- [PDP Explorer Operational Excellence (Notion)](https://www.notion.so/filecoindev/PDP-Explorer-Operational-Excellence-326dc41950c180afa88df16182848709)
