import path from "node:path"
import { ensureDir, pathExists } from "./fs-utils"
import { logInfo } from "./logger"
import { runCommand } from "./run-command"
import type { PackageConfig, RepositoryCheckout } from "./types"

export interface CheckoutContext {
  reposRoot: string
  checkoutCache: Map<string, RepositoryCheckout>
}

export async function checkoutRepository(
  pkg: PackageConfig,
  context: CheckoutContext,
): Promise<RepositoryCheckout> {
  const branch = pkg.repository.branch ?? "main"
  const checkoutKey = pkg.checkoutKey ?? `${pkg.repository.url}#${branch}`

  const existing = context.checkoutCache.get(checkoutKey)
  if (existing) {
    return existing
  }

  await ensureDir(context.reposRoot)

  const checkoutDirName =
    pkg.repository.checkoutDir ?? slugifyRepositoryUrl(pkg.repository.url)
  const repoDir = path.join(context.reposRoot, checkoutDirName)

  if (!(await pathExists(repoDir))) {
    logInfo(`Cloning ${pkg.repository.url} into ${repoDir}`)
    const cloneArgs = [
      "clone",
      "--depth",
      "1",
      "--branch",
      branch,
      pkg.repository.url,
      repoDir,
    ]
    await runCommand("git", cloneArgs)
  } else {
    logInfo(`Updating ${repoDir}`)
    await runCommand("git", ["fetch"], { cwd: repoDir })
    await runCommand("git", ["checkout", branch], { cwd: repoDir })
    await runCommand("git", ["reset", "--hard", `origin/${branch}`], {
      cwd: repoDir,
    })
    await runCommand("git", ["clean", "-fdx"], { cwd: repoDir })
  }

  const revisionResult = await runCommand("git", ["rev-parse", "HEAD"], {
    cwd: repoDir,
    stdout: "pipe",
  })
  const commit = revisionResult.stdout?.trim() ?? ""

  const checkout: RepositoryCheckout = {
    url: pkg.repository.url,
    dir: repoDir,
    branch,
    commit,
  }

  context.checkoutCache.set(checkoutKey, checkout)
  return checkout
}

function slugifyRepositoryUrl(repoUrl: string): string {
  let normalized = repoUrl.replace(/\.git$/, "")
  if (normalized.includes("@")) {
    normalized = normalized.replace(/^git@/, "").replace(/:/, "/")
  }
  normalized = normalized.replace(/^https?:\/\//, "")
  return normalized.replace(/[^a-zA-Z0-9]+/g, "-")
}
