import { join, relative } from "node:path";

import type { LocalPackageRef, PackageJson } from "../types";
import { pathExists, readTextFile, writeJson, writeTextFile } from "../utils/fs";

const PATCHED_SECTIONS = ["dependencies", "devDependencies", "optionalDependencies"] as const;

function toPatchedValue(from: string, to: string): { value: string; relativePath: string } {
  let relativePath = relative(from, to).replace(/\\/g, "/");
  if (!relativePath.startsWith(".")) {
    relativePath = `./${relativePath}`;
  }
  return { value: `file:${relativePath}`, relativePath };
}

export interface PackageJsonPatchResult {
  original: PackageJson;
  patched: PackageJson;
  changed: boolean;
  localDependencies: Record<string, { relativePath: string; originalVersion: string }>;
  restore(): Promise<void>;
}

export interface PackageJsonPatchOptions {
  disablePatch?: boolean;
}

export async function applyLocalDependencyPatches(
  repoDir: string,
  availablePackages: Map<string, LocalPackageRef>,
  options: PackageJsonPatchOptions = {},
): Promise<PackageJsonPatchResult> {
  const disablePatch = options.disablePatch ?? false;
  const packageJsonPath = join(repoDir, "package.json");
  const metadataDir = join(repoDir, ".tscircuit-bleeding");
  const backupPath = join(metadataDir, "package.json.original");

  let originalContents: string;
  if (await pathExists(backupPath)) {
    originalContents = await readTextFile(backupPath);
    await writeTextFile(packageJsonPath, originalContents);
  } else {
    originalContents = await readTextFile(packageJsonPath);
    await writeTextFile(backupPath, originalContents);
  }

  const original = JSON.parse(originalContents) as PackageJson;
  const patched = JSON.parse(JSON.stringify(original)) as PackageJson;
  const localDependencies: Record<string, { relativePath: string; originalVersion: string }> = {};
  let changed = false;

  if (!disablePatch) {
    for (const key of PATCHED_SECTIONS) {
      const section = patched[key];
      if (!section) continue;

      for (const dependencyName of Object.keys(section)) {
        const localPackage = availablePackages.get(dependencyName);
        if (!localPackage) continue;
        const originalVersion = section[dependencyName]!;
        const { value, relativePath } = toPatchedValue(repoDir, localPackage.repoState.repoDir);
        if (section[dependencyName] !== value) {
          section[dependencyName] = value;
          localDependencies[dependencyName] = { relativePath, originalVersion };
          changed = true;
        }
      }
    }
  }

  if (changed) {
    await writeJson(packageJsonPath, patched);
  }

  return {
    original,
    patched: disablePatch ? original : patched,
    changed,
    localDependencies,
    restore: async () => {
      await writeTextFile(packageJsonPath, originalContents);
    },
  };
}
