import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile, readdir, rm, access, constants } from "node:fs/promises";
import path from "node:path";
import type { StructuredRunResult } from "../../src/result.js";
import { registerImportJdl } from "../../src/tools/importJdl.js";
import { createMcpPair, getText } from "../helpers/mcp.js";
import { installFakeJhipster } from "../helpers/fakeJhipster.js";
import { makeTempDir } from "../helpers/tmpdir.js";

/** Seed a fake JHipster project: a config file, a source file, and a heavy dir that must be excluded. */
async function seedProject(dir: string): Promise<void> {
  await writeFile(path.join(dir, ".yo-rc.json"), JSON.stringify({ "generator-jhipster": {} }), "utf8");
  await mkdir(path.join(dir, "src", "main"), { recursive: true });
  await writeFile(path.join(dir, "src", "main", "App.java"), "class App {}", "utf8");
  await mkdir(path.join(dir, "node_modules", "junk"), { recursive: true });
  await writeFile(path.join(dir, "node_modules", "junk", "index.js"), "// huge", "utf8");
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

describe("safe-apply backup", () => {
  it("snapshots the project before a --force apply and surfaces the path + rollback note", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    const { client, close } = await createMcpPair(registerImportJdl);
    let backupPath: string | undefined;
    try {
      await seedProject(tmp.path);
      const res = (await client.callTool({
        name: "import_jdl",
        arguments: {
          workingDirectory: tmp.path,
          jdl: "entity Foo { bar String }",
          backup: true,
        },
      })) as { isError?: boolean; structuredContent?: StructuredRunResult; content: unknown };

      const sc = res.structuredContent!;
      backupPath = sc.backupPath;
      assert.ok(backupPath, "expected a backupPath in structuredContent");
      assert.match(backupPath!, /jhipster-mcp-backup-/);

      // The backup is a faithful copy minus the excluded heavy dir.
      assert.ok(await exists(path.join(backupPath!, ".yo-rc.json")), "backup should contain .yo-rc.json");
      assert.equal(
        await readFile(path.join(backupPath!, "src", "main", "App.java"), "utf8"),
        "class App {}",
      );
      assert.equal(
        await exists(path.join(backupPath!, "node_modules")),
        false,
        "node_modules must be excluded from the backup",
      );

      // The change.jdl written by this run is NOT in the (pristine) backup.
      assert.equal(await exists(path.join(backupPath!, "changes.jdl")), false);

      const text = getText(res as never);
      assert.match(text, /Backup taken before this run/);
      assert.match(text, /To roll back/);
    } finally {
      await close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
      if (backupPath) await rm(backupPath, { recursive: true, force: true });
    }
  });

  it("does not back up on a dry run", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    const { client, close } = await createMcpPair(registerImportJdl);
    try {
      await seedProject(tmp.path);
      const res = (await client.callTool({
        name: "import_jdl",
        arguments: {
          workingDirectory: tmp.path,
          jdl: "entity Foo {}",
          backup: true,
          dryRun: true,
        },
      })) as { structuredContent?: StructuredRunResult };
      assert.equal(res.structuredContent!.backupPath, undefined);
    } finally {
      await close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });

  it("does not back up when backup is not requested", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    const { client, close } = await createMcpPair(registerImportJdl);
    try {
      await seedProject(tmp.path);
      const res = (await client.callTool({
        name: "import_jdl",
        arguments: { workingDirectory: tmp.path, jdl: "entity Foo {}" },
      })) as { structuredContent?: StructuredRunResult };
      assert.equal(res.structuredContent!.backupPath, undefined);
      // Sanity: the JDL was still applied to the project.
      const remaining = await readdir(tmp.path);
      assert.ok(remaining.includes("changes.jdl"));
    } finally {
      await close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });
});
