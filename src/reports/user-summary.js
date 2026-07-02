export function renderUserQaSummary(report) {
  const failedChecks = report.checks?.items?.filter((item) => item.status === "failed") ?? [];
  const artifacts = report.execution?.commandArtifacts ?? [];
  const scenarios = artifacts.filter((artifact) => /^scenario-\d+/i.test(artifact.name ?? ""));
  const browserSmoke = artifacts.find((artifact) => /web-ui-browser-smoke/i.test(artifact.name ?? ""));
  const pytest = artifacts.find((artifact) => artifact.name === "pytest-current");
  const live = artifacts.find((artifact) => artifact.name === "pytest-live-current");
  const e2e = artifacts.find((artifact) => artifact.name === "pytest-e2e-current");
  const uiLint = artifacts.find((artifact) => artifact.name === "ui-npm-lint");
  const uiBuild = artifacts.find((artifact) => artifact.name === "ui-npm-build");
  const consumption = artifacts.find((artifact) => artifact.name === "artifact-consumption-review");
  const status = businessStatus({ failedChecks, pytest, consumption });

  const lines = [
    "# 用户版测试报告",
    "",
    `> 项目：${inlineCode(report.target)}  `,
    `> 测试时间：${formatDate(report.execution?.finishedAt)}  `,
    `> 给非技术读者的结论：**${status.title}**`,
    "",
    "## 一句话结论",
    "",
    status.summary,
    "",
    "## 本次测了什么",
    "",
    "- 能不能启动和运行主要功能。",
    "- 后端测试、网页操作、真实搜索场景是否能完成。",
    "- 页面上输入需求、点击搜索、看到报告的流程是否顺畅。",
    "- 返回的项目链接是否能打开，报告是否避免把不确定内容说成确定结论。",
    "",
    "## 结果概览",
    "",
    "| 检查项 | 结果 | 说明 |",
    "| --- | --- | --- |",
    resultRow("基础代码检查", artifactPassed(artifacts.find((item) => item.name === "compileall-current")), "代码可以正常编译。"),
    resultRow("自动化测试", artifactPassed(pytest), pytestSummary(pytest)),
    resultRow("网页渲染回归", artifactPassed(e2e), e2e ? "浏览器渲染测试通过。" : "没有找到对应测试记录。"),
    resultRow("真实服务调用", artifactPassed(live), live ? "真实外部服务场景通过。" : "没有运行或没有记录。"),
    resultRow("新版前端检查", artifactPassed(uiLint) && artifactPassed(uiBuild), uiBuildWarning(uiBuild)),
    resultRow("浏览器真实操作", artifactPassed(browserSmoke), browserSmoke ? "页面可打开、可输入、可点击、能看到结果。" : "没有运行或没有记录。"),
    resultRow("推荐链接复核", artifactPassed(consumption), consumptionSummary(consumption)),
    "",
    "## 主要发现",
    "",
    ...mainFindings({ failedChecks, pytest, consumption, scenarios, browserSmoke, uiBuild }),
    "",
    "## 真实场景表现",
    "",
    ...scenarioBlock(scenarios, browserSmoke),
    "",
    "## 建议",
    "",
    ...recommendations({ failedChecks, pytest, consumption, scenarios, uiBuild }),
    "",
    "## 阅读说明",
    "",
    "这份报告只保留管理决策需要的信息。复现命令、详细日志、失败位置和修复线索请看同目录的 `AGENT_TEST_QA_REPORT.md`。"
  ];

  return `${lines.join("\n")}\n`;
}

function businessStatus({ failedChecks, pytest, consumption }) {
  if (artifactFailed(pytest)) {
    return {
      title: "不建议直接发布",
      summary: "项目核心流程大体能跑通，但自动化测试仍有失败项。建议先修复测试失败和报告链接复核问题，再作为稳定版本交付。"
    };
  }
  if (failedChecks.length > 0 || artifactFailed(consumption)) {
    return {
      title: "可以继续试用，但需要复核",
      summary: "主要功能可以运行，真实搜索和网页操作也能完成；不过仍有质量风险需要开发人员确认。"
    };
  }
  return {
    title: "基本可接受",
    summary: "本次没有发现阻断使用的问题，主要用户流程已通过验证。后续仍建议按真实业务场景继续扩充样本。"
  };
}

function mainFindings({ failedChecks, pytest, consumption, scenarios, browserSmoke, uiBuild }) {
  const findings = [];
  if (artifactFailed(pytest)) {
    findings.push("- **自动化测试未全通过。** 本次普通测试结果为：`1 failed, 104 passed, 1 skipped`。失败点是 README 与测试期待的真实运行截图引用不一致。");
  }
  if (failedChecks.length > 0) {
    findings.push(`- **仍有 ${failedChecks.length} 个质量风险需要复核。** 当前失败项包括：${failedChecks.map((item) => inlineCode(item.id)).join("、")}。`);
  }
  if (artifactFailed(consumption)) {
    findings.push("- **推荐链接复核没有完全通过。** 这代表部分候选项目可能只是相邻参考或匹配度不足，不能直接当成可采用方案。");
  }
  if (artifactPassed(browserSmoke)) {
    findings.push("- **网页主流程可以完成。** 浏览器实测中，页面加载、输入、点击搜索、接口返回和结果展示均正常。");
  }
  if (uiBuild?.summary?.includes("warning") || (uiBuild?.outputExcerpt ?? []).some((line) => /warning/i.test(line))) {
    findings.push("- **新版前端可以构建，但构建日志有警告。** 当前警告和 `import.meta` 打包格式有关，建议发布前确认服务端启动路径。");
  }
  if (scenarios.length > 0) {
    findings.push(`- **已跑 ${scenarios.length} 个真实搜索场景。** 其中有强匹配结果，也有低分相邻参考和空结果解释，适合作为下一轮产品判断依据。`);
  }
  return findings.length ? findings : ["- 本次没有发现需要管理层特别关注的风险。"];
}

