// config-writer.js — Write internal config + sync ccstatusline on line occupancy changes

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CONFIG_DIR = process.env.BMAD_CONFIG_DIR || path.join(os.homedir(), '.config', 'bmad-statusline');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

/**
 * Write internal config to disk.
 * Pattern 14: no backup, no validate. Synchronous I/O (pattern 2).
 */
export function writeInternalConfig(config, paths = {}) {
  const configPath = paths.internalConfig || CONFIG_PATH;
  const configDir = path.dirname(configPath);
  try {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  } catch {
    // Write failure — config state preserved in React, retry on next interaction
  }
}

/**
 * Sync ccstatusline config only when line occupancy changes
 * (empty -> non-empty or non-empty -> empty).
 * Pattern 4 for ccstatusline writes (backup/validate).
 */
export function syncCcstatuslineIfNeeded(oldConfig, newConfig, paths = {}) {
  let needsSync = false;
  for (let i = 0; i < 3; i++) {
    const wasEmpty = oldConfig.lines[i].widgets.length === 0;
    const isEmpty = newConfig.lines[i].widgets.length === 0;
    if (wasEmpty !== isEmpty) { needsSync = true; break; }
  }
  if (!needsSync) return;

  syncCcstatuslineFromScratch(newConfig, paths);
}

/**
 * Full rebuild of bmad-line-* widgets in ccstatusline.
 * Removes all existing bmad-line-*, adds one per non-empty line.
 * Pattern 4 for ccstatusline writes (backup/validate).
 */
export function syncCcstatuslineFromScratch(config, paths = {}) {
  const ccConfigPath = paths.ccstatuslineConfig ||
    path.join(os.homedir(), '.config', 'ccstatusline', 'settings.json');
  const readerPath = paths.readerPath ||
    path.join(CONFIG_DIR, 'bmad-sl-reader.js');

  const ccConfig = readCcstatuslineConfig(ccConfigPath);
  if (!ccConfig) return;

  // Remove all bmad-line-* widgets from all lines
  for (let i = 0; i < ccConfig.lines.length; i++) {
    if (!Array.isArray(ccConfig.lines[i])) continue;
    ccConfig.lines[i] = ccConfig.lines[i].filter(
      w => !w.id?.startsWith('bmad-line-')
    );
  }

  // Add bmad-line-N for each non-empty line
  for (let i = 0; i < 3; i++) {
    if (config.lines[i].widgets.length > 0) {
      addBmadLineToCcLine(ccConfig, i, readerPath);
    }
  }

  writeCcstatuslineConfig(ccConfig, ccConfigPath);
}

// --- Internal helpers ---

export function readCcstatuslineConfig(configPath) {
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function addBmadLineToCcLine(ccConfig, lineIndex, readerPath) {
  // Ensure line array exists
  while (ccConfig.lines.length <= lineIndex) {
    ccConfig.lines.push([]);
  }
  if (!Array.isArray(ccConfig.lines[lineIndex])) {
    ccConfig.lines[lineIndex] = [];
  }

  ccConfig.lines[lineIndex].push({
    id: `bmad-line-${lineIndex}`,
    type: 'custom-command',
    commandPath: `node "${readerPath}" line ${lineIndex}`,
    preserveColors: true,
  });
}

/**
 * Write ccstatusline config following pattern 4:
 * read -> parse -> backup(.bak) -> modify -> stringify(null, 2) -> write -> reread -> parse(validate)
 */
function writeCcstatuslineConfig(ccConfig, ccConfigPath) {
  try {
    const backupPath = path.join(path.dirname(ccConfigPath), path.basename(ccConfigPath) + '.bak');

    // Backup current file
    const currentRaw = fs.readFileSync(ccConfigPath, 'utf8');
    fs.writeFileSync(backupPath, currentRaw, 'utf8');

    // Write new config
    const newRaw = JSON.stringify(ccConfig, null, 2) + '\n';
    fs.writeFileSync(ccConfigPath, newRaw, 'utf8');

    // Reread and validate
    const verifyRaw = fs.readFileSync(ccConfigPath, 'utf8');
    JSON.parse(verifyRaw);
  } catch {
    // Best effort restore from backup
    try {
      const backupPath = path.join(path.dirname(ccConfigPath), path.basename(ccConfigPath) + '.bak');
      if (fs.existsSync(backupPath)) {
        const backup = fs.readFileSync(backupPath, 'utf8');
        fs.writeFileSync(ccConfigPath, backup, 'utf8');
      }
    } catch { /* silent */ }
  }
}
