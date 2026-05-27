import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { registerCreateAppFromJdl } from "../../src/tools/createAppFromJdl.js";
import { registerImportJdl } from "../../src/tools/importJdl.js";
import { createMcpPair, getText } from "../helpers/mcp.js";
import { installFakeJhipster } from "../helpers/fakeJhipster.js";
import { makeTempDir } from "../helpers/tmpdir.js";

const APP_JDL = `application { config { baseName shop, applicationType monolith, databaseType sql, authenticationType jwt, clientFramework angular } entities * }`;

describe("blueprint support (--blueprints)", () => {
  it("forwards blueprints to the generator on create_app_from_jdl", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    const { client, close } = await createMcpPair(registerCreateAppFromJdl);
    try {
      const res = await client.callTool({
        name: "create_app_from_jdl",
        arguments: { workingDirectory: tmp.path, jdl: APP_JDL, blueprints: ["kotlin", "ionic"] },
      });
      // The fake jhipster echoes its argv as JSON.
      assert.match(getText(res as never), /"--blueprints","kotlin,ionic"/);
    } finally {
      await close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });

  it("forwards blueprints on import_jdl too", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    const { client, close } = await createMcpPair(registerImportJdl);
    try {
      const res = await client.callTool({
        name: "import_jdl",
        arguments: { workingDirectory: tmp.path, jdl: "entity Foo {}", blueprints: ["kotlin"] },
      });
      assert.match(getText(res as never), /"--blueprints","kotlin"/);
    } finally {
      await close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });

  it("includes blueprints in a dry-run preview", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    const { client, close } = await createMcpPair(registerImportJdl);
    try {
      const res = await client.callTool({
        name: "import_jdl",
        arguments: { workingDirectory: tmp.path, jdl: "entity Foo {}", blueprints: ["kotlin"], dryRun: true },
      });
      const text = getText(res as never);
      assert.match(text, /Dry run/i);
      assert.match(text, /"--blueprints","kotlin"/);
    } finally {
      await close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });

  it("rejects an invalid blueprint name (no spawn)", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    const { client, close } = await createMcpPair(registerImportJdl);
    try {
      const res = await client.callTool({
        name: "import_jdl",
        arguments: { workingDirectory: tmp.path, jdl: "entity Foo {}", blueprints: ["evil; rm -rf /"] },
      });
      assert.equal((res as { isError?: boolean }).isError, true);
      assert.match(getText(res as never), /Invalid blueprint name/);
    } finally {
      await close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });
});
