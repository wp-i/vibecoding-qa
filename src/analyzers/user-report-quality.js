const USER_REPORT_ARTIFACT = /^(scenario-\d+|web-ui|browser|ui-|live-)/i;
const CONSUMPTION_REVIEW_ARTIFACT = /^(artifact-consumption-review|github-url-browser-review)$/i;

const UNWANTED_PATTERNS = [
  { label: "python traceback", pattern: /Traceback \(most recent call last\)/i },
  { label: "javascript stack trace", pattern: /\bat\s+[\w.$<>]+\s*\([^)\n]+:\d+:\d+\)/ },
  { label: "debug marker", pattern: /\b(?:DEBUG|TRACE|console\.log|print debug)\b/i },
  { label: "raw internal field", pattern: /\b(?:github_request_limit_reached|search_completeness|evidenceCoverage|coveredFeatures)\b/ },
  { label: "environment or token name", pattern: /\b(?:OPENAI_API_KEY|TAVILY_API_KEY|GITHUB_TOKEN|Bearer\s+[A-Za-z0-9_.-]+)\b/ }
];

const EMPTY_COMPLETED_PATTERNS = [
  /本次未找到足够相关的项目线索/i,
  /已整理的线索\s*[\r\n]+暂无/i,
  /暂无(?:。|\.|\s|$)/i,
  /no sufficiently relevant project/i,
  /no usable (?:project|result|lead)/i
];

const RECOVERY_EVIDENCE_PATTERNS = [
  /https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/,
  /拒绝原因|排除原因|rejected candidate|rejection reason/i,
  /搜索渠道|搜索词|query|searched/i,
  /候选数量|candidate count|召回/i,
  /下一步.*(?:关键词|query|搜索|search)/i
];

export function analyzeUserVisibleReportsFromArtifacts(artifacts = []) {
  const userArtifacts = artifacts.filter(isUserReportArtifact);
  const consumptionReviewArtifacts = artifacts.filter((artifact) => CONSUMPTION_REVIEW_ARTIFACT.test(artifact.name ?? ""));
  const findings = [];

  for (const artifact of userArtifacts) {
    const text = userVisibleText(artifact);
    if (text.trim()) {
      findings.push(...analyzeUserVisibleReportText(text, {
        artifact: artifact.path ?? artifact.name ?? "runtime artifact",
        artifactName: artifact.name ?? "runtime artifact"
      }).findings);
    }
    findings.push(...userJourneyFindings(artifact));
  }

  const consumableTargets = unique(
    userArtifacts.flatMap((artifact) => extractConsumableTargets(userVisibleText(artifact)))
  );
  if (consumableTargets.length > 0 && consumptionReviewArtifacts.length === 0) {
    findings.push({
      id: "user-report-consumable-targets-not-reviewed",
      title: "Returned user-consumable targets were not consumption-reviewed",
      severity: "Major",
      kind: "missing-artifact-consumption-review",
      artifact: "runtime artifacts",
      actual: "The user-visible report returned links or references that a real user would consume to make a decision, but no artifact-consumption-review evidence was attached.",
      expected: "A complete QA run must minimally consume returned targets, record what was observed, and check whether the product's conclusion is supported by that evidence.",
      evidence: consumableTargets.slice(0, 10)
    });
  }

  findings.push(...consumptionReviewFindings(consumptionReviewArtifacts));

  return {
    count: findings.length,
    checkedArtifacts: userArtifacts.map((artifact) => artifact.name ?? artifact.path ?? "runtime artifact"),
    findings
  };
}

function consumptionReviewFindings(artifacts) {
  const findings = [];
  for (const artifact of artifacts) {
    const review = parseReviewArtifact(artifact);
    if (!review) continue;
    const items = Array.isArray(review.reviews) ? review.reviews : [];
    for (const item of items) {
      if (!shouldFailConsumptionItem(item)) continue;
      findings.push({
        id: "user-report-consumed-target-contradicts-claim",
        title: "Consumed target does not support the report claim",
        severity: "Major",
        kind: "consumed-target-contradicts-report",
        artifact: artifact.path ?? artifact.name ?? "runtime artifact",
        actual: "A returned target was minimally consumed and the observed content does not support the product's user-facing claim.",
        expected: "Returned targets should support the report's relevance/usefulness claim, or the report should clearly label them as weak, adjacent, rejected, or unverified.",
        evidence: [
          `Target: ${item.target ?? item.url ?? "(unknown)"}`,
          `Verdict: ${item.verdict ?? item.requirementMatch ?? "(unknown)"}`,
          ...(item.claimedByReport ? [`Claimed by report: ${item.claimedByReport}`] : []),
          ...(item.summary ? [`Observed summary: ${item.summary}`] : []),
          ...((Array.isArray(item.evidence) ? item.evidence : []).slice(0, 4))
        ]
      });
    }
  }
  return findings;
}

function parseReviewArtifact(artifact) {
  if (artifact.artifactConsumptionReview && typeof artifact.artifactConsumptionReview === "object") {
    return artifact.artifactConsumptionReview;
  }

  const candidates = [
    artifact.userVisibleText,
    (artifact.outputExcerpt ?? []).join("\n")
  ].filter(Boolean);
  for (const text of candidates) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {}
  }
  return null;
}

function isNegativeConsumptionVerdict(item) {
  const values = [item?.verdict, item?.requirementMatch]
    .map((value) => String(value ?? "").toLowerCase())
    .filter(Boolean);
  return values.some((value) => (
    /^(mismatch|irrelevant|not[-_ ]?relevant|unsupported|contradicted|open-failed)$/.test(value)
  ));
}

