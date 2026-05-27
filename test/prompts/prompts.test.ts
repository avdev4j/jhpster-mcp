import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpPair } from "../helpers/mcp.js";
import { registerScaffoldCrudMonolith } from "../../src/prompts/scaffoldCrudMonolith.js";
import { registerAddAuditFields } from "../../src/prompts/addAuditFields.js";
import { registerMonolithToMicroservices } from "../../src/prompts/monolithToMicroservices.js";

function registerAll(server: McpServer): void {
  registerScaffoldCrudMonolith(server);
  registerAddAuditFields(server);
  registerMonolithToMicroservices(server);
}

function promptText(result: { messages: Array<{ content: Record<string, unknown> }> }): string {
  return result.messages
    .map((m) => ("text" in m.content && typeof m.content.text === "string" ? m.content.text : ""))
    .join("\n");
}

describe("MCP prompts", () => {
  it("lists the three prompts with arguments", async () => {
    const { client, close } = await createMcpPair(registerAll);
    try {
      const { prompts } = await client.listPrompts();
      const names = prompts.map((p) => p.name).sort();
      assert.deepEqual(names, ["add_audit_fields", "monolith_to_microservices", "scaffold_crud_monolith"]);
      const scaffold = prompts.find((p) => p.name === "scaffold_crud_monolith")!;
      const argNames = (scaffold.arguments ?? []).map((a) => a.name);
      assert.ok(argNames.includes("baseName"));
      assert.ok(argNames.includes("entities"));
    } finally {
      await close();
    }
  });

  it("renders scaffold_crud_monolith with the chosen config and CRUD options", async () => {
    const { client, close } = await createMcpPair(registerAll);
    try {
      const result = await client.getPrompt({
        name: "scaffold_crud_monolith",
        arguments: {
          workingDirectory: "/tmp/shop",
          baseName: "shop",
          entities: "Product, Order",
          database: "mysql",
          auth: "oauth2",
        },
      });
      const text = promptText(result);
      assert.match(text, /baseName shop/);
      assert.match(text, /authenticationType oauth2/);
      assert.match(text, /prodDatabaseType mysql/);
      assert.match(text, /paginate \* with pagination/);
      assert.match(text, /dto \* with mapstruct/);
      assert.match(text, /create_app_from_jdl/);
      assert.match(text, /dryRun: true/);
    } finally {
      await close();
    }
  });

  it("uses databaseType mongodb (no prodDatabaseType) when database=mongodb", async () => {
    const { client, close } = await createMcpPair(registerAll);
    try {
      const result = await client.getPrompt({
        name: "scaffold_crud_monolith",
        arguments: {
          workingDirectory: "/tmp/m",
          baseName: "m",
          entities: "Thing",
          database: "mongodb",
        },
      });
      const text = promptText(result);
      assert.match(text, /databaseType mongodb/);
      assert.doesNotMatch(text, /prodDatabaseType/);
    } finally {
      await close();
    }
  });

  it("renders add_audit_fields scoped to all entities and points at the entities resource", async () => {
    const { client, close } = await createMcpPair(registerAll);
    try {
      const result = await client.getPrompt({
        name: "add_audit_fields",
        arguments: { workingDirectory: "/tmp/app" },
      });
      const text = promptText(result);
      assert.match(text, /every entity in the project/);
      assert.match(text, /createdBy String/);
      assert.match(text, /lastModifiedDate Instant/);
      assert.match(text, /jhipster:\/\/project\/entities\?dir=%2Ftmp%2Fapp/);
      assert.match(text, /import_jdl/);
    } finally {
      await close();
    }
  });

  it("scopes add_audit_fields to named entities when provided", async () => {
    const { client, close } = await createMcpPair(registerAll);
    try {
      const result = await client.getPrompt({
        name: "add_audit_fields",
        arguments: { workingDirectory: "/tmp/app", entities: "Order, Invoice" },
      });
      const text = promptText(result);
      assert.match(text, /these entities: Order, Invoice/);
    } finally {
      await close();
    }
  });

  it("renders monolith_to_microservices referencing the jdl resource and validate_jdl", async () => {
    const { client, close } = await createMcpPair(registerAll);
    try {
      const result = await client.getPrompt({
        name: "monolith_to_microservices",
        arguments: {
          workingDirectory: "/tmp/mono",
          targetDirectory: "/tmp/micro",
          services: "orders: Order, OrderItem",
        },
      });
      const text = promptText(result);
      assert.match(text, /jhipster:\/\/project\/jdl\?dir=%2Ftmp%2Fmono/);
      assert.match(text, /orders: Order, OrderItem/);
      assert.match(text, /applicationType microservice/);
      assert.match(text, /gateway/);
      assert.match(text, /validate_jdl/);
    } finally {
      await close();
    }
  });
});
