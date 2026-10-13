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
  test('renders all 12 widgets from registry', () => {
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
    // llmstate is hidden by default; make it visible on line 1 so this exercises hiding
    const config = createDefaultConfig();
    config.lines[1].widgets = ['bmad-llmstate', ...config.lines[1].widgets];
    const props = makeScreenProps({
      config,
      editingLine: 1,
      updateConfig: (mutator) => {
        const cfg = structuredClone(props.config);
        mutator(cfg);
        updatedCfg = cfg;
      },
    });
    const { stdin, unmount } = render(e(EditLineScreen, props));
    // First widget in widgetOrder is bmad-llmstate, now visible on line 1 — press h to hide
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

  test('m key toggles displayMode on the Current Item widget', async () => {
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
    // Navigate down to Current Item (index 4: llmstate=0, project=1, workflow=2, activeskill=3, currentitem=4)
    for (let i = 0; i < 4; i++) {
      await act(async () => { stdin.write('\x1B[B'); });
    }
    await act(async () => { stdin.write('m'); });
    assert.ok(updatedCfg, 'updateConfig was called');
    assert.equal(updatedCfg.lines[0].colorModes['bmad-currentitem'].displayMode, 'compact', 'should toggle to compact');
    // Both colors stay as they were
    assert.equal(updatedCfg.lines[0].colorModes['bmad-currentitem'].fixedColor, 'magenta');
    assert.equal(updatedCfg.lines[0].colorModes['bmad-currentitem'].documentColor, 'brightYellow');
    unmount();
  });

  test('m key on a widget without display mode does nothing', async () => {
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
    assert.equal(updatedCfg, null, 'updateConfig should NOT be called for a widget without display mode');
    unmount();
  });

  test('shows displayMode hint on the Current Item widget', () => {
    const { lastFrame, unmount } = render(e(EditLineScreen, makeScreenProps()));
    const frame = lastFrame();
    assert.ok(frame.includes('Current Item (full)'), 'should show (full) hint for Current Item');
    assert.ok(frame.includes('Current Item (full) ■'), 'a gap separates the long name from the status marker');
    unmount();
  });

  test('shows Mode shortcut label', async () => {
    const { lastFrame, stdin, unmount } = render(e(EditLineScreen, makeScreenProps()));
    // Move cursor to bmad-currentitem (index 4: llmstate, project, workflow, activeskill, currentitem)
    for (let i = 0; i < 4; i++) {
      await act(async () => { stdin.write('\x1B[B'); }); // arrow down
    }
    const frame = lastFrame();
    assert.ok(frame.includes('Mode'), 'should show Mode shortcut');
    unmount();
  });

  test('m key toggles displayMode on contextpct widget', async () => {
    let updatedCfg = null;
    const config = createDefaultConfig();
    const props = makeScreenProps({
      config,
      editingLine: 2,
      updateConfig: (mutator) => {
        const cfg = structuredClone(config);
        mutator(cfg);
        updatedCfg = cfg;
      },
    });
    const { stdin, unmount } = render(e(EditLineScreen, props));
    // Navigate to bmad-contextpct on line 2 — it's in widgetOrder so find its index
    const allWidgets = getIndividualWidgets();
    const order = config.lines[2].widgetOrder;
    const ctxIdx = order.indexOf('bmad-contextpct');
    for (let i = 0; i < ctxIdx; i++) {
      await act(async () => { stdin.write('\x1B[B'); });
    }
    await act(async () => { stdin.write('m'); });
    assert.ok(updatedCfg, 'updateConfig was called');
    assert.equal(updatedCfg.lines[2].colorModes['bmad-contextpct'].displayMode, 'full', 'should toggle from compact (default) to full');
    unmount();
  });

  test('m key toggles displayMode on weeklyusage widget (compact↔extended)', async () => {
    let updatedCfg = null;
    const config = createDefaultConfig();
    config.lines[0].widgets.push('bmad-weeklyusage'); // make visible so the toggle applies
    const props = makeScreenProps({
      config,
      updateConfig: (mutator) => {
        const cfg = structuredClone(config);
        mutator(cfg);
        updatedCfg = cfg;
      },
    });
    const { stdin, unmount } = render(e(EditLineScreen, props));
    const wuIdx = config.lines[0].widgetOrder.indexOf('bmad-weeklyusage');
    for (let i = 0; i < wuIdx; i++) {
      await act(async () => { stdin.write('\x1B[B'); });
    }
    await act(async () => { stdin.write('m'); });
    assert.ok(updatedCfg, 'updateConfig was called');
    assert.equal(updatedCfg.lines[0].colorModes['bmad-weeklyusage'].displayMode, 'extended', 'first toggle from compact (default) to extended');
    unmount();
  });

  test('shows (compact) displayMode hint on visible weeklyusage widget', () => {
    const config = createDefaultConfig();
    config.lines[0].widgets.push('bmad-weeklyusage');
    const { lastFrame, unmount } = render(e(EditLineScreen, makeScreenProps({ config })));
    assert.ok(lastFrame().includes('Weekly Usage (compact)'), 'shows (compact) hint for weeklyusage');
    unmount();
  });

  test('Enter on contextpct navigates to contextPctConfig', async () => {
    let navigatedTo = null;
    const config = createDefaultConfig();
    const props = makeScreenProps({
      config,
      editingLine: 2,
      navigate: (screen) => { navigatedTo = screen; },
    });
    const { stdin, unmount } = render(e(EditLineScreen, props));
    const order = config.lines[2].widgetOrder;
    const ctxIdx = order.indexOf('bmad-contextpct');
    for (let i = 0; i < ctxIdx; i++) {
      await act(async () => { stdin.write('\x1B[B'); });
    }
    await act(async () => { stdin.write('\r'); });
    assert.equal(navigatedTo, 'contextPctConfig');
    unmount();
  });

  test('hidden widget status uses brightBlack color', () => {
    const { lastFrame, unmount } = render(e(EditLineScreen, makeScreenProps()));
    const frame = lastFrame();
    assert.ok(frame.includes('hidden'), 'hidden status shown');
    unmount();
  });
});

