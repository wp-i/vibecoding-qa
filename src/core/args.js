import { resolve } from "node:path";
import { loadConfig, mergeConfig } from "./config.js";

export async function parseScanArgs(args) {
  const cli = {};
  let positionalTarget = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === "--target") {
      requireValue(arg, next);
      cli.project = { ...(cli.project ?? {}), target: next };
      index += 1;
    } else if (arg === "--out") {
      requireValue(arg, next);
      cli.report = { ...(cli.report ?? {}), output: next };
      index += 1;
    } else if (arg === "--mode") {
      throw new Error("--mode is not supported; agent-test has one LLM-required acceptance mode.");
    } else if (arg === "--max-files") {
      requireValue(arg, next);
      cli.mode = { ...(cli.mode ?? {}), maxFiles: parsePositiveInteger(next, "--max-files") };
      index += 1;
    } else if (arg === "--config") {
      requireValue(arg, next);
      cli.configPath = next;
      index += 1;
    } else if (arg === "--fail-on-check-failures") {
      cli.report = { ...(cli.report ?? {}), failOnCheckFailures: true };
    } else if (arg === "--ignore-secret-path") {
      requireValue(arg, next);
      cli.security = {
        ...(cli.security ?? {}),
        ignoreSecretPaths: [...(cli.security?.ignoreSecretPaths ?? []), next]
      };
      index += 1;
    } else if (arg === "--ignore-path") {
      requireValue(arg, next);
      cli.project = {
        ...(cli.project ?? {}),
        ignorePaths: [...(cli.project?.ignorePaths ?? []), next]
      };
      index += 1;
    } else if (!arg.startsWith("-") && positionalTarget === null) {
      positionalTarget = arg;
    } else {
      throw new Error(`Unknown scan option: ${arg}`);
    }
  }

  if (positionalTarget && !cli.project?.target) {
    cli.project = { ...(cli.project ?? {}), target: positionalTarget };
  }

  const config = mergeConfig(await loadConfig(cli.configPath), cli);

  return {
    target: config.project.target,
    outputDir: resolve(config.report.output),
    mode: config.mode.name,
    config
  };
}

export function parseRunArgs(args) {
  const options = {
    target: ".",
    out: "reports/commands",
    name: "command",
    timeoutMs: 120000,
    env: {}
  };
  const separatorIndex = args.indexOf("--");
  if (separatorIndex < 0) {
    throw new Error("run requires -- followed by a command");
  }

  const optionArgs = args.slice(0, separatorIndex);
  const commandArgs = args.slice(separatorIndex + 1);
  if (commandArgs.length === 0) {
    throw new Error("run requires a command after --");
  }

  for (let index = 0; index < optionArgs.length; index += 1) {
    const arg = optionArgs[index];
    const next = optionArgs[index + 1];
    if (arg === "--target") {
      requireValue(arg, next);
      options.target = next;
      index += 1;
    } else if (arg === "--out") {
      requireValue(arg, next);
      options.out = next;
      index += 1;
    } else if (arg === "--name") {
      requireValue(arg, next);
      options.name = next;
      index += 1;
    } else if (arg === "--timeout-ms") {
      requireValue(arg, next);
      options.timeoutMs = parsePositiveInteger(next, "--timeout-ms");
      index += 1;
    } else if (arg === "--env") {
      requireValue(arg, next);
      const [key, ...valueParts] = next.split("=");
      if (!key || valueParts.length === 0) {
        throw new Error("--env requires KEY=VALUE");
      }
      options.env[key] = valueParts.join("=");
      index += 1;
    } else {
      throw new Error(`Unknown run option: ${arg}`);
    }
  }

  return {
    name: options.name,
    cwd: resolve(options.target),
    outputDir: resolve(options.out),
    timeoutMs: options.timeoutMs,
    env: options.env,
    command: commandArgs[0],
    args: commandArgs.slice(1)
  };
}

function requireValue(arg, value) {
  if (!value) {
    throw new Error(`${arg} requires a value`);
  }
}

function parsePositiveInteger(value, label) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}
