#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const CACHE_DIR = process.env.BMAD_CACHE_DIR || path.join(os.homedir(), '.cache', 'bmad-status');
const USAGE_PATH = path.join(CACHE_DIR, 'weekly-usage.json');
const CONFIG_DIR = process.env.BMAD_CONFIG_DIR || path.join(os.homedir(), '.config', 'bmad-statusline');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const FRESH_THRESHOLD_MS = 60 * 1000;   // 60 seconds
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// --- Shared constants ---

const { ALIVE_MAX_AGE_MS, SEPARATOR_VALUES: READER_SEPARATORS, isValidSessionId, hashProjectColor, computeDisplayState: computeLlmDisplayState, formatTimer, formatStoryName, getGradientColor, computeWeeklyUsage } = require('./shared-constants.cjs');

// --- Color maps ---

const { WORKFLOW_COLORS, WORKFLOW_PREFIX_COLORS } = require('./workflow-colors.cjs');

// --- Helpers ---

const RESET = '\x1b[0m';

function colorize(text, ansiCode) {
  if (!text || !ansiCode) return text || '';
  return `${ansiCode}${text}${RESET}`;
}

// --- LLM State widget ---

const LLM_STATES = {
  permission:        { bg: '\x1b[103m', fg: '\x1b[30m', label: 'PERMISSION' },
  waiting:           { bg: '\x1b[104m', fg: '\x1b[97m', label: 'WAITING' },
  error:             { bg: '\x1b[101m', fg: '\x1b[97m', label: 'ERROR' },
  interrupted:       { bg: '\x1b[43m',  fg: '\x1b[30m', label: 'INTERRUPTED' },
  active:            { color: '\x1b[32m',  label: 'ACTIVE' },
};

function formatLlmState(status) {
  const state = computeLlmDisplayState(status);
  const cfg = LLM_STATES[state] || LLM_STATES.active;
  if (cfg.bg) {
    return `${cfg.bg}${cfg.fg} \u2B24  ${cfg.label} ${RESET}`;
  }
  return `${cfg.color}\u2B24  ${cfg.label}${RESET}`;
}

function getProjectColor(project, projectColors) {
  if (!project) return null;
  if (projectColors) {
    const custom = projectColors[project];
    if (custom && COLOR_CODES[custom]) return COLOR_CODES[custom];
  }
  const defaultColor = hashProjectColor(project);
  return defaultColor ? COLOR_CODES[defaultColor] : null;
}

function getWorkflowColor(workflow, skillColors) {
  if (!workflow) return null;
  // Strip bmad- prefix for lookup (agents write "bmad-dev-story", map has "dev-story")
  const normalized = workflow.startsWith('bmad-') ? workflow.slice(5) : workflow;
  // Custom skill colors override hardcoded defaults
  if (skillColors) {
    const custom = skillColors[normalized] || skillColors[workflow];
    if (custom && COLOR_CODES[custom]) return COLOR_CODES[custom];
  }
  if (WORKFLOW_COLORS[normalized]) return WORKFLOW_COLORS[normalized];
  if (WORKFLOW_COLORS[workflow]) return WORKFLOW_COLORS[workflow];
  for (const { prefix, color } of WORKFLOW_PREFIX_COLORS) {
    if (normalized.startsWith(prefix) || workflow.startsWith(prefix)) return color;
  }
  return null;
}

function ensureCacheDir() {
  try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch {}
}

