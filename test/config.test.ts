import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readConfig, assertWithinRoot, jhipsterCommand, jhipsterCommandForVersion } from "../src/config.js";

describe("readConfig", () => {
  it("defaults to empty when nothing is set", () => {
    const c = readConfig({});
    assert.equal(c.rootDir, undefined);
    assert.deepEqual(c.defaultArgs, []);
    assert.equal(c.generatorVersion, undefined);
  });

  it("resolves an absolute root and rejects a relative one", () => {
    assert.equal(readConfig({ JHIPSTER_MCP_ROOT: "/srv/apps" }).rootDir, path.resolve("/srv/apps"));
    assert.throws(() => readConfig({ JHIPSTER_MCP_ROOT: "relative/apps" }), /absolute path/);
  });

  it("splits default args and rejects unsafe ones", () => {
    assert.deepEqual(readConfig({ JHIPSTER_MCP_DEFAULT_ARGS: "  --skip-install   --no-insight " }).defaultArgs, [
      "--skip-install",
      "--no-insight",
    ]);
    assert.throws(() => readConfig({ JHIPSTER_MCP_DEFAULT_ARGS: "--foo; rm -rf /" }), /unsafe argument/);
  });

  it("accepts a valid generator version and rejects a malformed one", () => {
    assert.equal(readConfig({ JHIPSTER_MCP_GENERATOR_VERSION: "8.7.4" }).generatorVersion, "8.7.4");
    assert.equal(readConfig({ JHIPSTER_MCP_GENERATOR_VERSION: "latest" }).generatorVersion, "latest");
    assert.throws(() => readConfig({ JHIPSTER_MCP_GENERATOR_VERSION: "8;evil" }), /not a valid version/);
  });
});

describe("assertWithinRoot", () => {
  const cfg = { rootDir: path.resolve("/srv/apps"), defaultArgs: [] };

  it("is a no-op when no root is configured", () => {
    assert.doesNotThrow(() => assertWithinRoot("/anywhere", { defaultArgs: [] }));
  });

  it("allows the root itself and paths inside it", () => {
    assert.doesNotThrow(() => assertWithinRoot("/srv/apps", cfg));
    assert.doesNotThrow(() => assertWithinRoot("/srv/apps/shop", cfg));
    assert.doesNotThrow(() => assertWithinRoot("/srv/apps/nested/deep", cfg));
  });

  it("rejects paths outside the root, including traversal", () => {
    assert.throws(() => assertWithinRoot("/srv/other", cfg), /outside the configured sandbox root/);
    assert.throws(() => assertWithinRoot("/srv/apps/../other", cfg), /outside the configured sandbox root/);
    assert.throws(() => assertWithinRoot("/srv/apps-evil", cfg), /outside the configured sandbox root/);
  });
});

describe("jhipsterCommand", () => {
  it("uses the global binary when unpinned", () => {
    assert.deepEqual(jhipsterCommand({ defaultArgs: [] }), { command: "jhipster", prefixArgs: [] });
  });

  it("dispatches via npx when a version is pinned", () => {
    assert.deepEqual(jhipsterCommand({ defaultArgs: [], generatorVersion: "8.7.4" }), {
      command: "npx",
      prefixArgs: ["-y", "-p", "generator-jhipster@8.7.4", "jhipster"],
    });
  });
});

describe("jhipsterCommandForVersion", () => {
  it("builds an npx invocation for an explicit version", () => {
    assert.deepEqual(jhipsterCommandForVersion("8.0.0"), {
      command: "npx",
      prefixArgs: ["-y", "-p", "generator-jhipster@8.0.0", "jhipster"],
    });
  });
  it("rejects an unsafe version string", () => {
    assert.throws(() => jhipsterCommandForVersion("8;rm"), /Invalid generator version/);
  });
});
