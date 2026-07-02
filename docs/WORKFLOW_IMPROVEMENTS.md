# Workflow Improvements

本文档记录测试反馈如何转化为 `agent-test` 自身工作流改进。

## 2026-06-26：AI 生成项目同质化缺陷预检

### 反馈判断

以下反馈成立：

- `agent-test` 面向的主要对象是 90% 以上代码由 AI 生成的 vibeCoding 项目。
- 这类项目存在大量同质化功能问题，优先发现它们比模拟完整人工点击流程更有价值。
- 项目的第一阶段应该先低成本发现“看似完成、实际没交付”的缺陷，再进入多场景功能验收和深度特殊漏洞分析。
- `github-deepSearch` 的“调研完成但报告暂无线索”属于典型的完成态空白交付问题。

### 流程调整

1. 在 basic profile 中加入 AI 项目 smoke 缺陷预检。

2. 首批预检重点是：
   - 文档承诺 fallback、相邻参考或失败时最低价值。
   - 源码/模板中存在完成态空白输出，例如 `暂无`、`未找到足够相关`、`没有留下可核对的相邻项目线索`。
   - 两者同时出现时，判定为功能验收失败，而不是普通风险。

3. 该检查不执行真实外部搜索，不消耗被测项目 token/API quota，用静态契约和输出分支先发现高概率缺陷。

4. 输出必须包含开发可复现证据：
   - 需求/承诺来源文件和行号。
   - 空白输出实现文件和行号。
   - 实际影响。
   - 期望行为。

### 对 agent-test 的代码改动

- 新增 `src/analyzers/ai-defects.js`。
- basic profile 新增 `no-ai-empty-completed-output-defects` 检查。
- Markdown 报告新增 `AI Project Smoke Findings`。
- 新增 analyzer 回归测试，覆盖“承诺相邻参考但完成报告可为空”的缺陷模式。

## 2026-06-26：vibeCoding 需求优先测试口径校准

### 反馈判断

以下反馈成立：

- `agent-test` 的被测对象主要是纯 AI 或低人工介入生成的 vibeCoding 项目，不应沿用传统人工项目的代码审美型 review。
- 对 90% 以上 AI 生成的项目，代码是否优雅、结构是否清晰、抽象是否漂亮，不是核心测试价值。
- 测试重心应放在功能是否符合需求文档、README、汇总 Markdown、示例输入输出和显式验收标准。
- key 明码、明显 hard-code、固定样例过拟合、入口完全不可运行、Web 页面明显无法操作等问题仍需要发现，但属于少量明显风险检查。
- UI 检查应优先发现会阻断用户完成主要流程的明显异常，而不是评价视觉审美。

### 流程调整

1. 默认判断权重调整为：
   - 90%：需求符合性和功能验收。
   - 10%：明显交付风险。

2. 报告必须区分检查类别：
   - `requirement-conformance`
   - `runtime-usability`
   - `obvious-risk`
   - `supporting-signal`

3. 传统工程质量信号只能作为辅助信息，除非它直接导致需求不符合、功能不可用或明显交付事故。

4. Web UI 测试应验证用户能否完成需求描述的流程，并记录截图、DOM/文本摘要、console/pageerror/requestfailed。明显遮挡、空白、溢出、无法点击、无结果反馈应进入问题列表。

5. 深度安全、深度健壮性、架构设计、可维护性评价默认不展开，避免挤占功能验收预算。

### 对 agent-test 的代码改动

- 新增检查类别 `category`。
- 新增报告字段 `assessmentFocus`，明确需求符合性 90%、明显风险 10%。
- basic profile 改名为需求优先 vibeCoding profile。
- 下调测试入口等传统工程信号的严重度，避免它们压过需求符合性。
- 扩展需求抽取关键词，覆盖功能、验收、流程、场景、输入输出等常见 vibeCoding 文档表达。

## 2026-06-17：github-deepSearch 测试反馈复盘

### 反馈判断

以下反馈成立：

- `Top 3` 不应被测试为“必须永远返回 3 个”。更合理的测试语义是“最多 3 个，不足时解释原因”。
- 真实 API 查询不应承担结构测试职责。结构测试应使用 mock/fixture，真实查询应归类为 live eval。
- 成本配置缺失 warning 不一定是 bug。只有在报告把不完整成本当作完整成本展示时，才应判为失败。
- MCP `--help` 行为测试是合理的，它暴露入口可操作性问题。
- 当前更关键的下一步测试方向是 must_have 与 evidence 的覆盖准确率。

