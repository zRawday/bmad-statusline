import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStatusLineConfig, getWidgetDefinitions, getHookConfig } from './defaults.js';
import { DEPLOY_FILES, getPackageVersion, VERSION_STAMP } from './deploy.js';
import { createDefaultConfig } from './tui/widget-registry.js';
import { G, R, D, B, _, logSuccess, logSkipped, logError, logSection, readJsonFile, backupFile, writeJsonSafe } from './cli-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const hookSource = DEPLOY_FILES.find(f => f.name === 'bmad-hook.js').src;

const home = os.homedir();
// Honor BMAD_CONFIG_DIR like every other entry point (cli, doctor, hook, reader, TUI)
// — otherwise `BMAD_CONFIG_DIR=/x install` deploys where nothing will ever look.
const configDir = process.env.BMAD_CONFIG_DIR || path.join(home, '.config', 'bmad-statusline');
const defaultPaths = {
  claudeSettings: path.join(home, '.claude', 'settings.json'),
  claudeDir: path.join(home, '.claude'),
  ccstatuslineSettings: path.join(home, '.config', 'ccstatusline', 'settings.json'),
  ccstatuslineDir: path.join(home, '.config', 'ccstatusline'),
  readerDest: path.join(configDir, 'bmad-sl-reader.js'),
  readerDir: configDir,
  hookDest: path.join(configDir, 'bmad-hook.js'),
  cacheDir: process.env.BMAD_CACHE_DIR || path.join(home, '.cache', 'bmad-status'),
};

// ANSI colors, logging helpers, JSON helpers imported from cli-utils.js

// --- Install targets ---

function installTarget1(paths) {
  const target = '~/.claude/settings.json';
  // Only restore a backup taken during THIS run: a stale .bak from a previous
  // install would silently overwrite every edit made since.
  let backedUp = false;
  try {
    fs.mkdirSync(paths.claudeDir, { recursive: true });

    if (fs.existsSync(paths.claudeSettings)) {
      const config = readJsonFile(paths.claudeSettings);
      if ('statusLine' in config) {
        logSkipped(target, 'statusLine already configured');
        return;
      }
      backupFile(paths.claudeSettings);
      backedUp = true;
      config.statusLine = getStatusLineConfig();
      writeJsonSafe(paths.claudeSettings, config);
    } else {
      const config = { statusLine: getStatusLineConfig() };
      writeJsonSafe(paths.claudeSettings, config);
    }
    logSuccess(target, 'statusLine configured');
  } catch (err) {
    try {
      if (backedUp) fs.copyFileSync(paths.claudeSettings + '.bak', paths.claudeSettings);
    } catch {}
    logError(target, err.message);
    return false;
  }
}

function installTarget2(paths) {
  const target = '~/.config/ccstatusline/settings.json';
  let backedUp = false;
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

    // v1 remnants (individual bmad-* widgets, NOT the v2 bmad-line-* composites)
    // and orphaned sep-bmad-* separators are cleaned even when nothing is missing,
    // otherwise a leftover v1 widget next to a complete v2 set survives forever.
    const hasV1 = allWidgets.some(w => w.id?.startsWith('bmad-') && w.type === 'custom-command' && !w.id.startsWith('bmad-line-'));
    const hasOrphanSeps = allWidgets.some(w => w.id?.startsWith('sep-bmad-'));
    if (hasV1 || hasOrphanSeps) {
      config.lines = config.lines.map(line =>
        line.filter(w =>
          !(w.id?.startsWith('bmad-') && !w.id.startsWith('bmad-line-')) &&
          !w.id?.startsWith('sep-bmad-'))
      );
    }

    // All 3 bmad-line-* already present and nothing to clean — skip
    if (missing.length === 0 && !hasV1 && !hasOrphanSeps) {
      logSkipped(target, 'bmad-line-* already present');
      return;
    }

    if (fs.existsSync(paths.ccstatuslineSettings)) {
      backupFile(paths.ccstatuslineSettings);
      backedUp = true;
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
        ? missing.length > 0
          ? `added missing ${missing.map(w => w.id).join(', ')}`
          : 'removed orphaned sep-bmad-* separators'
        : 'BMAD widgets injected');
  } catch (err) {
    try {
      if (backedUp) fs.copyFileSync(paths.ccstatuslineSettings + '.bak', paths.ccstatuslineSettings);
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
    // Driven by DEPLOY_FILES (single source of truth) so a file added there can
    // never be silently missing from a fresh install. The hook stays in target 6;
    // the version stamp is written last, after ALL copies succeeded (see install()).
    for (const f of DEPLOY_FILES) {
      if (f.name === 'bmad-hook.js') continue;
      fs.copyFileSync(f.src, path.join(paths.readerDir, f.name));
    }
    logSuccess(target, existed ? 'updated' : 'installed');
  } catch (err) {
    logError(target, err.message);
    return false;
  }
}

// Stamp the deploy dir with the package version so `npx bmad-statusline` can later
// detect a stale deployment and auto-resync (see src/deploy.js). Runs only after
// targets 3 AND 6 both succeeded: stamping over a failed hook copy would mark a
// stale deployment as current, making the self-heal permanently blind to it.
function stampDeployedVersion(paths) {
  try {
    const ver = getPackageVersion();
    if (ver) fs.writeFileSync(path.join(paths.readerDir, VERSION_STAMP), ver + '\n');
  } catch { /* unstamped → isDeployStale stays true → self-heal will retry */ }
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
  let backedUp = false;
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

    // Upgrade: widen bmad SessionStart matcher 'resume' → '' so the npx-cache
    // auto-repair runs on fresh sessions too. Rewrite in place to avoid a duplicate.
    if (Array.isArray(config.hooks.SessionStart)) {
      for (const entry of config.hooks.SessionStart) {
        if (entry.matcher === 'resume' &&
          Array.isArray(entry.hooks) &&
          entry.hooks.some(h => h.command && h.command.includes('bmad-hook.js'))) {
          entry.matcher = '';
          changed = true;
        }
      }
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
    backedUp = true;
    writeJsonSafe(paths.claudeSettings, config);
    logSuccess(target, 'hook config injected');
  } catch (err) {
    try {
      if (backedUp) fs.copyFileSync(paths.claudeSettings + '.bak', paths.claudeSettings);
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
      // doctor points corrupt-config users here — recreate instead of skipping,
      // otherwise that repair path can never actually repair anything.
      try {
        JSON.parse(fs.readFileSync(configPath, 'utf8'));
        logSkipped(target, 'already exists');
        return;
      } catch {
        try { fs.copyFileSync(configPath, configPath + '.bak'); } catch {}
        fs.writeFileSync(configPath, JSON.stringify(createDefaultConfig(), null, 2) + '\n');
        logSuccess(target, 'recreated (was invalid — old file saved as config.json.bak)');
        return;
      }
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

  // Stamp only when every deploy copy (reader files AND hook) succeeded.
  if (r3 !== false && r6 !== false) stampDeployedVersion(paths);

  console.log(`\n  ${D}${'─'.repeat(38)}${_}`);
  if ([r1, r2, r3, r4, r5, r6, r7].some(r => r === false)) {
    console.log(`\n  ${R}${B}\u26A0  Installation completed with errors.${_}\n`);
    process.exit(1);
  }
  console.log(`\n  ${G}${B}\uD83C\uDF89 bmad-statusline installed!${_}`);
  console.log(`  ${D}Run${_} npx bmad-statusline ${D}to open the config menu.${_}\n`);
}
