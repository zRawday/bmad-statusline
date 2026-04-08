// tui-reorder-lines.test.js — Tests for ReorderLinesScreen

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { render } from 'ink-testing-library';
import { ReorderLinesScreen } from '../src/tui/screens/ReorderLinesScreen.js';
import { createDefaultConfig } from '../src/tui/widget-registry.js';

const e = React.createElement;

function makeScreenProps(overrides = {}) {
  return {
    config: createDefaultConfig(),
    updateConfig: () => {},
    previewOverride: null,
    setPreviewOverride: () => {},
    navigate: () => {},
    goBack: () => {},
    editingLine: 0,
    isActive: true,
    ...overrides,
  };
}

describe('ReorderLinesScreen', () => {
  test('renders 3 lines with widget summaries', () => {
    const config = createDefaultConfig();
    config.lines[1].widgets = ['bmad-timer'];
    config.lines[1].colorModes = { 'bmad-timer': { mode: 'fixed', fixedColor: 'brightBlack' } };
    const { lastFrame, unmount } = render(e(ReorderLinesScreen, makeScreenProps({ config })));
    const frame = lastFrame();
    assert.ok(frame.includes('Line 1'), 'line 1 shown');
    assert.ok(frame.includes('Line 2'), 'line 2 shown');
    assert.ok(frame.includes('Line 3'), 'line 3 shown');
    assert.ok(frame.includes('Project'), 'line 1 has Project widget');
    assert.ok(frame.includes('Timer'), 'line 2 has Timer widget');
    unmount();
  });

  test('renders empty lines as (empty)', () => {
    const config = createDefaultConfig();
    config.lines[2] = { widgets: [], widgetOrder: [], colorModes: {} };
    const { lastFrame, unmount } = render(e(ReorderLinesScreen, makeScreenProps({ config })));
    const frame = lastFrame();
    assert.ok(frame.includes('(empty)'), 'empty line shown');
    unmount();
  });

  test('shows screen name label Reorder Lines', () => {
    const { lastFrame, unmount } = render(e(ReorderLinesScreen, makeScreenProps()));
    const frame = lastFrame();
    assert.ok(frame.includes('Reorder Lines'), 'screen name label');
    unmount();
  });

  test('shows navigate shortcuts initially', () => {
    const { lastFrame, unmount } = render(e(ReorderLinesScreen, makeScreenProps()));
    const frame = lastFrame();
    assert.ok(frame.includes('Navigate'));
    assert.ok(frame.includes('Grab'));
    assert.ok(frame.includes('Back'));
    unmount();
  });

  test('Escape calls goBack', async () => {
    let backCalled = false;
    const { stdin, unmount } = render(e(ReorderLinesScreen, makeScreenProps({
      goBack: () => { backCalled = true; },
    })));
    await act(async () => { stdin.write('\x1B'); });
    assert.ok(backCalled);
    unmount();
  });

  test('Enter enters grab mode with moving marker', async () => {
    const { stdin, lastFrame, unmount } = render(e(ReorderLinesScreen, makeScreenProps()));
    await act(async () => { stdin.write('\r'); }); // grab
    const frame = lastFrame();
    assert.ok(frame.includes('moving'), 'moving marker shown');
    assert.ok(frame.includes('Move'), 'move shortcuts');
    assert.ok(frame.includes('Drop'), 'drop shortcut');
    unmount();
  });

  test('swap updates preview during move', async () => {
    let lastPreview = null;
    const config = createDefaultConfig();
    config.lines[1].widgets = ['bmad-timer'];
    config.lines[1].colorModes = { 'bmad-timer': { mode: 'fixed', fixedColor: 'brightBlack' } };
    const { stdin, unmount } = render(e(ReorderLinesScreen, makeScreenProps({
      config,
      setPreviewOverride: (v) => { lastPreview = v; },
    })));
    await act(async () => { stdin.write('\r'); }); // grab line 0
    await act(async () => { stdin.write('\x1B[B'); }); // move down (swap line 0 and 1)
    assert.ok(lastPreview, 'previewOverride set during move');
    unmount();
  });

  test('drop persists swap via updateConfig', async () => {
    let updatedCfg = null;
    let previewCleared = false;
    const config = createDefaultConfig();
    config.lines[1].widgets = ['bmad-timer'];
    config.lines[1].colorModes = { 'bmad-timer': { mode: 'fixed', fixedColor: 'brightBlack' } };
    const { stdin, unmount } = render(e(ReorderLinesScreen, makeScreenProps({
      config,
      updateConfig: (mutator) => { const cfg = structuredClone(config); mutator(cfg); updatedCfg = cfg; },
      setPreviewOverride: (v) => { if (v === null) previewCleared = true; },
    })));
    await act(async () => { stdin.write('\r'); }); // grab line 0
    await act(async () => { stdin.write('\x1B[B'); }); // swap with line 1
    await act(async () => { stdin.write('\r'); }); // drop
    assert.ok(updatedCfg, 'updateConfig called on drop');
    // Line 0 should now have timer (was line 1), line 1 should have original line 0 widgets
    assert.deepStrictEqual(updatedCfg.lines[0].widgets, ['bmad-timer'], 'line 0 now has timer');
    assert.ok(updatedCfg.lines[1].widgets.includes('bmad-project'), 'line 1 now has project');
    assert.ok(previewCleared, 'previewOverride cleared on drop');
    unmount();
  });

  test('cancel reverts to original positions', async () => {
    let previewCleared = false;
    let configUpdated = false;
    const config = createDefaultConfig();
    config.lines[1].widgets = ['bmad-timer'];
    config.lines[1].colorModes = { 'bmad-timer': { mode: 'fixed', fixedColor: 'brightBlack' } };
    const { stdin, lastFrame, unmount } = render(e(ReorderLinesScreen, makeScreenProps({
      config,
      updateConfig: () => { configUpdated = true; },
      setPreviewOverride: (v) => { if (v === null) previewCleared = true; },
    })));
    await act(async () => { stdin.write('\r'); }); // grab line 0
    await act(async () => { stdin.write('\x1B[B'); }); // swap
    await act(async () => { stdin.write('\x1B'); }); // cancel
    assert.ok(!configUpdated, 'no config update on cancel');
    assert.ok(previewCleared, 'previewOverride cleared on cancel');
    // Should be back in navigate mode
    const frame = lastFrame();
    assert.ok(frame.includes('Navigate'), 'back to navigate shortcuts');
    unmount();
  });
});
