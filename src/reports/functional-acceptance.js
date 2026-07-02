import {
  collectRuntimeScenarioFindingsFromArtifacts,
  collectScenarioSummariesFromArtifacts
} from "../analyzers/runtime-scenarios.js";

export function renderFunctionalAcceptanceReport(report) {
  const failedChecks = report.checks.items.filter((item) => item.status === "failed");
  const aiFindings = report.quality?.aiDefects?.findings ?? [];
  const userReportFindings = report.quality?.userReports?.findings ?? [];
  const runtimeFindings = collectRuntimeScenarioFindings(report);
  const scenarioSummaries = collectScenarioSummaries(report);
  const urlReviews = collectUrlReviews(report);
  const requirementItems = report.requirements?.items ?? [];
  const lines = [
    "# Functional Acceptance QA Report",
    "",
    "## 1. Report Summary",
    "",
    ...summaryBlock(report, failedChecks, aiFindings, runtimeFindings, userReportFindings),
    "",
    "## 2. Test Objective",
    "",
    "This report evaluates whether the target project can satisfy its documented user-facing requirements, with special emphasis on high-frequency defects found in AI-generated or low-human-intervention projects.",
    "",
    "The goal is not to judge code elegance. The goal is to produce a developer-actionable QA report comparable to a human tester's report: failed requirement, test case, reproduction path, actual result, expected result, evidence, impact and acceptance criteria.",
    "",
    "## 3. Scope And Method",
    "",
    ...scopeBlock(report),
    "",
    "### API Key And Token Cost",
    "",
    ...usageBlock(report.execution?.usage),
    "",
    "### LLM-Generated Acceptance Contract",
    "",
    ...acceptanceContractBlock(report.quality?.acceptanceContract),
    "",
    "### Full Functional Flow Verification",
    "",
    ...fullFlowBlock(report, scenarioSummaries),
    "",
    "### Runtime Evidence Artifacts",
    "",
    ...runtimeArtifactsBlock(report),
    "",
    "### Live Scenario Matrix",
    "",
    ...liveScenarioMatrix(scenarioSummaries),
    "",
    "## 4. Requirement Traceability",
    "",
    ...traceabilityBlock(report, requirementItems, aiFindings),
    "",
    "## 5. Test Case Matrix",
    "",
    ...testCaseMatrix(aiFindings),
    "",
    "## 6. Defect List",
    "",
    ...defectIndex(aiFindings, failedChecks),
    "",
    "## 7. Detailed Defects",
    "",
    ...formatFunctionalDefects(aiFindings),
    "",
    "## 8. Other Findings",
    "",
    ...formatOtherFailures(failedChecks),
    "",
    "## 9. Runtime Scenario Findings",
    "",
    ...formatRuntimeScenarioFindings(runtimeFindings),
    "",
    "## 10. User-Visible Report Quality",
    "",
    ...formatUserReportFindings(userReportFindings, report.quality?.userReports),
    "",
    "## 11. Artifact Consumption Review",
    "",
    ...formatUrlReviews(urlReviews),
    "",
    "## 12. Fix Verification Plan",
    "",
    ...fixVerificationPlan(aiFindings, userReportFindings, failedChecks),
    "",
    "## 13. Residual Risks And Untested Areas",
    "",
    ...residualRisks(report),
    "",
    "## 14. Developer Handoff",
    "",
    ...developerHandoff(aiFindings, runtimeFindings, failedChecks, userReportFindings),
    ""
  ];

  return `${lines.join("\n")}\n`;
}

