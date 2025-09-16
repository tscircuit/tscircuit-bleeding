import { access, mkdir } from "node:fs/promises"

export const pathExists = async (path: string) => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export const ensureDir = async (path: string) => {
  await mkdir(path, { recursive: true })
}
