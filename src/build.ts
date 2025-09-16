import { join } from "node:path"
import { readFile, writeFile } from "node:fs/promises"
import { packageGroups } from "./config"
import {
  type BuildOptions,
  type BuildExecutionResult,
  type BuildSummary,
  type PackageBuildResult,
  type PackageConfig,
  type PackageJson,
  type PackageGroup,
} from "./types"
import {
  artifactsRoot,
  buildRoot,
  manifestsRoot,
  relativeToWorkspace,
  reposRoot,
  yalcStoreDir,
} from "./paths"
import { ensureDir, pathExists } from "./utils/fs"
import { createLogger, info, warn } from "./utils/logger"
import { ensureRepo, getCurrentCommit, repositoryPath } from "./git"
import { runCommand } from "./utils/shell"

const packageLogger = (pkg: PackageConfig) => createLogger(pkg.name)

const slugify = (name: string) => name.replace(/^@/, "").replace(/[\/]/g, "-")

const readPackageJson = async (dir: string): Promise<PackageJson | null> => {
  const filePath = join(dir, "package.json")
  if (!(await pathExists(filePath))) return null

  const contents = await readFile(filePath, "utf8")
  try {
    return JSON.parse(contents) as PackageJson
  } catch (error) {
    warn(`Failed to parse package.json at ${filePath}: ${String(error)}`)
    return null
  }
}

const dependencyFields: (keyof PackageJson)[] = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
]

const resolveYalcDependencies = (
  pkg: PackageConfig,
  packageJson: PackageJson | null,
  builtPackages: Set<string>,
) => {
  const names = new Set<string>()
  if (pkg.extraYalcDependencies) {
    for (const name of pkg.extraYalcDependencies) names.add(name)
  }
  if (!packageJson) return [...names]
  for (const field of dependencyFields) {
    const deps = packageJson[field]
    if (!deps) continue
    for (const depName of Object.keys(deps)) {
      if (builtPackages.has(depName)) {
        names.add(depName)
      }
    }
  }
  names.delete(pkg.name)
  return [...names]
}

const defaultInstall = ["bun", "install"]
const defaultBuild = ["bun", "run", "build"]
const defaultPublish = ["bunx", "yalc", "publish"]
const defaultPack = ["bunx", "npm", "pack"]

