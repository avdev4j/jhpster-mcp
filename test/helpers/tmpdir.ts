import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export interface TempDir {
  path: string;
  cleanup: () => Promise<void>;
}

export async function makeTempDir(prefix = "jhipster-mcp-test-"): Promise<TempDir> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  return {
    path: dir,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}
