// tui-separator.test.js — Tests for SeparatorStyleScreen (v2 props)

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { render } from 'ink-testing-library';
import { SeparatorStyleScreen } from '../src/tui/screens/SeparatorStyleScreen.js';
import { createDefaultConfig } from '../src/tui/widget-registry.js';

const e = React.createElement;

function makeSepProps(overrides = {}) {
  const config = createDefaultConfig();
  // Apply only serializable config overrides (not functions)
  if (overrides.separator) config.separator = overrides.separator;
  if (overrides.customSeparator) config.customSeparator = overrides.customSeparator;
  return {
    config,
    updateConfig: overrides.updateConfig || (() => {}),
    previewOverride: null,
    setPreviewOverride: overrides.setPreviewOverride || (() => {}),
    goBack: overrides.goBack || (() => {}),
    isActive: true,
  };
}

describe('SeparatorStyleScreen', () => {
  test('renders 4 separator options', () => {
    const { lastFrame, unmount } = render(e(SeparatorStyleScreen, makeSepProps()));
    const frame = lastFrame();
    assert.ok(frame.includes('tight'));
    assert.ok(frame.includes('moderate'));
    assert.ok(frame.includes('wide'));
    assert.ok(frame.includes('custom'));
    unmount();
  });

  test('shows screen name label Separator Style', () => {
    const { lastFrame, unmount } = render(e(SeparatorStyleScreen, makeSepProps()));
    const frame = lastFrame();
    assert.ok(frame.includes('Separator Style'), 'screen name label');
    unmount();
  });

  test('Escape calls goBack in select mode', async () => {
    let backed = false;
    const { stdin, unmount } = render(e(SeparatorStyleScreen, makeSepProps({
      goBack: () => { backed = true; },
    })));
    await act(async () => { stdin.write('\x1B'); });
    assert.ok(backed);
    unmount();
  });

  test('Enter on tight calls updateConfig with serre', async () => {
    let mutatorCalled = false;
    const { stdin, unmount } = render(e(SeparatorStyleScreen, makeSepProps({
      updateConfig: (mutator) => {
        const cfg = createDefaultConfig();
        mutator(cfg);
        assert.equal(cfg.separator, 'serre');
        assert.equal(cfg.customSeparator, null);
        mutatorCalled = true;
      },
    })));
    // Default highlight is now 'modere' (2nd option), move up to tight
    await act(async () => { stdin.write('\x1B[A'); });
    await act(async () => { stdin.write('\r'); });
    assert.ok(mutatorCalled);
    unmount();
  });

  test('default highlight matches current separator', () => {
    const { lastFrame, unmount } = render(e(SeparatorStyleScreen, makeSepProps({ separator: 'modere' })));
    assert.ok(lastFrame().includes('> moderate'));
    unmount();
  });

  test('try-before-you-buy: arrow key calls setPreviewOverride', async () => {
    let previewSet = false;
    const { stdin, unmount } = render(e(SeparatorStyleScreen, makeSepProps({
      setPreviewOverride: (preview) => { previewSet = true; },
    })));
    await act(async () => { stdin.write('\x1B[B'); });
    assert.ok(previewSet);
    unmount();
  });

  test('Escape in TextInput mode returns to select mode (not Home)', async () => {
    let backed = false;
    const { lastFrame, stdin, unmount } = render(e(SeparatorStyleScreen, makeSepProps({
      goBack: () => { backed = true; },
    })));
    // Navigate to custom and enter TextInput mode
    await act(async () => { stdin.write('\x1B[B'); });
    await act(async () => { stdin.write('\x1B[B'); });
    await act(async () => { stdin.write('\x1B[B'); });
    await act(async () => { stdin.write('\r'); });
    assert.ok(lastFrame().includes('Enter custom separator'));
    // Press Escape — should return to select mode, NOT call goBack
    await act(async () => { stdin.write('\x1B'); });
    assert.ok(!backed, 'goBack should not be called from TextInput Escape');
    assert.ok(lastFrame().includes('tight'), 'should be back in select mode showing options');
    unmount();
  });

  test('Enter on custom switches to TextInput mode', async () => {
    const { lastFrame, stdin, unmount } = render(e(SeparatorStyleScreen, makeSepProps()));
    await act(async () => { stdin.write('\x1B[B'); });
    await act(async () => { stdin.write('\x1B[B'); });
    await act(async () => { stdin.write('\x1B[B'); });
    await act(async () => { stdin.write('\r'); });
    const frame = lastFrame();
    assert.ok(frame.includes('Enter custom separator'));
    unmount();
  });
});