function summaryBlock(report, failedChecks, aiFindings, runtimeFindings, userReportFindings) {
  const scenarioSummaries = collectScenarioSummaries(report);
  const fullFlow = fullFlowAssessment(report, scenarioSummaries);
  const hasFailure = aiFindings.length > 0 || runtimeFindings.length > 0 || userReportFindings.length > 0 || failedChecks.length > 0;
  const result = hasFailure ? "FAIL" : fullFlow.result;
  const severity = highestSeverity([
    ...aiFindings,
    ...runtimeFindings,
    ...userReportFindings,
    ...failedChecks.filter((item) => !isSpecialFunctionalCheck(item.id))
  ]);
  const otherFailures = failedChecks.filter((item) => !isSpecialFunctionalCheck(item.id));
  const failedGateIds = failedChecks.map((item) => item.id);
  const freshness = runtimeEvidenceFreshness(report);
  return [
    `- Target: \`${report.target}\``,
    `- Mode: \`${report.mode}\``,
    `- Result: **${result}**`,
    `- Highest severity: ${severity}`,
    `- Checks passed: ${report.checks.summary.passed}/${report.checks.summary.total}`,
    `- Checks failed: ${report.checks.summary.failed}/${report.checks.summary.total}`,
    `- Failed check gates: ${failedGateIds.length ? failedGateIds.map((id) => `\`${id}\``).join(", ") : "none"}`,
    `- Functional defects: ${aiFindings.length}`,
    `- Runtime scenario findings: ${runtimeFindings.length}`,
    `- User-visible report quality findings: ${userReportFindings.length}`,
    `- Other obvious findings: ${otherFailures.length}`,
    `- Full functional flow status: ${fullFlow.status}`,
    `- Runtime evidence freshness: ${freshness.summary}`,
    `- Assessment focus: ${report.assessmentFocus?.primary ?? "requirement-conformance"}`,
    "",
    "- Note: check gate counts and live scenario observations are separate. A live scenario can be marked Review without failing a gate when it needs human/product judgment rather than showing a clear current defect.",
    ...(freshness.staleCount > 0
      ? ["- Currency warning: at least one runtime artifact is stale relative to this report generation. Re-run those commands before treating concrete repository names or scores as the latest state."]
      : []),
    ...(freshness.weakTimestampCount > 0
      ? ["- Timestamp warning: at least one runtime artifact lacks an internal command timestamp and is dated by file mtime only. If files were copied or regenerated, rerun before treating concrete evidence as current."]
      : []),
    "",
    aiFindings.length > 0
      ? "The target project has at least one user-facing requirement-conformance issue. The most important defect can allow a completed report to deliver no usable result despite a documented fallback contract."
      : userReportFindings.length > 0
        ? "The target project generated a user-visible report that fails core report-quality gates such as useful content, deduplication, candidate quality, artifact-consumption review, or browser verification."
      : runtimeFindings.length > 0
        ? "The target project has at least one real user scenario failure. Completed execution did not produce a directly usable relevant result for the attached scenario artifact(s)."
      : result === "FAIL"
        ? "No functional smoke defect was detected in this run, but other obvious risks require review before sharing or accepting the project."
      : result === "PARTIAL"
        ? "Only partial runtime evidence was captured. Full functional acceptance is not complete until a representative end-to-end user flow is executed and reviewed."
      : result === "UNVERIFIED"
        ? "No representative end-to-end user flow was executed. Treat this as an environment/test-readiness result, not a completed functional test."
        : "No functional smoke defect was detected in this run."
  ];
}

function scopeBlock(report) {
  return [
    "- Test type: low-cost functional acceptance precheck.",
    "- Project class: AI-generated or low-human-intervention vibeCoding project.",
    "- Execution policy: static scan plus attached runtime scenario artifacts when available.",
    "- Evidence sources: project documentation, README/handoff files, source code report branches, generated scan artifacts, recorded command outputs and artifact-consumption review artifacts.",
    "- Primary oracle: documented user-value contract versus implemented user-facing output behavior.",
    "- Excluded from primary judgment: code elegance, deep architecture review, deep security review, deep robustness review.",
    "",
    "### Generated Artifacts",
    "",
    "- `AGENT_TEST_QA_REPORT.md`: developer/agent handoff report with reproduction evidence and repair guidance.",
    "- `USER_QA_SUMMARY.pdf`: concise non-technical reader report for product/business review.",
    "- `report.json`: machine-readable scan result.",
    "- Runtime artifacts remain under `runtime/` and are summarized in this report; they are supporting evidence, not additional handoff reports.",
    "",
    "### Runtime Scenario Judgment",
    "",
    "- Runtime scenarios are user-flow observations and are reported separately from deterministic check gates.",
    "- `Fail` means the recorded user scenario produced a clear user-value failure under the captured evidence.",
    "- `Review` means the scenario needs product judgment or deeper evidence, such as no-result output with useful recovery guidance or low-confidence leads clearly labeled as weak.",
    "- Artifact consumption review is supporting evidence; shallow link/page consumption can reveal obvious mismatch, but it is not treated as a complete external-search audit."
  ];
}

function usageBlock(usage) {
  if (!usage) {
    return [
      "- API key required: unknown",
      "- Preflight estimate: not recorded",
      "- Actual usage: not recorded"
    ];
  }

  const preflight = usage.preflight ?? {};
  const actual = usage.actual ?? {};
  return [
    `- API key required: ${usage.apiKeyRequired ? "yes" : "no"}`,
    `- Required API keys: ${usage.apiKeys?.length ? usage.apiKeys.map((key) => `\`${key}\``).join(", ") : "none"}`,
    `- LLM mode: \`${usage.llmMode ?? "unknown"}\``,
    `- Preflight token estimate: input=${preflight.estimatedInputTokens ?? 0}, output=${preflight.estimatedOutputTokens ?? 0}, total=${preflight.estimatedTotalTokens ?? 0}`,
    `- Preflight cost estimate: $${formatUsd(preflight.estimatedCostUsd)} (max configured: $${formatUsd(preflight.maxCostUsd)})`,
    `- Actual token usage: input=${actual.inputTokens ?? 0}, output=${actual.outputTokens ?? 0}, total=${actual.totalTokens ?? 0}`,
    `- Actual recorded cost: $${formatUsd(actual.costUsd)}`,
    ...((preflight.notes ?? []).map((note) => `- Preflight note: ${note}`)),
    ...((actual.notes ?? []).map((note) => `- Actual usage note: ${note}`))
  ];
}

