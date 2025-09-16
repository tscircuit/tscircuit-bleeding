import { relative } from "node:path";

import type { BuildContext, BuildManifest, LocalPackageRef, RepoState } from "../types";
import { mapWithConcurrency } from "../utils/concurrency";
import { runCommand } from "../utils/command";
import { applyLocalDependencyPatches } from "../lib/package-json";
import { getCurrentCommit } from "../lib/git";
import { writeBuildManifest } from "../lib/manifests";

function toCommand(command: string[] | undefined, fallback: string[]): [string, ...string[]] {
  const resolved = command && command.length > 0 ? command : fallback;
  if (!resolved || resolved.length === 0) {
    throw new Error("Commands must contain at least one argument");
  }
  return resolved as [string, ...string[]];
}

function repoStateOrThrow(state: RepoState | undefined, packageName: string): RepoState {
  if (!state) {
    throw new Error(`Repository state for ${packageName} is not available. Did you run bootstrap?`);
  }
  return state;
}

function shouldBuildGroup(context: BuildContext, groupId: string): boolean {
  if (!context.groupFilter) return true;
  return context.groupFilter.has(groupId);
}

async function buildSinglePackage(
  context: BuildContext,
  repoState: RepoState,
  availablePackages: Map<string, LocalPackageRef>,
  groupId: string,
): Promise<BuildManifest> {
  console.log(`  → Building ${repoState.config.packageName}`);
  const skipBuild = process.env.TSCB_SKIP_BUILDS === "1";
  const disablePatch = skipBuild || process.env.TSCB_DISABLE_PATCH === "1";
  const patchResult = await applyLocalDependencyPatches(repoState.repoDir, availablePackages, {
    disablePatch,
  });
  if (disablePatch && availablePackages.size > 0) {
    console.log("    (local dependency patching disabled)");
  }
  const installCommand = toCommand(repoState.config.installCommand, ["bun", "install"]);
  const buildCommand = toCommand(repoState.config.buildCommand, ["bun", "run", "build"]);

  try {
    if (skipBuild) {
      console.log("    (skipping install/build commands)");
    } else {
      await runCommand(installCommand, { cwd: repoState.repoDir });
      await runCommand(buildCommand, { cwd: repoState.repoDir });
    }
  } finally {
    await patchResult.restore();
  }

  const commit = await getCurrentCommit(repoState.repoDir);
  const packageName = patchResult.original.name ?? repoState.config.packageName;
  const version = patchResult.original.version ?? "0.0.0";
  const manifest: BuildManifest = {
    packageName,
    version,
    repository: repoState.config.repository,
    dirName: repoState.dirName,
    commit,
    ref: repoState.branch,
    builtAt: new Date().toISOString(),
    relativeRepoDir: relative(context.paths.rootDir, repoState.repoDir),
    installCommand: [...installCommand],
    buildCommand: [...buildCommand],
    groupId,
    localDependencies: patchResult.localDependencies,
  };

  await writeBuildManifest(context, manifest);
  console.log(`  ✓ ${packageName}@${version} built`);

  return manifest;
}

export async function buildPackages(context: BuildContext): Promise<BuildManifest[]> {
  console.log("Building packages...");
  const manifests: BuildManifest[] = [];
  const availablePackages = new Map<string, LocalPackageRef>();

  for (const group of context.plan) {
    if (!shouldBuildGroup(context, group.id)) {
      console.log(`• ${group.title} (skipped)`);
      continue;
    }
    console.log(`• ${group.title}`);
    const repoStates = group.packages.map((config) =>
      repoStateOrThrow(context.repoStates.get(config.packageName), config.packageName),
    );

    const concurrency = Math.max(1, group.concurrency ?? context.concurrency);
    const groupResults = await mapWithConcurrency(repoStates, concurrency, async (state) =>
      buildSinglePackage(context, state, availablePackages, group.id),
    );

    for (const manifest of groupResults) {
      const repoState = repoStateOrThrow(
        context.repoStates.get(manifest.packageName),
        manifest.packageName,
      );
      availablePackages.set(manifest.packageName, { manifest, repoState });
      manifests.push(manifest);
    }
  }

  return manifests;
}
