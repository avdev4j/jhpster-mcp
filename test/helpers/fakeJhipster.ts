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
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);

// export-jdl <file>: write a JDL file so the upgrade preview can regenerate from it.
if (args[0] === "export-jdl" && args[1]) {
  fs.writeFileSync(path.resolve(process.cwd(), args[1]), process.env.FAKE_JHIPSTER_EXPORT_JDL || "application {}\\n");
}
// FAKE_JHIPSTER_WRITE = JSON array of [relpath, content]; written into cwd (simulates generation).
if (process.env.FAKE_JHIPSTER_WRITE) {
  for (const [rel, content] of JSON.parse(process.env.FAKE_JHIPSTER_WRITE)) {
    const dest = path.resolve(process.cwd(), rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content);
  }
}
const extraLines = parseInt(process.env.FAKE_JHIPSTER_LINES || "0", 10);
for (let i = 1; i <= extraLines; i++) {
  process.stdout.write("step " + i + "\\n");
}
// Optionally emit Yeoman-style file-action lines so structured-output parsing can be tested.
if (process.env.FAKE_JHIPSTER_FILELINES) {
  process.stdout.write(process.env.FAKE_JHIPSTER_FILELINES.split("|").join("\\n") + "\\n");
}
const payload = { cwd: process.cwd(), args };
process.stdout.write("[fake-jhipster] " + JSON.stringify(payload) + "\\n");
if (process.env.FAKE_JHIPSTER_STDERR) {
  process.stderr.write(process.env.FAKE_JHIPSTER_STDERR);
}
process.exit(parseInt(process.env.FAKE_JHIPSTER_EXIT || "0", 10));
`;
  await writeFile(binPath, script, "utf8");
  await chmod(binPath, 0o755);

  // On Windows the extensionless script is not executable; provide the .cmd
  // shim that npm would create, so spawn resolution finds it via PATHEXT.
  if (process.platform === "win32") {
    await writeFile(path.join(binDir, "jhipster.cmd"), `@node "%~dp0jhipster" %*\r\n`, "utf8");
  }

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
