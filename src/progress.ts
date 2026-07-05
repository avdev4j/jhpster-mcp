import type { ServerNotification } from "@modelcontextprotocol/server";

/**
 * The slice of an MCP tool handler's `ctx` (ServerContext) argument that we need
 * to stream progress. Kept structural so it accepts the SDK's ServerContext
 * without pulling in its full type. In the v2 SDK the progress token and the
 * per-request notifier both live under `ctx.mcpReq`.
 */
export interface ProgressCapableExtra {
  mcpReq: {
    _meta?: { progressToken?: string | number };
    notify: (notification: ServerNotification) => Promise<void>;
  };
}

export type OnData = (chunk: string, stream: "stdout" | "stderr") => void;

/**
 * Build an `onData` callback that forwards `jhipster` output as MCP
 * `notifications/progress` messages, one per non-empty output line.
 *
 * Returns `undefined` when the client did not supply a progressToken — in that
 * case the caller should simply not stream (output is still returned at the end).
 */
export function makeProgressReporter(extra: ProgressCapableExtra | undefined): OnData | undefined {
  const token = extra?.mcpReq._meta?.progressToken;
  if (token === undefined || extra === undefined) return undefined;

  let progress = 0;
  let buffer = "";

  const emit = (line: string) => {
    progress += 1;
    void extra.mcpReq
      .notify({
        method: "notifications/progress",
        params: {
          progressToken: token,
          progress,
          message: line.slice(0, 500),
        },
      })
      .catch(() => {
        /* a dropped progress note must never fail the tool call */
      });
  };

  return (chunk: string) => {
    buffer += chunk;
    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex).trimEnd();
      buffer = buffer.slice(newlineIndex + 1);
      if (line.trim().length > 0) emit(line);
    }
  };
}
