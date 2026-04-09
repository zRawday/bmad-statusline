#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { R, C, B, _ } from '../src/cli-utils.js';

const USAGE = `bmad-statusline — BMAD workflow status line for ccstatusline

Usage: bmad-statusline [command]

Commands:
  (no command) Launch TUI configurator
  install      Install status line widgets and reader
  uninstall    Remove status line widgets and reader
  clean        Clean cache files

Options:
  -h, --help   Show this help text`;

const command = process.argv[2];

if (!command) {
  const configDir = process.env.BMAD_CONFIG_DIR || path.join(os.homedir(), '.config', 'bmad-statusline');
  const readerDest = path.join(configDir, 'bmad-sl-reader.js');
  if (!fs.existsSync(readerDest)) {
    console.log(`\n  ${R}${B}bmad-statusline is not installed.${_}\n`);
    console.log(`  Run the following command to install:\n`);
    console.log(`    ${C}${B}bmad-statusline install${_}\n`);
    process.exit(1);
  }
  const { default: launchTui } = await import('../src/tui/app.js');
  await launchTui();
} else if (command === '--help' || command === '-h') {
  console.log(USAGE);
} else {
  switch (command) {
    case 'install':
    case 'uninstall':
    case 'clean': {
      const mod = await import(`../src/${command}.js`);
      await mod.default();
      break;
    }
    default:
      console.log(USAGE);
      process.exit(1);
  }
}
