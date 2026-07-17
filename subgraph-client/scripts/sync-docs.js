// subgraph-client/scripts/sync-docs.js
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, "..", "..", "docs", "subgraph");
const DEST_DIR = join(__dirname, "..", "public", "docs", "subgraph");

// Source docs use relative repository links so they work on any branch or fork.
// The in-app Documentation page routes sibling docs by id and cannot serve files
// outside docs/subgraph, so adapt those links only in the generated public copy.
const IN_APP_DOC_LINK_REWRITE = /\]\(\.\/(development|graphql-api)\.md\)/g;
const RELEASE_DOC_LINK_REWRITE = /\]\(\.\/release\.md\)/g;
const REPO_ROOT_LINK_REWRITE = /\]\(\.\.\/\.\.\/([^)]+)\)/g;
const REPOSITORY_URL = "https://github.com/FilOzone/pdp-explorer/blob/main";

// release.md is a release-ops runbook for whoever manages deploys, not
// something Explorer's public users need — keep it out of the app entirely
// rather than just out of the Documentation page's nav.
const EXCLUDED_DOCS = new Set(["release.md"]);

// Rebuild DEST_DIR from scratch each run so a doc renamed or removed from
// SRC_DIR can't linger here as stale generated output.
rmSync(DEST_DIR, { recursive: true, force: true });
mkdirSync(DEST_DIR, { recursive: true });

for (const file of readdirSync(SRC_DIR)) {
  if (!file.endsWith(".md") || EXCLUDED_DOCS.has(file)) continue;
  const content = readFileSync(join(SRC_DIR, file), "utf8");
  const rewritten = content
    .replace(IN_APP_DOC_LINK_REWRITE, "](./$1)")
    .replace(RELEASE_DOC_LINK_REWRITE, `](${REPOSITORY_URL}/docs/subgraph/release.md)`)
    .replace(REPO_ROOT_LINK_REWRITE, `](${REPOSITORY_URL}/$1)`);
  writeFileSync(join(DEST_DIR, file), rewritten);
}
