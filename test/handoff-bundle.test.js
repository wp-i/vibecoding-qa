import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHandoffBundle } from "../scripts/reports/create_handoff_bundle.mjs";

test("createHandoffBundle copies report and artifacts with command metadata", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-test-handoff-"));
  const report = join(root, "TEST_REPORT.md");
  const artifacts = join(root, "runtime");
  const out = join(root, "bundle");

  await mkdir(artifacts);
  await writeFile(report, "# Report\n", "utf8");
  await writeFile(
    join(artifacts, "pytest-live.json"),
    `${JSON.stringify({
      name: "pytest-live",
      command: ["python", "-m", "pytest", "-m", "live"],
      cwd: "D:/code/example",
      env: ["RUN_LIVE_EVAL"],
      exitCode: 0,
      timedOut: false,
      durationMs: 1234
    })}\n`,
    "utf8"
  );

  const result = await createHandoffBundle({
    report,
    artifactDirs: [artifacts],
    out,
    workspaceRoot: root
  });

  const manifest = await readFile(result.manifestPath, "utf8");
  assert.match(manifest, /RUN_LIVE_EVAL/);
  assert.match(manifest, /pytest-live/);
  assert.deepEqual(result.manifest.commandArtifacts[0].env, ["RUN_LIVE_EVAL"]);
  assert.match(await readFile(join(out, "TEST_REPORT.md"), "utf8"), /# Report/);
  assert.match(await readFile(join(out, "runtime", "pytest-live.json"), "utf8"), /pytest-live/);
});
