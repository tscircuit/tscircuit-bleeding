type LogLevel = "info" | "warn" | "error" | "debug"

const LEVEL_TAG: Record<LogLevel, string> = {
  info: "INFO",
  warn: "WARN",
  error: "ERR",
  debug: "DBG",
}

const LEVEL_COLOR: Record<LogLevel, string> = {
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
  debug: "\x1b[90m",
}

const RESET = "\x1b[0m"

const formatTimestamp = () => new Date().toISOString()

const colorize = (level: LogLevel, text: string) =>
  `${LEVEL_COLOR[level]}${text}${RESET}`

const formatContext = (context?: string) => (context ? ` ${context}` : "")

export const log = (level: LogLevel, message: string, context?: string) => {
  const timestamp = formatTimestamp()
  const tag = LEVEL_TAG[level]
  const line = `[${timestamp}] ${colorize(level, tag)}${formatContext(context)} ${message}`
  if (level === "error") {
    console.error(line)
  } else if (level === "warn") {
    console.warn(line)
  } else {
    console.log(line)
  }
}

export const info = (message: string, context?: string) =>
  log("info", message, context)
export const warn = (message: string, context?: string) =>
  log("warn", message, context)
export const error = (message: string, context?: string) =>
  log("error", message, context)
export const debug = (message: string, context?: string) =>
  log("debug", message, context)

export const createLogger = (context: string) => ({
  info: (message: string) => info(message, context),
  warn: (message: string) => warn(message, context),
  error: (message: string) => error(message, context),
  debug: (message: string) => debug(message, context),
})
