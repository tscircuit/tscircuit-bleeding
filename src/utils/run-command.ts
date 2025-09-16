import { mkdir } from "node:fs/promises";

export interface RunCommandOptions {
  cwd?: string;
  env?: Record<string, string>;
  /** When true, stdout/stderr will be captured and returned */
  captureOutput?: boolean;
  /** Optional human-friendly description for logging */
  description?: string;
}

export interface RunCommandResult {
  stdout?: string;
  stderr?: string;
}

async function ensureDirectoryExists(path?: string) {
  if (!path) return;
  await mkdir(path, { recursive: true });
}

export async function runCommand(
  cmd: string[],
  options: RunCommandOptions = {},
): Promise<RunCommandResult> {
  const { cwd, env, captureOutput = false, description } = options;

  if (description) {
    console.log(description);
  }

  if (cwd) {
    await ensureDirectoryExists(cwd);
  }

  const subprocess = Bun.spawn({
    cmd,
    cwd,
    env: env ? { ...process.env, ...env } : process.env,
    stdout: captureOutput ? "pipe" : "inherit",
    stderr: captureOutput ? "pipe" : "inherit",
  });

  const exitCode = await subprocess.exited;

  let stdout: string | undefined;
  let stderr: string | undefined;

  if (captureOutput && subprocess.stdout) {
    stdout = await new Response(subprocess.stdout).text();
  }

  if (captureOutput && subprocess.stderr) {
    stderr = await new Response(subprocess.stderr).text();
  }

  if (exitCode !== 0) {
    const errorMessage =
      `Command failed (${cmd.join(" ")}): exit code ${exitCode}` +
      (stderr ? `\n${stderr}` : "");
    throw new Error(errorMessage);
  }

  return { stdout, stderr };
}
