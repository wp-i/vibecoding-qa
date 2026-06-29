export const STATUS = Object.freeze({
  PASSED: "passed",
  FAILED: "failed",
  SKIPPED: "skipped",
  BLOCKED: "blocked",
  PARTIAL: "partial"
});

export const SEVERITY = Object.freeze({
  BLOCKER: "Blocker",
  CRITICAL: "Critical",
  MAJOR: "Major",
  MINOR: "Minor",
  INFO: "Info"
});

export const TEST_KIND = Object.freeze({
  DETERMINISTIC: "deterministic",
  MOCKED: "mocked",
  LIVE_EVAL: "live-eval",
  MANUAL_REVIEW: "manual-review"
});

export const CONCLUSION = Object.freeze({
  FAILURE: "failure",
  RISK: "risk",
  UNVERIFIED: "unverified",
  NEEDS_DECISION: "needs-decision",
  TOOLING_ISSUE: "tooling-issue"
});

export const CHECK_CATEGORY = Object.freeze({
  REQUIREMENT_CONFORMANCE: "requirement-conformance",
  RUNTIME_USABILITY: "runtime-usability",
  OBVIOUS_RISK: "obvious-risk",
  SUPPORTING_SIGNAL: "supporting-signal"
});

export function summarizeChecks(items) {
  return items.reduce(
    (summary, item) => {
      summary.total += 1;
      summary[item.status] += 1;
      return summary;
    },
    { total: 0, passed: 0, failed: 0, skipped: 0, blocked: 0, partial: 0 }
  );
}
