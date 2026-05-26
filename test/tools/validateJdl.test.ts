import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { registerValidateJdl } from "../../src/tools/validateJdl.js";
import { createMcpPair, getText } from "../helpers/mcp.js";
import { installFakeJhipster } from "../helpers/fakeJhipster.js";
import { makeTempDir } from "../helpers/tmpdir.js";

describe("validate_jdl tool", () => {
  it("fails fast on structurally invalid JDL without spawning jhipster", async () => {
    // No fake jhipster installed on PATH — if the tool tried to spawn it would
    // error differently. The local lint must catch this first.
    const { client, close } = await createMcpPair(registerValidateJdl);
    try {
      const res = (await client.callTool({
        name: "validate_jdl",
        arguments: { jdl: "entity Broken {" },
      })) as { isError?: boolean; content: Array<{ type: string; text?: string }> };
      assert.equal(res.isError, true);
      assert.match(getText(res), /Invalid JDL/);
      assert.match(getText(res), /unclosed/);
    } finally {
      await close();
    }
  });

  it("validates in an isolated temp dir and reports success", async () => {
    const fake = await installFakeJhipster();
    const { client, close } = await createMcpPair(registerValidateJdl);
    try {
      const res = await client.callTool({
        name: "validate_jdl",
        arguments: { jdl: "application { config { baseName demo } }" },
      });
      const text = getText(res as never);
      assert.equal((res as { isError?: boolean }).isError ?? false, false);
      assert.match(text, /JDL is valid/);
      assert.match(text, /--skip-install/);
      assert.match(text, /jhipster-mcp-preview-/, "should run in an isolated preview temp dir");
    } finally {
      await close();
      fake.restorePath();
      await fake.cleanup();
    }
  });

  it("reports failure and surfaces output when jhipster exits non-zero", async () => {
    const fake = await installFakeJhipster();
    process.env.FAKE_JHIPSTER_EXIT = "1";
    process.env.FAKE_JHIPSTER_STDERR = "JDL parse error near 'foo'\n";
    const { client, close } = await createMcpPair(registerValidateJdl);
    try {
      const res = (await client.callTool({
        name: "validate_jdl",
        arguments: { jdl: "application { config { baseName demo } }" },
      })) as { isError?: boolean; content: Array<{ type: string; text?: string }> };
      assert.equal(res.isError, true);
      assert.match(getText(res), /validation failed/);
      assert.match(getText(res), /JDL parse error/);
    } finally {
      delete process.env.FAKE_JHIPSTER_EXIT;
      delete process.env.FAKE_JHIPSTER_STDERR;
      await close();
      fake.restorePath();
      await fake.cleanup();
    }
  });

  it("validates against a provided workingDirectory and leaves no JDL file behind", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    const { client, close } = await createMcpPair(registerValidateJdl);
    try {
      const res = await client.callTool({
        name: "validate_jdl",
        arguments: {
          jdl: "entity Product { name String }",
          workingDirectory: tmp.path,
        },
      });
      assert.equal((res as { isError?: boolean }).isError ?? false, false);
      // the throwaway __validate__.jdl must be cleaned up
      const remaining = await readdir(tmp.path);
      assert.ok(
        !remaining.includes("__validate__.jdl"),
        `expected no leftover JDL, found: ${remaining.join(", ")}`,
      );
    } finally {
      await close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });

  it("errors when the provided workingDirectory does not exist", async () => {
    const { client, close } = await createMcpPair(registerValidateJdl);
    try {
      const res = (await client.callTool({
        name: "validate_jdl",
        arguments: {
          jdl: "entity Product { name String }",
          workingDirectory: "/no/such/dir/xyz123",
        },
      })) as { isError?: boolean; content: Array<{ type: string; text?: string }> };
      assert.equal(res.isError, true);
      assert.match(getText(res), /does not exist/);
    } finally {
      await close();
    }
  });
});
