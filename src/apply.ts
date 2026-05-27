import { writeFile, readFile, mkdtemp, rm, cp, access, constants } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runJhipster, formatRunResult, type RunResult } from "./jhipster.js";
import { parseFileChanges, summarizeChanges } from "./result.js";
import { buildBlueprintsArgs } from "./jdl/builders.js";
import { assertWithinRoot } from "./config.js";
import type { OnData } from "./progress.js";

const BASE_ARGS = ["--force", "--skip-git"];

/**
 * Project files copied into an isolated preview dir so a dry run reflects the
 * real application config + existing entities. JHipster 9's `--dry-run` only
 * prints conflicts (it still writes), so a true no-write preview means
 * generating into a throwaway copy and discarding it.
 */
const CONTEXT_ENTRIES = [".yo-rc.json", ".jhipster"];

/**
 * Top-level directories excluded from a safety backup — large and fully
 * regenerable, so copying them would be slow and pointless for rollback.
 */
const BACKUP_EXCLUDES = new Set(["node_modules", ".git", "target", "build", "dist", ".gradle"]);

export interface ApplyJdlOptions {
  workingDirectory: string;
  jdl: string;
  /** Filename used to persist the JDL into the project (ignored on a dry run). */
  filename: string;
  extraArgs?: string[];
  /** When true, generate in an isolated temp copy and discard it — the project is never modified. */
  dryRun?: boolean;
  /** When true (and not a dry run), snapshot the project before the `--force` run so it can be restored. */
  backup?: boolean;
  /** Generator blueprints to apply, mapped to `--blueprints a,b` (validated). */
  blueprints?: string[];
  onData?: OnData;
}

export interface ApplyJdlResult extends RunResult {
  /** Where the JDL was (or would be) written in the project. */
  jdlPath: string;
  dryRun: boolean;
  /** Absolute path to the pre-generation backup, when one was taken. */
  backupPath?: string;
}

/**
 * Snapshot a project directory into a fresh temp dir before a destructive run,
 * skipping large regenerable folders ([[BACKUP_EXCLUDES]]). Returns the backup's
 * absolute path so callers can surface a rollback instruction. No git involved —
 * this is the server's no-git safety net for `--force` overwrites.
 */
export async function backupProject(projectDir: string): Promise<string> {
  const base = path.basename(projectDir) || "project";
  const dest = await mkdtemp(path.join(tmpdir(), `jhipster-mcp-backup-${base}-`));
  await cp(projectDir, dest, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(projectDir, src);
      if (rel === "") return true; // the project root itself
      const top = rel.split(path.sep)[0]!;
      return !BACKUP_EXCLUDES.has(top);
    },
  });
  return dest;
}

/** Best-effort copy of the project's generator context (`.yo-rc.json`, `.jhipster/`) into `dest`. */
export async function copyProjectContext(src: string, dest: string): Promise<void> {
  for (const entry of CONTEXT_ENTRIES) {
    const from = path.join(src, entry);
    try {
      await access(from, constants.F_OK);
    } catch {
      continue; // not present in this project — skip
    }
    await cp(from, path.join(dest, entry), { recursive: true });
  }
}

/**
 * Run `jhipster jdl` for the given JDL in an isolated temp directory and discard
 * it afterwards. Used for dry-run previews and validation so nothing in the real
 * project changes. The project's config/entities are copied in first (if present)
 * so the preview is faithful.
 */
