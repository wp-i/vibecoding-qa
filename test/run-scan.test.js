import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runScan } from "../src/core/run-scan.js";

test("runScan writes markdown and json reports for a local fixture", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-test-fixture-"));
  await mkdir(join(root, "docs"));
  await writeFile(join(root, "README.md"), "# Fixture\n\n- 支持基础扫描。\n", "utf8");
  await writeFile(join(root, "TEST_PROJECT_DIRECTION.md"), "# Direction\n\n- 必须生成报告。\n", "utf8");
  await writeFile(join(root, "docs", "PRE_DEVELOPMENT_CHECKLIST.md"), "# Checklist\n\n- [x] 测试入口。\n", "utf8");
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ scripts: { test: "node --test", "scan:self": "node cli.js" } }),
    "utf8"
  );

  const outputDir = join(root, "out");
  await mkdir(join(outputDir, "runtime"), { recursive: true });
  await writeFile(
    join(outputDir, "runtime", "pytest.json"),
    JSON.stringify({
      name: "pytest",
      command: ["python", "-m", "pytest"],
      cwd: root,
      exitCode: 0,
      timedOut: false,
      durationMs: 1234,
      stdout: "======================= 88 passed, 1 skipped in 10.82s ========================\n",
      stderr: ""
    }),
    "utf8"
  );
  await writeFile(
    join(outputDir, "runtime", "scenario-01-real-user-prompt.json"),
    JSON.stringify({
      name: "scenario-01-real-user-prompt",
      command: ["python", "-m", "github_deep_search", "user requirement"],
      cwd: root,
      exitCode: 0,
      timedOut: false,
      durationMs: 2000,
      stdout: [
        "# 调研结论",
        "已整理 1 个相邻方向，最接近的是 demo/project（11/100），目前更适合用来找灵感，不适合直接采用。",
        "核心能力「用户要求的功能」尚未确认。"
      ].join("\n"),
      stderr: ""
    }),
    "utf8"
  );
  const result = await runScan({
    target: root,
    outputDir,
    mode: "basic",
    config: { mode: { maxFiles: 1000 } }
  });

  assert.equal(result.report.checks.summary.failed, 0);
  assert.equal(result.report.project.projectType, "node");
  assert.equal(result.report.requirements.count > 0, true);

  const markdown = await readFile(join(outputDir, "AGENT_TEST_QA_REPORT.md"), "utf8");
  const json = JSON.parse(await readFile(join(outputDir, "report.json"), "utf8"));

  await assert.rejects(() => access(join(outputDir, "report.md")));
  await assert.rejects(() => access(join(outputDir, "functional-acceptance-report.md")));

  assert.equal(result.reportPath, join(outputDir, "AGENT_TEST_QA_REPORT.md"));
  assert.equal(result.functionalReportPath, result.reportPath);
  assert.equal(result.primaryMarkdownPath, result.reportPath);
  assert.match(markdown, /Functional Acceptance QA Report/);
  assert.match(markdown, /Scope And Method/);
  assert.match(markdown, /API Key And Token Cost/);
  assert.match(markdown, /API key required: no/);
  assert.match(markdown, /Actual token usage: input=0, output=0, total=0/);
  assert.match(markdown, /Runtime Evidence Artifacts/);
  assert.match(markdown, /Status: \*\*attempted-failed\*\*/);
  assert.match(markdown, /pytest: exitCode=0/);
  assert.match(markdown, /88 passed, 1 skipped/);
  assert.match(markdown, /Runtime Scenario Findings/);
  assert.match(markdown, /RS-1:/);
  assert.match(markdown, /returned only very weak decision support/);
  assert.match(markdown, /Evidence strength: runtime-observation/);
  assert.match(markdown, /Detailed Defects/);
  assert.equal(json.schemaVersion, "0.1.0");
  assert.equal(json.execution.commandArtifacts.length, 2);
  assert.equal(json.execution.usage.apiKeyRequired, false);
  assert.equal(json.execution.usage.preflight.estimatedTotalTokens, 0);
  assert.equal(json.execution.usage.preflight.estimatedCostUsd, 0);
  assert.equal(json.execution.usage.actual.totalTokens, 0);
  assert.equal(json.execution.usage.actual.costUsd, 0);
  assert.equal(json.assessmentFocus.primary, "requirement-conformance");
  assert.equal(json.assessmentFocus.weights.requirementConformance, 90);
  assert.equal(json.assessmentFocus.weights.obviousRisk, 10);
  assert.equal(json.checks.profile, "basic");
  assert.equal(json.security.secrets.count, 0);
  assert.equal(json.quality.overfit.count, 0);
  assert.equal(json.quality.aiDefects.count, 0);
  assert.equal(json.checks.items.every((item) => Array.isArray(item.evidence)), true);
  assert.equal(json.checks.items.every((item) => typeof item.category === "string"), true);
  assert.equal(json.checks.items.every((item) => typeof item.testKind === "string"), true);
  assert.equal(json.checks.items.every((item) => typeof item.conclusion === "string"), true);
});

