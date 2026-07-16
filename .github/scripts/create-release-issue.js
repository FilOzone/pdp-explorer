// Invoked by the `create-release-issue` job in .github/workflows/release-please.yml
// via actions/github-script. Creates (or relabels) a `Release vX.Y.Z` tracking
// issue from .github/ISSUE_TEMPLATE/release.md, without duplicating one that
// already exists for the same version.
module.exports = async ({ github, context, core }) => {
  const fs = require("node:fs");

  const version = process.env.RELEASE_VERSION;
  const title = `Release v${version}`;
  const label = "release";

  try {
    await github.rest.issues.createLabel({
      ...context.repo,
      name: label,
      color: "0e8a16",
      description: "Tracks release verification and production promotion",
    });
  } catch (error) {
    // 422 means the label already exists — anything else is unexpected.
    if (error.status !== 422) throw error;
  }

  const searchResult = await github.rest.search.issuesAndPullRequests({
    q: `repo:${context.repo.owner}/${context.repo.repo} type:issue in:title "${title}"`,
  });
  const existingIssue = searchResult.data.items.find(
    (issue) => issue.title.trim().toLowerCase() === title.toLowerCase(),
  );

  if (existingIssue) {
    const hasLabel = existingIssue.labels.some((item) => (typeof item === "string" ? item : item.name) === label);
    if (!hasLabel) {
      await github.rest.issues.addLabels({
        ...context.repo,
        issue_number: existingIssue.number,
        labels: [label],
      });
    }
    core.notice(`Release issue already exists: ${existingIssue.html_url}`);
    return;
  }

  const rawBody = fs.readFileSync(".github/ISSUE_TEMPLATE/release.md", "utf8");

  const withoutFrontmatter = rawBody.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
  if (withoutFrontmatter === rawBody) {
    throw new Error("Failed to strip YAML frontmatter from .github/ISSUE_TEMPLATE/release.md");
  }

  // Only substitute the X.Y.Z placeholder inside backtick-wrapped code spans
  // (`vX.Y.Z`, `pdp-explorer-mainnet/X.Y.Z`, ...) so incidental prose mentioning
  // "X.Y.Z" elsewhere in the template can never be silently rewritten too.
  const body = withoutFrontmatter.replace(
    /`([^`]*)X\.Y\.Z([^`]*)`/g,
    (_match, pre, post) => `\`${pre}${version}${post}\``,
  );

  const { data: issue } = await github.rest.issues.create({
    ...context.repo,
    title,
    body,
    labels: [label],
  });
  core.notice(`Created release issue: ${issue.html_url}`);
};
