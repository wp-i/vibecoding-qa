#!/usr/bin/env node

import { analyzeBrowserUserJourney } from "./browser_smoke_playwright.mjs";
import {
  analyzeUserVisibleReportText,
  analyzeUserVisibleReportsFromArtifacts
} from "../../src/analyzers/user-report-quality.js";

const scenarios = [
  {
    name: "completed-empty-report",
    expectedKinds: ["completed-empty-report"],
    run: () => analyzeUserVisibleReportText([
      "Investigation complete",
      "No sufficiently relevant project lead was found.",
      "Organized leads",
      "No usable lead."
    ].join("\n")).findings
  },
  {
    name: "candidate-quality-obvious-failure",
    expectedKinds: ["zero-score-reference-shown", "directory-repo-returned"],
    run: () => analyzeUserVisibleReportText([
      "Reference project",
      "https://github.com/example-org/awesome-widget-directory",
      "relevance: 0/100",
      "A list of cool, interesting projects of GitHub."
    ].join("\n")).findings
  },
  {
    name: "user-visible-internal-and-duplicate-content",
    expectedKinds: ["unwanted-user-visible-content", "duplicate-user-visible-content"],
    run: () => analyzeUserVisibleReportText([
      "Recommended project: https://github.com/demo/project",
      "Recommended again: https://github.com/demo/project",
      "DEBUG raw.github_request_limit_reached=true"
    ].join("\n")).findings
  },
  {
    name: "returned-targets-need-consumption-review",
    expectedKinds: ["missing-artifact-consumption-review"],
    run: () => analyzeUserVisibleReportsFromArtifacts([
      {
        name: "scenario-01-demo",
        userVisibleText: "Recommended project: https://github.com/demo/project\nReason: covers the requirement."
      }
    ]).findings
  },
  {
    name: "consumed-target-must-support-report-claim",
    expectedKinds: ["consumed-target-contradicts-report"],
    run: () => analyzeUserVisibleReportsFromArtifacts([
      {
        name: "scenario-01-demo",
        userVisibleText: "Recommended project: https://github.com/demo/project\nReason: covers the requirement."
      },
      {
        name: "artifact-consumption-review",
        outputExcerpt: [
          JSON.stringify({
            reviews: [
              {
                target: "https://github.com/demo/project",
                verdict: "mismatch",
                claimedByReport: "covers the requirement",
                summary: "Observed artifact describes an unrelated template.",
                evidence: ["README summary: unrelated template"]
              }
            ]
          })
        ]
      }
    ]).findings
  },
  {
    name: "deeper-action-result-drift",
    expectedKinds: ["deeper-action-result-drift"],
    run: () => analyzeBrowserUserJourney({
      query: "find a domain alpha reporting tool with evidence",
      repeatSubmitCount: 2,
      snapshots: [
        {
          attempt: 1,
          queryIndex: 0,
          query: "find a domain alpha reporting tool with evidence",
          buttonLabelAfter: "Run deeper search",
          githubUrls: ["https://github.com/demo/first-tool", "https://github.com/demo/second-tool"],
          scores: [82, 74],
          textHash: "a",
          bodyText: "Recommended projects https://github.com/demo/first-tool https://github.com/demo/second-tool"
        },
        {
          attempt: 2,
          queryIndex: 0,
          query: "find a domain alpha reporting tool with evidence",
          buttonLabelBefore: "Run deeper search",
          githubUrls: ["https://github.com/other/unrelated"],
          scores: [12],
          textHash: "b",
          bodyText: "Recommended project https://github.com/other/unrelated"
        }
      ]
    }).findings
  },
  {
    name: "stale-results-after-query-change",
    expectedKinds: ["stale-results-after-query-change"],
    run: () => analyzeBrowserUserJourney({
      queries: ["find a scheduling workflow board", "analyze media evidence reports"],
      repeatSubmitCount: 1,
      snapshots: [
        {
          attempt: 1,
          queryIndex: 0,
          query: "find a scheduling workflow board",
          buttonLabelAfter: "Search",
          githubUrls: ["https://github.com/demo/domain-alpha-tool"],
          scores: [88],
          textHash: "same",
          bodyText: "Recommended project https://github.com/demo/domain-alpha-tool score 88/100"
        },
        {
          attempt: 1,
          queryIndex: 1,
          query: "analyze media evidence reports",
          buttonLabelBefore: "Search",
          githubUrls: ["https://github.com/demo/domain-alpha-tool"],
          scores: [88],
          textHash: "same",
          bodyText: "Recommended project https://github.com/demo/domain-alpha-tool score 88/100"
        }
      ]
    }).findings
  }
];

export function runVibeCodingUxSelftest() {
  return scenarios.map((scenario) => {
    const findings = scenario.run();
    const kinds = new Set(findings.map((finding) => finding.kind));
    const missingKinds = scenario.expectedKinds.filter((kind) => !kinds.has(kind));
    return {
      name: scenario.name,
      passed: missingKinds.length === 0,
      expectedKinds: scenario.expectedKinds,
      observedKinds: [...kinds],
      missingKinds
    };
  });
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll("\\", "/"))) {
  const results = runVibeCodingUxSelftest();
  const failed = results.filter((result) => !result.passed);
  process.stdout.write(`${JSON.stringify({
    passed: failed.length === 0,
    checked: results.length,
    results
  }, null, 2)}\n`);
  process.exitCode = failed.length === 0 ? 0 : 1;
}
