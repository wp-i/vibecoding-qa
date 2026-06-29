const VERY_WEAK_SCORE_MAX = 10;
const USABLE_SCORE_MIN = 50;

export function collectRuntimeScenarioFindingsFromArtifacts(artifacts = []) {
  return artifacts.flatMap((artifact) => runtimeScenarioFindingsForArtifact(artifact));
}

export function collectScenarioSummariesFromArtifacts(artifacts = []) {
  return artifacts
    .filter((artifact) => isScenarioArtifact(artifact))
    .map((artifact) => {
      const classification = classifyScenarioArtifact(artifact);
      return {
        name: artifact.name,
        exitCode: artifact.exitCode,
        urlCount: classification.urlCount,
        scoreRange: classification.scoreRange,
        signals: classification.signals,
        result: classification.result,
        conclusion: classification.conclusion,
        evidenceStrength: classification.evidenceStrength
      };
    });
}

export function classifyScenarioArtifact(artifact) {
  const text = scenarioText(artifact);
  const scores = extractScores(text);
  const urls = extractGithubUrls(text);
  const signals = scenarioSignals(text);
  const bestScore = scores.length ? Math.max(...scores) : null;
  const scoreRange = scores.length ? `${Math.min(...scores)}-${Math.max(...scores)}/100` : "none";
  const hasUsefulEmptyRecovery = hasRecoveryEvidence(text);
  const veryWeakLead = bestScore !== null && bestScore <= VERY_WEAK_SCORE_MAX;
  const lowConfidenceLead = bestScore !== null && bestScore < USABLE_SCORE_MIN;
  const explicitlyWeak = signals.includes("not directly adoptable")
    || signals.includes("core capability unconfirmed")
    || signals.includes("adjacent only");

  if (artifact.timedOut) {
    return {
      urlCount: urls.length,
      scoreRange,
      signals: unique([...signals, "command timed out"]),
      result: "Fail",
      conclusion: "tooling-issue",
      evidenceStrength: "runtime-observation",
      title: "Real user scenario was blocked or timed out",
      actual: "The representative full-flow command did not finish before the configured timeout, so user-visible completion could not be verified.",
      expected: "Representative user scenarios should either complete or fail with a clear actionable error before output quality is judged.",
      fixFocus: "Determine whether the timeout came from target-project behavior or test-environment readiness. Check external services, browser automation, manual login, API keys, databases, network access and long-running child processes; resolve the blocker and rerun the same scenario."
    };
  }

  if (artifact.exitCode !== 0) {
    return {
      urlCount: urls.length,
      scoreRange,
      signals: unique([...signals, "command failed"]),
      result: "Fail",
      conclusion: "failure",
      evidenceStrength: "runtime-observation",
      title: "Real user scenario command failed",
      actual: "The scenario command did not complete successfully.",
      expected: "Representative user scenarios should complete without command/runtime failure before result quality is judged."
    };
  }

  if (veryWeakLead || (lowConfidenceLead && explicitlyWeak)) {
    return {
      urlCount: urls.length,
      scoreRange,
      signals,
      result: "Fail",
      conclusion: "failure",
      evidenceStrength: "runtime-observation",
      title: "Real user scenario returned only very weak decision support",
      actual: "The executed scenario completed successfully but returned very low-score, explicitly weak, or core-unconfirmed leads as organized results.",
      expected: "A completed research/recommendation report should return directly usable results when available; if only very weak leads remain, it should present them as search failure context rather than normal organized leads.",
      fixFocus: "Tighten core intent extraction and candidate admission: do not let generic terms such as open-source/tool/project dominate when the scenario requires specific capabilities, and keep very weak adjacent leads out unless they are explicitly useful to the user's next decision."
    };
  }

  if (lowConfidenceLead) {
    return {
      urlCount: urls.length,
      scoreRange,
      signals: unique([...signals, "low confidence lead"]),
      result: "Review",
      conclusion: "needs-decision",
      evidenceStrength: "weak-live-signal",
      title: "Real user scenario returned low-confidence leads",
      actual: "The scenario returned candidates below the normal usable-confidence threshold.",
      expected: "Low-confidence leads should be reviewed against the product contract and labeled clearly as weak, adjacent, rejected, or unverified."
    };
  }

  if (urls.length === 0 && hasNoResultSignal(text)) {
    return {
      urlCount: 0,
      scoreRange,
      signals: unique([...signals, hasUsefulEmptyRecovery ? "empty with recovery evidence" : "empty without recovery evidence"]),
      result: hasUsefulEmptyRecovery ? "Review" : "Fail",
      conclusion: hasUsefulEmptyRecovery ? "needs-decision" : "failure",
      evidenceStrength: hasUsefulEmptyRecovery ? "weak-live-signal" : "runtime-observation",
      title: "Real user scenario completed with no consumable result",
      actual: hasUsefulEmptyRecovery
        ? "The scenario returned no candidate but included search coverage, filter reason, or recovery guidance."
        : "The scenario returned no candidate and did not include enough recovery evidence for a user to decide what to do next.",
      expected: "No-result reports should either provide useful recovery evidence or return meaningful adjacent/rejection evidence."
    };
  }

  return {
    urlCount: urls.length,
    scoreRange,
    signals,
    result: "Pass",
    conclusion: "risk",
    evidenceStrength: "runtime-smoke",
    title: "Real user scenario produced a usable result",
    actual: "The scenario produced no obvious low-score or empty-output quality signal.",
    expected: "The scenario should produce a result aligned with the user's request."
  };
}

