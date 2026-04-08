// tui-components.test.js — Tests for shared TUI components (v2: ThreeLinePreview, ScreenLayout)

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { ShortcutBar } from '../src/tui/components/ShortcutBar.js';
import { ScreenLayout } from '../src/tui/components/ScreenLayout.js';
import { ConfirmDialog } from '../src/tui/components/ConfirmDialog.js';
import { ThreeLinePreview } from '../src/tui/components/ThreeLinePreview.js';
import { createDefaultConfig } from '../src/tui/widget-registry.js';

const e = React.createElement;

describe('ConfirmDialog', () => {
  test('renders message when isActive is true', () => {
    const { lastFrame, unmount } = render(e(ConfirmDialog, {
      message: 'Overwrite Custom 1 (dev-focus)?',
      onConfirm: () => {},
      onCancel: () => {},
      isActive: true,
    }));
    assert.ok(lastFrame().includes('Overwrite Custom 1 (dev-focus)?'));
    assert.ok(lastFrame().includes('Enter'));
    assert.ok(lastFrame().includes('Esc'));
    unmount();
  });

  test('Enter calls onConfirm', async () => {
    let confirmed = false;
    const { stdin, unmount } = render(e(ConfirmDialog, {
      message: 'Confirm?',
      onConfirm: () => { confirmed = true; },
      onCancel: () => {},
      isActive: true,
    }));
    await act(async () => { stdin.write('\r'); });
    assert.ok(confirmed);
    unmount();
  });

  test('Escape calls onCancel', async () => {
    let cancelled = false;
    const { stdin, unmount } = render(e(ConfirmDialog, {
      message: 'Confirm?',
      onConfirm: () => {},
      onCancel: () => { cancelled = true; },
      isActive: true,
    }));
    await act(async () => { stdin.write('\x1B'); });
    assert.ok(cancelled);
    unmount();
  });

  test('does not respond to keys when isActive is false', async () => {
    let confirmed = false;
    let cancelled = false;
    const { stdin, unmount } = render(e(ConfirmDialog, {
      message: 'Confirm?',
      onConfirm: () => { confirmed = true; },
      onCancel: () => { cancelled = true; },
      isActive: false,
    }));
    await act(async () => { stdin.write('\r'); });
    await act(async () => { stdin.write('\x1B'); });
    assert.ok(!confirmed);
    assert.ok(!cancelled);
    unmount();
  });
});

describe('ShortcutBar', () => {
  test('renders all action keys and labels', () => {
    const actions = [
      { key: '\u2191\u2193', label: 'Navigate' },
      { key: 'Enter', label: 'Select' },
      { key: 'q', label: 'Quit' },
    ];
    const { lastFrame, unmount } = render(e(ShortcutBar, { actions }));
    const frame = lastFrame();
    assert.ok(frame.includes('Navigate'));
    assert.ok(frame.includes('Enter'));
    assert.ok(frame.includes('Select'));
    assert.ok(frame.includes('q'));
    assert.ok(frame.includes('Quit'));
    unmount();
  });

  test('renders single action', () => {
    const actions = [{ key: 'Esc', label: 'Back' }];
    const { lastFrame, unmount } = render(e(ShortcutBar, { actions }));
    assert.ok(lastFrame().includes('Esc'));
    assert.ok(lastFrame().includes('Back'));
    unmount();
  });
});

describe('ThreeLinePreview', () => {
  test('renders 3 lines with correct sample values', () => {
    const config = createDefaultConfig();
    const { lastFrame, unmount } = render(e(ThreeLinePreview, { config }));
    const frame = lastFrame();
    assert.ok(frame.includes('Preview'), 'Preview label');
    assert.ok(frame.includes('myproject'), 'project sample');
    assert.ok(frame.includes('dev-story'), 'workflow sample');
    assert.ok(frame.includes('Step 2/7 Discover'), 'progressstep sample');
    unmount();
  });

  test('renders empty line as blank', () => {
    const config = createDefaultConfig();
    // Lines 1 and 2 are empty by default
    const { lastFrame, unmount } = render(e(ThreeLinePreview, { config }));
    // Should render without error — empty lines produce blank space inside frame
    assert.ok(lastFrame().includes('Preview'));
    unmount();
  });

  test('renders separator between widgets', () => {
    const config = createDefaultConfig();
    config.separator = 'modere';
    const { lastFrame, unmount } = render(e(ThreeLinePreview, { config }));
    const frame = lastFrame();
    // modere separator is ' ┃ '
    assert.ok(frame.includes('\u2503'), 'separator rendered');
    unmount();
  });

  test('renders custom separator', () => {
    const config = createDefaultConfig();
    config.separator = 'custom';
    config.customSeparator = ' | ';
    const { lastFrame, unmount } = render(e(ThreeLinePreview, { config }));
    assert.ok(lastFrame().includes('|'), 'custom separator rendered');
    unmount();
  });

  test('handles config with widgets on multiple lines', () => {
    const config = createDefaultConfig();
    // Move a widget to line 2
    config.lines[1].widgets = ['bmad-timer'];
    config.lines[1].colorModes = { 'bmad-timer': { mode: 'fixed', fixedColor: 'brightBlack' } };
    const { lastFrame, unmount } = render(e(ThreeLinePreview, { config }));
    const frame = lastFrame();
    assert.ok(frame.includes('12m34s'), 'timer on line 2');
    unmount();
  });
});

describe('ScreenLayout v2', () => {
  test('renders header, screen name, ThreeLinePreview, children, and ShortcutBar', () => {
    const config = createDefaultConfig();
    const { lastFrame, unmount } = render(e(ScreenLayout, {
      screenName: 'Edit Line 1',
      screenColor: 'green',
      config,
      previewOverride: null,
      shortcuts: [{ key: 'q', label: 'Quit' }],
    }, e(Text, null, 'Content area')));

    const frame = lastFrame();
    assert.ok(frame.includes('BMAD-STATUSLINE'), 'header');
    assert.ok(frame.includes('Edit Line 1'), 'screen name');
    assert.ok(frame.includes('Preview'), 'ThreeLinePreview');
    assert.ok(frame.includes('myproject'), 'preview sample');
    assert.ok(frame.includes('Content area'), 'children');
    assert.ok(frame.includes('q'), 'ShortcutBar key');
    assert.ok(frame.includes('Quit'), 'ShortcutBar label');
    unmount();
  });

  test('uses previewOverride when provided', () => {
    const config = createDefaultConfig();
    const override = structuredClone(config);
    override.separator = 'large';
    const { lastFrame, unmount } = render(e(ScreenLayout, {
      screenName: 'Home',
      screenColor: 'cyan',
      config,
      previewOverride: override,
      shortcuts: [{ key: 'q', label: 'Quit' }],
    }, e(Text, null, 'Content')));

    assert.ok(lastFrame().includes('Preview'));
    unmount();
  });
});
