// defaults.js — Config templates and color maps

import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const _require = createRequire(import.meta.url);
const _wc = _require('./reader/workflow-colors.cjs');
const _sc = _require('./reader/shared-constants.cjs');

export function getStatusLineConfig() {
  return {
    type: 'command',
    command: 'npx -y ccstatusline@latest',
    padding: 0
  };
}

// Seed layout for a BRAND-NEW ccstatusline config only — never applied to one that
// already exists, which would inject widgets into a layout the user owns. Places
// ccstatusline's own widgets left of where bmad-line-1/2 get appended, so a fresh
// install reproduces the reference three-line setup. Ids are random UUIDs (the shape
// ccstatusline itself generates) so our cleanup and uninstall passes, which key on the
// `bmad-` prefix, leave them alone — they belong to the user from the moment they land.
// Only `lines` is seeded: ccstatusline's global display settings stay unset so its own
// defaults apply and can evolve.
export function getCcstatuslineSeedLines() {
  const w = type => ({ id: randomUUID(), type });
  return [
    [],
    [w('model'), w('separator'), w('thinking-effort'), w('separator')],
    [w('tokens-total'), w('separator')],
  ];
}

export function getWidgetDefinitions(readerPath) {
  return [0, 1, 2].map(i => ({
    id: `bmad-line-${i}`,
    type: 'custom-command',
    commandPath: `node "${readerPath}" line ${i}`,
    preserveColors: true
  }));
}

export function getHookConfig(hookPath) {
  const safePath = JSON.stringify(hookPath);
  const cmd = `node ${safePath}`;
  return {
    hooks: {
      UserPromptSubmit: [
        // Empty matcher: fires on every prompt, not just bmad ones. Non-BMAD sessions
        // need it for llm_state=active and for the started_at timer anchor.
        { matcher: '', hooks: [{ type: 'command', command: cmd }] }
      ],
      PreToolUse: [
        { matcher: '', hooks: [{ type: 'command', command: cmd }] }
      ],
      PostToolUse: [
        { matcher: 'Read', hooks: [{ type: 'command', command: cmd }] },
        { matcher: 'Write', hooks: [{ type: 'command', command: cmd }] },
        { matcher: 'Edit', hooks: [{ type: 'command', command: cmd }] },
        { matcher: 'Bash', hooks: [{ type: 'command', command: cmd }] }
      ],
      PermissionRequest: [
        { matcher: '', hooks: [{ type: 'command', command: cmd }] }
      ],
      PermissionDenied: [
        { matcher: '', hooks: [{ type: 'command', command: cmd }] }
      ],
      PostToolUseFailure: [
        { matcher: '', hooks: [{ type: 'command', command: cmd }] }
      ],
      Stop: [
        { matcher: '', hooks: [{ type: 'command', command: cmd }] }
      ],
      StopFailure: [
        { matcher: '', hooks: [{ type: 'command', command: cmd }] }
      ],
      SubagentStart: [
        { matcher: '', hooks: [{ type: 'command', command: cmd }] }
      ],
      SubagentStop: [
        { matcher: '', hooks: [{ type: 'command', command: cmd }] }
      ],
      SessionStart: [
        { matcher: '', hooks: [{ type: 'command', command: cmd }] }
      ],
      SessionEnd: [
        { matcher: '', hooks: [{ type: 'command', command: cmd }] }
      ]
    }
  };
}

export const WORKFLOW_COLORS = _wc.WORKFLOW_COLORS;

// Shared constants bridged from CJS
export const ALIVE_MAX_AGE_MS = _sc.ALIVE_MAX_AGE_MS;
export const STORY_WORKFLOWS = _sc.STORY_WORKFLOWS;
export const SEPARATOR_VALUES = _sc.SEPARATOR_VALUES;
export const hashProjectColor = _sc.hashProjectColor;
export const computeDisplayState = _sc.computeDisplayState;
export const formatTimer = _sc.formatTimer;
export const formatStoryName = _sc.formatStoryName;
export const LLM_STATE_PRIORITY = _sc.LLM_STATE_PRIORITY;
export const CONTEXT_GRADIENT_PALETTE = _sc.CONTEXT_GRADIENT_PALETTE;
export const getGradientColor = _sc.getGradientColor;
export const WEEK_MS = _sc.WEEK_MS;
export const WEEKLY_USAGE_SWEET_BAND = _sc.WEEKLY_USAGE_SWEET_BAND;
export const WEEKLY_USAGE_HIGH_BAND = _sc.WEEKLY_USAGE_HIGH_BAND;
export const WEEKLY_USAGE_ZONES = _sc.WEEKLY_USAGE_ZONES;
export const WEEKDAY_LABELS = _sc.WEEKDAY_LABELS;
export const computeWeeklyUsage = _sc.computeWeeklyUsage;
export const computeWeekDayTicks = _sc.computeWeekDayTicks;
