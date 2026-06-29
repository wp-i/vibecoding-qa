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
