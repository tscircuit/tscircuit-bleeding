import { writeFile } from "node:fs/promises"
import path from "node:path"
import { ensureDir, moveFile } from "./fs-utils"
import { logInfo, logSuccess, logTask, logWarn, separator } from "./logger"
import { readPackageJson } from "./package-json"
import { checkoutRepository, type CheckoutContext } from "./repo"
import { runCommand } from "./run-command"
import type {
  BuildGroup,
  BuildGroupResult,
  BuildReport,
  BuildSystemOptions,
  PackageBuildResult,
  PackageConfig,
  PackConfig,
  RepositoryCheckout,
} from "./types"
import { linkLocalDependencies, publishWithYalc } from "./yalc"

interface BuildContext {
  workspaceRoot: string
  artifactsRoot: string
  reposRoot: string
  options: BuildSystemOptions
  builtPackages: Map<string, PackageBuildResult>
  checkoutCache: Map<string, RepositoryCheckout>
}

export const DEFAULT_WORKSPACE_DIR = ".tscircuit-workspace"
export const REPOS_DIR_NAME = "repos"
export const ARTIFACTS_DIR_NAME = "artifacts"

export async function runBuildSystem(
  groups: BuildGroup[],
  options: BuildSystemOptions = {},
): Promise<BuildReport> {
  const workspaceRoot =
    options.workspaceRoot ?? path.join(process.cwd(), DEFAULT_WORKSPACE_DIR)
  const artifactsRoot =
    options.artifactsRoot ?? path.join(workspaceRoot, ARTIFACTS_DIR_NAME)
  const reposRoot = path.join(workspaceRoot, REPOS_DIR_NAME)

  await Promise.all([
    ensureDir(workspaceRoot),
    ensureDir(artifactsRoot),
    ensureDir(reposRoot),
  ])

  logInfo(`Workspace root: ${workspaceRoot}`)
  logInfo(`Artifacts directory: ${artifactsRoot}`)
  logInfo(`Repositories cache: ${reposRoot}`)

  const context: BuildContext = {
    workspaceRoot,
    artifactsRoot,
    reposRoot,
    options,
    builtPackages: new Map(),
    checkoutCache: new Map(),
  }

  const checkoutContext: CheckoutContext = {
    reposRoot,
    checkoutCache: context.checkoutCache,
  }

  const groupResults: BuildGroupResult[] = []

  for (const group of groups) {
    separator()
    logTask(`Starting group: ${group.name}`)

    const results = await Promise.all(
      group.packages.map((pkg) => buildPackage(pkg, context, checkoutContext)),
    )

    for (const result of results) {
      context.builtPackages.set(result.packageJson.name, result)
    }

    groupResults.push({ group, results })
    logSuccess(`Completed group: ${group.name}`)
  }

  const report: BuildReport = {
    generatedAt: new Date().toISOString(),
    workspaceRoot,
    artifactsRoot,
    groups: groupResults,
  }

  const reportPath = path.join(artifactsRoot, "build-report.json")
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8")
  logSuccess(`Wrote build report to ${reportPath}`)

  separator()
  logSuccess("Build pipeline finished successfully.")

  return report
}

async function buildPackage(
  pkg: PackageConfig,
  context: BuildContext,
  checkoutContext: CheckoutContext,
): Promise<PackageBuildResult> {
  logTask(`Building package ${pkg.name}`)
  const start = performance.now()

  const repository = await checkoutRepository(pkg, checkoutContext)
  const packageDir = pkg.packageDir
    ? path.join(repository.dir, pkg.packageDir)
    : repository.dir

  const packageJson = await readPackageJson(packageDir)

  let linkedDependencies: string[] = []
  if (context.options.dryRun) {
    if (context.builtPackages.size > 0) {
      logWarn(`Skipping yalc linking for ${pkg.name} (dry-run)`)
    }
  } else {
    linkedDependencies = await linkLocalDependencies(
      packageDir,
      packageJson,
      context.builtPackages,
    )
  }

  const env = { HUSKY: "0", CI: "1", ...pkg.env } satisfies Record<
    string,
    string
  >

  const durations: PackageBuildResult["durations"] = { totalMs: 0 }

  if (pkg.skipInstall) {
    logInfo(`Skipping install for ${pkg.name} (package configuration)`)
  } else if (context.options.dryRun) {
    logWarn(`Skipping install for ${pkg.name} (dry-run)`)
  } else {
    durations.installMs = await runStep(() => runInstall(pkg, packageDir, env))
  }

  if (pkg.skipBuild) {
    logInfo(`Skipping build for ${pkg.name} (package configuration)`)
  } else if (context.options.dryRun) {
    logWarn(`Skipping build for ${pkg.name} (dry-run)`)
  } else {
    durations.buildMs = await runStep(() => runBuild(pkg, packageDir, env))
  }

  const yalcPublished = await runPublish(pkg, packageDir, env, context.options)

  const packResult = await runPack(pkg, packageDir, packageJson, context, env)

  durations.totalMs = performance.now() - start

  return {
    config: pkg,
    packageJson,
    repository,
    packageDir,
    linkedDependencies,
    yalcPublished,
    durations,
    packResult,
  }
}

