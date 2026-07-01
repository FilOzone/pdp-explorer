// subgraph-client/scripts/sync-docs.js
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, "..", "..", "docs", "subgraph");
const DEST_DIR = join(__dirname, "..", "public", "docs", "subgraph");

// The in-app Documentation page routes on doc id (no .md extension), while
// GitHub's file viewer requires the extension — rewrite sibling-doc links
// for the copy served to the app; everything else is copied verbatim.
const IN_APP_LINK_REWRITE = /\]\(\.\/(deployment|graphql-api)\.md\)/g;

// Rebuild DEST_DIR from scratch each run so a doc renamed or removed from
// SRC_DIR can't linger here as stale generated output.
rmSync(DEST_DIR, { recursive: true, force: true });
mkdirSync(DEST_DIR, { recursive: true });

for (const file of readdirSync(SRC_DIR)) {
  if (!file.endsWith(".md")) continue;
  const content = readFileSync(join(SRC_DIR, file), "utf8");
  const rewritten = content.replace(IN_APP_LINK_REWRITE, "](./$1)");
  writeFileSync(join(DEST_DIR, file), rewritten);
}
