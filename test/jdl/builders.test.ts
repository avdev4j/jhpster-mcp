import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import {
  buildApplicationJdl,
  buildEntityJdl,
  buildOptionJdl,
  buildRelationshipJdl,
  quickLintJdl,
  withTempJdlFile,
  analyzeAppConfig,
  configLinesFromAnswers,
  injectConfigLines,
  buildBlueprintsArgs,
} from "../../src/jdl/builders.js";

describe("buildBlueprintsArgs", () => {
  it("returns [] for empty/undefined input", () => {
    assert.deepEqual(buildBlueprintsArgs(undefined), []);
    assert.deepEqual(buildBlueprintsArgs([]), []);
    assert.deepEqual(buildBlueprintsArgs(["  ", ""]), []);
  });

  it("builds a comma-joined --blueprints pair", () => {
    assert.deepEqual(buildBlueprintsArgs(["kotlin"]), ["--blueprints", "kotlin"]);
    assert.deepEqual(buildBlueprintsArgs(["kotlin", "ionic"]), ["--blueprints", "kotlin,ionic"]);
    assert.deepEqual(buildBlueprintsArgs(["@scope/generator-jhipster-foo"]), [
      "--blueprints",
      "@scope/generator-jhipster-foo",
    ]);
  });

  it("rejects names with shell metacharacters or flags", () => {
    assert.throws(() => buildBlueprintsArgs(["kotlin; rm -rf /"]), /Invalid blueprint name/);
    assert.throws(() => buildBlueprintsArgs(["--skip-server"]), /Invalid blueprint name/);
    assert.throws(() => buildBlueprintsArgs(["a b"]), /Invalid blueprint name/);
  });
});

describe("analyzeAppConfig", () => {
  const full = `application { config { baseName a, applicationType monolith, databaseType sql, authenticationType jwt, clientFramework angular } entities * }`;

  it("reports no missing keys when all are present", () => {
    const a = analyzeAppConfig(full);
    assert.equal(a.appBlockCount, 1);
    assert.equal(a.hasConfigBlock, true);
    assert.deepEqual(a.missing, []);
  });

  it("detects each missing key", () => {
    const a = analyzeAppConfig(`application { config { baseName a } }`);
    assert.deepEqual(a.missing.sort(), ["authentication", "clientFramework", "database"]);
  });

  it("counts multiple application blocks (microservices)", () => {
    const jdl = `application { config { baseName gw } } application { config { baseName svc } }`;
    assert.equal(analyzeAppConfig(jdl).appBlockCount, 2);
  });
});

describe("configLinesFromAnswers", () => {
  it("expands a SQL prod database to three lines", () => {
    assert.deepEqual(configLinesFromAnswers({ database: "postgresql" }), [
      "databaseType sql",
      "prodDatabaseType postgresql",
      "devDatabaseType h2Disk",
    ]);
  });

  it("maps mongodb to a single databaseType line and 'none' to no", () => {
    assert.deepEqual(configLinesFromAnswers({ database: "mongodb" }), ["databaseType mongodb"]);
    assert.deepEqual(configLinesFromAnswers({ database: "none" }), ["databaseType no"]);
  });

  it("maps auth and client (client 'none' → no)", () => {
    assert.deepEqual(configLinesFromAnswers({ authentication: "oauth2", clientFramework: "none" }), [
      "authenticationType oauth2",
      "clientFramework no",
    ]);
  });

  it("ignores unknown values defensively", () => {
    assert.deepEqual(configLinesFromAnswers({ database: "rm -rf", authentication: "bogus" }), []);
  });
});

