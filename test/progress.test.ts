import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { makeProgressReporter, type ProgressCapableExtra } from "../src/progress.js";

interface CapturedNote {
  method: string;
  params: { progressToken: string | number; progress: number; total?: number; message?: string };
}

function fakeExtra(token?: string | number): {
  extra: ProgressCapableExtra;
  notes: CapturedNote[];
} {
  const notes: CapturedNote[] = [];
  const extra: ProgressCapableExtra = {
    mcpReq: {
      _meta: token === undefined ? undefined : { progressToken: token },
      notify: async (n) => {
        notes.push(n as unknown as CapturedNote);
      },
    },
  };
  return { extra, notes };
}

describe("makeProgressReporter", () => {
  it("returns undefined when the client supplied no progressToken", () => {
    const { extra } = fakeExtra(undefined);
    assert.equal(makeProgressReporter(extra), undefined);
  });

  it("returns undefined when extra itself is undefined", () => {
    assert.equal(makeProgressReporter(undefined), undefined);
  });

  it("emits one progress notification per non-empty line", () => {
    const { extra, notes } = fakeExtra("tok");
    const onData = makeProgressReporter(extra)!;
    onData("Generating Product\nGenerating Order\n", "stdout");
    assert.equal(notes.length, 2);
    assert.deepEqual(
      notes.map((n) => n.params.message),
      ["Generating Product", "Generating Order"],
    );
    // progress is monotonically increasing
    assert.deepEqual(
      notes.map((n) => n.params.progress),
      [1, 2],
    );
    assert.equal(notes[0]!.params.progressToken, "tok");
    assert.equal(notes[0]!.method, "notifications/progress");
  });

  it("skips blank lines", () => {
    const { extra, notes } = fakeExtra(1);
    const onData = makeProgressReporter(extra)!;
    onData("\n   \nreal line\n\n", "stdout");
    assert.equal(notes.length, 1);
    assert.equal(notes[0]!.params.message, "real line");
  });

  it("buffers partial lines across chunks", () => {
    const { extra, notes } = fakeExtra("tok");
    const onData = makeProgressReporter(extra)!;
    onData("par", "stdout");
    assert.equal(notes.length, 0, "no newline yet -> no notification");
    onData("tial line\n", "stdout");
    assert.equal(notes.length, 1);
    assert.equal(notes[0]!.params.message, "partial line");
  });

  it("truncates very long lines to 500 chars", () => {
    const { extra, notes } = fakeExtra("tok");
    const onData = makeProgressReporter(extra)!;
    onData("x".repeat(1000) + "\n", "stdout");
    assert.equal(notes.length, 1);
    assert.equal(notes[0]!.params.message!.length, 500);
  });

  it("never throws when sendNotification rejects", () => {
    const notes: CapturedNote[] = [];
    const extra: ProgressCapableExtra = {
      mcpReq: {
        _meta: { progressToken: "tok" },
        notify: async () => {
          void notes;
          throw new Error("transport closed");
        },
      },
    };
    const onData = makeProgressReporter(extra)!;
    assert.doesNotThrow(() => onData("a line\n", "stdout"));
  });
});
