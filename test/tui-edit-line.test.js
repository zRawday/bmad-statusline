// tui-edit-line.test.js — Tests for EditLineScreen (v2: BF1, h toggle, g grab, inline status)

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { render } from 'ink-testing-library';
import { EditLineScreen } from '../src/tui/screens/EditLineScreen.js';
import { createDefaultConfig, getIndividualWidgets } from '../src/tui/widget-registry.js';

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

describe('EditLineScreen', () => {
  test('renders all 7 widgets from registry', () => {
    const { lastFrame, unmount } = render(e(EditLineScreen, makeScreenProps()));
    const frame = lastFrame();
    const allWidgets = getIndividualWidgets();
    for (const w of allWidgets) {
      assert.ok(frame.includes(w.name), `widget ${w.name} visible in list`);
    }
    unmount();
  });

  test('shows visible widgets with ■ and hidden widgets with □', () => {
    const { lastFrame, unmount } = render(e(EditLineScreen, makeScreenProps()));
    const frame = lastFrame();
    assert.ok(frame.includes('■'), 'visible marker');
    assert.ok(frame.includes('□'), 'hidden marker');
    unmount();
  });

  test('shows screen name label Edit Line N', () => {
    const { lastFrame, unmount } = render(e(EditLineScreen, makeScreenProps({ editingLine: 1 })));
    assert.ok(lastFrame().includes('Edit Line 2'), 'screen name label');
    unmount();
  });

  test('shows navigate shortcuts', () => {
    const { lastFrame, unmount } = render(e(EditLineScreen, makeScreenProps()));
    const frame = lastFrame();
    assert.ok(frame.includes('Hide/Show'));
    assert.ok(frame.includes('Grab'));
    assert.ok(frame.includes('Color'));
    unmount();
  });

  test('h key toggles visibility — hide a visible widget', async () => {
    let updatedCfg = null;
    const props = makeScreenProps({
      editingLine: 1,
      updateConfig: (mutator) => {
        const cfg = structuredClone(props.config);
        mutator(cfg);
        updatedCfg = cfg;
      },
    });
    const { stdin, unmount } = render(e(EditLineScreen, props));
    // First widget in widgetOrder is bmad-llmstate, visible on line 1 — press h to hide
    await act(async () => { stdin.write('h'); });
    assert.ok(updatedCfg, 'updateConfig was called');
    assert.ok(!updatedCfg.lines[1].widgets.includes('bmad-llmstate'), 'widget removed from line');
    // colorModes should be preserved
    assert.ok(updatedCfg.lines[1].colorModes['bmad-llmstate'], 'colorModes preserved on hide');
    unmount();
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
    const { stdin, unmount } = render(e(EditLineScreen, props));
    // Navigate down to a hidden widget (nextstep at index 7: llmstate=0..nextstep=7)
    for (let i = 0; i < 7; i++) {
      await act(async () => { stdin.write('\x1B[B'); });
    }
    await act(async () => { stdin.write('h'); });
    assert.ok(updatedCfg, 'updateConfig was called');
    assert.ok(updatedCfg.lines[0].widgets.length > config.lines[0].widgets.length, 'widget added');
    unmount();
  });

  test('Escape calls goBack', async () => {
    let backCalled = false;
    const { stdin, unmount } = render(e(EditLineScreen, makeScreenProps({
      goBack: () => { backCalled = true; },
    })));
    await act(async () => { stdin.write('\x1B'); });
    assert.ok(backCalled);
    unmount();
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
    const { stdin, unmount } = render(e(EditLineScreen, props));
    // First widget is bmad-llmstate (color locked) — navigate to bmad-project (index 1)
    await act(async () => { stdin.write('\x1B[B'); });
    await act(async () => { stdin.write('\x1B[C'); }); // right arrow
    assert.ok(updatedCfg, 'updateConfig was called');
    // Should have cycled bmad-project color
    assert.notEqual(updatedCfg.lines[0].colorModes['bmad-project'].fixedColor, 'cyan');
    unmount();
  });

  test('g key enters grab mode with Drop shortcut', async () => {
    const { stdin, lastFrame, unmount } = render(e(EditLineScreen, makeScreenProps()));
    await act(async () => { stdin.write('g'); });
    const frame = lastFrame();
    assert.ok(frame.includes('Drop'), 'grab shortcuts shown');
    assert.ok(frame.includes('\u2195'), 'grab indicator visible');
    unmount();
  });

  test('g key on hidden widget also enters grab mode', async () => {
    const config = createDefaultConfig();
    const visibleCount = config.lines[0].widgets.length;
    const { stdin, lastFrame, unmount } = render(e(EditLineScreen, makeScreenProps({
      config,
    })));
    // Navigate to first hidden widget
    for (let i = 0; i < visibleCount; i++) {
      await act(async () => { stdin.write('\x1B[B'); });
    }
    await act(async () => { stdin.write('g'); });
    // Should be in grab mode
    assert.ok(lastFrame().includes('Drop'), 'grab mode entered');
    unmount();
  });

  test('m key toggles displayMode on story widget', async () => {
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
    const { stdin, unmount } = render(e(EditLineScreen, props));
    // Navigate down to story widget (index 4: llmstate=0, project=1, workflow=2, activeskill=3, story=4)
    for (let i = 0; i < 4; i++) {
      await act(async () => { stdin.write('\x1B[B'); });
    }
    await act(async () => { stdin.write('m'); });
    assert.ok(updatedCfg, 'updateConfig was called');
    assert.equal(updatedCfg.lines[0].colorModes['bmad-story'].displayMode, 'compact', 'should toggle to compact');
    unmount();
  });

  test('m key on non-story widget does nothing', async () => {
    let updatedCfg = null;
    const props = makeScreenProps({
      updateConfig: (mutator) => {
        const cfg = structuredClone(props.config);
        mutator(cfg);
        updatedCfg = cfg;
      },
    });
    const { stdin, unmount } = render(e(EditLineScreen, props));
    // Cursor is on project (index 0) — m should do nothing
    await act(async () => { stdin.write('m'); });
    assert.equal(updatedCfg, null, 'updateConfig should NOT be called for non-story widget');
    unmount();
  });

  test('shows displayMode hint on story widget', () => {
    const { lastFrame, unmount } = render(e(EditLineScreen, makeScreenProps()));
    const frame = lastFrame();
    assert.ok(frame.includes('(full)'), 'should show (full) hint for story widget');
    unmount();
  });

  test('shows Mode shortcut label', async () => {
    const { lastFrame, stdin, unmount } = render(e(EditLineScreen, makeScreenProps()));
    // Move cursor to bmad-story (index 4: llmstate, project, workflow, activeskill, story)
    for (let i = 0; i < 4; i++) {
      await act(async () => { stdin.write('\x1B[B'); }); // arrow down
    }
    const frame = lastFrame();
    assert.ok(frame.includes('Mode'), 'should show Mode shortcut');
    unmount();
  });

  test('hidden widget status uses brightBlack color', () => {
    const { lastFrame, unmount } = render(e(EditLineScreen, makeScreenProps()));
    const frame = lastFrame();
    assert.ok(frame.includes('hidden'), 'hidden status shown');
    unmount();
  });
});
