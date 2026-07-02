import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeUserVisibleReportText,
  analyzeUserVisibleReportsFromArtifacts
} from "../src/analyzers/user-report-quality.js";
import { validateUserReportOutput } from "../scripts/probes/validate_user_report_output.mjs";

test("analyzeUserVisibleReportText rejects completed blank reports without recovery evidence", () => {
  const result = analyzeUserVisibleReportText([
    "Investigation complete",
    "No sufficiently relevant project lead was found.",
    "Organized leads",
    "No usable lead."
  ].join("\n"));

  assert.equal(result.passed, false);
  assert.equal(
    result.findings.some((finding) => finding.kind === "completed-empty-report"),
    true
  );
});

test("analyzeUserVisibleReportText does not hard-fail zero-score or directory wording without a project contract", () => {
  const result = analyzeUserVisibleReportText([
    "Reference project",
    "https://github.com/example-org/awesome-widget-directory",
    "relevance: 0/100",
    "A list of cool, interesting projects of GitHub."
  ].join("\n"));

  assert.equal(result.findings.some((finding) => finding.kind === "zero-score-reference-shown"), false);
  assert.equal(result.findings.some((finding) => finding.kind === "directory-repo-returned"), false);
});

test("analyzeUserVisibleReportText rejects internal content and duplicated urls", () => {
  const result = analyzeUserVisibleReportText([
    "Recommended project: https://github.com/demo/project",
    "Recommended again: https://github.com/demo/project",
    "DEBUG raw.github_request_limit_reached=true"
  ].join("\n"));

  assert.equal(result.passed, false);
  assert.equal(result.findings.some((finding) => finding.kind === "unwanted-user-visible-content"), true);
  assert.equal(result.findings.some((finding) => finding.kind === "duplicate-user-visible-content"), true);
});

test("analyzeUserVisibleReportText keeps distinct repository urls separate", () => {
  const result = analyzeUserVisibleReportText([
    "Recommended project: https://github.com/demo/project-one",
    "Recommended project: https://github.com/demo/project-two",
    "Recommended project: https://github.com/demo/project-three"
  ].join("\n"));

  assert.equal(result.findings.some((finding) => finding.kind === "duplicate-user-visible-content"), false);
});

test("analyzeUserVisibleReportsFromArtifacts requires consumption review for returned targets", () => {
  const result = analyzeUserVisibleReportsFromArtifacts([
    {
      name: "scenario-01-demo",
      path: "runtime/scenario-01-demo.json",
      userVisibleText: "Recommended project: https://github.com/demo/project\nReason: covers the requirement."
    }
  ]);

  assert.equal(result.count, 1);
  assert.equal(result.findings[0].kind, "missing-artifact-consumption-review");
});

test("analyzeUserVisibleReportsFromArtifacts rejects consumed targets that contradict report claims", () => {
  const result = analyzeUserVisibleReportsFromArtifacts([
    {
      name: "scenario-01-demo",
      path: "runtime/scenario-01-demo.json",
      userVisibleText: "Recommended project: https://github.com/demo/project\nReason: covers the requirement."
    },
    {
      name: "artifact-consumption-review",
      path: "runtime/artifact-consumption-review.json",
      outputExcerpt: [
        JSON.stringify({
          reviews: [
            {
              target: "https://github.com/demo/project",
              verdict: "browser-opened",
              requirementMatch: "mismatch",
              claimedByReport: "covers the requirement",
              summary: "README describes an unrelated documentation template.",
              evidence: ["README: static documentation template only"]
            }
          ]
        })
      ]
    }
  ]);

  assert.equal(result.count, 1);
  assert.equal(result.findings[0].kind, "consumed-target-contradicts-report");
});

test("analyzeUserVisibleReportsFromArtifacts does not fail mismatches already labeled weak adjacent", () => {
  const result = analyzeUserVisibleReportsFromArtifacts([
    {
      name: "scenario-01-demo",
      path: "runtime/scenario-01-demo.json",
      userVisibleText: [
        "Adjacent reference: https://github.com/demo/project",
        "Score: 1/100",
        "This is not directly adoptable; core capability is unconfirmed."
      ].join("\n")
    },
    {
      name: "artifact-consumption-review",
      path: "runtime/artifact-consumption-review.json",
      outputExcerpt: [
        JSON.stringify({
          reviews: [
            {
              target: "https://github.com/demo/project",
              verdict: "browser-opened",
              requirementMatch: "mismatch",
              claimedByReport: "Adjacent reference, Score: 1/100, not directly adoptable, core capability is unconfirmed.",
              summary: "README describes an unrelated tool."
            }
          ]
        })
      ]
    }
  ]);

  assert.equal(result.count, 0);
});

test("analyzeUserVisibleReportsFromArtifacts includes browser user journey defects", () => {
  const result = analyzeUserVisibleReportsFromArtifacts([
    {
      name: "web-ui-demo",
      path: "runtime/web-ui-demo.json",
      userVisibleText: "Search completed without visible errors.",
      userJourney: {
        findings: [
          {
            id: "browser-journey-deeper-action-replaces-results",
            title: "Deeper-search action replaces prior results without explanation",
            severity: "Major",
            kind: "deeper-action-result-drift",
            actual: "The second click replaced the result set.",
            expected: "The second click should deepen the previous result or explain a new search.",
            evidence: ["Button after attempt 1: Run deeper search", "URL overlap: 0/3"]
          }
        ]
      }
    }
  ]);

  assert.equal(result.count, 1);
  assert.equal(result.findings[0].kind, "deeper-action-result-drift");
});

test("validateUserReportOutput unwraps browser bodyText", () => {
  const result = validateUserReportOutput({
    bodyText: "Traceback (most recent call last):\n  File \"app.py\", line 1"
  });

  assert.equal(result.passed, false);
  assert.equal(result.findings.some((finding) => finding.kind === "unwanted-user-visible-content"), true);
});