test("runScan keeps empty-output branches as risk signals without false functional defects", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-test-defect-report-"));
  await mkdir(join(root, "docs"));
  await mkdir(join(root, "src"));
  await writeFile(join(root, "README.md"), "# Search App\n\n- 必须生成报告。\n", "utf8");
  await writeFile(
    join(root, "docs", "CURRENT_HANDOFF.md"),
    [
      "# Current Handoff",
      "",
      "- Final output always degrades to reliable matches, evidence-backed partial matches, then adjacent projects.",
      "- An empty result is allowed only when no runnable project or meaningful adjacent project survives verification."
    ].join("\n"),
    "utf8"
  );
  await writeFile(join(root, "requirements.txt"), "pytest\n", "utf8");
  await writeFile(join(root, "run_web.py"), "print('ok')\n", "utf8");
  await writeFile(
    join(root, "src", "engine.py"),
    [
      "def write_report(analyses):",
      "    lines = ['# 调研结论']",
      "    if not analyses:",
      "        lines.append('- 暂无。')",
      "    return '\\n'.join(lines)"
    ].join("\n"),
    "utf8"
  );

  const outputDir = join(root, "out");
  await runScan({
    target: root,
    outputDir,
    mode: "basic",
    config: { mode: { maxFiles: 1000 } }
  });

  const functionalMarkdown = await readFile(join(outputDir, "AGENT_TEST_QA_REPORT.md"), "utf8");
  const json = JSON.parse(await readFile(join(outputDir, "report.json"), "utf8"));

  assert.doesNotMatch(functionalMarkdown, /FA-1:/);
  assert.match(functionalMarkdown, /Requirement Traceability/);
  assert.match(functionalMarkdown, /Test Case Matrix/);
  assert.match(functionalMarkdown, /Defect List/);
  assert.match(functionalMarkdown, /No functional defects detected/);
  assert.match(functionalMarkdown, /Fix Verification Plan/);
  assert.match(functionalMarkdown, /Developer Handoff/);
  assert.equal(json.quality.aiDefects.count, 0);
  assert.equal(json.quality.aiDefects.signals.emptyCompletionRisk.length > 0, true);
});

test("runScan marks reports without runtime evidence as unverified for full functional flow", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-test-unverified-flow-"));
  await writeFile(join(root, "README.md"), "# CLI Tool\n\n- 必须处理用户输入并输出结果。\n", "utf8");
  await writeFile(join(root, "requirements.txt"), "pytest\n", "utf8");
  await writeFile(join(root, "main.py"), "print('ok')\n", "utf8");
  await mkdir(join(root, "tests"));
  await writeFile(join(root, "tests", "test_smoke.py"), "def test_smoke():\n    assert True\n", "utf8");

  const outputDir = join(root, "out");
  await runScan({
    target: root,
    outputDir,
    mode: "basic",
    config: { mode: { maxFiles: 1000 } }
  });

  const markdown = await readFile(join(outputDir, "AGENT_TEST_QA_REPORT.md"), "utf8");

  assert.match(markdown, /Result: \*\*UNVERIFIED\*\*/);
  assert.match(markdown, /Full Functional Flow Verification/);
  assert.match(markdown, /Status: \*\*not-run\*\*/);
  assert.match(markdown, /No runtime command artifact was attached/);
});

test("runScan marks lightweight runtime-only evidence as partial full functional flow", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-test-partial-flow-"));
  await writeFile(join(root, "README.md"), "# CLI Tool\n\n- 必须处理用户输入并输出结果。\n", "utf8");
  await writeFile(join(root, "requirements.txt"), "pytest\n", "utf8");
  await writeFile(join(root, "main.py"), "print('ok')\n", "utf8");
  await mkdir(join(root, "tests"));
  await writeFile(join(root, "tests", "test_smoke.py"), "def test_smoke():\n    assert True\n", "utf8");

  const outputDir = join(root, "out");
  await mkdir(join(outputDir, "runtime"), { recursive: true });
  await writeFile(
    join(outputDir, "runtime", "cli-help.json"),
    JSON.stringify({
      name: "cli-help",
      command: ["python", "main.py", "--help"],
      cwd: root,
      exitCode: 0,
      timedOut: false,
      durationMs: 100,
      stdout: "usage: main.py\n",
      stderr: ""
    }),
    "utf8"
  );

  await runScan({
    target: root,
    outputDir,
    mode: "basic",
    config: { mode: { maxFiles: 1000 } }
  });

  const markdown = await readFile(join(outputDir, "AGENT_TEST_QA_REPORT.md"), "utf8");

  assert.match(markdown, /Result: \*\*PARTIAL\*\*/);
  assert.match(markdown, /Status: \*\*partial-runtime-only\*\*/);
  assert.match(markdown, /lightweight runtime commands were recorded/);
});
