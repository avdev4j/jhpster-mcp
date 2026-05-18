import { spawn } from "node:child_process";
import { access, constants } from "node:fs/promises";
import path from "node:path";

export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  command: string;
}

export interface RunOptions {
  cwd: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  maxBufferBytes?: number;
}

const DEFAULT_TIMEOUT_MS = 10 * 60_000;
const DEFAULT_MAX_BUFFER = 8 * 1024 * 1024;

export async function assertDirectoryExists(dir: string): Promise<void> {
  if (!path.isAbsolute(dir)) {
    throw new Error(`workingDirectory must be an absolute path, got: ${dir}`);
  }
  try {
    await access(dir, constants.F_OK);
  } catch {
    throw new Error(`workingDirectory does not exist: ${dir}`);
  }
}

export async function runJhipster(opts: RunOptions): Promise<RunResult> {
  await assertDirectoryExists(opts.cwd);

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBuffer = opts.maxBufferBytes ?? DEFAULT_MAX_BUFFER;

  return new Promise<RunResult>((resolve, reject) => {
    const child = spawn("jhipster", opts.args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env, CI: "true" },
      shell: false,
    });

    let stdout = "";
    let stderr = "";
    let bufferedBytes = 0;
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      bufferedBytes += chunk.length;
      if (bufferedBytes > maxBuffer) {
        if (!killed) {
          killed = true;
          child.kill("SIGTERM");
        }
        return;
      }
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      bufferedBytes += chunk.length;
      if (bufferedBytes > maxBuffer) return;
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        reject(
          new Error(
            "`jhipster` CLI not found on PATH. Install generator-jhipster globally: npm install -g generator-jhipster",
          ),
        );
        return;
      }
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const command = `jhipster ${opts.args.join(" ")}`;
      if (killed) {
        resolve({
          exitCode: code ?? -1,
          stdout,
          stderr:
            stderr +
            `\n[jhipster-mcp] process terminated (timeout=${timeoutMs}ms or buffer=${maxBuffer}B exceeded)`,
          command,
        });
        return;
      }
      resolve({ exitCode: code ?? -1, stdout, stderr, command });
    });
  });
}

export function formatRunResult(r: RunResult): string {
  const head = `$ ${r.command}\n(exit ${r.exitCode})`;
  const sections: string[] = [head];
  if (r.stdout.trim()) sections.push(`--- stdout ---\n${r.stdout.trimEnd()}`);
  if (r.stderr.trim()) sections.push(`--- stderr ---\n${r.stderr.trimEnd()}`);
  return sections.join("\n\n");
}
