#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const CACHE_DIR = process.env.BMAD_CACHE_DIR || path.join(os.homedir(), '.cache', 'bmad-status');
const CONFIG_DIR = process.env.BMAD_CONFIG_DIR || path.join(os.homedir(), '.config', 'bmad-statusline');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const ALIVE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const FRESH_THRESHOLD_MS = 60 * 1000;   // 60 seconds
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// --- Color maps ---

const { WORKFLOW_COLORS, WORKFLOW_PREFIX_COLORS } = require('./workflow-colors.cjs');

// --- Helpers ---

const RESET = '\x1b[0m';

function colorize(text, ansiCode) {
  if (!text || !ansiCode) return text || '';
  return `${ansiCode}${text}${RESET}`;
}

// --- LLM State widget ---

const INACTIVE_TIMEOUT_MS = 5 * 60 * 1000;

const LLM_STATES = {
  permission: { bg: '\x1b[103m', fg: '\x1b[30m', label: 'PERMISSION' },
  waiting:    { bg: '\x1b[104m', fg: '\x1b[97m', label: 'EN ATTENTE' },
  active:     { color: '\x1b[32m',  label: 'Actif' },
  inactive:   { color: '\x1b[90m',  label: 'Inactif' },
};

function computeLlmDisplayState(status) {
  if (status.updated_at) {
    const age = Date.now() - new Date(status.updated_at).getTime();
    if (isNaN(age) || age > INACTIVE_TIMEOUT_MS) return 'inactive';
  }
  return status.llm_state || 'inactive';
}

function formatLlmState(status) {
  const state = computeLlmDisplayState(status);
  const cfg = LLM_STATES[state] || LLM_STATES.inactive;
  if (cfg.bg) {
    return `${cfg.bg}${cfg.fg} \u2B24  ${cfg.label} ${RESET}`;
  }
  return `${cfg.color}\u2B24  ${cfg.label}${RESET}`;
}

const PROJECT_COLOR_PALETTE = [
  'red', 'green', 'yellow', 'blue', 'magenta', 'cyan',
  'brightRed', 'brightGreen', 'brightYellow', 'brightBlue', 'brightMagenta', 'brightCyan',
];

function hashProjectColor(name) {
  if (!name) return null;
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  }
  return PROJECT_COLOR_PALETTE[Math.abs(h) % PROJECT_COLOR_PALETTE.length];
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

function isValidSessionId(sessionId) {
  return typeof sessionId === 'string' && /^[a-zA-Z0-9_-]+$/.test(sessionId);
}

function readStatusFile(sessionId) {
  try {
    if (!isValidSessionId(sessionId)) return null;
    const filePath = path.join(CACHE_DIR, `status-${sessionId}.json`);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

// --- Piggybacking cleanup ---

function touchAlive(sessionId) {
  try {
    if (!isValidSessionId(sessionId)) return;
    const alivePath = path.join(CACHE_DIR, `.alive-${sessionId}`);
    // Only touch mtime — don't overwrite content (hook caches claude.exe PID there)
    if (fs.existsSync(alivePath)) {
      const now = new Date();
      fs.utimesSync(alivePath, now, now);
    }
  } catch {}
}

function purgeStale() {
  try {
    const entries = fs.readdirSync(CACHE_DIR);
    const now = Date.now();
    for (const entry of entries) {
      if (!entry.startsWith('.alive-')) continue;
      const filePath = path.join(CACHE_DIR, entry);
      let stat;
      try { stat = fs.statSync(filePath); } catch { continue; }
      if (now - stat.mtimeMs > ALIVE_MAX_AGE_MS) {
        const staleId = entry.slice('.alive-'.length);
        try { fs.unlinkSync(filePath); } catch {}
        try { fs.unlinkSync(path.join(CACHE_DIR, `status-${staleId}.json`)); } catch {}
      }
    }
  } catch {}
}

// --- Internal config support ---

const READER_SEPARATORS = {
  serre: '\u2503',
  modere: ' \u2503 ',
  large: '  \u2503  ',
};

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
      let value = extractor(status, lineConfig);
      if (!value) continue;
      const colorMode = lineConfig.colorModes[widgetId];
      if (widgetId !== 'bmad-llmstate' && colorMode && colorMode.mode === 'fixed' && colorMode.fixedColor) {
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

function formatStoryName(slug, displayMode) {
  if (!slug) return '';
  const match = slug.match(/^(\d+-\d+)-(.+)$/);
  if (!match) return slug;
  if (displayMode === 'compact') return match[1];
  const title = match[2].split('-').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return `${match[1]} ${title}`;
}

// --- Field extractors ---

function formatTimer(startedAt) {
  if (!startedAt) return '';
  const diffMs = Date.now() - new Date(startedAt).getTime();
  if (isNaN(diffMs) || diffMs < 0) return '';
  const totalSec = Math.floor(diffMs / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const totalMin = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (totalMin < 60) return `${totalMin}m${s.toString().padStart(2, '0')}s`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h${m.toString().padStart(2, '0')}m`;
}

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
    const result = COMMANDS[command](status, lineConfig);
    process.stdout.write(result || '');
  } catch {
    process.stdout.write('');
  }
}

main();
