import { readFile } from "node:fs/promises";
import { join } from "node:path";

const SOURCE_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".html", ".vue", ".svelte"]);
const DOC_EXTENSIONS = new Set([".md", ".markdown", ".txt"]);
const MAX_READ_BYTES = 240_000;

const ADJACENT_CONTRACT_PATTERNS = [
  /找不到.*(?:完全|直接).*(?:相似|匹配|使用).*?(?:相邻|参考|线索|相对相似)/i,
  /(?:没有|未找到).*(?:完全|直接).*(?:相似|匹配|使用).*?(?:相邻|参考|线索|相对相似)/i,
  /(?:相邻|相对相似|参考).*(?:项目|候选|线索).*(?:返回|保留|提供|补充|整理)/i,
  /empty result.*allowed only/i,
  /reference[- ]candidate fallback/i,
  /adjacent project/i
];

const EMPTY_COMPLETION_PATTERNS = [
  /暂无/,
  /未找到足够相关/,
  /没有留下可核对/,
  /没有找到公开内容能够确认/,
  /no (?:results|candidates|leads)/i,
  /empty (?:report|result|results)/i
];

const COMPLETION_CONTEXT_PATTERNS = [
  /完成/,
  /报告/,
  /调研/,
  /结论/,
  /summary/i,
  /report/i,
  /result/i,
  /not\s+\w+/i,
  /if\s*\(?!?/i
];

export async function scanAiProjectDefects(project) {
  const docs = await readProjectFiles(project, (file) => DOC_EXTENSIONS.has(file.extension));
  const sources = await readProjectFiles(project, (file) => SOURCE_EXTENSIONS.has(file.extension));
  const adjacentContractEvidence = findAdjacentContractEvidence(docs);
  const emptyCompletionEvidence = findEmptyCompletionEvidence(sources);
  const omittedFallbackContextEvidence = findOmittedFallbackContextEvidence(sources);
  const findings = [];

  if (adjacentContractEvidence.length > 0 && omittedFallbackContextEvidence.length > 0) {
    findings.push({
      id: "ai-adjacent-fallback-context-may-be-dropped",
      title: "Adjacent fallback appears to depend on requirement context that is not always passed",
      severity: "Major",
      category: "requirement-conformance",
      kind: "fallback-context-loss",
      impact: "A low-confidence but relevant candidate can be filtered out before it becomes an adjacent reference.",
      expected: "Fallback selection should receive the user requirement or equivalent contract context whenever it evaluates adjacent relevance.",
      evidence: omittedFallbackContextEvidence.slice(0, 5)
    });
  }

  return {
    count: findings.length,
    findings,
    signals: {
      adjacentContract: adjacentContractEvidence,
      emptyCompletion: emptyCompletionEvidence,
      emptyCompletionRisk: adjacentContractEvidence.length > 0 && emptyCompletionEvidence.length > 0
        ? [
          ...adjacentContractEvidence.slice(0, 3),
          ...emptyCompletionEvidence.slice(0, 5)
        ]
        : [],
      omittedFallbackContext: omittedFallbackContextEvidence
    }
  };
}

async function readProjectFiles(project, predicate) {
  const files = [];

  for (const file of project.files) {
    if (!predicate(file) || file.size > MAX_READ_BYTES) continue;
    const absolutePath = join(file.root ?? project.root, file.path);
    try {
      files.push({
        ...file,
        content: await readFile(absolutePath, "utf8")
      });
    } catch {
      // Ignore unreadable files; the scan is a low-cost precheck.
    }
  }

  return files;
}

function findAdjacentContractEvidence(files) {
  return findLineEvidence(files, (line) => ADJACENT_CONTRACT_PATTERNS.some((pattern) => pattern.test(line)));
}

function findEmptyCompletionEvidence(files) {
  const evidence = [];

  for (const file of files) {
    const lines = file.content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!EMPTY_COMPLETION_PATTERNS.some((pattern) => pattern.test(line))) continue;
      const context = nearbyLines(lines, index, 4).join("\n");
      if (!COMPLETION_CONTEXT_PATTERNS.some((pattern) => pattern.test(context))) continue;
      evidence.push(`${file.path}:${index + 1} ${line.trim()}`);
    }
  }

  return evidence;
}

function findOmittedFallbackContextEvidence(files) {
  const evidence = [];

  for (const file of files) {
    if (!file.content.includes("_with_reference_candidates") || !file.content.includes("requirement")) continue;
    const lines = file.content.split(/\r?\n/);
    const hasContextAwareFallback = lines.some((line, index) => {
      if (!/def\s+_with_reference_candidates|function\s+_with_reference_candidates|_with_reference_candidates\s*\(/.test(line)) {
        return false;
      }
      return nearbyLines(lines, index, 12).some((nearby) => /requirement/.test(nearby));
    }) && file.content.includes("_analysis_has_adjacent_signal");

    if (!hasContextAwareFallback) continue;

    for (let index = 0; index < lines.length; index += 1) {
      if (!lines[index].includes("_with_reference_candidates(")) continue;
      const line = lines[index];
      if (/def\s+_with_reference_candidates/.test(line) || /function\s+_with_reference_candidates/.test(line)) continue;
      if (/requirement/.test(line)) continue;
      evidence.push(`${file.path}:${index + 1} ${lines[index].trim()}`);
    }
  }

  return evidence;
}

function findLineEvidence(files, predicate) {
  const evidence = [];

  for (const file of files) {
    const lines = file.content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index].trim();
      if (!line || !predicate(line)) continue;
      evidence.push(`${file.path}:${index + 1} ${line}`);
    }
  }

  return evidence;
}

function nearbyLines(lines, index, radius) {
  const start = Math.max(0, index - radius);
  const end = Math.min(lines.length, index + radius + 1);
  return lines.slice(start, end);
}
