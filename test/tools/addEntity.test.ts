import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { registerAddEntity } from "../../src/tools/addEntity.js";
import { createMcpPair, getText } from "../helpers/mcp.js";
import { installFakeJhipster } from "../helpers/fakeJhipster.js";
import { makeTempDir } from "../helpers/tmpdir.js";

describe("add_entity tool", () => {
  it("writes a JDL snippet and applies it", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    const { client, close } = await createMcpPair(registerAddEntity);
    try {
      const res = await client.callTool({
        name: "add_entity",
        arguments: {
          workingDirectory: tmp.path,
          name: "Product",
          fields: [
            { name: "name", type: "String", validations: ["required"] },
            { name: "price", type: "BigDecimal", validations: ["min(0)"] },
          ],
          options: { paginate: "pagination" },
        },
      });
      const text = getText(res as never);
      assert.match(text, /entity Product \{/);
      assert.match(text, /name String required/);
      assert.match(text, /price BigDecimal min\(0\)/);
      assert.match(text, /paginate Product with pagination/);
      assert.match(text, /"args":\["jdl","entity-Product\.jdl","--force","--skip-git"\]/);

      const written = await readFile(path.join(tmp.path, "entity-Product.jdl"), "utf8");
      assert.match(written, /^entity Product \{/);
    } finally {
      await close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });

  it("surfaces validation errors from the JDL builder", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    const { client, close } = await createMcpPair(registerAddEntity);
    try {
      // calling with a lowercase entity name should surface a tool error,
      // not crash the server. The MCP server catches handler throws and
      // returns them as an isError result.
      const res = (await client.callTool({
        name: "add_entity",
        arguments: {
          workingDirectory: tmp.path,
          name: "product",
          fields: [],
        },
      })) as { isError?: boolean; content: Array<{ type: string; text?: string }> };
      assert.equal(res.isError, true);
      assert.match(getText(res), /Invalid entity name/);
    } finally {
      await close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });
});
