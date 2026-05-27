import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { diffTrees } from "../src/diff.js";
import { makeTempDir } from "./helpers/tmpdir.js";

async function write(dir: string, rel: string, content: string): Promise<void> {
  const dest = path.join(dir, rel);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, content, "utf8");
}

describe("diffTrees", () => {
  it("classifies added, removed, and modified files", async () => {
    const before = await makeTempDir();
    const after = await makeTempDir();
    try {
      await write(before.path, "src/App.java", "old");
      await write(before.path, "src/Removed.java", "x");
      await write(before.path, "pom.xml", "<p/>");
      await write(after.path, "src/App.java", "new"); // modified
      await write(after.path, "src/New.java", "n"); // added
      await write(after.path, "pom.xml", "<p/>"); // unchanged

      const diff = await diffTrees(before.path, after.path);
      assert.deepEqual(diff.added, ["src/New.java"]);
      assert.deepEqual(diff.removed, ["src/Removed.java"]);
      assert.deepEqual(diff.modified, ["src/App.java"]);
    } finally {
      await before.cleanup();
      await after.cleanup();
    }
  });

  it("skips excluded directories like node_modules and .jhipster", async () => {
    const before = await makeTempDir();
    const after = await makeTempDir();
    try {
      await write(before.path, "node_modules/dep/index.js", "a");
      await write(before.path, ".jhipster/Entity.json", "{}");
      await write(after.path, "node_modules/dep/index.js", "DIFFERENT");
      await write(after.path, ".jhipster/Entity.json", "{ changed }");

      const diff = await diffTrees(before.path, after.path);
      assert.deepEqual(diff, { added: [], removed: [], modified: [] });
    } finally {
      await before.cleanup();
      await after.cleanup();
    }
  });

  it("honors a custom ignoreFile predicate", async () => {
    const before = await makeTempDir();
    const after = await makeTempDir();
    try {
      await write(before.path, ".yo-rc.json", "{a}");
      await write(after.path, ".yo-rc.json", "{b}");
      await write(after.path, "x.jdl", "application {}");

      const diff = await diffTrees(before.path, after.path, {
        ignoreFile: (rel) => rel === ".yo-rc.json" || rel.endsWith(".jdl"),
      });
      assert.deepEqual(diff, { added: [], removed: [], modified: [] });
    } finally {
      await before.cleanup();
      await after.cleanup();
    }
  });
});
