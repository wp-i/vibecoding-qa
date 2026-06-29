import test from "node:test";
import assert from "node:assert/strict";
import { extractFromMarkdown } from "../src/analyzers/requirements.js";

test("extracts requirement-like headings and bullets from markdown", () => {
  const items = extractFromMarkdown("README.md", `# Project

## 核心目标

- 支持 GitHub 链接输入。
- 验收标准：用户可以完成核心流程。
- 普通说明不会被收集。
- Must generate reports.
`);

  assert.equal(items.length, 4);
  assert.equal(items[0].kind, "heading");
  assert.match(items[1].text, /GitHub/);
  assert.match(items[2].text, /核心流程/);
  assert.match(items[3].text, /reports/);
});
