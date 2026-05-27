import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { registerProjectCommands } from "../../src/tools/projectCommands.js";
import { createMcpPair, getText } from "../helpers/mcp.js";
import { makeTempDir } from "../helpers/tmpdir.js";

interface CommandsOutput {
  buildTool: string;
  clientFramework: string;
  commands: Array<{ category: string; command: string; description: string }>;
  notes: string[];
}

async function writeYoRc(dir: string, cfg: Record<string, unknown>): Promise<void> {
  await writeFile(path.join(dir, ".yo-rc.json"), JSON.stringify({ "generator-jhipster": cfg }), "utf8");
}

describe("project_commands tool", () => {
  it("reports maven + angular commands using the wrapper and real npm scripts", async () => {
    const tmp = await makeTempDir();
    const { client, close } = await createMcpPair(registerProjectCommands);
    try {
      await writeYoRc(tmp.path, { buildTool: "maven", clientFramework: "angular" });
      await writeFile(path.join(tmp.path, "mvnw"), "#!/bin/sh\n", "utf8");
      await writeFile(
        path.join(tmp.path, "package.json"),
        JSON.stringify({ scripts: { start: "ng serve", test: "jest", "java:docker": "..." } }),
        "utf8",
      );

      const res = (await client.callTool({
        name: "project_commands",
        arguments: { workingDirectory: tmp.path },
      })) as { isError?: boolean; structuredContent?: CommandsOutput };

      assert.equal(res.isError ?? false, false);
      const sc = res.structuredContent!;
      assert.equal(sc.buildTool, "maven");
      assert.equal(sc.clientFramework, "angular");
      const cmds = sc.commands.map((c) => c.command);
      assert.ok(cmds.includes("./mvnw"), "uses the maven wrapper");
      assert.ok(cmds.includes("./mvnw -Pprod clean verify"));
      assert.ok(cmds.includes("npm start"));
      assert.ok(cmds.includes("npm run test"));
      assert.ok(cmds.includes("npm run java:docker"));
      // e2e script absent → not reported
      assert.ok(!cmds.includes("npm run e2e"));
      assert.ok(sc.notes.some((n) => /never runs builds/i.test(n)));
    } finally {
      await close();
      await tmp.cleanup();
    }
  });

  it("reports gradle (no wrapper) and omits client commands for an API-only app", async () => {
    const tmp = await makeTempDir();
    const { client, close } = await createMcpPair(registerProjectCommands);
    try {
      await writeYoRc(tmp.path, { buildTool: "gradle", clientFramework: "no" });
      const res = (await client.callTool({
        name: "project_commands",
        arguments: { workingDirectory: tmp.path },
      })) as { structuredContent?: CommandsOutput };
      const sc = res.structuredContent!;
      const cmds = sc.commands.map((c) => c.command);
      assert.ok(cmds.includes("gradle"), "no wrapper file ⇒ bare gradle");
      assert.ok(cmds.includes("gradle -Pprod clean bootJar"));
      assert.ok(!cmds.some((c) => c.startsWith("npm")), "no client ⇒ no npm commands");
    } finally {
      await close();
      await tmp.cleanup();
    }
  });

  it("falls back to detecting the build tool from pom.xml when buildTool is absent", async () => {
    const tmp = await makeTempDir();
    const { client, close } = await createMcpPair(registerProjectCommands);
    try {
      await writeYoRc(tmp.path, { clientFramework: "no" });
      await writeFile(path.join(tmp.path, "pom.xml"), "<project/>", "utf8");
      const res = (await client.callTool({
        name: "project_commands",
        arguments: { workingDirectory: tmp.path },
      })) as { structuredContent?: CommandsOutput };
      assert.equal(res.structuredContent!.buildTool, "maven");
    } finally {
      await close();
      await tmp.cleanup();
    }
  });

  it("errors when the directory is not a JHipster project", async () => {
    const tmp = await makeTempDir();
    const { client, close } = await createMcpPair(registerProjectCommands);
    try {
      const res = await client.callTool({
        name: "project_commands",
        arguments: { workingDirectory: tmp.path },
      });
      assert.equal((res as { isError?: boolean }).isError, true);
      assert.match(getText(res as never), /not a JHipster project/);
    } finally {
      await close();
      await tmp.cleanup();
    }
  });
});
