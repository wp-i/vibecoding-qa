#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { analyzeUserVisibleReportText } from "../../src/analyzers/user-report-quality.js";

export async function validateUserReportOutputFile(path) {
  const raw = await readFile(path, "utf8");
  return validateUserReportOutput(parseJsonOrText(raw, path), { artifact: path });
}

export function validateUserReportOutput(input, options = {}) {
  const text = unwrapUserVisibleText(input);
  return analyzeUserVisibleReportText(text, options);
}

function unwrapUserVisibleText(input) {
  if (typeof input === "string") return input;
  if (typeof input?.bodyText === "string") return input.bodyText;
  if (typeof input?.stdout === "string") {
    const parsed = parseJsonOrText(input.stdout, "artifact.stdout");
    if (parsed !== input.stdout) return unwrapUserVisibleText(parsed);
    return input.stdout;
  }
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

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: validate_user_report_output.mjs <text-json-or-command-artifact>");
    process.exitCode = 2;
  } else {
    const result = await validateUserReportOutputFile(path);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.passed ? 0 : 1;
  }
}
