import { readFile } from "node:fs/promises";
import { join } from "node:path";

const SOURCE_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".py", ".go", ".rs", ".java"]);
const TEST_OR_DOC_PREFIXES = ["test/", "tests/", "spec/", "docs/"];
const MAX_FILE_BYTES = 400_000;
const MAX_FINDINGS = 30;

export async function scanOverfitRisks(project) {
  const phrases = await collectFixturePhrases(project);
  const findings = [];

  for (const file of project.files) {
    if (!isCoreSource(file) || file.size > MAX_FILE_BYTES) continue;

    let content = "";
    try {
      content = await readFile(join(project.root, file.path), "utf8");
    } catch {
      continue;
    }

    const lowered = content.toLowerCase();
    findings.push(...scanSemanticTables(file, content));
    if (findings.length >= MAX_FINDINGS) {
      return toResult(findings.slice(0, MAX_FINDINGS), phrases.length);
    }

    for (const phrase of phrases) {
      if (lowered.includes(phrase.normalized)) {
        if (isUiContractPhraseReuse(file, phrase)) continue;
        findings.push({
          phrase: phrase.text,
          path: file.path,
          source: phrase.source,
          reason: "Fixture/document phrase appears in core source."
        });
        if (findings.length >= MAX_FINDINGS) {
          return toResult(findings, phrases.length);
        }
      }
    }
  }

  return toResult(findings, phrases.length);
}

async function collectFixturePhrases(project) {
  const phrases = new Map();

  for (const file of project.files) {
    if (!isFixtureOrDoc(file) || file.size > MAX_FILE_BYTES) continue;

    let content = "";
    try {
      content = await readFile(join(project.root, file.path), "utf8");
    } catch {
      continue;
    }

    for (const text of extractQuotedStrings(content)) {
      const phrase = normalizePhrase(text);
      if (!phrase) continue;
      const key = phrase.toLowerCase();
      if (!phrases.has(key)) {
        phrases.set(key, {
          text: phrase,
          normalized: key,
          source: file.path
        });
      }
    }
  }

  return [...phrases.values()];
}

