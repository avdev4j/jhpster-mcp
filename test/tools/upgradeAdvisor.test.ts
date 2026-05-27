import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { registerUpgradeAdvisor } from "../../src/tools/upgradeAdvisor.js";
import { createMcpPair, getText } from "../helpers/mcp.js";
import { makeTempDir } from "../helpers/tmpdir.js";

interface AdvisorOutput {
  currentVersion: string | null;
  targetVersion: string | null;
  bump: string;
  riskLevel: string;
  applicationType: string;
  blueprints: string[];
  entityCount: number;
  considerations: string[];
  steps: string[];
  references: string[];
}

async function writeYoRc(dir: string, cfg: Record<string, unknown>): Promise<void> {
  await writeFile(path.join(dir, ".yo-rc.json"), JSON.stringify({ "generator-jhipster": cfg }), "utf8");
}

describe("upgrade_advisor tool", () => {
  it("reports current version, bump, entity count and a checklist", async () => {
    const tmp = await makeTempDir();
    const { client, close } = await createMcpPair(registerUpgradeAdvisor);
    try {
      await writeYoRc(tmp.path, { jhipsterVersion: "8.6.0", applicationType: "monolith" });
      await mkdir(path.join(tmp.path, ".jhipster"));
      await writeFile(path.join(tmp.path, ".jhipster", "A.json"), "{}", "utf8");
      await writeFile(path.join(tmp.path, ".jhipster", "B.json"), "{}", "utf8");

      const res = (await client.callTool({
        name: "upgrade_advisor",
        arguments: { workingDirectory: tmp.path, targetVersion: "8.7.4" },
      })) as { isError?: boolean; structuredContent?: AdvisorOutput };

      assert.equal(res.isError ?? false, false);
      const sc = res.structuredContent!;
      assert.equal(sc.currentVersion, "8.6.0");
      assert.equal(sc.targetVersion, "8.7.4");
      assert.equal(sc.bump, "minor");
      assert.equal(sc.entityCount, 2);
      assert.ok(sc.steps.length >= 4);
      assert.ok(sc.references.length >= 1);
    } finally {
      await close();
      await tmp.cleanup();
    }
  });

  it("flags blueprints and raises risk to high on a major bump", async () => {
    const tmp = await makeTempDir();
    const { client, close } = await createMcpPair(registerUpgradeAdvisor);
    try {
      await writeYoRc(tmp.path, {
        jhipsterVersion: "7.9.4",
        applicationType: "monolith",
        blueprints: [{ name: "generator-jhipster-kotlin", version: "2.0.0" }],
      });
      const res = (await client.callTool({
        name: "upgrade_advisor",
        arguments: { workingDirectory: tmp.path, targetVersion: "8.0.0" },
      })) as { structuredContent?: AdvisorOutput };
      const sc = res.structuredContent!;
      assert.equal(sc.bump, "major");
      assert.deepEqual(sc.blueprints, ["generator-jhipster-kotlin"]);
      assert.equal(sc.riskLevel, "high");
      assert.ok(sc.considerations.some((c) => /blueprint/i.test(c)));
    } finally {
      await close();
      await tmp.cleanup();
    }
  });

  it("works without a target (bump unknown) and still gives guidance", async () => {
    const tmp = await makeTempDir();
    const { client, close } = await createMcpPair(registerUpgradeAdvisor);
    try {
      await writeYoRc(tmp.path, { jhipsterVersion: "8.7.4", applicationType: "monolith" });
      const res = (await client.callTool({
        name: "upgrade_advisor",
        arguments: { workingDirectory: tmp.path },
      })) as { structuredContent?: AdvisorOutput };
      const sc = res.structuredContent!;
      assert.equal(sc.targetVersion, null);
      assert.equal(sc.bump, "unknown");
      assert.ok(sc.steps.length >= 4);
    } finally {
      await close();
      await tmp.cleanup();
    }
  });

  it("errors when the directory is not a JHipster project", async () => {
    const tmp = await makeTempDir();
    const { client, close } = await createMcpPair(registerUpgradeAdvisor);
    try {
      const res = await client.callTool({
        name: "upgrade_advisor",
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
