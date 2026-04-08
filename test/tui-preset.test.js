// tui-preset.test.js — Tests for PresetSaveScreen and PresetLoadScreen

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { render } from 'ink-testing-library';
import { PresetSaveScreen } from '../src/tui/screens/PresetSaveScreen.js';
import { PresetLoadScreen } from '../src/tui/screens/PresetLoadScreen.js';
import { createDefaultConfig } from '../src/tui/widget-registry.js';

const e = React.createElement;

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
    const { lastFrame, unmount } = render(e(PresetSaveScreen, makeScreenProps()));
    const frame = lastFrame();
    assert.ok(frame.includes('1.'), 'slot 1');
    assert.ok(frame.includes('2.'), 'slot 2');
    assert.ok(frame.includes('3.'), 'slot 3');
    assert.ok(frame.includes('(empty)'), 'empty label');
    unmount();
  });

  test('shows screen name label Save Preset', () => {
    const { lastFrame, unmount } = render(e(PresetSaveScreen, makeScreenProps()));
    const frame = lastFrame();
    assert.ok(frame.includes('Save Preset'), 'screen name label');
    unmount();
  });

  test('shows Save here shortcut', () => {
    const { lastFrame, unmount } = render(e(PresetSaveScreen, makeScreenProps()));
    assert.ok(lastFrame().includes('Save here'));
    unmount();
  });

  test('Escape calls goBack', async () => {
    let backCalled = false;
    const { stdin, unmount } = render(e(PresetSaveScreen, makeScreenProps({
      goBack: () => { backCalled = true; },
    })));
    await act(async () => { stdin.write('\x1B'); });
    assert.ok(backCalled);
    unmount();
  });

  test('Enter on empty slot shows TextInput for naming', async () => {
    const { stdin, lastFrame, unmount } = render(e(PresetSaveScreen, makeScreenProps()));
    await act(async () => { stdin.write('\r'); });
    const frame = lastFrame();
    assert.ok(frame.includes('Preset name') || frame.includes('Enter name'), 'naming prompt shown');
    unmount();
  });

  test('Enter on non-empty slot shows ConfirmDialog', async () => {
    const config = createDefaultConfig();
    config.presets[0] = makePreset('dev-focus', ['bmad-project']);
    const { stdin, lastFrame, unmount } = render(e(PresetSaveScreen, makeScreenProps({ config })));
    await act(async () => { stdin.write('\r'); });
    const frame = lastFrame();
    assert.ok(frame.includes('Overwrite'), 'confirm dialog shown');
    assert.ok(frame.includes('dev-focus'), 'slot name in confirm');
    unmount();
  });

  test('overwrite confirm shows rename then saves and goes back', async () => {
    let updatedCfg = null;
    let backCalled = false;
    const config = createDefaultConfig();
    config.presets[0] = makePreset('dev-focus', ['bmad-project']);
    const { stdin, lastFrame, unmount } = render(e(PresetSaveScreen, makeScreenProps({
      config,
      updateConfig: (mutator) => { const cfg = structuredClone(config); mutator(cfg); updatedCfg = cfg; },
      goBack: () => { backCalled = true; },
    })));
    await act(async () => { stdin.write('\r'); }); // Select slot 0 (non-empty)
    await act(async () => { stdin.write('\r'); }); // Confirm overwrite
    // Rename TextInput should appear with default name
    const frame = lastFrame();
    assert.ok(frame.includes('Preset name'), 'rename prompt shown after confirm');
    await act(async () => { stdin.write('\r'); }); // Submit default name
    assert.ok(updatedCfg, 'updateConfig called');
    assert.ok(updatedCfg.presets[0].name === 'dev-focus', 'name preserved when unchanged');
    assert.ok(backCalled, 'goBack called');
    unmount();
  });

  test('overwrite cancel returns to list', async () => {
    let backCalled = false;
    const config = createDefaultConfig();
    config.presets[0] = makePreset('dev-focus', ['bmad-project']);
    const { stdin, lastFrame, unmount } = render(e(PresetSaveScreen, makeScreenProps({
      config,
      goBack: () => { backCalled = true; },
    })));
    await act(async () => { stdin.write('\r'); }); // Select slot 0 (non-empty)
    await act(async () => { stdin.write('\x1B'); }); // Cancel confirm
    assert.ok(!backCalled, 'did not go back');
    assert.ok(lastFrame().includes('1.'), 'back to slot list');
    unmount();
  });

  test('renders non-empty slot with name and widget summary', () => {
    const config = createDefaultConfig();
    config.presets[1] = makePreset('my-preset', ['bmad-project', 'bmad-workflow']);
    const { lastFrame, unmount } = render(e(PresetSaveScreen, makeScreenProps({ config })));
    const frame = lastFrame();
    assert.ok(frame.includes('my-preset'), 'preset name');
    assert.ok(frame.includes('Project'), 'widget name');
    assert.ok(frame.includes('Initial Skill'), 'widget name');
    unmount();
  });
});

