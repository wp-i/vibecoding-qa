const VALID_STATUSES = new Set(["passed", "failed", "skipped", "blocked", "partial"]);
const VALID_SEVERITIES = new Set(["Blocker", "Critical", "Major", "Minor", "Info"]);
const VALID_TEST_KINDS = new Set(["deterministic", "mocked", "live-eval", "manual-review"]);
const VALID_CONCLUSIONS = new Set(["failure", "risk", "unverified", "needs-decision", "tooling-issue"]);
const VALID_CATEGORIES = new Set(["requirement-conformance", "runtime-usability", "obvious-risk", "supporting-signal"]);

export function validateReport(report) {
  const errors = [];

  requireString(report, "schemaVersion", errors);
  requireString(report, "mode", errors);
  requireString(report, "target", errors);
  requireObject(report, "workspace", errors);
  if (!Array.isArray(report.workspace?.commands)) {
    errors.push("workspace.commands must be an array");
  }
  if (!Array.isArray(report.workspace?.safety)) {
    errors.push("workspace.safety must be an array");
  }
  requireObject(report, "project", errors);
  requireObject(report, "assessmentFocus", errors);
  requireObject(report, "requirements", errors);
  requireObject(report, "security", errors);
  requireObject(report, "quality", errors);
  requireObject(report, "checks", errors);
  requireObject(report, "execution", errors);

  if (!Array.isArray(report.boundaries)) {
    errors.push("boundaries must be an array");
  }

  if (!Array.isArray(report.checks?.items)) {
    errors.push("checks.items must be an array");
  } else {
    for (const [index, item] of report.checks.items.entries()) {
      requireString(item, "id", errors, `checks.items[${index}].id`);
      requireString(item, "title", errors, `checks.items[${index}].title`);

      if (!VALID_STATUSES.has(item.status)) {
        errors.push(`checks.items[${index}].status is invalid: ${item.status}`);
      }

      if (!VALID_SEVERITIES.has(item.severity)) {
        errors.push(`checks.items[${index}].severity is invalid: ${item.severity}`);
      }

      if (!VALID_TEST_KINDS.has(item.testKind)) {
        errors.push(`checks.items[${index}].testKind is invalid: ${item.testKind}`);
      }

      if (!VALID_CONCLUSIONS.has(item.conclusion)) {
        errors.push(`checks.items[${index}].conclusion is invalid: ${item.conclusion}`);
      }

      if (!VALID_CATEGORIES.has(item.category)) {
        errors.push(`checks.items[${index}].category is invalid: ${item.category}`);
      }

      if (!Array.isArray(item.evidence)) {
        errors.push(`checks.items[${index}].evidence must be an array`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid report shape:\n- ${errors.join("\n- ")}`);
  }

  return true;
}

function requireString(object, key, errors, label = key) {
  const value = getPath(object, key);
  if (typeof value !== "string" || value.length === 0) {
    errors.push(`${label} must be a non-empty string`);
  }
}

function requireObject(object, key, errors) {
  const value = getPath(object, key);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${key} must be an object`);
  }
}

function getPath(object, path) {
  return path.split(".").reduce((current, key) => current?.[key], object);
}