### 流程调整

`agent-test` 后续测试流程必须遵守：

1. 每个检查项必须标记 `testKind`：
   - `deterministic`
   - `mocked`
   - `live-eval`
   - `manual-review`

2. 每个检查项必须标记 `conclusion`：
   - `failure`
   - `risk`
   - `unverified`
   - `needs-decision`
   - `tooling-issue`

3. 结构测试优先使用 mock。

4. live eval 只作为集成观察和趋势样本，不单独证明结构稳定性。

5. 对“最多 N 个”类需求，测试条件应是：
   - 返回数量不超过 N。
   - 当少于 N 且可能影响用户预期时，报告解释原因。

6. Warning 需要按影响分级：
   - 已显著标注且不影响核心结论：risk。
   - 未标注且会误导用户：failure。
   - 需要产品判断是否接受：needs-decision。

7. 对搜索/推荐/AI 调研类项目，下一阶段必须增加 must_have/evidence 覆盖矩阵。

8. 对解析、搜索、推荐、证据门控、评分等语义型能力，必须增加反硬编码/反 fixture 过拟合检查。测试不能只验证单个样例通过，而要检查核心逻辑是否把领域知识硬编码进通用 engine。

9. 成本 warning 需要基于价格配置是否可用于计算，而不是基于 API key 是否存在。即使 `LLM_INPUT_USD_PER_1M` 和 `LLM_OUTPUT_USD_PER_1M` 存在，只要值小于等于 0，成本不完整 warning 就是正确行为。

10. 报告命令示例必须匹配当前 shell。当前默认环境是 Windows PowerShell，live eval 示例应写为：

```powershell
$env:RUN_LIVE_EVAL="1"
python -m pytest -m live
```

Unix shell 写法只能在明确标注 bash/sh 时使用。

### 对 agent-test 的代码改动

- 报告 schema 增加 `testKind`。
- 报告 schema 增加 `conclusion`。
- basic profile 的确定性检查默认标记为 `deterministic`。
- 报告验证器会拒绝缺少 `testKind` 或 `conclusion` 的检查项。

## 2026-06-18：报告可复核性与 live eval 环境反馈

### 反馈判断

以下反馈成立：

- 只把 Markdown 报告交给被测项目 agent 时，报告中引用的 `reports/.../runtime/*.json` 路径可能只存在于 `agent-test` 测试工程环境，对方无法本地复核。
- live eval 结果必须显式标注运行环境变量。未设置 `RUN_LIVE_EVAL=1` 时，`pytest -m live` 被 skip 是正常现象；已设置该变量时得到 passed 结果，两者不能混用。
- `search_completeness=limited` 应继续归类为 product completeness risk，不应被写成 runtime failure。

### 流程调整

1. 给其他 agent 的报告如果引用 runtime artifacts，必须同时交付 artifacts，或生成 handoff bundle。

2. handoff bundle 必须包含：
   - 报告 Markdown。
   - 被引用的 JSON/TXT artifacts。
   - `MANIFEST.md` 和 `MANIFEST.json`。
   - 每条命令的 cwd、command、exitCode、env keys。

3. live eval 报告必须写清楚：
   - 是否设置 `RUN_LIVE_EVAL`。
   - 是否配置 GitHub/Tavily/LLM key。
   - 是否配置 LLM 单价。
   - warnings 是风险提示、产品完整度风险还是失败。

4. 对 GitHub request limit、search completeness、low-confidence reference candidate 等问题，默认按产品完整度风险处理；只有报告未标注或误导用户时才升级为 failure。

### 对 agent-test 的代码改动

- 新增 `scripts/reports/create_handoff_bundle.mjs`。
- 新增 handoff bundle 自动化测试，确保 manifest 记录 env keys，例如 `RUN_LIVE_EVAL`。

## 2026-06-18：Web 前端浏览器自动化覆盖缺口

### 反馈判断

反馈成立：之前对 `github-deepSearch` 的 Web 层测试主要是 FastAPI `TestClient` 和 API 结构检查，没有真实打开浏览器执行前端 JavaScript、点击按钮、输入需求、捕获 console/pageerror/requestfailed。

这会漏掉以下问题：

