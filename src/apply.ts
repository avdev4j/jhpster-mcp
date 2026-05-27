import { writeFile, readFile, mkdtemp, rm, cp, access, constants } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runJhipster, formatRunResult, type RunResult } from "./jhipster.js";
import type { OnData } from "./progress.js";

const BASE_ARGS = ["--force", "--skip-git"];

/**
 * Project files copied into an isolated preview dir so a dry run reflects the
 * real application config + existing entities. JHipster 9's `--dry-run` only
 * prints conflicts (it still writes), so a true no-write preview means
 * generating into a throwaway copy and discarding it.
 */
const CONTEXT_ENTRIES = [".yo-rc.json", ".jhipster"];

export interface ApplyJdlOptions {
  workingDirectory: string;
  jdl: string;
  /** Filename used to persist the JDL into the project (ignored on a dry run). */
  filename: string;
  extraArgs?: string[];
  /** When true, generate in an isolated temp copy and discard it — the project is never modified. */
  dryRun?: boolean;
  onData?: OnData;
}

export interface ApplyJdlResult extends RunResult {
  /** Where the JDL was (or would be) written in the project. */
  jdlPath: string;
  dryRun: boolean;
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

/**
 * Persist the JDL and apply it via `jhipster jdl`, or (when `dryRun`) generate in
 * an isolated copy and discard it. Centralises the branching shared by every
 * JDL-applying tool.
 */
export async function applyJdl(opts: ApplyJdlOptions): Promise<ApplyJdlResult> {
  const extraArgs = opts.extraArgs ?? [];

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

  const jdlPath = path.join(opts.workingDirectory, opts.filename);
  await writeFile(jdlPath, opts.jdl, "utf8");
  const result = await runJhipster({
    cwd: opts.workingDirectory,
    args: ["jdl", opts.filename, ...BASE_ARGS, ...extraArgs],
    onData: opts.onData,
  });
  return { ...result, jdlPath, dryRun: false };
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
  return note + body;
}
