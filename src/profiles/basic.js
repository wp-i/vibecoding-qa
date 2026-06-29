import { CHECK_CATEGORY, CONCLUSION, SEVERITY, STATUS, TEST_KIND, summarizeChecks } from "../core/status.js";

export const basicProfile = {
  id: "basic",
  title: "Basic requirement-first vibeCoding profile",
  dynamicExecution: "disabled"
};

export function runBasicProfile({
  project,
  requirements,
  security = { secrets: { count: 0, findings: [] } },
  quality = { overfit: { count: 0, findings: [] }, aiDefects: { count: 0, findings: [] } }
}) {
  const items = [
    check({
      id: "readme-present",
      title: "README is present",
      passed: project.docs.some((doc) => doc.name.toLowerCase() === "readme.md"),
      severity: SEVERITY.MAJOR,
      category: CHECK_CATEGORY.REQUIREMENT_CONFORMANCE,
      evidence: ["Expected README.md at project root."]
    }),
    check({
      id: "project-documentation-present",
      title: "Project documentation is present",
      passed: project.docs.length > 0,
      severity: SEVERITY.MAJOR,
      category: CHECK_CATEGORY.REQUIREMENT_CONFORMANCE,
      evidence: [`Detected ${project.docs.length} documentation files.`]
    }),
    check({
      id: "requirements-candidates-found",
      title: "Requirement candidates were extracted",
      passed: requirements.items.length > 0,
      severity: SEVERITY.MAJOR,
      category: CHECK_CATEGORY.REQUIREMENT_CONFORMANCE,
      evidence: [`Extracted ${requirements.items.length} requirement candidates.`]
    }),
    ...runtimeChecks(project),
    ...qualityChecks(project),
    check({
      id: "no-obvious-secrets",
      title: "No obvious secrets are present in scanned files",
      passed: security.secrets.count === 0,
      severity: SEVERITY.CRITICAL,
      category: CHECK_CATEGORY.OBVIOUS_RISK,
      evidence: security.secrets.count === 0
        ? secretPassEvidence(security.secrets)
        : security.secrets.findings.map((finding) => `${finding.kind} at ${finding.path}:${finding.line}`)
    }),
    check({
      id: "no-obvious-fixture-overfit",
      title: "Core source does not obviously hard-code fixture or documentation phrases",
      passed: quality.overfit.count === 0,
      severity: SEVERITY.MAJOR,
      category: CHECK_CATEGORY.OBVIOUS_RISK,
      conclusion: quality.overfit.count === 0 ? CONCLUSION.RISK : CONCLUSION.FAILURE,
      evidence: quality.overfit.count === 0
        ? [`No obvious fixture phrase reuse found across ${quality.overfit.phraseCount ?? 0} extracted phrases.`]
        : quality.overfit.findings.map((finding) => `${finding.phrase} in ${finding.path} from ${finding.source}`)
    }),
    check({
      id: "no-ai-empty-completed-output-defects",
      title: "AI-generated project smoke scan found no proven completed-output defects",
      passed: (quality.aiDefects?.count ?? 0) === 0,
      severity: SEVERITY.CRITICAL,
      category: CHECK_CATEGORY.REQUIREMENT_CONFORMANCE,
      conclusion: (quality.aiDefects?.count ?? 0) === 0 ? CONCLUSION.RISK : CONCLUSION.FAILURE,
      evidence: (quality.aiDefects?.count ?? 0) === 0
        ? provenAiDefectPassEvidence(quality.aiDefects)
        : quality.aiDefects.findings.flatMap((finding) => [
          `${finding.title}: ${finding.impact}`,
          `Expected: ${finding.expected}`,
          ...finding.evidence
        ])
    }),
    check({
      id: "user-visible-report-quality-passed",
      title: "Runtime user-visible reports pass core output-quality gates",
      passed: (quality.userReports?.count ?? 0) === 0,
      severity: SEVERITY.CRITICAL,
      category: CHECK_CATEGORY.REQUIREMENT_CONFORMANCE,
      conclusion: (quality.userReports?.count ?? 0) === 0 ? CONCLUSION.RISK : CONCLUSION.FAILURE,
      evidence: (quality.userReports?.count ?? 0) === 0
        ? userReportQualityPassEvidence(quality.userReports)
        : quality.userReports.findings.flatMap((finding) => [
          `${finding.title}: ${finding.actual}`,
          `Expected: ${finding.expected}`,
          ...finding.evidence
        ])
    })
  ];

  return {
    profile: basicProfile.id,
    summary: summarizeChecks(items),
    items
  };
}

function userReportQualityPassEvidence(userReports = {}) {
  const checked = userReports.checkedArtifacts?.length ?? 0;
  if (checked === 0) {
    return [
      "No runtime user-visible report artifact was attached; final QA report must be treated as incomplete for live functional acceptance."
    ];
  }
  return [`Checked ${checked} runtime user-visible report artifact(s) for empty output, unwanted internal content, duplicate content, zero-score references, directory repositories, missing artifact-consumption review and browser user-journey contract drift.`];
}