function readStdin() {
  try {
    const data = fs.readFileSync(0, 'utf8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// isValidSessionId imported from shared-constants.cjs

// Synchronous backoff for transient FS contention (only hit on the error path).
function sleepSync(ms) {
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch (_) {}
}

function readStatusFile(sessionId) {
  if (!isValidSessionId(sessionId)) return null;
  const filePath = path.join(CACHE_DIR, `status-${sessionId}.json`);
  // Retry transient failures so a render that lands mid-rename (Windows lock) or on a
  // torn write doesn't blank the whole status line. ENOENT = no session → blank is right.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      if (e && e.code === 'ENOENT') return null;
      if (attempt === 2) return null; // give up — never stall the render
      sleepSync(5 * (attempt + 1));
    }
  }
  return null;
}

// --- PID detection (mirrors hook's findClaudeAncestorPid) ---

function findClaudeAncestorPid() {
  try {
    const { execSync } = require('child_process');
    const out = execSync('wmic process get ProcessId,ParentProcessId,Name /FORMAT:CSV', { encoding: 'utf8', timeout: 5000 });
    const procs = new Map();
    for (const line of out.split('\n')) {
      const parts = line.trim().split(',');
      if (parts.length < 4 || parts[0] === 'Node') continue;
      procs.set(parseInt(parts[3]), { name: parts[1], ppid: parseInt(parts[2]) });
    }
    let pid = process.ppid;
    for (let i = 0; i < 15; i++) {
      const p = procs.get(pid);
      if (!p) break;
      if (p.name.toLowerCase().includes('claude')) return pid;
      pid = p.ppid;
    }
  } catch {}
  return null;
}

// --- Piggybacking cleanup ---

function touchAlive(sessionId) {
  try {
    if (!isValidSessionId(sessionId)) return;
    const alivePath = path.join(CACHE_DIR, `.alive-${sessionId}`);
    if (fs.existsSync(alivePath)) {
      // Fast path: alive file exists — just touch mtime
      const now = new Date();
      fs.utimesSync(alivePath, now, now);
      return;
    }
    // No alive file — new session (likely after /clear). Detect PID + cleanup stale sessions.
    const claudePid = findClaudeAncestorPid();
    if (!claudePid) return; // Let the hook create the alive file with proper PID detection
    fs.writeFileSync(alivePath, String(claudePid));
    {
      // Same-PID cleanup: delete alive+status for old sessions from this Claude instance
      const pidStr = String(claudePid);
      for (const f of fs.readdirSync(CACHE_DIR)) {
        if (!f.startsWith('.alive-')) continue;
        const otherSid = f.slice('.alive-'.length);
        if (otherSid === sessionId) continue;
        try {
          if (fs.readFileSync(path.join(CACHE_DIR, f), 'utf8').trim() === pidStr) {
            fs.unlinkSync(path.join(CACHE_DIR, f));
            // Status file preserved — orphan cleanup handles stale status files
          }
        } catch {}
      }
    }
  } catch {}
}

function purgeStale() {
  try {
    const entries = fs.readdirSync(CACHE_DIR);
    const now = Date.now();
    for (const entry of entries) {
      // Reap abandoned write temps: a hook/reader killed mid-write can't clean up its
      // own per-PID temp (status-<sid>.json.<pid>.tmp / weekly-usage.json.<pid>.tmp).
      // A write completes in ms, so any .tmp older than 60s is orphaned.
      if (entry.endsWith('.tmp')) {
        const tp = path.join(CACHE_DIR, entry);
        try { if (now - fs.statSync(tp).mtimeMs > 60 * 1000) fs.unlinkSync(tp); } catch {}
        continue;
      }
      if (!entry.startsWith('.alive-')) continue;
      const filePath = path.join(CACHE_DIR, entry);
      let stat;
      try { stat = fs.statSync(filePath); } catch { continue; }
      if (now - stat.mtimeMs > ALIVE_MAX_AGE_MS) {
        try { fs.unlinkSync(filePath); } catch {}
        // Status file preserved — orphan cleanup handles stale status files
      }
    }
  } catch {}
}

// --- Weekly-usage snapshot persistence (Pattern 29) ---
// Account-global cache bookkeeping: the live usage data only ever reaches the reader
// (via stdin). The standalone TUI screen has no stdin, so the reader persists a snapshot
// it can read. Write-only side effect here; the widget itself computes live from stdin.

function persistUsageSnapshot(stdin) {
  try {
    const rl = stdin && stdin.rate_limits && stdin.rate_limits.seven_day;
    if (!rl || rl.used_percentage == null || rl.resets_at == null) return; // empty state — nothing to persist
    let prev = null;
    try { prev = JSON.parse(fs.readFileSync(USAGE_PATH, 'utf8')); } catch {}
    // Content-change throttle: skip write if value unchanged (avoids writing on every render)
    if (prev && prev.used_percentage === rl.used_percentage && prev.resets_at === rl.resets_at) return;
    const snap = {
      used_percentage: rl.used_percentage,
      resets_at: rl.resets_at,
      captured_at: new Date().toISOString(),
    };
    // Per-process temp: weekly-usage.json is account-global (unlike the hook's
    // session-scoped status-<sid>.json.tmp), so concurrent line N / native readers
    // would otherwise share one .tmp and tear each other's write. Scope it by pid so
    // each writer owns a private temp; only the rename is shared, and rename is atomic.
    const tmp = USAGE_PATH + '.' + process.pid + '.tmp';
    try {
      fs.writeFileSync(tmp, JSON.stringify(snap, null, 2) + '\n'); // atomic (Pattern 8)
      fs.renameSync(tmp, USAGE_PATH);
    } catch (e) {
      try { fs.unlinkSync(tmp); } catch {} // don't leak our temp on write/rename failure
      throw e;
    }
  } catch { /* silent — Pattern 1 */ }
}

// --- Internal config support ---

// READER_SEPARATORS aliased from SEPARATOR_VALUES in shared-constants.cjs

const COLOR_CODES = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
  brightBlack: '\x1b[90m',
};