function acceptanceContractBlock(contract) {
  if (!contract) {
    return [
      "- Contract status: not generated",
      "- This is a blocking test-tool issue because LLM-generated project understanding is required."
    ];
  }
  const lines = [
    `- Project type: ${contract.projectType ?? "unknown"}`,
    `- User flows: ${contract.userFlows?.length ? contract.userFlows.join("; ") : "none generated"}`,
    `- User-visible outputs: ${contract.userVisibleOutputs?.length ? contract.userVisibleOutputs.join("; ") : "none generated"}`
  ];
  const rules = contract.acceptanceRules ?? [];
  if (rules.length === 0) {
    lines.push("- Acceptance rules: none generated");
  } else {
    lines.push("", "| Rule | Severity | Method | Rationale |", "| --- | --- | --- | --- |");
    for (const rule of rules.slice(0, 12)) {
      lines.push(
        `| ${escapeTable(rule.title ?? rule.id)} | ${escapeTable(rule.severity ?? "Major")} | ${escapeTable(rule.testMethod ?? "runtime")} | ${escapeTable(rule.rationale ?? "")} |`
      );
    }
  }
  for (const rule of contract.costRules ?? []) {
    lines.push(`- Cost rule: ${rule}`);
  }
  return lines;
}

function formatUsd(value) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return "unknown";
  return number.toFixed(6).replace(/\.?0+$/, "") || "0";
}

function liveScenarioMatrix(summaries) {
  const lines = [
    "| Scenario | Exit | URLs | Score Range | Key Signals | Result | Conclusion | Evidence Strength |",
    "| --- | --- | ---: | --- | --- | --- | --- | --- |"
  ];

  if (summaries.length === 0) {
    lines.push("| none | - | 0 | - | No live scenario artifacts attached | Not run | unverified | none |");
    return lines;
  }

  for (const item of summaries) {
    lines.push(
      `| ${escapeTable(item.name)} | ${item.exitCode} | ${item.urlCount} | ${escapeTable(item.scoreRange)} | ${escapeTable(item.signals.join(", ") || "none")} | ${item.result} | ${item.conclusion ?? "-"} | ${item.evidenceStrength ?? "-"} |`
    );
  }

  return lines;
}

function fullFlowBlock(report, scenarioSummaries) {
  const assessment = fullFlowAssessment(report, scenarioSummaries);
  const artifacts = report.execution?.commandArtifacts ?? [];
  return [
    `- Status: **${assessment.status}**`,
    `- Result contribution: **${assessment.result}**`,
    `- Reason: ${assessment.reason}`,
    ...assessment.blockers.map((item) => `- Blocking factor: ${item}`),
    ...assessment.nextSteps.map((item) => `- Next step: ${item}`),
    ...(artifacts.length > 0 && scenarioSummaries.length === 0
      ? ["- Note: lightweight runtime commands were recorded, but they do not substitute for a representative full user flow."]
      : [])
  ];
}

