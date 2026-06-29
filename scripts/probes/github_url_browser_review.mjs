#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function parseGithubUrlReviewArgs(args) {
  const options = {
    timeoutMs: 60000,
    maxUrls: 12,
    mode: "headless",
    query: ""
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--input") {
      requireValue(arg, next);
      options.input = resolve(next);
      index += 1;
    } else if (arg === "--output") {
      requireValue(arg, next);
      options.output = resolve(next);
      index += 1;
    } else if (arg === "--query") {
      requireValue(arg, next);
      options.query = next;
      index += 1;
    } else if (arg === "--query-b64") {
      requireValue(arg, next);
      options.query = Buffer.from(next, "base64").toString("utf8");
      index += 1;
    } else if (arg === "--timeout-ms") {
      requireValue(arg, next);
      options.timeoutMs = parsePositiveInteger(next, arg);
      index += 1;
    } else if (arg === "--max-urls") {
      requireValue(arg, next);
      options.maxUrls = parsePositiveInteger(next, arg);
      index += 1;
    } else if (arg === "--headed") {
      options.mode = "headed";
    } else {
      throw new Error(`Unknown GitHub URL review option: ${arg}`);
    }
  }

  if (!options.input) throw new Error("--input is required");
  return options;
}

export async function reviewGithubUrlsFromFile(options) {
  const raw = await readFile(options.input, "utf8");
  const text = unwrapText(parseJsonOrText(raw));
  const urls = extractGithubUrls(text).slice(0, options.maxUrls);
  return reviewGithubUrls({ ...options, urls });
}

export async function reviewGithubUrls(options) {
  let playwright;
  try {
    playwright = await import("playwright");
  } catch {
    return {
      passed: false,
      setupError: "Playwright is not installed. Install it with: npm install -D playwright && npx playwright install chromium",
      urls: options.urls ?? [],
      reviews: []
    };
  }

  const reviews = [];
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: options.mode !== "headed" });
    const page = await browser.newPage();
    for (const url of options.urls ?? []) {
      reviews.push(await reviewOneUrl(page, url, options));
    }
  } finally {
    if (browser) await browser.close();
  }

  return {
    passed: reviews.every((review) => review.opened && review.verdict !== "directory-or-list-repository"),
    query: options.query ?? "",
    urls: options.urls ?? [],
    reviews
  };
}

export function extractGithubUrls(text) {
  return unique(
    [...String(text ?? "").matchAll(/https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/g)]
      .map((match) => match[0].replace(/[),.;]+$/, ""))
  );
}

async function reviewOneUrl(page, url, options) {
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: options.timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(options.timeoutMs, 15000) }).catch(() => {});
    const title = await page.title().catch(() => "");
    const bodyText = ((await page.locator("body").innerText({ timeout: 10000 }).catch(() => "")) ?? "").slice(0, 6000);
    const signals = classifySignals(`${title}\n${bodyText}`);
    const consumption = evaluateConsumptionEvidence(options.query ?? "", `${title}\n${bodyText}`);
    return {
      url,
      target: url,
      opened: true,
      status: response?.status() ?? null,
      title,
      summary: evidenceLines(bodyText).slice(0, 3).join(" / "),
      signals,
      verdict: signals.includes("directory-or-list") ? "directory-or-list-repository" : "browser-opened",
      requirementMatch: consumption.requirementMatch,
      matchedTerms: consumption.matchedTerms,
      missingTerms: consumption.missingTerms,
      evidence: evidenceLines(bodyText)
    };
  } catch (error) {
    return {
      url,
      target: url,
      opened: false,
      status: null,
      title: "",
      summary: "",
      signals: [],
      verdict: "open-failed",
      requirementMatch: "unverified",
      matchedTerms: [],
      missingTerms: [],
      error: error instanceof Error ? error.message : String(error),
      evidence: []
    };
  }
}

function classifySignals(text) {
  const signals = [];
  if (/A list (?:of )?(?:cool|awesome|interesting) projects/i.test(text)) signals.push("directory-or-list");
  if (/\b(?:awesome|curated list|newsletter|daily|project list|list of projects|interesting projects)\b/i.test(text)) {
    signals.push("directory-or-list");
  }
  if (/\b(?:CLI|web app|browser extension|API|SDK|server|dashboard)\b/i.test(text)) signals.push("runnable-or-tool-like");
  return unique(signals);
}

function evidenceLines(text) {
  return String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 12)
    .slice(0, 8);
}

export function evaluateConsumptionEvidence(query, observedText) {
  const queryTerms = extractMeaningfulTerms(query);
  const observed = String(observedText ?? "").toLowerCase();
  if (queryTerms.length === 0 || !observed.trim()) {
    return {
      requirementMatch: "unverified",
      matchedTerms: [],
      missingTerms: queryTerms
    };
  }

  const matchedTerms = queryTerms.filter((term) => observed.includes(term));
  const missingTerms = queryTerms.filter((term) => !observed.includes(term));
  const ratio = matchedTerms.length / queryTerms.length;
  let requirementMatch = "mismatch";
  if (matchedTerms.length >= 2 && ratio >= 0.25) requirementMatch = "supported";
  else if (matchedTerms.length >= 1) requirementMatch = "weak";

  return {
    requirementMatch,
    matchedTerms,
    missingTerms
  };
}

function extractMeaningfulTerms(text) {
  const asciiWords = String(text ?? "")
    .toLowerCase()
    .match(/[a-z][a-z0-9_-]{2,}/g) ?? [];
  const cjkTerms = String(text ?? "")
    .match(/[\u3400-\u9fff]{2,}/g) ?? [];
  return unique([...asciiWords, ...cjkTerms])
    .filter((term) => !STOPWORDS.has(term))
    .slice(0, 20);
}

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "find",
  "search",
  "project",
  "repo",
  "repository",
  "tool",
  "open",
  "source",
  "github",
  "可以",
  "一个",
  "进行",
  "相关",
  "项目",
  "开源",
  "查询",
  "报告"
]);

function unwrapText(input) {
  if (typeof input === "string") return input;
  if (typeof input?.bodyText === "string") return input.bodyText;
  if (typeof input?.stdout === "string") return unwrapText(parseJsonOrText(input.stdout));
  for (const key of ["report", "markdown", "answer", "content", "output", "text"]) {
    if (typeof input?.[key] === "string") return input[key];
  }
  return JSON.stringify(input, null, 2);
}

function parseJsonOrText(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function requireValue(arg, value) {
  if (!value) throw new Error(`${arg} requires a value`);
}

function parsePositiveInteger(value, label) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const options = parseGithubUrlReviewArgs(process.argv.slice(2));
  const result = await reviewGithubUrlsFromFile(options);
  const output = `${JSON.stringify(result, null, 2)}\n`;
  if (options.output) {
    await writeFile(options.output, output, "utf8");
  }
  process.stdout.write(output);
  process.exitCode = result.passed ? 0 : 1;
}
