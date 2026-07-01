# Subgraph Deployment and Client Usage

This guide covers building the subgraph, how it gets deployed to Goldsky (both the automated production flow and manual/local options), and running the `subgraph-client` app against it.

## Prerequisites

1. **Node.js and npm:** Node.js version 20.18.1 or higher. Download from [nodejs.org](https://nodejs.org/).
2. **Goldsky account:** Sign up at [goldsky.com](https://goldsky.com/) — you need this for manual/local deploys, and a `GOLDSKY_API_KEY` from it is required as a repo secret for the automated production deploy (see below).
3. **Goldsky CLI:** Follow the [Goldsky documentation](https://docs.goldsky.com/introduction) to install it.

The Graph CLI (`@graphprotocol/graph-cli`) is a regular dependency of `subgraph/package.json`, so `npm install` is enough to get it — you don't need a separate global install unless you want to run `graph` commands directly outside the npm scripts below.

## Building the Subgraph

Network-specific values (contract addresses, start blocks, proving-period parameters) live in `subgraph/config/network.json`, not in source files:

```json
{
  "networks": {
    "calibration": {
      "name": "filecoin-testnet",
      "PDPVerifier": { "address": "0x...", "startBlock": 3140755 },
      "FWSS": { "maxProvingPeriod": "240", "challengeWindowSize": "20" }
    },
    "mainnet": {
      "name": "filecoin",
      "PDPVerifier": { "address": "0x...", "startBlock": 5441432 },
      "FWSS": { "maxProvingPeriod": "2880", "challengeWindowSize": "60" }
    }
  }
}
```

Building for a network runs mustache templates against this file to produce `subgraph.yaml` (from `templates/subgraph.template.yaml`) and `src/generated/constants.ts` (from `templates/constants.template.ts`) — before invoking `graph codegen` and `graph build`. You never hand-edit the generated files or hardcode a contract address in `subgraph/utils/`; change `network.json` instead.

```bash
cd subgraph
npm install

# Build for calibration (generates constants + subgraph.yaml, then graph codegen && graph build)
npm run build:calibration

# Build for mainnet
npm run build:mainnet
```

Every PR touching `subgraph/**` runs this same sequence (plus `npm test` for the Matchstick unit tests) in `.github/workflows/subgraph-ci.yml` before it can merge.

## Automated Release & Deploy (production)

Production deploys are automated end-to-end via [release-please](https://github.com/googleapis/release-please) and are **not** triggered by hand:

1. Land commits to `main` using [Conventional Commits](https://www.conventionalcommits.org/) (`fix:`, `feat:`, etc.) under `subgraph/**`.
2. `.github/workflows/release-please.yml` watches pushes to `main` and maintains a single rolling PR titled `chore: release to production (subgraph X.Y.Z)`, tracked via `release-please-config.json` / `.release-please-manifest.json`.
3. Merging that PR bumps `.release-please-manifest.json` and `subgraph/CHANGELOG.md`, tags `vX.Y.Z`, and creates a GitHub Release.
4. In the **same workflow run** (gated on release-please's `release_created` output, so no separate tag-push workflow is needed), a `deploy` job builds and deploys to **both** `calibration` and `mainnet` — a matrix job, not a promotion step — publishing to Goldsky as `pdp-explorer/calibration_<version>` and `pdp-explorer/mainnet_<version>` using the `GOLDSKY_API_KEY` repository secret.

There is deliberately no separate "promote calibration to mainnet" step: both networks always ship the same version together in one run.

## Manual / Local Deploy (dev only)

For local iteration, outside the release flow:

```bash
cd subgraph
goldsky login   # paste your Goldsky API key when prompted
npm run build:calibration   # or build:mainnet — deploy:dev does not rebuild for you
npm run deploy:dev   # regenerates config/constants, then deploys the existing build/ output to pdp-explorer/dev
```

## Running the Subgraph Client

The `subgraph-client` is a Vite app that queries the deployed subgraph directly from the browser.

1. **Navigate to the client directory:**
   ```bash
   cd subgraph-client
   ```
2. **Set environment variables:** copy `.env.example` to `.env` and fill in:
   ```dotenv
   VITE_GOLDSKY_PROJECT_ID= # goldsky project id ( subgraph project id )
   VITE_GOLDSKY_PROJECT_NAME= # goldsky project name ( subgraph project name )
   VITE_MAINNET_PDP_VERIFIER= # mainnet pdp verifier contract address (optional)
   VITE_MAINNET_PDP_SERVICE= # mainnet pdp simple service contract address (optional)
   VITE_CALIBRATION_PDP_VERIFIER= # calibration pdp verifier contract address (optional)
   VITE_CALIBRATION_PDP_SERVICE= # calibration pdp simple service contract address (optional)
   VITE_GOLDSKY_MAINNET_SUBGRAPH_VERSION= # mainnet subgraph version
   VITE_GOLDSKY_CALIBRATION_SUBGRAPH_VERSION= # calibration subgraph version
   ```
3. **Install and run:**
   ```bash
   npm install
   npm run dev
   ```
   The app lets users switch between `mainnet` and `calibration` client-side (see `src/contexts/NetworkContext.tsx`) — there is a single deployed instance, not separate staging/production sites per network.

## Modifying the Subgraph

1. Edit `schema.graphql` (entities), `subgraph/config/network.json` (network parameters), `templates/*.template.*` (manifest/constants shape), or `src/*.ts` (event handlers) as needed.
2. Run `npm test` locally (Matchstick unit tests) and `npm run build:calibration && npm run build:mainnet` to confirm both networks still build.
3. Open a PR with a [Conventional Commits](https://www.conventionalcommits.org/) type (`fix:`, `feat:`, etc.) — CI (`subgraph-ci.yml`) runs the same tests/builds automatically.
4. Once merged to `main`, release-please opens or updates the rolling release PR.
5. Merge the release PR when you want to ship — tagging, the GitHub Release, and the Goldsky deploy to both networks happen automatically from there.

**Development Resources:**

- **AssemblyScript:** Subgraph mappings are written in AssemblyScript, a subset of TypeScript that compiles to Wasm. See [assemblyscript.org](https://www.assemblyscript.org/).
- **The Graph Documentation:** [thegraph.com/docs](https://thegraph.com/docs/en/subgraphs/developing/creating/starting-your-subgraph/).
- **Goldsky Documentation:** [docs.goldsky.com](https://docs.goldsky.com/).

## Further Information

For more information on queries used in the subgraph client, refer [here](https://github.com/FilOzone/pdp-explorer/blob/main/subgraph-client/src/utility/queries.ts). And, on the GraphQL schema and example queries, refer to the [GraphQL API Reference](./graphql-api.md).
