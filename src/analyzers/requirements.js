import { readFile } from "node:fs/promises";
import { join } from "node:path";

const MAX_ITEMS_PER_FILE = 40;
const REQUIREMENT_HINTS = [
  "目标",
  "必须",
  "需要",
  "支持",
  "功能",
  "验收",
  "实现",
  "符合",
  "用户",
  "流程",
  "场景",
  "用例",
  "输入",
  "输出",
  "可用",
  "不能",
  "检查",
  "测试",
  "生成",
  "should",
  "must",
  "support",
  "require",
  "requirement",
  "acceptance",
  "feature",
  "function",
  "workflow",
  "scenario",
  "input",
  "output",
  "expected",
  "must_have",
  "evidence"
];

export async function extractRequirements(markdownFiles) {
  const items = [];

  for (const file of markdownFiles) {
    const absolutePath = join(fileRoot(file), file.path);
    let content = "";

    try {
      content = await readFile(absolutePath, "utf8");
    } catch {
      continue;
    }

    items.push(...extractFromMarkdown(file.path, content));
  }

  return {
    count: items.length,
    items
  };
}

export function extractFromMarkdown(source, content) {
  const lines = content.split(/\r?\n/);
  const items = [];
  let currentHeading = "";

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.trim();

    if (!line) continue;

    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      currentHeading = heading[2].trim();
      if (isRequirementLike(currentHeading)) {
        items.push(toItem(source, index + 1, currentHeading, "heading", currentHeading));
      }
      continue;
    }

    const bullet = /^[-*]\s+(.+)$/.exec(line);
    if (bullet && isRequirementLike(bullet[1])) {
      items.push(toItem(source, index + 1, bullet[1], "bullet", currentHeading));
      if (items.length >= MAX_ITEMS_PER_FILE) break;
    }
  }

  return items;
}

function toItem(source, line, text, kind, section) {
  return {
    id: `${source}:${line}`,
    source,
    line,
    kind,
    section,
    text: cleanText(text)
  };
}

function isRequirementLike(text) {
  const lower = text.toLowerCase();
  return REQUIREMENT_HINTS.some((hint) => lower.includes(hint.toLowerCase()));
}

function cleanText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function fileRoot(file) {
  return file.root ?? process.cwd();
}
