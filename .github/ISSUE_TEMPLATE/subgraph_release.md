---
name: Release
about: Track subgraph indexing, verification, and production promotion
title: "Release vX.Y.Z"
labels: release
assignees: ""
---

## Release Checklist

> [!IMPORTANT]
> Follow the canonical [Subgraph Release Process](https://github.com/FilOzone/pdp-explorer/blob/main/docs/subgraph/release.md). This issue records the status of this release; the runbook defines the process and commands.

### 1. Confirm the release

- [ ] The Release Please PR for `vX.Y.Z` was merged
- [ ] The `vX.Y.Z` tag and GitHub Release were created
- [ ] The `Deploy subgraph to Goldsky (calibration)` job succeeded
- [ ] The `Deploy subgraph to Goldsky (mainnet)` job succeeded

### 2. Await subgraph indexing

- [ ] Received confirmation that `pdp-explorer-mainnet/X.Y.Z` has finished indexing
- [ ] Received confirmation that `pdp-explorer-calibration/X.Y.Z` has finished indexing

### 3. Verify the candidate

- [ ] Explorer loads without errors on mainnet
- [ ] Explorer loads without errors on calibration
- [ ] Changes included in this release were smoke-tested

### 4. Promote the subgraphs to `prod`

- [ ] `pdp-explorer-mainnet/X.Y.Z` is tagged as `prod`
- [ ] `pdp-explorer-calibration/X.Y.Z` is tagged as `prod`

### 5. Verify production

- [ ] [PDP Explorer](https://pdp.filecoin.cloud) loads and functions correctly on mainnet after the tag switch
- [ ] [PDP Explorer](https://pdp.filecoin.cloud) loads and functions correctly on calibration after the tag switch
- [ ] Dependent clients using the `prod` endpoints load and function correctly

### 6. Wrap up

- [ ] The release was announced to the appropriate channel
- [ ] Any improvements needed in the release process were documented
- [ ] Close this issue
