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
    llm: {
      ...base.llm,
      ...override.llm
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
      name: "acceptance",
      maxFiles: 1000
    },
    llm: {
      apiKeyEnv: "AGENT_TEST_LLM_API_KEY",
      fallbackApiKeyEnv: "OPENAI_API_KEY",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-5-mini",
      estimatedInputTokens: 30000,
      estimatedOutputTokens: 6000,
      inputUsdPer1M: 0,
      outputUsdPer1M: 0,
      maxCostUsd: 5
    },
    profiles: ["auto"],
    security: {
      ignoreSecretPaths: []
    },
    report: {
      output: "reports/latest",
      formats: ["md", "pdf", "json"],
      failOnCheckFailures: false
    }
  };
}
