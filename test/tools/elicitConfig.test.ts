import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { registerCreateAppFromJdl } from "../../src/tools/createAppFromJdl.js";
import { installFakeJhipster } from "../helpers/fakeJhipster.js";
import { makeTempDir } from "../helpers/tmpdir.js";

type ElicitResponse =
  | { action: "accept"; content: Record<string, string> }
  | { action: "decline" }
  | { action: "cancel" };

interface ElicitPair {
  client: Client;
  close: () => Promise<void>;
  /** Number of elicitation requests the server made to the client. */
  calls: () => number;
  /** The properties of the last elicitation request's requestedSchema. */
  lastProperties: () => Record<string, unknown> | undefined;
}

/** A client+server pair where the client advertises elicitation and answers with `respond`. */
async function makeElicitPair(respond: ElicitResponse | (() => ElicitResponse)): Promise<ElicitPair> {
  const server = new McpServer({ name: "t", version: "0" });
  registerCreateAppFromJdl(server);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: "tc", version: "0" }, { capabilities: { elicitation: {} } });
  let calls = 0;
  let lastProperties: Record<string, unknown> | undefined;
  client.setRequestHandler(ElicitRequestSchema, async (req) => {
    calls += 1;
    if ("requestedSchema" in req.params) {
      lastProperties = (req.params.requestedSchema as { properties?: Record<string, unknown> }).properties;
    }
    return typeof respond === "function" ? respond() : respond;
  });
  await client.connect(clientTransport);

  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
    calls: () => calls,
    lastProperties: () => lastProperties,
  };
}

const PARTIAL_JDL = `application {
  config {
    baseName shop
    applicationType monolith
    packageName com.acme.shop
  }
  entities *
}
entity Product { name String }`;

describe("create_app_from_jdl elicitation", () => {
  it("asks for missing database/auth/client and injects the answers into the JDL", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    const pair = await makeElicitPair({
      action: "accept",
      content: { database: "postgresql", authentication: "jwt", clientFramework: "angular" },
    });
    try {
      await pair.client.callTool({
        name: "create_app_from_jdl",
        arguments: { workingDirectory: tmp.path, jdl: PARTIAL_JDL },
      });

      assert.equal(pair.calls(), 1, "expected exactly one elicitation request");
      assert.deepEqual(
        Object.keys(pair.lastProperties() ?? {}).sort(),
        ["authentication", "clientFramework", "database"],
      );

      // The applied JDL (persisted as app.jdl) carries the injected config lines.
      const applied = await readFile(path.join(tmp.path, "app.jdl"), "utf8");
      assert.match(applied, /databaseType sql/);
      assert.match(applied, /prodDatabaseType postgresql/);
      assert.match(applied, /authenticationType jwt/);
      assert.match(applied, /clientFramework angular/);
    } finally {
      await pair.close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });

  it("proceeds with the original JDL when the user declines", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    const pair = await makeElicitPair({ action: "decline" });
    try {
      await pair.client.callTool({
        name: "create_app_from_jdl",
        arguments: { workingDirectory: tmp.path, jdl: PARTIAL_JDL },
      });
      assert.equal(pair.calls(), 1);
      const applied = await readFile(path.join(tmp.path, "app.jdl"), "utf8");
      assert.equal(applied, PARTIAL_JDL, "declined elicitation must not modify the JDL");
    } finally {
      await pair.close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });

  it("aborts without generating when the user cancels", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    const pair = await makeElicitPair({ action: "cancel" });
    try {
      const res = (await pair.client.callTool({
        name: "create_app_from_jdl",
        arguments: { workingDirectory: tmp.path, jdl: PARTIAL_JDL },
      })) as { isError?: boolean };
      assert.equal(res.isError, true);
      const remaining = await readdir(tmp.path);
      assert.equal(remaining.length, 0, "cancel must not write the JDL or generate anything");
    } finally {
      await pair.close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });

  it("does not elicit on a dry run", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    const pair = await makeElicitPair(() => {
      throw new Error("elicitation should not be requested on a dry run");
    });
    try {
      await pair.client.callTool({
        name: "create_app_from_jdl",
        arguments: { workingDirectory: tmp.path, jdl: PARTIAL_JDL, dryRun: true },
      });
      assert.equal(pair.calls(), 0);
    } finally {
      await pair.close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });

  it("does not elicit when the JDL already specifies all config", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    const complete = PARTIAL_JDL.replace(
      "packageName com.acme.shop",
      "packageName com.acme.shop\n    databaseType sql\n    authenticationType jwt\n    clientFramework angular",
    );
    const pair = await makeElicitPair({ action: "decline" });
    try {
      await pair.client.callTool({
        name: "create_app_from_jdl",
        arguments: { workingDirectory: tmp.path, jdl: complete },
      });
      assert.equal(pair.calls(), 0, "complete config should not trigger elicitation");
    } finally {
      await pair.close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });
});

describe("create_app_from_jdl without elicitation capability", () => {
  it("proceeds with defaults (no elicitation) when the client lacks the capability", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    const server = new McpServer({ name: "t", version: "0" });
    registerCreateAppFromJdl(server);
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await server.connect(st);
    const client = new Client({ name: "tc", version: "0" }); // no elicitation capability
    await client.connect(ct);
    try {
      await client.callTool({
        name: "create_app_from_jdl",
        arguments: { workingDirectory: tmp.path, jdl: PARTIAL_JDL },
      });
      const applied = await readFile(path.join(tmp.path, "app.jdl"), "utf8");
      assert.equal(applied, PARTIAL_JDL, "no capability ⇒ JDL untouched, generation proceeds");
    } finally {
      await client.close();
      await server.close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });
});
