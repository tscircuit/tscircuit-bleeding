import { rm } from "node:fs/promises";

import type { BuildContext } from "../types";

export async function clean(context: BuildContext): Promise<void> {
  await Promise.all([
    rm(context.paths.workspaceDir, { recursive: true, force: true }),
    rm(context.paths.distDir, { recursive: true, force: true }),
  ]);
  console.log("Workspace cleaned.");
}
