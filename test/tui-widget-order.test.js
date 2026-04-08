// tui-widget-order.test.js — Tests for ReorderList component
// (WidgetOrderScreen tests removed — deleted in story 6.1)

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { render } from 'ink-testing-library';
import { ReorderList } from '../src/tui/components/ReorderList.js';

const e = React.createElement;

const MOCK_ITEMS = [
  { id: 'bmad-project', label: 'project' },
  { id: 'bmad-workflow', label: 'workflow' },
  { id: 'bmad-progressstep', label: 'progressstep' },
  { id: 'bmad-story', label: 'story' },
  { id: 'bmad-timer', label: 'timer' },
];

describe('ReorderList', () => {
  test('(a) renders visible widgets in numbered list', () => {
    const { lastFrame, unmount } = render(e(ReorderList, {
      items: MOCK_ITEMS,
      isActive: true,
      onMove: () => {},
      onDrop: () => {},
      onCancel: () => {},
      onBack: () => {},
    }));
    const frame = lastFrame();
    assert.ok(frame.includes('1. project'), 'first widget numbered');
    assert.ok(frame.includes('2. workflow'), 'second widget numbered');
    assert.ok(frame.includes('3. progressstep'), 'third widget numbered');
    assert.ok(frame.includes('4. story'), 'fourth widget numbered');
    assert.ok(frame.includes('5. timer'), 'fifth widget numbered');
    // Cursor on first item
    assert.ok(frame.includes('> 1. project'), 'cursor on first item');
    unmount();
  });

  test('(b) Enter grabs widget and switches to moving state', async () => {
    let modeChanged = null;
    const { lastFrame, stdin, unmount } = render(e(ReorderList, {
      items: MOCK_ITEMS,
      isActive: true,
      onMove: () => {},
      onDrop: () => {},
      onCancel: () => {},
      onBack: () => {},
      onModeChange: (m) => { modeChanged = m; },
    }));
    await act(async () => { stdin.write('\r'); }); // Enter to grab
    const frame = lastFrame();
    assert.equal(modeChanged, 'moving', 'mode changed to moving');
    assert.ok(frame.includes('\u2190 moving'), 'moving marker visible');
    unmount();
  });

  test('(c) up/down moves widget and fires onMove', async () => {
    let movedOrder = null;
    const { lastFrame, stdin, unmount } = render(e(ReorderList, {
      items: MOCK_ITEMS,
      isActive: true,
      onMove: (order) => { movedOrder = order; },
      onDrop: () => {},
      onCancel: () => {},
      onBack: () => {},
    }));
    // Move cursor to second item
    await act(async () => { stdin.write('\x1B[B'); }); // down arrow
    // Grab it
    await act(async () => { stdin.write('\r'); });
    // Move it up (swap with first)
    await act(async () => { stdin.write('\x1B[A'); }); // up arrow
    assert.ok(movedOrder, 'onMove called');
    assert.equal(movedOrder[0], 'bmad-workflow', 'workflow moved to first position');
    assert.equal(movedOrder[1], 'bmad-project', 'project moved to second position');
    const frame = lastFrame();
    assert.ok(frame.includes('1. workflow'), 'workflow now at position 1');
    unmount();
  });

  test('(d) Enter drops and fires onDrop with final order', async () => {
    let droppedOrder = null;
    let modeAfterDrop = null;
    const { stdin, unmount } = render(e(ReorderList, {
      items: MOCK_ITEMS,
      isActive: true,
      onMove: () => {},
      onDrop: (order) => { droppedOrder = order; },
      onCancel: () => {},
      onBack: () => {},
      onModeChange: (m) => { modeAfterDrop = m; },
    }));
    // Move cursor to second item, grab, move up, drop
    await act(async () => { stdin.write('\x1B[B'); });
    await act(async () => { stdin.write('\r'); }); // grab
    await act(async () => { stdin.write('\x1B[A'); }); // move up
    await act(async () => { stdin.write('\r'); }); // drop
    assert.ok(droppedOrder, 'onDrop called');
    assert.equal(droppedOrder[0], 'bmad-workflow', 'workflow at first position after drop');
    assert.equal(modeAfterDrop, 'navigate', 'mode back to navigate after drop');
    unmount();
  });

  test('(e) Escape cancels and reverts position', async () => {
    let cancelCalled = false;
    const { lastFrame, stdin, unmount } = render(e(ReorderList, {
      items: MOCK_ITEMS,
      isActive: true,
      onMove: () => {},
      onDrop: () => {},
      onCancel: () => { cancelCalled = true; },
      onBack: () => {},
    }));
    // Move cursor to second item, grab, move up, cancel
    await act(async () => { stdin.write('\x1B[B'); });
    await act(async () => { stdin.write('\r'); }); // grab
    await act(async () => { stdin.write('\x1B[A'); }); // move up
    await act(async () => { stdin.write('\x1B'); }); // escape to cancel
    assert.ok(cancelCalled, 'onCancel called');
    const frame = lastFrame();
    // Items should be reverted to original order
    assert.ok(frame.includes('1. project'), 'project back at position 1');
    assert.ok(frame.includes('2. workflow'), 'workflow back at position 2');
    unmount();
  });

  test('Escape in navigate state calls onBack', async () => {
    let backCalled = false;
    const { stdin, unmount } = render(e(ReorderList, {
      items: MOCK_ITEMS,
      isActive: true,
      onMove: () => {},
      onDrop: () => {},
      onCancel: () => {},
      onBack: () => { backCalled = true; },
    }));
    await act(async () => { stdin.write('\x1B'); });
    assert.ok(backCalled, 'onBack called on Escape in navigate mode');
    unmount();
  });

  test('boundary: up at top does nothing', async () => {
    let moveCalled = false;
    const { stdin, unmount } = render(e(ReorderList, {
      items: MOCK_ITEMS,
      isActive: true,
      onMove: () => { moveCalled = true; },
      onDrop: () => {},
      onCancel: () => {},
      onBack: () => {},
    }));
    await act(async () => { stdin.write('\r'); }); // grab at position 0
    await act(async () => { stdin.write('\x1B[A'); }); // up at top
    assert.ok(!moveCalled, 'onMove not called at boundary');
    unmount();
  });

  test('boundary: down at bottom does nothing', async () => {
    let moveCalled = false;
    const { stdin, unmount } = render(e(ReorderList, {
      items: MOCK_ITEMS,
      isActive: true,
      onMove: () => { moveCalled = true; },
      onDrop: () => {},
      onCancel: () => {},
      onBack: () => {},
    }));
    // Navigate to last item
    for (let i = 0; i < 4; i++) {
      await act(async () => { stdin.write('\x1B[B'); });
    }
    await act(async () => { stdin.write('\r'); }); // grab at last position
    await act(async () => { stdin.write('\x1B[B'); }); // down at bottom
    assert.ok(!moveCalled, 'onMove not called at bottom boundary');
    unmount();
  });
});