export async function runJdlIsolated(opts: {
  jdl: string;
  /** Project to copy context from; may not exist (new-app preview). */
  contextDir?: string;
  extraArgs?: string[];
  onData?: OnData;
}): Promise<RunResult> {
  const tempDir = await mkdtemp(path.join(tmpdir(), "jhipster-mcp-preview-"));
  try {
    if (opts.contextDir) {
      try {
        await access(opts.contextDir, constants.F_OK);
        await copyProjectContext(opts.contextDir, tempDir);
      } catch {
        /* contextDir missing (e.g. brand-new app) — nothing to copy */
      }
    }
    const filename = "preview.jdl";
    await writeFile(path.join(tempDir, filename), opts.jdl, "utf8");
    return await runJhipster({
      cwd: tempDir,
      args: ["jdl", filename, ...BASE_ARGS, "--skip-install", ...(opts.extraArgs ?? [])],
      onData: opts.onData,
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

/**
 * Synthesize the project's current JDL via `jhipster export-jdl`, run in an
 * isolated temp copy so the project directory is never written to. The project's
 * `.yo-rc.json` + `.jhipster/` are copied in first (export-jdl reads them), then
 * the generated `.jdl` is read back and the temp dir discarded.
 */
export async function exportJdlIsolated(contextDir: string): Promise<{ jdl: string; result: RunResult }> {
  const tempDir = await mkdtemp(path.join(tmpdir(), "jhipster-mcp-export-"));
  try {
    await copyProjectContext(contextDir, tempDir);
    const outFile = "export.jdl";
    const result = await runJhipster({
      cwd: tempDir,
      args: ["export-jdl", outFile, "--skip-git"],
    });
    let jdl = "";
    try {
      jdl = await readFile(path.join(tempDir, outFile), "utf8");
    } catch {
      /* export-jdl produced no file (e.g. not a JHipster project) */
    }
    return { jdl, result };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export interface RegenResult {
  /** Temp dir containing the regenerated project. Caller MUST `rm` it when done. */
  dir: string;
  exportResult: RunResult;
  regenResult: RunResult;
  /** True when export-jdl produced a usable JDL to regenerate from. */
  exported: boolean;
}

/**
 * Regenerate a project from its own model into a throwaway temp dir, optionally
 * with a different generator version (via npx), for an upgrade preview. Copies
 * the project's `.yo-rc.json` + `.jhipster/`, runs `export-jdl` to capture the
 * model, then `jhipster jdl` to regenerate. The temp dir is returned (not
 * deleted) so the caller can diff it against the current project.
 */
export async function regenerateProjectIsolated(opts: {
  contextDir: string;
  generatorVersion?: string;
  onData?: OnData;
}): Promise<RegenResult> {
  const dir = await mkdtemp(path.join(tmpdir(), "jhipster-mcp-regen-"));
  await copyProjectContext(opts.contextDir, dir);
  const jdlFile = "upgrade-preview.jdl";

  const exportResult = await runJhipster({
    cwd: dir,
    args: ["export-jdl", jdlFile, "--skip-git"],
    generatorVersion: opts.generatorVersion,
    onData: opts.onData,
  });

  let exported = false;
  try {
    await access(path.join(dir, jdlFile), constants.F_OK);
    exported = true;
  } catch {
    /* nothing exported (e.g. not a JHipster project) */
  }

  let regenResult = exportResult;
  if (exported) {
    regenResult = await runJhipster({
      cwd: dir,
      args: ["jdl", jdlFile, ...BASE_ARGS, "--skip-install"],
      generatorVersion: opts.generatorVersion,
      onData: opts.onData,
    });
  }

  return { dir, exportResult, regenResult, exported };
}

/**
 * Persist the JDL and apply it via `jhipster jdl`, or (when `dryRun`) generate in
 * an isolated copy and discard it. Centralises the branching shared by every
 * JDL-applying tool.
 */
export async function applyJdl(opts: ApplyJdlOptions): Promise<ApplyJdlResult> {
  assertWithinRoot(opts.workingDirectory);
  // Blueprint flags ride alongside any caller-supplied extra args.
  const extraArgs = [...buildBlueprintsArgs(opts.blueprints), ...(opts.extraArgs ?? [])];

  if (opts.dryRun) {
    const result = await runJdlIsolated({
      jdl: opts.jdl,
      contextDir: opts.workingDirectory,
      extraArgs,
      onData: opts.onData,
    });
    return {
      ...result,
      jdlPath: path.join(opts.workingDirectory, opts.filename),
      dryRun: true,
    };
  }

  // Snapshot the pristine project before writing the JDL or running --force,
  // so a bad generation is one restore away. Skipped on dry runs (no writes).
  const backupPath = opts.backup ? await backupProject(opts.workingDirectory) : undefined;

  const jdlPath = path.join(opts.workingDirectory, opts.filename);
  await writeFile(jdlPath, opts.jdl, "utf8");
  const result = await runJhipster({
    cwd: opts.workingDirectory,
    args: ["jdl", opts.filename, ...BASE_ARGS, ...extraArgs],
    onData: opts.onData,
  });
  return { ...result, jdlPath, dryRun: false, backupPath };
}

/**
 * Render an apply result for a tool response. `echoJdl` controls whether the
 * (server-built) JDL is shown back — useful for granular tools where the agent
 * did not author the JDL directly.
 */
export function formatApplyResult(
  jdl: string,
  result: ApplyJdlResult,
  echoJdl: boolean,
): string {
  const note = result.dryRun
    ? "Dry run — generated in an isolated copy and discarded; your project was not modified. Preview below.\n\n"
    : "";
  const body = echoJdl
    ? `${result.dryRun ? "Validated JDL" : "Applied JDL"}:\n${jdl}\n\n${formatRunResult(result)}`
    : formatRunResult(result);

  const summary = summarizeChanges(parseFileChanges(`${result.stdout}\n${result.stderr}`));
  const projectDir = path.dirname(result.jdlPath);
  const backup = result.backupPath
    ? `\n\nBackup taken before this run: ${result.backupPath}\n` +
      `To roll back, restore it over the project and remove the backup:\n` +
      `  cp -R "${result.backupPath}/." "${projectDir}/" && rm -rf "${result.backupPath}"`
    : "";

  return `${note}${body}\n\n${summary}${backup}`;
}
