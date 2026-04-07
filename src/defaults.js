// defaults.js — Config templates and color maps

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
        { matcher: '(?:bmad|gds|wds)[:-]', hooks: [{ type: 'command', command: cmd }] }
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
      Notification: [
        { matcher: '', hooks: [{ type: 'command', command: cmd }] }
      ],
      SubagentStart: [
        { matcher: '', hooks: [{ type: 'command', command: cmd }] }
      ],
      SubagentStop: [
        { matcher: '', hooks: [{ type: 'command', command: cmd }] }
      ],
      SessionStart: [
        { matcher: 'resume', hooks: [{ type: 'command', command: cmd }] }
      ],
      SessionEnd: [
        { matcher: '', hooks: [{ type: 'command', command: cmd }] }
      ]
    }
  };
}

export const AGENT_COLORS = {
  'Amelia': '\x1b[36m',       // cyan — dev
  'Bob': '\x1b[32m',          // green — scrum master
  'John': '\x1b[33m',         // yellow — PM
  'Quinn': '\x1b[31m',        // red — QA
  'Winston': '\x1b[35m',      // magenta — architect
  'Mary': '\x1b[34m',         // blue — analyst
  'Sally': '\x1b[95m',        // brightMagenta — UX
  'Paige': '\x1b[37m',        // white — tech writer
  'Barry': '\x1b[96m',        // brightCyan — quick flow
  'Carson': '\x1b[93m',       // brightYellow — brainstorming
  'Murat': '\x1b[91m',        // brightRed — test architect
  'Maya': '\x1b[92m',         // brightGreen — design thinking
  'Victor': '\x1b[94m',       // brightBlue — innovation
  'Sophia': '\x1b[95m',       // brightMagenta — storyteller
  'Dr. Quinn': '\x1b[97m',    // brightWhite — problem solver
  'Caravaggio': '\x1b[33m',   // yellow — presentation
};

export const WORKFLOW_COLORS = _wc.WORKFLOW_COLORS;
export const WORKFLOW_PREFIX_COLORS = _wc.WORKFLOW_PREFIX_COLORS;

// Shared constants bridged from CJS
export const ALIVE_MAX_AGE_MS = _sc.ALIVE_MAX_AGE_MS;
export const INACTIVE_TIMEOUT_MS = _sc.INACTIVE_TIMEOUT_MS;
export const STORY_WORKFLOWS = _sc.STORY_WORKFLOWS;
export const PROJECT_COLOR_PALETTE = _sc.PROJECT_COLOR_PALETTE;
export const SEPARATOR_VALUES = _sc.SEPARATOR_VALUES;
export const isValidSessionId = _sc.isValidSessionId;
export const hashProjectColor = _sc.hashProjectColor;
export const computeDisplayState = _sc.computeDisplayState;
export const formatTimer = _sc.formatTimer;
export const formatStoryName = _sc.formatStoryName;
