# Testing Principles

## 0. Foundation: no project-specific or one-incident patches

`agent-test` is a general-purpose QA system for AI-generated and low-human-intervention vibeCoding projects. It must never become a collection of fixes for one repository, one prompt, one report, or one historical failure.

All future changes must follow these rules:

- A real failure may inspire a rule, but the implemented rule must describe a reusable behavior pattern.
- Production logic must not hard-code repository names, project names, prompt text, user request text, exact fixture output, or one-off keywords.
- A rule is acceptable only when it can apply to multiple unrelated projects of the same product class.
- Test fixtures and selftests should use synthetic, domain-neutral data such as `domain alpha`, `domain beta`, and `example-org`.
- Historical reports and workflow notes may mention real project names as evidence, but runtime analyzers must not depend on those names.
- If a defect cannot be generalized, it belongs in a manual report for that target project, not in `agent-test` core logic.

Allowed generic problem families include completed-empty output, stale results after a changed input, user-visible debug/internal content, duplicate user-visible content, unverified returned links, and project-specific output-quality failures backed by the generated acceptance contract.

Self-test guardrail:

- Production acceptance code in `src/analyzers`, `src/profiles`, and `src/reports` must pass `test/no-hard-coded-acceptance-rules.test.js`.
- The guard intentionally blocks historical incident tokens, fixed structured output field names, repository/category labels, and fixed semantic score thresholds from becoming generic acceptance logic.
- If a new target project needs a product-specific standard, add it to the LLM-generated acceptance contract and verify it through runtime artifacts instead of adding a hard-coded branch.
- Deterministic code may collect evidence, normalize artifacts, check execution health, and enforce platform-level report integrity, but it must not invent product-specific quality criteria.

## 0.1 User-consumed artifact oracle

For every target project, `agent-test` must identify what the real user ultimately consumes after the product says it has completed the task. Testing should then perform the smallest realistic consumption step and verify whether that evidence supports the product's claim.

Examples of user-consumed artifacts:

- recommended links, repositories, websites or external references;
- generated reports, exported files, screenshots, slide decks, spreadsheets or documents;
- generated code, commands, configuration files or runnable projects;
- analysis conclusions, rankings, scores, labels or summaries;
- task lists, plans, tickets or operational records that a user will act on.

The core oracle is not "the product produced something". The oracle is "a user can consume the produced thing and make the intended next decision or action from it".

Minimum consumption checks should answer:

- Can the target be opened, read, downloaded, rendered or run at the shallow level a real user would first try?
- Does the observed content match the user's input and the report's claim?
- Does the product distinguish exact matches, adjacent references, weak leads, rejected candidates and unverified items?
- If the target is only weakly related, does the output explain why it is still useful?
- Does the final QA report include the consumed target, observed summary, match verdict and evidence excerpt?

This rule generalizes across project types. For a search/recommendation tool the consumed artifact may be a returned repository README. For a document generator it may be the generated document. For a code generator it may be the generated command or project. For an analytics tool it may be the evidence behind a conclusion.

## 0.2 Runtime scenario judgment model

Runtime scenarios are user-flow observations, not automatically the same thing as deterministic gate failures. A runtime scenario may make the final report result `FAIL` while all deterministic check gates still pass. Reports must state this distinction explicitly.

Use this judgment model for live or recorded user scenarios:

- `Pass`: the scenario completed and produced no obvious user-value failure under the captured evidence.
- `Review`: the scenario completed, but the result needs product judgment, deeper evidence, or comparison against a volatile external source. Examples include no-result reports with useful search coverage and recovery guidance, or low-confidence candidates that are clearly labeled as weak.
- `Fail`: the scenario command failed, the user-visible output is blank without recovery value, or the output presents very weak/clearly unsuitable leads as organized results with insufficient decision value.

Scenario coverage rule:

- After one representative full flow is executable, a complete acceptance run should record at least 3 diverse `scenario-*` artifacts.
- The scenarios should vary the user input, expected output path, and edge condition according to the target project's own documentation.
- Rewording one prompt three times is not sufficient coverage.
- Fewer than 3 passing scenarios is a `PARTIAL` acceptance result, not a complete pass. A failing scenario still fails the run immediately.

