# Functional Acceptance QA Report

## 1. Report Summary

- Target: `D:\code\github-deepSearch`
- Mode: `basic`
- Result: **FAIL**
- Highest severity: Major
- Checks passed: 11/11
- Checks failed: 0/11
- Failed check gates: none
- Functional defects: 0
- Runtime scenario findings: 2
- User-visible report quality findings: 0
- Other obvious findings: 0
- Runtime evidence freshness: uncertain (9/9 artifact(s) use file mtime instead of internal command time)
- Assessment focus: requirement-conformance

- Note: check gate counts and live scenario observations are separate. A live scenario can be marked Review without failing a gate when it needs human/product judgment rather than showing a clear current defect.
- Timestamp warning: at least one runtime artifact lacks an internal command timestamp and is dated by file mtime only. If files were copied or regenerated, rerun before treating concrete evidence as current.

The target project has at least one real user scenario failure. Completed execution did not produce a directly usable relevant result for the attached scenario artifact(s).

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

### Runtime Evidence Artifacts

- artifact-consumption-manifest.json: exitCode=null, timedOut=null, durationMs=null
  - Command: ``
  - Artifact: `D:\code\agent-test\reports\examples\github-deepSearch\full-user-artifact-retest-20260628\runtime\artifact-consumption-manifest.json`