function fullFlowAssessment(report, scenarioSummaries) {
  const artifacts = report.execution?.commandArtifacts ?? [];
  if (scenarioSummaries.length > 0) {
    const failed = scenarioSummaries.filter((item) => item.result === "Fail");
    const review = scenarioSummaries.filter((item) => item.result === "Review");
    if (failed.length > 0) {
      return {
        status: "attempted-failed",
        result: "FAIL",
        reason: `${scenarioSummaries.length} representative runtime scenario artifact(s) were attached; ${failed.length} failed before or during user-value verification.`,
        blockers: [
          "The representative full flow did not complete successfully under the captured test conditions."
        ],
        nextSteps: [
          "Use the Runtime Scenario Findings section to separate target-project failures from environment/setup blockers.",
          "Resolve the blocker or defect, then rerun the same scenario artifact name so the report can compare a completed flow."
        ]
      };
    }
    if (review.length > 0) {
      return {
        status: "executed-needs-review",
        result: "PARTIAL",
        reason: `${scenarioSummaries.length} representative runtime scenario artifact(s) were attached; ${review.length} need product or tester review before acceptance.`,
        blockers: [],
        nextSteps: [
          "Review scenario output quality against the documented core requirements.",
          "Add clearer oracle checks or additional scenarios if the current evidence is too weak for acceptance."
        ]
      };
    }
    if (scenarioSummaries.length < 3) {
      return {
        status: "executed-insufficient-scenarios",
        result: "PARTIAL",
        reason: `${scenarioSummaries.length} representative runtime scenario artifact(s) were attached and passed obvious checks, but at least 3 diverse scenarios are expected after a full flow is runnable.`,
        blockers: [
          "Scenario coverage is too narrow to treat the project as complete functional acceptance."
        ],
        nextSteps: [
          "Record at least 3 diverse scenario artifacts that exercise materially different user inputs, output paths, and edge cases.",
          "Keep the scenario inputs derived from the target project's documented user value instead of reusing one prompt with small wording changes."
        ]
      };
    }
    return {
      status: "executed",
      result: "PASS",
      reason: `${scenarioSummaries.length} representative runtime scenario artifact(s) were attached and evaluated.`,
      blockers: [],
      nextSteps: [
        "Review scenario coverage against the documented core requirements; add more scenarios if major user flows are still missing."
      ]
    };
  }

  if (artifacts.length > 0) {
    return {
      status: "partial-runtime-only",
      result: "PARTIAL",
      reason: "Runtime smoke evidence exists, but no artifact named like `scenario-01-*` was attached to prove a representative end-to-end user flow.",
      blockers: [
        "The full flow was not attempted or the attempt was not recorded as a scenario artifact.",
        "If external services, credentials, browsers, databases, accounts, or local dependencies blocked execution, the exact blocker must be captured in a runtime artifact."
      ],
      nextSteps: [
        "Record the real user flow with `agent-test run --name scenario-01-<flow-name> -- <command>` or a browser/API scenario probe.",
        "If the scenario is blocked by environment setup rather than target-project behavior, document the missing dependency or credential, help the user configure it, then rerun the scenario.",
        "Do not treat this report as complete functional acceptance until a representative scenario artifact exists."
      ]
    };
  }

  return {
    status: "not-run",
    result: "UNVERIFIED",
    reason: "No runtime command artifact was attached, so the project was not exercised through a user-visible flow.",
    blockers: [
      "No executable functional-flow evidence is available for this report."
    ],
    nextSteps: [
      "Identify the documented primary user flow from README/docs.",
      "Attempt that flow in the test environment and record the command/browser/API evidence.",
      "If setup is blocked, report the concrete missing environment item and retry after it is provided."
    ]
  };
}

function runtimeArtifactsBlock(report) {
  const artifacts = report.execution?.commandArtifacts ?? [];
  if (artifacts.length === 0) {
    return ["- No runtime command artifact was attached to this scan."];
  }

  const startedAt = report.execution?.startedAt;
  return artifacts.flatMap((artifact) => [
    `- ${artifact.name ?? "command"}: exitCode=${artifact.exitCode}, timedOut=${artifact.timedOut}, durationMs=${artifact.durationMs}`,
    ...(artifact.recordedAt ? [`  - Recorded at: ${artifact.recordedAt}`] : []),
    ...(artifact.recordedAtSource ? [`  - Recorded-at source: ${artifact.recordedAtSource}`] : []),
    ...(artifact.recordedAt ? [`  - Freshness: ${runtimeArtifactFreshnessLabel(startedAt, artifact, report.project?.latestModifiedAt)}`] : []),
    ...(artifact.summary ? [`  - Summary: ${artifact.summary}`] : []),
    ...outputExcerptLines(artifact),
    `  - Command: \`${(artifact.command ?? []).join(" ")}\``,
    `  - Artifact: \`${artifact.path}\``
  ]);
}

function outputExcerptLines(artifact) {
  if (!artifact.outputExcerpt?.length) return [];
  return [`  - Output excerpt: ${artifact.outputExcerpt.slice(0, 3).join(" / ")}`];
}

function traceabilityBlock(report, requirementItems, findings) {
  const requirementEvidence = unique(
    findings.flatMap((finding) => finding.evidence.filter((line) => isRequirementEvidence(line)))
  );
  const fallbackRequirements = requirementEvidence.length > 0
    ? requirementEvidence
    : requirementItems
      .filter((item) => /fallback|adjacent|reference|鐩搁偦|鍙傝€億绌簗鏆傛棤|绾跨储|Top 3/i.test(item.text))
      .slice(0, 8)
      .map((item) => `${item.source}:${item.line} ${item.text}`);

  const lines = [
    "| Requirement / Contract | Verification Status | Evidence |",
    "| --- | --- | --- |"
  ];

  if (fallbackRequirements.length === 0) {
    lines.push("| No fallback or empty-result contract extracted | Not verified | Requirement extraction found no direct contract line. |");
    return lines;
  }

  const status = findings.length > 0 ? "Failed" : "Observed; not failed by static scan";
  for (const evidence of fallbackRequirements.slice(0, 8)) {
    lines.push(`| Completed output must degrade to useful references or explain lack of candidates | ${status} | ${escapeTable(evidence)} |`);
  }

  return lines;
}