For search, recommendation, research, ranking and report-generation products:

- The LLM-generated project contract should define what counts as useful direct, partial, adjacent, rejected, or no-result output for that target project.
- Built-in code must not hard-fail a project solely because of a fixed score threshold, a specific field name, or a repository/category label that came from one historical incident.
- A weak adjacent reference is not automatically a defect if it is clearly labeled as weak, adjacent, rejected, unverified, or not directly adoptable. Whether it is useful enough should be judged against the generated project contract and scenario evidence.
- Artifact consumption review is supporting evidence. A shallow page title or README skim can reveal obvious mismatch, but it should not be the only basis for proving that a correct answer exists or that the product should have found it.
- Live/runtime findings must include evidence freshness. If artifacts are older than target code changes, older than the report freshness policy, or lack internal timestamps, the report must warn that concrete repository names, screenshots, scores or page contents may be stale.

This model is a project-wide standard. Do not implement it as special handling for one repository, one prompt, or one historical report.

本文档记录 `agent-test` 在测试 vibeCoding 项目时必须遵守的判断准则。

## 1. 先测试自己，再测试别人

`agent-test` 在测试其他项目时，第一优先级是发现并修正自身测试模型的问题。

如果测试过程中发现 profile、报告、命令记录、编码、分级或判断标准不合理，应优先修正 `agent-test`，再重新测试目标项目。

### 1.1 vibeCoding 项目按需求验收，不按传统工程审美验收

`agent-test` 的主要目标是测试纯 AI 或低人工介入生成的 vibeCoding 项目，而不是传统人工工程项目。

默认判断权重为：

- 90%：功能是否符合需求文档、README、汇总 Markdown、示例输入输出和显式验收标准。
- 10%：明显会导致交付意外的问题，例如 key 明码、明显 hard-code、固定样例过拟合、入口完全不可运行、Web 页面明显无法操作。

以下内容默认不作为主要判断目标：

- 代码是否优雅。
- 结构是否清晰。
- 抽象是否合理。
- 可维护性深度评价。
- 安全性和健壮性的深度审计。

如果这些问题没有直接导致需求不符合、功能不可用或明显交付事故，报告中最多作为 `supporting-signal` 或 `risk`，不能抢占需求符合性判断的优先级。

### 1.2 先做 AI 生成项目同质化缺陷预检

在进入深度场景验收前，`agent-test` 必须先低成本检查 AI 生成项目的高频功能性缺陷。这一步不是代码审美，也不是深度安全审计，而是快速发现“看起来完成了，实际没有交付核心价值”的问题。

优先检查：

- 假完成：页面、接口或报告显示完成，但结果为空或没有可执行价值。
- 空壳功能：入口、按钮、API 或菜单存在，但核心逻辑没有实现。
- 静态假数据：输出不随用户输入变化，或只对固定样例有效。
- 无失败价值：失败时只说暂无、重试、换关键词，不给证据、候选、排除原因或具体下一步。
- 过度过滤：候选存在或产品承诺有 fallback，但最终报告被过滤成空白。
- 前后端脱节：API 有数据，Web 不展示；Web 显示完成，但核心字段为空。
- 多入口不一致：CLI、API、Web 对同一需求给出互相矛盾的结论。
- 报告不可复核：有结论但没有输入、输出片段、证据、链接或复现路径。

这些问题应作为功能验收问题优先报告，因为它们通常比代码结构问题更容易发现，也更接近测试人员会交付给开发的有效缺陷。

## 2. 区分结构测试和 live eval

结构测试应尽量使用 mock、fixture 和可复现输入。

真实 API 查询会受到以下因素影响：

- GitHub 搜索结果变化。
- GitHub rate limit。
- Tavily 或其他 Web Search 结果变化。
- LLM 输出波动。
- 外部服务网络状态。

因此：

- 结构测试不能依赖真实 GitHub/Tavily/LLM 输出。
- 真实查询应作为 live eval 单独归档。
- live eval 可以发现集成问题，但不能单独证明结构稳定性。

