import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { registerProjectState } from "../../src/resources/projectState.js";
import { createMcpPair } from "../helpers/mcp.js";

function firstText(result: { contents: Array<Record<string, unknown>> }): string {
  const c = result.contents[0]!;
  assert.ok("text" in c && typeof c.text === "string", "expected text content");
  return c.text as string;
}

async function makeProject(): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(path.join(tmpdir(), "jhipster-mcp-resource-"));
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

function uri(name: "yo-rc" | "entities" | "jdl", dir: string): string {
  return `jhipster://project/${name}?dir=${encodeURIComponent(dir)}`;
}

describe("project-state resources", () => {
  it("lists the three resource templates", async () => {
    const { client, close } = await createMcpPair(registerProjectState);
    try {
      const list = await client.listResourceTemplates();
      const templates = list.resourceTemplates.map((r) => r.uriTemplate);
      assert.ok(templates.includes("jhipster://project/yo-rc{?dir}"));
      assert.ok(templates.includes("jhipster://project/entities{?dir}"));
      assert.ok(templates.includes("jhipster://project/jdl{?dir}"));
    } finally {
      await close();
    }
  });

  it("returns .yo-rc.json content for a project", async () => {
    const { dir, cleanup } = await makeProject();
    const { client, close } = await createMcpPair(registerProjectState);
    try {
      const config = { "generator-jhipster": { baseName: "myApp", applicationType: "monolith" } };
      await writeFile(path.join(dir, ".yo-rc.json"), JSON.stringify(config), "utf8");
      const result = await client.readResource({ uri: uri("yo-rc", dir) });
      const c = result.contents[0]!;
      assert.equal(c.mimeType, "application/json");
      assert.deepEqual(JSON.parse(firstText(result)), config);
    } finally {
      await close();
      await cleanup();
    }
  });

  it("explains when .yo-rc.json is missing", async () => {
    const { dir, cleanup } = await makeProject();
    const { client, close } = await createMcpPair(registerProjectState);
    try {
      const result = await client.readResource({ uri: uri("yo-rc", dir) });
      assert.match(firstText(result), /not a JHipster project/i);
    } finally {
      await close();
      await cleanup();
    }
  });

  it("aggregates .jhipster entity configs keyed by name", async () => {
    const { dir, cleanup } = await makeProject();
    const { client, close } = await createMcpPair(registerProjectState);
    try {
      await mkdir(path.join(dir, ".jhipster"));
      await writeFile(
        path.join(dir, ".jhipster", "Customer.json"),
        JSON.stringify({ name: "Customer", fields: [{ fieldName: "email" }] }),
        "utf8",
      );
      await writeFile(
        path.join(dir, ".jhipster", "Order.json"),
        JSON.stringify({ name: "Order", fields: [] }),
        "utf8",
      );
      const result = await client.readResource({ uri: uri("entities", dir) });
      const parsed = JSON.parse(firstText(result)) as { entities: Record<string, unknown> };
      assert.deepEqual(Object.keys(parsed.entities).sort(), ["Customer", "Order"]);
      assert.deepEqual((parsed.entities.Customer as { fields: unknown[] }).fields, [
        { fieldName: "email" },
      ]);
    } finally {
      await close();
      await cleanup();
    }
  });

  it("returns an empty entity map when .jhipster is absent", async () => {
    const { dir, cleanup } = await makeProject();
    const { client, close } = await createMcpPair(registerProjectState);
    try {
      const result = await client.readResource({ uri: uri("entities", dir) });
      const parsed = JSON.parse(firstText(result)) as { entities: Record<string, unknown> };
      assert.deepEqual(parsed.entities, {});
    } finally {
      await close();
      await cleanup();
    }
  });

  it("reports nothing to export when not a JHipster project (no spawn)", async () => {
    const { dir, cleanup } = await makeProject();
    const { client, close } = await createMcpPair(registerProjectState);
    try {
      const result = await client.readResource({ uri: uri("jdl", dir) });
      assert.match(firstText(result), /nothing to export/i);
    } finally {
      await close();
      await cleanup();
    }
  });

  it("rejects a relative dir parameter", async () => {
    const { client, close } = await createMcpPair(registerProjectState);
    try {
      await assert.rejects(
        client.readResource({ uri: uri("yo-rc", "relative/path") }),
        /must be an absolute path/i,
      );
    } finally {
      await close();
    }
  });

  it("rejects a read with no dir parameter (no template match)", async () => {
    const { client, close } = await createMcpPair(registerProjectState);
    try {
      await assert.rejects(
        client.readResource({ uri: "jhipster://project/yo-rc" }),
        /not found/i,
      );
    } finally {
      await close();
    }
  });
});
