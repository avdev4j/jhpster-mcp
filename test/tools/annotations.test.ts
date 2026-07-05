import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { McpServer } from "@modelcontextprotocol/server";
import { createMcpPair } from "../helpers/mcp.js";

import { registerValidateJdl } from "../../src/tools/validateJdl.js";
import { registerCreateAppFromJdl } from "../../src/tools/createAppFromJdl.js";
import { registerImportJdl } from "../../src/tools/importJdl.js";
import { registerAddEntity } from "../../src/tools/addEntity.js";
import { registerAddRelationship } from "../../src/tools/addRelationship.js";
import { registerSetOption } from "../../src/tools/setOption.js";
import { registerInfo } from "../../src/tools/info.js";
import { registerGenerateCiCd } from "../../src/tools/generateCiCd.js";
import { registerRunJhipster } from "../../src/tools/runJhipster.js";

function registerAll(server: McpServer): void {
  registerValidateJdl(server);
  registerCreateAppFromJdl(server);
  registerImportJdl(server);
  registerAddEntity(server);
  registerAddRelationship(server);
  registerSetOption(server);
  registerInfo(server);
  registerGenerateCiCd(server);
  registerRunJhipster(server);
}

// Expected hints per tool. `undefined` means the annotation is intentionally absent.
const EXPECTED: Record<
  string,
  {
    readOnlyHint: boolean;
    destructiveHint?: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
  }
> = {
  info: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  validate_jdl: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  create_app_from_jdl: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
  },
  import_jdl: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  add_entity: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  add_relationship: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  set_option: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  generate_ci_cd: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  run_jhipster: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: true,
  },
};

describe("tool annotations", () => {
  it("exposes the expected behavioral hints on every tool", async () => {
    const { client, close } = await createMcpPair(registerAll);
    try {
      const { tools } = await client.listTools();
      const byName = new Map(tools.map((t) => [t.name, t]));

      for (const [name, expected] of Object.entries(EXPECTED)) {
        const tool = byName.get(name);
        assert.ok(tool, `tool ${name} should be registered`);
        const ann = tool.annotations ?? {};
        assert.equal(ann.readOnlyHint, expected.readOnlyHint, `${name}.readOnlyHint`);
        assert.equal(ann.idempotentHint, expected.idempotentHint, `${name}.idempotentHint`);
        assert.equal(ann.openWorldHint, expected.openWorldHint, `${name}.openWorldHint`);
        assert.equal(ann.destructiveHint, expected.destructiveHint, `${name}.destructiveHint`);
      }
    } finally {
      await close();
    }
  });

  it("never marks a tool both read-only and destructive", async () => {
    const { client, close } = await createMcpPair(registerAll);
    try {
      const { tools } = await client.listTools();
      for (const t of tools) {
        const ann = t.annotations ?? {};
        if (ann.readOnlyHint) {
          assert.notEqual(ann.destructiveHint, true, `${t.name} is read-only but flagged destructive`);
        }
      }
    } finally {
      await close();
    }
  });
});
