import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { registerGenerateDeployment } from "../../src/tools/generateDeployment.js";
import { createMcpPair, getText } from "../helpers/mcp.js";
import { installFakeJhipster } from "../helpers/fakeJhipster.js";
import { makeTempDir } from "../helpers/tmpdir.js";

describe("generate_deployment tool", () => {
  it("writes a deployment JDL block and applies it via jhipster jdl", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    const { client, close } = await createMcpPair(registerGenerateDeployment);
    try {
      const res = await client.callTool({
        name: "generate_deployment",
        arguments: {
          workingDirectory: tmp.path,
          deploymentType: "docker-compose",
          appsFolders: ["store", "invoice"],
          dockerRepositoryName: "myuser",
        },
      });
      assert.equal((res as { isError?: boolean }).isError ?? false, false);

      const jdl = await readFile(path.join(tmp.path, "deployment.jdl"), "utf8");
      assert.match(jdl, /deployment \{/);
      assert.match(jdl, /deploymentType docker-compose/);
      assert.match(jdl, /appsFolders \[store, invoice\]/);
      assert.match(jdl, /dockerRepositoryName myuser/);

      // It applies via `jhipster jdl deployment.jdl` (fake echoes argv).
      assert.match(getText(res as never), /"jdl","deployment\.jdl"/);
    } finally {
      await close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });

  it("supports kubernetes options", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    const { client, close } = await createMcpPair(registerGenerateDeployment);
    try {
      await client.callTool({
        name: "generate_deployment",
        arguments: {
          workingDirectory: tmp.path,
          deploymentType: "kubernetes",
          appsFolders: ["gateway"],
          kubernetesNamespace: "jhipster",
          kubernetesServiceType: "LoadBalancer",
        },
      });
      const jdl = await readFile(path.join(tmp.path, "deployment.jdl"), "utf8");
      assert.match(jdl, /deploymentType kubernetes/);
      assert.match(jdl, /kubernetesNamespace jhipster/);
      assert.match(jdl, /kubernetesServiceType LoadBalancer/);
    } finally {
      await close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });

  it("rejects an unsafe appsFolders entry without spawning", async () => {
    const tmp = await makeTempDir();
    const fake = await installFakeJhipster();
    const { client, close } = await createMcpPair(registerGenerateDeployment);
    try {
      const res = await client.callTool({
        name: "generate_deployment",
        arguments: {
          workingDirectory: tmp.path,
          deploymentType: "docker-compose",
          appsFolders: ["store; rm -rf /"],
        },
      });
      assert.equal((res as { isError?: boolean }).isError, true);
      assert.match(getText(res as never), /Invalid appsFolders entry/);
    } finally {
      await close();
      fake.restorePath();
      await fake.cleanup();
      await tmp.cleanup();
    }
  });
});
