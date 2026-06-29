import { readFile } from "node:fs/promises";
import { join } from "node:path";

const MAX_SECRET_SCAN_BYTES = 512_000;

const SECRET_PATTERNS = [
  { kind: "github-token", pattern: /github_pat_[A-Za-z0-9_]+/g },
  { kind: "openai-compatible-key", pattern: /sk-[A-Za-z0-9_-]{16,}/g },
  { kind: "tavily-key", pattern: /tvly-[A-Za-z0-9_-]+/g }
];

export async function scanSecrets(project, options = {}) {
  const findings = [];
  const ignored = [];
  const ignorePaths = options.ignorePaths ?? [];
  const gitignorePatterns = await loadGitignorePatterns(project);

  for (const file of project.files) {
    if (file.size > MAX_SECRET_SCAN_BYTES) continue;
    if (isExampleFile(file.path)) continue;

    let content = "";
    try {
      content = await readFile(join(project.root, file.path), "utf8");
    } catch {
      continue;
    }

    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      for (const secretPattern of SECRET_PATTERNS) {
        if (secretPattern.pattern.test(lines[index])) {
          const finding = {
            kind: secretPattern.kind,
            path: file.path,
            line: index + 1
          };
          if (isIgnoredPath(file.path, ignorePaths)) {
            ignored.push({ ...finding, reason: "Matched configured ignoreSecretPaths policy." });
          } else if (isIgnoredByGitignore(file.path, gitignorePatterns)) {
            ignored.push({ ...finding, reason: "Matched .gitignore policy; local delivery risk only." });
          } else {
            findings.push(finding);
          }
        }
        secretPattern.pattern.lastIndex = 0;
      }
    }
  }

  return {
    findings,
    count: findings.length,
    ignored,
    ignoredCount: ignored.length
  };
}

async function loadGitignorePatterns(project) {
  try {
    const content = await readFile(join(project.root, ".gitignore"), "utf8");
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && !line.startsWith("!"));
  } catch {
    return [];
  }
}

function isExampleFile(path) {
  const lower = path.toLowerCase();
  return lower.includes("example") || lower.endsWith(".template") || lower.endsWith(".sample");
}

function isIgnoredPath(path, ignorePaths) {
  const normalized = normalizePath(path);
  return ignorePaths.some((ignorePath) => {
    const ignored = normalizePath(ignorePath);
    return normalized === ignored || normalized.startsWith(`${ignored}/`);
  });
}

function isIgnoredByGitignore(path, patterns) {
  const normalized = normalizePath(path);
  return patterns.some((pattern) => matchesGitignorePattern(normalized, normalizePath(pattern)));
}

function matchesGitignorePattern(path, pattern) {
  const directoryPattern = pattern.endsWith("/") ? pattern.slice(0, -1) : pattern;
  if (!directoryPattern) return false;
  if (directoryPattern.includes("*")) {
    const regex = new RegExp(`^${escapeRegex(directoryPattern).replaceAll("\\*", "[^/]*")}$`);
    return regex.test(path) || regex.test(path.split("/").at(-1) ?? "");
  }
  return path === directoryPattern
    || path.startsWith(`${directoryPattern}/`)
    || path.endsWith(`/${directoryPattern}`);
}

function escapeRegex(value) {
  return value.replace(/[|\\{}()[\]^$+?.*]/g, "\\$&");
}

function normalizePath(path) {
  return String(path).replace(/\\/g, "/").replace(/^\.?\//, "").toLowerCase();
}
