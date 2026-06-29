import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runRecordedCommand } from "../src/core/command-runner.js";

test("runRecordedCommand preserves UTF-8 command output", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "agent-test-utf8-"));
  const result = await runRecordedCommand({
    name: "utf8",
    cwd: process.cwd(),
    outputDir,
    command: process.execPath,
    args: ["-e", "console.log('中文输出')"],
    timeoutMs: 10000
  });

  assert.match(result.artifact.stdout, /中文输出/);
});
