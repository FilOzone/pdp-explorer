# Subgraph Development and Local Deployment

This guide covers configuring and building the subgraph, deploying a development version to Goldsky, and running the `subgraph-client` app against it.

Production releases follow the canonical [Subgraph Release Process](./release.md) and are tracked per version with the [release issue template](../../.github/ISSUE_TEMPLATE/subgraph_release.md). Release Please publishes versioned subgraphs; after they finish indexing and pass verification, the release owner moves the Goldsky `prod` tags to the new version.

## Prerequisites

1. **Node.js and npm:** Node.js version 20.18.1 or higher. Download from [nodejs.org](https://nodejs.org/).
2. **Goldsky account:** Sign up at [goldsky.com](https://goldsky.com/). Manual development deploys require a login.
3. **Goldsky CLI:** Follow the [Goldsky documentation](https://docs.goldsky.com/introduction) to install it.

The Graph CLI (`@graphprotocol/graph-cli`) is a regular dependency of `subgraph/package.json`, so `npm install` is enough to get it. You don't need a separate global install unless you want to run `graph` commands directly outside the npm scripts below.

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

Building for a network runs mustache templates against this file to produce `subgraph.yaml` (from `templates/subgraph.template.yaml`) and `src/generated/constants.ts` (from `templates/constants.template.ts`) before invoking `graph codegen` and `graph build`. Change `network.json`, not the generated files, when a network value changes.

```bash
cd subgraph
npm install

# Build for calibration (generates constants + subgraph.yaml, then graph codegen && graph build)
npm run build:calibration

# Build for mainnet
npm run build:mainnet
```

Every PR touching `subgraph/**` runs this same sequence, plus `npm test` for the Matchstick unit tests, in `.github/workflows/subgraph-ci.yml` before it can merge.

## Manual Development Deploy

For local iteration outside the release flow:

```bash
cd subgraph
goldsky login # paste your Goldsky API key when prompted

# Calibration dev deploy
NETWORK=calibration npm run build
NETWORK=calibration npm run deploy:dev

# Mainnet-config dev deploy
NETWORK=mainnet npm run build
NETWORK=mainnet npm run deploy:dev
```

`deploy:dev` runs `predeploy:dev`, which regenerates config and constants for `NETWORK` before deploying to `pdp-explorer/dev`. It does not run `graph build`, so build the same network first.

## Running the Subgraph Client

The `subgraph-client` is a Vite app that queries the deployed subgraph directly from the browser.

1. Navigate to the client directory:

   ```bash
   cd subgraph-client
   ```

2. Copy `.env.example` to `.env` and fill in the environment variables:

   ```dotenv
   VITE_SUBGRAPH_URL_MAINNET= # mainnet subgraph URL
   VITE_SUBGRAPH_URL_CALIBRATION= # calibration subgraph URL
   VITE_MAINNET_PDP_VERIFIER= # mainnet PDP verifier contract address (optional)
   VITE_MAINNET_PDP_SERVICE= # mainnet PDP simple service contract address (optional)
   VITE_CALIBRATION_PDP_VERIFIER= # calibration PDP verifier contract address (optional)
   VITE_CALIBRATION_PDP_SERVICE= # calibration PDP simple service contract address (optional)
   ```

3. Install dependencies and start the app:

   ```bash
   npm install
   npm run dev
   ```

The app lets users switch between `mainnet` and `calibration` client-side (see `src/contexts/NetworkContext.tsx`). There is a single deployed app instance, not separate sites per network.

## Modifying the Subgraph

1. Edit `schema.graphql` (entities), `subgraph/config/network.json` (network parameters), `templates/*.template.*` (manifest/constants shape), or `src/*.ts` (event handlers) as needed.
2. From `subgraph/`, run `npm test` locally and `npm run build:calibration && npm run build:mainnet` to confirm both networks still build.
3. Open a PR with a [Conventional Commits](https://www.conventionalcommits.org/) type (`fix:`, `feat:`, etc.). CI runs the same tests and builds automatically.
4. Once merged to `main`, Release Please opens or updates the rolling release PR.
5. Follow the [Subgraph Release Process](./release.md). Merging the release PR publishes a GitHub Release and versioned Goldsky deployments for both networks, then automatically opens a release issue to track indexing, verification, and `prod` promotion.

## Development Resources

- **AssemblyScript:** Subgraph mappings are written in AssemblyScript, a subset of TypeScript that compiles to Wasm. See [assemblyscript.org](https://www.assemblyscript.org/).
- **The Graph Documentation:** [thegraph.com/docs](https://thegraph.com/docs/en/subgraphs/developing/creating/starting-your-subgraph/).
- **Goldsky Documentation:** [docs.goldsky.com](https://docs.goldsky.com/).

## Further Information

For more information on queries used in the subgraph client, see [`subgraph-client/src/utility/queries.ts`](../../subgraph-client/src/utility/queries.ts). For the GraphQL schema and example queries, see the [GraphQL API Reference](./graphql-api.md).