## 3. 不把“最多 N 个”误判成“必须 N 个”

如果需求语义是 Top N、最多 N 个、默认展示 N 个，测试需要先确认产品语义。

合理判断：

- 候选足够且置信度足够时，应返回最多 N 个。
- 候选不足或被过滤时，可以少于 N 个。
- 少于 N 个时，报告必须解释原因。

不合理判断：

- 强制要求任何情况下都返回恰好 N 个。

## 4. Warning 不等于失败

Warning 应按是否影响结论来分级。

例如成本估算：

- 如果 LLM 输入/输出单价配置缺失，或配置值小于等于 0，但报告显著标注“成本估算不完整”，这是风险提示。
- 如果 LLM 输入/输出单价配置缺失，或配置值小于等于 0，却把估算值当作完整成本展示，这是失败。
- 成本 warning 的判断依据是价格配置值是否可用于计算，而不是 API key 是否存在。

请求预算触顶也类似：

- 如果报告说明预算触顶影响了哪些步骤，这是风险提示。
- 如果预算触顶导致结果不足或证据不足，但报告没有解释，这是失败。

## 5. 需求覆盖比表面可运行更重要

对搜索、推荐、调研、AI 分析类项目，最关键的测试不是“命令能跑通”，而是：

- 用户需求是否被正确解析为 `must_have`。
- 候选结果是否覆盖这些 `must_have`。
- 覆盖或缺失判断是否有 evidence。
- 排序、评分和推荐是否能追溯到证据。

后续 profile 应优先支持 must_have 与 evidence 的覆盖矩阵。

## 6. 禁止用硬编码通过语义测试

对解析、搜索、推荐、证据门控、评分、分类、路由等语义型能力，测试必须防止项目通过硬编码或 fixture 过拟合来“假通过”。

不可接受的实现包括：

- 在核心逻辑中加入只服务于测试样例的关键词、别名、分支或映射表。
- 为特定 prompt、特定中文需求、特定仓库名写特殊处理。
- 把本应由 parser、schema、模型输出或配置承担的语义理解，下沉到通用 engine 的业务硬编码里。
- 用一个 live sample 通过来证明通用语义能力成立。

正确方向：

- 语义解析由 parser/schema/LLM 输出负责。
- 通用 engine 只做可解释、可复用的匹配、清洗、评分和证据收集。
- mock 结构测试应使用多个不同领域的 fixture，避免只围绕单一样例调参。
- live eval 应使用样本集，而不是单个样例。
- 报告中发现疑似硬编码时，应标记为 `failure` 或 `tooling-issue`，取决于问题在被测项目还是测试流程。

## 7. 报告应区分结论类型

报告中的问题应至少区分：

- 确定失败。
- 风险提示。
- 未验证。
- 需要人工确认。
- 测试平台自身发现的问题。

不应把所有不完美都写成失败，也不应把外部波动导致的现象当作稳定缺陷。

## 8. 每个检查项必须带判断元数据

每个检查项必须标记：

- `testKind`：测试来源类型，例如 deterministic、mocked、live-eval、manual-review。
- `conclusion`：结论类型，例如 failure、risk、unverified、needs-decision、tooling-issue。

没有这两个字段的报告不应通过 schema 校验。

## 9. 命令示例必须匹配执行环境

测试报告和交接文档中的命令示例必须匹配当前执行环境。

当前默认环境是 Windows + PowerShell，因此设置环境变量时应使用：

```powershell
$env:RUN_LIVE_EVAL="1"
python -m pytest -m live
```

不要在面向当前环境的报告中直接给出 Unix shell 写法：

```bash
RUN_LIVE_EVAL=1 python -m pytest -m live
```

如果报告需要同时支持多平台，应分别标注 PowerShell、cmd、bash，而不是混写。

## 10. 报告交付必须可复核

当报告引用 runtime artifacts、JSON 输出、截图、日志或命令记录时，必须满足以下至少一种条件：

