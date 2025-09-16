import { stat, mkdir, writeFile, rename } from "node:fs/promises"
import { basename, isAbsolute, join, relative } from "node:path"

import { DIST_DIRECTORY, packageGroups, WORKSPACE_DIRECTORY } from "./config"
import type { PackageConfig } from "./config"
import { cloneOrUpdateRepo, getCurrentCommit } from "./git"
import { runCommand } from "./utils/run-command"

interface BuiltPackage {
  config: PackageConfig
  repoDirectory: string
  packageDirectory: string
  commit: string
  tarballPath?: string
}

export interface BuildOptions {
  workspaceRoot?: string
  distDirectory?: string
}

export interface BuildResult {
  tarballPath: string
  manifestPath: string
  packages: BuiltPackage[]
}

const DEFAULT_INSTALL_COMMAND = ["bun", "install"]
const DEFAULT_BUILD_COMMAND = ["bun", "run", "build"]
const DEFAULT_ENV = { CI: "1" }

function slugifyPackageName(name: string) {
  return name.replace(/[^a-zA-Z0-9.-]+/g, "-").replace(/^-+|-+$/g, "")
}

function resolvePackageDirectory(workspaceRoot: string, config: PackageConfig) {
  const repoDirectory = join(workspaceRoot, slugifyPackageName(config.name))
  const packageDirectory = config.directory
    ? join(repoDirectory, config.directory)
    : repoDirectory
  return { repoDirectory, packageDirectory }
}

async function processDependency(
  config: PackageConfig,
  workspaceRoot: string,
): Promise<BuiltPackage> {
  const { repoDirectory, packageDirectory } = resolvePackageDirectory(
    workspaceRoot,
    config,
  )

  await cloneOrUpdateRepo(config.repo, repoDirectory, config.ref)

  const installCommand = config.installCommand ?? DEFAULT_INSTALL_COMMAND
  const buildCommand = config.buildCommand ?? DEFAULT_BUILD_COMMAND

  if (!config.skipInstall && installCommand) {
    await runCommand(installCommand, {
      cwd: packageDirectory,
      env: DEFAULT_ENV,
      description: `Installing dependencies for ${config.name}`,
    })
  }

  if (!config.skipBuild && buildCommand) {
    await runCommand(buildCommand, {
      cwd: packageDirectory,
      env: DEFAULT_ENV,
      description: `Building ${config.name}`,
    })
  }

  const shouldLink = config.link ?? true
  if (shouldLink) {
    await runCommand(["bun", "link"], {
      cwd: packageDirectory,
      env: DEFAULT_ENV,
      description: `Linking ${config.name}`,
    })
  }

  const commit = await getCurrentCommit(repoDirectory)

  return {
    config,
    repoDirectory,
    packageDirectory,
    commit,
  }
}

async function linkDependencies(
  targetDirectory: string,
  dependencies: BuiltPackage[],
) {
  for (const dependency of dependencies) {
    const shouldLink = dependency.config.link ?? true
    if (!shouldLink) continue

    await runCommand(["bun", "link", dependency.config.name], {
      cwd: targetDirectory,
      env: DEFAULT_ENV,
      description: `Linking dependency ${dependency.config.name}`,
    })
  }
}

function formatTimestamp(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0")
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join("-")
}

async function createTarball(
  packageDirectory: string,
  distDirectory: string,
  prefix = "tscircuit-bleeding",
) {
  await mkdir(distDirectory, { recursive: true })

  const { stdout } = await runCommand(
    ["npm", "pack", "--json", "--pack-destination", distDirectory],
    {
      cwd: packageDirectory,
      captureOutput: true,
      description: `Packing ${basename(packageDirectory)}`,
    },
  )

  if (!stdout) {
    throw new Error("npm pack did not return output")
  }

  const trimmed = stdout.trim()
  const parsed = JSON.parse(trimmed)
  const packEntries = Array.isArray(parsed) ? parsed : [parsed]
  if (packEntries.length === 0 || !packEntries[0].filename) {
    throw new Error(`Unexpected npm pack response: ${trimmed}`)
  }

  const [firstEntry] = packEntries
  const originalTarballPath = join(distDirectory, firstEntry.filename)
  const timestamp = formatTimestamp(new Date())
  const newFilename = `${prefix}-${timestamp}.tgz`
  const newTarballPath = join(distDirectory, newFilename)

  await rename(originalTarballPath, newTarballPath)

  return newTarballPath
}

