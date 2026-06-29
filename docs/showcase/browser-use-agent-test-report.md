# Functional Acceptance QA Report

## 1. Report Summary

- Target: `https://github.com/browser-use/browser-use`
- Mode: `basic`
- Result: **FAIL**
- Highest severity: Critical
- Checks passed: 9/11
- Checks failed: 2/11
- Failed check gates: `no-obvious-secrets`, `no-obvious-fixture-overfit`
- Functional defects: 0
- Runtime scenario findings: 0
- User-visible report quality findings: 0
- Other obvious findings: 2
- Full functional flow status: not-run
- Runtime evidence freshness: no recorded runtime artifacts
- Assessment focus: requirement-conformance

- Note: check gate counts and live scenario observations are separate. A live scenario can be marked Review without failing a gate when it needs human/product judgment rather than showing a clear current defect.

No functional smoke defect was detected in this run, but other obvious risks require review before sharing or accepting the project.

## 2. Test Objective

This report evaluates whether the target project can satisfy its documented user-facing requirements, with special emphasis on high-frequency defects found in AI-generated or low-human-intervention projects.

The goal is not to judge code elegance. The goal is to produce a developer-actionable QA report comparable to a human tester's report: failed requirement, test case, reproduction path, actual result, expected result, evidence, impact and acceptance criteria.

## 3. Scope And Method

- Test type: low-cost functional acceptance precheck.
- Project class: AI-generated or low-human-intervention vibeCoding project.
- Execution policy: static scan plus attached runtime scenario artifacts when available.
- Evidence sources: project documentation, README/handoff files, source code report branches, generated scan artifacts, recorded command outputs and artifact-consumption review artifacts.
- Primary oracle: documented user-value contract versus implemented user-facing output behavior.
- Excluded from primary judgment: code elegance, deep architecture review, deep security review, deep robustness review.

### Generated Artifacts

- `AGENT_TEST_QA_REPORT.md`: single human/developer/agent handoff report.
- `report.json`: machine-readable scan result.
- Runtime artifacts remain under `runtime/` and are summarized in this report; they are supporting evidence, not additional handoff reports.

### Runtime Scenario Judgment

- Runtime scenarios are user-flow observations and are reported separately from deterministic check gates.
- `Fail` means the recorded user scenario produced a clear user-value failure under the captured evidence.
- `Review` means the scenario needs product judgment or deeper evidence, such as no-result output with useful recovery guidance or low-confidence leads clearly labeled as weak.
- Artifact consumption review is supporting evidence; shallow link/page consumption can reveal obvious mismatch, but it is not treated as a complete external-search audit.

### API Key And Token Cost

- API key required: no
- Required API keys: none
- LLM mode: `no-llm`
- Preflight token estimate: input=0, output=0, total=0
- Preflight cost estimate: $0 (max configured: $0)
- Actual token usage: input=0, output=0, total=0
- Actual recorded cost: $0
- Preflight note: basic mode is deterministic and does not call LLM or paid external APIs
- Actual usage note: no LLM/API token usage was recorded

### Full Functional Flow Verification

- Status: **not-run**
- Result contribution: **UNVERIFIED**
- Reason: No runtime command artifact was attached, so the project was not exercised through a user-visible flow.
- Blocking factor: No executable functional-flow evidence is available for this report.
- Next step: Identify the documented primary user flow from README/docs.
- Next step: Attempt that flow in the test environment and record the command/browser/API evidence.
- Next step: If setup is blocked, report the concrete missing environment item and retry after it is provided.

### Runtime Evidence Artifacts

- No runtime command artifact was attached to this scan.

### Live Scenario Matrix

| Scenario | Exit | URLs | Score Range | Key Signals | Result | Conclusion | Evidence Strength |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| none | - | 0 | - | No live scenario artifacts attached | Not run | unverified | none |

## 4. Requirement Traceability

