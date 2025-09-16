import type { PackageGroup } from "./types"

const github = (repo: string) => `https://github.com/${repo}.git`

export const packageGroups: PackageGroup[] = [
  {
    name: "Group 1",
    description: "Foundational circuit primitives",
    packages: [
      {
        name: "circuit-json",
        repo: github("tscircuit/circuit-json"),
      },
    ],
  },
  {
    name: "Group 2",
    description: "Shared component props",
    packages: [
      {
        name: "@tscircuit/props",
        repo: github("tscircuit/props"),
      },
    ],
  },
  {
    name: "Group 3",
    description: "Core runtime and viewers",
    packages: [
      {
        name: "@tscircuit/core",
        repo: github("tscircuit/core"),
      },
      {
        name: "@tscircuit/pcb-viewer",
        repo: github("tscircuit/pcb-viewer"),
      },
      {
        name: "@tscircuit/schematic-viewer",
        repo: github("tscircuit/schematic-viewer"),
      },
      {
        name: "@tscircuit/3d-viewer",
        repo: github("tscircuit/3d-viewer"),
      },
    ],
  },
  {
    name: "Group 4",
    description: "Evaluation and runtime integration",
    packages: [
      {
        name: "@tscircuit/eval",
        repo: github("tscircuit/eval"),
      },
      {
        name: "@tscircuit/runframe",
        repo: github("tscircuit/runframe"),
      },
    ],
  },
  {
    name: "Group 5",
    description: "CLI tooling",
    packages: [
      {
        name: "@tscircuit/cli",
        repo: github("tscircuit/cli"),
      },
    ],
  },
  {
    name: "Group 6",
    description: "Bundled tscircuit release",
    packages: [
      {
        name: "tscircuit",
        repo: github("tscircuit/tscircuit"),
        skipPublish: true,
        packAfterBuild: true,
      },
    ],
  },
]

export const allPackages = packageGroups.flatMap((group) => group.packages)
