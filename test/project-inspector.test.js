import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { inspectProject } from "../src/analyzers/project-inspector.js";

test("inspectProject excludes configured ignored paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-test-ignore-path-"));
  await writeFile(join(root, "README.md"), "# Project\n", "utf8");
  await mkdir(join(root, "docs", "showcase"), { recursive: true });
  await writeFile(join(root, "docs", "showcase", "sample.md"), "# Generated sample\n", "utf8");

  const project = await inspectProject(root, {
    ignorePaths: ["docs/showcase"]
  });

  assert.equal(project.files.some((file) => file.path === "README.md"), true);
  assert.equal(project.files.some((file) => file.path === "docs/showcase/sample.md"), false);
  assert.deepEqual(project.scanLimit.ignoredPaths, ["docs/showcase"]);
});

test("inspectProject excludes generated QA report files", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-test-generated-report-"));
  await writeFile(join(root, "README.md"), "# Project\n", "utf8");
  await writeFile(join(root, "AGENT_TEST_QA_REPORT.md"), "# Developer report\n", "utf8");
  await writeFile(join(root, "USER_QA_SUMMARY.md"), "# User report\n", "utf8");
  await writeFile(join(root, "report.json"), "{}\n", "utf8");

  const project = await inspectProject(root);

  assert.equal(project.files.some((file) => file.path === "README.md"), true);
  assert.equal(project.files.some((file) => file.path === "AGENT_TEST_QA_REPORT.md"), false);
  assert.equal(project.files.some((file) => file.path === "USER_QA_SUMMARY.md"), false);
  assert.equal(project.files.some((file) => file.path === "report.json"), false);
});
