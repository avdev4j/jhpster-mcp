import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { registerCreateAppFromJdl } from "../../src/tools/createAppFromJdl.js";
import { createMcpPair, getText } from "../helpers/mcp.js";
import { installFakeJhipster } from "../helpers/fakeJhipster.js";
import { makeTempDir } from "../helpers/tmpdir.js";

describe("create_app_from_jdl tool", () => {
  it("writes the JDL into an empty dir and invokes jhipster jdl", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    const { client, close } = await createMcpPair(registerCreateAppFromJdl);
    try {
      const res = await client.callTool({
        name: "create_app_from_jdl",
        arguments: {
          workingDirectory: tmp.path,
          jdl: "application { config { baseName demo } }",
          jdlFilename: "app.jdl",
        },
      });
      const text = getText(res as never);
      assert.equal((res as { isError?: boolean }).isError ?? false, false);
      assert.match(text, /\[fake-jhipster\]/);
      assert.match(text, /"args":\["jdl","app\.jdl","--force","--skip-git"\]/);

      const written = await readFile(path.join(tmp.path, "app.jdl"), "utf8");
      assert.equal(written, "application { config { baseName demo } }");
    } finally {
      await close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });

  it("refuses to scaffold into a non-empty directory", async () => {
    const tmp = await makeTempDir();
    await writeFile(path.join(tmp.path, "existing.txt"), "hi");
    const fake = await installFakeJhipster();
    const { client, close } = await createMcpPair(registerCreateAppFromJdl);
    try {
      const res = (await client.callTool({
        name: "create_app_from_jdl",
        arguments: {
          workingDirectory: tmp.path,
          jdl: "application { config { baseName demo } }",
        },
      })) as { isError?: boolean; content: Array<{ type: string; text?: string }> };
      assert.equal(res.isError, true);
      assert.match(getText(res), /not empty/i);
      assert.match(getText(res), /existing\.txt/);
    } finally {
      await close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });

  it("forwards extra args after the standard flags", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    const { client, close } = await createMcpPair(registerCreateAppFromJdl);
    try {
      const res = await client.callTool({
        name: "create_app_from_jdl",
        arguments: {
          workingDirectory: tmp.path,
          jdl: "application { config { baseName demo } }",
          extraArgs: ["--skip-install"],
        },
      });
      const text = getText(res as never);
      assert.match(
        text,
        /"args":\["jdl","app\.jdl","--force","--skip-git","--skip-install"\]/,
      );
    } finally {
      await close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });
});