function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

function readLineConfig(lineIndex) {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    if (!config.lines || !config.lines[lineIndex]) return null;
    return {
      widgets: config.lines[lineIndex].widgets || [],
      colorModes: config.lines[lineIndex].colorModes || {},
      separator: config.separator || 'serre',
      customSeparator: config.customSeparator ?? null,
      skillColors: config.skillColors || {},
      projectColors: config.projectColors || {},
    };
  } catch {
    return null;
  }
}

function resolveSeparator(style, custom) {
  if (style === 'custom' && custom != null) return custom;
  return READER_SEPARATORS[style] || READER_SEPARATORS.serre;
}

function handleLineCommand(lineIndex) {
  ensureCacheDir();
  const stdin = readStdin();
  persistUsageSnapshot(stdin); // account-global; capture even with no session/status file (Pattern 29)
  if (!stdin || !stdin.session_id) { process.stdout.write(''); return; }
  const sessionId = stdin.session_id;
  touchAlive(sessionId);
  purgeStale();
  const status = readStatusFile(sessionId);
  if (!status) { process.stdout.write(''); return; }

  const lineConfig = readLineConfig(lineIndex);
  if (!lineConfig || lineConfig.widgets.length === 0) {
    process.stdout.write('');
    return;
  }

  const separator = resolveSeparator(lineConfig.separator, lineConfig.customSeparator);

  const segments = [];
  for (const widgetId of lineConfig.widgets) {
    const cmd = widgetId.replace(/^bmad-/, '');
    const extractor = COMMANDS[cmd];
    if (!extractor) continue;
    try {
      let value = extractor(status, lineConfig, stdin);
      if (!value) continue;
      const colorMode = lineConfig.colorModes[widgetId];
      if (widgetId !== 'bmad-llmstate' && widgetId !== 'bmad-contextpct' && widgetId !== 'bmad-weeklyusage' && colorMode && colorMode.mode === 'fixed' && colorMode.fixedColor) {
        const code = COLOR_CODES[colorMode.fixedColor];
        if (widgetId === 'bmad-fileread' || widgetId === 'bmad-filewrite') {
          const plain = stripAnsi(value);
          const sp = plain.indexOf(' ');
          value = sp > 0
            ? colorize(plain.substring(0, sp), COLOR_CODES.white) + ' ' + colorize(plain.substring(sp + 1), code)
            : colorize(plain, code);
        } else {
          value = colorize(stripAnsi(value), code);
        }
      }
      if (value) segments.push(value);
    } catch {
      // silent — skip this widget
    }
  }

  process.stdout.write(segments.join(separator));
}

// --- Story formatting ---

// formatStoryName, formatTimer imported from shared-constants.cjs

// --- Field extractors ---

function formatProgressStep(step) {
  if (!step || (!step.total && !step.current)) return '';
  const current = step.current || 0;
  if (!step.total) {
    // Frontmatter fallback: no total known
    const name = step.current_name;
    return name ? `Step ${current} ${name}` : `Step ${current}`;
  }
  const cappedTotal = Math.min(Math.max(step.total, 0), 999);
  const cappedCurrent = Math.min(current, 999);
  const progress = `${cappedCurrent}/${cappedTotal}`;
  const name = step.current_name;
  if (name) return `Step ${progress} ${name}`;
  return `Step ${progress}`;
}