- artifact-consumption-review: exitCode=1, timedOut=false, durationMs=23970
  - Recorded at: 2026-06-27T20:29:53.661Z
  - Recorded-at source: file-mtime
  - Freshness: uncertain; artifact lacks internal command timestamp
  - Summary: "passed": false,
  - Output excerpt: { / "passed": false, / "cases": [
  - Command: `node scripts\probes\artifact_consumption_review.mjs --manifest D:\code\agent-test\reports\examples\github-deepSearch\full-user-artifact-retest-20260628\runtime\artifact-consumption-manifest.json --max-urls-per-case 3 --timeout-ms 60000`
  - Artifact: `D:\code\agent-test\reports\examples\github-deepSearch\full-user-artifact-retest-20260628\runtime\artifact-consumption-review.json`
- compileall-current: exitCode=0, timedOut=false, durationMs=290
  - Recorded at: 2026-06-27T20:19:55.370Z
  - Recorded-at source: file-mtime
  - Freshness: uncertain; artifact lacks internal command timestamp
  - Command: `D:\code\github-deepSearch\.venv\Scripts\python.exe -m compileall -q github_deep_search tests`
  - Artifact: `D:\code\agent-test\reports\examples\github-deepSearch\full-user-artifact-retest-20260628\runtime\compileall-current.json`
- pytest-current: exitCode=0, timedOut=false, durationMs=12555
  - Recorded at: 2026-06-27T20:20:07.418Z
  - Recorded-at source: file-mtime
  - Freshness: uncertain; artifact lacks internal command timestamp
  - Summary: ======================= 96 passed, 1 skipped in 11.46s ========================
  - Output excerpt: ============================= test session starts ============================= / platform win32 -- Python 3.12.7, pytest-9.1.0, pluggy-1.6.0 / rootdir: D:\code\github-deepSearch
  - Command: `D:\code\github-deepSearch\.venv\Scripts\python.exe -m pytest`
  - Artifact: `D:\code\agent-test\reports\examples\github-deepSearch\full-user-artifact-retest-20260628\runtime\pytest-current.json`
- scenario-01-douyin-hot-video-comments: exitCode=0, timedOut=false, durationMs=71245
  - Recorded at: 2026-06-27T20:21:38.377Z
  - Recorded-at source: file-mtime
  - Freshness: uncertain; artifact lacks internal command timestamp
  - Output excerpt: # 调研结论 / ## 一句话判断 / 本次未找到足够相关的项目线索，建议缩小需求范围后再查一次。
  - Command: `D:\code\github-deepSearch\.venv\Scripts\python.exe -m github_deep_search 我想通过关键词进行抖音相关热门视频和热门评论查询，必须有相关的视频截图和评论截图。能整理成一份完整的报告更好，最好是网页版，已经有现成的网站可以直接使用 --mode detailed --budget standard --format markdown`
  - Artifact: `D:\code\agent-test\reports\examples\github-deepSearch\full-user-artifact-retest-20260628\runtime\scenario-01-douyin-hot-video-comments.json`
- scenario-02-browser-summary-notion: exitCode=0, timedOut=false, durationMs=65581
  - Recorded at: 2026-06-27T20:22:44.041Z
  - Recorded-at source: file-mtime
  - Freshness: uncertain; artifact lacks internal command timestamp
  - Output excerpt: # 调研结论 / ## 一句话判断 / 本次未找到足够相关的项目线索，建议缩小需求范围后再查一次。
  - Command: `D:\code\github-deepSearch\.venv\Scripts\python.exe -m github_deep_search 我想找一个浏览器插件，可以自动总结网页内容，并把摘要同步到 Notion，最好是开源项目，可以直接部署或安装使用 --mode detailed --budget standard --format markdown`
  - Artifact: `D:\code\agent-test\reports\examples\github-deepSearch\full-user-artifact-retest-20260628\runtime\scenario-02-browser-summary-notion.json`
- scenario-03-ai-qa-single-md-report: exitCode=0, timedOut=false, durationMs=74102
  - Recorded at: 2026-06-27T20:23:58.214Z
  - Recorded-at source: file-mtime
  - Freshness: uncertain; artifact lacks internal command timestamp
  - Output excerpt: # 调研结论 / ## 一句话判断 / 已整理 1 个相邻方向，最接近的是 GreyDGL/PentestGPT（1/100），目前更适合用来找灵感，不适合直接采用。
  - Command: `D:\code\github-deepSearch\.venv\Scripts\python.exe -m github_deep_search 我需要一个 AI 测试工具，输入项目地址和需求文档后可以自动执行测试并生成单份 Markdown 测试报告，报告要包含复现步骤、实际结果、期望结果和修复建议 --mode detailed --budget standard --format markdown`
  - Artifact: `D:\code\agent-test\reports\examples\github-deepSearch\full-user-artifact-retest-20260628\runtime\scenario-03-ai-qa-single-md-report.json`
- scenario-04-github-issue-hotspot-dashboard: exitCode=0, timedOut=false, durationMs=64484
  - Recorded at: 2026-06-27T20:25:02.768Z
  - Recorded-at source: file-mtime
  - Freshness: uncertain; artifact lacks internal command timestamp
  - Output excerpt: # 调研结论 / ## 一句话判断 / 已整理 3 个相邻方向，最接近的是 yhy0/github-cve-monitor（2/100），目前更适合用来找灵感，不适合直接采用。
  - Command: `D:\code\github-deepSearch\.venv\Scripts\python.exe -m github_deep_search 我想找一个开源工具，可以监控多个 GitHub 仓库的 issue 热点、评论趋势和高频问题，并生成可视化报告或网页仪表盘 --mode detailed --budget standard --format markdown`
  - Artifact: `D:\code\agent-test\reports\examples\github-deepSearch\full-user-artifact-retest-20260628\runtime\scenario-04-github-issue-hotspot-dashboard.json`
- scenario-05-xiaohongshu-keyword-comments-screenshot: exitCode=0, timedOut=false, durationMs=61113
  - Recorded at: 2026-06-27T20:26:03.949Z
  - Recorded-at source: file-mtime
  - Freshness: uncertain; artifact lacks internal command timestamp
  - Output excerpt: # 调研结论 / ## 一句话判断 / 本次未找到足够相关的项目线索，建议缩小需求范围后再查一次。
  - Command: `D:\code\github-deepSearch\.venv\Scripts\python.exe -m github_deep_search 我想通过关键词查询小红书热门笔记和热门评论，需要笔记截图、评论截图，并整理成网页报告，有现成项目最好 --mode detailed --budget standard --format markdown`
  - Artifact: `D:\code\agent-test\reports\examples\github-deepSearch\full-user-artifact-retest-20260628\runtime\scenario-05-xiaohongshu-keyword-comments-screenshot.json`
- web-ui-browser-smoke: exitCode=0, timedOut=false, durationMs=65584
  - Recorded at: 2026-06-27T20:27:45.081Z
  - Recorded-at source: file-mtime
  - Freshness: uncertain; artifact lacks internal command timestamp
  - Summary: "passed": true
  - Output excerpt: { / "passed": true, / "url": "http://127.0.0.1:8011",
  - Command: `node scripts\probes\browser_smoke_playwright.mjs --url http://127.0.0.1:8011 --query 我想找一个浏览器插件，可以自动总结网页内容，并把摘要同步到 Notion，最好是开源项目，可以直接部署或安装使用 --input-selector #query --submit-selector #run --result-selector #results.active --api-pattern /api/search --wait-after-click-ms 1000 --timeout-ms 300000 --screenshot D:\code\agent-test\reports\examples\github-deepSearch\full-user-artifact-retest-20260628\runtime\web-ui-browser-smoke.png`
  - Artifact: `D:\code\agent-test\reports\examples\github-deepSearch\full-user-artifact-retest-20260628\runtime\web-ui-browser-smoke.json`

### Live Scenario Matrix

| Scenario | Exit | URLs | Score Range | Key Signals | Result |
| --- | --- | ---: | --- | --- | --- |
| scenario-01-douyin-hot-video-comments | 0 | 0 | none | empty section, empty with recovery evidence | Review |
| scenario-02-browser-summary-notion | 0 | 0 | none | empty section, empty with recovery evidence | Review |
| scenario-03-ai-qa-single-md-report | 0 | 1 | 1-1/100 | not directly adoptable, core capability unconfirmed, adjacent only | Fail |
| scenario-04-github-issue-hotspot-dashboard | 0 | 3 | 1-2/100 | not directly adoptable, core capability unconfirmed, adjacent only | Fail |
| scenario-05-xiaohongshu-keyword-comments-screenshot | 0 | 0 | none | empty section, empty with recovery evidence | Review |

## 4. Requirement Traceability

| Requirement / Contract | Verification Status | Evidence |
| --- | --- | --- |
| Completed output must degrade to useful references or explain lack of candidates | Observed; not failed by static scan | docs/CURRENT_HANDOFF.md:61 Final output is at most Top 3 and always degrades in this order: reliable matches, evidence-backed partial matches, then the relatively closest adjacent projects. |
| Completed output must degrade to useful references or explain lack of candidates | Observed; not failed by static scan | docs/CURRENT_HANDOFF.md:62 An unconfirmed core requirement sharply lowers a project's score and makes it an `adjacent` result, but does not erase the project. Adjacent results must be clearly labeled and must never claim the core requirement is supported. |
| Completed output must degrade to useful references or explain lack of candidates | Observed; not failed by static scan | docs/CURRENT_HANDOFF.md:69 Unverified fallback leads are capped at 29/100 and require either a meaningful core-direction signal or a current-requirement adjacent-capability signal. When the requirement has a domain/platform concept, adjacent leads must first match that domain/platform; pure output/interface matches such as screenshots or reports are not enough. They must keep the core requirement unconfirmed unless the evidence gate verifies it. |
| Completed output must degrade to useful references or explain lack of candidates | Observed; not failed by static scan | docs/CURRENT_HANDOFF.md:73 Empty reports must still explain the search coverage and filtering reason in user-facing language. Do not return only `暂无` plus a generic keyword-change suggestion. |
| Completed output must degrade to useful references or explain lack of candidates | Observed; not failed by static scan | docs/CURRENT_HANDOFF.md:83 When reliable projects exist, evidence-backed references require score `>= 35` and usable evidence. |
| Completed output must degrade to useful references or explain lack of candidates | Observed; not failed by static scan | docs/CURRENT_HANDOFF.md:84 If fewer than three reliable/reference projects survive, the remaining slots use relatively closest adjacent projects with a positive score and meaningful project evidence. Their low score and unconfirmed core capability must be explicit. |
| Completed output must degrade to useful references or explain lack of candidates | Observed; not failed by static scan | docs/CURRENT_HANDOFF.md:85 Adjacent leads must not be filled by output/interface-only matches such as screenshots, reports, generic web UI, books, image editors, trading tools, or project/news directories when the core domain/action/object is unconfirmed. |
| Completed output must degrade to useful references or explain lack of candidates | Observed; not failed by static scan | docs/CURRENT_HANDOFF.md:97 Reports separate reliable projects and reference projects and describe covered functions, important gaps, usability, recommended action, and one plain-language core score reason per project. |

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

- none

## 9. Runtime Scenario Findings

- These findings are inferred from recorded runtime artifacts. If the target project changed after the artifact time, rerun the scenario before treating the finding as current.

### RS-1: Real user scenario did not return a directly usable relevant project

- Severity: Major
- Source artifact: `D:\code\agent-test\reports\examples\github-deepSearch\full-user-artifact-retest-20260628\runtime\scenario-03-ai-qa-single-md-report.json`
- Artifact recorded at: 2026-06-27T20:23:58.214Z
- Actual result: The executed scenario completed successfully but returned weak or unrelated leads, low scores, or explicitly unconfirmed core capability.
- Expected result: A completed research report should return directly usable projects when available, or provide strong adjacent/rejection evidence and a concrete recovery path when only weak leads exist.
- Evidence: # 调研结论 / ## 一句话判断 / 已整理 1 个相邻方向，最接近的是 GreyDGL/PentestGPT（1/100），目前更适合用来找灵感，不适合直接采用。 / ## 已整理的线索 / ### 1. GreyDGL/PentestGPT（相邻参考） · ★ 13967 · 更新 2026-06-07 / - 关联度：1/100 / - 得分原因：核心能力「AI 测试工具」尚未确认；AI 测试工具、输入项目地址和需求文档后可以自动执行测试并生成单份 Markdown 测试报告、报告要包含复现步骤等 5 项仍未确认；项目定位或使用方式也有差异。 / - 符合部分：暂未确认 / - 差异部分：需求是通用AI测试工具，而PentestGPT是渗透测试工具，专注于安全漏洞利用和CTF挑战；需求要求输入项目地址和需求文档，PentestGPT输入的是目标IP和可选指令；需求要求输出Markdown测试报告，PentestGPT输出的是渗透测试结果和flag捕获 / - 缺失部分：未发现明确缺失 / - 地址：https://github.com/GreyDGL/PentestGPT / ## 下一步 / 本次已经核对候选项目的公开说明和重点内容，仍未确认有项目同时具备「AI 测试工具、输入项目地址和需求文档后可以自动执行测试并生成单份 Markdown 测试报告、报告要包含复现步骤、实际结果」。可借鉴 GreyDGL/PentestGPT 的「现有项目的基础框架」；未覆盖的核心部分需要另找方案或单独实现。 / 当前模式的搜索范围已用满，结论可能不完整；可切换深度模式继续查找。

### RS-2: Real user scenario did not return a directly usable relevant project

- Severity: Major
- Source artifact: `D:\code\agent-test\reports\examples\github-deepSearch\full-user-artifact-retest-20260628\runtime\scenario-04-github-issue-hotspot-dashboard.json`
- Artifact recorded at: 2026-06-27T20:25:02.768Z
- Actual result: The executed scenario completed successfully but returned weak or unrelated leads, low scores, or explicitly unconfirmed core capability.
- Expected result: A completed research report should return directly usable projects when available, or provide strong adjacent/rejection evidence and a concrete recovery path when only weak leads exist.
- Evidence: # 调研结论 / ## 一句话判断 / 已整理 3 个相邻方向，最接近的是 yhy0/github-cve-monitor（2/100），目前更适合用来找灵感，不适合直接采用。 / ## 已整理的线索 / ### 1. yhy0/github-cve-monitor（相邻参考） · ★ 1196 · 更新 2023-02-14 / - 关联度：2/100 / - 得分原因：核心能力「开源工具」尚未确认；明确缺少可以监控多个GitHub仓库的issue热点、并生成可视化报告或网页仪表盘；开源工具、评论趋势和高频问题仍未确认。 / - 符合部分：暂未确认 / - 差异部分：尚未确认：开源工具、评论趋势和高频问题 / - 缺失部分：可以监控多个GitHub仓库的issue热点、并生成可视化报告或网页仪表盘 / - 地址：https://github.com/yhy0/github-cve-monitor / ### 2. adminlove520/github_monitor（相邻参考） · ★ 15 · 更新 2026-06-27 / - 关联度：1/100 / - 得分原因：核心能力「开源工具」尚未确认；明确缺少可以监控多个GitHub仓库的issue热点；开源工具、评论趋势和高频问题、并生成可视化报告或网页仪表盘等 4 项仍未确认。 / - 符合部分：暂未确认 / - 差异部分：尚未确认：开源工具、评论趋势和高频问题、并生成可视化报告或网页仪表盘


## 10. User-Visible Report Quality

- Checked runtime user-visible report artifacts: scenario-01-douyin-hot-video-comments, scenario-02-browser-summary-notion, scenario-03-ai-qa-single-md-report, scenario-04-github-issue-hotspot-dashboard, scenario-05-xiaohongshu-keyword-comments-screenshot, web-ui-browser-smoke
- No user-visible report quality issue was detected from attached runtime artifacts.

## 11. Artifact Consumption Review

| Target | Observed Summary / Title | Consumption Verdict |
| --- | --- | --- |
| https://github.com/GreyDGL/PentestGPT | GitHub - GreyDGL/PentestGPT: Automated Penetration Testing Agentic Framework Powered by Large Language Models · GitHub | HTTP 200; match: mismatch; signals: runnable-or-tool-like; evidence: Skip to content / Navigation Menu; browser-opened |
| https://github.com/yhy0/github-cve-monitor | GitHub - yhy0/github-cve-monitor: 实时监控github上新增的cve、自定义关键字、安全工具更新、大佬仓库监控，并多渠道推送通知 · GitHub | HTTP 200; match: weak; evidence: Skip to content / Navigation Menu; browser-opened |
| https://github.com/adminlove520/github_monitor | GitHub - adminlove520/github_monitor: 实时监控github上新增的cve、自定义关键词、安全工具更新、大佬仓库监控，并多渠道推送通知 · GitHub | HTTP 200; match: weak; signals: runnable-or-tool-like; evidence: Skip to content / Navigation Menu; browser-opened |
| https://github.com/233Official/GithubKeyWordMonitor | GitHub - 233Official/GithubKeyWordMonitor: Github 关键词仓库监控 · GitHub | HTTP 200; match: weak; signals: runnable-or-tool-like; evidence: Skip to content / Navigation Menu; browser-opened |

## 12. Fix Verification Plan

- Re-run `agent-test scan` and confirm no functional smoke findings are reported.

## 13. Residual Risks And Untested Areas

- This report is based on deterministic static prechecks and does not prove the live search path is correct.
- It does not validate actual GitHub/Tavily/LLM recall quality for the sample prompt.
- Some runtime artifacts use file mtime rather than an internal command timestamp, so artifact currency is weaker than a freshly recorded run.
- Returned consumable targets have a lightweight consumption-review artifact, but this is still a minimal user-decision check rather than a full audit.
- A follow-up scenario-oracle test should execute representative mocked and live-safe inputs once the empty-output defect is fixed.
- MVP basic mode does not install dependencies or execute target project code.
- GitHub targets are cloned for static analysis only.
- Requirement extraction is heuristic and requires human review.
- The assessment is requirement-first for vibeCoding projects: functional conformance dominates, while style, architecture, deep security and deep robustness are intentionally de-emphasized.

## 14. Developer Handoff

- Priority 1: reproduce and fix the runtime scenario failure(s) listed in section 9.

