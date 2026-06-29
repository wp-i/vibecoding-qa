import test from "node:test";
import assert from "node:assert/strict";
import { defaultConfig, mergeConfig } from "../src/core/config.js";

test("mergeConfig keeps defaults and applies overrides", () => {
  const config = mergeConfig(defaultConfig(), {
    project: { target: "../example" },
    mode: { name: "basic", maxFiles: 20 },
    security: { ignoreSecretPaths: ["local.env"] },
    report: { output: "tmp/report" }
  });

  assert.equal(config.project.target, "../example");
  assert.equal(config.project.type, "auto");
  assert.deepEqual(config.project.ignorePaths, []);
  assert.equal(config.mode.llm, "no-llm");
  assert.equal(config.mode.maxFiles, 20);
  assert.deepEqual(config.security.ignoreSecretPaths, ["local.env"]);
  assert.equal(config.report.output, "tmp/report");
  assert.deepEqual(config.report.formats, ["md", "json"]);
  assert.equal(config.report.failOnCheckFailures, false);
});

test("mergeConfig appends ignored secret paths", () => {
  const base = mergeConfig(defaultConfig(), {
    security: { ignoreSecretPaths: ["config/user_keys.env"] }
  });
  const config = mergeConfig(base, {
    security: { ignoreSecretPaths: ["local.env"] }
  });

  assert.deepEqual(config.security.ignoreSecretPaths, ["config/user_keys.env", "local.env"]);
});

test("mergeConfig appends ignored project paths", () => {
  const base = mergeConfig(defaultConfig(), {
    project: { ignorePaths: ["docs/showcase"] }
  });
  const config = mergeConfig(base, {
    project: { ignorePaths: ["tmp"] }
  });

  assert.deepEqual(config.project.ignorePaths, ["docs/showcase", "tmp"]);
});