function extractQuotedStrings(content) {
  const values = [];
  for (const line of content.split(/\r?\n/)) {
    if (isAssertionOrImportLine(line)) continue;
    if (isOutputTextFixtureLine(line)) continue;

    for (const pattern of [
      /"([^"\r\n]{4,200})"/g,
      /'([^'\r\n]{4,200})'/g,
      /`([^`\r\n]{4,200})`/g
    ]) {
      let match = pattern.exec(line);
      while (match) {
        values.push(match[1]);
        match = pattern.exec(line);
      }
    }
  }
  return values;
}

function scanSemanticTables(file, content) {
  if (!isSemanticCoreFile(file.path)) return [];

  const findings = [];
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(
      /^\s*(?:const|let|var)?\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?::[^=]+)?=\s*(?:\{|\[|dict\(|list\(|set\(|new\s+Map\()/
    );
    if (!match || !isSuspiciousSemanticName(match[1])) continue;

    const block = collectBlock(lines, index);
    if (isSchemaConceptExtraction(match[1], block)) continue;
    const terms = extractQuotedStrings(block).filter((value) => looksLikeDomainToken(value));
    if (terms.length < 3) continue;

    findings.push({
      phrase: `${match[1]} (${terms.length} semantic terms)`,
      path: file.path,
      source: file.path,
      reason: "Suspicious semantic keyword table appears in core source."
    });
  }

  return findings;
}

function collectBlock(lines, startIndex) {
  const collected = [];
  let depth = 0;
  for (let index = startIndex; index < Math.min(lines.length, startIndex + 80); index += 1) {
    const line = lines[index];
    collected.push(line);
    depth += countChars(line, "{") + countChars(line, "[") + countChars(line, "(");
    depth -= countChars(line, "}") + countChars(line, "]") + countChars(line, ")");
    if (index > startIndex && depth <= 0) break;
  }
  return collected.join("\n");
}

function countChars(value, char) {
  return [...value].filter((item) => item === char).length;
}

function normalizePhrase(value) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length < 4 || text.length > 80) return null;
  if (isGenericReportTemplatePhrase(text)) return null;
  if (!looksLikeRequirementPhrase(text)) return null;
  if (isLicenseOrPolicyPhrase(text)) return null;
  if (/^[./\\\w-]+$/.test(text)) return null;
  if (/^[\w@.-]+:[\w/.-]+$/.test(text)) return null;
  if (/^(http|https):\/\//i.test(text)) return null;
  if (/^\d+$/.test(text)) return null;
  if (/[a-z][A-Z]/.test(text)) return null;
  if (/[{};=<>]/.test(text)) return null;
  return text;
}

function isGenericReportTemplatePhrase(text) {
  if (/^#{1,6}\s+\S/.test(text)) return true;
  return /^(?:调研结论|一句话判断|已整理的线索|下一步|暂无|完整调研|报告摘要|测试结论|修复建议|Report Summary|Next Steps|Findings|Conclusion)$/i.test(text);
}

function isSchemaConceptExtraction(name, block) {
  return /^(domains|actions|objects|outputs|features|targets)$/i.test(name)
    && /\b(?:concepts|feature_concepts|requirement)\.get\(/.test(block);
}

function isLicenseOrPolicyPhrase(text) {
  return /\b(?:license|licence|copyright|trademark|terms of service|privacy policy)\b/i.test(text);
}

function isUiContractPhraseReuse(file, phrase) {
  return isUiContractDoc(phrase.source) && isUiImplementationFile(file.path);
}

function isUiContractDoc(path) {
  const lower = String(path ?? "").toLowerCase();
  return lower.startsWith("docs/")
    && /(?:ui|ux|frontend|front-end|web|redesign|design|handoff)/i.test(lower);
}

function isUiImplementationFile(path) {
  const lower = String(path ?? "").toLowerCase();
  if (/(?:^|\/)server\.[cm]?[jt]s$/.test(lower)) return false;
  return /(?:^|\/)(?:ui|client|frontend|front-end|web|static|public|assets)\//.test(lower)
    && /\.(?:[cm]?[jt]sx?|html|css)$/.test(lower);
}

function looksLikeRequirementPhrase(text) {
  const cjkChars = text.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  if (cjkChars >= 4) return true;

  const words = text.split(/\s+/).filter((word) => /[a-z]/i.test(word));
  return words.length >= 3;
}

function looksLikeDomainToken(value) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length < 3 || text.length > 60) return false;
  if (/^[A-Z0-9_]+$/.test(text)) return false;
  if (/^[a-z0-9_.-]+:[a-z0-9/_.-]+$/i.test(text)) return false;
  if (/^[./\\]/.test(text)) return false;
  if (/[\u3400-\u9fff]{2,}/.test(text)) return true;
  if (/^[a-z][a-z -]{2,}$/i.test(text) && !text.includes("_")) return true;
  return false;
}

function isSemanticCoreFile(path) {
  return /(parser|parse|search|rank|score|filter|evidence|recommend|route|classif|match)/i.test(path);
}

function isSuspiciousSemanticName(name) {
  return /(alias|aliases|synonym|keyword|keywords|lexicon|vocab|stopword|blacklist|whitelist|domain|business|fixture|feature)/i.test(
    name
  );
}

function isAssertionOrImportLine(line) {
  const trimmed = line.trim();
  if (/^import\s/.test(trimmed)) return true;
  if (/^assert\b/.test(trimmed)) return true;
  if (/\bassert\./.test(trimmed)) return true;
  return false;
}

function isOutputTextFixtureLine(line) {
  const trimmed = line.trim();
  return /(?:\.|\b)(reference_reason|recommendation|summary|message|label|title|heading|status|text|description)\b\s*[:=]/i.test(
    trimmed
  );
}

function isFixtureOrDoc(file) {
  const lower = file.path.toLowerCase();
  if (/^scripts\/probes\/.*selftest.*\.[cm]?[jt]s$/.test(lower)) return true;
  return TEST_OR_DOC_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

function isCoreSource(file) {
  const lower = file.path.toLowerCase();
  if (!SOURCE_EXTENSIONS.has(file.extension)) return false;
  if (isFixtureOrDoc(file)) return false;
  if (/^src\/analyzers\/(?:ai-defects|overfit|secrets|user-report-quality)\.js$/.test(lower)) return false;
  if (lower.includes("__pycache__") || lower.includes("node_modules")) return false;
  return true;
}

function toResult(findings, phraseCount) {
  return {
    count: findings.length,
    phraseCount,
    findings
  };
}