| Requirement / Contract | Verification Status | Evidence |
| --- | --- | --- |
| Completed output must degrade to useful references or explain lack of candidates | Observed; not failed by static scan | CLOUD.md:17 A Browser Profile is a folder of browser data that is saved on our Cloud. If a user creates a Session with a Browser that has no Browser Profile, no data will persist. However, if they use the same Browser Profile across multiple Sessions, then data such as authentication cookies, site local storage data, saved passwords and credentials, and user preferences will persist. A Browser Profile is essentially a cloud hosted Chrome Profile, in fact, through the Profile Upload feature, a user can upload a Chrome profile from their own machine to be used on the Cloud in Sessions. This is great for giving authentication to Agents. A user can create a Chrome profile on their own machine, log into all of the services they want, and then upload this profile to the Cloud for automations. |
| Completed output must degrade to useful references or explain lack of candidates | Observed; not failed by static scan | skills/qa/SKILL.md:22 **You have no vision (text-only model, no image support)** → you **cannot** judge screenshots, and neither can same-model subagents you'd spawn. You **must** hand the visual judgment to **Browser Use v2 cloud agents**, whose own LLM looks at the page server-side and returns a text verdict (`judge` pass/fail + a 1–5 `structuredOutput`). Use v2 for **every** flow — even a single one — per `references/browser-use-v2.md`. Do **not** drive `browser-harness` yourself to read screenshots, and do **not** fan out to your own (equally blind) subagents. The single-flow-vs-fan-out choice below does not apply to you — it's v2 either way. |
| Completed output must degrade to useful references or explain lack of candidates | Observed; not failed by static scan | skills/qa/SKILL.md:32 **Browser Use v2 cloud agents — recommended.** Each flow becomes an autonomous v2 task with **`judge`** (pass/fail) + **`structuredOutput`** (1–5 score), running server-side and **in parallel**, returning step-by-step screenshot evidence. **Spends Browser Use credits** (~$0.01/task + ~$0.006/step + $0.02/hr browser). Per-task flow + how to fan out: `references/browser-use-v2.md`. |
| Completed output must degrade to useful references or explain lack of candidates | Observed; not failed by static scan | skills/qa/SKILL.md:73 **No vision (text-only)?** → use **v2 cloud agents for every flow** (one v2 task per flow, each with `judge` + a 1–5 `structuredOutput`), per `references/browser-use-v2.md`. Skip the single-flow/subagent split below — it's v2 regardless of scale. Tunnel a `localhost` target and pass the public `startUrl`. |
| Completed output must degrade to useful references or explain lack of candidates | Observed; not failed by static scan | skills/qa/SKILL.md:76 **v2 agents (recommended)** → per `references/browser-use-v2.md`, create one task per flow (each with `judge` + a 1–5 `structuredOutput` schema), poll them all, and collect the verdicts. A `localhost` target still needs a tunnel (the cloud agent can't reach localhost) — tunnel it and pass the public `startUrl`. |

## 5. Test Case Matrix

| Case ID | Purpose | Input Class | Oracle | Result |
| --- | --- | --- | --- | --- |
| TC-AI-EMPTY-001 | Detect completed empty output | No exact match with fallback contract | Completed output still provides value | Pass |

## 6. Defect List

| ID | Severity | Category | Title | Status |
| --- | --- | --- | --- | --- |
| none | - | - | No open functional defects | Closed |

## 7. Detailed Defects

- No functional defects detected.

## 8. Other Findings

### no-obvious-secrets

- Severity: Critical
- Category: obvious-risk
- Finding: Obvious secret-like values were found in scanned files.

- Evidence: openai-compatible-key at .github/workflows/test.yaml:73
- Evidence: openai-compatible-key at CLOUD.md:474
- Evidence: openai-compatible-key at CLOUD.md:484
- Evidence: openai-compatible-key at CLOUD.md:626
- Evidence: openai-compatible-key at CLOUD.md:636
- Evidence: openai-compatible-key at CLOUD.md:796
- Evidence: openai-compatible-key at CLOUD.md:806
- Evidence: openai-compatible-key at CLOUD.md:1784

### no-obvious-fixture-overfit

- Severity: Major
- Category: obvious-risk
- Finding: Core source may contain fixture or documentation phrase overfit.

- Evidence: Browser session started in browser_use/actor/playground/playground.py from tests/scripts/debug_iframe_scrolling.py
- Evidence: Task completed successfully in browser_use/agent/prompts.py from tests/ci/conftest.py
- Evidence: Task completed successfully in browser_use/agent/service.py from tests/ci/conftest.py
- Evidence: cannot be completed in browser_use/agent/service.py from tests/ci/test_action_loop_detection.py
- Evidence: New step A in browser_use/agent/service.py from tests/ci/test_agent_planning.py
- Evidence: Cannot provide both file_system_state in browser_use/agent/service.py from tests/ci/test_beta_agent.py
- Evidence: 📝 Saved initial actions to history as step 0 in browser_use/agent/service.py from tests/ci/test_beta_agent.py
- Evidence: Initial actions completed in browser_use/agent/service.py from tests/ci/test_beta_agent.py


## 9. Runtime Scenario Findings

- No runtime scenario issue was inferred from attached command artifacts.

## 10. User-Visible Report Quality

- Checked runtime user-visible report artifacts: none
- No user-visible report quality issue was detected from attached runtime artifacts.

## 11. Artifact Consumption Review

| Target | Observed Summary / Title | Consumption Verdict |
| --- | --- | --- |
| none | - | No artifact-consumption review artifact attached. |

## 12. Fix Verification Plan

- Resolve failed check gate(s): `no-obvious-secrets`, `no-obvious-fixture-overfit`.
- Re-run the target project's own lightweight smoke commands or test suite where available.
- Re-run `agent-test scan` against the target project and confirm all failed check gates are cleared or explicitly accepted as residual risk.

## 13. Residual Risks And Untested Areas

- This report is based on deterministic static prechecks and does not prove the live search path is correct.
- It does not validate actual GitHub/Tavily/LLM recall quality for the sample prompt.
- It does not minimally consume returned links, files, generated outputs or remote README content.
- A follow-up scenario-oracle test should execute representative mocked and live-safe inputs once the empty-output defect is fixed.
- MVP basic mode does not install dependencies or execute target project code.
- GitHub targets are cloned for static analysis only.
- Requirement extraction is heuristic and requires human review.
- The assessment is requirement-first for vibeCoding projects: functional conformance dominates, while style, architecture, deep security and deep robustness are intentionally de-emphasized.

## 14. Developer Handoff

- Priority 2: remove or ignore local real secret files before sharing the repository or report bundle.
- Priority 3: review hard-coded semantic/fixture-looking logic and confirm it is not product-specific overfit.