function testCaseMatrix(findings) {
  const lines = [
    "| Case ID | Purpose | Input Class | Oracle | Result |",
    "| --- | --- | --- | --- | --- |"
  ];

  if (findings.length === 0) {
    lines.push("| TC-AI-EMPTY-001 | Detect completed empty output | No exact match with fallback contract | Completed output still provides value | Pass |");
    return lines;
  }

  for (const [index, finding] of findings.entries()) {
    lines.push(
      `| TC-AI-EMPTY-${String(index + 1).padStart(3, "0")} | Detect ${escapeTable(finding.kind)} | User asks for an existing usable project/site/tool but no perfect match is verified | Report must include adjacent/reference projects, rejected candidates, or concrete search-failure evidence | Fail |`
    );
  }

  return lines;
}

function defectIndex(aiFindings, failedChecks) {
  const lines = [
    "| ID | Severity | Category | Title | Status |",
    "| --- | --- | --- | --- | --- |"
  ];

  for (const [index, finding] of aiFindings.entries()) {
    lines.push(`| FA-${index + 1} | ${finding.severity} | ${finding.category} | ${escapeTable(finding.title)} | Open |`);
  }

  if (lines.length === 2) lines.push("| none | - | - | No open functional defects | Closed |");
  return lines;
}

function formatFunctionalDefects(findings) {
  if (findings.length === 0) return ["- No functional defects detected."];

  return findings.flatMap((finding, index) => [
    `### FA-${index + 1}: ${finding.title}`,
    "",
    `- Severity: ${finding.severity}`,
    `- Category: ${finding.category}`,
    `- Defect kind: ${finding.kind}`,
    `- Status: Open`,
    "",
    "#### Requirement Basis",
    "",
    ...formatEvidenceGroup(requirementEvidence(finding)),
    "",
    "#### Test Case",
    "",
    `- Case ID: TC-AI-EMPTY-${String(index + 1).padStart(3, "0")}`,
    "- Type: AI-generated project functional smoke test.",
    "- Trigger condition: the product promises fallback, adjacent references, or minimum user value when no exact match exists.",
    "- Input class: a user asks for an existing usable project, website, tool or open-source alternative.",
    "- Oracle: a completed report must still provide usable adjacent references, verifiable rejected candidates, or concrete search-failure evidence.",
    "",
    "#### Reproduction Path",
    "",
    "- Read the documented fallback or adjacent-reference contract in the requirement evidence above.",
    "- Inspect the implementation evidence below.",
    "- Follow the no-result branch in the report generation code.",
    "- Confirm the branch can produce a completed report with empty-state text and no user-usable candidate information.",
    "",
    "#### Actual Result",
    "",
    `- ${finding.impact}`,
    "",
    ...formatEvidenceGroup(actualEvidence(finding)),
    "",
    "#### Expected Result",
    "",
    `- ${finding.expected}`,
    "",
    "#### User Impact",
    "",
    "- The user can spend time and model/API quota but receive no actionable project, no adjacent reference, no rejected-candidate evidence and no concrete recovery path.",
    "- This breaks the core value of a research/search product: even imperfect searches should return useful decision support.",
    "",
    "#### Likely Root Cause Area",
    "",
    ...suggestFixArea(finding),
    "",
    "#### Acceptance Criteria",
    "",
    "- A completed report must not contain only empty-state text such as `鏆傛棤` when a fallback contract applies.",
    "- If no exact project matches, the report must include adjacent/reference projects or verifiable rejection reasons.",
    "- If truly no candidate exists, the report must include searched channels, attempted query classes, candidate count, rejection reason and a concrete next search plan.",
    "- Add a mocked no-exact-match regression test that fails if the report returns pure blank output.",
    "- The user-facing wording must distinguish `no exact match`, `only weak adjacent leads`, `search budget exhausted` and `zero candidates recalled`.",
    ""
  ]);
}

function formatOtherFailures(failedChecks) {
  const nonAi = failedChecks.filter((check) => !isSpecialFunctionalCheck(check.id));
  if (nonAi.length === 0) return ["- none"];
  return nonAi.flatMap((check) => [
    `### ${check.id}`,
    "",
    `- Severity: ${check.severity}`,
    `- Category: ${check.category}`,
    `- Finding: ${failureTitle(check)}`,
    "",
    ...check.evidence.slice(0, 8).map((evidence) => `- Evidence: ${evidence}`),
    ""
  ]);
}

function isSpecialFunctionalCheck(id) {
  return id === "no-ai-empty-completed-output-defects"
    || id === "user-visible-report-quality-passed";
}

