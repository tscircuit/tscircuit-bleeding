# tscircuit-bleeding

Bleeding untested builds of tscircuit with all dependencies

## Overview

This repository provides automated bleeding-edge builds of tscircuit and all its dependencies. The builds are triggered manually via GitHub Actions and create installable tarballs that include the latest changes from all tscircuit repositories.

## Installation

To install the latest bleeding edge build:

```bash
# Using bun (recommended)
bun add https://tarballs.tscircuit.com/tscircuit/bleeding-YYYY-MM-DD-HH-MM.tgz

# Using npm
npm install https://tarballs.tscircuit.com/tscircuit/bleeding-YYYY-MM-DD-HH-MM.tgz

# Using yarn
yarn add https://tarballs.tscircuit.com/tscircuit/bleeding-YYYY-MM-DD-HH-MM.tgz
```

Replace `YYYY-MM-DD-HH-MM` with the actual timestamp of the build you want to install.

## Build Process

The build process:

1. **Clones all tscircuit repositories** including core, soup, routing, and all related packages
2. **Uses Turborepo** to manage the monorepo structure and dependencies
3. **Builds packages in dependency order** ensuring proper linking
4. **Creates a single tarball** with the main tscircuit package and all dependencies
5. **Uploads to Cloudflare R2** for public distribution

## Triggering a Build

Builds are triggered manually via GitHub Actions:

1. Go to the [Actions tab](../../actions/workflows/build-bleeding.yml)
2. Click "Run workflow"
3. Optionally check "Force rebuild" to rebuild even if no changes are detected
4. Click "Run workflow" button

## Repositories Included

The bleeding edge build includes the following tscircuit repositories:

- `tscircuit/core` - Core circuit definition and rendering
- `tscircuit/soup` - Circuit soup format and utilities  
- `tscircuit/routing` - PCB routing algorithms
- `tscircuit/schematic-symbols` - Schematic symbol library
- `tscircuit/props` - Component props and utilities
- `tscircuit/math-utils` - Mathematical utilities
- `tscircuit/builder` - Circuit builder utilities
- `tscircuit/circuit-json` - Circuit JSON format
- And many more...

## Development

To test the build process locally:

```bash
# Install dependencies
npm install

# Run the build
npm run build

# Clean build artifacts
npm run clean
```

## Configuration

The build requires the following GitHub secrets for Cloudflare R2 upload:

- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- `CLOUDFLARE_R2_ACCESS_KEY_ID` - R2 access key ID
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY` - R2 secret access key  
- `CLOUDFLARE_R2_BUCKET_NAME` - Name of your R2 bucket

## Warning

⚠️ **These are bleeding edge builds** - they contain the latest unreleased changes and may be unstable. Use at your own risk in production environments.
