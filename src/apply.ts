import { writeFile } from "node:fs/promises";
import path from "node:path";
import { runJhipster, formatRunResult, type RunResult } from "./jhipster.js";
import { withTempJdlFile } from "./jdl/builders.js";
import type { OnData } from "./progress.js";

const BASE_ARGS = ["--force", "--skip-git"];

export interface ApplyJdlOptions {
  workingDirectory: string;
  jdl: string;
  /** Filename used to persist the JDL into the project (ignored on a dry run). */
  filename: string;
  extraArgs?: string[];
  /** When true, append `--dry-run` and write the JDL to a temp file so nothing in the project changes. */
  dryRun?: boolean;
  onData?: OnData;
}

export interface ApplyJdlResult extends RunResult {
  /** Where the JDL was written (inside the project, or a temp file for dry runs). */
  jdlPath: string;
  dryRun: boolean;
}

/**
 * Persist (or, for a dry run, stage in a temp file) the given JDL and apply it
 * via `jhipster jdl`. Centralises the persist-vs-dry-run branching shared by
 * every JDL-applying tool.
 */
export async function applyJdl(opts: ApplyJdlOptions): Promise<ApplyJdlResult> {
  const extraArgs = opts.extraArgs ?? [];

  if (opts.dryRun) {
    return withTempJdlFile(opts.jdl, async (tmpFile) => {
      const result = await runJhipster({
        cwd: opts.workingDirectory,
        args: ["jdl", tmpFile, ...BASE_ARGS, "--dry-run", ...extraArgs],
        onData: opts.onData,
      });
      return { ...result, jdlPath: tmpFile, dryRun: true };
    });
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
    ? "Dry run — no files were written (jhipster --dry-run). Preview below.\n\n"
    : "";
  const body = echoJdl
    ? `${result.dryRun ? "Validated JDL" : "Applied JDL"}:\n${jdl}\n\n${formatRunResult(result)}`
    : formatRunResult(result);
  return note + body;
}
