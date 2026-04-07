// cli-utils.js — Shared helpers for install/uninstall CLI commands

import fs from 'node:fs';

// --- ANSI colors ---

export const G = '\x1b[32m';
export const R = '\x1b[31m';
export const C = '\x1b[36m';
export const D = '\x1b[90m';
export const B = '\x1b[1m';
export const _ = '\x1b[0m';

// --- Logging helpers ---

export function logSuccess(target, message) { console.log(`     ${G}\u2713${_} ${target} ${D}\u2014${_} ${G}${message}${_}`); }
export function logSkipped(target, message) { console.log(`     ${D}\u25CB ${target} \u2014 ${message}${_}`); }
export function logError(target, message)   { console.log(`     ${R}\u2717 ${target} \u2014 ${message}${_}`); }
export function logSection(emoji, title) { console.log(`\n  ${emoji} ${B}${C}${title}${_}`); }

// --- JSON mutation helpers ---

export function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function backupFile(filePath) {
  fs.copyFileSync(filePath, filePath + '.bak');
}

export function writeJsonSafe(filePath, obj) {
  const json = JSON.stringify(obj, null, 2);
  fs.writeFileSync(filePath, json + '\n', 'utf8');
  // Validate post-write by rereading and parsing
  const reread = fs.readFileSync(filePath, 'utf8');
  JSON.parse(reread);
}
