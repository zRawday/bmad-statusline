import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStatusLineConfig, getWidgetDefinitions, getHookConfig } from './defaults.js';
import { createDefaultConfig } from './tui/widget-registry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readerSource = path.join(__dirname, 'reader', 'bmad-sl-reader.js');
const workflowColorsSource = path.join(__dirname, 'reader', 'workflow-colors.cjs');
const hookSource = path.join(__dirname, 'hook', 'bmad-hook.js');

const home = os.homedir();
const defaultPaths = {
  claudeSettings: path.join(home, '.claude', 'settings.json'),
  claudeDir: path.join(home, '.claude'),
  ccstatuslineSettings: path.join(home, '.config', 'ccstatusline', 'settings.json'),
  ccstatuslineDir: path.join(home, '.config', 'ccstatusline'),
  readerDest: path.join(home, '.config', 'bmad-statusline', 'bmad-sl-reader.js'),
  readerDir: path.join(home, '.config', 'bmad-statusline'),
  hookDest: path.join(home, '.config', 'bmad-statusline', 'bmad-hook.js'),
  cacheDir: path.join(home, '.cache', 'bmad-status'),
};

// --- ANSI colors ---

const G = '\x1b[32m', R = '\x1b[31m', C = '\x1b[36m', D = '\x1b[90m', B = '\x1b[1m', _ = '\x1b[0m';

// --- Logging helpers ---

function logSuccess(target, message) { console.log(`     ${G}\u2713${_} ${target} ${D}\u2014${_} ${G}${message}${_}`); }
function logSkipped(target, message) { console.log(`     ${D}\u25CB ${target} \u2014 ${message}${_}`); }
function logError(target, message)   { console.log(`     ${R}\u2717 ${target} \u2014 ${message}${_}`); }
function logSection(emoji, title) { console.log(`\n  ${emoji} ${B}${C}${title}${_}`); }

// --- JSON mutation helpers ---

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function backupFile(filePath) {
  fs.copyFileSync(filePath, filePath + '.bak');
}

function writeJsonSafe(filePath, obj) {
  const json = JSON.stringify(obj, null, 2);
  fs.writeFileSync(filePath, json + '\n', 'utf8');
  // Validate post-write by rereading and parsing
  const reread = fs.readFileSync(filePath, 'utf8');
  JSON.parse(reread);
}

// --- Install targets ---

function installTarget1(paths) {
  const target = '~/.claude/settings.json';
  try {
    fs.mkdirSync(paths.claudeDir, { recursive: true });

    if (fs.existsSync(paths.claudeSettings)) {
      const config = readJsonFile(paths.claudeSettings);
      if ('statusLine' in config) {
        logSkipped(target, 'statusLine already configured');
        return;
      }
      backupFile(paths.claudeSettings);
      config.statusLine = getStatusLineConfig();
      writeJsonSafe(paths.claudeSettings, config);
    } else {
      const config = { statusLine: getStatusLineConfig() };
      writeJsonSafe(paths.claudeSettings, config);
    }
    logSuccess(target, 'statusLine configured');
  } catch (err) {
    try {
      const bakPath = paths.claudeSettings + '.bak';
      if (fs.existsSync(bakPath)) fs.copyFileSync(bakPath, paths.claudeSettings);
    } catch {}
    logError(target, err.message);
    return false;
  }
}

function installTarget2(paths) {
  const target = '~/.config/ccstatusline/settings.json';
  try {
    fs.mkdirSync(paths.ccstatuslineDir, { recursive: true });

    let config;
    if (fs.existsSync(paths.ccstatuslineSettings)) {
      config = readJsonFile(paths.ccstatuslineSettings);
    } else {
      config = { version: 3, lines: [[], [], []] };
    }

    // Ensure lines array exists
    if (!Array.isArray(config.lines)) {
      config.lines = [[], [], []];
    }

    const allWidgets = config.lines.flat();
    const desired = getWidgetDefinitions(paths.readerDest);
    const existingV2 = new Set(allWidgets.filter(w => w.id?.startsWith('bmad-line-')).map(w => w.id));
    const missing = desired.filter(w => !existingV2.has(w.id));

    // All 3 bmad-line-* already present — skip
    if (missing.length === 0) {
      logSkipped(target, 'bmad-line-* already present');
      return;
    }

    if (fs.existsSync(paths.ccstatuslineSettings)) {
      backupFile(paths.ccstatuslineSettings);
    }

    // v1 detection: individual bmad-* widgets (not bmad-line-*) — remove before injecting v2
    const hasV1 = allWidgets.some(w => w.id?.startsWith('bmad-') && w.type === 'custom-command' && !w.id.startsWith('bmad-line-'));
    if (hasV1) {
      config.lines = config.lines.map(line =>
        line.filter(w => !w.id?.startsWith('bmad-') && !w.id?.startsWith('sep-bmad-'))
      );
    } else {
      // Clean orphan sep-bmad-* separators even on fresh install (no v1 widgets)
      const hasOrphanSeps = allWidgets.some(w => w.id?.startsWith('sep-bmad-'));
      if (hasOrphanSeps) {
        config.lines = config.lines.map(line =>
          line.filter(w => !w.id?.startsWith('sep-bmad-'))
        );
      }
    }

    // Inject each bmad-line-N on the corresponding ccstatusline line
    for (const w of missing) {
      const lineIdx = parseInt(w.id.replace('bmad-line-', ''), 10);
      while (config.lines.length <= lineIdx) config.lines.push([]);
      config.lines[lineIdx] = [...config.lines[lineIdx], w];
    }

    writeJsonSafe(paths.ccstatuslineSettings, config);
    logSuccess(target, hasV1
      ? 'upgraded v1 widgets to v2 composites'
      : existingV2.size > 0
        ? `added missing ${missing.map(w => w.id).join(', ')}`
        : 'BMAD widgets injected');
  } catch (err) {
    try {
      const bakPath = paths.ccstatuslineSettings + '.bak';
      if (fs.existsSync(bakPath)) fs.copyFileSync(bakPath, paths.ccstatuslineSettings);
    } catch {}
    logError(target, err.message);
    return false;
  }
}

