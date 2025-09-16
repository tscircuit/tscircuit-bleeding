# tscircuit-bleeding

Bleeding untested builds of tscircuit

## Overview

We're going to have a github repo called "tscircuit-bleeding" that pushes a tarball every time there's an update to any major repo then runs a full "build process" that individually builds every dependency. At the end of the build process, it will push a tarball to a public cloudflare bucket. When a user runs bun add https://tarballs.tscircuit.com/tscircuit/bleeding-2025-09-15-01:31.tgz it will install the latest version of tscircuit with all the untested dependencies up to date.
That tarball path is hard to find, so tsci upgrade --bleeding will always automatically install it. tsci upgrade --latest or tsci upgrade --stable will revert back to the stable version.
The tscircuit-bleeding repo will be a bit complicated, it should use turborepo to clone and build each dependency, making sure to link them together. When it's done, it pushes up the tarball.

## Implementation Details

We are rebuilding select dependencies, not all dependencies of tscircuit, specifically, we want to clone, build and replace the versions of these dependencies. Dependencies should be built in parallel within
the group, but the group should be built in order.

- Group 1
  - @tscircuit/core (github.com/tscircuit/core)
  - @tscircuit/pcb-viewer
  - @tscircuit/schematic-viewer
  - @tscircuit/3d-viewer
- Group 2
  - @tscircuit/eval (github.com/tscircuit/eval)
  - @tscircuit/runframe
- Group 3
  - @tscircuit/cli
- Group 4
  - tscircuit

These packages have dependencies on one another, e.g. @tscircuit/runframe depends on @tscircuit/pcb-viewer, so @tscircuit/pcb-viewer needs to be built first. They are universally built with `bun run build`. Some dependencies will depend on later dependencies- this is OK. Where a later dependency is required, we just use the version in the package.json file.

## Build pipeline

The repository now ships with a repeatable build pipeline that clones, builds, and bundles
the bleeding-edge versions of the stack. Everything is orchestrated through Turbo and Bun
scripts so that a single command can fetch the latest code, rebuild it, and produce a
distribution tarball.

### Prerequisites

- Bun (used for scripting and the package builds)
- Git
- npm (used for packing the individual packages and the final bundle)

### Commands

| Command                  | Description                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `bun run bootstrap`      | Clones or updates each dependency repository into `.tscircuit-bleeding/repos`.             |
| `bun run build-packages` | Runs installs/builds for every package in the configured order and writes build manifests. |
| `bun run bundle`         | Builds everything (bootstrap + build) and assembles a bundle tarball in `dist/`.           |
| `bun run clean`          | Removes the workspace (`.tscircuit-bleeding/`) and `dist/` output.                         |

The same sequence can be executed through Turbo with `turbo run bundle` if you prefer the
Turbo task runner UX.

### Environment overrides

The build scripts can be tuned via environment variables when you need faster experiments
or partial builds:

- `TSCB_GROUP_FILTER=group-1,group-2` – only operate on the listed build groups.
- `TSCB_CONCURRENCY=1` – force a specific level of parallelism (useful when debugging).
- `TSCB_DISABLE_PATCH=1` – avoid rewriting `package.json` files to point at local clones.
- `TSCB_SKIP_BUILDS=1` – skip `bun install`/`bun run build` and produce manifests only.
- `TSCB_SKIP_PACKAGE_PACKS=1` – skip `npm pack` and record placeholder artifacts in the bundle.

### Outputs

- **`.tscircuit-bleeding/repos/`** – working copies of each dependency repository.
- **`.tscircuit-bleeding/manifests/`** – JSON manifests capturing build metadata (commit, version, local links).
- **`.tscircuit-bleeding/packs/`** – `npm pack` output for every dependency after a successful build.
- **`dist/tscircuit-bleeding-<timestamp>.tgz`** – the final bundle tarball containing manifests and all dependency tarballs.

The final tarball includes a `manifest.json` that records exactly which commit and version
were packaged, making it easy to audit or reproduce a build.
