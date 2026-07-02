import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyScenarioArtifact,
  collectRuntimeScenarioFindingsFromArtifacts,
  collectScenarioSummariesFromArtifacts
} from "../src/analyzers/runtime-scenarios.js";

test("classifyScenarioArtifact reviews explicitly weak adjacent leads", () => {
  const artifact = scenarioArtifact([
    "Investigation complete",
    "Recommended adjacent reference: https://github.com/example-org/security-agent",
    "Score: 3/100",
    "Core capability is unconfirmed.",
    "This is not directly adoptable."
  ].join("\n"));

  const result = classifyScenarioArtifact(artifact);

  assert.equal(result.result, "Review");
  assert.equal(result.conclusion, "needs-decision");
  assert.equal(result.evidenceStrength, "weak-live-signal");
});

test("classifyScenarioArtifact treats timed out scenarios as blocked full-flow evidence", () => {
  const artifact = {
    ...scenarioArtifact("Browser started, waiting for login or external service."),
    timedOut: true,
    exitCode: 1
  };

  const result = classifyScenarioArtifact(artifact);

  assert.equal(result.result, "Fail");
  assert.equal(result.conclusion, "tooling-issue");
  assert.match(result.title, /blocked or timed out/);
  assert.match(result.fixFocus, /test-environment readiness/);
});

test("classifyScenarioArtifact treats no-result reports with recovery evidence as review", () => {
  const artifact = scenarioArtifact([
    "No sufficiently relevant project lead was found.",
    "Search coverage: names, README, topics, issues, and web cross-checks.",
    "Filter reason: candidates lacked required screenshots.",
    "Next search: try platform-specific API terms."
  ].join("\n"));

  const result = classifyScenarioArtifact(artifact);

  assert.equal(result.result, "Review");
  assert.equal(result.conclusion, "needs-decision");
  assert.equal(result.evidenceStrength, "weak-live-signal");
});

test("classifyScenarioArtifact fails no-result reports without recovery evidence", () => {
  const artifact = scenarioArtifact("No usable lead.");

  const result = classifyScenarioArtifact(artifact);

  assert.equal(result.result, "Fail");
  assert.equal(result.conclusion, "failure");
});

test("classifyScenarioArtifact does not judge low numeric scores without contract evidence", () => {
  const artifact = scenarioArtifact([
    "Candidate: https://github.com/example-org/project",
    "Score: 35/100",
    "Some overlap exists, but evidence is incomplete."
  ].join("\n"));

  const result = classifyScenarioArtifact(artifact);

  assert.equal(result.result, "Pass");
  assert.equal(result.conclusion, "risk");
});

test("runtime scenario summaries and findings share one classification model", () => {
  const artifacts = [
    scenarioArtifact("No usable lead.", "scenario-01-demo")
  ];

  const summaries = collectScenarioSummariesFromArtifacts(artifacts);
  const findings = collectRuntimeScenarioFindingsFromArtifacts(artifacts);

  assert.equal(summaries[0].result, "Fail");
  assert.equal(summaries[0].evidenceStrength, "runtime-observation");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].evidenceStrength, summaries[0].evidenceStrength);
});

function scenarioArtifact(output, name = "scenario-01-demo") {
  return {
    name,
    path: `runtime/${name}.json`,
    exitCode: 0,
    outputExcerpt: output.split(/\r?\n/)
  };
}
