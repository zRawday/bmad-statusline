// tui-preset.test.js — Tests for PresetSaveScreen and PresetLoadScreen

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import { PresetSaveScreen } from '../src/tui/screens/PresetSaveScreen.js';
import { PresetLoadScreen } from '../src/tui/screens/PresetLoadScreen.js';
import { createDefaultConfig } from '../src/tui/widget-registry.js';

const e = React.createElement;

const delay = (ms) => new Promise(r => setTimeout(r, ms));

const ALL_IDS = ['bmad-project', 'bmad-workflow', 'bmad-activeskill', 'bmad-story', 'bmad-progressstep', 'bmad-nextstep', 'bmad-timer'];

function makePreset(name, line0Widgets = [], line1Widgets = [], line2Widgets = []) {
  return {
    name,
    lines: [
      { widgets: line0Widgets, widgetOrder: [...ALL_IDS] },
      { widgets: line1Widgets, widgetOrder: [...ALL_IDS] },
      { widgets: line2Widgets, widgetOrder: [...ALL_IDS] },
    ],
    separator: 'modere',
    customSeparator: null,
  };
}

function makeScreenProps(overrides = {}) {
  return {
    config: createDefaultConfig(),
    updateConfig: () => {},
    previewOverride: null,
    setPreviewOverride: () => {},
    navigate: () => {},
    goBack: () => {},
    isActive: true,
    ...overrides,
  };
}

describe('PresetSaveScreen', () => {
  test('renders 3 slots with (empty) for null presets', () => {
    const { lastFrame } = render(e(PresetSaveScreen, makeScreenProps()));
    const frame = lastFrame();
    assert.ok(frame.includes('1.'), 'slot 1');
    assert.ok(frame.includes('2.'), 'slot 2');
    assert.ok(frame.includes('3.'), 'slot 3');
    assert.ok(frame.includes('(empty)'), 'empty label');
  });

  test('shows screen name label Save Preset', () => {
    const { lastFrame } = render(e(PresetSaveScreen, makeScreenProps()));
    const frame = lastFrame();
    assert.ok(frame.includes('Save Preset'), 'screen name label');
  });

  test('shows Save here shortcut', () => {
    const { lastFrame } = render(e(PresetSaveScreen, makeScreenProps()));
    assert.ok(lastFrame().includes('Save here'));
  });

  test('Escape calls goBack', async () => {
    let backCalled = false;
    const { stdin } = render(e(PresetSaveScreen, makeScreenProps({
      goBack: () => { backCalled = true; },
    })));
    await delay(50);
    stdin.write('\x1B');
    await delay(50);
    assert.ok(backCalled);
  });

  test('Enter on empty slot shows TextInput for naming', async () => {
    const { stdin, lastFrame } = render(e(PresetSaveScreen, makeScreenProps()));
    await delay(50);
    stdin.write('\r');
    await delay(50);
    const frame = lastFrame();
    assert.ok(frame.includes('Preset name') || frame.includes('Enter name'), 'naming prompt shown');
  });

  test('Enter on non-empty slot shows ConfirmDialog', async () => {
    const config = createDefaultConfig();
    config.presets[0] = makePreset('dev-focus', ['bmad-project']);
    const { stdin, lastFrame } = render(e(PresetSaveScreen, makeScreenProps({ config })));
    await delay(50);
    stdin.write('\r');
    await delay(50);
    const frame = lastFrame();
    assert.ok(frame.includes('Overwrite'), 'confirm dialog shown');
    assert.ok(frame.includes('dev-focus'), 'slot name in confirm');
  });

  test('overwrite confirm shows rename then saves and goes back', async () => {
    let updatedCfg = null;
    let backCalled = false;
    const config = createDefaultConfig();
    config.presets[0] = makePreset('dev-focus', ['bmad-project']);
    const { stdin, lastFrame } = render(e(PresetSaveScreen, makeScreenProps({
      config,
      updateConfig: (mutator) => { const cfg = structuredClone(config); mutator(cfg); updatedCfg = cfg; },
      goBack: () => { backCalled = true; },
    })));
    await delay(50);
    stdin.write('\r'); // Select slot 0 (non-empty)
    await delay(50);
    stdin.write('\r'); // Confirm overwrite
    await delay(50);
    // Rename TextInput should appear with default name
    const frame = lastFrame();
    assert.ok(frame.includes('Preset name'), 'rename prompt shown after confirm');
    stdin.write('\r'); // Submit default name
    await delay(50);
    assert.ok(updatedCfg, 'updateConfig called');
    assert.ok(updatedCfg.presets[0].name === 'dev-focus', 'name preserved when unchanged');
    assert.ok(backCalled, 'goBack called');
  });

  test('overwrite cancel returns to list', async () => {
    let backCalled = false;
    const config = createDefaultConfig();
    config.presets[0] = makePreset('dev-focus', ['bmad-project']);
    const { stdin, lastFrame } = render(e(PresetSaveScreen, makeScreenProps({
      config,
      goBack: () => { backCalled = true; },
    })));
    await delay(50);
    stdin.write('\r'); // Select slot 0 (non-empty)
    await delay(50);
    stdin.write('\x1B'); // Cancel confirm
    await delay(50);
    assert.ok(!backCalled, 'did not go back');
    assert.ok(lastFrame().includes('1.'), 'back to slot list');
  });

  test('renders non-empty slot with name and widget summary', () => {
    const config = createDefaultConfig();
    config.presets[1] = makePreset('my-preset', ['bmad-project', 'bmad-workflow']);
    const { lastFrame } = render(e(PresetSaveScreen, makeScreenProps({ config })));
    const frame = lastFrame();
    assert.ok(frame.includes('my-preset'), 'preset name');
    assert.ok(frame.includes('Project'), 'widget name');
    assert.ok(frame.includes('Initial Skill'), 'widget name');
  });
});

