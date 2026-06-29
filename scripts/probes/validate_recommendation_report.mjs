#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export async function validateRecommendationReportFile(path) {
  const raw = await readFile(path, "utf8");
  return validateRecommendationReport(parseJson(raw, path));
}

export function validateRecommendationReport(input) {
  const report = unwrapReport(input);
  const violations = [];

  const projects = Array.isArray(report.topProjects) ? report.topProjects : [];
  for (const project of projects) {
    const coveredByEvidence = new Set(
      (project.evidenceCoverage ?? [])
        .filter((item) => item?.covered === true)
        .map((item) => String(item.feature))
    );
    for (const feature of project.coveredFeatures ?? []) {
      if (!coveredByEvidence.has(String(feature))) {
        violations.push(
          `${project.repo ?? "unknown repo"} claims coveredFeatures item without evidenceCoverage support: ${feature}`
        );
      }
    }
  }

  if (report.raw?.github_request_limit_reached === true && report.raw?.search_completeness !== "limited") {
    violations.push("raw.github_request_limit_reached is true, but raw.search_completeness is not limited");
  }

  return {
    passed: violations.length === 0,
    violations,
    checkedProjects: projects.length
  };
}

function unwrapReport(input) {
  if (input && typeof input.stdout === "string") {
    return parseJson(input.stdout, "artifact.stdout");
  }
  return input;
}

function parseJson(value, label) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Could not parse ${label} as JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: validate_recommendation_report.mjs <report-or-command-artifact.json>");
    process.exitCode = 2;
  } else {
    const result = await validateRecommendationReportFile(path);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.passed ? 0 : 1;
  }
}
