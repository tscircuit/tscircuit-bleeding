import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
export const workspaceRoot = join(here, "..")
export const buildRoot = join(workspaceRoot, "build")
export const artifactsRoot = join(workspaceRoot, "artifacts")
export const reposRoot = join(buildRoot, "repos")
export const yalcStoreDir = join(buildRoot, ".yalc-store")
export const manifestsRoot = join(buildRoot, "manifests")

export const relativeToWorkspace = (absolutePath: string): string => {
  if (!absolutePath.startsWith(workspaceRoot)) return absolutePath
  return absolutePath.slice(workspaceRoot.length + 1)
}
