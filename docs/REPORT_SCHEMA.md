# Report Schema

`agent-test` writes two human-facing reports and one machine-readable report:

- `AGENT_TEST_QA_REPORT.md` for developer handoff and repair-agent input.
- `USER_QA_SUMMARY.md` for non-technical product, business or stakeholder review.
- `report.json` for automation, CI gates and historical comparison.

`AGENT_TEST_QA_REPORT.md` is the preferred handoff artifact when the goal is to ask another agent/developer to reproduce, diagnose and fix functional defects. It contains defect titles, requirement basis, test case class, actual result, expected result, suggested fix area, acceptance criteria and summarized runtime evidence.

`USER_QA_SUMMARY.md` is the preferred reading artifact when the audience only needs a concise decision report. It must reduce technical language, keep the conclusion visible near the top, summarize tested flows in plain language, and translate defects or risks into business-friendly impact and next steps.

The machine-readable contract is defined in [schemas/report.schema.json](../schemas/report.schema.json).

## Required Top-Level Fields

- `schemaVersion`: report contract version.
- `mode`: fixed execution mode, currently `acceptance`.
- `target`: original local path or GitHub URL.
- `workspace`: resolved scan workspace and dynamic execution policy.
- `project`: detected project metadata.
- `assessmentFocus`: requirement-first assessment policy for vibeCoding projects.
- `requirements`: extracted requirement candidates.
- `quality.aiDefects`: low-cost smoke findings for common AI-generated project functional defects.
- `quality.userReports`: findings from user-visible output quality gates, including empty completed output, unwanted internal content, duplicated content, missing artifact-consumption review and consumed targets that contradict report claims.
- `quality.acceptanceContract`: LLM-generated project understanding, user flows, user-visible outputs and project-specific acceptance rules.
- `checks`: executed profile checks.
- `execution`: start time, finish time, duration, runtime artifacts and token/API usage accounting.
- `boundaries`: explicit limitations of the current run.

## API Key And Token Cost

Every report must state whether the run required API keys and how much token/API cost was estimated and actually recorded. This is stored under `execution.usage`.

The single `acceptance` mode requires an LLM API key and records:

- `apiKeyRequired: true`
- `apiKeys`: accepted key environment variables, normally `AGENT_TEST_LLM_API_KEY` and `OPENAI_API_KEY`
- `llmMode: "required"`
- `preflight.estimatedInputTokens`
- `preflight.estimatedOutputTokens`
- `preflight.estimatedTotalTokens`
- `preflight.estimatedCostUsd`
- `preflight.maxCostUsd`
- `actual.inputTokens`
- `actual.outputTokens`
- `actual.totalTokens`
- `actual.costUsd`
- `actual.estimated`: whether some token usage had to be locally estimated because the provider did not return usage fields

If price configuration is missing or zero, the report must say the dollar estimate is incomplete instead of presenting a false precise cost. If prices are configured and preflight cost exceeds `llm.maxCostUsd`, `scan` fails before making the LLM call.

## Check Statuses

- `passed`: the check completed and met its condition.
- `failed`: the check completed and did not meet its condition.
- `skipped`: the check was intentionally not run.
- `blocked`: the check could not run because a required precondition was missing.
- `partial`: the check ran but coverage or evidence is incomplete.

## Test Kinds

- `deterministic`: deterministic local check, such as file existence or schema validation.
- `mocked`: behavior or structure test using controlled fixtures/mocks.
- `live-eval`: real external API or LLM-backed evaluation; results may vary.
- `manual-review`: human or LLM-assisted review that needs confirmation.

## Conclusion Types

- `failure`: confirmed failure under the stated test conditions.
- `risk`: risk or warning that may be acceptable if clearly disclosed.
- `unverified`: not tested or insufficient evidence.
- `needs-decision`: requires product/business/security decision.
- `tooling-issue`: issue in `agent-test` or the test process itself.

## Runtime Scenario Observations

Runtime scenario observations are reported separately from deterministic check gates. This is intentional:

