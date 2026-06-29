import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { inspectProject } from "../src/analyzers/project-inspector.js";
import { scanOverfitRisks } from "../src/analyzers/overfit.js";

test("scanOverfitRisks finds fixture phrases reused in core source", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-test-overfit-"));
  await mkdir(join(root, "tests"));
  await mkdir(join(root, "src"));
  await writeFile(join(root, "tests", "test_parser.py"), "query = 'deadline widget with rounded corners'\n", "utf8");
  await writeFile(join(root, "src", "engine.py"), "ALIASES = ['deadline widget with rounded corners']\n", "utf8");

  const project = await inspectProject(root);
  const result = await scanOverfitRisks(project);

  assert.equal(result.count, 1);
  assert.equal(result.findings[0].path, "src/engine.py");
});

test("scanOverfitRisks ignores phrases kept inside tests only", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-test-overfit-"));
  await mkdir(join(root, "tests"));
  await mkdir(join(root, "src"));
  await writeFile(join(root, "tests", "test_parser.py"), "query = 'deadline widget with rounded corners'\n", "utf8");
  await writeFile(join(root, "src", "engine.py"), "ALIASES = []\n", "utf8");

  const project = await inspectProject(root);
  const result = await scanOverfitRisks(project);

  assert.equal(result.count, 0);
});

test("scanOverfitRisks ignores expected output assertions", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-test-overfit-"));
  await mkdir(join(root, "tests"));
  await mkdir(join(root, "src"));
  await writeFile(join(root, "tests", "test_output.py"), 'assert "friendly empty state message" in output\n', "utf8");
  await writeFile(join(root, "src", "engine.py"), 'MESSAGE = "friendly empty state message"\n', "utf8");

  const project = await inspectProject(root);
  const result = await scanOverfitRisks(project);

  assert.equal(result.count, 0);
});

test("scanOverfitRisks ignores expected output field text", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-test-overfit-"));
  await mkdir(join(root, "tests"));
  await mkdir(join(root, "src"));
  await writeFile(join(root, "tests", "test_output.py"), 'result.reference_reason = "low confidence reference candidate"\n', "utf8");
  await writeFile(join(root, "src", "engine.py"), 'LABEL = "low confidence reference candidate"\n', "utf8");

  const project = await inspectProject(root);
  const result = await scanOverfitRisks(project);

  assert.equal(result.count, 0);
});

test("scanOverfitRisks ignores generic report template headings", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-test-overfit-"));
  await mkdir(join(root, "tests"));
  await mkdir(join(root, "src"));
  await writeFile(join(root, "tests", "test_report.py"), 'expected = "# 调研结论"\n', "utf8");
  await writeFile(join(root, "src", "engine.py"), 'HEADING = "# 调研结论"\n', "utf8");

  const project = await inspectProject(root);
  const result = await scanOverfitRisks(project);

  assert.equal(result.count, 0);
});

test("scanOverfitRisks still checks fixture input assignments", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-test-overfit-"));
  await mkdir(join(root, "tests"));
  await mkdir(join(root, "src"));
  await writeFile(join(root, "tests", "test_parser.py"), "query = 'deadline widget with rounded corners'\n", "utf8");
  await writeFile(join(root, "src", "engine.py"), "FALLBACK = 'deadline widget with rounded corners'\n", "utf8");

  const project = await inspectProject(root);
  const result = await scanOverfitRisks(project);

  assert.equal(result.count, 1);
});

test("scanOverfitRisks finds suspicious semantic tables in parser code", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-test-overfit-"));
  await mkdir(join(root, "src"));
  await writeFile(
    join(root, "src", "parser.py"),
    [
      "SYNONYM_ALIASES = {",
      "  'deadline': ['due date', '截止日期'],",
      "  'done': ['completed task'],",
      "}",
      ""
    ].join("\n"),
    "utf8"
  );

  const project = await inspectProject(root);
  const result = await scanOverfitRisks(project);

  assert.equal(result.count, 1);
  assert.match(result.findings[0].phrase, /SYNONYM_ALIASES/);
});

test("scanOverfitRisks ignores analyzer rule patterns in agent-test internals", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-test-overfit-"));
  await mkdir(join(root, "docs"));
  await mkdir(join(root, "src", "analyzers"), { recursive: true });
  await writeFile(join(root, "docs", "workflow.md"), "- 缺陷：未找到足够相关。\n", "utf8");
  await writeFile(
    join(root, "src", "analyzers", "ai-defects.js"),
    "const EMPTY_COMPLETION_PATTERNS = [/未找到足够相关/];\n",
    "utf8"
  );

  const project = await inspectProject(root);
  const result = await scanOverfitRisks(project);

  assert.equal(result.count, 0);
});

test("scanOverfitRisks ignores SearchSpec concept field extraction", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-test-overfit-"));
  await mkdir(join(root, "src"));
  await writeFile(
    join(root, "src", "search.py"),
    [
      "def planned_queries(requirement):",
      "    concepts = requirement.feature_concepts or {}",
      "    domains = [str(item).strip() for item in concepts.get('domains', []) if str(item).strip()]",
      "    targets = [str(item).strip() for item in [*concepts.get('objects', []), *concepts.get('actions', [])]]",
      "    return domains + targets",
      ""
    ].join("\n"),
    "utf8"
  );

  const project = await inspectProject(root);
  const result = await scanOverfitRisks(project);

  assert.equal(result.count, 0);
});

test("scanOverfitRisks ignores license-policy strings shared by tests and source", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-test-overfit-"));
  await mkdir(join(root, "tests"));
  await mkdir(join(root, "src"));
  await writeFile(join(root, "tests", "test_license.py"), 'repo_license = "Sustainable Use License"\n', "utf8");
  await writeFile(join(root, "src", "engine.py"), 'restricted_markers = ["sustainable use license"]\n', "utf8");

  const project = await inspectProject(root);
  const result = await scanOverfitRisks(project);

  assert.equal(result.count, 0);
});

test("scanOverfitRisks treats selftest probes as fixture code", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-test-overfit-"));
  await mkdir(join(root, "test"));
  await mkdir(join(root, "scripts", "probes"), { recursive: true });
  await writeFile(join(root, "test", "browser.test.js"), 'const query = "analyze media evidence reports";\n', "utf8");
  await writeFile(
    join(root, "scripts", "probes", "vibecoding_ux_selftest.mjs"),
    'const query = "analyze media evidence reports";\n',
    "utf8"
  );

  const project = await inspectProject(root);
  const result = await scanOverfitRisks(project);

  assert.equal(result.count, 0);
});
