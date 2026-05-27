import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

/**
 * File-level diff between two directory trees, used by the upgrade preview to
 * show what regenerating with a target generator version would change. Reports
 * which relative paths are added (only in `after`), removed (only in `before`),
 * or modified (present in both, different bytes). Line-level diffing is out of
 * scope for now — file-level is enough to scope an upgrade.
 */
export interface TreeDiff {
  added: string[];
  removed: string[];
  modified: string[];
}

/** Directories never worth walking for a source diff (large, regenerable, or config). */
export const DEFAULT_DIFF_EXCLUDES = new Set([
  "node_modules",
  ".git",
  "target",
  "build",
  "dist",
  ".gradle",
  ".jhipster",
]);

/** Collect every file path (relative to `root`) under `root`, skipping excluded top-level dirs. */
async function listFiles(root: string, excludes: Set<string>): Promise<Set<string>> {
  const out = new Set<string>();
  async function walk(dir: string, rel: string): Promise<void> {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      if (rel === "" && excludes.has(e.name)) continue;
      if (e.isDirectory()) {
        await walk(path.join(dir, e.name), childRel);
      } else if (e.isFile()) {
        out.add(childRel);
      }
    }
  }
  await walk(root, "");
  return out;
}

async function sameContent(a: string, b: string): Promise<boolean> {
  try {
    const [sa, sb] = await Promise.all([stat(a), stat(b)]);
    if (sa.size !== sb.size) return false;
    const [ba, bb] = await Promise.all([readFile(a), readFile(b)]);
    return ba.equals(bb);
  } catch {
    return false;
  }
}

/**
 * Diff two trees. `extraExcludes` are additional relative file names/globs-free
 * basenames to ignore (e.g. the staged `.jdl` / `.yo-rc.json`). Results are sorted.
 */
export async function diffTrees(
  beforeDir: string,
  afterDir: string,
  options: { excludeDirs?: Set<string>; ignoreFile?: (rel: string) => boolean } = {},
): Promise<TreeDiff> {
  const excludes = options.excludeDirs ?? DEFAULT_DIFF_EXCLUDES;
  const ignore = options.ignoreFile ?? (() => false);

  const [before, after] = await Promise.all([
    listFiles(beforeDir, excludes),
    listFiles(afterDir, excludes),
  ]);

  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];

  for (const rel of after) {
    if (ignore(rel)) continue;
    if (!before.has(rel)) added.push(rel);
  }
  for (const rel of before) {
    if (ignore(rel)) continue;
    if (!after.has(rel)) removed.push(rel);
  }
  const common = [...before].filter((rel) => after.has(rel) && !ignore(rel));
  await Promise.all(
    common.map(async (rel) => {
      if (!(await sameContent(path.join(beforeDir, rel), path.join(afterDir, rel)))) {
        modified.push(rel);
      }
    }),
  );

  added.sort();
  removed.sort();
  modified.sort();
  return { added, removed, modified };
}
