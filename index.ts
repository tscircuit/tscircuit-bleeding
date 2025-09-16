#!/usr/bin/env bun
import path from "node:path"
import process from "node:process"
import { BUILD_GROUPS } from "./src/config"
import { runBuildSystem, DEFAULT_WORKSPACE_DIR } from "./src/build-system"
import { pathExists, removeDir } from "./src/fs-utils"
import {
  logError,
  logInfo,
  logSuccess,
  logTask,
  logWarn,
  separator,
} from "./src/logger"
import type { BuildGroup, BuildSystemOptions } from "./src/types"

interface CliOptions extends BuildSystemOptions {}

type CliCommand = "build" | "plan" | "clean"

async function main(): Promise<void> {
  const [, , ...rawArgs] = process.argv
  const { command, optionArgs } = extractCommand(rawArgs)
  let options: CliOptions
  try {
    options = parseOptions(optionArgs)
  } catch (error) {
    logError((error as Error).message)
    process.exit(1)
    return
  }

  switch (command) {
    case "plan":
      printPlan(BUILD_GROUPS)
      break
    case "clean":
      await cleanWorkspace(options)
      break
    case "build":
      await runBuild(options)
      break
    default:
      logError(`Unknown command: ${command}`)
      process.exit(1)
  }
}

function extractCommand(args: string[]): {
  command: CliCommand
  optionArgs: string[]
} {
  const possibleCommand =
    args[0] && !args[0].startsWith("--") ? (args[0] as CliCommand) : undefined
  const command = possibleCommand ?? "build"
  const optionArgs = possibleCommand ? args.slice(1) : args
  return { command, optionArgs }
}

function parseOptions(args: string[]): CliOptions {
  const options: CliOptions = {}
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === undefined) {
      continue
    }
    if (!arg.startsWith("--")) {
      logWarn(`Ignoring unexpected argument: ${arg}`)
      continue
    }
    const next = args[index + 1]
    switch (arg) {
      case "--workspace":
        if (!next || next.startsWith("--")) {
          throw new Error("--workspace flag requires a path argument")
        }
        options.workspaceRoot = path.resolve(process.cwd(), next)
        index += 1
        break
      case "--artifacts":
        if (!next || next.startsWith("--")) {
          throw new Error("--artifacts flag requires a path argument")
        }
        options.artifactsRoot = path.resolve(process.cwd(), next)
        index += 1
        break
      case "--dry-run":
        options.dryRun = true
        break
      case "--skip-publish":
        options.skipPublish = true
        break
      default:
        logWarn(`Unknown flag: ${arg}`)
    }
  }
  return options
}

function printPlan(groups: BuildGroup[]): void {
  separator()
  logTask("tscircuit bleeding build plan")
  groups.forEach((group, groupIndex) => {
    logInfo(`${groupIndex + 1}. ${group.name}`)
    group.packages.forEach((pkg) => {
      logInfo(`    • ${pkg.name} ← ${pkg.repository.url}`)
    })
  })
  separator()
}

async function cleanWorkspace(options: CliOptions): Promise<void> {
  const workspaceRoot =
    options.workspaceRoot ?? path.join(process.cwd(), DEFAULT_WORKSPACE_DIR)
  if (!(await pathExists(workspaceRoot))) {
    logInfo(`No workspace found at ${workspaceRoot}`)
    return
  }
  await removeDir(workspaceRoot)
  logSuccess(`Removed workspace at ${workspaceRoot}`)
}

async function runBuild(options: CliOptions): Promise<void> {
  if (options.dryRun) {
    logWarn("Running build in dry-run mode. No commands will be executed.")
  }
  await runBuildSystem(BUILD_GROUPS, options)
}

await main().catch((error) => {
  logError(error instanceof Error ? error.message : String(error))
  process.exit(1)
})

export {}
