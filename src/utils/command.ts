import type { Subprocess } from "bun";

export type Command = [string, ...string[]];

export interface CommandOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
  stdout?: "inherit" | "pipe" | "ignore";
  stderr?: "inherit" | "pipe" | "ignore";
}

function createEnv(env?: Record<string, string | undefined>): Record<string, string> {
  return {
    ...process.env,
    ...Object.fromEntries(Object.entries(env ?? {}).filter(([, value]) => value !== undefined)),
  } as Record<string, string>;
}

async function waitForProcess(subprocess: Subprocess, command: Command): Promise<number> {
  const exitCode = await subprocess.exited;
  if (exitCode !== 0) {
    throw new Error(`Command \`${command.join(" ")}\` exited with code ${exitCode}`);
  }
  return exitCode;
}

export async function runCommand(command: Command, options: CommandOptions = {}): Promise<void> {
  const subprocess = Bun.spawn({
    cmd: command,
    cwd: options.cwd,
    env: createEnv(options.env),
    stdout: options.stdout ?? "inherit",
    stderr: options.stderr ?? "inherit",
  });

  await waitForProcess(subprocess, command);
}

export interface CaptureCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function captureCommand(
  command: Command,
  options: CommandOptions = {},
): Promise<CaptureCommandResult> {
  const subprocess = Bun.spawn({
    cmd: command,
    cwd: options.cwd,
    env: createEnv(options.env),
    stdout: options.stdout ?? "pipe",
    stderr: options.stderr ?? "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    subprocess.stdout ? new Response(subprocess.stdout).text() : "",
    subprocess.stderr ? new Response(subprocess.stderr).text() : "",
    subprocess.exited,
  ]);

  if (exitCode !== 0) {
    const error = new Error(
      `Command \`${command.join(" ")}\` exited with code ${exitCode}.\n${stderr.trim()}`,
    );
    (error as Error & { stdout?: string; stderr?: string }).stdout = stdout;
    (error as Error & { stdout?: string; stderr?: string }).stderr = stderr;
    throw error;
  }

  return { stdout, stderr, exitCode };
}
