import { rename } from "node:fs/promises";
import { join } from "node:path";

import type { BuildContext, BuildManifest } from "../types";
import { loadBuildManifests } from "../lib/manifests";
import { captureCommand } from "../utils/command";
import { cleanDir, copyFileWithDirs, ensureDir, writeJson, writeTextFile } from "../utils/fs";
import { createTimestamp } from "../utils/format";

interface PackResult {
  manifest: BuildManifest;
  fileName: string;
  filePath: string;
  skipped: boolean;
}

async function packRepository(
  context: BuildContext,
  manifest: BuildManifest,
  skipPack: boolean,
): Promise<PackResult> {
  const repositoryPath = join(context.paths.rootDir, manifest.relativeRepoDir);
  if (skipPack) {
    console.log(`  → Skipping pack for ${manifest.packageName}`);
    const fileName = `${manifest.dirName}.placeholder.txt`;
    const filePath = join(context.paths.packsDir, fileName);
    await writeTextFile(
      filePath,
      `Packaging skipped for ${manifest.packageName}@${manifest.version}. Set TSCB_SKIP_PACKAGE_PACKS=0 to include real artifacts.\n`,
    );
    return { manifest, fileName, filePath, skipped: true };
  }
  console.log(`  → Packing ${manifest.packageName}`);
  const result = await captureCommand(
    ["npm", "pack", "--json", "--pack-destination", context.paths.packsDir],
    { cwd: repositoryPath },
  );
  const parsed = JSON.parse(result.stdout) as Array<{ filename: string }>;
  const fileName = parsed[0]?.filename;
  if (!fileName) {
    throw new Error(`npm pack did not produce an output for ${manifest.packageName}`);
  }
  const filePath = join(context.paths.packsDir, fileName);
  console.log(`  ✓ ${manifest.packageName} packed (${fileName})`);
  return { manifest, fileName, filePath, skipped: false };
}

export interface BundleManifest {
  builtAt: string;
  packages: Array<{
    packageName: string;
    version: string;
    repository: string;
    commit: string;
    ref: string;
    groupId: string;
    tarballFile: string;
    localDependencies: BuildManifest["localDependencies"];
    skipped: boolean;
  }>;
}

export interface BundleResult {
  manifest: BundleManifest;
  tarballPath: string;
}

export async function bundle(
  context: BuildContext,
  manifests?: BuildManifest[],
): Promise<BundleResult> {
  const buildManifests =
    manifests && manifests.length > 0 ? manifests : await loadBuildManifests(context);
  if (buildManifests.length === 0) {
    throw new Error("No build manifests available. Run the build step first.");
  }

  await cleanDir(context.paths.packsDir);
  const skipPackagePacks = process.env.TSCB_SKIP_PACKAGE_PACKS === "1";
  const packResults: PackResult[] = [];
  for (const manifest of buildManifests) {
    packResults.push(await packRepository(context, manifest, skipPackagePacks));
  }

  await cleanDir(context.paths.bundleDir);
  const timestamp = createTimestamp();
  const packagesDir = join(context.paths.bundleDir, "packages");
  await ensureDir(packagesDir);

  for (const pack of packResults) {
    const destination = join(packagesDir, pack.fileName);
    await copyFileWithDirs(pack.filePath, destination);
  }

  const bundleManifest: BundleManifest = {
    builtAt: timestamp.iso,
    packages: packResults.map((pack) => ({
      packageName: pack.manifest.packageName,
      version: pack.manifest.version,
      repository: pack.manifest.repository,
      commit: pack.manifest.commit,
      ref: pack.manifest.ref,
      groupId: pack.manifest.groupId,
      tarballFile: `packages/${pack.fileName}`,
      localDependencies: pack.manifest.localDependencies,
      skipped: pack.skipped,
    })),
  };

  const bundlePackageJson = {
    name: "tscircuit-bleeding",
    version: `0.0.0-bleeding.${timestamp.semverFragment}`,
    description: "Aggregated bleeding-edge build of the tscircuit stack.",
    type: "module",
    files: ["manifest.json", "packages/"],
    keywords: ["tscircuit", "bleeding"],
    tscircuitBleeding: bundleManifest,
  } satisfies Record<string, unknown>;

  await writeJson(join(context.paths.bundleDir, "package.json"), bundlePackageJson);
  await writeJson(join(context.paths.bundleDir, "manifest.json"), bundleManifest);
  await writeTextFile(
    join(context.paths.bundleDir, "README.md"),
    `# tscircuit bleeding bundle\n\nGenerated at ${timestamp.iso} UTC.\n`,
  );

  const packOutput = await captureCommand(
    ["npm", "pack", "--json", "--pack-destination", context.paths.distDir],
    { cwd: context.paths.bundleDir },
  );
  const packedBundle = JSON.parse(packOutput.stdout) as Array<{ filename: string }>;
  const producedFile = packedBundle[0]?.filename;
  if (!producedFile) {
    throw new Error("npm pack failed to produce the final bundle tarball");
  }

  const producedPath = join(context.paths.distDir, producedFile);
  const finalName = `tscircuit-bleeding-${timestamp.fileSafe}.tgz`;
  const finalPath = join(context.paths.distDir, finalName);
  await rename(producedPath, finalPath);
  console.log(`✓ Bundle available at ${finalPath}`);

  return { manifest: bundleManifest, tarballPath: finalPath };
}
