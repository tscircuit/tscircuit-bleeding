import { buildBleeding } from "./build";
import type { BuildOptions } from "./build";

function printUsage() {
  console.log(`Usage: bun run src/index.ts [command] [options]\n`);
  console.log("Commands:");
  console.log(
    "  build           Clone, build, link and package the bleeding release (default)",
  );
  console.log("  help            Show this message\n");
  console.log("Options:");
  console.log(
    "  --workspace <path>  Override workspace directory (default: workdir)",
  );
  console.log(
    "  --dist <path>       Override output directory (default: dist)",
  );
}

function parseOptions(args: string[]): BuildOptions {
  const options: BuildOptions = {};

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    switch (arg) {
      case "--workspace":
      case "--workdir": {
        const next = args[++index];
        if (!next) throw new Error(`${arg} requires a value`);
        options.workspaceRoot = next;
        break;
      }
      case "--dist": {
        const next = args[++index];
        if (!next) throw new Error("--dist requires a value");
        options.distDirectory = next;
        break;
      }
      default: {
        throw new Error(`Unknown option: ${arg}`);
      }
    }
  }

  return options;
}

async function runBuild(args: string[]) {
  const options = parseOptions(args);
  const result = await buildBleeding(options);
  console.log(`\nTarball created at: ${result.tarballPath}`);
  console.log(`Manifest written to: ${result.manifestPath}`);
}

async function main() {
  const [, , commandOrOption, ...rest] = Bun.argv;

  if (!commandOrOption || commandOrOption === "build") {
    await runBuild(rest);
    return;
  }

  if (
    commandOrOption === "help" ||
    commandOrOption === "--help" ||
    commandOrOption === "-h"
  ) {
    printUsage();
    return;
  }

  if (commandOrOption.startsWith("--")) {
    await runBuild([commandOrOption, ...rest]);
    return;
  }

  throw new Error(`Unknown command: ${commandOrOption}`);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

export { buildBleeding } from "./build";
export type { BuildOptions, BuildResult } from "./build";