- HTML 内嵌脚本语法错误。
- 浏览器控制台错误。
- 按钮、表单、选择器失效。
- 前端请求路径或 JSON 解析错误。
- 加载状态、结果区域、错误提示无法正确展示。
- CSS/布局导致用户无法操作。

### 流程调整

1. 只要项目存在 Web 前端，测试计划必须包含 browser smoke。

2. API/TestClient 只能证明服务端入口可调用，不能证明用户能在浏览器完成流程。

3. browser smoke 至少需要记录：
   - URL。
   - 输入文本或输入来源。
   - 被点击的 selector。
   - 等待的 API pattern 或结果 selector。
   - console errors。
   - console warnings。
   - page errors。
   - failed requests。
   - screenshot 或 DOM/text 摘要。

4. 如果未执行 browser smoke，报告中 Web 前端结论必须标记为 `unverified`。

5. 浏览器 smoke 不能只验证“点击动作已发出”，还必须等待可说明流程结束的信号，例如 API 响应、结果 selector、完成文本或错误文本。

6. 在 Windows PowerShell 环境中，浏览器 probe 推荐直接执行 Node 脚本，避免 npm 参数转发差异干扰诊断：

```powershell
node scripts\probes\browser_smoke_playwright.mjs --url http://127.0.0.1:8000 --query "..." --input-selector "textarea" --submit-selector "button" --wait-for-text-pattern "完成|错误"
```

7. 新环境需要先安装浏览器运行时；缺失时应报告为测试环境 setup error，不应写成被测项目前端失败：

```powershell
npm run setup:browser
```

### 对 agent-test 的代码改动

- 新增 `scripts/probes/browser_smoke_playwright.mjs`。
- 新增 `npm run probe:browser`。
- 新增 `npm run setup:browser`。
- 新增 Playwright dev dependency。
- 新增 browser smoke 参数解析测试。
- browser smoke 记录 console warnings，并支持 `--fail-on-console-warning`、`--wait-after-click-ms`、`--wait-for-text-pattern`。

## 2026-06-26：用户可见输出质量成为通用验收门槛

### 反馈判断

反馈成立：之前对 `github-deepSearch` 的测试虽然保存了截图和运行产物，也能在人工复查时看到问题，但没有把“用户最终看到的报告是否达到基本测试人员会检查的质量”做成通用自动化门槛。

这个缺口不是 `github-deepSearch` 特例，而是所有 vibeCoding 项目的核心风险。AI 生成项目常见问题不是代码不优雅，而是用户流程表面完成、最终输出却空白、重复、无关、不可复核，或把低质量候选包装成有效结果。

### 流程调整

1. 任何 vibeCoding 项目只要生成用户可见输出，都必须执行用户输出质量验收。

2. 用户输出质量验收至少覆盖：
   - 完成态空白输出。
   - 不该展示给用户的 debug、raw JSON、内部字段、栈信息、密钥名或工具流水。
   - 重复段落、重复项目、重复 URL 或模板化堆叠。
   - 被项目契约判定为无证据或不支持需求的候选被当成正常参考展示。
   - 泛化资源被当成直接满足需求的项目，但报告没有给出契约依据或可消费证据。
   - 报告中的 GitHub/网站/项目地址是否经过基础打开和相关性核验。

3. 这项能力不是“截图解析”。截图可以作为证据，但自动判断优先使用 runtime artifact 中的 stdout、DOM/bodyText、结构化 JSON、浏览器 URL review 和必要时的人工复核。

4. 如果没有执行用户输出质量验收，最终功能验收报告不得写成完整通过，只能标注为 `unverified`、`partial` 或明确列入残余风险。

5. 项目目标不是复制人工测试人员每一步操作，而是达到人工测试的基本产出水平：多轮用例、复现流程、实际结果、期望结果、证据和开发可直接修复的缺陷报告。

### 对 agent-test 的代码改动

- 新增 `src/analyzers/user-report-quality.js`。
- 新增 `user-visible-report-quality-passed` profile gate。
- `AGENT_TEST_QA_REPORT.md` 新增 User-Visible Report Quality 章节。
- 新增 `scripts/probes/validate_user_report_output.mjs`。
- 新增 `scripts/probes/github_url_browser_review.mjs`。
- 新增 `npm run probe:user-report` 和 `npm run probe:github-url-review`。
- 新增用户报告质量和 GitHub URL review 相关自动化测试。
