import { join } from "node:path";

import type { BuildContext, RepoConfig, RepoState } from "../types";
import { pathExists } from "../utils/fs";
import { captureCommand, runCommand } from "../utils/command";

function resolveDirName(config: RepoConfig): string {
  return config.dirName ?? config.packageName.replace(/^@/, "").replace(/[\/]/g, "-");
}

function repoDir(context: BuildContext, config: RepoConfig): string {
  return join(context.paths.reposDir, resolveDirName(config));
}

async function getCurrentBranch(directory: string): Promise<string> {
  const { stdout } = await captureCommand(["git", "rev-parse", "--abbrev-ref", "HEAD"], {
    cwd: directory,
  });
  const branch = stdout.trim();
  if (branch && branch !== "HEAD") {
    return branch;
  }
  const remote = await captureCommand(["git", "remote", "show", "origin"], { cwd: directory });
  const headLine = remote.stdout.split("\n").find((line) => line.includes("HEAD branch:"));
  return headLine?.split(":")?.[1]?.trim() || "main";
}

async function checkoutBranch(directory: string, branch: string): Promise<void> {
  await runCommand(["git", "checkout", branch], { cwd: directory });
  await runCommand(["git", "reset", "--hard", `origin/${branch}`], { cwd: directory });
}

async function initializeSubmodules(directory: string): Promise<void> {
  try {
    await runCommand(["git", "submodule", "update", "--init", "--recursive"], { cwd: directory });
  } catch (error) {
    console.warn(
      `Warning: failed to update submodules in ${directory}: ${(error as Error).message}`,
    );
  }
}

export async function ensureRepo(context: BuildContext, config: RepoConfig): Promise<RepoState> {
  const directory = repoDir(context, config);
  const gitDirectoryExists = await pathExists(join(directory, ".git"));

  if (!gitDirectoryExists) {
    const cloneArgs: string[] = [
      "git",
      "clone",
      "--filter=blob:none",
      "--single-branch",
      "--depth",
      "1",
    ];
    if (config.ref) {
      cloneArgs.push("--branch", config.ref);
    }
    cloneArgs.push(config.repository, directory);
    await runCommand(cloneArgs as [string, ...string[]]);
    await initializeSubmodules(directory);
  } else {
    await runCommand(["git", "fetch", "--tags", "--prune", "origin"], { cwd: directory });
    const branch = config.ref ?? (await getCurrentBranch(directory));
    await checkoutBranch(directory, branch);
    await initializeSubmodules(directory);
  }

  const branch = config.ref ?? (await getCurrentBranch(directory));
  return {
    config,
    repoDir: directory,
    dirName: resolveDirName(config),
    branch,
  } satisfies RepoState;
}

export async function getCurrentCommit(directory: string): Promise<string> {
  const { stdout } = await captureCommand(["git", "rev-parse", "HEAD"], { cwd: directory });
  return stdout.trim();
}