describe('EditLineScreen — Current Item (two colors)', () => {
  const CURRENT_ITEM_INDEX = 4; // llmstate, project, workflow, activeskill, currentitem

  async function pressDown(stdin, times) {
    for (let i = 0; i < times; i++) {
      await act(async () => { stdin.write('\x1B[B'); });
    }
  }

  function renderOnCurrentItem(config, editingLine = 0) {
    const state = { updatedCfg: null };
    const props = makeScreenProps({
      config,
      editingLine,
      updateConfig: (mutator) => {
        const cfg = structuredClone(config);
        mutator(cfg);
        state.updatedCfg = cfg;
      },
    });
    return { state, ...render(e(EditLineScreen, props)) };
  }

  test('the row shows the story color and the document color', () => {
    const config = createDefaultConfig();
    config.lines[0].colorModes['bmad-currentitem'] = { mode: 'fixed', fixedColor: 'red', documentColor: 'blue' };
    const { lastFrame, unmount } = render(e(EditLineScreen, makeScreenProps({ config })));
    const row = lastFrame().split('\n').find(l => l.includes('Current Item'));
    assert.ok(row, 'Current Item row rendered');
    assert.ok(row.indexOf('red') > -1 && row.indexOf('blue') > row.indexOf('red'), 'story color then document color');
    unmount();
  });

  test('the shortcut bar offers d (document color) on the Current Item row only', async () => {
    const { stdin, lastFrame, unmount } = render(e(EditLineScreen, makeScreenProps()));
    assert.ok(!lastFrame().includes('Doc color'), 'not offered on another row');
    await pressDown(stdin, CURRENT_ITEM_INDEX);
    const frame = lastFrame();
    assert.ok(frame.includes('Doc color'), 'd shortcut shown for Current Item');
    assert.ok(frame.includes('Story color'), 'arrows are labelled as the story color there');
    assert.ok(frame.includes('Mode'), 'm shortcut still shown');
    unmount();
  });

  test('d cycles only the document color', async () => {
    const config = createDefaultConfig();
    config.lines[0].colorModes['bmad-currentitem'] = { mode: 'fixed', fixedColor: 'red', documentColor: 'blue', displayMode: 'compact' };
    const { state, stdin, unmount } = renderOnCurrentItem(config);
    await pressDown(stdin, CURRENT_ITEM_INDEX);
    await act(async () => { stdin.write('d'); });
    assert.ok(state.updatedCfg, 'updateConfig was called');
    assert.deepStrictEqual(state.updatedCfg.lines[0].colorModes['bmad-currentitem'], {
      mode: 'fixed', fixedColor: 'red', documentColor: 'magenta', displayMode: 'compact',
    });
    unmount();
  });

  test('d on a visible Current Item without a saved colorMode starts from the defaults', async () => {
    const config = createDefaultConfig();
    delete config.lines[0].colorModes['bmad-currentitem'];
    const { state, stdin, unmount } = renderOnCurrentItem(config);
    await pressDown(stdin, CURRENT_ITEM_INDEX);
    await act(async () => { stdin.write('d'); });
    // default document color brightYellow → next in the ANSI list is brightBlue
    assert.deepStrictEqual(state.updatedCfg.lines[0].colorModes['bmad-currentitem'], {
      mode: 'fixed', fixedColor: 'magenta', documentColor: 'brightBlue',
    });
    unmount();
  });

  test('d wraps around the color list', async () => {
    const config = createDefaultConfig();
    config.lines[0].colorModes['bmad-currentitem'] = { mode: 'fixed', fixedColor: 'red', documentColor: 'brightBlack' };
    const { state, stdin, unmount } = renderOnCurrentItem(config);
    await pressDown(stdin, CURRENT_ITEM_INDEX);
    await act(async () => { stdin.write('d'); });
    assert.equal(state.updatedCfg.lines[0].colorModes['bmad-currentitem'].documentColor, 'red');
    unmount();
  });

  test('right and left arrows cycle only the story color', async () => {
    const config = createDefaultConfig();
    config.lines[0].colorModes['bmad-currentitem'] = { mode: 'fixed', fixedColor: 'red', documentColor: 'blue', displayMode: 'compact' };
    const { state, stdin, unmount } = renderOnCurrentItem(config);
    await pressDown(stdin, CURRENT_ITEM_INDEX);
    await act(async () => { stdin.write('\x1B[C'); });
    assert.deepStrictEqual(state.updatedCfg.lines[0].colorModes['bmad-currentitem'], {
      mode: 'fixed', fixedColor: 'green', documentColor: 'blue', displayMode: 'compact',
    });
    state.updatedCfg = null;
    await act(async () => { stdin.write('\x1B[D'); });
    assert.deepStrictEqual(state.updatedCfg.lines[0].colorModes['bmad-currentitem'], {
      mode: 'fixed', fixedColor: 'brightBlack', documentColor: 'blue', displayMode: 'compact',
    });
    unmount();
  });

  test('the story color cycle supplies the default document color when none was saved', async () => {
    const config = createDefaultConfig();
    config.lines[0].colorModes['bmad-currentitem'] = { mode: 'fixed', fixedColor: 'magenta' };
    const { state, stdin, unmount } = renderOnCurrentItem(config);
    await pressDown(stdin, CURRENT_ITEM_INDEX);
    await act(async () => { stdin.write('\x1B[C'); });
    assert.equal(state.updatedCfg.lines[0].colorModes['bmad-currentitem'].documentColor, 'brightYellow');
    unmount();
  });

  test('d does nothing on a hidden Current Item', async () => {
    const config = createDefaultConfig();
    config.lines[0].widgets = config.lines[0].widgets.filter(id => id !== 'bmad-currentitem');
    const { state, stdin, unmount } = renderOnCurrentItem(config);
    await pressDown(stdin, CURRENT_ITEM_INDEX);
    await act(async () => { stdin.write('d'); });
    assert.equal(state.updatedCfg, null);
    unmount();
  });

  test('d does nothing on any other widget', async () => {
    const { state, stdin, unmount } = renderOnCurrentItem(createDefaultConfig());
    await pressDown(stdin, 1); // project
    await act(async () => { stdin.write('d'); });
    assert.equal(state.updatedCfg, null);
    unmount();
  });

  test('showing a hidden Current Item creates a colorMode that carries both colors', async () => {
    const config = createDefaultConfig();
    config.lines[1].widgetOrder = [...config.lines[0].widgetOrder];
    const { state, stdin, unmount } = renderOnCurrentItem(config, 1);
    await pressDown(stdin, CURRENT_ITEM_INDEX);
    await act(async () => { stdin.write('h'); });
    assert.ok(state.updatedCfg.lines[1].widgets.includes('bmad-currentitem'), 'shown on line 2');
    assert.deepStrictEqual(state.updatedCfg.lines[1].colorModes['bmad-currentitem'], {
      mode: 'fixed', fixedColor: 'magenta', documentColor: 'brightYellow',
    });
    unmount();
  });

  test('m on a Current Item without a saved colorMode creates one with both colors', async () => {
    const config = createDefaultConfig();
    delete config.lines[0].colorModes['bmad-currentitem'];
    const { state, stdin, unmount } = renderOnCurrentItem(config);
    await pressDown(stdin, CURRENT_ITEM_INDEX);
    await act(async () => { stdin.write('m'); });
    assert.deepStrictEqual(state.updatedCfg.lines[0].colorModes['bmad-currentitem'], {
      mode: 'fixed', fixedColor: 'magenta', documentColor: 'brightYellow', displayMode: 'compact',
    });
    unmount();
  });
});
