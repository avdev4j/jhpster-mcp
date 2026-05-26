import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { registerCreateAppFromJdl } from "../../src/tools/createAppFromJdl.js";
import { createMcpPair } from "../helpers/mcp.js";
import { installFakeJhipster } from "../helpers/fakeJhipster.js";
import { makeTempDir } from "../helpers/tmpdir.js";

interface Progress {
  progress: number;
  total?: number;
  message?: string;
}

describe("progress streaming (end-to-end via MCP)", () => {
  it("forwards generator output as progress notifications when a token is requested", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    process.env.FAKE_JHIPSTER_LINES = "3";
    const { client, close } = await createMcpPair(registerCreateAppFromJdl);
    try {
      const progressNotes: Progress[] = [];
      const res = await client.callTool(
        {
          name: "create_app_from_jdl",
          arguments: {
            workingDirectory: tmp.path,
            jdl: "application { config { baseName demo } }",
          },
        },
        undefined,
        { onprogress: (p: Progress) => progressNotes.push(p) },
      );

      assert.equal((res as { isError?: boolean }).isError ?? false, false);
      // 3 "step N" lines + 1 "[fake-jhipster] ..." line = at least 4 notes
      assert.ok(
        progressNotes.length >= 4,
        `expected >= 4 progress notes, got ${progressNotes.length}`,
      );
      assert.ok(progressNotes.some((p) => p.message === "step 1"));
      assert.ok(progressNotes.some((p) => p.message?.startsWith("[fake-jhipster]")));
      // progress counter increases
      assert.deepEqual(
        progressNotes.map((p) => p.progress),
        progressNotes.map((_, i) => i + 1),
      );
    } finally {
      delete process.env.FAKE_JHIPSTER_LINES;
      await close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });

  it("works fine (no streaming) when the client does not request progress", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    process.env.FAKE_JHIPSTER_LINES = "2";
    const { client, close } = await createMcpPair(registerCreateAppFromJdl);
    try {
      const res = (await client.callTool({
        name: "create_app_from_jdl",
        arguments: {
          workingDirectory: tmp.path,
          jdl: "application { config { baseName demo } }",
        },
      })) as { isError?: boolean };
      assert.equal(res.isError ?? false, false);
    } finally {
      delete process.env.FAKE_JHIPSTER_LINES;
      await close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });
});
