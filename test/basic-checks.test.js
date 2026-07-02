import test from "node:test";
import assert from "node:assert/strict";
import { runBasicChecks } from "../src/core/basic-checks.js";

function quality(overrides = {}) {
  return {
    overfit: { count: 0, phraseCount: 0, findings: [] },
    acceptanceContract: {
      acceptanceRules: [{ id: "rule", title: "Rule" }]
    },
    ...overrides
  };
}

test("basic checks summarize pass and fail states", () => {
  const checks = runBasicChecks({
    project: {
      docs: [{ name: "README.md" }],
      files: [
        { path: "README.md" },
        { path: "package.json" },
        { path: "test/example.test.js" },
        { path: ".env.example" }
      ],
      projectType: "node",
      packageJson: { scripts: { test: "node --test" } }
    },
    requirements: { items: [{ id: "README.md:1" }] },
    security: { secrets: { count: 0, findings: [] } },
    quality: quality()
  });

  assert.equal(checks.summary.total, 12);
  assert.equal(checks.summary.passed, 12);
  assert.equal(checks.summary.failed, 0);
  assert.equal(checks.profile, "acceptance");
  assert.equal(checks.items[0].severity, "Major");
  assert.equal(checks.items[0].category, "requirement-conformance");
  assert.equal(checks.items[0].testKind, "deterministic");
  assert.equal(checks.items[0].conclusion, "risk");
  assert.deepEqual(checks.items[0].evidence, ["Expected README.md at project root."]);

  const testEntrypointCheck = checks.items.find((item) => item.id === "test-entrypoint-present");
  assert.equal(testEntrypointCheck.severity, "Info");
  assert.equal(testEntrypointCheck.category, "supporting-signal");
});

test("basic checks use Python project expectations", () => {
  const checks = runBasicChecks({
    project: {
      docs: [{ name: "README.md" }],
      files: [
        { path: "README.md" },
        { path: "requirements.txt" },
        { path: "run_web.py" },
        { path: ".env.example" }
      ],
      projectType: "python",
      packageJson: null
    },
    requirements: { items: [{ id: "README.md:1" }] },
    security: { secrets: { count: 0, findings: [] } },
    quality: quality()
  });

  assert.equal(checks.items.some((item) => item.id === "python-dependency-manifest-present"), true);
  assert.equal(checks.items.some((item) => item.id === "node-package-manifest-present"), false);
  assert.equal(checks.summary.failed, 1);
});

test("basic checks recognize conventional Python script entrypoints", () => {
  const checks = runBasicChecks({
    project: {
      docs: [{ name: "README.md" }],
      files: [
        { path: "README.md" },
        { path: "requirements.txt" },
        { path: "main.py" },
        { path: "app.py" },
        { path: "server.py" },
        { path: "tests/test_smoke.py" }
      ],
      projectType: "python",
      packageJson: null
    },
    requirements: { items: [{ id: "README.md:1" }] },
    security: { secrets: { count: 0, findings: [] } },
    quality: quality()
  });

  const entrypointCheck = checks.items.find((item) => item.id === "python-entrypoint-present");
  const testEntrypointCheck = checks.items.find((item) => item.id === "test-entrypoint-present");

  assert.equal(entrypointCheck.status, "passed");
  assert.equal(testEntrypointCheck.status, "passed");
  assert.equal(checks.summary.failed, 0);
});

test("basic checks fail when obvious secrets are present", () => {
  const checks = runBasicChecks({
    project: {
      docs: [{ name: "README.md" }],
      files: [
        { path: "README.md" },
        { path: "requirements.txt" },
        { path: "run_web.py" }
      ],
      projectType: "python",
      packageJson: null
    },
    requirements: { items: [{ id: "README.md:1" }] },
    security: {
      secrets: {
        count: 1,
        findings: [{ kind: "github-token", path: "config/user_keys.env", line: 3 }]
      }
    },
    quality: { overfit: { count: 0, phraseCount: 0, findings: [] } }
  });

  const secretCheck = checks.items.find((item) => item.id === "no-obvious-secrets");
  assert.equal(secretCheck.status, "failed");
  assert.equal(secretCheck.severity, "Critical");
  assert.equal(secretCheck.category, "obvious-risk");
  assert.equal(secretCheck.conclusion, "failure");
});

test("basic checks fail when core code appears to reuse fixture phrases", () => {
  const checks = runBasicChecks({
    project: {
      docs: [{ name: "README.md" }],
      files: [
        { path: "README.md" },
        { path: "package.json" },
        { path: "test/example.test.js" }
      ],
      projectType: "node",
      packageJson: { scripts: { test: "node --test" } }
    },
    requirements: { items: [{ id: "README.md:1" }] },
    security: { secrets: { count: 0, findings: [] } },
    quality: {
      overfit: {
        count: 1,
        phraseCount: 3,
        findings: [{ phrase: "deadline widget", path: "src/engine.js", source: "tests/test_engine.js" }]
      }
    }
  });

  const overfitCheck = checks.items.find((item) => item.id === "no-obvious-fixture-overfit");
  assert.equal(overfitCheck.status, "failed");
  assert.equal(overfitCheck.conclusion, "failure");
});

test("basic checks fail on AI completed-empty-output defects", () => {
  const checks = runBasicChecks({
    project: {
      docs: [{ name: "README.md" }],
      files: [
        { path: "README.md" },
        { path: "package.json" },
        { path: "test/example.test.js" }
      ],
      projectType: "node",
      packageJson: { scripts: { test: "node --test" } }
    },
    requirements: { items: [{ id: "README.md:1" }] },
    security: { secrets: { count: 0, findings: [] } },
    quality: {
      overfit: { count: 0, phraseCount: 0, findings: [] },
      aiDefects: {
        count: 1,
        findings: [
          {
            title: "Completion report can become blank despite adjacent-reference contract",
            impact: "A user receives no usable lead.",
            expected: "Return adjacent references.",
            evidence: ["docs/handoff.md:1 contract", "src/engine.py:10 暂无"]
          }
        ]
      }
    }
  });

  const defectCheck = checks.items.find((item) => item.id === "no-ai-empty-completed-output-defects");
  assert.equal(defectCheck.status, "failed");
  assert.equal(defectCheck.severity, "Critical");
  assert.equal(defectCheck.category, "requirement-conformance");
  assert.equal(defectCheck.conclusion, "failure");
});

test("basic checks do not fail on empty-output branch risk signals alone", () => {
  const checks = runBasicChecks({
    project: {
      docs: [{ name: "README.md" }],
      files: [
        { path: "README.md" },
        { path: "package.json" },
        { path: "test/example.test.js" }
      ],
      projectType: "node",
      packageJson: { scripts: { test: "node --test" } }
    },
    requirements: { items: [{ id: "README.md:1" }] },
    security: { secrets: { count: 0, findings: [] } },
    quality: {
      overfit: { count: 0, phraseCount: 0, findings: [] },
      aiDefects: {
        count: 0,
        findings: [],
        signals: {
          emptyCompletionRisk: ["docs/handoff.md:1 contract", "src/engine.py:10 暂无"]
        }
      }
    }
  });

  const defectCheck = checks.items.find((item) => item.id === "no-ai-empty-completed-output-defects");
  assert.equal(defectCheck.status, "passed");
  assert.equal(defectCheck.conclusion, "risk");
  assert.match(defectCheck.evidence[0], /did not fail/);
});
