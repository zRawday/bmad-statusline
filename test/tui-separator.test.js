// tui-separator.test.js — Tests for SeparatorStyleScreen (v2 props)

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import { SeparatorStyleScreen } from '../src/tui/screens/SeparatorStyleScreen.js';
import { createDefaultConfig } from '../src/tui/widget-registry.js';

const e = React.createElement;

const delay = (ms) => new Promise(r => setTimeout(r, ms));

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
    const { lastFrame } = render(e(SeparatorStyleScreen, makeSepProps()));
    const frame = lastFrame();
    assert.ok(frame.includes('tight'));
    assert.ok(frame.includes('moderate'));
    assert.ok(frame.includes('wide'));
    assert.ok(frame.includes('custom'));
  });

  test('shows screen name label Separator Style', () => {
    const { lastFrame } = render(e(SeparatorStyleScreen, makeSepProps()));
    const frame = lastFrame();
    assert.ok(frame.includes('Separator Style'), 'screen name label');
  });

  test('Escape calls goBack in select mode', async () => {
    let backed = false;
    const { stdin } = render(e(SeparatorStyleScreen, makeSepProps({
      goBack: () => { backed = true; },
    })));
    await delay(50);
    stdin.write('\x1B');
    await delay(50);
    assert.ok(backed);
  });

  test('Enter on tight calls updateConfig with serre', async () => {
    let mutatorCalled = false;
    const { stdin } = render(e(SeparatorStyleScreen, makeSepProps({
      updateConfig: (mutator) => {
        const cfg = createDefaultConfig();
        mutator(cfg);
        assert.equal(cfg.separator, 'serre');
        assert.equal(cfg.customSeparator, null);
        mutatorCalled = true;
      },
    })));
    await delay(50);
    // Default highlight is now 'modere' (2nd option), move up to tight
    stdin.write('\x1B[A');
    await delay(20);
    stdin.write('\r');
    await delay(50);
    assert.ok(mutatorCalled);
  });

  test('default highlight matches current separator', () => {
    const { lastFrame } = render(e(SeparatorStyleScreen, makeSepProps({ separator: 'modere' })));
    assert.ok(lastFrame().includes('> moderate'));
  });

  test('try-before-you-buy: arrow key calls setPreviewOverride', async () => {
    let previewSet = false;
    const { stdin } = render(e(SeparatorStyleScreen, makeSepProps({
      setPreviewOverride: (preview) => { previewSet = true; },
    })));
    await delay(50);
    stdin.write('\x1B[B');
    await delay(50);
    assert.ok(previewSet);
  });

  test('Escape in TextInput mode returns to select mode (not Home)', async () => {
    let backed = false;
    const { lastFrame, stdin } = render(e(SeparatorStyleScreen, makeSepProps({
      goBack: () => { backed = true; },
    })));
    await delay(50);
    // Navigate to custom and enter TextInput mode
    stdin.write('\x1B[B');
    await delay(50);
    stdin.write('\x1B[B');
    await delay(50);
    stdin.write('\x1B[B');
    await delay(50);
    stdin.write('\r');
    await delay(50);
    assert.ok(lastFrame().includes('Enter custom separator'));
    // Press Escape — should return to select mode, NOT call goBack
    stdin.write('\x1B');
    await delay(50);
    assert.ok(!backed, 'goBack should not be called from TextInput Escape');
    assert.ok(lastFrame().includes('tight'), 'should be back in select mode showing options');
  });

  test('Enter on custom switches to TextInput mode', async () => {
    const { lastFrame, stdin } = render(e(SeparatorStyleScreen, makeSepProps()));
    await delay(50);
    stdin.write('\x1B[B');
    await delay(50);
    stdin.write('\x1B[B');
    await delay(50);
    stdin.write('\x1B[B');
    await delay(50);
    stdin.write('\r');
    await delay(50);
    const frame = lastFrame();
    assert.ok(frame.includes('Enter custom separator'));
  });
});
