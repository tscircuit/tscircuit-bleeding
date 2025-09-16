import path from "node:path"
import { readJsonFile } from "./fs-utils"
import type { PackageJson } from "./types"

export async function readPackageJson(
  packageDir: string,
): Promise<PackageJson> {
  const packageJsonPath = path.join(packageDir, "package.json")
  return readJsonFile<PackageJson>(packageJsonPath)
}
