import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { redactSecrets, runRecordedCommand } from "../src/core/command-runner.js";

test("redactSecrets removes common token shapes", () => {
  const githubToken = "github_pat_" + "abc123_X";
  const apiKey = "sk-" + "abcdef1234567890";
  const tavilyKey = "tvly-" + "dev-abc";
  const redacted = redactSecrets(`${githubToken} ${apiKey} ${tavilyKey} Bearer abc.def`);

  assert.equal(redacted.includes("github_pat_"), false);
  assert.equal(redacted.includes("sk-abcdef"), false);
  assert.equal(redacted.includes("tvly-" + "dev"), false);
  assert.match(redacted, /REDACTED/);
});

test("runRecordedCommand writes command artifacts", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "agent-test-command-"));
  const result = await runRecordedCommand({
    name: "node-ok",
    cwd: process.cwd(),
    outputDir,
    command: process.execPath,
    args: ["-e", "console.log('ok')"],
    env: { AGENT_TEST_SAMPLE: "1" },
    timeoutMs: 10000
  });

  assert.equal(result.artifact.exitCode, 0);
  assert.match(result.artifact.stdout, /ok/);
  assert.deepEqual(result.artifact.env, ["AGENT_TEST_SAMPLE"]);
  assert.match(result.jsonPath, /node-ok\.json$/);
});
