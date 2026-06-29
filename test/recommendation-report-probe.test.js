import test from "node:test";
import assert from "node:assert/strict";
import { validateRecommendationReport } from "../scripts/probes/validate_recommendation_report.mjs";

test("validateRecommendationReport accepts evidence-backed covered features", () => {
  const result = validateRecommendationReport({
    raw: {
      github_request_limit_reached: true,
      search_completeness: "limited"
    },
    topProjects: [
      {
        repo: "demo/project",
        coveredFeatures: ["deadline"],
        evidenceCoverage: [{ feature: "deadline", covered: true }]
      }
    ]
  });

  assert.equal(result.passed, true);
  assert.deepEqual(result.violations, []);
  assert.equal(result.checkedProjects, 1);
});

test("validateRecommendationReport rejects unsupported covered feature claims", () => {
  const result = validateRecommendationReport({
    raw: {
      github_request_limit_reached: true,
      search_completeness: "complete"
    },
    topProjects: [
      {
        repo: "demo/project",
        coveredFeatures: ["deadline"],
        evidenceCoverage: [{ feature: "deadline", covered: false }]
      }
    ]
  });

  assert.equal(result.passed, false);
  assert.match(result.violations.join("\n"), /without evidenceCoverage support/);
  assert.match(result.violations.join("\n"), /search_completeness/);
});
