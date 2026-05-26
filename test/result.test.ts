import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractEntities,
  parseFileChanges,
  parseWarnings,
  stripAnsi,
  toStructuredResult,
} from "../src/result.js";

describe("stripAnsi", () => {
  it("removes ANSI color codes", () => {
    assert.equal(stripAnsi("\x1b[32mcreate\x1b[39m foo.txt"), "create foo.txt");
  });
});

describe("extractEntities", () => {
  it("pulls entity names from JDL", () => {
    const jdl = "entity Customer {\n name String\n}\nentity OrderItem {}\n";
    assert.deepEqual(extractEntities(jdl), ["Customer", "OrderItem"]);
  });

  it("dedupes and ignores relationship/option lines", () => {
    const jdl = "entity Order {}\nrelationship OneToMany { Order{items} to Item }\npaginate * with pagination";
    assert.deepEqual(extractEntities(jdl), ["Order"]);
  });

  it("returns empty for JDL without entities", () => {
    assert.deepEqual(extractEntities("paginate * with pagination"), []);
  });
});

describe("parseFileChanges", () => {
  it("parses Yeoman action lines, including ANSI-colored ones", () => {
    const output = [
      "   \x1b[32mcreate\x1b[39m src/main/java/App.java",
      "   \x1b[33mforce\x1b[39m package.json",
      "   identical .gitignore",
      "   conflict src/main/webapp/index.html",
      "random noise line",
    ].join("\n");
    assert.deepEqual(parseFileChanges(output), [
      { action: "create", path: "src/main/java/App.java" },
      { action: "force", path: "package.json" },
      { action: "identical", path: ".gitignore" },
      { action: "conflict", path: "src/main/webapp/index.html" },
    ]);
  });

  it("returns empty when nothing matches", () => {
    assert.deepEqual(parseFileChanges("just some logs\nno actions here"), []);
  });
});

describe("parseWarnings", () => {
  it("collects distinct warning lines", () => {
    const output = "WARNING! something\ninfo: ok\nwarn: deprecated flag\nWARNING! something";
    assert.deepEqual(parseWarnings(output), ["WARNING! something", "warn: deprecated flag"]);
  });
});

describe("toStructuredResult", () => {
  it("assembles a complete structured result", () => {
    const r = {
      command: "jhipster jdl app.jdl --force --skip-git",
      exitCode: 0,
      stdout: "   create A.java\nWARNING! heads up",
      stderr: "",
    };
    const structured = toStructuredResult(r, { jdl: "entity Foo {}", dryRun: false });
    assert.equal(structured.command, r.command);
    assert.equal(structured.exitCode, 0);
    assert.equal(structured.success, true);
    assert.equal(structured.dryRun, false);
    assert.deepEqual(structured.entities, ["Foo"]);
    assert.deepEqual(structured.filesChanged, [{ action: "create", path: "A.java" }]);
    assert.deepEqual(structured.warnings, ["WARNING! heads up"]);
  });

  it("marks failure and empty entities when no JDL is given", () => {
    const structured = toStructuredResult({
      command: "jhipster info",
      exitCode: 1,
      stdout: "",
      stderr: "boom",
    });
    assert.equal(structured.success, false);
    assert.deepEqual(structured.entities, []);
    assert.equal(structured.dryRun, false);
  });
});
