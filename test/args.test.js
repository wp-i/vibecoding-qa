import test from "node:test";
import assert from "node:assert/strict";
import { parseRunArgs, parseScanArgs } from "../src/core/args.js";

test("parseRunArgs parses command after separator", () => {
  const parsed = parseRunArgs(["--target", ".", "--name", "version", "--env", "RUN_LIVE_EVAL=1", "--", "node", "--version"]);

  assert.equal(parsed.name, "version");
  assert.equal(parsed.command, "node");
  assert.deepEqual(parsed.args, ["--version"]);
  assert.deepEqual(parsed.env, { RUN_LIVE_EVAL: "1" });
});

test("parseRunArgs rejects invalid env values", () => {
  assert.throws(
    () => parseRunArgs(["--env", "RUN_LIVE_EVAL", "--", "node", "--version"]),
    /--env requires KEY=VALUE/
  );
});

test("parseRunArgs rejects invalid timeout", () => {
  assert.throws(
    () => parseRunArgs(["--timeout-ms", "0", "--", "node", "--version"]),
    /--timeout-ms must be a positive integer/
  );
});

test("parseScanArgs applies max file override", async () => {
  const parsed = await parseScanArgs(["--target", ".", "--out", "reports/test", "--max-files", "12"]);

  assert.equal(parsed.target, ".");
  assert.equal(parsed.config.mode.maxFiles, 12);
  assert.match(parsed.outputDir, /reports[\\/]test$/);
});

test("parseScanArgs accepts ignored secret paths", async () => {
  const parsed = await parseScanArgs([
    "--target",
    ".",
    "--out",
    "reports/test",
    "--ignore-secret-path",
    "config/user_keys.env"
  ]);

  assert.deepEqual(parsed.config.security.ignoreSecretPaths, ["config/user_keys.env"]);
});

test("parseScanArgs accepts ignored project paths", async () => {
  const parsed = await parseScanArgs([
    "--target",
    ".",
    "--out",
    "reports/test",
    "--ignore-path",
    "docs/showcase"
  ]);

  assert.deepEqual(parsed.config.project.ignorePaths, ["docs/showcase"]);
});

test("parseScanArgs accepts fail-on-check-failures", async () => {
  const parsed = await parseScanArgs(["--target", ".", "--out", "reports/test", "--fail-on-check-failures"]);

  assert.equal(parsed.config.report.failOnCheckFailures, true);
});
