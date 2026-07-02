# 开发前确认清单

本文档用于判断 `agent-test` 是否已经具备进入工程脚手架阶段的条件。

## 1. 核心方向

- [x] 项目定位为通用 vibeCoding 项目测试平台，而非单项目测试脚本集合。
- [x] `github-deepSearch` 仅作为样例项目，不影响核心泛用性。
- [x] 已明确与直接使用 Codex、Claude Code 审查源码的区别。
- [x] 已明确自举测试原则：本工程必须首先通过自己定义的测试标准。

## 2. 需求和边界

- [x] 已定义待测项目的最低输入。
- [x] 已支持“只有一个 GitHub 链接”的输入场景。
- [x] 已支持“只有一个汇总 Markdown”的 vibeCoding 常见场景。
- [x] 已明确哪些问题不能通过自动测试完全发现。
- [x] 已明确哪些判断需要人工确认。

## 3. 测试能力范围

- [x] 静态测试。
- [x] 构建、单元测试和集成测试。
- [x] 浏览器自动化和模拟鼠标键盘操作。
- [x] API 测试。
- [x] CLI 测试。
- [x] 测试数据生成。
- [x] 安全扫描。
- [x] 性能和稳定性测试。
- [x] LLM 辅助需求抽取、测试生成和报告整理。

## 4. 成本和安全

- [x] 已收敛为单一 LLM-required acceptance 路径。
- [x] 已说明 LLM API key 和 token 成本。
- [x] 已要求单次预算上限。
- [x] 已要求陌生 GitHub 仓库动态执行必须隔离。
- [x] 已要求记录被执行命令、副作用和被阻止步骤。

## 5. 开发前仍需在脚手架阶段落地的内容

- [x] CLI 命令设计。
- [x] 配置文件 schema。
- [x] `report.json` schema。
- [x] 任务状态模型，例如 `passed`、`failed`、`skipped`、`blocked`、`partial`。
- [x] acceptance profile 的第一版实现。
- [x] 本工程自测 profile。
- [x] 最小 CI。

## 6. 当前结论

当前项目已经进入工程脚手架阶段，并完成了最小可运行闭环的第一版。

下一步应在保持自测通过的前提下，扩展外部样例项目扫描，并继续完善 profile 匹配和安全执行策略。

## 7. 第一版脚手架验证结果

- [x] `npm test` 通过。
- [x] `npm run scan:self` 可生成 `AGENT_TEST_QA_REPORT.md`、`USER_QA_SUMMARY.pdf` 和 `report.json`。
- [x] 自扫描 acceptance checks 通过。
- [x] 当前 `scan` 不会默认执行陌生项目代码；动态证据必须通过 `agent-test run` 显式记录。