async function runInstall(
  pkg: PackageConfig,
  packageDir: string,
  env: Record<string, string>,
): Promise<void> {
  const command = pkg.installCommand ?? ["bun", "install"]
  if (!command.length) {
    throw new Error(`Install command for ${pkg.name} is empty`)
  }
  logInfo(`Installing dependencies for ${pkg.name}`)
  await runCommand(command[0]!, command.slice(1), { cwd: packageDir, env })
}

async function runBuild(
  pkg: PackageConfig,
  packageDir: string,
  env: Record<string, string>,
): Promise<void> {
  await executeCommands(
    pkg.preBuildCommands,
    packageDir,
    env,
    `pre-build for ${pkg.name}`,
  )

  const command = pkg.buildCommand ?? ["bun", "run", "build"]
  if (!command.length) {
    throw new Error(`Build command for ${pkg.name} is empty`)
  }
  logInfo(`Running build for ${pkg.name}`)
  await runCommand(command[0]!, command.slice(1), { cwd: packageDir, env })

  await executeCommands(
    pkg.postBuildCommands,
    packageDir,
    env,
    `post-build for ${pkg.name}`,
  )
}

async function executeCommands(
  commands: string[][] | undefined,
  packageDir: string,
  env: Record<string, string>,
  label: string,
): Promise<void> {
  if (!commands) {
    return
  }
  for (const command of commands) {
    if (!command.length) {
      continue
    }
    logInfo(`Running ${label} command: ${command.join(" ")}`)
    await runCommand(command[0]!, command.slice(1), { cwd: packageDir, env })
  }
}

async function runPublish(
  pkg: PackageConfig,
  packageDir: string,
  env: Record<string, string>,
  options: BuildSystemOptions,
): Promise<boolean> {
  if (options.skipPublish) {
    logWarn(`Skipping yalc publish for ${pkg.name} (global skip)`)
    return false
  }
  if (options.dryRun) {
    logWarn(`Skipping yalc publish for ${pkg.name} (dry-run)`)
    return false
  }
  return publishWithYalc(packageDir, pkg, { env, skip: options.skipPublish })
}

async function runPack(
  pkg: PackageConfig,
  packageDir: string,
  packageJson: { name: string; version?: string },
  context: BuildContext,
  env: Record<string, string>,
): Promise<PackageBuildResult["packResult"]> {
  if (!pkg.pack) {
    return undefined
  }
  if (context.options.dryRun) {
    logWarn(`Skipping pack step for ${pkg.name} (dry-run)`)
    return undefined
  }

  const command = pkg.pack.command
  if (!command.length) {
    throw new Error(`Pack command for ${pkg.name} is empty`)
  }

  logInfo(`Packaging ${pkg.name}`)
  const { stdout } = await runCommand(command[0]!, command.slice(1), {
    cwd: packageDir,
    stdout: "pipe",
    env,
  })
  const outputLines =
    stdout
      ?.split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean) ?? []
  if (!outputLines.length) {
    throw new Error(`Pack command for ${pkg.name} did not produce any output`)
  }
  const artifactLine = findPackArtifactLine(outputLines)
  if (!artifactLine) {
    throw new Error(
      `Unable to locate artifact path in pack output for ${pkg.name}`,
    )
  }
  const artifactSource = resolvePackSource(artifactLine, packageDir)
  const destinationDir = pkg.pack.destinationDir ?? context.artifactsRoot
  await ensureDir(destinationDir)
  const destinationName = resolveArtifactName(
    pkg.pack,
    packageJson,
    artifactSource,
  )
  const destinationPath = path.join(destinationDir, destinationName)

  await moveFile(artifactSource, destinationPath)
  logSuccess(`Created artifact for ${pkg.name}: ${destinationPath}`)

  return {
    artifactPath: destinationPath,
    originalPath: artifactSource,
    command,
  }
}

function findPackArtifactLine(lines: string[]): string | undefined {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]
    if (!line) {
      continue
    }
    if (/\.(?:tgz|tar\.gz)$/i.test(line)) {
      return line
    }
  }
  return lines.at(-1)
}

function resolvePackSource(outputLine: string, packageDir: string): string {
  if (path.isAbsolute(outputLine)) {
    return outputLine
  }
  return path.join(packageDir, outputLine)
}

function resolveArtifactName(
  pack: PackConfig,
  packageJson: { name: string; version?: string },
  source: string,
): string {
  if (pack.artifactName) {
    return pack.artifactName
      .replace(/%name%/g, sanitizeForFile(packageJson.name))
      .replace(/%version%/g, packageJson.version ?? "0.0.0")
      .replace(/%timestamp%/g, createTimestamp())
  }
  return path.basename(source)
}

function sanitizeForFile(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-")
}

function createTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-")
}

async function runStep(step: () => Promise<unknown>): Promise<number> {
  const start = performance.now()
  await step()
  return performance.now() - start
}
