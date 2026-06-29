import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateConsumptionEvidence,
  extractGithubUrls,
  parseGithubUrlReviewArgs
} from "../scripts/probes/github_url_browser_review.mjs";

test("parseGithubUrlReviewArgs parses required options", () => {
  const parsed = parseGithubUrlReviewArgs([
    "--input",
    "runtime/scenario.json",
    "--output",
    "runtime/url-review.json",
    "--query",
    "find a repo",
    "--max-urls",
    "3",
    "--timeout-ms",
    "5000",
    "--headed"
  ]);

  assert.match(parsed.input, /runtime[\\/]scenario\.json$/);
  assert.match(parsed.output, /runtime[\\/]url-review\.json$/);
  assert.equal(parsed.query, "find a repo");
  assert.equal(parsed.maxUrls, 3);
  assert.equal(parsed.timeoutMs, 5000);
  assert.equal(parsed.mode, "headed");
});

test("extractGithubUrls deduplicates repository urls", () => {
  const urls = extractGithubUrls([
    "https://github.com/demo/project",
    "https://github.com/demo/project.",
    "https://github.com/other/repo)"
  ].join("\n"));

  assert.deepEqual(urls, [
    "https://github.com/demo/project",
    "https://github.com/other/repo"
  ]);
});

test("evaluateConsumptionEvidence compares query terms against observed target text", () => {
  const supported = evaluateConsumptionEvidence(
    "browser extension summarize pages notion sync",
    "A browser extension that can summarize web pages and sync notes to Notion."
  );
  const mismatch = evaluateConsumptionEvidence(
    "browser extension summarize pages notion sync",
    "A static dashboard for server metrics and logs."
  );

  assert.equal(supported.requirementMatch, "supported");
  assert.equal(supported.matchedTerms.includes("browser"), true);
  assert.equal(mismatch.requirementMatch, "mismatch");
});