async function writeManifest(
  packages: BuiltPackage[],
  tarballPath: string,
  distDirectory: string,
) {
  const tarballStats = await stat(tarballPath)
  const manifest = {
    generatedAt: new Date().toISOString(),
    tarball: {
      filename: basename(tarballPath),
      relativePath: relative(distDirectory, tarballPath),
      size: tarballStats.size,
    },
    packages: packages.map((pkg) => {
      const entry: Record<string, string> = {
        name: pkg.config.name,
        repo: pkg.config.repo,
        ref: pkg.config.ref ?? "main",
        commit: pkg.commit,
        workspacePath: relative(process.cwd(), pkg.packageDirectory),
      }

      if (pkg.tarballPath) {
        entry.tarball = basename(pkg.tarballPath)
      }

      return entry
    }),
  }

  const manifestPath = join(distDirectory, "build-manifest.json")
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2))
  return manifestPath
}

export async function buildBleeding(
  options: BuildOptions = {},
): Promise<BuildResult> {
  const workspaceRoot = options.workspaceRoot
    ? isAbsolute(options.workspaceRoot)
      ? options.workspaceRoot
      : join(process.cwd(), options.workspaceRoot)
    : join(process.cwd(), WORKSPACE_DIRECTORY)
  const distDirectory = options.distDirectory
    ? isAbsolute(options.distDirectory)
      ? options.distDirectory
      : join(process.cwd(), options.distDirectory)
    : join(process.cwd(), DIST_DIRECTORY)

  await mkdir(workspaceRoot, { recursive: true })
  await mkdir(distDirectory, { recursive: true })

  const groups = [...packageGroups]
  if (groups.length === 0) {
    throw new Error("No package groups configured")
  }

  const finalGroup = groups.pop()
  if (!finalGroup) {
    throw new Error("Missing final package group")
  }

  const builtPackages: BuiltPackage[] = []

  for (const group of groups) {
    console.log(`\n=== Building ${group.name} ===`)
    const results = await Promise.all(
      group.packages.map((pkg) => processDependency(pkg, workspaceRoot)),
    )
    builtPackages.push(...results)
  }

  console.log(`\n=== Building ${finalGroup.name} ===`)

  const finalPackages: BuiltPackage[] = []

  for (const pkg of finalGroup.packages) {
    const { repoDirectory, packageDirectory } = resolvePackageDirectory(
      workspaceRoot,
      pkg,
    )

    await cloneOrUpdateRepo(pkg.repo, repoDirectory, pkg.ref)

    const installCommand = pkg.installCommand ?? DEFAULT_INSTALL_COMMAND
    if (!pkg.skipInstall && installCommand) {
      await runCommand(installCommand, {
        cwd: packageDirectory,
        env: DEFAULT_ENV,
        description: `Installing dependencies for ${pkg.name}`,
      })
    }

    await linkDependencies(packageDirectory, builtPackages)

    const buildCommand = pkg.buildCommand ?? DEFAULT_BUILD_COMMAND
    if (!pkg.skipBuild && buildCommand) {
      await runCommand(buildCommand, {
        cwd: packageDirectory,
        env: DEFAULT_ENV,
        description: `Building ${pkg.name}`,
      })
    }

    const commit = await getCurrentCommit(repoDirectory)
    const tarballPath = await createTarball(packageDirectory, distDirectory)

    const builtPackage: BuiltPackage = {
      config: pkg,
      repoDirectory,
      packageDirectory,
      commit,
      tarballPath,
    }

    finalPackages.push(builtPackage)
    builtPackages.push(builtPackage)
  }

  const primaryTarball = finalPackages[0]?.tarballPath
  if (!primaryTarball) {
    throw new Error("No tarball produced")
  }

  const manifestPath = await writeManifest(
    builtPackages,
    primaryTarball,
    distDirectory,
  )

  return {
    tarballPath: primaryTarball,
    manifestPath,
    packages: builtPackages,
  }
}
