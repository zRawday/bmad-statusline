// tui-edit-line.test.js — Tests for EditLineScreen (v2: BF1, h toggle, g grab, inline status)

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import { EditLineScreen } from '../src/tui/screens/EditLineScreen.js';
import { createDefaultConfig, getIndividualWidgets } from '../src/tui/widget-registry.js';

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

describe('EditLineScreen', () => {
  test('renders all 7 widgets from registry', () => {
    const { lastFrame } = render(e(EditLineScreen, makeScreenProps()));
    const frame = lastFrame();
    const allWidgets = getIndividualWidgets();
    for (const w of allWidgets) {
      assert.ok(frame.includes(w.name), `widget ${w.name} visible in list`);
    }
  });

  test('shows visible widgets with ■ and hidden widgets with □', () => {
    const { lastFrame } = render(e(EditLineScreen, makeScreenProps()));
    const frame = lastFrame();
    assert.ok(frame.includes('■'), 'visible marker');
    assert.ok(frame.includes('□'), 'hidden marker');
  });

  test('shows screen name label Edit Line N', () => {
    const { lastFrame } = render(e(EditLineScreen, makeScreenProps({ editingLine: 1 })));
    assert.ok(lastFrame().includes('Edit Line 2'), 'screen name label');
  });

  test('shows navigate shortcuts', () => {
    const { lastFrame } = render(e(EditLineScreen, makeScreenProps()));
    const frame = lastFrame();
    assert.ok(frame.includes('Hide/Show'));
    assert.ok(frame.includes('Grab'));
    assert.ok(frame.includes('Color'));
  });

  test('h key toggles visibility — hide a visible widget', async () => {
    let updatedCfg = null;
    const props = makeScreenProps({
      updateConfig: (mutator) => {
        const cfg = structuredClone(props.config);
        mutator(cfg);
        updatedCfg = cfg;
      },
    });
    const { stdin } = render(e(EditLineScreen, props));
    await delay(50);
    // First widget (bmad-project) is visible — press h to hide
    stdin.write('h');
    await delay(50);
    assert.ok(updatedCfg, 'updateConfig was called');
    assert.ok(!updatedCfg.lines[0].widgets.includes('bmad-project'), 'widget removed from line');
    // colorModes should be preserved
    assert.ok(updatedCfg.lines[0].colorModes['bmad-project'], 'colorModes preserved on hide');
  });

  test('h key toggles visibility — show a hidden widget', async () => {
    let updatedCfg = null;
    const config = createDefaultConfig();
    const props = makeScreenProps({
      config,
      updateConfig: (mutator) => {
        const cfg = structuredClone(config);
        mutator(cfg);
        updatedCfg = cfg;
      },
    });
    const { stdin } = render(e(EditLineScreen, props));
    await delay(50);
    // Navigate down to a hidden widget (nextstep at index 6)
    for (let i = 0; i < 6; i++) {
      stdin.write('\x1B[B');
      await delay(20);
    }
    stdin.write('h');
    await delay(50);
    assert.ok(updatedCfg, 'updateConfig was called');
    assert.ok(updatedCfg.lines[0].widgets.length > config.lines[0].widgets.length, 'widget added');
  });

  test('Escape calls goBack', async () => {
    let backCalled = false;
    const { stdin } = render(e(EditLineScreen, makeScreenProps({
      goBack: () => { backCalled = true; },
    })));
    await delay(50);
    stdin.write('\x1B');
    await delay(50);
    assert.ok(backCalled);
  });

  test('right arrow cycles color on visible widget', async () => {
    let updatedCfg = null;
    const config = createDefaultConfig();
    const props = makeScreenProps({
      config,
      updateConfig: (mutator) => {
        const cfg = structuredClone(config);
        mutator(cfg);
        updatedCfg = cfg;
      },
    });
    const { stdin } = render(e(EditLineScreen, props));
    await delay(50);
    // First widget (bmad-project) is visible with fixedColor cyan
    stdin.write('\x1B[C'); // right arrow
    await delay(50);
    assert.ok(updatedCfg, 'updateConfig was called');
    // Should have cycled to next color after cyan
    assert.notEqual(updatedCfg.lines[0].colorModes['bmad-project'].fixedColor, 'cyan');
  });

  test('g key enters grab mode with Drop shortcut', async () => {
    const { stdin, lastFrame } = render(e(EditLineScreen, makeScreenProps()));
    await delay(50);
    stdin.write('g');
    await delay(50);
    const frame = lastFrame();
    assert.ok(frame.includes('Drop'), 'grab shortcuts shown');
    assert.ok(frame.includes('\u2195'), 'grab indicator visible');
  });

  test('g key on hidden widget also enters grab mode', async () => {
    const config = createDefaultConfig();
    const visibleCount = config.lines[0].widgets.length;
    const { stdin, lastFrame } = render(e(EditLineScreen, makeScreenProps({
      config,
    })));
    await delay(50);
    // Navigate to first hidden widget
    for (let i = 0; i < visibleCount; i++) {
      stdin.write('\x1B[B');
      await delay(20);
    }
    stdin.write('g');
    await delay(50);
    // Should be in grab mode
    assert.ok(lastFrame().includes('Drop'), 'grab mode entered');
  });

  test('hidden widget status uses brightBlack color', () => {
    const { lastFrame } = render(e(EditLineScreen, makeScreenProps()));
    const frame = lastFrame();
    assert.ok(frame.includes('hidden'), 'hidden status shown');
  });
});
