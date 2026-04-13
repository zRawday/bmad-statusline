// config-loader.js — Load v2 internal config (load or create defaults)

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createDefaultConfig, getIndividualWidgets } from './widget-registry.js';
import { writeInternalConfig } from './config-writer.js';

const CONFIG_DIR = process.env.BMAD_CONFIG_DIR || path.join(os.homedir(), '.config', 'bmad-statusline');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

/**
 * Load v2 internal config:
 *   1. config.json exists + valid v2 -> return directly
 *   2. First install -> createDefaultConfig() -> write + return
 *   Corrupted config.json -> createDefaultConfig() -> return (no write)
 */
export function loadConfig(paths = {}) {
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
      // Corrupted JSON -> fall back to defaults silently
      return createDefaultConfig();
    }
    // Parsed but not valid v2 structure -> treat as corrupted
    return createDefaultConfig();
  }

  // Path 2: First install -> create defaults
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
      // Prune stale IDs no longer in registry, then add any new widgets
      line.widgetOrder = line.widgetOrder.filter(id => allIds.includes(id));
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
      line && typeof line === 'object' && Array.isArray(line.widgets) &&
      line.colorModes && typeof line.colorModes === 'object'
    );
}