describe('PresetLoadScreen', () => {
  test('renders 3 slots with (empty) for null presets', () => {
    const { lastFrame } = render(e(PresetLoadScreen, makeScreenProps()));
    const frame = lastFrame();
    assert.ok(frame.includes('1.'), 'slot 1');
    assert.ok(frame.includes('(empty)'), 'empty label');
  });

  test('shows screen name label Load Preset', () => {
    const { lastFrame } = render(e(PresetLoadScreen, makeScreenProps()));
    const frame = lastFrame();
    assert.ok(frame.includes('Load Preset'), 'screen name label');
  });

  test('shows Load shortcut', () => {
    const { lastFrame } = render(e(PresetLoadScreen, makeScreenProps()));
    assert.ok(lastFrame().includes('Load'));
  });

  test('Escape calls goBack', async () => {
    let backCalled = false;
    const { stdin } = render(e(PresetLoadScreen, makeScreenProps({
      goBack: () => { backCalled = true; },
    })));
    await delay(50);
    stdin.write('\x1B');
    await delay(50);
    assert.ok(backCalled);
  });

  test('Enter on empty slot is no-op', async () => {
    let backCalled = false;
    let configUpdated = false;
    const { stdin } = render(e(PresetLoadScreen, makeScreenProps({
      goBack: () => { backCalled = true; },
      updateConfig: () => { configUpdated = true; },
    })));
    await delay(50);
    stdin.write('\r');
    await delay(50);
    assert.ok(!backCalled, 'did not go back');
    assert.ok(!configUpdated, 'no config update');
  });

  test('Enter on non-empty slot loads preset and goes back', async () => {
    let updatedCfg = null;
    let backCalled = false;
    let previewCleared = false;
    const config = createDefaultConfig();
    const originalColorModes0 = structuredClone(config.lines[0].colorModes);
    config.presets[0] = makePreset('dev-focus', ['bmad-timer']);
    const { stdin } = render(e(PresetLoadScreen, makeScreenProps({
      config,
      updateConfig: (mutator) => { const cfg = structuredClone(config); mutator(cfg); updatedCfg = cfg; },
      goBack: () => { backCalled = true; },
      setPreviewOverride: (v) => { if (v === null) previewCleared = true; },
    })));
    await delay(50);
    stdin.write('\r');
    await delay(50);
    assert.ok(updatedCfg, 'updateConfig called');
    assert.deepStrictEqual(updatedCfg.lines[0].widgets, ['bmad-timer'], 'widgets replaced from preset');
    assert.deepStrictEqual(updatedCfg.lines[0].colorModes, originalColorModes0, 'colorModes preserved');
    assert.ok(previewCleared, 'previewOverride cleared');
    assert.ok(backCalled, 'goBack called');
  });

  test('load replaces all lines and separator, preserves colors', async () => {
    let updatedCfg = null;
    const config = createDefaultConfig();
    config.lines[1].widgets = ['bmad-story'];
    config.lines[1].colorModes = { 'bmad-story': { mode: 'fixed', fixedColor: 'magenta' } };
    const originalColorModes1 = structuredClone(config.lines[1].colorModes);
    config.presets[0] = makePreset('test', ['bmad-timer'], ['bmad-project'], []);
    const { stdin } = render(e(PresetLoadScreen, makeScreenProps({
      config,
      updateConfig: (mutator) => { const cfg = structuredClone(config); mutator(cfg); updatedCfg = cfg; },
    })));
    await delay(50);
    stdin.write('\r');
    await delay(50);
    assert.ok(updatedCfg, 'updateConfig called');
    // All 3 lines replaced from preset
    assert.deepStrictEqual(updatedCfg.lines[0].widgets, ['bmad-timer'], 'line 0 widgets from preset');
    assert.deepStrictEqual(updatedCfg.lines[1].widgets, ['bmad-project'], 'line 1 widgets from preset');
    assert.deepStrictEqual(updatedCfg.lines[2].widgets, [], 'line 2 widgets from preset');
    assert.equal(updatedCfg.separator, 'modere', 'separator from preset');
    // Colors preserved
    assert.deepStrictEqual(updatedCfg.lines[1].colorModes, originalColorModes1, 'colorModes preserved');
  });

  test('highlight on non-empty slot sets previewOverride', async () => {
    let lastPreview = null;
    const config = createDefaultConfig();
    config.presets[1] = makePreset('test', ['bmad-timer']);
    const { stdin } = render(e(PresetLoadScreen, makeScreenProps({
      config,
      setPreviewOverride: (v) => { lastPreview = v; },
    })));
    await delay(50);
    // Navigate down to slot 1
    stdin.write('\x1B[B');
    await delay(50);
    assert.ok(lastPreview, 'previewOverride set on highlight');
    assert.deepStrictEqual(lastPreview.lines[0].widgets, ['bmad-timer'], 'preview shows preset content');
  });

  test('highlight on empty slot clears previewOverride', async () => {
    let lastPreview = 'not-null';
    const config = createDefaultConfig();
    // All presets are null (empty)
    const { stdin } = render(e(PresetLoadScreen, makeScreenProps({
      config,
      setPreviewOverride: (v) => { lastPreview = v; },
    })));
    await delay(50);
    stdin.write('\x1B[B');
    await delay(50);
    assert.equal(lastPreview, null, 'previewOverride cleared for empty slot');
  });
});
