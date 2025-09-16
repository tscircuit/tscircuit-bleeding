export interface PackageConfig {
  /** Package name used for linking */
  name: string;
  /** Git repository URL */
  repo: string;
  /** Branch or ref to check out (defaults to main) */
  ref?: string;
  /** Optional subdirectory that contains the package */
  directory?: string;
  /** Override the install command */
  installCommand?: string[];
  /** Override the build command */
  buildCommand?: string[];
  /** Whether to run `bun link` after building (defaults to true) */
  link?: boolean;
  /** Skip installation step */
  skipInstall?: boolean;
  /** Skip build step */
  skipBuild?: boolean;
}

export interface PackageGroup {
  name: string;
  packages: PackageConfig[];
}

const DEFAULT_BUILD_COMMAND = ["bun", "run", "build"];
const DEFAULT_INSTALL_COMMAND = ["bun", "install"];

export const packageGroups: PackageGroup[] = [
  {
    name: "Group 1",
    packages: [
      {
        name: "@tscircuit/core",
        repo: "https://github.com/tscircuit/core.git",
        buildCommand: DEFAULT_BUILD_COMMAND,
        installCommand: DEFAULT_INSTALL_COMMAND,
      },
      {
        name: "@tscircuit/pcb-viewer",
        repo: "https://github.com/tscircuit/pcb-viewer.git",
        buildCommand: DEFAULT_BUILD_COMMAND,
        installCommand: DEFAULT_INSTALL_COMMAND,
      },
      {
        name: "@tscircuit/schematic-viewer",
        repo: "https://github.com/tscircuit/schematic-viewer.git",
        buildCommand: DEFAULT_BUILD_COMMAND,
        installCommand: DEFAULT_INSTALL_COMMAND,
      },
      {
        name: "@tscircuit/3d-viewer",
        repo: "https://github.com/tscircuit/3d-viewer.git",
        buildCommand: DEFAULT_BUILD_COMMAND,
        installCommand: DEFAULT_INSTALL_COMMAND,
      },
    ],
  },
  {
    name: "Group 2",
    packages: [
      {
        name: "@tscircuit/eval",
        repo: "https://github.com/tscircuit/eval.git",
        buildCommand: DEFAULT_BUILD_COMMAND,
        installCommand: DEFAULT_INSTALL_COMMAND,
      },
      {
        name: "@tscircuit/runframe",
        repo: "https://github.com/tscircuit/runframe.git",
        buildCommand: DEFAULT_BUILD_COMMAND,
        installCommand: DEFAULT_INSTALL_COMMAND,
      },
    ],
  },
  {
    name: "Group 3",
    packages: [
      {
        name: "@tscircuit/cli",
        repo: "https://github.com/tscircuit/cli.git",
        buildCommand: DEFAULT_BUILD_COMMAND,
        installCommand: DEFAULT_INSTALL_COMMAND,
      },
    ],
  },
  {
    name: "Group 4",
    packages: [
      {
        name: "tscircuit",
        repo: "https://github.com/tscircuit/tscircuit.git",
        buildCommand: DEFAULT_BUILD_COMMAND,
        installCommand: DEFAULT_INSTALL_COMMAND,
        link: false,
      },
    ],
  },
];

export const DEFAULT_REF = "main";
export const DEFAULT_LINK_BEHAVIOUR = true;
export const WORKSPACE_DIRECTORY = "workdir";
export const DIST_DIRECTORY = "dist";
