# vibecoding-qa

**一行命令，给 vibe-coded / AI-generated 项目生成可复核的功能验收 QA 报告。**

[![CI](https://github.com/wp-i/vibecoding-qa/actions/workflows/verify.yml/badge.svg)](https://github.com/wp-i/vibecoding-qa/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D22-blue.svg)](https://nodejs.org/)
[![Cost](https://img.shields.io/badge/basic%20mode-$0%20%2F%200%20tokens-brightgreen.svg)](#api-key--token-成本)

AI 写出来的项目，真的完成需求了吗？`vibecoding-qa` 专门检查这件事：它读取 README/需求文档/源码/运行证据/用户可见输出，生成一份可以交给开发者或修复 agent 的 `AGENT_TEST_QA_REPORT.md`。

| 你关心的事 | 当前答案 |
| --- | --- |
| 能不能直接试？ | 可以，clone 后一行命令扫本地目录或 GitHub URL |
| 要不要 API key？ | 默认 `basic` 模式不需要 |
| 会不会烧 token？ | 默认 0 token，$0 cost，报告里记录预估和实耗 |
| 主要测什么？ | vibeCoding 高频交付问题：假完成、空报告、弱推荐、硬编码样例、入口不可用、完整流程未验证 |

## 30 秒上手

```bash
npm install
node ./bin/agent-test.js scan . --out reports/latest
```

扫 GitHub 仓库：

```bash
node ./bin/agent-test.js scan https://github.com/user/repo --out reports/repo
```

输出：

```text
reports/latest/
├── AGENT_TEST_QA_REPORT.md
└── report.json
```

## 高含金量样例：扫描 10 万星级真实仓库

我们用 `vibecoding-qa` 对真实高星仓库 `browser-use/browser-use` 跑了一次公开预检：

```bash
node ./bin/agent-test.js scan https://github.com/browser-use/browser-use --out reports/showcase/browser-use --max-files 800
```

精选结果：

| 项目 | 结果 |
| --- | --- |
| Target | `https://github.com/browser-use/browser-use` |
| Checks | `9/11 passed` |
| Failed gates | `no-obvious-secrets`, `no-obvious-fixture-overfit` |
| Functional defects | `0` |
| Full flow | `not-run`，明确不冒充完整验收 |
| API cost | no key, 0 tokens, `$0` |

关键价值不是“挑刺某个知名项目”，而是报告边界非常清楚：发现 obvious-risk 就提示人工复核；没跑完整用户流就标 `UNVERIFIED/not-run`；没发现功能缺陷就不会编造缺陷。

完整报告：[docs/showcase/browser-use-agent-test-report.md](./docs/showcase/browser-use-agent-test-report.md)

## 报告长什么样

报告会直接回答：

| 维度 | 会不会写进报告 |
| --- | --- |
| 被测项目承诺了什么 | yes |
| 是否跑了代表性完整用户流程 | yes |
| 用户最终看到的输出是否有用 | yes |
| 是否存在空白/弱推荐/模板化输出 | yes |
| 链接、文件、报告是否可消费复核 | yes |
| API key、token 预估和真实消耗 | yes |
| 下一步修什么 | yes |

<details>
<summary>展开查看 github-deepSearch 被测样例截图</summary>

这些截图只是展示 `vibecoding-qa` 如何组织用户可见输出、运行证据和最终 QA 报告，不是项目宣传页。

![被测项目 Web UI 与报告输出](./docs/showcase/github-deepsearch-web-ui-browser-report.png)

![被测项目候选结果和报告](./docs/showcase/github-deepsearch-browser-smoke-latest.png)

![抖音相关需求调研样例](./docs/showcase/github-deepsearch-douyin-query-reference-results.png)

更多：

- [github-deepSearch QA 报告](./docs/showcase/github-deepsearch-agent-test-report.md)
- [浏览器插件需求调研截图](./docs/showcase/github-deepsearch-web-ui-browser-report-alt.png)
- [空结果恢复建议截图](./docs/showcase/github-deepsearch-douyin-query-empty-result.png)

</details>

## API Key / Token 成本

默认 `basic` 模式：

```text
API key required: no
Required API keys: none
LLM mode: no-llm
Estimated tokens: input=0, output=0, total=0
Estimated cost: $0
Actual token usage: input=0, output=0, total=0
Actual recorded cost: $0
```

未来如果加入 LLM/外部 API 模式，必须先实现测试前成本预估、key 声明、预算上限和测试后真实消耗记录；不允许静默烧 token。

## 完整功能流怎么测

`scan` 是静态扫描 + 证据汇总。要让报告判断完整用户流程，需要先记录 runtime 证据：

```bash
node ./bin/agent-test.js run --target D:\code\some-project --out reports/some-project --name scenario-01-main-flow -- python main.py "用户真实需求"
node ./bin/agent-test.js scan D:\code\some-project --out reports/some-project
```

没有 `scenario-01-*` 这类代表性用户流程证据时，报告会标记 `UNVERIFIED` 或 `PARTIAL`，不会把静态扫描包装成完整验收。

## 当前边界

| 能力 | 状态 |
| --- | --- |
| 本地目录扫描 | supported |
| GitHub URL clone 后静态扫描 | supported |
| runtime artifacts 汇总 | supported |
| Markdown + JSON 报告 | supported |
| 自动安装被测项目依赖 | not in basic mode |
| 默认执行被测项目代码 | no |
| 默认调用 LLM/付费 API | no |

## 常用命令

```bash
npm test
npm run verify
npm run setup:browser
npm run probe:browser
```

## 文档

- [VIBECODING_QA_STANDARD.md](./VIBECODING_QA_STANDARD.md)
- [TEST_PROJECT_DIRECTION.md](./TEST_PROJECT_DIRECTION.md)
- [docs/CONFIGURATION.md](./docs/CONFIGURATION.md)
- [docs/REPORT_SCHEMA.md](./docs/REPORT_SCHEMA.md)
- [docs/TESTING_PRINCIPLES.md](./docs/TESTING_PRINCIPLES.md)
- [docs/WORKFLOW_IMPROVEMENTS.md](./docs/WORKFLOW_IMPROVEMENTS.md)

## License

MIT
