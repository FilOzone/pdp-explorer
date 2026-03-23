# PDP Explorer

https://pdp.vxb.ai

Data model and UI for exploring the PDP hot storage network

## Documentation

Detailed documentation is available in the following file:

- [Documentation](docs/README.md) - System architecture, database schema, and development guide

## Mockup

This is a first draft at what the PDP explorer will look like ![pdpexplorer](https://github.com/user-attachments/assets/e0595422-fa77-490b-ab57-0c9516ea5d8a)

The mockup file is created using Excalidraw. You can find it [here](https://github.com/FilOzone/pdp-explorer/blob/main/assets/pdp-explorer-mockups.excalidraw).

# Usage

A few user journeys:
As a user storing data with PDP I can use the explorer to:

- Check if my SP has had any faults. And I can check which data in particular was faulted
- Validate that all of the data added to my proofset is data that I asked to store, not anything else
- Look at fault rate of SPs in the network when deciding who to store my data with
- Learn about data that has been removed from my proofset

# Build And Deployment

This project uses subgraph technology and the Goldsky platform for data indexing and monitoring.

## Goldsky
- Log in to [goldsky](https://goldsky.com)
```bash
# Login
goldsky login
# API key: enter your Goldsky API key
xxxxxxxxxxxx
```
- Switch chain environment
    - mainnet
        - Update `subgraph.yaml` with `cp subgraph/subgraph_mainnet.yaml subgraph/subgraph.yaml`
        - Update `subgraph/src/pdp-verifier.ts` to set `proofSet.maxProvingPeriod = BigInt.fromI32(240);`
    - calibration
        - Update `subgraph.yaml` with `cp subgraph/subgraph_testnet.yaml subgraph/subgraph.yaml`
        - Update `subgraph/src/pdp-verifier.ts` to set `proofSet.maxProvingPeriod = BigInt.fromI32(240);`
- Build and deploy subgraph
```bash
cd subgraph
# mainnet
graph codegen
graph build
goldsky subgraph deploy <product-name>/mainnet_<version> --path ./
# calibration: switch chain environment first
graph codegen
graph build
goldsky subgraph deploy <product-name>/calibration_<version> --path ./
```
- Sync
Wait until `mainnet_<version>` and `calibration_<version>` finish syncing.

## Frontend Site
- Configure environment variables
```bash
cd subgraph-client
# Parameters
# VITE_GOLDSKY_PROJECT_ID: see Goldsky documentation
# VITE_GOLDSKY_PROJECT_NAME: product-name
# VITE_GOLDSKY_MAINNET_SUBGRAPH_VERSION: mainnet_<version>
# VITE_GOLDSKY_CALIBRATION_SUBGRAPH_VERSION: calibration_<version>
cp .env.example .env
# Local test
yarn dev
# Build
yarn build
```