function runtimeScenarioFindingsForArtifact(artifact) {
  if (!isScenarioArtifact(artifact)) return [];
  const classification = classifyScenarioArtifact(artifact);
  if (classification.result !== "Fail") return [];

  return [{
    title: classification.title,
    severity: "Major",
    category: "requirement-conformance",
    conclusion: classification.conclusion,
    evidenceStrength: classification.evidenceStrength,
    artifact: artifact.path,
    recordedAt: artifact.recordedAt,
    actual: classification.actual,
    expected: classification.expected,
    fixFocus: classification.fixFocus,
    evidence: (artifact.outputExcerpt ?? []).slice(0, 16)
  }];
}

function isScenarioArtifact(artifact) {
  return /^scenario-\d+/i.test(artifact?.name ?? "");
}

function scenarioText(artifact) {
  return [
    artifact?.userVisibleText,
    ...(artifact?.outputExcerpt ?? [])
  ].filter(Boolean).join("\n");
}

function hasRecoveryEvidence(text) {
  return /searched|rejection reason|filter reason|coverage|next search|search coverage|candidate count|key gap/i.test(text)
    || /已查找方向|筛选原因|关键缺口|下一步|搜索覆盖|候选数量|排除原因/.test(text);
}

function hasNoResultSignal(text) {
  return /no usable lead|no sufficiently relevant|no candidate|not found/i.test(text)
    || /暂无|未找到|没有找到/.test(text);
}

function scenarioSignals(text) {
  const signals = [];
  if (/not directly adoptable|not suitable/i.test(text) || /不适合直接采用/.test(text)) signals.push("not directly adoptable");
  if (/no directly usable result/i.test(text) || /没有找到可直接使用的项目/.test(text)) signals.push("no directly usable result");
  if (/core capability.*unconfirmed|unconfirmed core capability/i.test(text) || /核心能力.*(?:尚未确认|未确认)|仍未确认/.test(text)) signals.push("core capability unconfirmed");
  if (/adjacent(?: reference| direction| lead)?|weak adjacent/i.test(text) || /相邻(?:参考|方向|线索)/.test(text)) signals.push("adjacent only");
  if (/暂无/.test(text)) signals.push("empty section");
  return signals;
}

function extractScores(text) {
  return [...String(text ?? "").matchAll(/(\d{1,3})\s*\/\s*100/g)]
    .map((match) => Number.parseInt(match[1], 10))
    .filter((score) => Number.isInteger(score));
}

function extractGithubUrls(text) {
  return unique([...String(text ?? "").matchAll(/https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/g)].map((match) => match[0]));
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}
