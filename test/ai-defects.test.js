import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { inspectProject } from "../src/analyzers/project-inspector.js";
import { scanAiProjectDefects } from "../src/analyzers/ai-defects.js";

test("scanAiProjectDefects records empty-output branches as risk signals instead of proven defects", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-test-ai-defect-"));
  await mkdir(join(root, "docs"));
  await mkdir(join(root, "src"));
  await writeFile(
    join(root, "docs", "handoff.md"),
    [
      "# Handoff",
      "",
      "- An empty result is allowed only when no runnable project or meaningful adjacent project survives verification.",
      "- If fewer than three reliable/reference projects survive, use relatively closest adjacent projects."
    ].join("\n"),
    "utf8"
  );
  await writeFile(
    join(root, "src", "engine.py"),
    [
      "def run(requirement, analyses, low_confidence, usage):",
      "    selected = self._with_reference_candidates(analyses, low_confidence, usage)",
      "    return self._write_report(selected)",
      "",
      "def _with_reference_candidates(self, reliable, low_confidence, usage, requirement=None):",
      "    return [item for item in low_confidence if self._analysis_has_adjacent_signal(item, requirement)]",
      "",
      "def _write_report(self, analyses):",
      "    lines = ['# 调研结论']",
      "    if not analyses:",
      "        lines.append('- 暂无。')",
      "    return '\\n'.join(lines)"
    ].join("\n"),
    "utf8"
  );

  const project = await inspectProject(root);
  const result = await scanAiProjectDefects(project);

  assert.equal(result.count, 1);
  assert.equal(result.signals.emptyCompletionRisk.length > 0, true);
  assert.equal(
    result.findings.some((finding) => finding.id === "ai-adjacent-fallback-context-may-be-dropped"),
    true
  );
});

test("scanAiProjectDefects does not fail on empty text without adjacent-reference contract", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-test-ai-no-defect-"));
  await mkdir(join(root, "src"));
  await writeFile(join(root, "README.md"), "# App\n\n- 支持生成报告。\n", "utf8");
  await writeFile(
    join(root, "src", "report.js"),
    "export function render(items) { return items.length ? 'done' : '暂无'; }\n",
    "utf8"
  );

  const project = await inspectProject(root);
  const result = await scanAiProjectDefects(project);

  assert.equal(result.count, 0);
});