- `checks.summary.failed` counts profile gates.
- `Runtime scenario findings` counts recorded user-flow observations that failed the runtime scenario judgment model.
- A report can therefore show `Checks failed: 0` and still show `Result: FAIL` when live user scenarios expose product-quality failures.

Scenario matrix rows use:

- `Result`: `Pass`, `Review`, `Fail`, or `Not run`.
- `Conclusion`: the report conclusion type, usually `failure`, `needs-decision`, `risk`, or `unverified`.
- `Evidence Strength`: how strong the recorded evidence is. `runtime-observation` is stronger than `weak-live-signal`; artifact consumption review is supporting evidence unless it records a direct, reproducible contradiction.

For search/recommendation/research projects, contract-weak or unsupported adjacent leads should be judged against the generated acceptance contract and scenario evidence, while no-result reports with useful search coverage and recovery guidance should generally be treated as `Review`.

## Full Functional Flow Verification

A functional acceptance report is not complete unless at least one representative end-to-end user flow has been executed and recorded. Static checks, dependency checks, `--help` commands, compile checks and narrow smoke tests are useful supporting evidence, but they do not prove the product works for a user.

The current report renderer treats runtime artifacts named like `scenario-01-*` as representative full-flow evidence. If no such scenario artifact is attached:

- with no runtime artifacts, the report result is `UNVERIFIED` unless confirmed failures exist;
- with only lightweight runtime artifacts, the report result is `PARTIAL` unless confirmed failures exist;
- the report must explain that full functional acceptance is incomplete.

When a full flow cannot run because of missing environment setup, external services, accounts, API keys, browser dependencies, databases, manual login, network access or permissions, the report should record the concrete blocker rather than presenting the project as passed or failed. The expected workflow is:

- identify the primary user flow from README/docs;
- attempt that flow and preserve the command/browser/API artifact;
- if blocked by environment, report the missing item and the exact setup action needed;
- rerun the full scenario after the blocker is resolved.

## Check Categories

- `requirement-conformance`: evidence related to whether the project matches its stated requirements.
- `runtime-usability`: evidence that the project has a usable entrypoint or can be exercised enough to verify requirements.
- `obvious-risk`: obvious delivery hazards, such as plaintext secrets, fixture overfit or hard-coded sample behavior.
- `supporting-signal`: low-weight engineering signals, such as the presence of test scripts.

For vibeCoding projects, requirement conformance is the primary category. Code elegance, structure clarity, deep security review and deep robustness review are intentionally de-emphasized unless they directly break a documented requirement or create an obvious delivery accident.

## User-Visible Output Quality

For vibeCoding projects, user-visible output is part of the functional contract. A project that claims to search, recommend, analyze, generate reports, generate code or complete a workflow must have its final user-facing output checked before the QA report is treated as complete.

`quality.userReports` records these gates:

- completed output must not be blank or only template text;
- output must not expose debug text, raw internal fields, stack traces, secrets or irrelevant tool logs;
- output must not repeat the same useful-looking content enough to mislead the user;
- returned links, repositories, files, reports, exports, generated code and references must be deduplicated and, when possible, minimally consumed;
- consumed targets must support the product's relevance/usefulness claim, or the output must clearly label them as weak, adjacent, rejected or unverified;
- project-specific relevance, scoring and candidate-quality expectations should come from the generated acceptance contract and recorded scenario evidence;
- repository/category relevance must be judged by the generated acceptance contract and recorded scenario evidence, not by built-in category labels alone.

The profile check `user-visible-report-quality-passed` is the standard gate for these findings. If relevant runtime artifacts exist and this check fails, `AGENT_TEST_QA_REPORT.md` must include developer-actionable findings in the User-Visible Report Quality section.

If a run does not include runtime artifacts for the user-facing output, the report may still contain static findings, but it must not claim complete live functional acceptance.

## Severity

Findings use the project-level severity scale:

- `Blocker`
- `Critical`
- `Major`
- `Minor`
- `Info`

MVP `basic` checks currently report mostly `Info` and `Major` severity. Deeper profiles will use higher severity when runtime, security or requirement-conformance failures are proven.
