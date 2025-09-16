import { existsSync } from "node:fs"
import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"

import { DEFAULT_REF } from "./config"
import { runCommand } from "./utils/run-command"

export async function cloneOrUpdateRepo(
  repo: string,
  destination: string,
  ref: string = DEFAULT_REF,
) {
  const parent = dirname(destination)
  await mkdir(parent, { recursive: true })

  if (!existsSync(destination)) {
    console.log(`Cloning ${repo} -> ${destination} (${ref})`)
    await runCommand([
      "git",
      "clone",
      "--depth",
      "1",
      "--branch",
      ref,
      repo,
      destination,
    ])
  } else {
    console.log(`Updating ${destination} (${ref})`)
    await runCommand(["git", "-C", destination, "fetch", "origin", ref])
    await runCommand([
      "git",
      "-C",
      destination,
      "reset",
      "--hard",
      `origin/${ref}`,
    ])
    await runCommand(["git", "-C", destination, "clean", "-fd"])
  }
}

export async function getCurrentCommit(directory: string): Promise<string> {
  const { stdout } = await runCommand(
    ["git", "-C", directory, "rev-parse", "HEAD"],
    { captureOutput: true },
  )

  if (!stdout) {
    throw new Error(`Failed to read commit for ${directory}`)
  }

  return stdout.trim()
}
