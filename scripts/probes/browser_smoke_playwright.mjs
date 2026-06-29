#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function parseBrowserSmokeArgs(args) {
  const options = {
    timeoutMs: 120000,
    inputSelector: "textarea",
    submitSelector: "button",
    resultSelector: "",
    apiPattern: "",
    mode: "headless",
    waitAfterClickMs: 0,
    waitBetweenSubmitsMs: 0,
    repeatSubmitCount: 1,
    nextQueries: [],
    waitForTextPattern: "",
    failOnConsoleWarning: false,
    ignoreConsolePatterns: []
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--url") {
      requireValue(arg, next);
      options.url = next;
      index += 1;
    } else if (arg === "--query") {
      requireValue(arg, next);
      options.query = next;
      index += 1;
    } else if (arg === "--query-b64") {
      requireValue(arg, next);
      options.query = Buffer.from(next, "base64").toString("utf8");
      index += 1;
    } else if (arg === "--next-query") {
      requireValue(arg, next);
      options.nextQueries.push(next);
      index += 1;
    } else if (arg === "--next-query-b64") {
      requireValue(arg, next);
      options.nextQueries.push(Buffer.from(next, "base64").toString("utf8"));
      index += 1;
    } else if (arg === "--timeout-ms") {
      requireValue(arg, next);
      options.timeoutMs = parsePositiveInteger(next, arg);
      index += 1;
    } else if (arg === "--input-selector") {
      requireValue(arg, next);
      options.inputSelector = next;
      index += 1;
    } else if (arg === "--submit-selector") {
      requireValue(arg, next);
      options.submitSelector = next;
      index += 1;
    } else if (arg === "--result-selector") {
      requireValue(arg, next);
      options.resultSelector = next;
      index += 1;
    } else if (arg === "--api-pattern") {
      requireValue(arg, next);
      options.apiPattern = next;
      index += 1;
    } else if (arg === "--wait-after-click-ms") {
      requireValue(arg, next);
      options.waitAfterClickMs = parseNonNegativeInteger(next, arg);
      index += 1;
    } else if (arg === "--wait-between-submits-ms") {
      requireValue(arg, next);
      options.waitBetweenSubmitsMs = parseNonNegativeInteger(next, arg);
      index += 1;
    } else if (arg === "--repeat-submit-count") {
      requireValue(arg, next);
      options.repeatSubmitCount = parsePositiveInteger(next, arg);
      index += 1;
    } else if (arg === "--wait-for-text-pattern") {
      requireValue(arg, next);
      options.waitForTextPattern = next;
      index += 1;
    } else if (arg === "--screenshot") {
      requireValue(arg, next);
      options.screenshot = resolve(next);
      index += 1;
    } else if (arg === "--output") {
      requireValue(arg, next);
      options.output = resolve(next);
      index += 1;
    } else if (arg === "--headed") {
      options.mode = "headed";
    } else if (arg === "--fail-on-console-warning") {
      options.failOnConsoleWarning = true;
    } else if (arg === "--ignore-console-pattern") {
      requireValue(arg, next);
      options.ignoreConsolePatterns.push(next);
      index += 1;
    } else {
      throw new Error(`Unknown browser smoke option: ${arg}`);
    }
  }

  if (!options.url) throw new Error("--url is required");
  if (!options.query) throw new Error("--query or --query-b64 is required");
  options.queries = [options.query, ...options.nextQueries];
  return options;
}

