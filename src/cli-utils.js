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
  // Atomic temp+rename: these are live-read files (~/.claude/settings.json is read
  // by Claude Code, ccstatusline settings on every render) — an in-place truncate
  // write would expose torn JSON to concurrent readers and a crash mid-write would
  // corrupt the file permanently. (Same pattern as the hook's status writes.)
  const json = JSON.stringify(obj, null, 2) + '\n';
  const tmpPath = filePath + '.' + process.pid + '.tmp';
  try {
    fs.writeFileSync(tmpPath, json, 'utf8');
    fs.renameSync(tmpPath, filePath);
  } catch (e) {
    try { fs.unlinkSync(tmpPath); } catch {} // don't leak our temp on failure
    throw e;
  }
}
