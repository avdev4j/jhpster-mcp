import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { resetConfigForTest } from "../../src/config.js";
import { registerImportJdl } from "../../src/tools/importJdl.js";
import { registerInfo } from "../../src/tools/info.js";
import { createMcpPair, getText } from "../helpers/mcp.js";
import { installFakeJhipster } from "../helpers/fakeJhipster.js";
import { makeTempDir } from "../helpers/tmpdir.js";

function registerAll(server: import("@modelcontextprotocol/server").McpServer): void {
  registerImportJdl(server);
  registerInfo(server);
}

afterEach(() => {
  delete process.env.JHIPSTER_MCP_ROOT;
  delete process.env.JHIPSTER_MCP_DEFAULT_ARGS;
  resetConfigForTest();
});

describe("sandbox root (JHIPSTER_MCP_ROOT)", () => {
  it("rejects a workingDirectory outside the configured root", async () => {
    const root = await makeTempDir();
    const outside = await makeTempDir();
    const fake = await installFakeJhipster();
    process.env.JHIPSTER_MCP_ROOT = root.path;
    resetConfigForTest();
    const { client, close } = await createMcpPair(registerAll);
    try {
      const res = await client.callTool({
        name: "import_jdl",
        arguments: { workingDirectory: outside.path, jdl: "entity Foo {}" },
      });
      assert.equal((res as { isError?: boolean }).isError, true);
      assert.match(getText(res as never), /outside the configured sandbox root/);
      // Nothing was written into the out-of-root directory.
      assert.equal((await readdir(outside.path)).length, 0);
    } finally {
      await close();
      fake.restorePath();
      await fake.cleanup();
      await root.cleanup();
      await outside.cleanup();
    }
  });

  it("allows a workingDirectory inside the root", async () => {
    const root = await makeTempDir();
    const fake = await installFakeJhipster();
    process.env.JHIPSTER_MCP_ROOT = root.path;
    resetConfigForTest();
    const { client, close } = await createMcpPair(registerAll);
    try {
      const res = (await client.callTool({
        name: "import_jdl",
        // an existing dir inside the root (the root itself qualifies)
        arguments: { workingDirectory: root.path, jdl: "entity Foo {}" },
      })) as { isError?: boolean };
      assert.equal(res.isError ?? false, false);
    } finally {
      await close();
      fake.restorePath();
      await fake.cleanup();
      await root.cleanup();
    }
  });

  it("blocks the read-only info tool outside the root too", async () => {
    const root = await makeTempDir();
    const outside = await makeTempDir();
    const fake = await installFakeJhipster();
    process.env.JHIPSTER_MCP_ROOT = root.path;
    resetConfigForTest();
    const { client, close } = await createMcpPair(registerAll);
    try {
      const res = await client.callTool({
        name: "info",
        arguments: { workingDirectory: outside.path },
      });
      assert.equal((res as { isError?: boolean }).isError, true);
      assert.match(getText(res as never), /outside the configured sandbox root/);
    } finally {
      await close();
      fake.restorePath();
      await fake.cleanup();
      await root.cleanup();
      await outside.cleanup();
    }
  });
});

describe("default args (JHIPSTER_MCP_DEFAULT_ARGS)", () => {
  it("appends configured flags to the generator invocation", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    process.env.JHIPSTER_MCP_DEFAULT_ARGS = "--no-insight";
    resetConfigForTest();
    const { client, close } = await createMcpPair(registerAll);
    try {
      const res = await client.callTool({
        name: "import_jdl",
        arguments: { workingDirectory: tmp.path, jdl: "entity Foo {}" },
      });
      // The fake jhipster echoes its argv; the default flag must be present.
      assert.match(getText(res as never), /--no-insight/);
    } finally {
      await close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });
});
