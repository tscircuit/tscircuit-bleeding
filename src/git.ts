import { dirname, join } from "node:path"
import { mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import { reposRoot } from "./paths"
import { runCommand } from "./utils/shell"
import type { RunCommandOptions } from "./utils/shell"

interface EnsureRepoOptions {
  repo: string
  targetDir: string
  ref?: string
  skipUpdate?: boolean
  skipClean?: boolean
  dryRun?: boolean
  prefix?: string
}

const ensureParentDir = async (targetDir: string) => {
  await mkdir(dirname(targetDir), { recursive: true })
}

const checkoutBranch = async (
  dir: string,
  branch: string,
  prefix: string | undefined,
  dryRun: boolean | undefined,
) => {
  await runCommand(["git", "fetch", "origin", branch], {
    cwd: dir,
    prefix,
    dryRun,
    allowFailure: true,
  })

  const remoteExists = await runCommand(
    ["git", "rev-parse", "--verify", `origin/${branch}`],
    {
      cwd: dir,
      prefix,
      dryRun,
      allowFailure: true,
      logStdout: false,
      logStderr: false,
    },
  )

  if (remoteExists.code === 0) {
    const localExists = await runCommand(
      ["git", "rev-parse", "--verify", branch],
      {
        cwd: dir,
        prefix,
        dryRun,
        allowFailure: true,
        logStdout: false,
        logStderr: false,
      },
    )

    if (localExists.code === 0) {
      await runCommand(["git", "checkout", branch], {
        cwd: dir,
        prefix,
        dryRun,
      })
    } else {
      await runCommand(["git", "checkout", "-B", branch, `origin/${branch}`], {
        cwd: dir,
        prefix,
        dryRun,
      })
    }

    await runCommand(["git", "reset", "--hard", `origin/${branch}`], {
      cwd: dir,
      prefix,
      dryRun,
    })

    return true
  }

  return false
}

const checkoutRef = async (
  dir: string,
  ref: string,
  prefix: string | undefined,
  dryRun: boolean | undefined,
) => {
  const remotes = [ref]
  for (const remote of remotes) {
    const branchCheckedOut = await checkoutBranch(dir, remote, prefix, dryRun)
    if (branchCheckedOut) return
  }

  await runCommand(["git", "fetch", "--tags"], {
    cwd: dir,
    prefix,
    dryRun,
  })

  const tagExists = await runCommand(
    ["git", "rev-parse", "--verify", `refs/tags/${ref}`],
    {
      cwd: dir,
      prefix,
      dryRun,
      allowFailure: true,
      logStdout: false,
      logStderr: false,
    },
  )

  if (tagExists.code === 0) {
    await runCommand(["git", "checkout", ref], {
      cwd: dir,
      prefix,
      dryRun,
    })
    await runCommand(["git", "reset", "--hard", ref], {
      cwd: dir,
      prefix,
      dryRun,
    })
    return
  }

  const commitExists = await runCommand(["git", "rev-parse", "--verify", ref], {
    cwd: dir,
    prefix,
    dryRun,
    allowFailure: true,
    logStdout: false,
    logStderr: false,
  })

  if (commitExists.code === 0) {
    await runCommand(["git", "checkout", ref], {
      cwd: dir,
      prefix,
      dryRun,
    })
    await runCommand(["git", "reset", "--hard", ref], {
      cwd: dir,
      prefix,
      dryRun,
    })
    return
  }

  throw new Error(`Unable to checkout ref ${ref}`)
}

export const ensureRepo = async ({
  repo,
  targetDir,
  ref,
  skipUpdate,
  skipClean,
  dryRun,
  prefix,
}: EnsureRepoOptions) => {
  await ensureParentDir(targetDir)

  if (!existsSync(targetDir)) {
    await runCommand(["git", "clone", repo, targetDir], {
      cwd: dirname(targetDir),
      prefix,
      dryRun,
    })
  }

  const updateCommands: RunCommandOptions = {
    cwd: targetDir,
    prefix,
    dryRun,
  }

  if (!skipUpdate) {
    await runCommand(["git", "fetch", "origin"], updateCommands)
    const targetRef = ref ?? "main"
    try {
      await checkoutRef(targetDir, targetRef, prefix, dryRun)
    } catch (error) {
      if (!ref && targetRef === "main") {
        await checkoutRef(targetDir, "master", prefix, dryRun)
      } else {
        throw error
      }
    }
  }

  if (!skipClean) {
    await runCommand(["git", "reset", "--hard"], updateCommands)
    await runCommand(["git", "clean", "-fdx"], updateCommands)
  }
}

export const repositoryPath = (slug: string) => join(reposRoot, slug)

export const getCurrentCommit = async (dir: string) => {
  const result = await runCommand(["git", "rev-parse", "HEAD"], {
    cwd: dir,
    prefix: undefined,
    dryRun: false,
    allowFailure: false,
    logStdout: false,
  })
  return result.stdout.trim()
}
