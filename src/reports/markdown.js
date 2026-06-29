export function renderMarkdownReport(report) {
  const lines = [
    "# agent-test Report",
    "",
    `- Target: \`${report.target}\``,
    `- Mode: \`${report.mode}\``,
    `- Workspace: \`${report.workspace.kind}\``,
    `- Dynamic execution: \`${report.workspace.dynamicExecution}\``,
    `- Duration: ${report.execution.durationMs} ms`,
    "",
    "## Assessment Focus",
    "",
    `- Primary: ${report.assessmentFocus?.primary ?? "requirement-conformance"}`,
    `- Requirement conformance weight: ${report.assessmentFocus?.weights?.requirementConformance ?? 90}`,
    `- Obvious risk weight: ${report.assessmentFocus?.weights?.obviousRisk ?? 10}`,
    "",
    "## Project",
    "",
    `- Type: ${report.project.projectType}`,
    `- Package manager: ${report.project.packageManager}`,
    `- Files scanned: ${report.project.fileCount}`,
    `- Scan truncated: ${report.project.scanLimit.truncated}`,
    `- Markdown files: ${report.project.markdownFiles.length}`,
    "",
    "### Workspace Safety",
    "",
    ...formatList(report.workspace.safety),
    "",
    "### Preparation Commands",
    "",
    ...formatList(report.workspace.commands),
    "",
    "### Languages",
    "",
    ...formatLanguages(report.project.languages),
    "",
    "## Basic Checks",
    "",
    `- Passed: ${report.checks.summary.passed}/${report.checks.summary.total}`,
    `- Failed: ${report.checks.summary.failed}/${report.checks.summary.total}`,
    "",
    ...report.checks.items.map((item) => `- ${statusMark(item.status)} ${item.title} (${item.id}, ${item.category}, ${item.testKind}, ${item.conclusion})`),
    "",
    "### Evidence",
    "",
    ...formatEvidence(report.checks.items),
    "",
    "## Security",
    "",
    `- Secret findings: ${report.security?.secrets?.count ?? 0}`,
    `- Ignored secret findings: ${report.security?.secrets?.ignoredCount ?? 0}`,
    "",
    ...formatSecretFindings(report.security?.secrets?.findings ?? []),
    "",
    "### Ignored Secret Findings",
    "",
    ...formatIgnoredSecretFindings(report.security?.secrets?.ignored ?? []),
    "",
    "## Quality Risks",
    "",
    `- Overfit findings: ${report.quality?.overfit?.count ?? 0}`,
    `- AI project smoke findings: ${report.quality?.aiDefects?.count ?? 0}`,
    `- User-visible report quality findings: ${report.quality?.userReports?.count ?? 0}`,
    "",
    ...formatOverfitFindings(report.quality?.overfit?.findings ?? []),
    "",
    "### AI Project Smoke Findings",
    "",
    ...formatAiDefectFindings(report.quality?.aiDefects?.findings ?? []),
    "",
    "### User-Visible Report Quality Findings",
    "",
    ...formatUserReportFindings(report.quality?.userReports?.findings ?? []),
    "",
    "## Requirement Candidates",
    "",
    `Extracted candidates: ${report.requirements.count}`,
    "",
    ...formatRequirements(report.requirements.items),
    "",
    "## Boundaries",
    "",
    ...report.boundaries.map((boundary) => `- ${boundary}`),
    ""
  ];

  return `${lines.join("\n")}\n`;
}

function formatSecretFindings(findings) {
  if (findings.length === 0) return ["- none"];
  return findings.map((finding) => `- ${finding.kind} at ${finding.path}:${finding.line}`);
}

function formatIgnoredSecretFindings(findings) {
  if (findings.length === 0) return ["- none"];
  return findings.map((finding) => `- ${finding.kind} at ${finding.path}:${finding.line} (${finding.reason})`);
}

function formatOverfitFindings(findings) {
  if (findings.length === 0) return ["- none"];
  return findings.map((finding) => `- ${finding.phrase} in ${finding.path} from ${finding.source}`);
}

function formatAiDefectFindings(findings) {
  if (findings.length === 0) return ["- none"];
  return findings.flatMap((finding) => [
    `- ${finding.severity}: ${finding.title}`,
    `  - Impact: ${finding.impact}`,
    `  - Expected: ${finding.expected}`,
    ...finding.evidence.slice(0, 8).map((evidence) => `  - Evidence: ${evidence}`)
  ]);
}

function formatUserReportFindings(findings) {
  if (findings.length === 0) return ["- none"];
  return findings.flatMap((finding) => [
    `- ${finding.severity}: ${finding.title}`,
    `  - Artifact: ${finding.artifact}`,
    `  - Actual: ${finding.actual}`,
    `  - Expected: ${finding.expected}`,
    ...finding.evidence.slice(0, 8).map((evidence) => `  - Evidence: ${evidence}`)
  ]);
}

function formatEvidence(items) {
  return items.flatMap((item) => {
    if (!item.evidence?.length) return [`- ${item.id}: no evidence recorded`];
    return item.evidence.map((evidence) => `- ${item.id}: ${evidence}`);
  });
}

function formatLanguages(languages) {
  if (languages.length === 0) return ["- none detected"];
  return languages.map((language) => `- ${language.name}: ${language.count}`);
}

function formatList(items) {
  if (!items || items.length === 0) return ["- none"];
  return items.map((item) => `- ${item}`);
}

function formatRequirements(items) {
  if (items.length === 0) return ["- none"];

  return items
    .slice(0, 30)
    .map((item) => `- ${item.source}:${item.line} ${item.text}`);
}

function statusMark(status) {
  if (status === "passed") return "[PASS]";
  if (status === "failed") return "[FAIL]";
  return `[${status.toUpperCase()}]`;
}
