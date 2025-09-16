import os from "node:os";
import { join } from "node:path";

import { BUILD_PLAN } from "./config/build-plan";
import { ensureDir } from "./utils/fs";
import type { BuildContext, WorkspacePaths } from "./types";

function determineConcurrency(): number {
  const fromEnv = process.env.TSCB_CONCURRENCY;
  if (fromEnv) {
    const parsed = Number(fromEnv);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }
  const cpuCount = os.cpus()?.length ?? 2;
  return Math.max(1, Math.min(4, cpuCount - 1));
}

function parseGroupFilter(): Set<string> | undefined {
  const raw = process.env.TSCB_GROUP_FILTER;
  if (!raw) return undefined;
  const groups = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (groups.length === 0) return undefined;
  return new Set(groups);
}

export async function createContext(): Promise<BuildContext> {
  const rootDir = process.cwd();
  const workspaceDir = join(rootDir, ".tscircuit-bleeding");

  const paths: WorkspacePaths = {
    rootDir,
    workspaceDir,
    reposDir: join(workspaceDir, "repos"),
    manifestsDir: join(workspaceDir, "manifests"),
    packsDir: join(workspaceDir, "packs"),
    bundleDir: join(workspaceDir, "bundle"),
    distDir: join(rootDir, "dist"),
  };

  await Promise.all([
    ensureDir(paths.workspaceDir),
    ensureDir(paths.reposDir),
    ensureDir(paths.manifestsDir),
    ensureDir(paths.packsDir),
    ensureDir(paths.bundleDir),
    ensureDir(paths.distDir),
  ]);

  return {
    plan: BUILD_PLAN,
    paths,
    concurrency: determineConcurrency(),
    repoStates: new Map(),
    groupFilter: parseGroupFilter(),
  };
}
