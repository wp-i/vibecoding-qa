import { runScan } from "./core/run-scan.js";
import { runRecordedCommand } from "./core/command-runner.js";
import { parseRunArgs, parseScanArgs } from "./core/args.js";
import { createUsageSummary } from "./core/run-scan.js";

export async function main(args) {
  const [command, ...rest] = args;

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "run") {
    const result = await parseRunArgs(rest);
    const artifact = await runRecordedCommand(result);
    console.log(`Command artifact written to ${artifact.textPath}`);
    console.log(`Command JSON written to ${artifact.jsonPath}`);
    return;
  }

  if (command !== "scan") {
    throw new Error(`Unknown command: ${command}`);
  }

  const options = await parseScanArgs(rest);
  const usageEstimate = createUsageSummary(options.config);
  printUsagePreflight(usageEstimate);

  const result = await runScan(options);

  console.log(`Developer/agent QA report written to ${result.primaryMarkdownPath ?? result.reportPath}`);
  console.log(`User QA summary written to ${result.userSummaryPath}`);
  console.log(`JSON written to ${result.jsonPath}`);
  printActualUsage(result.report.execution?.usage);

  if (options.config.report.failOnCheckFailures && result.report.checks.summary.failed > 0) {
    throw new Error(`Scan found ${result.report.checks.summary.failed} failed check(s)`);
  }
}

function printUsagePreflight(usage) {
  const preflight = usage.preflight ?? {};
  console.log("Preflight token/cost estimate:");
  console.log(`  API key required: ${usage.apiKeyRequired ? "yes" : "no"}`);
  console.log(`  Required API keys: ${usage.apiKeys?.length ? usage.apiKeys.join(", ") : "none"}`);
  console.log(`  LLM mode: ${usage.llmMode}`);
  console.log(`  Estimated tokens: input=${preflight.estimatedInputTokens ?? 0}, output=${preflight.estimatedOutputTokens ?? 0}, total=${preflight.estimatedTotalTokens ?? 0}`);
  console.log(`  Estimated cost: $${formatUsd(preflight.estimatedCostUsd)} (max configured: $${formatUsd(preflight.maxCostUsd)})`);
}

function printActualUsage(usage) {
  const actual = usage?.actual ?? {};
  console.log("Actual token/cost usage:");
  console.log(`  Tokens: input=${actual.inputTokens ?? 0}, output=${actual.outputTokens ?? 0}, total=${actual.totalTokens ?? 0}`);
  console.log(`  Cost: $${formatUsd(actual.costUsd)}`);
}

function formatUsd(value) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return "unknown";
  return number.toFixed(6).replace(/\.?0+$/, "") || "0";
}

function printHelp() {
  console.log(`agent-test

Usage:
  agent-test scan <path-or-github-url> [--out <dir>]
  agent-test scan --target <path-or-github-url> --out <dir>
  agent-test scan --config agent-test.config.json
  agent-test scan --target . --max-files 500
  agent-test scan --target . --fail-on-check-failures
  agent-test run --target <path> --out <dir> --name <name> [--env KEY=VALUE] -- <command> [args...]

Current behavior:
  - one acceptance mode only; LLM API key is required
  - local path scanning
  - public GitHub repository cloning for static scan
  - project metadata detection
  - Markdown requirement candidate extraction
  - LLM-generated project understanding and acceptance rules
  - deterministic self-quality checks
  - developer/agent Markdown report, non-technical user summary, and JSON report generation
  - explicit dynamic command artifact recording
  - preflight token/cost estimate and actual LLM usage reporting
`);
}
