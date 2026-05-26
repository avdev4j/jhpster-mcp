import type { ServerNotification } from "@modelcontextprotocol/sdk/types.js";

/**
 * The slice of an MCP tool handler's `extra` argument that we need to stream
 * progress. Kept structural so it accepts the SDK's RequestHandlerExtra without
 * pulling in its full generic signature.
 */
export interface ProgressCapableExtra {
  _meta?: { progressToken?: string | number };
  sendNotification: (notification: ServerNotification) => Promise<void>;
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
  const token = extra?._meta?.progressToken;
  if (token === undefined || extra === undefined) return undefined;

  let progress = 0;
  let buffer = "";

  const emit = (line: string) => {
    progress += 1;
    void extra
      .sendNotification({
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
