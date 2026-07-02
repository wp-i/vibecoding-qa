import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const execFileAsync = promisify(execFile);

process.env.AGENT_TEST_LLM_API_KEY = "test-key";
process.env.AGENT_TEST_LLM_MOCK_RESPONSE = JSON.stringify({
  projectType: "cli fixture",
  userFlows: ["Run the CLI"],
  userVisibleOutputs: ["QA report"],
  acceptanceRules: [
    {
      id: "cli-output-useful",
      title: "CLI output must be useful",
      rationale: "The project exposes a CLI scan command.",
      testMethod: "runtime",
      severity: "Major"
    }
  ],
  costRules: ["Token estimates and actual usage must be disclosed."]
});

test("CLI help prints usage", async () => {
  const { stdout } = await execFileAsync("node", ["./bin/agent-test.js", "--help"]);

  assert.match(stdout, /Usage:/);
  assert.match(stdout, /agent-test scan/);
  assert.match(stdout, /agent-test scan <path-or-github-url>/);
  assert.match(stdout, /LLM API key is required/);
});

test("CLI rejects unknown commands", async () => {
  await assert.rejects(
    () => execFileAsync("node", ["./bin/agent-test.js", "unknown"]),
    /Unknown command/
  );
});

test("CLI rejects invalid max file limits", async () => {
  await assert.rejects(
    () => execFileAsync("node", ["./bin/agent-test.js", "scan", "--max-files", "0"]),
    /--max-files must be a positive integer/
  );
});

test("CLI run requires a command separator", async () => {
  await assert.rejects(
    () => execFileAsync("node", ["./bin/agent-test.js", "run", "--target", "."]),
    /run requires -- followed by a command/
  );
});

test("CLI can fail when scan checks fail", async () => {
  const target = await mkdtemp(join(tmpdir(), "agent-test-cli-fail-"));
  const out = await mkdtemp(join(tmpdir(), "agent-test-cli-report-"));

  await assert.rejects(
    () =>
      execFileAsync("node", [
        "./bin/agent-test.js",
        "scan",
        "--target",
        target,
        "--out",
        out,
        "--fail-on-check-failures"
      ]),
    /Scan found \d+ failed check/
  );
});

test("CLI scan accepts positional target and prints token cost estimate", async () => {
  const target = await mkdtemp(join(tmpdir(), "agent-test-cli-positional-"));
  const out = await mkdtemp(join(tmpdir(), "agent-test-cli-positional-report-"));

  const { stdout } = await execFileAsync("node", [
    "./bin/agent-test.js",
    "scan",
    target,
    "--out",
    out
  ]);

  assert.match(stdout, /Preflight token\/cost estimate:/);
  assert.match(stdout, /API key required: yes/);
  assert.match(stdout, /Estimated cost: \$0/);
  assert.match(stdout, /Actual token\/cost usage:/);
  assert.match(stdout, /Cost: \$0/);
});
