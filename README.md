# tscircuit-bleeding

Bleeding untested builds of tscircuit

## Overview

We're going to have a github repo called "tscircuit-bleeding" that pushes a tarball every time there's an update to any major repo then runs a full "build process" that individually builds every dependency. At the end of the build process, it will push a tarball to a public cloudflare bucket. When a user runs bun add https://tarballs.tscircuit.com/tscircuit/bleeding-2025-09-15-01:31.tgz it will install the latest version of tscircuit with all the untested dependencies up to date.
That tarball path is hard to find, so tsci upgrade --bleeding will always automatically install it. tsci upgrade --latest or tsci upgrade --stable will revert back to the stable version.
The tscircuit-bleeding repo will be a bit complicated, it should clone and build each dependency, making sure to `yalc` them together. When it's done, it pushes up the tarball.

## Implementation Details

We are rebuilding select dependencies, not all dependencies of tscircuit, specifically, we want to clone, build and replace the versions of these dependencies. Dependencies should be built in parallel within
the group, but the group should be built in order.

- Group 1
  - circuit-json
- Group 2
  - @tscircuit/props
- Group 3
  - @tscircuit/core (github.com/tscircuit/core)
  - @tscircuit/pcb-viewer
  - @tscircuit/schematic-viewer
  - @tscircuit/3d-viewer
- Group 4
  - @tscircuit/eval (github.com/tscircuit/eval)
  - @tscircuit/runframe
- Group 5
  - @tscircuit/cli
- Group 6
  - tscircuit (this dependency is MODIFIED to have no dependencies, and to be fully bundled!!!)


These packages have dependencies on one another, e.g. @tscircuit/runframe depends on @tscircuit/pcb-viewer, so @tscircuit/pcb-viewer needs to be built first. They are universally built with `bun run build`. Some dependencies will depend on later dependencies- this is OK. Where a later dependency is required, we just use the version in the package.json file.

## Bootstrapped build system

The repository now includes a Bun-based build orchestrator that automates the workflow described above. The entry point lives in `src/index.ts` and can be invoked directly with Bun:

```bash
# show the plan without executing any commands
bun src/index.ts plan

# build every group sequentially and produce manifests & artifacts
bun src/index.ts build

# run a targeted or simulated build
bun src/index.ts build --only=@tscircuit/runframe --dry-run

# remove all cloned repositories and generated artifacts
bun src/index.ts clean
```

The build system performs the following high-level steps:

1. **Clone/update repositories** into `build/repos/<package>` using `git` (defaulting to the `main` branch with a fallback to `master`).
2. **Link local dependencies** by reading each package's `package.json` and adding any previously built packages via `yalc`.
3. **Install, build and publish** each package. Installation and build commands default to `bun install` and `bun run build`, but can be customised per package in `src/config.ts`.
4. **Publish to a local yalc store** at `build/.yalc-store` so downstream packages consume the freshly built versions.
5. **Bundle the final `tscircuit` package** into `artifacts/` using `npm pack` (skipped when `--skip-pack` is supplied).
6. **Record build metadata** in `build/manifests/latest.json`, including commit hashes, tarball paths and the exact options used for the run.

### Configuration

`src/config.ts` enumerates the dependency groups and repositories. Each `PackageConfig` entry can override install/build commands, skip publishing, or force additional `yalc` links. This makes it straightforward to tweak the pipeline for repos with custom build processes or monorepo layouts.

### Flags & options

The `build` and `plan` commands share a set of flags:

| Flag | Description |
| --- | --- |
| `--only` | Comma separated list of package names or slugs to build. |
| `--skip-install` / `--skip-build` / `--skip-publish` / `--skip-pack` | Skip specific phases. |
| `--skip-git` / `--skip-git-clean` | Avoid fetching or cleaning repositories (useful for iterative debugging). |
| `--dry-run` | Print every command that would run without executing it. |

The `plan` command prints the filtered group/package structure, making it easy to confirm which packages will run before executing a real build.

