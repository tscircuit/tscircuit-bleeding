import type { BuildGroup, RepoConfig } from "../types";

function repoConfig(
  packageName: string,
  repositoryPath: string,
  overrides: Partial<RepoConfig> = {},
): RepoConfig {
  const dirName = packageName.replace(/^@/, "").replace(/[\/]/g, "-");
  return {
    packageName,
    repository: repositoryPath.startsWith("http")
      ? repositoryPath
      : `https://github.com/${repositoryPath.replace(/^\//, "").replace(/\.git$/, "")}.git`,
    ref: "main",
    dirName,
    installCommand: ["bun", "install"],
    buildCommand: ["bun", "run", "build"],
    ...overrides,
  } satisfies RepoConfig;
}

export const BUILD_PLAN: BuildGroup[] = [
  {
    id: "group-1",
    title: "Viewer foundations",
    packages: [
      repoConfig("@tscircuit/core", "tscircuit/core"),
      repoConfig("@tscircuit/pcb-viewer", "tscircuit/pcb-viewer"),
      repoConfig("@tscircuit/schematic-viewer", "tscircuit/schematic-viewer"),
      repoConfig("@tscircuit/3d-viewer", "tscircuit/3d-viewer"),
    ],
  },
  {
    id: "group-2",
    title: "Runtime packages",
    packages: [
      repoConfig("@tscircuit/eval", "tscircuit/eval"),
      repoConfig("@tscircuit/runframe", "tscircuit/runframe"),
    ],
  },
  {
    id: "group-3",
    title: "CLI",
    packages: [repoConfig("@tscircuit/cli", "tscircuit/cli")],
  },
  {
    id: "group-4",
    title: "Top-level tscircuit",
    packages: [repoConfig("tscircuit", "tscircuit/tscircuit")],
  },
];
