import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { registerJdlGrammar } from "../../src/resources/jdlGrammar.js";
import { createMcpPair } from "../helpers/mcp.js";

describe("jdl-grammar resource", () => {
  it("lists the grammar resource", async () => {
    const { client, close } = await createMcpPair(registerJdlGrammar);
    try {
      const list = await client.listResources();
      const uris = list.resources.map((r) => r.uri);
      assert.ok(uris.includes("jhipster://docs/jdl-grammar"));
    } finally {
      await close();
    }
  });

  it("returns markdown content covering applications, entities, and relationships", async () => {
    const { client, close } = await createMcpPair(registerJdlGrammar);
    try {
      const result = await client.readResource({ uri: "jhipster://docs/jdl-grammar" });
      assert.equal(result.contents.length, 1);
      const c = result.contents[0]!;
      assert.equal(c.mimeType, "text/markdown");
      assert.ok("text" in c && typeof c.text === "string", "expected text content");
      const text = c.text;
      assert.match(text, /application \{/);
      assert.match(text, /entity Customer \{/);
      assert.match(text, /relationship OneToMany/);
      assert.match(text, /paginate \* with pagination/);
    } finally {
      await close();
    }
  });
});