function secretPassEvidence(secrets) {
  if ((secrets.ignoredCount ?? 0) > 0) {
    return [`No unignored token patterns found. Ignored ${secrets.ignoredCount} finding(s) by configured policy.`];
  }
  return ["No obvious token patterns found in non-example scanned files."];
}

function provenAiDefectPassEvidence(aiDefects = {}) {
  const riskCount = aiDefects.signals?.emptyCompletionRisk?.length ?? 0;
  if (riskCount > 0) {
    return [
      `Observed ${riskCount} empty-output branch signal(s), but did not fail because code-path existence alone does not prove requirement violation.`
    ];
  }
  return ["No proven completed-output defect pattern found."];
}

function runtimeChecks(project) {
  if (project.projectType === "python") {
    return [
      check({
        id: "python-dependency-manifest-present",
        title: "Python dependency manifest is present",
        passed: hasAnyFile(project, ["requirements.txt", "pyproject.toml", "setup.py"]),
        severity: SEVERITY.MAJOR,
        category: CHECK_CATEGORY.RUNTIME_USABILITY,
        evidence: ["Expected requirements.txt, pyproject.toml, or setup.py."]
      }),
      check({
        id: "python-entrypoint-present",
        title: "Python entrypoint is present",
        passed: hasPythonEntrypoint(project),
        severity: SEVERITY.MAJOR,
        category: CHECK_CATEGORY.RUNTIME_USABILITY,
        evidence: ["Expected a conventional Python entrypoint such as main.py, app.py, server.py, run_web.py, cli.py, run.py, or package __main__.py."]
      })
    ];
  }

  if (project.packageJson) {
    return [
      check({
        id: "node-package-manifest-present",
        title: "Node package manifest is present",
        passed: true,
        severity: SEVERITY.INFO,
        category: CHECK_CATEGORY.RUNTIME_USABILITY,
        evidence: ["Detected package.json."]
      }),
      check({
        id: "node-test-script-present",
        title: "Node package test script is present",
        passed: Boolean(project.packageJson?.scripts?.test),
        severity: SEVERITY.INFO,
        category: CHECK_CATEGORY.SUPPORTING_SIGNAL,
        evidence: ["Expected package.json scripts.test."]
      })
    ];
  }

  return [
    check({
      id: "runtime-entrypoint-detected",
      title: "Runtime entrypoint is detected",
      passed: project.projectType !== "unknown",
      severity: SEVERITY.MAJOR,
      category: CHECK_CATEGORY.RUNTIME_USABILITY,
      evidence: [`Detected project type: ${project.projectType}.`]
    })
  ];
}

function qualityChecks(project) {
  return [
    check({
      id: "test-entrypoint-present",
      title: "Test entrypoint is present",
      passed: hasTestEntrypoint(project),
      severity: SEVERITY.INFO,
      category: CHECK_CATEGORY.SUPPORTING_SIGNAL,
      evidence: ["Expected tests directory, test file, or package test script."]
    }),
    check({
      id: "environment-example-present",
      title: "Environment example is present when configuration is required",
      passed: !requiresEnvironmentExample(project) || hasEnvironmentExample(project),
      severity: SEVERITY.INFO,
      category: CHECK_CATEGORY.OBVIOUS_RISK,
      evidence: ["Expected .env.example or *.example.env for projects using external keys/configuration."]
    })
  ];
}

function hasAnyFile(project, paths) {
  return project.files.some((file) => paths.includes(file.path));
}

function hasTestEntrypoint(project) {
  return project.files.some((file) => file.path.startsWith("tests/") || file.path.startsWith("test/") || /(^|\/)(test_.+|.+_test)\.py$/.test(file.path))
    || Boolean(project.packageJson?.scripts?.test);
}

function hasPythonEntrypoint(project) {
  return hasAnyFile(project, ["main.py", "app.py", "server.py", "run.py", "run_web.py", "cli.py"])
    || project.files.some((file) => file.path.endsWith("/__main__.py"));
}

function hasEnvironmentExample(project) {
  return hasAnyFile(project, [".env.example"]) || project.files.some((file) => file.path.endsWith(".example.env"));
}

function requiresEnvironmentExample(project) {
  return project.files.some((file) => file.path.startsWith("config/"))
    || project.files.some((file) => file.path.toLowerCase().includes("user_keys"));
}

function check({ id, title, passed, severity, category, evidence, conclusion }) {
  return {
    id,
    title,
    status: passed ? STATUS.PASSED : STATUS.FAILED,
    severity,
    category,
    testKind: TEST_KIND.DETERMINISTIC,
    conclusion: conclusion ?? (passed ? CONCLUSION.RISK : CONCLUSION.FAILURE),
    evidence
  };
}