function shouldFailConsumptionItem(item) {
  if (!isNegativeConsumptionVerdict(item)) return false;

  const hardFailure = [item?.verdict, item?.requirementMatch]
    .map((value) => String(value ?? "").toLowerCase())
    .some((value) => /^(open-failed|unsupported|contradicted)$/.test(value));
  if (hardFailure) return true;

  return !isClearlyWeakReferenceClaim(item);
}

function isClearlyWeakReferenceClaim(item) {
  const claim = String(item?.claimedByReport ?? "");
  if (!claim.trim()) return false;

  return /相邻(?:参考|方向|线索)|找灵感|不适合直接采用|核心能力[^。；\n]*(?:尚未确认|未确认)|仍未确认|weak|adjacent|not directly adoptable|unverified/i.test(claim);
}

function userJourneyFindings(artifact) {
  const sourceFindings = Array.isArray(artifact.userJourney?.findings)
    ? artifact.userJourney.findings
    : [];
  return sourceFindings.map((finding) => ({
    id: finding.id ?? "browser-user-journey-finding",
    title: finding.title ?? "Browser user journey violates visible UI contract",
    severity: finding.severity ?? "Major",
    kind: finding.kind ?? "browser-user-journey",
    artifact: artifact.path ?? artifact.name ?? "runtime artifact",
    actual: finding.actual ?? "The recorded browser journey produced behavior that conflicts with the user's likely interpretation of the UI.",
    expected: finding.expected ?? "The UI state, button wording, and next result should match the user's visible action.",
    evidence: Array.isArray(finding.evidence) ? finding.evidence.slice(0, 12) : []
  }));
}

export function analyzeUserVisibleReportText(text, options = {}) {
  const artifact = options.artifact ?? "user-visible report";
  const artifactName = options.artifactName ?? artifact;
  const normalized = normalizeText(text);
  const lines = visibleLines(normalized);
  const findings = [];

  const unwanted = findUnwantedContent(lines);
  if (unwanted.length > 0) {
    findings.push({
      id: "user-report-internal-content-visible",
      title: "User-visible report contains internal/debug content",
      severity: "Major",
      kind: "unwanted-user-visible-content",
      artifact,
      actual: "The report exposes internal diagnostics or implementation fields to the user.",
      expected: "The user-facing report should contain only useful results, limitations, evidence, and next actions.",
      evidence: unwanted.slice(0, 8)
    });
  }

  const duplicateEvidence = findDuplicateContent(lines);
  if (duplicateEvidence.length > 0) {
    findings.push({
      id: "user-report-duplicate-content",
      title: "User-visible report contains repeated content",
      severity: "Minor",
      kind: "duplicate-user-visible-content",
      artifact,
      actual: "The report repeats the same line or repository URL enough to reduce report quality.",
      expected: "The report should deduplicate repeated sections, repeated project URLs, and repeated boilerplate.",
      evidence: duplicateEvidence.slice(0, 8)
    });
  }

  if (looksLikeBlankCompletedReport(normalized)) {
    findings.push({
      id: "user-report-completed-empty-without-recovery-evidence",
      title: "Completed report is empty without useful recovery evidence",
      severity: "Critical",
      kind: "completed-empty-report",
      artifact,
      actual: "The report says the investigation is complete but gives no project, adjacent lead, rejected-candidate evidence, searched channels, or concrete recovery path.",
      expected: "If no exact match exists, the report must still provide useful adjacent projects, rejection reasons, search coverage, or a concrete next-search plan.",
      evidence: lines.filter((line) => EMPTY_COMPLETED_PATTERNS.some((pattern) => pattern.test(line))).slice(0, 8)
    });
  }

  return {
    passed: findings.length === 0,
    artifact: artifactName,
    findings
  };
}

export function isUserReportArtifact(artifact) {
  return USER_REPORT_ARTIFACT.test(artifact?.name ?? "");
}

function userVisibleText(artifact) {
  if (typeof artifact.userVisibleText === "string") return artifact.userVisibleText;
  return (artifact.outputExcerpt ?? []).join("\n");
}

function findUnwantedContent(lines) {
  const evidence = [];
  for (const line of lines) {
    const match = UNWANTED_PATTERNS.find((item) => item.pattern.test(line));
    if (match) evidence.push(`${match.label}: ${line}`);
  }
  return evidence;
}

function findDuplicateContent(lines) {
  const counts = new Map();
  const evidence = [];
  for (const line of lines) {
    const normalized = normalizeDuplicateLine(line);
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  for (const [line, count] of counts.entries()) {
    if (count >= 3) evidence.push(`${count}x ${line}`);
  }

  const urlCounts = new Map();
  for (const url of lines.flatMap(extractConsumableTargets)) {
    urlCounts.set(url, (urlCounts.get(url) ?? 0) + 1);
  }
  for (const [url, count] of urlCounts.entries()) {
    if (count >= 2) evidence.push(`${count}x ${url}`);
  }
  return evidence;
}

function looksLikeBlankCompletedReport(text) {
  const hasEmptySignal = EMPTY_COMPLETED_PATTERNS.some((pattern) => pattern.test(text));
  if (!hasEmptySignal) return false;
  const hasRecoveryEvidence = RECOVERY_EVIDENCE_PATTERNS.some((pattern) => pattern.test(text));
  return !hasRecoveryEvidence;
}

function visibleLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeText(text) {
  return String(text ?? "").replace(/\u0000/g, "");
}

function normalizeDuplicateLine(line) {
  const normalized = line.replace(/\s+/g, " ").trim();
  if (normalized.length < 24) return "";
  if (/^[#*\-_\s]+$/.test(normalized)) return "";
  return normalized.toLowerCase();
}

function extractConsumableTargets(text) {
  return [...String(text ?? "").matchAll(/https?:\/\/[^\s)>]+/g)]
    .map((match) => match[0].replace(/[),.;]+$/, ""));
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}