function formatRuntimeScenarioFindings(findings) {
  if (findings.length === 0) {
    return ["- No runtime scenario issue was inferred from attached command artifacts."];
  }
  return [
    "- These findings are inferred from recorded runtime artifacts. If the target project changed after the artifact time, rerun the scenario before treating the finding as current.",
    "",
    ...findings.flatMap((finding, index) => [
    `### RS-${index + 1}: ${finding.title}`,
    "",
    `- Severity: ${finding.severity}`,
    ...(finding.conclusion ? [`- Conclusion type: ${finding.conclusion}`] : []),
    ...(finding.evidenceStrength ? [`- Evidence strength: ${finding.evidenceStrength}`] : []),
    `- Source artifact: \`${finding.artifact}\``,
    ...(finding.recordedAt ? [`- Artifact recorded at: ${finding.recordedAt}`] : []),
    `- Actual result: ${finding.actual}`,
    `- Expected result: ${finding.expected}`,
    ...(finding.fixFocus ? [`- Suggested fix focus: ${finding.fixFocus}`] : []),
    `- Evidence: ${finding.evidence.join(" / ")}`,
    ""
    ])
  ];
}

function formatUserReportFindings(findings, summary = {}) {
  const checked = summary?.checkedArtifacts ?? [];
  const lines = [
    `- Checked runtime user-visible report artifacts: ${checked.length ? checked.join(", ") : "none"}`
  ];
  if (findings.length === 0) {
    lines.push("- No user-visible report quality issue was detected from attached runtime artifacts.");
    return lines;
  }

  return [
    ...lines,
    "",
    ...findings.flatMap((finding, index) => [
      `### UQ-${index + 1}: ${finding.title}`,
      "",
      `- Severity: ${finding.severity}`,
      `- Defect kind: ${finding.kind}`,
      `- Source artifact: \`${finding.artifact}\``,
      `- Actual result: ${finding.actual}`,
      `- Expected result: ${finding.expected}`,
      `- Evidence: ${finding.evidence.join(" / ")}`,
      ""
    ])
  ];
}

function collectRuntimeScenarioFindings(report) {
  const artifacts = report.execution?.commandArtifacts ?? [];
  return collectRuntimeScenarioFindingsFromArtifacts(artifacts);
}

function collectScenarioSummaries(report) {
  const artifacts = report.execution?.commandArtifacts ?? [];
  return collectScenarioSummariesFromArtifacts(artifacts);
}

function collectUrlReviews(report) {
  const review = (report.execution?.commandArtifacts ?? []).find((artifact) => /^(artifact-consumption-review|github-url-browser-review)$/i.test(artifact.name ?? ""));
  if (!review) return [];
  const parsedJsonReviews = collectJsonUrlReviews(review);
  if (parsedJsonReviews.length > 0) return parsedJsonReviews;
  const lines = normalizeColonLines(review.outputExcerpt ?? []);
  const items = [];
  let current = {};
  for (const line of lines) {
    if (line.startsWith("URL: ")) {
      if (current.url) items.push(current);
      current = { url: line.slice(5), title: "", review: "", verdict: "" };
    } else if (line.startsWith("Title: ")) {
      current.title = line.slice(7);
    } else if (line.startsWith("Review: ")) {
      current.review = line.slice(8);
    } else if (line.startsWith("Verdict: ")) {
      current.verdict = line.slice(9);
    }
  }
  if (current.url) items.push(current);
  return items;
}

function collectJsonUrlReviews(review) {
  const parsed = review.artifactConsumptionReview ?? parseJsonOrNull((review.outputExcerpt ?? []).join("\n"));
  if (!Array.isArray(parsed?.reviews)) return [];
  return parsed.reviews.map((item) => ({
    url: item.url ?? item.target ?? "",
    title: item.title ?? item.summary ?? "",
    review: [
      item.status ? `HTTP ${item.status}` : "",
      item.requirementMatch ? `match: ${item.requirementMatch}` : "",
      Array.isArray(item.signals) && item.signals.length ? `signals: ${item.signals.join(", ")}` : "",
      Array.isArray(item.evidence) && item.evidence.length ? `evidence: ${item.evidence.slice(0, 2).join(" / ")}` : ""
    ].filter(Boolean).join("; "),
    verdict: item.verdict ?? ""
  })).filter((item) => item.url);
}

function parseJsonOrNull(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeColonLines(lines) {
  const normalized = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^(URL|HTTP|Title|Review|Verdict):$/.test(line) && lines[index + 1]) {
      const label = line.slice(0, -1);
      const values = [];
      index += 1;
      while (index < lines.length && !/^(URL|HTTP|Title|Review|Verdict):$|^---$/.test(lines[index])) {
        values.push(lines[index]);
        index += 1;
      }
      normalized.push(`${label}: ${values.join(" ")}`);
      if (index < lines.length && lines[index] === "---") normalized.push("---");
      else index -= 1;
    } else {
      normalized.push(line);
    }
  }
  return normalized;
}

