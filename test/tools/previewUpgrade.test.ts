import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { registerPreviewUpgrade } from "../../src/tools/previewUpgrade.js";
import { createMcpPair, getText } from "../helpers/mcp.js";
import { installFakeJhipster } from "../helpers/fakeJhipster.js";
import { makeTempDir } from "../helpers/tmpdir.js";

interface PreviewOutput {
  targetVersion: string | null;
  exported: boolean;
  added: string[];
  removed: string[];
  modified: string[];
  summary: { added: number; removed: number; modified: number };
  notes: string[];
}

async function write(dir: string, rel: string, content: string): Promise<void> {
  const dest = path.join(dir, rel);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, content, "utf8");
}

afterEach(() => {
  delete process.env.FAKE_JHIPSTER_WRITE;
});

describe("preview_upgrade tool", () => {
  it("diffs the regenerated project against the current files", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    // Current project: an app file, a file that won't be regenerated, config.
    await write(tmp.path, ".yo-rc.json", JSON.stringify({ "generator-jhipster": { baseName: "shop" } }));
    await write(tmp.path, ".jhipster/Product.json", "{}");
    await write(tmp.path, "src/App.java", "old contents");
    await write(tmp.path, "src/Removed.java", "gone after regen");
    // What the (fake) generator "produces" into the regen temp dir.
    process.env.FAKE_JHIPSTER_WRITE = JSON.stringify([
      ["src/App.java", "new contents"], // modified
      ["src/New.java", "brand new"], // added
    ]);

    const { client, close } = await createMcpPair(registerPreviewUpgrade);
    try {
      const res = (await client.callTool({
        name: "preview_upgrade",
        arguments: { workingDirectory: tmp.path },
      })) as { isError?: boolean; structuredContent?: PreviewOutput };

      assert.equal(res.isError ?? false, false);
      const sc = res.structuredContent!;
      assert.equal(sc.exported, true);
      assert.deepEqual(sc.added, ["src/New.java"]);
      assert.deepEqual(sc.removed, ["src/Removed.java"]);
      assert.deepEqual(sc.modified, ["src/App.java"]);
      assert.deepEqual(sc.summary, { added: 1, removed: 1, modified: 1 });
      // .yo-rc.json and the staged .jdl are ignored, .jhipster excluded.
      assert.ok(!sc.added.includes(".yo-rc.json"));
      assert.ok(!sc.modified.some((f) => f.endsWith(".jdl")));
    } finally {
      await close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });

  it("leaves the project untouched", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    await write(tmp.path, ".yo-rc.json", JSON.stringify({ "generator-jhipster": {} }));
    await write(tmp.path, "src/App.java", "v1");
    process.env.FAKE_JHIPSTER_WRITE = JSON.stringify([["src/App.java", "v2"]]);
    const { client, close } = await createMcpPair(registerPreviewUpgrade);
    try {
      await client.callTool({ name: "preview_upgrade", arguments: { workingDirectory: tmp.path } });
      const { readFile } = await import("node:fs/promises");
      assert.equal(await readFile(path.join(tmp.path, "src/App.java"), "utf8"), "v1", "project file unchanged");
    } finally {
      await close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });

  it("errors when the directory is not a JHipster project", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    const { client, close } = await createMcpPair(registerPreviewUpgrade);
    try {
      const res = await client.callTool({
        name: "preview_upgrade",
        arguments: { workingDirectory: tmp.path },
      });
      assert.equal((res as { isError?: boolean }).isError, true);
      assert.match(getText(res as never), /not a JHipster project/);
    } finally {
      await close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });
});
