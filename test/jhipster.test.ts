import { describe, it, after, before } from "node:test";
import assert from "node:assert/strict";
import { realpath } from "node:fs/promises";
import { assertDirectoryExists, formatRunResult, runJhipster } from "../src/jhipster.js";
import { installFakeJhipster, withEmptyPath, type FakeJhipster } from "./helpers/fakeJhipster.js";
import { makeTempDir, type TempDir } from "./helpers/tmpdir.js";

describe("assertDirectoryExists", () => {
  let tmp: TempDir;
  before(async () => {
    tmp = await makeTempDir();
  });
  after(async () => {
    await tmp.cleanup();
  });

  it("accepts an existing absolute path", async () => {
    await assert.doesNotReject(() => assertDirectoryExists(tmp.path));
  });

  it("rejects a relative path", async () => {
    await assert.rejects(() => assertDirectoryExists("./relative"), /absolute path/);
  });

  it("rejects a non-existent path", async () => {
    await assert.rejects(
      () => assertDirectoryExists("/this/path/should/not/exist/xyz123"),
      /does not exist/,
    );
  });
});

describe("formatRunResult", () => {
  it("renders the command header and exit code", () => {
    const out = formatRunResult({
      command: "jhipster info",
      exitCode: 0,
      stdout: "hello",
      stderr: "",
    });
    assert.match(out, /^\$ jhipster info/);
    assert.match(out, /\(exit 0\)/);
    assert.match(out, /--- stdout ---\nhello/);
    assert.doesNotMatch(out, /--- stderr ---/);
  });

  it("includes stderr section when present", () => {
    const out = formatRunResult({
      command: "jhipster jdl x",
      exitCode: 1,
      stdout: "",
      stderr: "boom",
    });
    assert.match(out, /\(exit 1\)/);
    assert.match(out, /--- stderr ---\nboom/);
  });
});

describe("runJhipster", () => {
  let tmp: TempDir;
  before(async () => {
    tmp = await makeTempDir();
  });
  after(async () => {
    await tmp.cleanup();
  });

  it("returns a friendly error when the jhipster binary is missing", async () => {
    const restore = await withEmptyPath();
    try {
      await assert.rejects(
        () => runJhipster({ cwd: tmp.path, args: ["info"] }),
        /jhipster.*CLI not found on PATH/i,
      );
    } finally {
      restore.restore();
    }
  });

  it("spawns the jhipster binary and captures stdout / exit code", async () => {
    const fake: FakeJhipster = await installFakeJhipster();
    try {
      const result = await runJhipster({ cwd: tmp.path, args: ["info", "--quiet"] });
      // macOS resolves /var/folders/... to /private/var/folders/... via realpath
      const canonicalCwd = await realpath(tmp.path);
      assert.equal(result.exitCode, 0);
      assert.match(result.stdout, /\[fake-jhipster\]/);
      assert.match(result.stdout, /"args":\["info","--quiet"\]/);
      assert.ok(
        result.stdout.includes(`"cwd":"${canonicalCwd}"`),
        `expected stdout to include canonical cwd ${canonicalCwd}, got: ${result.stdout}`,
      );
      assert.equal(result.command, "jhipster info --quiet");
    } finally {
      fake.restorePath();
      await fake.cleanup();
    }
  });

  it("propagates a non-zero exit code and captures stderr", async () => {
    const fake = await installFakeJhipster();
    try {
      const result = await runJhipster({
        cwd: tmp.path,
        args: ["jdl", "bad.jdl"],
        env: { FAKE_JHIPSTER_EXIT: "2", FAKE_JHIPSTER_STDERR: "parse error\n" },
      });
      assert.equal(result.exitCode, 2);
      assert.match(result.stderr, /parse error/);
    } finally {
      fake.restorePath();
      await fake.cleanup();
    }
  });
});
