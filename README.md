# PDP Explorer

https://pdp.vxb.ai

Data model and UI for exploring the PDP hot storage network

## Documentation

Detailed documentation is available in the following file:

- [Documentation](docs/README.md) - Subgraph deployment and GraphQL API reference

# Usage

A few user journeys:
As a user storing data with PDP I can use the explorer to:

- Check if my SP has had any faults. And I can check which data in particular was faulted
- Validate that all of the data added to my proofset is data that I asked to store, not anything else
- Look at fault rate of SPs in the network when deciding who to store my data with
- Learn about data that has been removed from my proofset

# Build And Deployment

This project uses subgraph technology and the Goldsky platform for data indexing, plus a Vite/React client that queries Goldsky directly.

Full details, including the automated release process, live in [docs/subgraph/deployment.md](docs/subgraph/deployment.md). Summary:

## Subgraph

- Network config (contract addresses, start blocks, proving-period params) lives in `subgraph/config/network.json`; mustache templates generate `subgraph.yaml` and `src/generated/constants.ts` from it (`npm run build:calibration` / `npm run build:mainnet` in `subgraph/`).
- **Production deploys are automated:** merging a release-please PR (see `.github/workflows/release-please.yml`) tags a version and deploys it to both `calibration` and `mainnet` on Goldsky in the same run — there's no manual deploy step for production.
- **Manual/local deploy:** `cd subgraph && goldsky login && npm run build:calibration` (or `build:mainnet`) `&& npm run deploy:dev` deploys to `pdp-explorer/dev` — `deploy:dev` does not rebuild for you, so build first.

## Frontend Site

```bash
cd subgraph-client
cp .env.example .env
# Fill in VITE_GOLDSKY_PROJECT_ID, VITE_GOLDSKY_PROJECT_NAME, VITE_GOLDSKY_MAINNET_SUBGRAPH_VERSION, VITE_GOLDSKY_CALIBRATION_SUBGRAPH_VERSION
npm install
npm run dev    # local
npm run build  # production build
```