const mergeEnvs = (
  base: NodeJS.ProcessEnv,
  extra?: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv => ({
  ...base,
  ...extra,
})

const ensureWorkspaceDirs = async () => {
  await ensureDir(buildRoot)
  await ensureDir(reposRoot)
  await ensureDir(yalcStoreDir)
  await ensureDir(artifactsRoot)
  await ensureDir(manifestsRoot)
}

const runCommandsSequentially = async (
  commands: string[][] | undefined,
  options: {
    cwd: string
    prefix: string
    env: NodeJS.ProcessEnv
    dryRun?: boolean
  },
) => {
  if (!commands) return
  for (const command of commands) {
    await runCommand(command, {
      cwd: options.cwd,
      prefix: options.prefix,
      env: options.env,
      dryRun: options.dryRun,
    })
  }
}

const buildSinglePackage = async (
  pkg: PackageConfig,
  options: BuildOptions,
  builtPackages: Set<string>,
): Promise<PackageBuildResult> => {
  const logger = packageLogger(pkg)
  const slug = slugify(pkg.name)
  const repoDir = repositoryPath(slug)
  const workingDir = pkg.packageDir ? join(repoDir, pkg.packageDir) : repoDir
  const env = mergeEnvs(process.env, {
    YALC_HOME: yalcStoreDir,
    YALC_STORE_DIR: yalcStoreDir,
  })

  logger.info(`Ensuring repository at ${repoDir}`)
  await ensureRepo({
    repo: pkg.repo,
    targetDir: repoDir,
    ref: pkg.ref,
    skipUpdate: options.skipGitUpdate,
    skipClean: options.skipGitClean,
    dryRun: options.dryRun,
    prefix: pkg.name,
  })

  const packageJson =
    options.dryRun && !(await pathExists(join(workingDir, "package.json")))
      ? null
      : await readPackageJson(workingDir)

  const yalcDeps = resolveYalcDependencies(pkg, packageJson, builtPackages)
  if (yalcDeps.length > 0) {
    logger.info(`Linking ${yalcDeps.length} local dependencies via yalc`)
    for (const dep of yalcDeps) {
      await runCommand(["bunx", "yalc", "add", dep], {
        cwd: workingDir,
        env,
        prefix: pkg.name,
        dryRun: options.dryRun,
      })
    }
  }

  if (!(options.skipInstall || pkg.skipInstall)) {
    const installCommand = pkg.installCommand ?? defaultInstall
    logger.info(`Installing dependencies (${installCommand.join(" ")})`)
    await runCommand(installCommand, {
      cwd: workingDir,
      env,
      prefix: pkg.name,
      dryRun: options.dryRun,
    })
  } else {
    logger.info("Skipping dependency installation")
  }

  await runCommandsSequentially(pkg.preBuildCommands, {
    cwd: workingDir,
    prefix: pkg.name,
    env,
    dryRun: options.dryRun,
  })

  if (!(options.skipBuild || pkg.skipBuild)) {
    const buildCommand = pkg.buildCommand ?? defaultBuild
    logger.info(`Running build (${buildCommand.join(" ")})`)
    await runCommand(buildCommand, {
      cwd: workingDir,
      env,
      prefix: pkg.name,
      dryRun: options.dryRun,
    })
  } else {
    logger.info("Skipping build step")
  }

  await runCommandsSequentially(pkg.postBuildCommands, {
    cwd: workingDir,
    prefix: pkg.name,
    env,
    dryRun: options.dryRun,
  })

  let yalcPublished = false
  if (!pkg.skipPublish && !options.skipPublish) {
    const publishCommand = pkg.publishCommand ?? defaultPublish
    logger.info(`Publishing to local yalc store (${publishCommand.join(" ")})`)
    await runCommand(publishCommand, {
      cwd: workingDir,
      env,
      prefix: pkg.name,
      dryRun: options.dryRun,
    })
    yalcPublished = true
  } else {
    logger.info("Skipping yalc publish step")
  }

  let packedTarball: string | undefined
  if (pkg.packAfterBuild && !options.skipPack) {
    const destination = pkg.packDestination
      ? join(artifactsRoot, pkg.packDestination)
      : artifactsRoot
    await ensureDir(destination)
    const packCommand = pkg.packCommand ?? defaultPack
    const command = packCommand.includes("--pack-destination")
      ? packCommand
      : [...packCommand, "--pack-destination", destination]
    logger.info(`Packing tarball (${command.join(" ")})`)
    const result = await runCommand(command, {
      cwd: workingDir,
      env,
      prefix: pkg.name,
      dryRun: options.dryRun,
    })
    const outputLines = result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    const lastLine = outputLines.at(-1)
    if (lastLine) {
      const fileName = lastLine.split(/[/\\]/).pop() ?? lastLine
      packedTarball = join(destination, fileName)
    }
  } else if (pkg.packAfterBuild) {
    logger.info("Skipping package tarball due to --skip-pack flag")
  }

  let commit: string | null = null
  if (!options.dryRun) {
    try {
      commit = await getCurrentCommit(repoDir)
    } catch (error) {
      logger.warn(`Failed to determine commit hash: ${String(error)}`)
    }
  }

  return {
    config: pkg,
    repoDir,
    workingDir,
    packageJson,
    commit,
    yalcPublished,
    packedTarball: packedTarball
      ? relativeToWorkspace(packedTarball)
      : undefined,
  }
}

const shouldBuildPackage = (pkg: PackageConfig, options: BuildOptions) => {
  if (!options.onlyPackages || options.onlyPackages.length === 0) return true
  return options.onlyPackages.some(
    (name) => name === pkg.name || name === slugify(pkg.name),
  )
}

const buildGroup = async (
  group: PackageGroup,
  options: BuildOptions,
  builtPackages: Set<string>,
  results: PackageBuildResult[],
) => {
  const packages = group.packages.filter((pkg) =>
    shouldBuildPackage(pkg, options),
  )
  if (packages.length === 0) return

  info(
    `Building ${group.name} (${packages.length} package${packages.length === 1 ? "" : "s"})`,
  )
  const groupResults = await Promise.all(
    packages.map((pkg) => buildSinglePackage(pkg, options, builtPackages)),
  )

  for (const result of groupResults) {
    results.push(result)
    builtPackages.add(result.config.name)
  }
}

export const buildAll = async (
  options: BuildOptions,
): Promise<BuildExecutionResult> => {
  await ensureWorkspaceDirs()
  const builtPackages = new Set<string>()
  const results: PackageBuildResult[] = []

  for (const group of packageGroups) {
    await buildGroup(group, options, builtPackages, results)
  }

  const summary: BuildSummary = {
    builtAt: new Date().toISOString(),
    options,
    results: results.map((result) => ({
      ...result,
      repoDir: relativeToWorkspace(result.repoDir),
      workingDir: relativeToWorkspace(result.workingDir),
    })),
  }

  let manifestPath: string | undefined
  let latestPath: string | undefined

  if (!options.dryRun) {
    const summaryJson = JSON.stringify(summary, null, 2)
    const timestamp = summary.builtAt.replace(/[:.]/g, "-")
    manifestPath = join(manifestsRoot, `build-${timestamp}.json`)
    latestPath = join(manifestsRoot, "latest.json")
    await writeFile(manifestPath, summaryJson, "utf8")
    await writeFile(latestPath, summaryJson, "utf8")
  }

  return {
    summary,
    manifestPath: manifestPath ? relativeToWorkspace(manifestPath) : undefined,
    latestManifestPath: latestPath
      ? relativeToWorkspace(latestPath)
      : undefined,
  }
}

export const listPlan = (options: BuildOptions) => {
  const lines: string[] = []
  lines.push("Build plan:")
  for (const group of packageGroups) {
    const packages = group.packages.filter((pkg) =>
      shouldBuildPackage(pkg, options),
    )
    if (packages.length === 0) continue
    lines.push(
      `- ${group.name}${group.description ? `: ${group.description}` : ""}`,
    )
    for (const pkg of packages) {
      lines.push(`  • ${pkg.name} (${pkg.repo}${pkg.ref ? `#${pkg.ref}` : ""})`)
    }
  }
  if (lines.length === 1) {
    lines.push("(no packages selected)")
  }
  return lines.join("\n")
}
