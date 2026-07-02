import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();
const productionDirs = [
  "src/analyzers",
  "src/profiles",
  "src/reports"
];

const forbiddenIncidentTokens = [
  "baseline-ui",
  "candidate_count",
  "topProjects",
  "top_projects_returned",
  "zero-score",
  "directory-or-list-repository",
  "VERY_WEAK_SCORE",
  "USABLE_SCORE"
];

const thresholdComparison = /\b(?:score|relevance|confidence)\b[\s\S]{0,80}[<>]=?\s*\d{1,3}\b/i;

test("production acceptance logic does not contain project-specific hard-coded rules", async () => {
  const files = [];
  for (const dir of productionDirs) {
    files.push(...await listJsFiles(join(root, dir)));
  }

  const violations = [];
  for (const file of files) {
    const text = await readFile(file, "utf8");
    const displayPath = relative(root, file);

    for (const token of forbiddenIncidentTokens) {
      if (text.includes(token)) {
        violations.push(`${displayPath}: contains historical incident token "${token}"`);
      }
    }

    if (thresholdComparison.test(stripComments(text))) {
      violations.push(`${displayPath}: compares semantic score/relevance/confidence to a fixed number`);
    }
  }

  assert.deepEqual(
    violations,
    [],
    [
      "Acceptance rules must be generated from the target project's docs and runtime evidence.",
      "Do not add fixed field names, repository categories, sample prompts, or score thresholds to production analyzers/reports/profiles.",
      ...violations
    ].join("\n")
  );
});

async function listJsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }
  return files;
}

function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}
