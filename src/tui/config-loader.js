// config-loader.js — Load v2 internal config (load / migrate v1 / create defaults)

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createDefaultConfig, getIndividualWidgets } from './widget-registry.js';
import { writeInternalConfig, readCcstatuslineConfig as readCcConfig } from './config-writer.js';

const CONFIG_DIR = process.env.BMAD_CONFIG_DIR || path.join(os.homedir(), '.config', 'bmad-statusline');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

/**
 * Load v2 internal config following 3-path strategy:
 *   1. config.json exists + valid v2 -> return directly
 *   2. config.json absent -> scan ccstatusline for v1 widgets -> migrate
 *   3. Nothing found -> createDefaultConfig() -> write + return
 *   4. config.json corrupted -> createDefaultConfig() -> return (no write)
 */
export function loadConfig(paths = {}) {
  const ccConfigPath = paths.ccstatuslineConfig ||
    path.join(os.homedir(), '.config', 'ccstatusline', 'settings.json');
  const configPath = paths.internalConfig || CONFIG_PATH;

  // Path 1: Try reading internal config
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(raw);
      if (isValidV2(config)) {
        return ensureWidgetOrder(config);
      }
    } catch {
      // Path 4: Corrupted JSON -> fall back to defaults silently
      return createDefaultConfig();
    }
    // Parsed but not valid v2 structure -> treat as corrupted
    return createDefaultConfig();
  }

  // Path 2: No config.json -> check ccstatusline for v1 widgets
  const ccConfig = readCcConfig(ccConfigPath);
  if (ccConfig) {
    const bmadLine = findV1BmadLine(ccConfig);
    if (bmadLine !== -1) {
      const migrated = ensureWidgetOrder(migrateV1Config(ccConfig, bmadLine));
      // Write migrated internal config
      writeInternalConfig(migrated, { internalConfig: configPath });
      // Replace old bmad-* widgets in ccstatusline with bmad-line-0
      replaceV1WidgetsInCcstatusline(ccConfig, bmadLine, ccConfigPath, paths);
      return migrated;
    }
  }

  // Path 3: First install -> create defaults
  const defaults = createDefaultConfig();
  writeInternalConfig(defaults, { internalConfig: configPath });
  return defaults;
}

function ensureWidgetOrder(config) {
  const allIds = getIndividualWidgets().map(w => w.id);
  for (const line of config.lines) {
    if (!Array.isArray(line.widgetOrder)) {
      line.widgetOrder = [...line.widgets, ...allIds.filter(id => !line.widgets.includes(id))];
    } else {
      // Add any new widgets missing from existing widgetOrder
      for (const id of allIds) {
        if (!line.widgetOrder.includes(id)) {
          line.widgetOrder.push(id);
        }
      }
    }
  }
  if (!config.skillColors || typeof config.skillColors !== 'object' || Array.isArray(config.skillColors)) {
    config.skillColors = {};
  }
  if (!config.projectColors || typeof config.projectColors !== 'object' || Array.isArray(config.projectColors)) {
    config.projectColors = {};
  }
  return config;
}

function isValidV2(config) {
  return config &&
    Array.isArray(config.lines) &&
    config.lines.length === 3 &&
    config.lines.every(line =>
      line && typeof line === 'object' && Array.isArray(line.widgets)
    );
}

function findV1BmadLine(ccConfig) {
  if (!ccConfig || !Array.isArray(ccConfig.lines)) return -1;
  for (let i = 0; i < ccConfig.lines.length; i++) {
    const line = ccConfig.lines[i];
    if (!Array.isArray(line)) continue;
    if (line.some(w => w.id?.startsWith('bmad-') && w.type === 'custom-command')) {
      return i;
    }
  }
  return -1;
}

function getDefaultColor(widgetId) {
  const widgets = getIndividualWidgets();
  const found = widgets.find(w => w.id === widgetId);
  return found ? found.defaultColor : 'white';
}

function detectSeparatorStyle(lineWidgets) {
  const seps = lineWidgets.filter(w => w.id?.startsWith('sep-bmad-'));
  if (seps.length === 0) return 'serre';
  // Check separator type — any with spaces suggests wider styles
  // Default to serre if detection is ambiguous
  return 'serre';
}

function migrateV1Config(ccConfig, bmadLine) {
  const lineWidgets = ccConfig.lines[bmadLine];

  // Extract bmad custom-command widgets in order (skip separators)
  const bmadWidgets = lineWidgets
    .filter(w => w.id?.startsWith('bmad-') && w.type === 'custom-command')
    .map(w => w.id);

  if (bmadWidgets.length === 0) return createDefaultConfig();

  // Build colorModes from existing widget properties
  const colorModes = {};
  for (const w of lineWidgets) {
    if (!w.id?.startsWith('bmad-') || w.type !== 'custom-command') continue;
    colorModes[w.id] = w.preserveColors && w.id === 'bmad-workflow'
      ? { mode: 'dynamic' }
      : { mode: 'fixed', fixedColor: w.color || getDefaultColor(w.id) };
  }

  return {
    separator: detectSeparatorStyle(lineWidgets),
    customSeparator: null,
    lines: [
      { widgets: bmadWidgets, colorModes },
      { widgets: [], colorModes: {} },
      { widgets: [], colorModes: {} },
    ],
    presets: [null, null, null],
  };
}


function replaceV1WidgetsInCcstatusline(ccConfig, bmadLine, ccConfigPath, paths) {
  try {
    const backupPath = ccConfigPath + '.bak';
    const readerPath = paths.readerPath ||
      path.join(
        process.env.BMAD_CONFIG_DIR || path.join(os.homedir(), '.config', 'bmad-statusline'),
        'bmad-sl-reader.js'
      );

    // Backup current ccstatusline config
    const currentRaw = fs.readFileSync(ccConfigPath, 'utf8');
    fs.writeFileSync(backupPath, currentRaw, 'utf8');

    // Remove all bmad-* and sep-bmad-* widgets from the line
    ccConfig.lines[bmadLine] = ccConfig.lines[bmadLine].filter(
      w => !w.id?.startsWith('bmad-') && !w.id?.startsWith('sep-bmad-')
    );

    // Add single bmad-line-0 composite
    ccConfig.lines[bmadLine].push({
      id: 'bmad-line-0',
      type: 'custom-command',
      commandPath: `node "${readerPath}" line 0`,
      preserveColors: true,
    });

    // Write updated ccstatusline config
    const newRaw = JSON.stringify(ccConfig, null, 2) + '\n';
    fs.writeFileSync(ccConfigPath, newRaw, 'utf8');

    // Reread and validate (pattern 4)
    const verifyRaw = fs.readFileSync(ccConfigPath, 'utf8');
    JSON.parse(verifyRaw);
  } catch {
    // Best effort — restore from backup if possible
    try {
      const backupPath = ccConfigPath + '.bak';
      if (fs.existsSync(backupPath)) {
        const backup = fs.readFileSync(backupPath, 'utf8');
        fs.writeFileSync(ccConfigPath, backup, 'utf8');
      }
    } catch { /* silent */ }
  }
}
