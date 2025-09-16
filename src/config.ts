import type { BuildGroup, PackageConfig, RepositoryConfig } from "./types"

function githubRepository(
  repo: string,
  options: { branch?: string; checkoutDir?: string } = {},
): RepositoryConfig {
  return {
    url: `https://github.com/${repo}.git`,
    branch: options.branch,
    checkoutDir: options.checkoutDir,
  }
}

function packageFromGithub(config: {
  name: string
  repo: string
  checkoutDir: string
  packageDir?: string
  installCommand?: string[]
  buildCommand?: string[]
  publishCommand?: string[]
  skipInstall?: boolean
  skipBuild?: boolean
  skipPublish?: boolean
  pack?: PackageConfig["pack"]
  env?: Record<string, string>
  preBuildCommands?: string[][]
  postBuildCommands?: string[][]
  branch?: string
}): PackageConfig {
  const {
    name,
    repo,
    checkoutDir,
    packageDir,
    installCommand,
    buildCommand,
    publishCommand,
    skipInstall,
    skipBuild,
    skipPublish,
    pack,
    env,
    preBuildCommands,
    postBuildCommands,
    branch,
  } = config

  return {
    name,
    repository: githubRepository(repo, { checkoutDir, branch }),
    packageDir,
    installCommand,
    buildCommand,
    publishCommand,
    skipInstall,
    skipBuild,
    skipPublish,
    pack,
    env,
    preBuildCommands,
    postBuildCommands,
  } satisfies PackageConfig
}

export const BUILD_GROUPS: BuildGroup[] = [
  {
    name: "Group 1",
    packages: [
      packageFromGithub({
        name: "circuit-json",
        repo: "tscircuit/circuit-json",
        checkoutDir: "circuit-json",
      }),
    ],
  },
  {
    name: "Group 2",
    packages: [
      packageFromGithub({
        name: "@tscircuit/props",
        repo: "tscircuit/props",
        checkoutDir: "tscircuit-props",
      }),
    ],
  },
  {
    name: "Group 3",
    packages: [
      packageFromGithub({
        name: "@tscircuit/core",
        repo: "tscircuit/core",
        checkoutDir: "tscircuit-core",
      }),
      packageFromGithub({
        name: "@tscircuit/pcb-viewer",
        repo: "tscircuit/pcb-viewer",
        checkoutDir: "tscircuit-pcb-viewer",
      }),
      packageFromGithub({
        name: "@tscircuit/schematic-viewer",
        repo: "tscircuit/schematic-viewer",
        checkoutDir: "tscircuit-schematic-viewer",
      }),
      packageFromGithub({
        name: "@tscircuit/3d-viewer",
        repo: "tscircuit/3d-viewer",
        checkoutDir: "tscircuit-3d-viewer",
      }),
    ],
  },
  {
    name: "Group 4",
    packages: [
      packageFromGithub({
        name: "@tscircuit/eval",
        repo: "tscircuit/eval",
        checkoutDir: "tscircuit-eval",
      }),
      packageFromGithub({
        name: "@tscircuit/runframe",
        repo: "tscircuit/runframe",
        checkoutDir: "tscircuit-runframe",
      }),
    ],
  },
  {
    name: "Group 5",
    packages: [
      packageFromGithub({
        name: "@tscircuit/cli",
        repo: "tscircuit/cli",
        checkoutDir: "tscircuit-cli",
      }),
    ],
  },
  {
    name: "Group 6",
    packages: [
      packageFromGithub({
        name: "tscircuit",
        repo: "tscircuit/tscircuit",
        checkoutDir: "tscircuit",
        pack: {
          command: ["npm", "pack"],
          artifactName: "tscircuit-bleeding-%timestamp%.tgz",
        },
      }),
    ],
  },
]
