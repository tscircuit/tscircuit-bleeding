export type DependencyMap = Record<string, string>;

export interface PackageJson {
  name: string;
  version?: string;
  private?: boolean;
  workspaces?: string[] | { packages?: string[] };
  dependencies?: DependencyMap;
  devDependencies?: DependencyMap;
  optionalDependencies?: DependencyMap;
  peerDependencies?: DependencyMap;
  [key: string]: unknown;
}

export interface RepoConfig {
  packageName: string;
  repository: string;
  ref?: string;
  dirName?: string;
  installCommand?: string[];
  buildCommand?: string[];
}

export interface BuildGroup {
  id: string;
  title: string;
  concurrency?: number;
  packages: RepoConfig[];
}

export interface WorkspacePaths {
  rootDir: string;
  workspaceDir: string;
  reposDir: string;
  manifestsDir: string;
  packsDir: string;
  bundleDir: string;
  distDir: string;
}

export interface RepoState {
  config: RepoConfig;
  repoDir: string;
  dirName: string;
  branch: string;
}

export interface BuildManifest {
  packageName: string;
  version: string;
  repository: string;
  dirName: string;
  commit: string;
  ref: string;
  builtAt: string;
  relativeRepoDir: string;
  installCommand: string[];
  buildCommand: string[];
  groupId: string;
  localDependencies: Record<string, { relativePath: string; originalVersion: string }>;
}

export interface BuildContext {
  plan: BuildGroup[];
  paths: WorkspacePaths;
  concurrency: number;
  repoStates: Map<string, RepoState>;
  groupFilter?: Set<string>;
}

export interface LocalPackageRef {
  manifest: BuildManifest;
  repoState: RepoState;
}