const COMMANDS = {
  llmstate:     (s) => formatLlmState(s),
  project:      (s, lc) => colorize(s.project || '', getProjectColor(s.project, lc && lc.projectColors)),
  workflow:     (s, lc) => colorize(s.workflow || '', getWorkflowColor(s.workflow, lc && lc.skillColors)),
  activeskill:  (s, lc) => {
    const current = s.active_skill || s.workflow;
    if (!current) return '';
    const initialVisible = lc && lc.widgets && lc.widgets.includes('bmad-workflow');
    if (initialVisible && current === s.workflow) return '';
    return colorize(current, getWorkflowColor(current, lc && lc.skillColors));
  },
  nextstep:     (s) => (s.step && s.step.next_name) || '',
  progressstep: (s) => formatProgressStep(s.step),
  story:        (s, lc) => formatStoryName(s.story || '', lc && lc.colorModes && lc.colorModes['bmad-story'] && lc.colorModes['bmad-story'].displayMode),
  docname:      (s) => s.document_name || '',
  timer:        (s) => formatTimer(s.started_at),
  fileread:     (s) => s.last_read ? `read ${s.last_read}` : '',
  filewrite:    (s) => s.last_write ? `${s.last_write_op || 'write'} ${s.last_write}` : '',
  contextpct:   (s, lc, stdin) => {
    const cw = stdin && stdin.context_window;
    let pct = null;
    if (cw) {
      if (cw.used_percentage != null) {
        pct = cw.used_percentage;
      } else if (cw.current_usage != null && cw.context_window_size > 0) {
        pct = (cw.current_usage / cw.context_window_size) * 100;
      }
    }
    if (pct == null || typeof pct !== 'number' || !isFinite(pct)) return '';
    if (pct < 0) pct = 0;
    const cm = lc && lc.colorModes && lc.colorModes['bmad-contextpct'];
    const low = cm && cm.thresholdLow != null ? cm.thresholdLow : 0;
    const high = cm && cm.thresholdHigh != null ? cm.thresholdHigh : 100;
    const displayMode = cm && cm.displayMode || 'full';
    if (displayMode === 'compact') {
      return colorize('Ctx: ' + pct.toFixed(1) + '%', COLOR_CODES[getGradientColor(pct, low, high)]);
    }
    const BAR_LENGTH = 25;
    const filled = Math.min(Math.max(Math.round(pct * BAR_LENGTH / 100), 0), BAR_LENGTH);
    let bar = '';
    for (let i = 0; i < BAR_LENGTH; i++) {
      if (i < filled) {
        const posPct = i * 100 / (BAR_LENGTH - 1);
        bar += colorize('\u2588', COLOR_CODES[getGradientColor(posPct, low, high)]);
      } else {
        bar += colorize('\u2591', COLOR_CODES.brightBlack);
      }
    }
    return bar + ' ' + colorize(pct.toFixed(1) + '%', COLOR_CODES[getGradientColor(pct, low, high)]);
  },
  weeklyusage:  (s, lc, stdin) => {
    const rl = stdin && stdin.rate_limits && stdin.rate_limits.seven_day;
    if (!rl) return ''; // empty state → no widget output (matches contextpct precedent)
    const u = computeWeeklyUsage({ used_percentage: rl.used_percentage, resets_at: rl.resets_at }, Date.now());
    if (!u) return '';
    const cm = lc && lc.colorModes && lc.colorModes['bmad-weeklyusage'];
    const extended = cm && cm.displayMode === 'extended';
    const text = 'Weekly: ' + (extended ? u.usagePct.toFixed(1) + '% ' : '') + u.status;
    return colorize(text, COLOR_CODES[u.color]);
  },
  health:       (s) => {
    const updatedAt = s.updated_at;
    if (!updatedAt) return colorize('\u25CB', COLOR_CODES.brightBlack);
    const ageMs = Date.now() - new Date(updatedAt).getTime();
    if (isNaN(ageMs) || ageMs < 0) return colorize('\u25CB', COLOR_CODES.brightBlack);
    if (ageMs < FRESH_THRESHOLD_MS) return colorize('\u25CF', COLOR_CODES.green);
    if (ageMs < STALE_THRESHOLD_MS) return colorize('\u25CF', COLOR_CODES.yellow);
    return colorize('\u25CB', COLOR_CODES.brightBlack);
  },
};

// --- Main ---

function main() {
  const command = process.argv[2];

  if (command === 'line') {
    const lineIndex = parseInt(process.argv[3], 10);
    if (isNaN(lineIndex) || lineIndex < 0 || lineIndex > 2) {
      process.stdout.write('');
      return;
    }
    handleLineCommand(lineIndex);
    return;
  }

  if (!command || !Object.hasOwn(COMMANDS, command)) {
    process.stdout.write('');
    return;
  }

  ensureCacheDir();

  const stdin = readStdin();
  persistUsageSnapshot(stdin); // account-global snapshot for the standalone TUI (Pattern 29)
  if (!stdin || !stdin.session_id) {
    process.stdout.write('');
    return;
  }

  const sessionId = stdin.session_id;

  // Piggybacking: touch alive + purge stale
  touchAlive(sessionId);
  purgeStale();

  const status = readStatusFile(sessionId);
  if (!status) {
    process.stdout.write('');
    return;
  }

  // Standalone: read config for custom colors so extractors can use them
  let lineConfig = null;
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    lineConfig = {
      skillColors: config.skillColors || {},
      projectColors: config.projectColors || {},
    };
  } catch { /* silent — no config or unreadable */ }

  try {
    const result = COMMANDS[command](status, lineConfig, stdin);
    process.stdout.write(result || '');
  } catch {
    process.stdout.write('');
  }
}

if (require.main === module) main();

module.exports = { COMMANDS, formatProgressStep, formatLlmState, colorize, getProjectColor, getWorkflowColor, readStatusFile, resolveSeparator, COLOR_CODES };
