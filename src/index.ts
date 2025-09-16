import { createContext } from "./context";
import { bootstrap } from "./steps/bootstrap";
import { buildPackages } from "./steps/build";
import { bundle } from "./steps/bundle";
import { clean as cleanWorkspace } from "./steps/clean";

async function run(command: string): Promise<void> {
  if (command === "clean") {
    const context = await createContext();
    await cleanWorkspace(context);
    return;
  }

  const context = await createContext();

  switch (command) {
    case "bootstrap": {
      await bootstrap(context);
      break;
    }
    case "build":
    case "build-packages": {
      await bootstrap(context);
      await buildPackages(context);
      break;
    }
    case "bundle":
    case "generate-tgz": {
      await bootstrap(context);
      const manifests = await buildPackages(context);
      await bundle(context, manifests);
      break;
    }
    default: {
      console.error(`Unknown command: ${command}`);
      console.error("Available commands: bootstrap, build, bundle, clean");
      process.exitCode = 1;
    }
  }
}

const command = (process.argv[2] ?? "bundle").toLowerCase();
run(command).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  process.exitCode = 1;
});