function installTarget3(paths) {
  const target = '~/.config/bmad-statusline/bmad-sl-reader.js';
  try {
    fs.mkdirSync(paths.readerDir, { recursive: true });
    const existed = fs.existsSync(paths.readerDest);
    fs.copyFileSync(readerSource, paths.readerDest);
    fs.copyFileSync(workflowColorsSource, path.join(paths.readerDir, 'workflow-colors.cjs'));
    logSuccess(target, existed ? 'updated' : 'installed');
  } catch (err) {
    logError(target, err.message);
    return false;
  }
}

function installTarget4(paths) {
  const target = '~/.cache/bmad-status/';
  try {
    if (fs.existsSync(paths.cacheDir)) {
      logSkipped(target, 'already exists');
      return;
    }
    fs.mkdirSync(paths.cacheDir, { recursive: true });
    logSuccess(target, 'created');
  } catch (err) {
    logError(target, err.message);
    return false;
  }
}

function installTarget5(paths) {
  const target = '~/.claude/settings.json hooks';
  try {
    if (!fs.existsSync(paths.claudeSettings)) {
      logSkipped(target, 'settings.json not found');
      return;
    }

    const config = readJsonFile(paths.claudeSettings);

    // Create structure if missing (coerce non-object/non-array — follows Target 2 precedent)
    if (!config.hooks || typeof config.hooks !== 'object' || Array.isArray(config.hooks)) config.hooks = {};

    const desired = getHookConfig(paths.hookDest);
    let changed = false;

    // Phase 2 upgrade: detect and remove stale Skill matcher from PostToolUse
    if (Array.isArray(config.hooks.PostToolUse)) {
      const before = config.hooks.PostToolUse.length;
      config.hooks.PostToolUse = config.hooks.PostToolUse.filter(entry => {
        const isBmadSkill = entry.matcher === 'Skill' &&
          Array.isArray(entry.hooks) &&
          entry.hooks.some(h => h.command && h.command.includes('bmad-hook.js'));
        return !isBmadSkill;
      });
      if (config.hooks.PostToolUse.length < before) changed = true;
    }

    // Per-event-type granular merge: add only missing bmad matchers
    for (const [event, desiredEntries] of Object.entries(desired.hooks)) {
      if (!Array.isArray(config.hooks[event])) config.hooks[event] = [];
      for (const entry of desiredEntries) {
        const alreadyExists = config.hooks[event].some(existing =>
          existing.matcher === entry.matcher &&
          Array.isArray(existing.hooks) &&
          existing.hooks.some(h => h.command && h.command.includes('bmad-hook.js'))
        );
        if (!alreadyExists) {
          config.hooks[event].push(entry);
          changed = true;
        }
      }
    }

    if (!changed) {
      logSkipped(target, 'hook config already present');
      return;
    }

    backupFile(paths.claudeSettings);
    writeJsonSafe(paths.claudeSettings, config);
    logSuccess(target, 'hook config injected');
  } catch (err) {
    try {
      const bakPath = paths.claudeSettings + '.bak';
      if (fs.existsSync(bakPath)) fs.copyFileSync(bakPath, paths.claudeSettings);
    } catch {}
    logError(target, err.message);
    return false;
  }
}

function installTarget6(paths) {
  const target = '~/.config/bmad-statusline/bmad-hook.js';
  try {
    fs.mkdirSync(paths.readerDir, { recursive: true });
    const existed = fs.existsSync(paths.hookDest);
    fs.copyFileSync(hookSource, paths.hookDest);
    logSuccess(target, existed ? 'updated' : 'installed');
  } catch (err) {
    logError(target, err.message);
    return false;
  }
}

function installTarget7(paths) {
  const target = '~/.config/bmad-statusline/config.json';
  try {
    const configPath = path.join(paths.readerDir, 'config.json');
    if (fs.existsSync(configPath)) {
      logSkipped(target, 'already exists');
      return;
    }
    fs.mkdirSync(paths.readerDir, { recursive: true });
    const config = createDefaultConfig();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    logSuccess(target, 'created default configuration');
  } catch (err) {
    logError(target, err.message);
    return false;
  }
}

// --- Main ---

export default function install(paths = defaultPaths) {
  console.log(`\n  ${B}\uD83D\uDD27 Installing bmad-statusline...${_}`);

  logSection('\uD83D\uDCCB', 'Claude Code & ccstatusline');
  const r1 = installTarget1(paths);
  const r2 = installTarget2(paths);

  logSection('\uD83D\uDCE6', 'Deploying files');
  const r3 = installTarget3(paths);
  const r4 = installTarget4(paths);

  logSection('\uD83D\uDD17', 'Hooks & configuration');
  const r5 = installTarget5(paths);
  const r6 = installTarget6(paths);
  const r7 = installTarget7(paths);

  console.log(`\n  ${D}${'─'.repeat(38)}${_}`);
  if ([r1, r2, r3, r4, r5, r6, r7].some(r => r === false)) {
    console.log(`\n  ${R}${B}\u26A0  Installation completed with errors.${_}\n`);
    process.exit(1);
  }
  console.log(`\n  ${G}${B}\uD83C\uDF89 bmad-statusline installed!${_}`);
  console.log(`  ${D}Run${_} npx bmad-statusline ${D}to open the config menu.${_}\n`);
}
