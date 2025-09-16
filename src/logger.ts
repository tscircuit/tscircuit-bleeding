const enum Color {
  Reset = "\x1b[0m",
  Cyan = "\x1b[36m",
  Yellow = "\x1b[33m",
  Red = "\x1b[31m",
  Green = "\x1b[32m",
  Magenta = "\x1b[35m",
  Gray = "\x1b[90m",
}

const SYMBOLS = {
  info: "ℹ",
  warn: "⚠",
  error: "✖",
  success: "✔",
  task: "➤",
}

function colorize(color: Color, message: string): string {
  return `${color}${message}${Color.Reset}`
}

export function logInfo(message: string): void {
  console.log(`${colorize(Color.Cyan, SYMBOLS.info)} ${message}`)
}

export function logWarn(message: string): void {
  console.warn(`${colorize(Color.Yellow, SYMBOLS.warn)} ${message}`)
}

export function logError(message: string): void {
  console.error(`${colorize(Color.Red, SYMBOLS.error)} ${message}`)
}

export function logSuccess(message: string): void {
  console.log(`${colorize(Color.Green, SYMBOLS.success)} ${message}`)
}

export function logTask(message: string): void {
  console.log(`${colorize(Color.Magenta, SYMBOLS.task)} ${message}`)
}

export function logCommand(cwd: string | undefined, command: string[]): void {
  const location = cwd
    ? colorize(Color.Gray, `[${cwd}]`)
    : colorize(Color.Gray, `[.]`)
  const rendered = command
    .map((part) => (part.includes(" ") ? `"${part}"` : part))
    .join(" ")
  console.log(`${location} $ ${rendered}`)
}

export function separator(): void {
  console.log(colorize(Color.Gray, "----------------------------------------"))
}