- 同时交付包含报告和 artifacts 的 handoff bundle。
- 明确说明 artifacts 位于 `agent-test` 测试工程环境，并提供绝对或相对路径。
- 如果对方只会收到 Markdown，报告必须摘录足够的关键字段，避免结论只能依赖不可访问文件。

live eval 报告必须显式记录：

- 运行命令。
- 工作目录。
- 环境变量键名，例如 `RUN_LIVE_EVAL`，但不记录密钥值。
- key/config 前提，例如是否配置 GitHub、Tavily、LLM key，以及是否配置 LLM 单价。

如果未设置 `RUN_LIVE_EVAL=1`，`pytest -m live` 被 skip 是正常现象，不能和已启用 live eval 的结果混为一谈。

## 11. Web 前端必须包含真实浏览器自动化测试

如果被测项目提供 Web 前端、管理台、交互式页面或浏览器内 UI，API 测试和 `TestClient` 不能替代浏览器自动化测试。

最低要求：

- 启动真实 Web 页面。
- 用浏览器打开页面。
- 捕获 `console.error`、`pageerror` 和 failed requests。
- 结构化记录 `console.warning`；只有明确设置为阻塞条件时，warning 才应判为失败。
- 模拟用户输入、点击、提交。
- 等待关键 API 响应、结果区域出现，或页面出现预期完成/失败文本。
- 记录截图或 DOM/文本摘要作为 artifact。

适用工具优先级：

- 首选 Playwright。
- 如果当前 Codex 环境中使用 in-app browser 验证，也必须把发现转化为可复用的 probe 或测试说明。

没有浏览器自动化覆盖时，报告必须把 Web 前端状态标记为 `unverified`，不能仅凭接口测试写成通过。

UI 判断的重点是显而易见的功能异常，而不是审美评价。浏览器测试应优先发现：

- 用户无法看到核心入口。
- 关键按钮、表单、导航或结果区不可点击、不可输入或无反馈。
- 文本、按钮、弹窗、遮罩或固定栏明显互相遮挡，导致主要流程不可操作。
- 桌面端或移动端首屏完全错位、空白、溢出到不可见区域。
- 用户完成需求文档描述的流程时，看不到预期结果、错误提示或完成状态。

不应把配色、圆角、布局风格、组件抽象等主观审美问题当作核心失败，除非它们直接影响功能完成。

## 12. 所有 vibeCoding 项目必须达到人工测试基本水平

`agent-test` 的目标不是粗略模拟点击，也不是只产出“工具跑过”的报告。对任意 vibeCoding 项目，最低标准是以更低成本稳定产出接近人工测试人员的核心结果：清晰的测试用例、复现流程、实际结果、期望结果、证据和可交付给开发的缺陷描述。

因此，只要被测项目会向用户生成报告、推荐、搜索结果、分析结论、任务列表、代码产物或其他用户可见输出，测试必须检查该输出本身是否合格。该检查是通用标准，不是 `github-deepSearch` 的项目特例。

最低检查项包括：

- 输出是否真的回应了用户输入和需求文档，而不是只显示完成状态。
- 输出是否包含可操作结果、相邻参考、拒绝原因、搜索/执行覆盖说明或明确下一步，而不是纯空白模板。
- 输出中是否出现不应展示给用户的 debug、raw JSON、内部字段、栈信息、密钥名或工具流水。
- 输出是否存在明显重复段落、重复项目、重复 URL 或模板化堆叠。
- 如果输出给出项目、网站、仓库、文件、截图或链接，测试必须尽可能验证这些引用能打开且与用户需求相关。
- 如果输出包含评分、相关度、置信度或排序，明显为 0 分或无证据的项目不能作为正常参考展示。
- 对搜索、推荐、调研类项目，目录仓库、项目列表、newsletter、awesome list 这类泛化资源不能被当成直接满足需求的项目，除非用户明确要求这类资源。

没有执行这些检查时，最终功能验收报告不得写成完整通过。报告必须标记为 `unverified`、`partial` 或明确说明缺少用户可见输出质量验收。

这条标准的目标不是复制人工测试人员的每一次鼠标操作，而是实现相同产出：发现用户基本流程中的功能问题，给出开发人员可以立刻复现、排查和修复的报告。
