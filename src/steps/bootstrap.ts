import type { BuildContext } from "../types";
import { ensureRepo } from "../lib/git";
import { mapWithConcurrency } from "../utils/concurrency";

function cloneConcurrency(context: BuildContext, groupConcurrency?: number): number {
  const base = groupConcurrency ?? context.concurrency;
  return Math.max(1, Math.min(base, 3));
}

function shouldProcessGroup(context: BuildContext, groupId: string): boolean {
  if (!context.groupFilter) return true;
  return context.groupFilter.has(groupId);
}

export async function bootstrap(context: BuildContext): Promise<void> {
  console.log("Bootstrapping repositories...");
  for (const group of context.plan) {
    if (!shouldProcessGroup(context, group.id)) {
      console.log(`• ${group.title} (skipped)`);
      continue;
    }
    console.log(`• ${group.title}`);
    const concurrency = cloneConcurrency(context, group.concurrency);
    await mapWithConcurrency(group.packages, concurrency, async (config) => {
      const state = await ensureRepo(context, config);
      context.repoStates.set(config.packageName, state);
      console.log(`  ✓ ${config.packageName} ready at ${state.repoDir}`);
      return state;
    });
  }
}
