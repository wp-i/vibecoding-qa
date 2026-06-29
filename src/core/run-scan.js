import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createProjectWorkspace } from "./workspace.js";
import { inspectProject } from "../analyzers/project-inspector.js";
import { extractRequirements } from "../analyzers/requirements.js";
import { scanAiProjectDefects } from "../analyzers/ai-defects.js";
import { scanSecrets } from "../analyzers/secrets.js";
import { scanOverfitRisks } from "../analyzers/overfit.js";
import { analyzeUserVisibleReportsFromArtifacts } from "../analyzers/user-report-quality.js";
import { runBasicProfile } from "../profiles/basic.js";
import { renderFunctionalAcceptanceReport } from "../reports/functional-acceptance.js";
import { validateReport } from "../reports/validate.js";

export async function runScan(options) {
  const startedAt = new Date();
  const usage = createUsageSummary(options.config);
  const commandArtifacts = await loadCommandArtifacts(options.outputDir);
  const workspace = await createProjectWorkspace(options.target);
  const project = await inspectProject(workspace.path, {
    maxFiles: options.config?.mode?.maxFiles,
    ignorePaths: options.config?.project?.ignorePaths ?? []
  });
  const requirements = await extractRequirements(project.markdownFiles);
  const security = {
    secrets: await scanSecrets(project, {
      ignorePaths: options.config?.security?.ignoreSecretPaths ?? []
    })
  };
  const quality = {
    overfit: await scanOverfitRisks(project),
    aiDefects: await scanAiProjectDefects(project),
    userReports: analyzeUserVisibleReportsFromArtifacts(commandArtifacts)
  };
  const checks = runBasicProfile({ project, requirements, security, quality });
  const finishedAt = new Date();

  const report = {
    schemaVersion: "0.1.0",
    mode: options.mode,
    target: options.target,
    workspace,
    project,
    assessmentFocus: {
      primary: "requirement-conformance",
      weights: {
        requirementConformance: 90,
        obviousRisk: 10
      },
      deEmphasized: [
        "code elegance",
        "structure clarity",
        "deep security review",
        "deep robustness review"
      ]
    },
    requirements,
    security,
    quality,
    checks,
    execution: {
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      commandArtifacts,
      usage
    },
    boundaries: [
      "MVP basic mode does not install dependencies or execute target project code.",
      "GitHub targets are cloned for static analysis only.",
      "Requirement extraction is heuristic and requires human review.",
      "The assessment is requirement-first for vibeCoding projects: functional conformance dominates, while style, architecture, deep security and deep robustness are intentionally de-emphasized."
    ]
  };

  validateReport(report);

  await mkdir(options.outputDir, { recursive: true });
  const reportPath = join(options.outputDir, "AGENT_TEST_QA_REPORT.md");
  const jsonPath = join(options.outputDir, "report.json");

  await removeLegacyMarkdownReports(options.outputDir);
  await writeFile(reportPath, renderFunctionalAcceptanceReport(report), "utf8");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return {
    report,
    reportPath,
    functionalReportPath: reportPath,
    primaryMarkdownPath: reportPath,
    jsonPath
  };
}

export function createUsageSummary(config = {}) {
  const llmMode = config.mode?.llm ?? "no-llm";
  if (llmMode !== "no-llm") {
    throw new Error(
      `Unsupported LLM mode '${llmMode}'. Current basic scans do not call LLM APIs; token-spending modes must implement explicit preflight estimates and actual usage reporting first.`
    );
  }

  return {
    apiKeyRequired: false,
    apiKeys: [],
    llmMode,
    preflight: {
      estimatedInputTokens: 0,
      estimatedOutputTokens: 0,
      estimatedTotalTokens: 0,
      estimatedCostUsd: 0,
      maxCostUsd: config.mode?.maxCostUsd ?? 0,
      confidence: "exact",
      notes: [
        "basic mode is deterministic and does not call LLM or paid external APIs"
      ]
    },
    actual: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      notes: [
        "no LLM/API token usage was recorded"
      ]
    }
  };
}

