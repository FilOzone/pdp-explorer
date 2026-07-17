# Subgraph Release Process

This document is the source of truth for releasing and deploying the PDP Explorer subgraph. The [release issue template](../../.github/ISSUE_TEMPLATE/subgraph_release.md) is a per-release tracking record; this runbook defines the process and commands to follow.

The release workflow publishes immutable Goldsky versions for both networks. Those versions do not become production endpoints until an operator verifies that both have finished indexing and moves their `prod` tags.

## Release Flow

```text
Conventional Commit PR merged to main
  → Release Please opens or updates the rolling Release PR
  → Release PR reviewed and merged                 (human release gate)
  → vX.Y.Z tag and GitHub Release created
  → calibration and mainnet versions deployed to Goldsky
  → release tracking issue opened automatically
  → both subgraphs finish indexing
  → version-specific endpoints smoke-tested
  → both `prod` tags moved to X.Y.Z                 (human production gate)
  → production and dependent clients verified
```

Release Please owns version calculation, changelog updates, the Git tag, and the GitHub Release. The [`deploy` job](../../.github/workflows/release-please.yml) owns immutable Goldsky deployment. The release owner is responsible for indexing checks, candidate verification, `prod` promotion, production verification, and rollback when necessary.

## Prerequisites

- Permission to review and merge the Release Please PR.
- Access to the PDP Explorer Goldsky project.
- The [Goldsky CLI](https://docs.goldsky.com/installation), authenticated with `goldsky login`, for manual promotion or fallback deployment.
- The Goldsky project ID, used to construct version-specific GraphQL endpoints for testing.
- A valid `GOLDSKY_API_KEY` repository secret for automated deployments.

## 1. Cut the Release

Commits touching `subgraph/**` must reach `main` through PRs with [Conventional Commit](https://www.conventionalcommits.org/) titles. Release Please uses those commits and [`release-please-config.json`](../../release-please-config.json) to open or update a rolling PR titled `chore: release to production (subgraph X.Y.Z)`.

Before merging the Release PR:

1. Review the proposed version and [`subgraph/CHANGELOG.md`](../../subgraph/CHANGELOG.md).
2. Confirm the version bump matches the changes: fixes normally produce a patch, features a minor, and breaking changes a major.
3. Confirm all intended subgraph changes are included and CI is green.
4. Merge the Release PR when the candidate is ready to deploy.

Merging creates the `vX.Y.Z` tag and GitHub Release. In the same workflow run, the immutable deployment jobs start and a `Release vX.Y.Z` tracking issue is opened from the [release issue template](../../.github/ISSUE_TEMPLATE/subgraph_release.md).

## 2. Confirm Immutable Goldsky Deployment

The release workflow builds and deploys the same version for both networks:

- `pdp-explorer-mainnet/X.Y.Z`
- `pdp-explorer-calibration/X.Y.Z`

Confirm that the GitHub Release exists and that both `Deploy subgraph to Goldsky` matrix jobs succeeded.

### Failed automated deployment

Rerun a failed deployment job from GitHub Actions first. If the workflow cannot be rerun, use this manual fallback after confirming that the GitHub Release and `vX.Y.Z` tag already exist. Run it from a clean checkout of that exact tag so later changes on `main` cannot enter the released deployment:

```bash
VERSION="X.Y.Z" # no v prefix; used as the Goldsky version segment

cd subgraph
npm ci
goldsky login

for network in calibration mainnet; do
  NETWORK="$network" npm run build
  goldsky subgraph deploy "pdp-explorer-$network/$VERSION" --path .
done
```

The fallback must deploy the exact version and source represented by the GitHub Release. Do not use `pdp-explorer/dev` for a production release.

## 3. Await Subgraph Indexing

Wait for both immutable versions to finish indexing:

- `pdp-explorer-mainnet/X.Y.Z`
- `pdp-explorer-calibration/X.Y.Z`

Check the full deployment details for both versions while waiting:

```bash
goldsky subgraph list "pdp-explorer-mainnet/X.Y.Z"
goldsky subgraph list "pdp-explorer-calibration/X.Y.Z"
```

Use the full output to check each version's sync status. Confirm both versions have reached chain head in the Goldsky dashboard or indexing-completion email before promotion. Do not promote either network while one is still indexing; clients should continue using the previous `prod` versions during this period.

## 4. Verify the Candidate

Run the Explorer locally against the new version-specific endpoints. Replace the project ID and version below:

```bash
cd subgraph-client

GOLDSKY_PROJECT_ID="..."
RELEASE_VERSION="X.Y.Z"

VITE_SUBGRAPH_URL_MAINNET="https://api.goldsky.com/api/public/$GOLDSKY_PROJECT_ID/subgraphs/pdp-explorer-mainnet/$RELEASE_VERSION/gn" \
VITE_SUBGRAPH_URL_CALIBRATION="https://api.goldsky.com/api/public/$GOLDSKY_PROJECT_ID/subgraphs/pdp-explorer-calibration/$RELEASE_VERSION/gn" \
npm run dev
```

Verify that:

- The Explorer loads without errors on mainnet and calibration.
- Representative queries return expected data on both networks.
- New or changed schema fields contain the expected indexed data.
- Any client changes associated with the release work against the candidate endpoints.

If verification fails, leave the existing `prod` tags unchanged, fix the problem through the normal PR and release flow, and document the result in the release issue.

## 5. Promote the Subgraphs to `prod`

> [!WARNING]
> Moving the `prod` tags changes the stable endpoints used by the production Explorer and other dependent clients. Promote only after both candidates have finished indexing and passed verification.

Goldsky tags are stable endpoint aliases. Creating `prod` on the new version moves that alias to the release version:

```bash
RELEASE_VERSION="X.Y.Z"

for network in mainnet calibration; do
  goldsky subgraph tag create "pdp-explorer-$network/$RELEASE_VERSION" --tag prod
done
```

Confirm that both stable endpoints now resolve to the released version:

- `pdp-explorer-mainnet/prod`
- `pdp-explorer-calibration/prod`

See [Goldsky's subgraph tag documentation](https://docs.goldsky.com/subgraphs/tags) for tag behavior and endpoint details.

## 6. Verify Production

After promotion:

1. Verify [PDP Explorer](https://pdp.filecoin.cloud) on mainnet and calibration.
2. Exercise representative subgraph-backed pages and queries.
3. Confirm dependent clients using the `prod` endpoints remain healthy.
4. Watch for query errors, missing data, or unexpected schema failures.

If production verification fails, use the rollback procedure immediately.

## 7. Wrap Up

1. Announce the release in the appropriate channel.
2. Record any incidents or improvements needed for the next release.
3. Close the release tracking issue after all checks pass.

## Rollback

The `prod` tags are the rollback lever. Moving them back to the last known-good immutable version restores the previous subgraph without rebuilding or redeploying it:

```bash
PREVIOUS_VERSION="X.Y.Z"

for network in mainnet calibration; do
  goldsky subgraph tag create "pdp-explorer-$network/$PREVIOUS_VERSION" --tag prod
done
```

After rollback, verify both production endpoints and dependent clients, then record the reason and rolled-back version in the release issue. Fixes should go through a new versioned release; do not overwrite an existing immutable version.

## Breaking Changes

A breaking schema or entity-shape change must not be promoted while production clients still depend on the old shape.

1. Cut and deploy the new immutable subgraph version without moving `prod`.
2. Wait for both networks to finish indexing.
3. Test compatible client changes against the new version-specific endpoints.
4. Deploy client changes that can safely consume the new shape. Prefer a transition that supports both old and new shapes when possible.
5. Move both `prod` tags only after production clients are ready.
6. If problems appear, move `prod` back to the previous subgraph version.

Keep subgraph and dependent client changes in separate PRs so the subgraph can finish indexing before client promotion.

## Troubleshooting

- **No Release PR:** Confirm that a Conventional Commit touching `subgraph/**` reached `main`, then inspect the Release Please job.
- **No release issue:** Inspect the `Create release tracking issue` job. If necessary, create one manually from the release issue template and replace `X.Y.Z` with the released version.
- **Deployment failed:** Rerun the failed matrix job before using the manual fallback.
- **Indexing stalled:** Inspect the version in the Goldsky dashboard and review its logs before contacting Goldsky support.
- **Incorrect `prod` version:** Follow [Rollback](#rollback) to restore the last known-good version.
