import { spawn } from "node:child_process"
import type { Readable } from "node:stream"
import { debug, info } from "./logger"

export interface RunCommandOptions {
  cwd: string
  env?: NodeJS.ProcessEnv
  prefix?: string
  dryRun?: boolean
  allowFailure?: boolean
  logStdout?: boolean
  logStderr?: boolean
}

export interface CommandResult {
  stdout: string
  stderr: string
  code: number
  signal: NodeJS.Signals | null
}

export class CommandError extends Error {
  command: string[]

  cwd: string

  code: number | null

  signal: NodeJS.Signals | null

  stdout: string

  stderr: string

  constructor(
    message: string,
    options: {
      command: string[]
      cwd: string
      code: number | null
      signal: NodeJS.Signals | null
      stdout: string
      stderr: string
    },
  ) {
    super(message)
    this.name = "CommandError"
    this.command = options.command
    this.cwd = options.cwd
    this.code = options.code
    this.signal = options.signal
    this.stdout = options.stdout
    this.stderr = options.stderr
  }
}

const printLine = (
  stream: "stdout" | "stderr",
  line: string,
  prefix?: string,
) => {
  const formattedPrefix = prefix ? `[${prefix}] ` : ""
  const output = `${formattedPrefix}${line}`
  if (stream === "stderr") {
    console.error(output)
  } else {
    console.log(output)
  }
}

const createStreamLogger = (
  stream: "stdout" | "stderr",
  prefix: string | undefined,
  enabled: boolean,
) => {
  let remainder = ""
  return {
    handle(chunk: Buffer | string) {
      if (!enabled) return
      const text = remainder + chunk.toString()
      const parts = text.split(/\r?\n/)
      remainder = parts.pop() ?? ""
      for (const part of parts) {
        if (part.length === 0) {
          printLine(stream, "", prefix)
        } else {
          printLine(stream, part, prefix)
        }
      }
    },
    flush() {
      if (!enabled || remainder.length === 0) return
      printLine(stream, remainder, prefix)
      remainder = ""
    },
  }
}

const readStream = async (
  stream: Readable | null,
  handler: ReturnType<typeof createStreamLogger>,
  sink: (chunk: string) => void,
) =>
  new Promise<void>((resolve) => {
    if (!stream) {
      resolve()
      return
    }
    stream.on("data", (chunk) => {
      const text = chunk.toString()
      sink(text)
      handler.handle(chunk)
    })
    stream.on("end", () => {
      handler.flush()
      resolve()
    })
    stream.on("close", () => {
      handler.flush()
      resolve()
    })
  })

export const formatCommand = (command: string[]) =>
  command
    .map((part) =>
      /\s/.test(part) ? `'${part.replaceAll("'", "'\\''")}'` : part,
    )
    .join(" ")

export const runCommand = async (
  command: string[],
  options: RunCommandOptions,
): Promise<CommandResult> => {
  const { cwd, env, prefix, dryRun, allowFailure } = options
  const envVars = { ...process.env, ...env }
  const commandLabel = formatCommand(command)
  const logContext = prefix ? `${prefix}` : undefined
  debug(`$ ${commandLabel}`, logContext)

  if (dryRun) {
    info(`(dry run) ${commandLabel}`, logContext)
    return { stdout: "", stderr: "", code: 0, signal: null }
  }

  const child = spawn(command[0]!, command.slice(1), {
    cwd,
    env: envVars,
    stdio: ["ignore", "pipe", "pipe"],
  })

  let stdout = ""
  let stderr = ""
  const stdoutLogger = createStreamLogger(
    "stdout",
    prefix,
    options.logStdout ?? true,
  )
  const stderrLogger = createStreamLogger(
    "stderr",
    prefix,
    options.logStderr ?? true,
  )

  await Promise.all([
    readStream(child.stdout, stdoutLogger, (chunk) => {
      stdout += chunk
    }),
    readStream(child.stderr, stderrLogger, (chunk) => {
      stderr += chunk
    }),
  ])

  const exit = await new Promise<{
    code: number
    signal: NodeJS.Signals | null
  }>((resolve, reject) => {
    child.on("error", (err) => {
      reject(err)
    })
    child.on("close", (code, signal) => {
      resolve({ code: code ?? 0, signal })
    })
  })

  if (exit.code !== 0 && !allowFailure) {
    throw new CommandError(
      `Command failed with exit code ${exit.code}: ${commandLabel}`,
      {
        command,
        cwd,
        code: exit.code,
        signal: exit.signal,
        stdout,
        stderr,
      },
    )
  }

  return {
    stdout,
    stderr,
    code: exit.code,
    signal: exit.signal,
  }
}
