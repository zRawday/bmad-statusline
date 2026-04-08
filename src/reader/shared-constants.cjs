'use strict';

// Single source of truth for constants and utilities shared between
// CJS runtime (reader, hook) and ESM modules (via createRequire bridge in defaults.js).

const ALIVE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const INACTIVE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
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
  inactive: 0,
  active: 1,
  'active:subagent': 1,
  interrupted: 2,
  waiting: 2,
  error: 3,
  permission: 3,
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
  if (status.updated_at) {
    const age = Date.now() - new Date(status.updated_at).getTime();
    if (isNaN(age) || age > INACTIVE_TIMEOUT_MS) return 'inactive';
  }
  return status.llm_state || 'inactive';
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
  const match = slug.match(/^(\d+-\d+)-(.+)$/);
  if (!match) return slug;
  if (displayMode === 'compact') return match[1];
  const title = match[2].split('-').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return `${match[1]} ${title}`;
}

module.exports = {
  ALIVE_MAX_AGE_MS,
  INACTIVE_TIMEOUT_MS,
  STORY_WORKFLOWS,
  PROJECT_COLOR_PALETTE,
  SEPARATOR_VALUES,
  LLM_STATE_PRIORITY,
  isValidSessionId,
  hashProjectColor,
  computeDisplayState,
  formatTimer,
  formatStoryName,
};