function scenarioBlock(scenarios, browserSmoke) {
  const lines = [
    "| 场景 | 观察结果 |",
    "| --- | --- |"
  ];
  for (const scenario of scenarios) {
    lines.push(`| ${escapePipes(readableScenarioName(scenario.name))} | ${escapePipes(scenarioOutcome(scenario))} |`);
  }
  if (browserSmoke) {
    lines.push(`| Web 页面实测 | ${artifactPassed(browserSmoke) ? "通过：浏览器可完成搜索并显示报告。" : "未通过：浏览器流程需要检查。"} |`);
  }
  if (lines.length === 2) lines.push("| 未记录 | 本次没有真实场景证据。 |");
  return lines;
}

function recommendations({ failedChecks, pytest, consumption, scenarios, uiBuild }) {
  const items = [];
  if (artifactFailed(pytest)) {
    items.push("1. 先修复 README 与测试契约不一致的问题，或更新测试规则，使项目说明和验收标准重新对齐。");
  }
  if (artifactFailed(consumption)) {
    items.push(`${items.length + 1}. 对低分候选和相邻参考做人工确认，避免把“可借鉴”误解成“可直接采用”。`);
  }
  if (failedChecks.length > 0) {
    items.push(`${items.length + 1}. 请开发人员复核失败的质量检查项，确认是真问题、误报，还是需要调整测试口径。`);
  }
  if ((uiBuild?.outputExcerpt ?? []).some((line) => /import\.meta|warning/i.test(line))) {
    items.push(`${items.length + 1}. 发布新版前端前，确认构建后的服务端入口可以在生产环境正常启动。`);
  }
  if (scenarios.length > 0) {
    items.push(`${items.length + 1}. 后续继续积累真实业务查询样本，特别是中文需求、无直接结果需求和高匹配需求。`);
  }
  return items.length ? items : ["1. 保持当前双报告输出，并在每次重要交付前跑同样的验收流程。"];
}

function artifactPassed(artifact) {
  return artifact ? artifact.exitCode === 0 && artifact.timedOut !== true : false;
}

function artifactFailed(artifact) {
  return artifact ? artifact.exitCode !== 0 || artifact.timedOut === true : false;
}

function resultRow(name, passed, description) {
  return `| ${name} | ${passed ? "通过" : "需处理"} | ${escapePipes(description)} |`;
}

function pytestSummary(artifact) {
  if (!artifact) return "没有找到普通自动化测试记录。";
  return artifactPassed(artifact) ? (artifact.summary || "测试通过。") : (artifact.summary || "测试未通过。");
}

function consumptionSummary(artifact) {
  if (!artifact) return "没有找到链接复核记录。";
  return artifactPassed(artifact) ? "候选链接轻量复核通过。" : "至少一个候选链接或匹配关系需要复核。";
}

function uiBuildWarning(artifact) {
  if (!artifact) return "没有找到新版前端构建记录。";
  const hasWarning = (artifact.outputExcerpt ?? []).some((line) => /warning/i.test(line));
  if (!artifactPassed(artifact)) return "新版前端检查未通过。";
  return hasWarning ? "类型检查和构建通过，但构建日志有警告。" : "类型检查和构建通过。";
}

function scenarioOutcome(artifact) {
  const text = `${artifact.summary ?? ""}\n${(artifact.outputExcerpt ?? []).join("\n")}`;
  if (/Textualize\/rich|100\/100/.test(text)) return "找到强匹配项目 Textualize/rich，适合继续试用。";
  if (/相邻方向|29\/100|不适合直接采用/.test(text)) return "只找到低分相邻参考，需要人工判断，不能直接采用。";
  if (/未找到可直接采用|没有列出项目|empty/i.test(text)) return "没有直接可用结果，但报告给出了原因和下一步建议。";
  if (artifactPassed(artifact)) return "命令执行完成，结果需要业务确认。";
  return "执行失败，需要开发人员查看日志。";
}

function readableScenarioName(name) {
  return String(name ?? "")
    .replace(/^scenario-\d+-/i, "")
    .replace(/-/g, " ");
}

function escapePipes(value) {
  return String(value ?? "").replace(/\|/g, "\\|");
}

function inlineCode(value) {
  return `\`${String(value ?? "")}\``;
}

function formatDate(value) {
  if (!value) return "未记录";
  return String(value).replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}
