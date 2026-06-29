import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const EXCLUDED_DIRS = new Set([
  ".git",
  ".venv",
  ".pytest_cache",
  "__pycache__",
  ".browser-profile",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "reports",
  ".next",
  ".turbo"
]);
const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown"]);
const GENERATED_REPORT_FILES = new Set([
  "AGENT_TEST_QA_REPORT.md",
  "report.json",
  "functional-acceptance-report.md",
  "report.md"
]);

export async function inspectProject(root, options = {}) {
  const maxFiles = options.maxFiles ?? 1000;
  const ignorePaths = options.ignorePaths ?? [];
  const files = await walk(root, root, { maxFiles, ignorePaths, count: 0, truncated: false });
  const markdownFiles = files.filter((file) => MARKDOWN_EXTENSIONS.has(extname(file.path).toLowerCase()));
  const docs = markdownFiles.filter((file) => isDocFile(file.path));
  const packageJson = await readPackageJson(root, files);

  return {
    root,
    fileCount: files.length,
    scanLimit: {
      maxFiles,
      truncated: files.truncated ?? false,
      ignoredPaths: ignorePaths
    },
    files,
    latestModifiedAt: latestModifiedAt(files),
    docs,
    markdownFiles,
    packageJson,
    languages: detectLanguages(files),
    packageManager: detectPackageManager(files),
    projectType: detectProjectType({ files, packageJson })
  };
}

async function walk(root, current = root, state = { maxFiles: 1000, ignorePaths: [], count: 0, truncated: false }) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (state.count >= state.maxFiles) {
      state.truncated = true;
      break;
    }

    if (entry.isDirectory() && EXCLUDED_DIRS.has(entry.name)) continue;

    const absolutePath = join(current, entry.name);
    const projectPath = normalizePath(relative(root, absolutePath));

    if (isIgnoredPath(projectPath, state.ignorePaths)) continue;

    if (entry.isDirectory()) {
      files.push(...await walk(root, absolutePath, state));
      continue;
    }

    if (GENERATED_REPORT_FILES.has(entry.name)) continue;

    const info = await stat(absolutePath);
    state.count += 1;
    files.push({
      root,
      path: projectPath,
      name: entry.name,
      size: info.size,
      extension: extname(entry.name).toLowerCase(),
      modifiedAt: info.mtime.toISOString()
    });
  }

  const sorted = files.sort((a, b) => a.path.localeCompare(b.path));
  sorted.truncated = state.truncated;
  return sorted;
}

function latestModifiedAt(files) {
  const latest = files
    .map((file) => Date.parse(file.modifiedAt ?? ""))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a)[0];
  return latest ? new Date(latest).toISOString() : null;
}

async function readPackageJson(root, files) {
  if (!files.some((file) => file.path === "package.json")) return null;

  try {
    return JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  } catch (error) {
    return {
      parseError: error instanceof Error ? error.message : String(error)
    };
  }
}

function detectLanguages(files) {
  const languageByExtension = {
    ".js": "JavaScript",
    ".mjs": "JavaScript",
    ".cjs": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".jsx": "JavaScript",
    ".py": "Python",
    ".go": "Go",
    ".rs": "Rust",
    ".java": "Java",
    ".md": "Markdown"
  };

  const counts = new Map();

  for (const file of files) {
    const language = languageByExtension[file.extension];
    if (!language) continue;
    counts.set(language, (counts.get(language) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function detectPackageManager(files) {
  const paths = new Set(files.map((file) => file.path));
  if (paths.has("pnpm-lock.yaml")) return "pnpm";
  if (paths.has("yarn.lock")) return "yarn";
  if (paths.has("package-lock.json")) return "npm";
  if (paths.has("package.json")) return "npm";
  if (paths.has("poetry.lock")) return "poetry";
  if (paths.has("requirements.txt")) return "pip";
  return "unknown";
}

function detectProjectType({ files, packageJson }) {
  if (packageJson?.bin) return "cli";
  if (packageJson?.dependencies?.next || packageJson?.devDependencies?.next) return "web";
  if (packageJson?.dependencies?.react || packageJson?.dependencies?.vue) return "web";
  if (files.some((file) => file.path === "package.json")) return "node";
  if (files.some((file) => file.path === "pyproject.toml" || file.path === "requirements.txt")) return "python";
  return "unknown";
}

function isDocFile(path) {
  const lower = path.toLowerCase();
  return lower === "readme.md" || lower.startsWith("docs/") || lower.includes("direction");
}

function normalizePath(path) {
  return path.replaceAll("\\", "/");
}

function isIgnoredPath(path, ignorePaths) {
  const normalized = normalizePath(path);
  return ignorePaths.some((ignorePath) => {
    const ignored = normalizePath(ignorePath).replace(/^\.?\//, "").replace(/\/$/, "");
    return normalized === ignored || normalized.startsWith(`${ignored}/`);
  });
}
