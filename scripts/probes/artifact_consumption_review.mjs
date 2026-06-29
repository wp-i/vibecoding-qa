#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { extractGithubUrls, reviewGithubUrls } from "./github_url_browser_review.mjs";

export function parseArtifactConsumptionArgs(args) {
  const options = {
    timeoutMs: 60000,
    maxUrlsPerCase: 5,
    mode: "headless"
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--manifest") {
      requireValue(arg, next);
      options.manifest = resolve(next);
      index += 1;
    } else if (arg === "--output") {
      requireValue(arg, next);
      options.output = resolve(next);
      index += 1;
    } else if (arg === "--timeout-ms") {
      requireValue(arg, next);
      options.timeoutMs = parsePositiveInteger(next, arg);
      index += 1;
    } else if (arg === "--max-urls-per-case") {
      requireValue(arg, next);
      options.maxUrlsPerCase = parsePositiveInteger(next, arg);
      index += 1;
    } else if (arg === "--headed") {
      options.mode = "headed";
    } else {
      throw new Error(`Unknown artifact consumption option: ${arg}`);
    }
  }

  if (!options.manifest) throw new Error("--manifest is required");
  return options;
}

export async function reviewArtifactConsumption(options) {
  const manifest = JSON.parse(await readTextFile(options.manifest));
  const cases = Array.isArray(manifest.cases) ? manifest.cases : [];
  const reviews = [];

  for (const item of cases) {
    const text = unwrapText(parseJsonOrText(await readFile(resolve(item.input), "utf8")));
    const urls = extractGithubUrls(text).slice(0, options.maxUrlsPerCase);
    const result = await reviewGithubUrls({
      urls,
      query: item.query ?? "",
      timeoutMs: options.timeoutMs,
      mode: options.mode
    });
    for (const review of result.reviews) {
      reviews.push({
        scenario: item.name ?? "",
        query: item.query ?? "",
        claimedByReport: claimLineForUrl(text, review.url),
        ...review
      });
    }
  }

  return {
    passed: reviews.every((review) => !negativeVerdict(review)),
    cases: cases.map((item) => item.name ?? ""),
    reviews
  };
}

async function readTextFile(path) {
  const buffer = await readFile(path);
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.toString("utf16le").replace(/^\uFEFF/, "");
  }
  return buffer.toString("utf8").replace(/^\uFEFF/, "");
}

function claimLineForUrl(text, url) {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const index = lines.findIndex((line) => line.includes(url));
  if (index < 0) return "";
  return lines.slice(Math.max(0, index - 2), Math.min(lines.length, index + 4)).join(" / ").slice(0, 800);
}

function negativeVerdict(review) {
  return review.verdict === "directory-or-list-repository"
    || review.verdict === "open-failed"
    || review.requirementMatch === "mismatch";
}

function unwrapText(input) {
  if (typeof input === "string") return input;
  if (typeof input?.stdout === "string") return unwrapText(parseJsonOrText(input.stdout));
  if (typeof input?.bodyText === "string") return input.bodyText;
  for (const key of ["reportMarkdown", "report_markdown", "report", "markdown", "answer", "content", "output", "text"]) {
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

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const options = parseArtifactConsumptionArgs(process.argv.slice(2));
  const result = await reviewArtifactConsumption(options);
  const output = `${JSON.stringify(result, null, 2)}\n`;
  if (options.output) await writeFile(options.output, output, "utf8");
  process.stdout.write(output);
  process.exitCode = result.passed ? 0 : 1;
}
