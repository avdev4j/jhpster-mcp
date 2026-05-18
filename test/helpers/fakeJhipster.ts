import { mkdtemp, writeFile, chmod, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export interface FakeJhipster {
  binDir: string;
  cleanup: () => Promise<void>;
  restorePath: () => void;
}

/**
 * Drops a fake `jhipster` script onto a fresh temp dir and prepends it to PATH.
 * The fake script is a Node program that:
 *   - prints `[fake-jhipster] cwd=<cwd> args=<json>` to stdout
 *   - exits with code from FAKE_JHIPSTER_EXIT (default 0)
 *   - optionally writes FAKE_JHIPSTER_STDERR to stderr
 */
export async function installFakeJhipster(): Promise<FakeJhipster> {
  const binDir = await mkdtemp(path.join(tmpdir(), "fake-jhipster-"));
  const binPath = path.join(binDir, "jhipster");
  const script = `#!/usr/bin/env node
const args = process.argv.slice(2);
const payload = { cwd: process.cwd(), args };
process.stdout.write("[fake-jhipster] " + JSON.stringify(payload) + "\\n");
if (process.env.FAKE_JHIPSTER_STDERR) {
  process.stderr.write(process.env.FAKE_JHIPSTER_STDERR);
}
process.exit(parseInt(process.env.FAKE_JHIPSTER_EXIT || "0", 10));
`;
  await writeFile(binPath, script, "utf8");
  await chmod(binPath, 0o755);

  const originalPath = process.env.PATH ?? "";
  process.env.PATH = `${binDir}${path.delimiter}${originalPath}`;

  return {
    binDir,
    cleanup: async () => {
      await rm(binDir, { recursive: true, force: true });
    },
    restorePath: () => {
      process.env.PATH = originalPath;
    },
  };
}

/**
 * Prepend an empty directory to PATH so that `jhipster` cannot be found.
 * Useful for testing the ENOENT branch.
 */
export async function withEmptyPath(): Promise<{ restore: () => void }> {
  const originalPath = process.env.PATH;
  process.env.PATH = "";
  return {
    restore: () => {
      process.env.PATH = originalPath;
    },
  };
}
