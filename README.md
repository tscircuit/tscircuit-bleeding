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

## Bootstrapped build pipeline

This repository now contains a Bun-powered build orchestrator that will clone, build, link and package the bleeding release of tscircuit.

- All repositories are cloned into `./workdir/<package>` and reused on subsequent runs.
- Build artifacts and the generated tarball are written to `./dist`.
- A manifest (`dist/build-manifest.json`) captures the commit for every dependency that was built.

### Running the build locally

```bash
bun install
bun run build
```

The build process fetches the latest commits from each dependency, runs their `bun run build` command and links them together before packaging `tscircuit` with `npm pack`. The resulting tarball will be renamed to `tscircuit-bleeding-<timestamp>.tgz` and placed in the `dist/` directory alongside the manifest.

To override the workspace or output directories you can pass flags directly to the CLI:

```bash
# Use a custom workspace and output directory
bun run src/index.ts build --workspace /tmp/bleeding-workdir --dist /tmp/bleeding-dist
```
