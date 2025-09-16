import { logCommand } from "./logger"

export interface RunCommandOptions {
  cwd?: string
  env?: Record<string, string>
  stdout?: "inherit" | "pipe" | "ignore"
  stderr?: "inherit" | "pipe" | "ignore"
  allowFailure?: boolean
}

export interface RunCommandResult {
  exitCode: number
  stdout?: string
  stderr?: string
}

export async function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions = {},
): Promise<RunCommandResult> {
  const { cwd, env, stdout, stderr, allowFailure } = options
  const finalEnv = { ...process.env, ...env }
  const commandParts = [command, ...args]
  logCommand(cwd, commandParts)

  const stdoutMode = stdout ?? "inherit"
  const stderrMode = stderr ?? "inherit"

  const subprocess = Bun.spawn({
    cmd: commandParts,
    cwd,
    env: finalEnv,
    stdin: "inherit",
    stdout: stdoutMode,
    stderr: stderrMode,
  })

  const stdoutPromise =
    stdoutMode === "pipe"
      ? new Response(subprocess.stdout!).text()
      : Promise.resolve<string | undefined>(undefined)
  const stderrPromise =
    stderrMode === "pipe"
      ? new Response(subprocess.stderr!).text()
      : Promise.resolve<string | undefined>(undefined)

  const exitCode = await subprocess.exited
  const [collectedStdout, collectedStderr] = await Promise.all([
    stdoutPromise,
    stderrPromise,
  ])

  if (exitCode !== 0 && !allowFailure) {
    const error = new Error(
      `Command failed with exit code ${exitCode}: ${commandParts.join(" ")}`,
    )
    ;(error as Error & Partial<RunCommandResult>).stdout = collectedStdout
    ;(error as Error & Partial<RunCommandResult>).stderr = collectedStderr
    throw error
  }

  return { exitCode, stdout: collectedStdout, stderr: collectedStderr }
}
