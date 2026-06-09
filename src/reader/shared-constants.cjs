'use strict';

// Single source of truth for constants and utilities shared between
// CJS runtime (reader, hook) and ESM modules (via createRequire bridge in defaults.js).

const ALIVE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const STORY_WORKFLOWS = ['create-story', 'dev-story', 'code-review'];

const PROJECT_COLOR_PALETTE = [
  'red', 'green', 'yellow', 'blue', 'magenta', 'cyan',
  'brightRed', 'brightGreen', 'brightYellow', 'brightBlue', 'brightMagenta', 'brightCyan',
];

const SEPARATOR_VALUES = {
  serre: '\u2503',
  modere: ' \u2503 ',
  large: '  \u2503  ',
};

const LLM_STATE_PRIORITY = {
  active: 0,
  waiting: 1,
  interrupted: 1,
  error: 2,
  permission: 2,
};

function isValidSessionId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id);
}

function hashProjectColor(name) {
  if (!name) return null;
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  }
  return PROJECT_COLOR_PALETTE[Math.abs(h) % PROJECT_COLOR_PALETTE.length];
}

function computeDisplayState(status) {
  return status.llm_state || 'waiting';
}

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

function formatStoryName(slug, displayMode) {
  if (!slug) return '';
  const match = slug.match(/^(\d+[a-z]?-\d+[a-z]?)-(.+)$/);
  if (!match) return slug;
  if (displayMode === 'compact') return match[1];
  const title = match[2].split('-').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return `${match[1]} ${title}`;
}

const CONTEXT_GRADIENT_PALETTE = ['brightGreen', 'green', 'yellow', 'brightYellow', 'brightRed', 'red'];

function getGradientColor(percentage, thresholdLow, thresholdHigh) {
  if (percentage <= thresholdLow) return 'brightGreen';
  if (percentage >= thresholdHigh) return 'red';
  const range = thresholdHigh - thresholdLow;
  if (range <= 0) return 'brightGreen';
  const normalized = (percentage - thresholdLow) / range;
  const segmentIndex = Math.min(Math.floor(normalized * 5), 4);
  return CONTEXT_GRADIENT_PALETTE[segmentIndex];
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Fixed threshold POINTS (percentage points of the week) — LOCKED spec
const WEEKLY_USAGE_SWEET_BAND = 5;   // blue band:   [time-5, time)
const WEEKLY_USAGE_HIGH_BAND  = 10;  // yellow band: [time, time+10)

// Zone → status word + semantic color name (each surface maps the name to its own renderer)
const WEEKLY_USAGE_ZONES = {
  good:     { status: 'GOOD',       color: 'green'  },
  sweet:    { status: 'SWEET SPOT', color: 'blue'   },
  high:     { status: 'TOO HIGH',   color: 'yellow' },
  slowdown: { status: 'SLOW DOWN',  color: 'red'    },
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// snapshot = { used_percentage, resets_at(seconds) }; nowMs = Date.now()
function computeWeeklyUsage(snapshot, nowMs) {
  if (!snapshot || snapshot.used_percentage == null || snapshot.resets_at == null) return null;
  const usagePct = snapshot.used_percentage;
  if (typeof usagePct !== 'number' || !isFinite(usagePct)) return null;
  const weekStartMs = snapshot.resets_at * 1000 - WEEK_MS;
  // time% = clamp01( (now − (resets_at − 7d)) / 7d ) × 100
  const timePct = Math.min(1, Math.max(0, (nowMs - weekStartMs) / WEEK_MS)) * 100;
  let zone;
  if (usagePct < timePct - WEEKLY_USAGE_SWEET_BAND)      zone = 'good';
  else if (usagePct < timePct)                          zone = 'sweet';
  else if (usagePct < timePct + WEEKLY_USAGE_HIGH_BAND)  zone = 'high';
  else                                                   zone = 'slowdown';
  return { usagePct, timePct, zone, status: WEEKLY_USAGE_ZONES[zone].status, color: WEEKLY_USAGE_ZONES[zone].color };
}

// Day-boundary tick marks for the TUI time bar.
// Returns [{ positionPct, label }] for each LOCAL-midnight day boundary strictly inside the window.
// label = the day that is STARTING.
function computeWeekDayTicks(resetsAtSec, nowMs) {
  const resetsMs = resetsAtSec * 1000;
  const weekStartMs = resetsMs - WEEK_MS;
  const ticks = [];
  const d = new Date(weekStartMs);
  d.setHours(24, 0, 0, 0); // first local midnight strictly after weekStart (DST-safe via setHours)
  while (d.getTime() < resetsMs) {
    ticks.push({ positionPct: ((d.getTime() - weekStartMs) / WEEK_MS) * 100, label: WEEKDAY_LABELS[d.getDay()] });
    d.setHours(24, 0, 0, 0); // advance one local day (DST-safe — not a fixed +24h)
  }
  return ticks;
}

module.exports = {
  ALIVE_MAX_AGE_MS,
  STORY_WORKFLOWS,
  PROJECT_COLOR_PALETTE,
  SEPARATOR_VALUES,
  LLM_STATE_PRIORITY,
  isValidSessionId,
  hashProjectColor,
  computeDisplayState,
  formatTimer,
  formatStoryName,
  CONTEXT_GRADIENT_PALETTE,
  getGradientColor,
  WEEK_MS,
  WEEKLY_USAGE_SWEET_BAND,
  WEEKLY_USAGE_HIGH_BAND,
  WEEKLY_USAGE_ZONES,
  WEEKDAY_LABELS,
  computeWeeklyUsage,
  computeWeekDayTicks,
};
