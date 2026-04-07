import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { G, R, B, D, _, logSuccess, logSkipped, logError, logSection, readJsonFile, backupFile, writeJsonSafe } from './cli-utils.js';

const home = os.homedir();
const defaultPaths = {
  claudeSettings: path.join(home, '.claude', 'settings.json'),
  ccstatuslineSettings: path.join(home, '.config', 'ccstatusline', 'settings.json'),
  readerDir: path.join(home, '.config', 'bmad-statusline'),
  cacheDir: process.env.BMAD_CACHE_DIR || path.join(home, '.cache', 'bmad-status'),
  claudeMd: path.join(process.cwd(), '.claude', 'CLAUDE.md'),
  settingsLocal: path.join(process.cwd(), '.claude', 'settings.local.json'),
};

// ANSI colors, logging helpers, JSON helpers imported from cli-utils.js

// --- Uninstall targets ---

function uninstallTarget1() {
  logSkipped('~/.claude/settings.json', 'statusLine preserved (ccstatusline independent)');
}

function uninstallTarget2(paths) {
  const target = '~/.config/ccstatusline/settings.json';
  try {
    if (!fs.existsSync(paths.ccstatuslineSettings)) {
      logSkipped(target, 'file not found');
      return;
    }

    const config = readJsonFile(paths.ccstatuslineSettings);
    if (!Array.isArray(config.lines)) {
      logSkipped(target, 'no lines array found');
      return;
    }

    // Matches v2 composites (bmad-line-*), v1 individual widgets (bmad-*), and separators (sep-bmad-*)
    const isBmad = (w) => w.id && (w.id.startsWith('bmad-') || w.id.startsWith('sep-bmad-'));
    const hasBmad = config.lines.flat().some(isBmad);
    if (!hasBmad) {
      logSkipped(target, 'no BMAD widgets found');
      return;
    }

    backupFile(paths.ccstatuslineSettings);
    config.lines = config.lines.map(line => line.filter(w => !isBmad(w)));
    writeJsonSafe(paths.ccstatuslineSettings, config);
    logSuccess(target, 'BMAD widgets removed');
  } catch (err) {
    try {
      const bakPath = paths.ccstatuslineSettings + '.bak';
      if (fs.existsSync(bakPath)) fs.copyFileSync(bakPath, paths.ccstatuslineSettings);
    } catch {}
    logError(target, err.message);
    return false;
  }
}

function uninstallTarget3(paths) {
  const target = '~/.config/bmad-statusline/';
  try {
    if (!fs.existsSync(paths.readerDir)) {
      logSkipped(target, 'directory not found');
      return;
    }
    fs.rmSync(paths.readerDir, { recursive: true, force: true });
    logSuccess(target, 'deleted');
  } catch (err) {
    logError(target, err.message);
    return false;
  }
}

function uninstallTarget4(paths) {
  const target = '~/.cache/bmad-status/';
  try {
    if (!fs.existsSync(paths.cacheDir)) {
      logSkipped(target, 'directory not found');
      return;
    }
    fs.rmSync(paths.cacheDir, { recursive: true, force: true });
    logSuccess(target, 'deleted');
  } catch (err) {
    logError(target, err.message);
    return false;
  }
}

function uninstallTarget5(paths) {
  const target = '~/.claude/settings.json hooks';
  try {
    if (!fs.existsSync(paths.claudeSettings)) {
      logSkipped(target, 'file not found');
      return;
    }

    const config = readJsonFile(paths.claudeSettings);

    if (!config.hooks || typeof config.hooks !== 'object' || Array.isArray(config.hooks)) {
      logSkipped(target, 'no hook config found');
      return;
    }

    const isBmadHook = (entry) =>
      Array.isArray(entry.hooks) && entry.hooks.some(h => h.command && h.command.includes('bmad-hook.js'));

    // Check all hook events for bmad-hook entries
    const hasBmadHook = Object.values(config.hooks).some(entries =>
      Array.isArray(entries) && entries.some(isBmadHook)
    );
    if (!hasBmadHook) {
      logSkipped(target, 'no bmad-hook entries found');
      return;
    }

    backupFile(paths.claudeSettings);

    // Remove bmad-hook entries from all hook events
    for (const event of Object.keys(config.hooks)) {
      if (!Array.isArray(config.hooks[event])) continue;
      config.hooks[event] = config.hooks[event].filter(entry => !isBmadHook(entry));
    }

    writeJsonSafe(paths.claudeSettings, config);
    logSuccess(target, 'hook config removed');
  } catch (err) {
    try {
      const bakPath = paths.claudeSettings + '.bak';
      if (fs.existsSync(bakPath)) fs.copyFileSync(bakPath, paths.claudeSettings);
    } catch {}
    logError(target, err.message);
    return false;
  }
}

