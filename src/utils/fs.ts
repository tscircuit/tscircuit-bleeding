import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export async function readJson<T>(path: string): Promise<T> {
  const contents = await readFile(path, "utf8");
  return JSON.parse(contents) as T;
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await ensureDir(dirname(path));
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(path, serialized, "utf8");
}

export async function readTextFile(path: string): Promise<string> {
  return readFile(path, "utf8");
}

export async function writeTextFile(path: string, contents: string): Promise<void> {
  await ensureDir(dirname(path));
  await writeFile(path, contents, "utf8");
}

export async function cleanDir(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
  await ensureDir(path);
}

export async function copyFileWithDirs(source: string, target: string): Promise<void> {
  await ensureDir(dirname(target));
  await copyFile(source, target);
}

export async function listFiles(path: string): Promise<string[]> {
  try {
    return await readdir(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}
