import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { registerRunJhipster } from "../../src/tools/runJhipster.js";
import { createMcpPair, getText } from "../helpers/mcp.js";
import { installFakeJhipster } from "../helpers/fakeJhipster.js";
import { makeTempDir } from "../helpers/tmpdir.js";

describe("run_jhipster tool", () => {
  it("rejects a subcommand outside the allowlist", async () => {
    const tmp = await makeTempDir();
    const { client, close } = await createMcpPair(registerRunJhipster);
    try {
      const res = (await client.callTool({
        name: "run_jhipster",
        arguments: {
          workingDirectory: tmp.path,
          subcommand: "rm-rf",
          args: [],
        },
      })) as { isError?: boolean; content: Array<{ type: string; text?: string }> };
      assert.equal(res.isError, true);
      assert.match(getText(res), /not allowlisted/);
    } finally {
      await close();
      await tmp.cleanup();
    }
  });

  it("rejects args containing shell metacharacters", async () => {
    const tmp = await makeTempDir();
    const { client, close } = await createMcpPair(registerRunJhipster);
    try {
      const res = (await client.callTool({
        name: "run_jhipster",
        arguments: {
          workingDirectory: tmp.path,
          subcommand: "info",
          args: ["safe", "bad;rm -rf /"],
        },
      })) as { isError?: boolean; content: Array<{ type: string; text?: string }> };
      assert.equal(res.isError, true);
      assert.match(getText(res), /disallowed characters/);
    } finally {
      await close();
      await tmp.cleanup();
    }
  });

  it("auto-appends --force when missing", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    const { client, close } = await createMcpPair(registerRunJhipster);
    try {
      const res = await client.callTool({
        name: "run_jhipster",
        arguments: {
          workingDirectory: tmp.path,
          subcommand: "info",
          args: [],
        },
      });
      const text = getText(res as never);
      assert.match(text, /"args":\["info","--force"\]/);
    } finally {
      await close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });

  it("does not duplicate --force when already supplied", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    const { client, close } = await createMcpPair(registerRunJhipster);
    try {
      const res = await client.callTool({
        name: "run_jhipster",
        arguments: {
          workingDirectory: tmp.path,
          subcommand: "info",
          args: ["--force"],
        },
      });
      const text = getText(res as never);
      // The fake jhipster echoes args as JSON — verify the args array has
      // exactly one "--force" token (not two).
      const argsJson = text.match(/"args":(\[[^\]]+\])/);
      assert.ok(argsJson, `expected args JSON in output, got: ${text}`);
      const parsed = JSON.parse(argsJson![1]!) as string[];
      assert.deepEqual(parsed, ["info", "--force"]);
    } finally {
      await close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });
});
