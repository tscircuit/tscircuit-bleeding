import { join } from "node:path";

import type { BuildContext, BuildManifest } from "../types";
import { listFiles, readJson, writeJson } from "../utils/fs";

export async function writeBuildManifest(
  context: BuildContext,
  manifest: BuildManifest,
): Promise<string> {
  const manifestPath = join(context.paths.manifestsDir, `${manifest.dirName}.json`);
  await writeJson(manifestPath, manifest);
  return manifestPath;
}

export async function loadBuildManifests(context: BuildContext): Promise<BuildManifest[]> {
  const files = await listFiles(context.paths.manifestsDir);
  const manifests: BuildManifest[] = [];

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const manifestPath = join(context.paths.manifestsDir, file);
    const manifest = await readJson<BuildManifest>(manifestPath);
    manifests.push(manifest);
  }

  const groupOrder = new Map(context.plan.map((group, index) => [group.id, index] as const));
  manifests.sort((a, b) => {
    const groupCompare = (groupOrder.get(a.groupId) ?? 0) - (groupOrder.get(b.groupId) ?? 0);
    if (groupCompare !== 0) return groupCompare;
    return a.packageName.localeCompare(b.packageName);
  });

  return manifests;
}
