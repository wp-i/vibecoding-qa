import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function createProjectWorkspace(target) {
  if (isGitHubUrl(target)) {
    const dir = await mkdtemp(join(tmpdir(), "agent-test-"));
    await execFileAsync("git", ["clone", "--depth", "1", target, dir], {
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 10
    });

    return {
      kind: "github",
      source: target,
      path: dir,
      dynamicExecution: "disabled",
      commands: [`git clone --depth 1 ${target} ${dir}`],
      safety: [
        "Static scan only.",
        "Target dependency installation is disabled.",
        "Target project scripts are not executed."
      ]
    };
  }

  return {
    kind: "local",
    source: target,
    path: resolve(target),
    dynamicExecution: "disabled",
    commands: [],
    safety: [
      "Static scan only.",
      "Target dependency installation is disabled.",
      "Target project scripts are not executed."
    ]
  };
}

function isGitHubUrl(value) {
  return /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+(?:\.git)?\/?$/.test(value);
}
