import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { inspectProject } from "../src/analyzers/project-inspector.js";
import { scanSecrets } from "../src/analyzers/secrets.js";

test("scanSecrets reports obvious tokens without exposing values", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-test-secret-"));
  const githubToken = "github_pat_" + "abc123_SECRET";
  const apiKey = "sk-" + "example-value-1234567890";
  await writeFile(join(root, "config.env"), `GITHUB_TOKEN=${githubToken}\n`, "utf8");
  await writeFile(join(root, "config.example.env"), `LLM_API_KEY=${apiKey}\n`, "utf8");

  const project = await inspectProject(root);
  const result = await scanSecrets(project);

  assert.equal(result.count, 1);
  assert.deepEqual(result.findings[0], {
    kind: "github-token",
    path: "config.env",
    line: 1
  });
});

test("scanSecrets records configured ignored secret paths separately", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-test-secret-"));
  const apiKey = "sk-" + "example-value-1234567890";
  await writeFile(join(root, "local.env"), `LLM_API_KEY=${apiKey}\n`, "utf8");

  const project = await inspectProject(root);
  const result = await scanSecrets(project, { ignorePaths: ["local.env"] });

  assert.equal(result.count, 0);
  assert.equal(result.ignoredCount, 1);
  assert.deepEqual(result.ignored[0], {
    kind: "openai-compatible-key",
    path: "local.env",
    line: 1,
    reason: "Matched configured ignoreSecretPaths policy."
  });
});

test("scanSecrets treats gitignored local key files as delivery risk instead of active finding", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-test-secret-"));
  const githubToken = "github_pat_" + "abc123_SECRET";
  await writeFile(join(root, ".gitignore"), "config/user_keys.env\n", "utf8");
  await mkdir(join(root, "config"), { recursive: true });
  await writeFile(join(root, "config", "user_keys.env"), `GITHUB_TOKEN=${githubToken}\n`, "utf8");

  const project = await inspectProject(root);
  const result = await scanSecrets(project);

  assert.equal(result.count, 0);
  assert.equal(result.ignoredCount, 1);
  assert.deepEqual(result.ignored[0], {
    kind: "github-token",
    path: "config/user_keys.env",
    line: 1,
    reason: "Matched .gitignore policy; local delivery risk only."
  });
});
