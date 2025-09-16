#!/usr/bin/env bun
import { rm } from "node:fs/promises"
import {
  artifactsRoot,
  buildRoot,
  yalcStoreDir,
  reposRoot,
  manifestsRoot,
} from "./paths"
import { buildAll, listPlan } from "./build"
import type { BuildOptions } from "./types"
import { CommandError } from "./utils/shell"
import { info, error, warn } from "./utils/logger"
import { pathExists } from "./utils/fs"

const usage = `Usage: bun src/index.ts [command] [options]

Commands:
  build           Clone and build all packages (default)
  plan            Print the build plan
  clean           Remove build artifacts
  help            Show this message

Options (for build/plan):
  --only <names>          Comma separated package names or slugs to build
  --skip-install          Skip dependency installation
  --skip-build            Skip package build step
  --skip-publish          Skip publishing packages to the local yalc store
  --skip-pack             Skip creating the final tarball
  --skip-git              Skip fetching/updating git repositories
  --skip-git-clean        Skip git clean/reset before building
  --dry-run               Print commands without executing them
`

type ParsedFlags = Record<string, string | boolean>

const parseCommand = (args: string[]) => {
  if (args.length === 0) return { command: "build", rest: [] as string[] }
  const [first, ...rest] = args as [string, ...string[]]
  if (first.startsWith("--")) {
    return { command: "build", rest: args }
  }
  return { command: first, rest }
}

const parseFlags = (args: string[]) => {
  const flags: ParsedFlags = {}
  const unknown: string[] = []
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!
    if (!arg.startsWith("--")) {
      unknown.push(arg)
      continue
    }
    const eqIndex = arg.indexOf("=")
    if (eqIndex !== -1) {
      const name = arg.slice(2, eqIndex)
      const value = arg.slice(eqIndex + 1)
      flags[name] = value
      continue
    }
    const name = arg.slice(2)
    const next = args[i + 1]
    if (next && !next.startsWith("--")) {
      flags[name] = next
      i += 1
    } else {
      flags[name] = true
    }
  }
  return { flags, unknown }
}

const coerceBoolean = (value: string | boolean | undefined) => {
  if (value === undefined) return undefined
  if (typeof value === "boolean") return value
  const normalized = value.toLowerCase()
  if (["false", "0", "no", "off"].includes(normalized)) return false
  if (["true", "1", "yes", "on"].includes(normalized)) return true
  return value.length === 0 ? true : undefined
}

const parseOnly = (value: string | boolean | undefined) => {
  if (value === undefined) return undefined
  if (typeof value === "boolean") return []
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

const buildOptionsFromFlags = (flags: ParsedFlags): BuildOptions => {
  const only = parseOnly(flags.only)
  const skipGit =
    coerceBoolean(flags["skip-git"]) ?? coerceBoolean(flags["skip-git-update"])
  return {
    onlyPackages: only && only.length > 0 ? only : undefined,
    skipInstall: coerceBoolean(flags["skip-install"]) ?? false,
    skipBuild: coerceBoolean(flags["skip-build"]) ?? false,
    skipPublish: coerceBoolean(flags["skip-publish"]) ?? false,
    skipPack: coerceBoolean(flags["skip-pack"]) ?? false,
    skipGitUpdate: skipGit ?? false,
    skipGitClean: coerceBoolean(flags["skip-git-clean"]) ?? false,
    dryRun: coerceBoolean(flags["dry-run"]) ?? false,
  }
}

const ensureCleanTargets = async () => {
  const targets = [
    buildRoot,
    artifactsRoot,
    yalcStoreDir,
    reposRoot,
    manifestsRoot,
  ]
  let removed = false
  for (const target of targets) {
    if (await pathExists(target)) {
      await rm(target, { recursive: true, force: true })
      info(`Removed ${target}`)
      removed = true
    }
  }
  if (!removed) {
    info("No build artifacts found to remove.")
  }
}

const main = async () => {
  const { command, rest } = parseCommand(process.argv.slice(2))
  const { flags, unknown } = parseFlags(rest)

  if (unknown.length > 0) {
    warn(`Ignoring unexpected arguments: ${unknown.join(", ")}`)
  }

  if (command === "help" || flags.help) {
    console.log(usage)
    return
  }

  if (command === "clean") {
    await ensureCleanTargets()
    return
  }

  const options = buildOptionsFromFlags(flags)

  if (command === "plan") {
    console.log(listPlan(options))
    return
  }

  if (command !== "build") {
    console.log(usage)
    throw new Error(`Unknown command: ${command}`)
  }

  if (options.dryRun) {
    info("Running in dry-run mode; no changes will be made.")
  }

  const { summary, manifestPath, latestManifestPath } = await buildAll(options)
  const builtCount = summary.results.length
  info(
    `Completed build for ${builtCount} package${builtCount === 1 ? "" : "s"}.`,
  )
  if (manifestPath) {
    info(`Build manifest written to ${manifestPath}.`)
  }
  if (latestManifestPath) {
    info(`Latest manifest available at ${latestManifestPath}.`)
  }
  const tarballs = summary.results
    .map((result) => result.packedTarball)
    .filter((path): path is string => Boolean(path))
  if (tarballs.length > 0) {
    info(
      `Generated ${tarballs.length} tarball${tarballs.length === 1 ? "" : "s"}.`,
    )
    for (const tarball of tarballs) {
      info(` - ${tarball}`)
    }
  }
}

main().catch(async (err) => {
  if (err instanceof CommandError) {
    error(`Command failed in ${err.cwd}: ${err.message}`)
  } else {
    error(err instanceof Error ? err.message : String(err))
  }
  process.exitCode = 1
})
