import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeBrowserUserJourney,
  parseBrowserSmokeArgs
} from "../scripts/probes/browser_smoke_playwright.mjs";

test("parseBrowserSmokeArgs parses browser smoke options", () => {
  const parsed = parseBrowserSmokeArgs([
    "--url",
    "http://127.0.0.1:8000",
    "--query",
    "find a task app",
    "--next-query",
    "find a calendar app",
    "--input-selector",
    "#query",
    "--submit-selector",
    "#run",
    "--result-selector",
    "#results.active",
    "--api-pattern",
    "/api/search",
    "--wait-after-click-ms",
    "250",
    "--wait-between-submits-ms",
    "100",
    "--repeat-submit-count",
    "2",
    "--wait-for-text-pattern",
    "Complete|Failed",
    "--fail-on-console-warning",
    "--timeout-ms",
    "5000",
    "--output",
    "reports/browser.json",
    "--screenshot",
    "reports/browser.png",
    "--ignore-console-pattern",
    "favicon"
  ]);

  assert.equal(parsed.url, "http://127.0.0.1:8000");
  assert.equal(parsed.query, "find a task app");
  assert.deepEqual(parsed.nextQueries, ["find a calendar app"]);
  assert.deepEqual(parsed.queries, ["find a task app", "find a calendar app"]);
  assert.equal(parsed.inputSelector, "#query");
  assert.equal(parsed.submitSelector, "#run");
  assert.equal(parsed.resultSelector, "#results.active");
  assert.equal(parsed.apiPattern, "/api/search");
  assert.equal(parsed.waitAfterClickMs, 250);
  assert.equal(parsed.waitBetweenSubmitsMs, 100);
  assert.equal(parsed.repeatSubmitCount, 2);
  assert.equal(parsed.waitForTextPattern, "Complete|Failed");
  assert.equal(parsed.failOnConsoleWarning, true);
  assert.equal(parsed.timeoutMs, 5000);
  assert.deepEqual(parsed.ignoreConsolePatterns, ["favicon"]);
});

test("parseBrowserSmokeArgs decodes base64 query", () => {
  const query = "Chinese natural language requirement";
  const parsed = parseBrowserSmokeArgs([
    "--url",
    "http://127.0.0.1:8000",
    "--query-b64",
    Buffer.from(query, "utf8").toString("base64")
  ]);

  assert.equal(parsed.query, query);
});

test("parseBrowserSmokeArgs requires url and query", () => {
  assert.throws(() => parseBrowserSmokeArgs(["--query", "x"]), /--url is required/);
  assert.throws(() => parseBrowserSmokeArgs(["--url", "http://127.0.0.1:8000"]), /--query or --query-b64 is required/);
});

test("analyzeBrowserUserJourney flags deeper-search result drift", () => {
  const result = analyzeBrowserUserJourney({
    query: "find a domain alpha reporting tool with evidence",
    repeatSubmitCount: 2,
    snapshots: [
      {
        attempt: 1,
        queryIndex: 0,
        query: "find a domain alpha reporting tool with evidence",
        buttonLabelAfter: "Run deeper search",
        githubUrls: ["https://github.com/demo/first-tool", "https://github.com/demo/second-tool"],
        scores: [82, 74],
        textHash: "a",
        bodyText: "Recommended projects https://github.com/demo/first-tool https://github.com/demo/second-tool"
      },
      {
        attempt: 2,
        queryIndex: 0,
        query: "find a domain alpha reporting tool with evidence",
        buttonLabelBefore: "Run deeper search",
        githubUrls: ["https://github.com/other/unrelated"],
        scores: [12],
        textHash: "b",
        bodyText: "Recommended project https://github.com/other/unrelated"
      }
    ]
  });

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].kind, "deeper-action-result-drift");
});

test("analyzeBrowserUserJourney flags stale results after a new query", () => {
  const result = analyzeBrowserUserJourney({
    queries: ["find a scheduling workflow board", "analyze media evidence reports"],
    repeatSubmitCount: 1,
    snapshots: [
      {
        attempt: 1,
        queryIndex: 0,
        query: "find a scheduling workflow board",
        buttonLabelAfter: "Search",
        githubUrls: ["https://github.com/demo/domain-alpha-tool"],
        scores: [88],
        textHash: "same",
        bodyText: "Recommended project https://github.com/demo/domain-alpha-tool score 88/100"
      },
      {
        attempt: 1,
        queryIndex: 1,
        query: "analyze media evidence reports",
        buttonLabelBefore: "Search",
        githubUrls: ["https://github.com/demo/domain-alpha-tool"],
        scores: [88],
        textHash: "same",
        bodyText: "Recommended project https://github.com/demo/domain-alpha-tool score 88/100"
      }
    ]
  });

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].kind, "stale-results-after-query-change");
});
