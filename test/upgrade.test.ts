import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseVersion, classifyBump, assessUpgrade } from "../src/upgrade.js";

describe("parseVersion", () => {
  it("parses plain and v-prefixed and suffixed versions", () => {
    assert.deepEqual(parseVersion("8.7.4"), { major: 8, minor: 7, patch: 4 });
    assert.deepEqual(parseVersion("v8.0.0"), { major: 8, minor: 0, patch: 0 });
    assert.deepEqual(parseVersion("8.0.0-beta.1"), { major: 8, minor: 0, patch: 0 });
  });
  it("returns null for missing/garbage", () => {
    assert.equal(parseVersion(undefined), null);
    assert.equal(parseVersion("latest"), null);
  });
});

describe("classifyBump", () => {
  const v = (s: string) => parseVersion(s);
  it("classifies major/minor/patch/none", () => {
    assert.equal(classifyBump(v("7.9.0"), v("8.0.0")), "major");
    assert.equal(classifyBump(v("8.1.0"), v("8.3.0")), "minor");
    assert.equal(classifyBump(v("8.7.3"), v("8.7.4")), "patch");
    assert.equal(classifyBump(v("8.7.4"), v("8.7.4")), "none");
  });
  it("detects downgrade and unknown", () => {
    assert.equal(classifyBump(v("8.7.4"), v("8.7.0")), "downgrade");
    assert.equal(classifyBump(v("8.0.0"), v("7.0.0")), "downgrade");
    assert.equal(classifyBump(null, v("8.0.0")), "unknown");
    assert.equal(classifyBump(v("8.0.0"), null), "unknown");
  });
});

describe("assessUpgrade", () => {
  it("rates a patch with no risk factors as low", () => {
    const a = assessUpgrade({ bump: "patch", blueprints: [], applicationType: "monolith", entityCount: 3 });
    assert.equal(a.riskLevel, "low");
    assert.equal(a.considerations.length, 0);
  });

  it("rates a plain major bump as medium", () => {
    const a = assessUpgrade({ bump: "major", blueprints: [], applicationType: "monolith", entityCount: 1 });
    assert.equal(a.riskLevel, "medium");
  });

  it("escalates to high with blueprints and flags them", () => {
    const a = assessUpgrade({ bump: "major", blueprints: ["kotlin"], applicationType: "monolith", entityCount: 1 });
    assert.equal(a.riskLevel, "high");
    assert.ok(a.considerations.some((c) => /blueprint/i.test(c)));
  });

  it("flags microservices and large entity counts", () => {
    const a = assessUpgrade({ bump: "minor", blueprints: [], applicationType: "gateway", entityCount: 42 });
    assert.ok(a.considerations.some((c) => /microservices/i.test(c)));
    assert.ok(a.considerations.some((c) => /42 entities/.test(c)));
    assert.equal(a.riskLevel, "high"); // minor(1) + micro(1) + entities(1) = 3
  });

  it("always returns a checklist and references", () => {
    const a = assessUpgrade({ bump: "none", blueprints: [], applicationType: "monolith", entityCount: 0 });
    assert.ok(a.steps.length >= 4);
    assert.ok(a.references.some((r) => /jhipster\.tech\/upgrading/.test(r)));
  });
});
