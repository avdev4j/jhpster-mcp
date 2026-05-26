import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { StructuredRunResult } from "../../src/result.js";
import { registerImportJdl } from "../../src/tools/importJdl.js";
import { createMcpPair } from "../helpers/mcp.js";
import { installFakeJhipster } from "../helpers/fakeJhipster.js";
import { makeTempDir } from "../helpers/tmpdir.js";

describe("structured output (end-to-end via MCP)", () => {
  it("returns structuredContent with entities, filesChanged and warnings", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    process.env.FAKE_JHIPSTER_FILELINES = "   create src/Foo.java|   force package.json";
    process.env.FAKE_JHIPSTER_STDERR = "WARNING! using defaults\n";
    const { client, close } = await createMcpPair(registerImportJdl);
    try {
      const res = (await client.callTool({
        name: "import_jdl",
        arguments: {
          workingDirectory: tmp.path,
          jdl: "entity Foo { bar String }\nentity Baz {}",
        },
      })) as { isError?: boolean; structuredContent?: StructuredRunResult };

      assert.equal(res.isError ?? false, false);
      const sc = res.structuredContent;
      assert.ok(sc, "expected structuredContent");
      assert.equal(sc!.success, true);
      assert.equal(sc!.dryRun, false);
      assert.deepEqual(sc!.entities, ["Foo", "Baz"]);
      assert.deepEqual(sc!.filesChanged, [
        { action: "create", path: "src/Foo.java" },
        { action: "force", path: "package.json" },
      ]);
      assert.deepEqual(sc!.warnings, ["WARNING! using defaults"]);
    } finally {
      delete process.env.FAKE_JHIPSTER_FILELINES;
      delete process.env.FAKE_JHIPSTER_STDERR;
      await close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });

  it("reflects dryRun=true in structuredContent", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    const { client, close } = await createMcpPair(registerImportJdl);
    try {
      const res = (await client.callTool({
        name: "import_jdl",
        arguments: {
          workingDirectory: tmp.path,
          jdl: "entity Foo {}",
          dryRun: true,
        },
      })) as { structuredContent?: StructuredRunResult };
      assert.equal(res.structuredContent!.dryRun, true);
    } finally {
      await close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });
});