describe("injectConfigLines", () => {
  it("inserts lines just inside the first config block", () => {
    const out = injectConfigLines(`application {\n  config {\n    baseName a\n  }\n}`, [
      "databaseType sql",
    ]);
    assert.match(out, /config \{\n {4}databaseType sql\n {4}baseName a/);
  });

  it("returns the JDL unchanged with no lines or no config block", () => {
    assert.equal(injectConfigLines("entity X {}", ["databaseType sql"]), "entity X {}");
    assert.equal(injectConfigLines("application { config { } }", []), "application { config { } }");
  });
});

describe("buildEntityJdl", () => {
  it("renders an empty entity", () => {
    assert.equal(buildEntityJdl({ name: "Customer" }), "entity Customer {\n}");
  });

  it("renders fields with validations", () => {
    const jdl = buildEntityJdl({
      name: "Customer",
      fields: [
        { name: "firstName", type: "String", validations: ["required", "minlength(2)"] },
        { name: "loyalty", type: "Integer", validations: ["min(0)", "max(100)"] },
      ],
    });
    assert.equal(
      jdl,
      [
        "entity Customer {",
        "  firstName String required minlength(2)",
        "  loyalty Integer min(0) max(100)",
        "}",
      ].join("\n"),
    );
  });

  it("appends per-entity option lines", () => {
    const jdl = buildEntityJdl({
      name: "Order",
      fields: [{ name: "total", type: "BigDecimal" }],
      options: { paginate: "pagination", service: "serviceClass" },
    });
    assert.match(jdl, /^entity Order \{/);
    assert.match(jdl, /paginate Order with pagination/);
    assert.match(jdl, /service Order with serviceClass/);
  });

  it("rejects entity names that do not start uppercase", () => {
    assert.throws(() => buildEntityJdl({ name: "customer" }), /Invalid entity name/);
  });

  it("rejects field names that are not camelCase", () => {
    assert.throws(
      () =>
        buildEntityJdl({
          name: "Customer",
          fields: [{ name: "First_name", type: "String" }],
        }),
      /Invalid field name/,
    );
  });

  it("rejects invalid type names", () => {
    assert.throws(
      () =>
        buildEntityJdl({
          name: "Customer",
          fields: [{ name: "shady", type: "String; rm -rf" }],
        }),
      /Invalid type/,
    );
  });
});

describe("buildRelationshipJdl", () => {
  it("renders OneToMany without back-reference", () => {
    const jdl = buildRelationshipJdl({
      kind: "OneToMany",
      from: { entity: "Customer", field: "orders" },
      to: { entity: "Order" },
    });
    assert.equal(jdl, "relationship OneToMany {\n  Customer{orders} to Order\n}");
  });

  it("renders ManyToMany with back-reference and required flag", () => {
    const jdl = buildRelationshipJdl({
      kind: "ManyToMany",
      from: { entity: "Order", field: "products", required: true },
      to: { entity: "Product", field: "orders" },
    });
    assert.equal(
      jdl,
      "relationship ManyToMany {\n  Order{products required} to Product{orders}\n}",
    );
  });

  it("rejects bad entity casing on either side", () => {
    assert.throws(
      () =>
        buildRelationshipJdl({
          kind: "OneToOne",
          from: { entity: "customer", field: "profile" },
          to: { entity: "Profile" },
        }),
      /Invalid entity name/,
    );
    assert.throws(
      () =>
        buildRelationshipJdl({
          kind: "OneToOne",
          from: { entity: "Customer", field: "profile" },
          to: { entity: "profile" },
        }),
      /Invalid entity name/,
    );
  });
});

describe("buildApplicationJdl", () => {
  it("renders a minimal application block", () => {
    const jdl = buildApplicationJdl({
      baseName: "shop",
      applicationType: "monolith",
    });
    assert.match(jdl, /^application \{\n  config \{/);
    assert.match(jdl, /baseName shop/);
    assert.match(jdl, /applicationType monolith/);
    assert.match(jdl, /\n  \}\n\}$/);
  });

  it("quotes string values that contain spaces or special chars", () => {
    const jdl = buildApplicationJdl({
      baseName: "shop",
      jhiPrefix: "my prefix",
    } as unknown as Parameters<typeof buildApplicationJdl>[0]);
    assert.match(jdl, /jhiPrefix "my prefix"/);
  });

  it("rejects an invalid baseName", () => {
    assert.throws(() => buildApplicationJdl({ baseName: "1shop" }), /Invalid baseName/);
  });

  it("rejects an invalid packageName", () => {
    assert.throws(
      () => buildApplicationJdl({ baseName: "shop", packageName: "Bad..pkg" }),
      /Invalid packageName/,
    );
  });
});

describe("buildOptionJdl", () => {
  it("renders 'paginate * with pagination'", () => {
    assert.equal(
      buildOptionJdl({ option: "paginate", value: "pagination" }),
      "paginate * with pagination",
    );
  });

  it("scopes to a list of entities", () => {
    assert.equal(
      buildOptionJdl({ option: "search", value: "elasticsearch", entities: ["Order", "Product"] }),
      "search Order, Product with elasticsearch",
    );
  });

  it("supports 'except' clause", () => {
    assert.equal(
      buildOptionJdl({ option: "paginate", value: "pagination", except: ["Country"] }),
      "paginate * with pagination except Country",
    );
  });

  it("omits 'with' when value is undefined (boolean-style option)", () => {
    assert.equal(buildOptionJdl({ option: "readOnly", entities: ["Country"] }), "readOnly Country");
  });

  it("rejects bad entity names in target list", () => {
    assert.throws(
      () => buildOptionJdl({ option: "paginate", value: "pagination", entities: ["bad"] }),
      /Invalid entity name/,
    );
  });
});

describe("quickLintJdl", () => {
  it("passes valid, balanced JDL", () => {
    assert.deepEqual(quickLintJdl("entity Foo {\n  bar String\n}"), []);
    assert.deepEqual(quickLintJdl("paginate * with pagination"), []);
  });

  it("flags empty input", () => {
    assert.deepEqual(quickLintJdl("   \n  "), ["JDL is empty."]);
  });

  it("flags an unclosed brace", () => {
    const issues = quickLintJdl("entity Foo {");
    assert.equal(issues.length, 1);
    assert.match(issues[0]!, /unclosed/);
  });

  it("flags a stray closing brace", () => {
    const issues = quickLintJdl("entity Foo {} }");
    assert.equal(issues.length, 1);
    assert.match(issues[0]!, /no matching/);
  });
});

describe("withTempJdlFile", () => {
  it("creates the file with the given content and cleans up afterwards", async () => {
    let observedPath = "";
    let observedContent = "";
    await withTempJdlFile("entity Foo {}", async (filePath) => {
      observedPath = filePath;
      observedContent = await readFile(filePath, "utf8");
      // file must still exist while the callback runs
      const s = await stat(filePath);
      assert.ok(s.isFile());
    });
    assert.equal(observedContent, "entity Foo {}");
    await assert.rejects(() => stat(observedPath), /ENOENT/);
  });
});
