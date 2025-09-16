import { logInfo, logWarn } from "./logger"
import { runCommand } from "./run-command"
import type { PackageBuildResult, PackageConfig, PackageJson } from "./types"

export async function linkLocalDependencies(
  packageDir: string,
  packageJson: PackageJson,
  builtPackages: Map<string, PackageBuildResult>,
): Promise<string[]> {
  const dependencyMaps = [
    packageJson.dependencies,
    packageJson.devDependencies,
    packageJson.peerDependencies,
    packageJson.optionalDependencies,
  ]

  const required = new Set<string>()
  for (const [name] of builtPackages) {
    if (dependencyMaps.some((deps) => deps && name in deps)) {
      required.add(name)
    }
  }

  const linked: string[] = []
  for (const name of required) {
    logInfo(`Linking local dependency ${name} with yalc`)
    await runCommand("bunx", ["yalc", "add", name], { cwd: packageDir })
    linked.push(name)
  }

  return linked
}

export async function publishWithYalc(
  packageDir: string,
  pkg: PackageConfig,
  options: { env?: Record<string, string>; skip?: boolean } = {},
): Promise<boolean> {
  if (pkg.skipPublish) {
    logWarn(`Skipping yalc publish for ${pkg.name} (package configuration)`)
    return false
  }
  if (options.skip) {
    logWarn(`Skipping yalc publish for ${pkg.name} (explicit skip)`)
    return false
  }
  const command = pkg.publishCommand ?? ["bunx", "yalc", "publish"]
  logInfo(`Publishing ${pkg.name} to local yalc store`)
  await runCommand(command[0]!, command.slice(1), {
    cwd: packageDir,
    env: options.env,
  })
  return true
}
