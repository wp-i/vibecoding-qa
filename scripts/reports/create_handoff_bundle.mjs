#!/usr/bin/env node

import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function createHandoffBundle(options) {
  const reportPath = resolve(options.report);
  const outputDir = resolve(options.out);
  const artifactDirs = (options.artifactDirs ?? []).map((item) => resolve(item));
  const workspaceRoot = resolve(options.workspaceRoot ?? ".");

  await mkdir(outputDir, { recursive: true });
  await copyFile(reportPath, join(outputDir, basename(reportPath)));

  const copiedArtifacts = [];
  for (const artifactDir of artifactDirs) {
    const copied = await copyArtifactDir(artifactDir, join(outputDir, basename(artifactDir)));
    copiedArtifacts.push(...copied);
  }

  const commandArtifacts = await readCommandArtifacts(copiedArtifacts);
  const manifest = {
    generatedAt: new Date().toISOString(),
    workspaceRoot,
    report: basename(reportPath),
    artifactDirs: artifactDirs.map((dir) => ({
      source: dir,
      bundledAs: basename(dir)
    })),
    artifacts: copiedArtifacts.map((path) => relative(outputDir, path).replace(/\\/g, "/")),
    commandArtifacts
  };

  await writeFile(join(outputDir, "MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(join(outputDir, "MANIFEST.md"), renderManifest(manifest), "utf8");

  return {
    outputDir,
    manifest,
    manifestPath: join(outputDir, "MANIFEST.md")
  };
}

async function copyArtifactDir(sourceDir, targetDir) {
  await mkdir(targetDir, { recursive: true });
  const copied = [];
  for (const entry of await readdir(sourceDir, { withFileTypes: true })) {
    const source = join(sourceDir, entry.name);
    const target = join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copied.push(...(await copyArtifactDir(source, target)));
    } else if (entry.isFile()) {
      await copyFile(source, target);
      copied.push(target);
    }
  }
  return copied;
}

async function readCommandArtifacts(paths) {
  const artifacts = [];
  for (const path of paths) {
    if (!path.endsWith(".json")) continue;
    let parsed;
    try {
      parsed = JSON.parse(await readFile(path, "utf8"));
    } catch {
      continue;
    }
    if (!Array.isArray(parsed.command) || typeof parsed.name !== "string") continue;
    artifacts.push({
      name: parsed.name,
      command: parsed.command,
      cwd: parsed.cwd,
      env: parsed.env ?? [],
      exitCode: parsed.exitCode,
      timedOut: parsed.timedOut,
      durationMs: parsed.durationMs
    });
  }
  return artifacts;
}

function renderManifest(manifest) {
  const lines = [
    "# Handoff Bundle Manifest",
    "",
    `- Generated at: ${manifest.generatedAt}`,
    `- Source workspace root: \`${manifest.workspaceRoot}\``,
    `- Report: \`${manifest.report}\``,
    "",
    "## Artifact Directories",
    "",
    ...formatList(manifest.artifactDirs.map((item) => `\`${item.bundledAs}\` copied from \`${item.source}\``)),
    "",
    "## Command Artifacts",
    "",
    ...formatCommandArtifacts(manifest.commandArtifacts),
    "",
    "## Files",
    "",
    ...formatList(manifest.artifacts.map((item) => `\`${item}\``)),
    ""
  ];
  return `${lines.join("\n")}\n`;
}

function formatCommandArtifacts(artifacts) {
  if (artifacts.length === 0) return ["- none"];
  return artifacts.map((artifact) => {
    const env = artifact.env.length ? artifact.env.join(", ") : "none";
    return `- \`${artifact.name}\`: exit ${artifact.exitCode}, env keys: ${env}, cwd: \`${artifact.cwd}\``;
  });
}

function formatList(items) {
  if (items.length === 0) return ["- none"];
  return items.map((item) => `- ${item}`);
}

function parseArgs(args) {
  const options = { artifactDirs: [] };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--report") {
      requireValue(arg, next);
      options.report = next;
      index += 1;
    } else if (arg === "--artifact-dir") {
      requireValue(arg, next);
      options.artifactDirs.push(next);
      index += 1;
    } else if (arg === "--out") {
      requireValue(arg, next);
      options.out = next;
      index += 1;
    } else if (arg === "--workspace-root") {
      requireValue(arg, next);
      options.workspaceRoot = next;
      index += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (!options.report) throw new Error("--report is required");
  if (!options.out) throw new Error("--out is required");
  return options;
}

function requireValue(arg, value) {
  if (!value) throw new Error(`${arg} requires a value`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  createHandoffBundle(parseArgs(process.argv.slice(2)))
    .then((result) => {
      console.log(`Handoff bundle written to ${result.outputDir}`);
      console.log(`Manifest written to ${result.manifestPath}`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
