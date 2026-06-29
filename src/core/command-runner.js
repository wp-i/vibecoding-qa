import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";

const DEFAULT_TIMEOUT_MS = 120000;

export async function runRecordedCommand(options) {
  const startedAt = Date.now();
  const startedAtIso = new Date(startedAt).toISOString();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const result = await runProcess({
    command: options.command,
    args: options.args ?? [],
    cwd: options.cwd,
    timeoutMs,
    env: options.env ?? {}
  });
  const finishedAt = Date.now();
  const finishedAtIso = new Date(finishedAt).toISOString();

  const artifact = {
    name: options.name,
    startedAt: startedAtIso,
    finishedAt: finishedAtIso,
    command: [options.command, ...(options.args ?? [])],
    cwd: options.cwd,
    env: Object.keys(options.env ?? {}).sort(),
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    durationMs: finishedAt - startedAt,
    stdout: redactSecrets(result.stdout),
    stderr: redactSecrets(result.stderr)
  };

  await mkdir(options.outputDir, { recursive: true });
  const jsonPath = join(options.outputDir, `${safeName(options.name)}.json`);
  const textPath = join(options.outputDir, `${safeName(options.name)}.txt`);
  await writeFile(jsonPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  await writeFile(textPath, renderTextArtifact(artifact), "utf8");

  return {
    artifact,
    jsonPath,
    textPath
  };
}

export function redactSecrets(text) {
  return text
    .replace(/github_pat_[A-Za-z0-9_]+/g, "[REDACTED_GITHUB_TOKEN]")
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "[REDACTED_API_KEY]")
    .replace(/tvly-[A-Za-z0-9_-]+/g, "[REDACTED_TAVILY_KEY]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED_TOKEN]");
}

function runProcess({ command, args, cwd, timeoutMs, env }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONUTF8: process.env.PYTHONUTF8 ?? "1",
        PYTHONIOENCODING: process.env.PYTHONIOENCODING ?? "utf-8",
        ...env
      }
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      terminateProcessTree(child);
    }, timeoutMs);

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({
        exitCode,
        timedOut,
        stdout,
        stderr
      });
    });
  });
}

function terminateProcessTree(child) {
  if (!child.pid) return;
  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore"
    });
    killer.on("error", () => {
      child.kill("SIGTERM");
    });
    return;
  }
  child.kill("SIGTERM");
}

function renderTextArtifact(artifact) {
  return [
    `# ${artifact.name}`,
    "",
    `startedAt: ${artifact.startedAt}`,
    `finishedAt: ${artifact.finishedAt}`,
    `cwd: ${artifact.cwd}`,
    `command: ${artifact.command.join(" ")}`,
    `env: ${artifact.env.length ? artifact.env.join(", ") : "(none)"}`,
    `exitCode: ${artifact.exitCode}`,
    `timedOut: ${artifact.timedOut}`,
    `durationMs: ${artifact.durationMs}`,
    "",
    "## stdout",
    "",
    artifact.stdout || "(empty)",
    "",
    "## stderr",
    "",
    artifact.stderr || "(empty)",
    ""
  ].join("\n");
}

function safeName(name) {
  return name.replace(/[^a-z0-9_.-]+/gi, "-").replace(/^-+|-+$/g, "") || "command";
}