function formatUrlReviews(reviews) {
  const lines = [
    "| Target | Observed Summary / Title | Consumption Verdict |",
    "| --- | --- | --- |"
  ];
  if (reviews.length === 0) {
    lines.push("| none | - | No artifact-consumption review artifact attached. |");
    return lines;
  }
  for (const review of reviews) {
    lines.push(`| ${escapeTable(review.url)} | ${escapeTable(review.title)} | ${escapeTable(`${review.review}; ${review.verdict}`)} |`);
  }
  return lines;
}

function failureTitle(check) {
  if (check.id === "no-obvious-secrets") return "Obvious secret-like values were found in scanned files.";
  if (check.id === "no-obvious-fixture-overfit") return "Core source may contain fixture or documentation phrase overfit.";
  return check.title;
}

function fixVerificationPlan(findings, userReportFindings = [], failedChecks = []) {
  const otherFailures = failedChecks.filter((check) => !isSpecialFunctionalCheck(check.id));
  if (findings.length === 0 && userReportFindings.length === 0 && otherFailures.length === 0) {
    return ["- Re-run `agent-test scan` and confirm no functional smoke findings are reported."];
  }

  const lines = [];
  if (findings.length > 0 || userReportFindings.length > 0) {
    lines.push(
    "- Add or update unit tests in the target project for no-exact-match and weak-adjacent-match scenarios.",
    "- Confirm `no-ai-empty-completed-output-defects` passes.",
    "- Confirm the generated user-facing report includes useful adjacent/rejection/search evidence instead of pure blank output.",
    "- Confirm `user-visible-report-quality-passed` passes for every attached runtime user report artifact.",
    "- If user-visible output returns links, files, repositories, exports, generated code, screenshots, reports or other consumable targets, attach a fresh `artifact-consumption-review` artifact with observed summary and relevance/usefulness verdicts.",
    "- Preserve evidence artifacts so a developer or tester can verify the fix without live external calls."
    );
  }
  if (otherFailures.length > 0) {
    lines.push(
      `- Resolve failed check gate(s): ${otherFailures.map((check) => `\`${check.id}\``).join(", ")}.`,
      "- Re-run the target project's own lightweight smoke commands or test suite where available.",
      "- Re-run `agent-test scan` against the target project and confirm all failed check gates are cleared or explicitly accepted as residual risk."
    );
  }
  return unique(lines);
}

function residualRisks(report) {
  const hasUrlReview = (report.execution?.commandArtifacts ?? []).some((artifact) => /^(artifact-consumption-review|github-url-browser-review)$/i.test(artifact.name ?? ""));
  const freshness = runtimeEvidenceFreshness(report);
  return [
    "- This report is based on deterministic static prechecks and does not prove the live search path is correct.",
    "- It does not validate actual GitHub/Tavily/LLM recall quality for the sample prompt.",
    ...(freshness.staleCount > 0
      ? ["- Some runtime evidence artifacts are stale relative to report generation; concrete repository names, scores and screenshots must be refreshed before being treated as current project state."]
      : []),
    ...(freshness.weakTimestampCount > 0
      ? ["- Some runtime artifacts use file mtime rather than an internal command timestamp, so artifact currency is weaker than a freshly recorded run."]
      : []),
    hasUrlReview
      ? "- Returned consumable targets have a lightweight consumption-review artifact, but this is still a minimal user-decision check rather than a full audit."
      : "- It does not minimally consume returned links, files, generated outputs or remote README content.",
    "- A follow-up scenario-oracle test should execute representative mocked and live-safe inputs once the empty-output defect is fixed.",
    ...report.boundaries.map((boundary) => `- ${boundary}`)
  ];
}

function developerHandoff(aiFindings, runtimeFindings, failedChecks, userReportFindings = []) {
  const lines = [];
  if (aiFindings.length > 0) {
    lines.push("- Priority 1: fix the functional defect(s) listed in section 7.");
  }
  if (userReportFindings.length > 0) {
    lines.push("- Priority 1: fix the user-visible report quality defect(s) listed in section 10 before treating this QA report as complete.");
  }
  if (runtimeFindings.length > 0) {
    lines.push("- Priority 1: reproduce and fix the runtime scenario failure(s) listed in section 9.");
  }
  if (failedChecks.some((check) => check.id === "no-obvious-secrets")) {
    lines.push("- Priority 2: remove or ignore local real secret files before sharing the repository or report bundle.");
  }
  if (failedChecks.some((check) => check.id === "no-obvious-fixture-overfit")) {
    lines.push("- Priority 3: review hard-coded semantic/fixture-looking logic and confirm it is not product-specific overfit.");
  }
  const otherFailures = failedChecks.filter((check) => !isSpecialFunctionalCheck(check.id)
    && check.id !== "no-obvious-secrets"
    && check.id !== "no-obvious-fixture-overfit");
  if (otherFailures.length > 0) {
    lines.push(`- Priority 3: resolve or explicitly accept remaining failed check gate(s): ${otherFailures.map((check) => `\`${check.id}\``).join(", ")}.`);
  }
  if (lines.length === 0) {
    lines.push("- No developer action required by this report.");
  }
  return lines;
}

function requirementEvidence(finding) {
  return finding.evidence.filter((line) => isRequirementEvidence(line));
}

function actualEvidence(finding) {
  const requirement = new Set(requirementEvidence(finding));
  return finding.evidence.filter((line) => !requirement.has(line));
}

function isRequirementEvidence(line) {
  return /docs\/|README\.md|CURRENT_HANDOFF|evidence-gating/i.test(line);
}

function formatEvidenceGroup(items) {
  if (items.length === 0) return ["- no evidence recorded"];
  return unique(items).slice(0, 10).map((item) => `- ${item}`);
}

function suggestFixArea(finding) {
  const sourceEvidence = actualEvidence(finding).filter((line) => /\.[jt]sx?:|\.py:|\.html:|\.vue:|\.svelte:/.test(line));
  if (sourceEvidence.length === 0) {
    return ["- Inspect report generation, empty-state rendering and fallback candidate selection code paths."];
  }
  return unique(sourceEvidence).slice(0, 8).map((line) => `- Inspect ${line}`);
}

function highestSeverity(items) {
  const order = ["Blocker", "Critical", "Major", "Minor", "Info"];
  for (const severity of order) {
    if (items.some((item) => item.severity === severity)) return severity;
  }
  return "None";
}

const STALE_RUNTIME_ARTIFACT_MS = 6 * 60 * 60 * 1000;

function runtimeEvidenceFreshness(report) {
  const artifacts = (report.execution?.commandArtifacts ?? []).filter((artifact) => artifact.recordedAt);
  if (artifacts.length === 0) {
    return { summary: "no recorded runtime artifacts", staleCount: 0, weakTimestampCount: 0, total: 0 };
  }

  const startedAtMs = Date.parse(report.execution?.startedAt ?? "");
  if (!Number.isFinite(startedAtMs)) {
    return { summary: "unknown; report start time is unavailable", staleCount: 0, weakTimestampCount: weakTimestampArtifacts(artifacts).length, total: artifacts.length };
  }

  const latestProjectModifiedAtMs = Date.parse(report.project?.latestModifiedAt ?? "");
  const stale = artifacts.filter((artifact) => isStaleRuntimeArtifact(startedAtMs, artifact.recordedAt, latestProjectModifiedAtMs));
  const weakTimestampCount = weakTimestampArtifacts(artifacts).length;
  if (stale.length > 0) {
    return {
      summary: `stale (${stale.length}/${artifacts.length} artifact(s) older than target code or older than 6h at report generation; ${weakTimestampCount} weak timestamp source(s))`,
      staleCount: stale.length,
      weakTimestampCount,
      total: artifacts.length
    };
  }

  if (weakTimestampCount > 0) {
    return {
      summary: `uncertain (${weakTimestampCount}/${artifacts.length} artifact(s) use file mtime instead of internal command time)`,
      staleCount: 0,
      weakTimestampCount,
      total: artifacts.length
    };
  }

  return { summary: `fresh (${artifacts.length}/${artifacts.length} artifact(s) recorded within 6h)`, staleCount: 0, weakTimestampCount: 0, total: artifacts.length };
}

function runtimeArtifactFreshnessLabel(startedAt, artifact, latestProjectModifiedAt) {
  const startedAtMs = Date.parse(startedAt ?? "");
  if (!Number.isFinite(startedAtMs)) return "unknown";
  if (artifact.recordedAtSource === "file-mtime") return "uncertain; artifact lacks internal command timestamp";
  const latestProjectModifiedAtMs = Date.parse(latestProjectModifiedAt ?? "");
  return isStaleRuntimeArtifact(startedAtMs, artifact.recordedAt, latestProjectModifiedAtMs)
    ? "stale; rerun before treating this concrete output as current"
    : "fresh";
}

function isStaleRuntimeArtifact(startedAtMs, recordedAt, latestProjectModifiedAtMs = Number.NaN) {
  const recordedAtMs = Date.parse(recordedAt ?? "");
  if (!Number.isFinite(recordedAtMs)) return false;
  const olderThanReport = startedAtMs - recordedAtMs > STALE_RUNTIME_ARTIFACT_MS;
  const olderThanTargetCode = Number.isFinite(latestProjectModifiedAtMs)
    && latestProjectModifiedAtMs - recordedAtMs > 1000;
  return olderThanReport || olderThanTargetCode;
}

function weakTimestampArtifacts(artifacts) {
  return artifacts.filter((artifact) => !artifact.recordedAtSource || artifact.recordedAtSource === "file-mtime");
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function escapeTable(value) {
  return String(value).replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
}
