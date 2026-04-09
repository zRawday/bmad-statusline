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

  it('getHookConfig returns 12 event type keys with 15 total matchers (Rev.5)', () => {
    const result = getHookConfig('/test/path/bmad-hook.js');
    assert.ok(result.hooks, 'should have hooks key');
    const eventTypes = Object.keys(result.hooks);
    assert.equal(eventTypes.length, 12, 'should have 12 event types');
    // Verify all 12 event types exist
    const expected = [
      'UserPromptSubmit', 'PreToolUse', 'PostToolUse',
      'PermissionRequest', 'PermissionDenied', 'PostToolUseFailure',
      'Stop', 'StopFailure',
      'SubagentStart', 'SubagentStop', 'SessionStart', 'SessionEnd'
    ];
    for (const evt of expected) {
      assert.ok(Array.isArray(result.hooks[evt]), `should have ${evt} array`);
    }
    // Verify matcher counts
    assert.equal(result.hooks.UserPromptSubmit.length, 1, 'UserPromptSubmit: 1 matcher');
    assert.equal(result.hooks.PreToolUse.length, 1, 'PreToolUse: 1 wildcard matcher');
    assert.equal(result.hooks.PostToolUse.length, 4, 'PostToolUse: 4 matchers');
    assert.equal(result.hooks.PermissionRequest.length, 1, 'PermissionRequest: 1 matcher');
    assert.equal(result.hooks.PermissionDenied.length, 1, 'PermissionDenied: 1 matcher');
    assert.equal(result.hooks.PostToolUseFailure.length, 1, 'PostToolUseFailure: 1 matcher');
    assert.equal(result.hooks.Stop.length, 1, 'Stop: 1 matcher');
    assert.equal(result.hooks.StopFailure.length, 1, 'StopFailure: 1 matcher');
    assert.equal(result.hooks.SubagentStart.length, 1, 'SubagentStart: 1 matcher');
    assert.equal(result.hooks.SubagentStop.length, 1, 'SubagentStop: 1 matcher');
    assert.equal(result.hooks.SessionStart.length, 1, 'SessionStart: 1 matcher');
    assert.equal(result.hooks.SessionEnd.length, 1, 'SessionEnd: 1 matcher');
    // Verify total: 15 matchers
    const total = Object.values(result.hooks).reduce((sum, arr) => sum + arr.length, 0);
    assert.equal(total, 15, 'total matchers should be 15');
  });

  it('getHookConfig matchers have correct values and commands', () => {
    const result = getHookConfig('/test/path/bmad-hook.js');
    // UserPromptSubmit — regex matcher
    assert.equal(result.hooks.UserPromptSubmit[0].matcher, '(?:bmad|gds|wds)[:-]');
    assert.equal(result.hooks.UserPromptSubmit[0].hooks[0].type, 'command');
    assert.ok(result.hooks.UserPromptSubmit[0].hooks[0].command.includes('/test/path/bmad-hook.js'));
    // PreToolUse — single wildcard
    assert.equal(result.hooks.PreToolUse[0].matcher, '');
    assert.equal(result.hooks.PreToolUse[0].hooks[0].type, 'command');
    assert.ok(result.hooks.PreToolUse[0].hooks[0].command.includes('/test/path/bmad-hook.js'));
    // PostToolUse — 4 tool-specific matchers
    const ptuMatchers = result.hooks.PostToolUse.map(e => e.matcher);
    assert.deepEqual(ptuMatchers, ['Read', 'Write', 'Edit', 'Bash']);
    for (const entry of result.hooks.PostToolUse) {
      assert.equal(entry.hooks[0].type, 'command');
      assert.ok(entry.hooks[0].command.includes('/test/path/bmad-hook.js'));
    }
    // 7 new event types — all wildcard matchers
    const wildcardEvents = [
      'PermissionRequest', 'PermissionDenied', 'PostToolUseFailure',
      'StopFailure', 'SubagentStart', 'SubagentStop', 'SessionEnd'
    ];
    for (const evt of wildcardEvents) {
      assert.equal(result.hooks[evt][0].matcher, '', `${evt} should have wildcard matcher`);
      assert.equal(result.hooks[evt][0].hooks[0].type, 'command');
      assert.ok(result.hooks[evt][0].hooks[0].command.includes('/test/path/bmad-hook.js'), `${evt} command should reference bmad-hook.js`);
    }
    // Stop — wildcard (type + command validation)
    assert.equal(result.hooks.Stop[0].matcher, '');
    assert.equal(result.hooks.Stop[0].hooks[0].type, 'command');
    assert.ok(result.hooks.Stop[0].hooks[0].command.includes('/test/path/bmad-hook.js'));
    // SessionStart — 'resume' (type + command validation)
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
