// tui-context-pct-config.test.js — Tests for ContextPctConfigScreen

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { render } from 'ink-testing-library';
import { ContextPctConfigScreen } from '../src/tui/screens/ContextPctConfigScreen.js';
import { createDefaultConfig } from '../src/tui/widget-registry.js';

const e = React.createElement;

function makeProps(overrides = {}) {
  const config = createDefaultConfig();
  return {
    config,
    updateConfig: () => {},
    previewOverride: null,
    goBack: () => {},
    editingLine: 2,
    isActive: true,
    ...overrides,
  };
}

describe('ContextPctConfigScreen', () => {
  test('renders threshold labels and preview bar', () => {
    const { lastFrame, unmount } = render(e(ContextPctConfigScreen, makeProps()));
    const frame = lastFrame();
    assert.ok(frame.includes('Seuil bas'), 'should show low threshold label');
    assert.ok(frame.includes('Seuil haut'), 'should show high threshold label');
    assert.ok(frame.includes('0%'), 'should show 0% label');
    assert.ok(frame.includes('100%'), 'should show 100% label');
    unmount();
  });

  test('shows default thresholds 0% and 100%', () => {
    const { lastFrame, unmount } = render(e(ContextPctConfigScreen, makeProps()));
    const frame = lastFrame();
    assert.ok(frame.includes('  0%'), 'low threshold should be 0');
    assert.ok(frame.includes('100%'), 'high threshold should be 100');
    unmount();
  });

  test('right arrow increases thresholdLow by 5', async () => {
    let updatedCfg = null;
    const config = createDefaultConfig();
    const props = makeProps({
      config,
      updateConfig: (mutator) => {
        const cfg = structuredClone(config);
        mutator(cfg);
        updatedCfg = cfg;
      },
    });
    const { stdin, unmount } = render(e(ContextPctConfigScreen, props));
    // Cursor starts on thresholdLow (index 0)
    await act(async () => { stdin.write('\x1B[C'); }); // right arrow
    assert.ok(updatedCfg, 'updateConfig was called');
    assert.equal(updatedCfg.lines[2].colorModes['bmad-contextpct'].thresholdLow, 5);
    unmount();
  });

  test('left arrow decreases thresholdLow (clamped to 0)', async () => {
    let updatedCfg = null;
    const config = createDefaultConfig();
    const props = makeProps({
      config,
      updateConfig: (mutator) => {
        const cfg = structuredClone(config);
        mutator(cfg);
        updatedCfg = cfg;
      },
    });
    const { stdin, unmount } = render(e(ContextPctConfigScreen, props));
    await act(async () => { stdin.write('\x1B[D'); }); // left arrow
    assert.ok(updatedCfg, 'updateConfig was called');
    assert.equal(updatedCfg.lines[2].colorModes['bmad-contextpct'].thresholdLow, 0, 'should clamp to 0');
    unmount();
  });

  test('thresholdHigh adjustment via down+right', async () => {
    let updatedCfg = null;
    const config = createDefaultConfig();
    const props = makeProps({
      config,
      updateConfig: (mutator) => {
        const cfg = structuredClone(config);
        mutator(cfg);
        updatedCfg = cfg;
      },
    });
    const { stdin, unmount } = render(e(ContextPctConfigScreen, props));
    // Move cursor to thresholdHigh
    await act(async () => { stdin.write('\x1B[B'); }); // down arrow
    await act(async () => { stdin.write('\x1B[D'); }); // left arrow — decrease high
    assert.ok(updatedCfg, 'updateConfig was called');
    assert.equal(updatedCfg.lines[2].colorModes['bmad-contextpct'].thresholdHigh, 95);
    unmount();
  });

  test('thresholdLow clamped to thresholdHigh - 5', async () => {
    let updatedCfg = null;
    const config = createDefaultConfig();
    // Set thresholdLow close to thresholdHigh
    config.lines[2].colorModes['bmad-contextpct'].thresholdLow = 90;
    config.lines[2].colorModes['bmad-contextpct'].thresholdHigh = 95;
    const props = makeProps({
      config,
      updateConfig: (mutator) => {
        const cfg = structuredClone(config);
        mutator(cfg);
        updatedCfg = cfg;
      },
    });
    const { stdin, unmount } = render(e(ContextPctConfigScreen, props));
    // Try to increase thresholdLow beyond max
    await act(async () => { stdin.write('\x1B[C'); }); // right arrow
    assert.ok(updatedCfg);
    assert.equal(updatedCfg.lines[2].colorModes['bmad-contextpct'].thresholdLow, 90, 'should stay clamped at thresholdHigh - 5');
    unmount();
  });

  test('thresholdHigh clamped to thresholdLow + 5', async () => {
    let updatedCfg = null;
    const config = createDefaultConfig();
    config.lines[2].colorModes['bmad-contextpct'].thresholdLow = 90;
    config.lines[2].colorModes['bmad-contextpct'].thresholdHigh = 95;
    const props = makeProps({
      config,
      updateConfig: (mutator) => {
        const cfg = structuredClone(config);
        mutator(cfg);
        updatedCfg = cfg;
      },
    });
    const { stdin, unmount } = render(e(ContextPctConfigScreen, props));
    await act(async () => { stdin.write('\x1B[B'); }); // down to thresholdHigh
    await act(async () => { stdin.write('\x1B[D'); }); // left to decrease
    assert.ok(updatedCfg);
    assert.equal(updatedCfg.lines[2].colorModes['bmad-contextpct'].thresholdHigh, 95, 'should stay clamped at thresholdLow + 5');
    unmount();
  });

  test('Escape calls goBack', async () => {
    let backCalled = false;
    const { stdin, unmount } = render(e(ContextPctConfigScreen, makeProps({
      goBack: () => { backCalled = true; },
    })));
    await act(async () => { stdin.write('\x1B'); });
    assert.ok(backCalled);
    unmount();
  });

  test('shows shortcuts bar', () => {
    const { lastFrame, unmount } = render(e(ContextPctConfigScreen, makeProps()));
    const frame = lastFrame();
    assert.ok(frame.includes('Select'), 'should show Select shortcut');
    assert.ok(frame.includes('Back'), 'should show Back shortcut');
    unmount();
  });
});