export async function runBrowserSmoke(options) {
  let playwright;
  try {
    playwright = await import("playwright");
  } catch {
    return {
      passed: false,
      setupError: "Playwright is not installed. Install it with: npm install -D playwright && npx playwright install chromium",
      url: options.url,
      checks: []
    };
  }

  let browser;
  let page;
  const consoleErrors = [];
  const consoleWarnings = [];
  const pageErrors = [];
  const failedRequests = [];
  const apiResponses = [];
  const ignoredConsole = options.ignoreConsolePatterns.map((pattern) => new RegExp(pattern));

  const checks = [];
  let finalUrl = "";
  let bodyText = "";
  let userJourney = { snapshots: [], findings: [] };
  try {
    browser = await playwright.chromium.launch({ headless: options.mode !== "headed" });
    page = await browser.newPage();

    page.on("console", (message) => {
      if (message.type() !== "error" && message.type() !== "warning") return;
      const text = message.text();
      if (ignoredConsole.some((pattern) => pattern.test(text))) return;
      if (message.type() === "error") {
        consoleErrors.push(text);
      } else {
        consoleWarnings.push(text);
      }
    });
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });
    page.on("requestfailed", (request) => {
      failedRequests.push({
        url: request.url(),
        method: request.method(),
        failure: request.failure()?.errorText ?? "request failed"
      });
    });
    page.on("response", (response) => {
      if (!options.apiPattern || !response.url().includes(options.apiPattern)) return;
      apiResponses.push({
        url: response.url(),
        status: response.status()
      });
    });

    await page.goto(options.url, { waitUntil: "domcontentloaded", timeout: options.timeoutMs });
    finalUrl = page.url();
    checks.push({ name: "page-loaded", passed: true });

    const snapshots = [];
    const queries = normalizeQueries(options);
    const input = page.locator(options.inputSelector).first();
    await input.waitFor({ state: "visible", timeout: options.timeoutMs });
    for (const [queryIndex, query] of queries.entries()) {
      await input.fill(query);
      checks.push({ name: queryIndex === 0 ? "input-filled" : `input-filled-query-${queryIndex + 1}`, passed: true });

      for (let attempt = 1; attempt <= options.repeatSubmitCount; attempt += 1) {
        const submit = page.locator(options.submitSelector).first();
        await submit.waitFor({ state: "visible", timeout: options.timeoutMs });
        const buttonBefore = await readButtonState(submit);
        const responsePromise = options.apiPattern
          ? page.waitForResponse(
            (response) => response.url().includes(options.apiPattern),
            { timeout: options.timeoutMs }
          )
          : null;

        await submit.click();
        checks.push({ name: submitCheckName("submit-clicked", queryIndex, attempt), passed: true });

        if (options.waitAfterClickMs > 0) {
          await page.waitForTimeout(options.waitAfterClickMs);
          checks.push({ name: submitCheckName("wait-after-click", queryIndex, attempt), passed: true });
        }

        if (responsePromise) {
          await responsePromise;
          checks.push({ name: submitCheckName("api-response-observed", queryIndex, attempt), passed: true });
        }

        if (options.resultSelector) {
          await page.locator(options.resultSelector).first().waitFor({ state: "visible", timeout: options.timeoutMs });
          checks.push({ name: submitCheckName("result-visible", queryIndex, attempt), passed: true });
        } else {
          await page.waitForLoadState("networkidle", { timeout: Math.min(options.timeoutMs, 30000) }).catch(() => {});
        }

        if (options.waitForTextPattern) {
          await page.waitForFunction(
            (pattern) => new RegExp(pattern).test(document.body.innerText),
            options.waitForTextPattern,
            { timeout: options.timeoutMs }
          );
          checks.push({ name: submitCheckName("text-pattern-observed", queryIndex, attempt), passed: true });
        }

        snapshots.push(await captureUserJourneySnapshot(page, submit, buttonBefore, {
          attempt,
          query,
          queryIndex
        }));
        if (attempt < options.repeatSubmitCount && options.waitBetweenSubmitsMs > 0) {
          await page.waitForTimeout(options.waitBetweenSubmitsMs);
        }
      }
    }

    userJourney = analyzeBrowserUserJourney({
      query: options.query,
      queries,
      snapshots,
      repeatSubmitCount: options.repeatSubmitCount
    });
    bodyText = (snapshots.at(-1)?.bodyText ?? "").slice(0, 2000);
    if (options.screenshot) {
      await page.screenshot({ path: options.screenshot, fullPage: true });
    }
  } catch (error) {
    if (isPlaywrightBrowserInstallError(error)) {
      return {
        passed: false,
        setupError: "Playwright browser binaries are not installed. Install Chromium with: npx playwright install chromium",
        url: options.url,
        checks
      };
    }

    checks.push({
      name: "browser-flow",
      passed: false,
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    if (browser) await browser.close();
  }

  const failedApiResponses = apiResponses.filter((response) => response.status >= 400);
  const passed =
    checks.every((check) => check.passed !== false) &&
    consoleErrors.length === 0 &&
    (!options.failOnConsoleWarning || consoleWarnings.length === 0) &&
    pageErrors.length === 0 &&
    failedRequests.length === 0 &&
    failedApiResponses.length === 0 &&
    userJourney.findings.length === 0;

  return {
    passed,
    url: options.url,
    finalUrl,
    checks,
    consoleErrors,
    consoleWarnings,
    pageErrors,
    failedRequests,
    apiResponses,
    failedApiResponses,
    screenshot: options.screenshot ?? "",
    bodyText,
    userJourney
  };
}

export function analyzeBrowserUserJourney({ query = "", queries = [], snapshots = [], repeatSubmitCount = snapshots.length } = {}) {
  const findings = [];

  for (let index = 0; index < snapshots.length - 1; index += 1) {
    const before = snapshots[index];
    const after = snapshots[index + 1];
    if (before.queryIndex !== after.queryIndex) continue;
    const label = before.buttonLabelAfter || after.buttonLabelBefore || "";
    const promisesDeeperSearch = isDeeperSearchLabel(label);
    const drift = resultDrift(before, after);
    const explained = hasResultChangeExplanation(after.bodyText) || hasResultChangeExplanation(before.bodyText);

    if (promisesDeeperSearch && drift.changed && !explained) {
      findings.push({
        id: "browser-journey-deeper-action-replaces-results",
        title: "Deeper-search action replaces prior results without explanation",
        severity: "Major",
        kind: "deeper-action-result-drift",
        actual: "After a completed search, the visible button promises a deeper or continued search, but clicking it again replaces the result set instead of clearly deepening, refining, or explaining a new search.",
        expected: "A repeat action with deeper/refinement wording should preserve and enrich the previous result, or the UI should clearly say it will start a new search/re-rank.",
        evidence: [
          `Query: ${query}`,
          `Repeat submit count: ${repeatSubmitCount}`,
          `Button after attempt ${before.attempt}: ${label || "(empty)"}`,
          `Attempt ${before.attempt} URLs: ${before.githubUrls.join(", ") || "none"}`,
          `Attempt ${after.attempt} URLs: ${after.githubUrls.join(", ") || "none"}`,
          `URL overlap: ${drift.urlOverlap}`,
          `Text similarity: ${drift.textSimilarity.toFixed(2)}`,
          `Score range before/after: ${scoreRange(before.scores)} -> ${scoreRange(after.scores)}`
        ]
      });
    }
  }

  for (let index = 0; index < snapshots.length - 1; index += 1) {
    const before = snapshots[index];
    const after = snapshots[index + 1];
    if (before.queryIndex === after.queryIndex) continue;
    if (after.attempt !== 1) continue;
    if (!queriesSubstantiallyDifferent(before.query, after.query)) continue;

    const stale = staleResultRisk(before, after);
    const explained = hasStaleResultExplanation(after.bodyText) || hasStaleResultExplanation(before.bodyText);
    if (stale.detected && !explained) {
      findings.push({
        id: "browser-journey-new-query-keeps-stale-results",
        title: "New query appears to keep stale previous results",
        severity: "Major",
        kind: "stale-results-after-query-change",
        actual: "After the user changed the input and submitted again, the visible result set stayed effectively the same without explaining that the old results were intentionally reused.",
        expected: "A new substantially different query should clear, refresh, or clearly label previous results before showing the next answer.",
        evidence: [
          `Previous query: ${before.query || query}`,
          `Next query: ${after.query || ""}`,
          `Previous URLs: ${before.githubUrls.join(", ") || "none"}`,
          `Next URLs: ${after.githubUrls.join(", ") || "none"}`,
          `URL overlap: ${stale.urlOverlap}`,
          `Text similarity: ${stale.textSimilarity.toFixed(2)}`,
          `Result hash before/after: ${before.textHash} -> ${after.textHash}`
        ]
      });
    }
  }

  return {
    snapshots,
    findings
  };
}

async function captureUserJourneySnapshot(page, submit, buttonBefore, { attempt, query, queryIndex }) {
  const bodyText = ((await page.locator("body").innerText({ timeout: 10000 }).catch(() => "")) ?? "").slice(0, 8000);
  const buttonAfter = await readButtonState(submit);
  return {
    attempt,
    query,
    queryIndex,
    buttonLabelBefore: buttonBefore.label,
    buttonEnabledBefore: buttonBefore.enabled,
    buttonLabelAfter: buttonAfter.label,
    buttonEnabledAfter: buttonAfter.enabled,
    textHash: hashText(bodyText),
    textLength: bodyText.length,
    githubUrls: unique(extractGithubUrls(bodyText)).slice(0, 25),
    scores: extractScores(bodyText).slice(0, 25),
    bodyText
  };
}

async function readButtonState(locator) {
  const [innerText, ariaLabel, title, value, enabled] = await Promise.all([
    locator.innerText({ timeout: 2000 }).catch(() => ""),
    locator.getAttribute("aria-label").catch(() => ""),
    locator.getAttribute("title").catch(() => ""),
    locator.getAttribute("value").catch(() => ""),
    locator.isEnabled().catch(() => false)
  ]);
  return {
    label: normalizeButtonLabel(innerText || ariaLabel || title || value || ""),
    enabled
  };
}

function resultDrift(before, after) {
  const textSimilarity = tokenSimilarity(before.bodyText, after.bodyText);
  const overlap = overlapCount(before.githubUrls, after.githubUrls);
  const union = unique([...before.githubUrls, ...after.githubUrls]).length;
  const hasUrlBasis = before.githubUrls.length > 0 || after.githubUrls.length > 0;
  const changedByUrls = hasUrlBasis && union > 0 && overlap / union < 0.5;
  const changedByText = before.textHash !== after.textHash && textSimilarity < 0.55;
  return {
    changed: changedByUrls || changedByText,
    urlOverlap: `${overlap}/${union || 0}`,
    textSimilarity
  };
}

function staleResultRisk(before, after) {
  const textSimilarity = tokenSimilarity(before.bodyText, after.bodyText);
  const overlap = overlapCount(before.githubUrls, after.githubUrls);
  const union = unique([...before.githubUrls, ...after.githubUrls]).length;
  const hasUrlBasis = before.githubUrls.length > 0 || after.githubUrls.length > 0;
  return {
    detected: before.textHash === after.textHash
      || (hasUrlBasis && union > 0 && overlap === union && textSimilarity > 0.9),
    urlOverlap: `${overlap}/${union || 0}`,
    textSimilarity
  };
}

function isDeeperSearchLabel(label) {
  return /(?:更深|深度|深入|继续|扩展|拓展|精炼|优化|追加|下一轮|deeper|deep|continue|more|refine|expand|enhance|improve)/i.test(label);
}

function hasResultChangeExplanation(text) {
  return /(?:重新搜索|重新生成|换一批|随机|不同结果|新搜索|new search|rerank|re-rank|different results|another search)/i.test(text);
}

function hasStaleResultExplanation(text) {
  return /(?:复用|保留|历史结果|缓存|相同结果|same result|cached|previous result|kept result)/i.test(text);
}

function queriesSubstantiallyDifferent(left, right) {
  if (!left || !right || left === right) return false;
  const similarity = tokenSimilarity(left, right);
  if (similarity < 0.35) return true;
  return Math.abs(String(left).length - String(right).length) > 16 && similarity < 0.6;
}

function normalizeQueries(options) {
  if (Array.isArray(options.queries) && options.queries.length > 0) {
    return options.queries.map((item) => String(item ?? "")).filter((item) => item.trim());
  }
  return [options.query].map((item) => String(item ?? "")).filter((item) => item.trim());
}

function submitCheckName(base, queryIndex, attempt) {
  if (queryIndex === 0 && attempt === 1) return base;
  return `${base}-query-${queryIndex + 1}-attempt-${attempt}`;
}

function extractGithubUrls(text) {
  return [...String(text ?? "").matchAll(/https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/g)]
    .map((match) => match[0].replace(/[),.;]+$/, ""));
}

