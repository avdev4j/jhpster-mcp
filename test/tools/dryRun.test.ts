import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { registerImportJdl } from "../../src/tools/importJdl.js";
import { registerAddEntity } from "../../src/tools/addEntity.js";
import { createMcpPair, getText } from "../helpers/mcp.js";
import { installFakeJhipster } from "../helpers/fakeJhipster.js";
import { makeTempDir } from "../helpers/tmpdir.js";

describe("dryRun flag", () => {
  it("import_jdl dryRun runs in an isolated dir and writes nothing into the project", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    const { client, close } = await createMcpPair(registerImportJdl);
    try {
      const res = await client.callTool({
        name: "import_jdl",
        arguments: {
          workingDirectory: tmp.path,
          jdl: "entity Foo { bar String }",
          dryRun: true,
        },
      });
      const text = getText(res as never);
      assert.match(text, /Dry run/i);
      // generation runs in a throwaway preview dir, not the project; uses --skip-install
      assert.match(text, /"--skip-install"/);
      assert.match(text, /jhipster-mcp-preview-/, "should run in an isolated preview temp dir");
      assert.doesNotMatch(text, new RegExp(`"cwd":"[^"]*${tmp.path}"`));
      const remaining = await readdir(tmp.path);
      assert.equal(remaining.length, 0, `expected empty project dir, found: ${remaining.join(", ")}`);
    } finally {
      await close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });

  it("import_jdl without dryRun persists the JDL file into the project", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    const { client, close } = await createMcpPair(registerImportJdl);
    try {
      await client.callTool({
        name: "import_jdl",
        arguments: {
          workingDirectory: tmp.path,
          jdl: "entity Foo { bar String }",
          jdlFilename: "changes.jdl",
        },
      });
      const remaining = await readdir(tmp.path);
      assert.ok(remaining.includes("changes.jdl"), `expected changes.jdl, found: ${remaining.join(", ")}`);
    } finally {
      await close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });

  it("add_entity dryRun previews without writing the entity JDL file", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    const { client, close } = await createMcpPair(registerAddEntity);
    try {
      const res = await client.callTool({
        name: "add_entity",
        arguments: {
          workingDirectory: tmp.path,
          name: "Product",
          fields: [{ name: "name", type: "String" }],
          dryRun: true,
        },
      });
      const text = getText(res as never);
      assert.match(text, /Dry run/i);
      assert.match(text, /Validated JDL/);
      assert.match(text, /jhipster-mcp-preview-/, "should run in an isolated preview temp dir");
      const remaining = await readdir(tmp.path);
      assert.equal(remaining.length, 0, `expected empty dir, found: ${remaining.join(", ")}`);
    } finally {
      await close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });
});
