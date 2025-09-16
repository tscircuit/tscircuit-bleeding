#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test with just a few repositories
const TEST_REPOS = [
  'tscircuit/math-utils',
  'tscircuit/props'
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

async function testBuild() {
  const rootDir = process.cwd();
  const packagesDir = path.join(rootDir, 'test-packages');
  
  log('Starting test build process...');

  // Clean and create packages directory
  if (fs.existsSync(packagesDir)) {
    runCommand(`rm -rf ${packagesDir}`);
  }
  fs.mkdirSync(packagesDir, { recursive: true });

  // Clone test repositories
  log('Cloning test repositories...');
  for (const repo of TEST_REPOS) {
    const repoName = repo.split('/')[1];
    const targetDir = path.join(packagesDir, repoName);
    
    log(`Cloning ${repo}...`);
    const result = runCommand(`git clone https://github.com/${repo}.git ${targetDir}`);
    if (result === null) {
      log(`Failed to clone ${repo}, skipping...`);
      continue;
    }
    
    // Check if package.json exists
    const pkgJsonPath = path.join(targetDir, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      log(`Found package: ${pkgJson.name}@${pkgJson.version}`);
    }
  }

  // Test tarball creation
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  const tarballName = `test-tscircuit-bleeding-${timestamp}.tgz`;
  
  log('Creating test package structure...');
  const testPkgDir = path.join(rootDir, 'test-dist');
  if (fs.existsSync(testPkgDir)) {
    runCommand(`rm -rf ${testPkgDir}`);
  }
  fs.mkdirSync(testPkgDir, { recursive: true });

  // Create test package.json
  const testPkgJson = {
    name: 'tscircuit-test',
    version: `0.0.0-bleeding-${timestamp}`,
    description: 'Test bleeding edge build of tscircuit',
    main: 'index.js'
  };

  fs.writeFileSync(
    path.join(testPkgDir, 'package.json'), 
    JSON.stringify(testPkgJson, null, 2)
  );
  
  fs.writeFileSync(
    path.join(testPkgDir, 'index.js'), 
    '// Test tscircuit bleeding edge build\nmodule.exports = "Hello from tscircuit bleeding edge!";'
  );

  // Create test tarball
  log(`Creating test tarball: ${tarballName}`);
  runCommand(`tar -czf ${tarballName} -C test-dist .`);

  // Verify tarball contents
  log('Verifying tarball contents...');
  runCommand(`tar -tzf ${tarballName}`);

  log(`Test build complete! Created ${tarballName}`);
  
  // Cleanup
  runCommand(`rm -rf ${packagesDir} ${testPkgDir} ${tarballName}`);
}

if (require.main === module) {
  testBuild().catch(error => {
    console.error('Test build failed:', error);
    process.exit(1);
  });
}