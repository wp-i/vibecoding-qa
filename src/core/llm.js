import { readFile } from "node:fs/promises";
import { join } from "node:path";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-5-mini";

export function resolveLlmSettings(config = {}, env = process.env) {
  const llm = config.llm ?? {};
  const apiKeyEnv = llm.apiKeyEnv ?? "AGENT_TEST_LLM_API_KEY";
  const fallbackApiKeyEnv = llm.fallbackApiKeyEnv ?? "OPENAI_API_KEY";
  const apiKey = env[apiKeyEnv] || env[fallbackApiKeyEnv] || "";
  const baseUrl = (env.AGENT_TEST_LLM_BASE_URL ?? env.OPENAI_BASE_URL ?? llm.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = env.AGENT_TEST_LLM_MODEL ?? env.OPENAI_MODEL ?? llm.model ?? DEFAULT_MODEL;
  const inputUsdPer1M = numberOrDefault(env.AGENT_TEST_LLM_INPUT_USD_PER_1M ?? llm.inputUsdPer1M, 0);
  const outputUsdPer1M = numberOrDefault(env.AGENT_TEST_LLM_OUTPUT_USD_PER_1M ?? llm.outputUsdPer1M, 0);
  const estimatedInputTokens = numberOrDefault(llm.estimatedInputTokens, 30000);
  const estimatedOutputTokens = numberOrDefault(llm.estimatedOutputTokens, 6000);
  const maxCostUsd = numberOrDefault(llm.maxCostUsd, 5);

  return {
    apiKeyEnv,
    fallbackApiKeyEnv,
    apiKey,
    baseUrl,
    model,
    inputUsdPer1M,
    outputUsdPer1M,
    estimatedInputTokens,
    estimatedOutputTokens,
    maxCostUsd
  };
}

export function requireLlmApiKey(settings) {
  if (!settings.apiKey) {
    throw new Error(
      `LLM API key is required. Set ${settings.apiKeyEnv} or ${settings.fallbackApiKeyEnv} before running agent-test.`
    );
  }
}

export function estimateTokens(text) {
  const value = String(text ?? "");
  if (!value.trim()) return 0;
  return Math.max(1, Math.ceil(value.length / 3));
}

export function estimateUsd(inputTokens, outputTokens, settings) {
  const inputPrice = Number(settings.inputUsdPer1M ?? 0);
  const outputPrice = Number(settings.outputUsdPer1M ?? 0);
  if (inputPrice <= 0 || outputPrice <= 0) return 0;
  return roundUsd((inputTokens / 1_000_000) * inputPrice + (outputTokens / 1_000_000) * outputPrice);
}

export async function generateAcceptanceContract({ project, requirements, commandArtifacts, config, usage }) {
  const settings = resolveLlmSettings(config);
  requireLlmApiKey(settings);
  const prompt = await buildContractPrompt({ project, requirements, commandArtifacts });
  const system = [
    "You are an expert QA lead for vibe-coded and AI-generated software.",
    "Read the project evidence and produce a project-specific acceptance contract.",
    "Focus on user-visible promises, complete user flows, output usefulness, runtime evidence, UI contracts, and cost disclosure.",
    "Return strict JSON only."
  ].join(" ");
  const user = JSON.stringify(prompt, null, 2);
  const response = await chatJson({ system, user, settings });
  recordLlmUsage(usage, response.usage, system, user, response.content, settings, response.mocked);
  return normalizeContract(response.json);
}

async function buildContractPrompt({ project, requirements, commandArtifacts }) {
  const markdownExcerpts = [];
  for (const file of project.markdownFiles?.slice(0, 12) ?? []) {
    let excerpt = "";
    try {
      excerpt = (await readFile(join(project.root, file.path), "utf8")).slice(0, 4000);
    } catch {
      excerpt = "";
    }
    markdownExcerpts.push({ path: file.path, excerpt });
  }

  return {
    task: "Generate project-specific acceptance rules for agent-test. Do not create broad advice; create testable rules.",
    ruleGenerationGuidance: [
      "Functional correctness remains the primary focus.",
      "If the project exposes any web UI, desktop UI, mobile UI, browser extension UI, admin console, dashboard, interactive canvas, or visual tool surface, include basic browser/UI acceptance rules.",
      "UI rules must target obvious user-blocking problems a human tester would catch immediately: hidden or clipped primary controls, overlapping text/buttons/panels, broken scroll containers, content escaping the intended card/panel, blank first viewport, unreadable/click-blocking overlays, and missing visible success/error/result feedback after the documented flow.",
      "For search, recommendation, research, ranking, generator, or report-producing products, generate rules from the project docs for what a useful non-empty or no-result output must contain.",
      "Do not create subjective aesthetic rules about colors, style, rounded corners, or taste unless the project documentation makes them functional requirements.",
      "Do not rely on fixed field names, repository names, sample prompts, or one incident; rules must follow from the target project's docs and user-visible contract."
    ],
    requiredJsonShape: {
      projectType: "short string",
      userFlows: ["flow the tester must exercise"],
      userVisibleOutputs: ["outputs whose usefulness must be judged"],
      acceptanceRules: [
        {
          id: "stable-kebab-case",
          title: "short title",
          rationale: "why this follows from the project docs",
          testMethod: "static|runtime|browser|artifact-consumption|cost-accounting",
          severity: "Blocker|Critical|Major|Minor"
        }
      ],
      costRules: ["rules for token/API estimate and actual usage disclosure"]
    },
    project: {
      type: project.projectType,
      packageManager: project.packageManager,
      markdownFiles: markdownExcerpts,
      files: project.files?.slice(0, 80).map((file) => file.path)
    },
    requirements: requirements.items?.slice(0, 40) ?? [],
    runtimeArtifacts: commandArtifacts.slice(0, 8).map((artifact) => ({
      name: artifact.name,
      command: artifact.command,
      summary: artifact.summary,
      outputExcerpt: artifact.outputExcerpt?.slice(0, 20)
    }))
  };
}

async function chatJson({ system, user, settings }) {
  const mock = process.env.AGENT_TEST_LLM_MOCK_RESPONSE;
  if (mock) {
    const content = mock.trim();
    return {
      content,
      json: parseJson(content),
      usage: null,
      mocked: true
    };
  }

  const response = await fetch(`${settings.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      temperature: 0.1
    })
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`LLM request failed with HTTP ${response.status}: ${text.slice(0, 500)}`);
  }
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content ?? "";
  return {
    content,
    json: parseJson(content),
    usage: data?.usage ?? null,
    mocked: false
  };
}

function parseJson(content) {
  const cleaned = String(content ?? "").trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("LLM did not return parseable JSON for the acceptance contract.");
  }
}

function recordLlmUsage(usage, upstreamUsage, system, user, content, settings, mocked) {
  const actual = usage.actual;
  const promptTokens = integerOrNull(upstreamUsage?.prompt_tokens);
  const completionTokens = integerOrNull(upstreamUsage?.completion_tokens);
  const inputTokens = promptTokens ?? estimateTokens(system) + estimateTokens(user);
  const outputTokens = completionTokens ?? estimateTokens(content);
  actual.inputTokens += inputTokens;
  actual.outputTokens += outputTokens;
  actual.totalTokens += inputTokens + outputTokens;
  actual.costUsd = roundUsd(actual.costUsd + estimateUsd(inputTokens, outputTokens, settings));
  if (promptTokens === null || completionTokens === null) {
    actual.estimated = true;
    actual.notes.push("LLM provider did not return complete usage fields; token usage includes a local estimate.");
  }
  if (mocked) {
    actual.notes.push("LLM response was supplied by AGENT_TEST_LLM_MOCK_RESPONSE for automated testing.");
  }
}

function normalizeContract(value) {
  const contract = value && typeof value === "object" ? value : {};
  return {
    projectType: String(contract.projectType ?? "unknown"),
    userFlows: arrayOfStrings(contract.userFlows),
    userVisibleOutputs: arrayOfStrings(contract.userVisibleOutputs),
    acceptanceRules: Array.isArray(contract.acceptanceRules)
      ? contract.acceptanceRules.map((rule, index) => ({
        id: String(rule?.id ?? `llm-rule-${index + 1}`),
        title: String(rule?.title ?? "Project-specific acceptance rule"),
        rationale: String(rule?.rationale ?? ""),
        testMethod: String(rule?.testMethod ?? "runtime"),
        severity: String(rule?.severity ?? "Major")
      }))
      : [],
    costRules: arrayOfStrings(contract.costRules)
  };
}

function arrayOfStrings(value) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function integerOrNull(value) {
  return Number.isInteger(value) ? value : null;
}

function numberOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundUsd(value) {
  return Math.round(Number(value ?? 0) * 1_000_000) / 1_000_000;
}
