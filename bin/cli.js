#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { R, C, B, D, _ } from '../src/cli-utils.js';
import { isDeployStale, syncDeploy, getPackageVersion, getDeployedVersion } from '../src/deploy.js';

const USAGE = `bmad-statusline — BMAD workflow status line for ccstatusline

Usage: bmad-statusline [command]

Commands:
  (no command) Launch TUI configurator
  install      Install status line widgets and reader
  uninstall    Remove status line widgets and reader
  clean        Clean cache files
  doctor       Diagnose and repair the status line

Options:
  -h, --help   Show this help text`;

const command = process.argv[2];

if (!command) {
  const configDir = process.env.BMAD_CONFIG_DIR || path.join(os.homedir(), '.config', 'bmad-statusline');
  const readerDest = path.join(configDir, 'bmad-sl-reader.js');
  if (!fs.existsSync(readerDest)) {
    console.log(`\n  ${R}${B}bmad-statusline is not installed.${_}\n`);
    console.log(`  Run the following command to install:\n`);
    console.log(`    ${C}${B}npx bmad-statusline install${_}\n`);
    process.exit(1);
  }
  // Self-heal: npx refreshes the package cache but not the deploy dir, so the
  // reader/hook ccstatusline runs can lag behind npm after a version bump. When the
  // running package is newer than what was last deployed, re-copy now — so a plain
  // `npx bmad-statusline` propagates updates without an explicit `install`.
  try {
    const pkgVer = getPackageVersion();
    if (isDeployStale(configDir, pkgVer)) {
      const prev = getDeployedVersion(configDir);
      syncDeploy(configDir, pkgVer);
      console.log(`  ${D}↻ updated deployed reader ${prev ? 'v' + prev : '(unstamped)'} → v${pkgVer}${_}`);
    }
  } catch { /* never block the TUI on a sync hiccup */ }
  const { default: launchTui } = await import('../src/tui/app.js');
  await launchTui();
} else if (command === '--help' || command === '-h') {
  console.log(USAGE);
} else {
  switch (command) {
    case 'install':
    case 'uninstall':
    case 'clean':
    case 'doctor': {
      const mod = await import(`../src/${command}.js`);
      await mod.default();
      break;
    }
    default:
      console.log(USAGE);
      process.exit(1);
  }
}
