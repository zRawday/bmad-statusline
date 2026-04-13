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
