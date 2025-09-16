#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// List of tscircuit repositories to clone and build
const TSCIRCUIT_REPOS = [
  'tscircuit/core',
  'tscircuit/soup',
  'tscircuit/routing',
  'tscircuit/schematic-symbols', 
  'tscircuit/props',
  'tscircuit/math-utils',
  'tscircuit/builder',
  'tscircuit/circuit-json',
  'tscircuit/circuit-json-to-connectivity-map',
  'tscircuit/dsn-converter',
  'tscircuit/footprinter',
  'tscircuit/3d-viewer',
  'tscircuit/autorouting-dataset',
  'tscircuit/assembly-viewer',
  'tscircuit/jlcsmt',
  'tscircuit/jscad-fiber',
  'tscircuit/fake-freerouting-api',
  'tscircuit/freerouting-cli',
  'tscircuit/infra-components',
  'tscircuit/kicad-converter',
  'tscircuit/rai-tscircuit',
  'tscircuit/schematic-viewer',
  'tscircuit/tscircuit',
  'tscircuit/paste',
  'tscircuit/prompt-benchmarks',
  'tscircuit/winterspec',
  'tscircuit/debug'
];

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function runCommand(command, options = {}) {
  log(`Running: ${command}`);
  try {
    return execSync(command, { 
      stdio: 'inherit', 
      encoding: 'utf8',
      ...options 
    });
  } catch (error) {
    log(`Command failed: ${command}`);
    console.error(error.message);
    return null;
  }
}

async function main() {
  const rootDir = process.cwd();
  const packagesDir = path.join(rootDir, 'packages');
  
  log('Starting tscircuit bleeding edge build process...');

  // Clean and create packages directory
  if (fs.existsSync(packagesDir)) {
    runCommand('rm -rf packages');
  }
  fs.mkdirSync(packagesDir, { recursive: true });

  // Clone all repositories
  log('Cloning tscircuit repositories...');
  const successfulRepos = [];
  for (const repo of TSCIRCUIT_REPOS) {
    const repoName = repo.split('/')[1];
    const targetDir = path.join(packagesDir, repoName);
    
    log(`Cloning ${repo}...`);
    const result = runCommand(`git clone https://github.com/${repo}.git ${targetDir}`);
    if (result !== null) {
      successfulRepos.push(repo);
    } else {
      log(`Failed to clone ${repo}, skipping...`);
    }
  }
  
  log(`Successfully cloned ${successfulRepos.length}/${TSCIRCUIT_REPOS.length} repositories`);

  // Install dependencies and build packages
  log('Installing dependencies...');
  runCommand('npm install');

  // Install dependencies for each package
  log('Installing dependencies for packages...');
  for (const repo of successfulRepos) {
    const repoName = repo.split('/')[1];
    const targetDir = path.join(packagesDir, repoName);
    const pkgJsonPath = path.join(targetDir, 'package.json');
    
    if (fs.existsSync(pkgJsonPath)) {
      log(`Installing dependencies for ${repoName}...`);
      // Try npm install, fallback to yarn if available
      const installResult = runCommand(`cd ${targetDir} && npm install --ignore-scripts`);
      if (installResult === null) {
        log(`npm install failed for ${repoName}, trying yarn...`);
        runCommand(`cd ${targetDir} && yarn install --ignore-scripts`);
      }
    }
  }

  log('Building packages with turbo...');
  const buildResult = runCommand('npx turbo build --filter="./packages/*"');
  if (buildResult === null) {
    log('Turbo build failed, trying individual builds...');
    for (const repo of successfulRepos) {
      const repoName = repo.split('/')[1];
      const targetDir = path.join(packagesDir, repoName);
      const pkgJsonPath = path.join(targetDir, 'package.json');
      
      if (fs.existsSync(pkgJsonPath)) {
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        if (pkgJson.scripts && pkgJson.scripts.build) {
          log(`Building ${repoName} individually...`);
          runCommand(`cd ${targetDir} && npm run build`);
        }
      }
    }
  }

  // Create main tscircuit package
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  const tarballName = `tscircuit-bleeding-${timestamp}.tgz`;
  
  log('Creating main package structure...');
  const mainPkgDir = path.join(rootDir, 'dist');
  if (fs.existsSync(mainPkgDir)) {
    runCommand('rm -rf dist');
  }
  fs.mkdirSync(mainPkgDir, { recursive: true });

  // Create main package.json
  const mainPkgJson = {
    name: 'tscircuit',
    version: `0.0.0-bleeding-${timestamp}`,
    description: 'Bleeding edge build of tscircuit with all dependencies',
    main: 'index.js',
    dependencies: {}
  };

  // Find and copy the main tscircuit package
  let mainPackageFound = false;
  for (const repo of successfulRepos) {
    const repoName = repo.split('/')[1];
    const srcDir = path.join(packagesDir, repoName);
    const pkgJsonPath = path.join(srcDir, 'package.json');
    
    if (fs.existsSync(pkgJsonPath)) {
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      if (pkgJson.name && repoName === 'tscircuit') {
        // This is the main tscircuit package - copy it as the base
        log(`Found main tscircuit package, copying to dist...`);
        runCommand(`cp -r ${srcDir}/* ${mainPkgDir}/`);
        Object.assign(mainPkgJson, pkgJson);
        mainPkgJson.version = `0.0.0-bleeding-${timestamp}`;
        mainPackageFound = true;
        break;
      }
    }
  }
  
  if (!mainPackageFound) {
    log('Main tscircuit package not found, creating minimal package...');
    // Create a minimal index.js if main package wasn't found
    fs.writeFileSync(
      path.join(mainPkgDir, 'index.js'),
      '// TSCircuit bleeding edge build\n// Main package not available\nmodule.exports = {};'
    );
  }

  // Write the main package.json
  fs.writeFileSync(
    path.join(mainPkgDir, 'package.json'), 
    JSON.stringify(mainPkgJson, null, 2)
  );

  // Create tarball
  log(`Creating tarball: ${tarballName}`);
  runCommand(`tar -czf ${tarballName} -C dist .`);

  log(`Build complete! Created ${tarballName}`);
  log(`Install with: npm install https://tarballs.tscircuit.com/tscircuit/${tarballName}`);
  
  // Output for GitHub Actions
  console.log(`::set-output name=tarball_name::${tarballName}`);
  console.log(`::set-output name=timestamp::${timestamp}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Build failed:', error);
    process.exit(1);
  });
}

module.exports = { main };