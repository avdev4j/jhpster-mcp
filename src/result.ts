import { z } from "zod";

/** A file the generator reported creating/overwriting/skipping. */
export interface FileChange {
  action: string;
  path: string;
}

export interface StructuredRunResult {
  /** The `jhipster ...` command line that was run. */
  command: string;
  exitCode: number;
  success: boolean;
  dryRun: boolean;
  /** Entity names declared in the applied JDL (empty when not applicable). */
  entities: string[];
  /** Files the generator reported touching, parsed from its output. */
  filesChanged: FileChange[];
  /** Warning lines surfaced by the generator. */
  warnings: string[];
  /** Index signature so this satisfies the MCP `structuredContent` shape. */
  [key: string]: unknown;
}

/** zod raw shape for `outputSchema`, shared by every jhipster-running tool. */
export const structuredOutputShape = {
  command: z.string(),
  exitCode: z.number(),
  success: z.boolean(),
  dryRun: z.boolean(),
  entities: z.array(z.string()),
  filesChanged: z.array(z.object({ action: z.string(), path: z.string() })),
  warnings: z.array(z.string()),
};

// eslint-disable-next-line no-control-regex
const ANSI = /\[[0-9;]*m/g;
const FILE_LINE =
  /^\s*(create|force|identical|skip|conflict|remove|delete|add|rename)\s+(\S.*?)\s*$/;
const ENTITY_DECL = /\bentity\s+([A-Z][A-Za-z0-9]*)/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI, "");
}

/** Pull entity names out of JDL source (e.g. `entity Customer { ... }`). */
export function extractEntities(jdl: string): string[] {
  const out = new Set<string>();
  ENTITY_DECL.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ENTITY_DECL.exec(jdl)) !== null) {
    out.add(match[1]!);
  }
  return [...out];
}

/** Parse Yeoman/JHipster file-action lines (`create ...`, `force ...`, `conflict ...`). */
export function parseFileChanges(output: string): FileChange[] {
  const changes: FileChange[] = [];
  for (const raw of stripAnsi(output).split("\n")) {
    const match = FILE_LINE.exec(raw);
    if (match) {
      changes.push({ action: match[1]!, path: match[2]! });
    }
  }
  return changes;
}

/** Collect distinct warning lines from generator output. */
export function parseWarnings(output: string): string[] {
  const seen = new Set<string>();
  for (const raw of stripAnsi(output).split("\n")) {
    const line = raw.trim();
    if (line.length > 0 && /\bwarn(ing)?\b/i.test(line)) {
      seen.add(line.slice(0, 300));
    }
  }
  return [...seen];
}

/** Build the structured result from a raw run result plus optional context. */
export function toStructuredResult(
  r: { command: string; exitCode: number; stdout: string; stderr: string },
  opts: { jdl?: string; dryRun?: boolean } = {},
): StructuredRunResult {
  const combined = `${r.stdout}\n${r.stderr}`;
  return {
    command: r.command,
    exitCode: r.exitCode,
    success: r.exitCode === 0,
    dryRun: opts.dryRun ?? false,
    entities: opts.jdl ? extractEntities(opts.jdl) : [],
    filesChanged: parseFileChanges(combined),
    warnings: parseWarnings(combined),
  };
}
