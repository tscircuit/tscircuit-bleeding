export interface RepositoryConfig {
  /** Full git url (https://, git@, etc.) */
  url: string
  /** Branch to checkout, defaults to "main" */
  branch?: string
  /**
   * Directory name under the repos workspace. When multiple packages live in the
   * same git repository, provide the same checkoutDir for each to avoid
   * duplicate clones.
   */
  checkoutDir?: string
}

export interface PackConfig {
  /** Command to run that produces a tarball for the package. */
  command: string[]
  /** Optional directory for the final artifact (defaults to workspace artifacts folder). */
  destinationDir?: string
  /** Optional explicit artifact name override. */
  artifactName?: string
}

export interface PackageConfig {
  /** npm package name */
  name: string
  /** Git repository configuration */
  repository: RepositoryConfig
  /** Relative directory that contains the package (defaults to repo root) */
  packageDir?: string
  /** Optional key to reuse repository checkout across packages */
  checkoutKey?: string
  /** Command used to install dependencies (defaults to ["bun", "install"]) */
  installCommand?: string[]
  /** Command used to build the project (defaults to ["bun", "run", "build"]) */
  buildCommand?: string[]
  /** Command used to publish the package to yalc (defaults to ["bunx", "yalc", "publish"]) */
  publishCommand?: string[]
  /** Optional packaging command (e.g. npm pack) */
  pack?: PackConfig
  /** Skip installation step */
  skipInstall?: boolean
  /** Skip build step */
  skipBuild?: boolean
  /** Skip yalc publish */
  skipPublish?: boolean
  /** Extra environment variables applied to commands */
  env?: Record<string, string>
  /** Commands executed before the main build command */
  preBuildCommands?: string[][]
  /** Commands executed after the main build command */
  postBuildCommands?: string[][]
}

export interface BuildGroup {
  name: string
  packages: PackageConfig[]
}

export interface PackageJson {
  name: string
  version?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  [key: string]: unknown
}

export interface RepositoryCheckout {
  url: string
  dir: string
  branch: string
  commit: string
}

export interface PackResult {
  artifactPath: string
  originalPath: string
  command: string[]
}

export interface PackageBuildResult {
  config: PackageConfig
  packageJson: PackageJson
  repository: RepositoryCheckout
  packageDir: string
  linkedDependencies: string[]
  yalcPublished: boolean
  durations: {
    installMs?: number
    buildMs?: number
    publishMs?: number
    totalMs: number
  }
  packResult?: PackResult
}

export interface BuildGroupResult {
  group: BuildGroup
  results: PackageBuildResult[]
}

export interface BuildReport {
  generatedAt: string
  workspaceRoot: string
  artifactsRoot: string
  groups: BuildGroupResult[]
}

export interface BuildSystemOptions {
  workspaceRoot?: string
  artifactsRoot?: string
  dryRun?: boolean
  skipPublish?: boolean
}