function uninstallTarget6(paths) {
  const target = '.claude/CLAUDE.md (backward compat)';
  const START_MARKER = '<!-- bmad-statusline:start -->';
  const END_MARKER = '<!-- bmad-statusline:end -->';

  try {
    if (!fs.existsSync(paths.claudeMd)) {
      logSkipped(target, 'file not found');
      return;
    }

    const content = fs.readFileSync(paths.claudeMd, 'utf8');
    const startIdx = content.indexOf(START_MARKER);
    const endIdx = content.indexOf(END_MARKER);

    if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) {
      logSkipped(target, 'no markers found');
      return;
    }

    const before = content.substring(0, startIdx);
    const after = content.substring(endIdx + END_MARKER.length);
    const result = before.trimEnd() + (after.trim() ? '\n\n' + after.trimStart() : '\n');
    fs.writeFileSync(paths.claudeMd, result, 'utf8');
    logSuccess(target, 'instruction block removed');
  } catch (err) {
    logError(target, err.message);
    return false;
  }
}

function uninstallTarget7(paths) {
  const target = '.claude/settings.local.json';
  try {
    if (!fs.existsSync(paths.settingsLocal)) {
      logSkipped(target, 'file not found');
      return;
    }

    const config = readJsonFile(paths.settingsLocal);
    const allow = config.permissions && config.permissions.allow;

    if (!Array.isArray(allow) || !allow.some(r => r.includes('BMAD_PROJ_DIR'))) {
      logSkipped(target, 'no BMAD permission rules found');
      return;
    }

    config.permissions.allow = allow.filter(r => !r.includes('BMAD_PROJ_DIR'));

    if (config.permissions.allow.length === 0) delete config.permissions.allow;
    if (Object.keys(config.permissions).length === 0) delete config.permissions;

    if (Object.keys(config).length === 0) {
      fs.unlinkSync(paths.settingsLocal);
      logSuccess(target, 'BMAD permission rules removed (file deleted — empty)');
      return;
    }

    writeJsonSafe(paths.settingsLocal, config);
    logSuccess(target, 'BMAD permission rules removed');
  } catch (err) {
    logError(target, err.message);
    return false;
  }
}

// --- Main ---

export default function uninstall(paths = defaultPaths) {
  console.log(`\n  ${B}\uD83D\uDDD1\uFE0F  Uninstalling bmad-statusline...${_}`);

  logSection('\uD83D\uDCCB', 'Claude Code & ccstatusline');
  const r1 = uninstallTarget1();
  const r2 = uninstallTarget2(paths);

  logSection('\uD83D\uDCE6', 'Runtime & cache');
  const r3 = uninstallTarget3(paths);
  const r4 = uninstallTarget4(paths);

  logSection('\uD83E\uDDF9', 'Hooks & legacy cleanup');
  const r5 = uninstallTarget5(paths);
  const r6 = uninstallTarget6(paths);
  const r7 = uninstallTarget7(paths);

  console.log(`\n  ${D}${'─'.repeat(38)}${_}`);
  if ([r1, r2, r3, r4, r5, r6, r7].some(r => r === false)) {
    console.log(`\n  ${R}${B}\u26A0  Uninstall completed with errors.${_}\n`);
    process.exit(1);
  }
  console.log(`\n  ${G}${B}\u2728 bmad-statusline uninstalled.${_}`);
  console.log(`  ${D}statusLine config preserved for ccstatusline.${_}\n`);
}
