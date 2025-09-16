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
