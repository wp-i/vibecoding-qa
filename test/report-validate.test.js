import test from "node:test";
import assert from "node:assert/strict";
import { validateReport } from "../src/reports/validate.js";

test("validateReport rejects invalid check statuses", () => {
  const report = {
    schemaVersion: "0.1.0",
    mode: "basic",
    target: ".",
    workspace: {},
    project: {},
    assessmentFocus: {},
    requirements: {},
    checks: {
      items: [
        {
          id: "bad",
          title: "Bad",
          status: "unknown",
          severity: "Info",
          category: "supporting-signal",
          testKind: "deterministic",
          conclusion: "failure",
          evidence: []
        }
      ]
    },
    execution: {},
    boundaries: []
  };

  assert.throws(() => validateReport(report), /status is invalid/);
});
