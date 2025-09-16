import { access, copyFile, mkdir, readFile, rename, rm } from "node:fs/promises"
import path from "node:path"

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
}

export async function removeDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true })
}

export async function moveFile(
  source: string,
  destination: string,
): Promise<void> {
  try {
    await rename(source, destination)
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code === "EXDEV") {
      await ensureDir(path.dirname(destination))
      await copyFile(source, destination)
      await rm(source, { force: true })
    } else {
      throw error
    }
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const contents = await readFile(filePath, "utf8")
  return JSON.parse(contents) as T
}

export function resolveWorkspacePath(
  root: string,
  ...segments: string[]
): string {
  return path.join(root, ...segments)
}
