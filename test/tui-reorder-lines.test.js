// tui-reorder-lines.test.js — Tests for ReorderLinesScreen

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import { ReorderLinesScreen } from '../src/tui/screens/ReorderLinesScreen.js';
import { createDefaultConfig } from '../src/tui/widget-registry.js';

const e = React.createElement;

const delay = (ms) => new Promise(r => setTimeout(r, ms));

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
    const { lastFrame } = render(e(ReorderLinesScreen, makeScreenProps({ config })));
    const frame = lastFrame();
    assert.ok(frame.includes('Line 1'), 'line 1 shown');
    assert.ok(frame.includes('Line 2'), 'line 2 shown');
    assert.ok(frame.includes('Line 3'), 'line 3 shown');
    assert.ok(frame.includes('Project'), 'line 1 has Project widget');
    assert.ok(frame.includes('Timer'), 'line 2 has Timer widget');
  });

  test('renders empty lines as (empty)', () => {
    const { lastFrame } = render(e(ReorderLinesScreen, makeScreenProps()));
    const frame = lastFrame();
    assert.ok(frame.includes('(empty)'), 'empty line shown');
  });

  test('shows screen name label Reorder Lines', () => {
    const { lastFrame } = render(e(ReorderLinesScreen, makeScreenProps()));
    const frame = lastFrame();
    assert.ok(frame.includes('Reorder Lines'), 'screen name label');
  });

  test('shows navigate shortcuts initially', () => {
    const { lastFrame } = render(e(ReorderLinesScreen, makeScreenProps()));
    const frame = lastFrame();
    assert.ok(frame.includes('Navigate'));
    assert.ok(frame.includes('Grab'));
    assert.ok(frame.includes('Back'));
  });

  test('Escape calls goBack', async () => {
    let backCalled = false;
    const { stdin } = render(e(ReorderLinesScreen, makeScreenProps({
      goBack: () => { backCalled = true; },
    })));
    await delay(50);
    stdin.write('\x1B');
    await delay(50);
    assert.ok(backCalled);
  });

  test('Enter enters grab mode with moving marker', async () => {
    const { stdin, lastFrame } = render(e(ReorderLinesScreen, makeScreenProps()));
    await delay(50);
    stdin.write('\r'); // grab
    await delay(50);
    const frame = lastFrame();
    assert.ok(frame.includes('moving'), 'moving marker shown');
    assert.ok(frame.includes('Move'), 'move shortcuts');
    assert.ok(frame.includes('Drop'), 'drop shortcut');
  });

  test('swap updates preview during move', async () => {
    let lastPreview = null;
    const config = createDefaultConfig();
    config.lines[1].widgets = ['bmad-timer'];
    config.lines[1].colorModes = { 'bmad-timer': { mode: 'fixed', fixedColor: 'brightBlack' } };
    const { stdin } = render(e(ReorderLinesScreen, makeScreenProps({
      config,
      setPreviewOverride: (v) => { lastPreview = v; },
    })));
    await delay(50);
    stdin.write('\r'); // grab line 0
    await delay(50);
    stdin.write('\x1B[B'); // move down (swap line 0 and 1)
    await delay(50);
    assert.ok(lastPreview, 'previewOverride set during move');
  });

  test('drop persists swap via updateConfig', async () => {
    let updatedCfg = null;
    let previewCleared = false;
    const config = createDefaultConfig();
    config.lines[1].widgets = ['bmad-timer'];
    config.lines[1].colorModes = { 'bmad-timer': { mode: 'fixed', fixedColor: 'brightBlack' } };
    const { stdin } = render(e(ReorderLinesScreen, makeScreenProps({
      config,
      updateConfig: (mutator) => { const cfg = structuredClone(config); mutator(cfg); updatedCfg = cfg; },
      setPreviewOverride: (v) => { if (v === null) previewCleared = true; },
    })));
    await delay(50);
    stdin.write('\r'); // grab line 0
    await delay(50);
    stdin.write('\x1B[B'); // swap with line 1
    await delay(50);
    stdin.write('\r'); // drop
    await delay(50);
    assert.ok(updatedCfg, 'updateConfig called on drop');
    // Line 0 should now have timer (was line 1), line 1 should have original line 0 widgets
    assert.deepStrictEqual(updatedCfg.lines[0].widgets, ['bmad-timer'], 'line 0 now has timer');
    assert.ok(updatedCfg.lines[1].widgets.includes('bmad-project'), 'line 1 now has project');
    assert.ok(previewCleared, 'previewOverride cleared on drop');
  });

  test('cancel reverts to original positions', async () => {
    let previewCleared = false;
    let configUpdated = false;
    const config = createDefaultConfig();
    config.lines[1].widgets = ['bmad-timer'];
    config.lines[1].colorModes = { 'bmad-timer': { mode: 'fixed', fixedColor: 'brightBlack' } };
    const { stdin, lastFrame } = render(e(ReorderLinesScreen, makeScreenProps({
      config,
      updateConfig: () => { configUpdated = true; },
      setPreviewOverride: (v) => { if (v === null) previewCleared = true; },
    })));
    await delay(50);
    stdin.write('\r'); // grab line 0
    await delay(50);
    stdin.write('\x1B[B'); // swap
    await delay(50);
    stdin.write('\x1B'); // cancel
    await delay(50);
    assert.ok(!configUpdated, 'no config update on cancel');
    assert.ok(previewCleared, 'previewOverride cleared on cancel');
    // Should be back in navigate mode
    const frame = lastFrame();
    assert.ok(frame.includes('Navigate'), 'back to navigate shortcuts');
  });
});