async function removeLegacyMarkdownReports(outputDir) {
  await Promise.all([
    rm(join(outputDir, "report.md"), { force: true }),
    rm(join(outputDir, "functional-acceptance-report.md"), { force: true })
  ]);
}

async function loadCommandArtifacts(outputDir) {
  const runtimeDir = join(outputDir, "runtime");
  let entries;
  try {
    entries = await readdir(runtimeDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const artifacts = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const path = join(runtimeDir, entry.name);
    try {
      const fileStat = await stat(path);
      const artifact = JSON.parse(await readFile(path, "utf8"));
      if (!isRecordedCommandArtifact(artifact)) continue;
      const recordedAt = artifact.finishedAt ?? artifact.recordedAt ?? fileStat.mtime.toISOString();
      artifacts.push({
        name: artifact.name,
        command: artifact.command,
        cwd: artifact.cwd,
        exitCode: artifact.exitCode,
        timedOut: artifact.timedOut,
        durationMs: artifact.durationMs,
        summary: summarizeCommandOutput(artifact),
        outputExcerpt: summarizeOutputExcerpt(artifact),
        userVisibleText: extractUserVisibleText(artifact),
        userJourney: extractUserJourney(artifact),
        artifactConsumptionReview: extractArtifactConsumptionReview(artifact),
        recordedAt,
        recordedAtSource: artifact.finishedAt ? "artifact.finishedAt" : artifact.recordedAt ? "artifact.recordedAt" : "file-mtime",
        path
      });
    } catch {
      artifacts.push({
        name: entry.name,
        command: [],
        cwd: "",
        exitCode: null,
        timedOut: null,
        durationMs: null,
        path,
        unreadable: true
      });
    }
  }

  return artifacts.sort((left, right) => String(left.name).localeCompare(String(right.name)));
}

function isRecordedCommandArtifact(artifact) {
  return artifact
    && typeof artifact.name === "string"
    && Array.isArray(artifact.command)
    && Object.hasOwn(artifact, "exitCode")
    && Object.hasOwn(artifact, "timedOut");
}

function summarizeCommandOutput(artifact) {
  const text = `${artifact.stdout ?? ""}\n${artifact.stderr ?? ""}`;
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const summary = [...lines]
    .reverse()
    .find((line) => /\b(?:passed|failed|skipped|error|errors|xfailed|xpassed)\b/i.test(line));
  return summary ?? "";
}

function summarizeOutputExcerpt(artifact) {
  const text = `${artifact.stdout ?? ""}\n${artifact.stderr ?? ""}`;
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^=+$/.test(line));
  return lines.slice(0, 240);
}

function extractUserVisibleText(artifact) {
  const stdout = artifact.stdout ?? "";
  const parsed = parseJsonOrNull(stdout);
  if (parsed && typeof parsed === "object") {
    const text = collectLikelyUserText(parsed);
    if (text.trim()) return text.slice(0, 50000);
  }
  return stdout.slice(0, 50000);
}

function extractUserJourney(artifact) {
  const parsed = parseJsonOrNull(artifact.stdout ?? "");
  if (parsed && typeof parsed === "object" && parsed.userJourney && typeof parsed.userJourney === "object") {
    return parsed.userJourney;
  }
  return null;
}

function extractArtifactConsumptionReview(artifact) {
  const parsed = parseJsonOrNull(artifact.stdout ?? "");
  if (parsed && typeof parsed === "object" && Array.isArray(parsed.reviews)) {
    return parsed;
  }
  return null;
}

function parseJsonOrNull(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function collectLikelyUserText(value) {
  const fields = ["bodyText", "report", "markdown", "answer", "content", "output", "text"];
  const chunks = [];
  for (const field of fields) {
    if (typeof value?.[field] === "string") chunks.push(value[field]);
  }
  return chunks.join("\n");
}