function extractScores(text) {
  return [...String(text ?? "").matchAll(/(\d{1,3})\s*\/\s*100/g)]
    .map((match) => Number.parseInt(match[1], 10))
    .filter((score) => Number.isInteger(score));
}

function scoreRange(scores = []) {
  return scores.length ? `${Math.min(...scores)}-${Math.max(...scores)}/100` : "none";
}

function tokenSimilarity(left, right) {
  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);
  if (leftTokens.size === 0 && rightTokens.size === 0) return 1;
  const intersection = overlapCount([...leftTokens], [...rightTokens]);
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 1 : intersection / union;
}

function tokenSet(text) {
  return new Set(
    String(text ?? "")
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, " ")
      .split(/[^\p{L}\p{N}_-]+/u)
      .filter((token) => token.length >= 2)
      .slice(0, 1000)
  );
}

function overlapCount(left = [], right = []) {
  const rightSet = new Set(right);
  return unique(left).filter((item) => rightSet.has(item)).length;
}

function normalizeButtonLabel(label) {
  return String(label ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
}

function hashText(text) {
  return createHash("sha256").update(String(text ?? "")).digest("hex").slice(0, 16);
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function requireValue(arg, value) {
  if (!value) throw new Error(`${arg} requires a value`);
}

function parsePositiveInteger(value, label) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

function parseNonNegativeInteger(value, label) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return parsed;
}

function isPlaywrightBrowserInstallError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Executable doesn't exist") && message.includes("playwright install");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const options = parseBrowserSmokeArgs(process.argv.slice(2));
  const result = await runBrowserSmoke(options);
  const output = `${JSON.stringify(result, null, 2)}\n`;
  if (options.output) {
    await writeFile(resolve(options.output), output, "utf8");
  }
  process.stdout.write(output);
  process.exitCode = result.passed ? 0 : 1;
}