describe('PresetLoadScreen', () => {
  test('renders 3 slots with (empty) for null presets', () => {
    const { lastFrame, unmount } = render(e(PresetLoadScreen, makeScreenProps()));
    const frame = lastFrame();
    assert.ok(frame.includes('1.'), 'slot 1');
    assert.ok(frame.includes('(empty)'), 'empty label');
    unmount();
  });

  test('shows screen name label Load Preset', () => {
    const { lastFrame, unmount } = render(e(PresetLoadScreen, makeScreenProps()));
    const frame = lastFrame();
    assert.ok(frame.includes('Load Preset'), 'screen name label');
    unmount();
  });

  test('shows Load shortcut', () => {
    const { lastFrame, unmount } = render(e(PresetLoadScreen, makeScreenProps()));
    assert.ok(lastFrame().includes('Load'));
    unmount();
  });

  test('Escape calls goBack', async () => {
    let backCalled = false;
    const { stdin, unmount } = render(e(PresetLoadScreen, makeScreenProps({
      goBack: () => { backCalled = true; },
    })));
    await act(async () => { stdin.write('\x1B'); });
    assert.ok(backCalled);
    unmount();
  });

  test('Enter on empty slot is no-op', async () => {
    let backCalled = false;
    let configUpdated = false;
    const { stdin, unmount } = render(e(PresetLoadScreen, makeScreenProps({
      goBack: () => { backCalled = true; },
      updateConfig: () => { configUpdated = true; },
    })));
    await act(async () => { stdin.write('\r'); });
    assert.ok(!backCalled, 'did not go back');
    assert.ok(!configUpdated, 'no config update');
    unmount();
  });

  test('Enter on non-empty slot loads preset and goes back', async () => {
    let updatedCfg = null;
    let backCalled = false;
    let previewCleared = false;
    const config = createDefaultConfig();
    const originalColorModes0 = structuredClone(config.lines[0].colorModes);
    config.presets[0] = makePreset('dev-focus', ['bmad-timer']);
    const { stdin, unmount } = render(e(PresetLoadScreen, makeScreenProps({
      config,
      updateConfig: (mutator) => { const cfg = structuredClone(config); mutator(cfg); updatedCfg = cfg; },
      goBack: () => { backCalled = true; },
      setPreviewOverride: (v) => { if (v === null) previewCleared = true; },
    })));
    await act(async () => { stdin.write('\r'); });
    assert.ok(updatedCfg, 'updateConfig called');
    assert.deepStrictEqual(updatedCfg.lines[0].widgets, ['bmad-timer'], 'widgets replaced from preset');
    assert.deepStrictEqual(updatedCfg.lines[0].colorModes, originalColorModes0, 'colorModes preserved');
    assert.ok(previewCleared, 'previewOverride cleared');
    assert.ok(backCalled, 'goBack called');
    unmount();
  });

  test('load replaces all lines and separator, preserves colors', async () => {
    let updatedCfg = null;
    const config = createDefaultConfig();
    config.lines[1].widgets = ['bmad-story'];
    config.lines[1].colorModes = { 'bmad-story': { mode: 'fixed', fixedColor: 'magenta' } };
    const originalColorModes1 = structuredClone(config.lines[1].colorModes);
    config.presets[0] = makePreset('test', ['bmad-timer'], ['bmad-project'], []);
    const { stdin, unmount } = render(e(PresetLoadScreen, makeScreenProps({
      config,
      updateConfig: (mutator) => { const cfg = structuredClone(config); mutator(cfg); updatedCfg = cfg; },
    })));
    await act(async () => { stdin.write('\r'); });
    assert.ok(updatedCfg, 'updateConfig called');
    // All 3 lines replaced from preset
    assert.deepStrictEqual(updatedCfg.lines[0].widgets, ['bmad-timer'], 'line 0 widgets from preset');
    assert.deepStrictEqual(updatedCfg.lines[1].widgets, ['bmad-project'], 'line 1 widgets from preset');
    assert.deepStrictEqual(updatedCfg.lines[2].widgets, [], 'line 2 widgets from preset');
    assert.equal(updatedCfg.separator, 'modere', 'separator from preset');
    // Colors preserved
    assert.deepStrictEqual(updatedCfg.lines[1].colorModes, originalColorModes1, 'colorModes preserved');
    unmount();
  });

  test('highlight on non-empty slot sets previewOverride', async () => {
    let lastPreview = null;
    const config = createDefaultConfig();
    config.presets[1] = makePreset('test', ['bmad-timer']);
    const { stdin, unmount } = render(e(PresetLoadScreen, makeScreenProps({
      config,
      setPreviewOverride: (v) => { lastPreview = v; },
    })));
    // Navigate down to slot 1
    await act(async () => { stdin.write('\x1B[B'); });
    assert.ok(lastPreview, 'previewOverride set on highlight');
    assert.deepStrictEqual(lastPreview.lines[0].widgets, ['bmad-timer'], 'preview shows preset content');
    unmount();
  });

  test('highlight on empty slot clears previewOverride', async () => {
    let lastPreview = 'not-null';
    const config = createDefaultConfig();
    // All presets are null (empty)
    const { stdin, unmount } = render(e(PresetLoadScreen, makeScreenProps({
      config,
      setPreviewOverride: (v) => { lastPreview = v; },
    })));
    await act(async () => { stdin.write('\x1B[B'); });
    assert.equal(lastPreview, null, 'previewOverride cleared for empty slot');
    unmount();
  });
});
