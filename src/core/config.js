import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function loadConfig(configPath) {
  if (!configPath) return defaultConfig();

  const raw = await readFile(resolve(configPath), "utf8");
  const parsed = JSON.parse(raw);
  return mergeConfig(defaultConfig(), parsed);
}

export function mergeConfig(base, override) {
  return {
    project: {
      ...base.project,
      ...override.project,
      ignorePaths: [
        ...(base.project?.ignorePaths ?? []),
        ...(override.project?.ignorePaths ?? [])
      ]
    },
    mode: {
      ...base.mode,
      ...override.mode
    },
    profiles: override.profiles ?? base.profiles,
    security: {
      ...base.security,
      ...override.security,
      ignoreSecretPaths: [
        ...(base.security?.ignoreSecretPaths ?? []),
        ...(override.security?.ignoreSecretPaths ?? [])
      ]
    },
    report: {
      ...base.report,
      ...override.report
    }
  };
}

export function defaultConfig() {
  return {
    project: {
      target: ".",
      type: "auto",
      ignorePaths: []
    },
    mode: {
      name: "basic",
      llm: "no-llm",
      maxCostUsd: 0,
      maxFiles: 1000
    },
    profiles: ["auto"],
    security: {
      ignoreSecretPaths: []
    },
    report: {
      output: "reports/latest",
      formats: ["md", "json"],
      failOnCheckFailures: false
    }
  };
}
