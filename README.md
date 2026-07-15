# PDP Explorer

https://pdp.filecoin.cloud

Data model and UI for exploring the PDP hot storage network.

## Documentation

Detailed documentation is available in the following file:

- [Documentation](docs/README.md) - Subgraph deployment and GraphQL API reference

# Usage

A few user journeys:

As a user storing data with PDP, I can use the explorer to:

- Check whether my storage provider has had faults, and which data was affected.
- Validate that the data added to my proof set is data I asked to store.
- Compare provider fault rates before choosing where to store data.
- Learn which data has been removed from my proof set.

# Build And Deployment

This project uses subgraph technology and the Goldsky platform for data indexing, plus a Vite/React client that queries Goldsky directly.

Full details, including the automated release process, live in [docs/subgraph/deployment.md](docs/subgraph/deployment.md). Summary:

## Subgraph

- Network config (contract addresses, start blocks, proving-period params) lives in `subgraph/config/network.json`; mustache templates generate `subgraph.yaml` and `src/generated/constants.ts` from it (`npm run build:calibration` / `npm run build:mainnet` in `subgraph/`).
- **Production deploys are automated:** merging a release-please PR (see `.github/workflows/release-please.yml`) tags a version and deploys it to both `calibration` and `mainnet` on Goldsky in the same run.
- **Manual/local deploy:** `cd subgraph && goldsky login && NETWORK=calibration npm run build && NETWORK=calibration npm run deploy:dev` deploys to `pdp-explorer/dev`. Use `NETWORK=mainnet` for mainnet config. `deploy:dev` regenerates config for `NETWORK` but does not rebuild, so build first.

## Frontend Site

```bash
cd subgraph-client

cp .env.example .env
# Fill in the following parameters:
# VITE_SUBGRAPH_URL_MAINNET: mainnet subgraph query url
# VITE_SUBGRAPH_URL_CALIBRATION: calibration subgraph query url

npm install
npm run dev    # local
npm run build  # production build
```

# Contributing

- **Raise subgraph changes as their own PR, separate from `subgraph-client` changes.** A newly deployed subgraph version needs real time to sync back up to the chain head (see [docs/subgraph/deployment.md](docs/subgraph/deployment.md)) before its new/changed fields have data behind them.
- **Land and sync the subgraph PR before the client PR that depends on it.** Merge the subgraph change, wait for the new version to finish syncing on the relevant network(s), and confirm the new data looks right — only then open the follow-up PR that updates `subgraph-client` to query it. Shipping both together risks the client querying fields or entities the subgraph hasn't caught up on yet.
- **PR titles must follow [Conventional Commits](https://www.conventionalcommits.org/)** (e.g. `feat:`, `fix:`, `docs:`, `chore:`), enforced by CI (`.github/workflows/pr-title.yml`). PRs are squash-merged, so the PR title becomes the commit on `main` that `release-please` parses to compute version bumps and changelogs — a malformed title breaks release automation.
- **Run `npm run check` (Biome format + lint, auto-fixes) from the repo root before pushing.** CI enforces the same rules read-only via `npm run check:ci` (`.github/workflows/biome.yml`) and will fail the PR otherwise.
