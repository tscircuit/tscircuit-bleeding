export interface PackageConfig {
  name: string
  repo: string
  ref?: string
  packageDir?: string
  description?: string
  installCommand?: string[]
  buildCommand?: string[]
  publishCommand?: string[]
  preBuildCommands?: string[][]
  postBuildCommands?: string[][]
  extraYalcDependencies?: string[]
  skipPublish?: boolean
  skipInstall?: boolean
  skipBuild?: boolean
  packAfterBuild?: boolean
  packCommand?: string[]
  packDestination?: string
}

export interface PackageGroup {
  name: string
  description?: string
  packages: PackageConfig[]
}

export interface PackageJson {
  name?: string
  version?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  [key: string]: unknown
}

export interface BuildOptions {
  onlyPackages?: string[]
  skipInstall?: boolean
  skipBuild?: boolean
  skipPublish?: boolean
  skipPack?: boolean
  skipGitUpdate?: boolean
  skipGitClean?: boolean
  dryRun?: boolean
}

export interface PackageBuildResult {
  config: PackageConfig
  repoDir: string
  workingDir: string
  packageJson: PackageJson | null
  commit: string | null
  yalcPublished: boolean
  packedTarball?: string
}

export interface BuildSummary {
  builtAt: string
  options: BuildOptions
  results: PackageBuildResult[]
}

export interface BuildExecutionResult {
  summary: BuildSummary
  manifestPath?: string
  latestManifestPath?: string
}
