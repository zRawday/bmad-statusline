import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getStatusLineConfig,
  getWidgetDefinitions,
  getHookConfig,
  AGENT_COLORS,
  WORKFLOW_COLORS
} from '../src/defaults.js';

describe('src/defaults.js config templates', () => {
  it('getStatusLineConfig returns ccstatusline config object', () => {
    const result = getStatusLineConfig();
    assert.equal(typeof result, 'object');
    assert.ok(result !== null);
    assert.equal(result.type, 'command');
    assert.ok(result.command.includes('ccstatusline'), 'command should reference ccstatusline');
    assert.equal(typeof result.padding, 'number');
  });

  it('getWidgetDefinitions returns 3 bmad-line-N composites', () => {
    const result = getWidgetDefinitions('/test/path/reader.js');
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 3, 'should return 3 widgets');
    for (let i = 0; i < 3; i++) {
      const w = result[i];
      assert.equal(w.id, `bmad-line-${i}`);
      assert.equal(w.type, 'custom-command');
      assert.ok(w.commandPath.includes('/test/path/reader.js'));
      assert.ok(w.commandPath.includes(`line ${i}`));
      assert.equal(w.preserveColors, true);
    }
  });

  it('getHookConfig returns 3 event type keys with correct matcher counts (1+3+1)', () => {
    const result = getHookConfig('/test/path/bmad-hook.js');
    assert.ok(result.hooks, 'should have hooks key');
    assert.ok(Array.isArray(result.hooks.UserPromptSubmit), 'should have UserPromptSubmit array');
    assert.ok(Array.isArray(result.hooks.PostToolUse), 'should have PostToolUse array');
    assert.ok(Array.isArray(result.hooks.SessionStart), 'should have SessionStart array');
    assert.equal(result.hooks.UserPromptSubmit.length, 1, 'UserPromptSubmit: 1 matcher');
    assert.equal(result.hooks.PostToolUse.length, 3, 'PostToolUse: 3 matchers');
    assert.equal(result.hooks.SessionStart.length, 1, 'SessionStart: 1 matcher');
  });

  it('getHookConfig matchers have correct values and commands', () => {
    const result = getHookConfig('/test/path/bmad-hook.js');
    // UserPromptSubmit
    assert.equal(result.hooks.UserPromptSubmit[0].matcher, '(?:bmad|gds|wds)[:-]');
    assert.equal(result.hooks.UserPromptSubmit[0].hooks[0].type, 'command');
    assert.ok(result.hooks.UserPromptSubmit[0].hooks[0].command.includes('/test/path/bmad-hook.js'));
    // PostToolUse
    const ptuMatchers = result.hooks.PostToolUse.map(e => e.matcher);
    assert.deepEqual(ptuMatchers, ['Read', 'Write', 'Edit']);
    for (const entry of result.hooks.PostToolUse) {
      assert.equal(entry.hooks[0].type, 'command');
      assert.ok(entry.hooks[0].command.includes('/test/path/bmad-hook.js'));
    }
    // SessionStart
    assert.equal(result.hooks.SessionStart[0].matcher, 'resume');
    assert.equal(result.hooks.SessionStart[0].hooks[0].type, 'command');
    assert.ok(result.hooks.SessionStart[0].hooks[0].command.includes('/test/path/bmad-hook.js'));
  });

  it('AGENT_COLORS is an object', () => {
    assert.equal(typeof AGENT_COLORS, 'object');
    assert.ok(AGENT_COLORS !== null);
  });

  it('WORKFLOW_COLORS is an object', () => {
    assert.equal(typeof WORKFLOW_COLORS, 'object');
    assert.ok(WORKFLOW_COLORS !== null);
  });
});
