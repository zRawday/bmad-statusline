// tui-monitor-components.test.js — Tests for Monitor TUI components (ScrollableViewport, LlmBadge, FileTreeSection, BashSection)

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import ScrollableViewport from '../src/tui/monitor/components/ScrollableViewport.js';
import LlmBadge from '../src/tui/monitor/components/LlmBadge.js';
import SessionTabs from '../src/tui/monitor/components/SessionTabs.js';
import { renderFileSection } from '../src/tui/monitor/components/FileTreeSection.js';
import { renderBashSection } from '../src/tui/monitor/components/BashSection.js';
import { ShortcutBar } from '../src/tui/components/ShortcutBar.js';

const e = React.createElement;

describe('ScrollableViewport', () => {
  test('items fit in viewport — no scroll indicators shown', () => {
    const items = [
      e(Text, { key: '0' }, 'Line A'),
      e(Text, { key: '1' }, 'Line B'),
      e(Text, { key: '2' }, 'Line C'),
    ];
    const { lastFrame, unmount } = render(e(ScrollableViewport, { items, height: 5, scrollOffset: 0 }));
    const frame = lastFrame();
    assert.ok(frame.includes('Line A'));
    assert.ok(frame.includes('Line B'));
    assert.ok(frame.includes('Line C'));
    assert.ok(!frame.includes('▲'));
    assert.ok(!frame.includes('▼'));
    unmount();
  });

  test('scrollOffset > 0 — shows ▲ indicator with correct count', () => {
    const items = [
      e(Text, { key: '0' }, 'Line A'),
      e(Text, { key: '1' }, 'Line B'),
      e(Text, { key: '2' }, 'Line C'),
      e(Text, { key: '3' }, 'Line D'),
      e(Text, { key: '4' }, 'Line E'),
    ];
    const { lastFrame, unmount } = render(e(ScrollableViewport, { items, height: 5, scrollOffset: 2 }));
    const frame = lastFrame();
    assert.ok(frame.includes('▲ 2 more'));
    assert.ok(!frame.includes('▼'));
    assert.ok(frame.includes('Line C'));
    assert.ok(frame.includes('Line D'));
    assert.ok(frame.includes('Line E'));
    unmount();
  });

  test('items extend below viewport — shows ▼ indicator with correct count', () => {
    const items = [
      e(Text, { key: '0' }, 'Line A'),
      e(Text, { key: '1' }, 'Line B'),
      e(Text, { key: '2' }, 'Line C'),
      e(Text, { key: '3' }, 'Line D'),
      e(Text, { key: '4' }, 'Line E'),
    ];
    const { lastFrame, unmount } = render(e(ScrollableViewport, { items, height: 3, scrollOffset: 0 }));
    const frame = lastFrame();
    assert.ok(frame.includes('Line A'));
    assert.ok(frame.includes('Line B'));
    assert.ok(frame.includes('Line C'));
    assert.ok(!frame.includes('▲'));
    assert.ok(frame.includes('▼ 2 more'));
    unmount();
  });

  test('scrollOffset > 0 AND items below — both indicators shown', () => {
    const items = [
      e(Text, { key: '0' }, 'Line A'),
      e(Text, { key: '1' }, 'Line B'),
      e(Text, { key: '2' }, 'Line C'),
      e(Text, { key: '3' }, 'Line D'),
      e(Text, { key: '4' }, 'Line E'),
    ];
    const { lastFrame, unmount } = render(e(ScrollableViewport, { items, height: 2, scrollOffset: 1 }));
    const frame = lastFrame();
    assert.ok(frame.includes('▲ 1 more'));
    assert.ok(frame.includes('▼ 2 more'));
    assert.ok(frame.includes('Line B'));
    assert.ok(frame.includes('Line C'));
    unmount();
  });

  test('empty items array — renders without crash, no indicators', () => {
    const { lastFrame, unmount } = render(e(ScrollableViewport, { items: [], height: 5, scrollOffset: 0 }));
    const frame = lastFrame();
    assert.ok(!frame.includes('▲'));
    assert.ok(!frame.includes('▼'));
    unmount();
  });

  test('height = 0 — all items hidden, ▼ indicator shows total count', () => {
    const items = [
      e(Text, { key: '0' }, 'Line A'),
      e(Text, { key: '1' }, 'Line B'),
      e(Text, { key: '2' }, 'Line C'),
    ];
    const { lastFrame, unmount } = render(e(ScrollableViewport, { items, height: 0, scrollOffset: 0 }));
    const frame = lastFrame();
    assert.ok(!frame.includes('▲'));
    assert.ok(frame.includes('▼ 3 more'));
    assert.ok(!frame.includes('Line A'));
    assert.ok(!frame.includes('Line B'));
    assert.ok(!frame.includes('Line C'));
    unmount();
  });
});

// --- LlmBadge tests ---

describe('LlmBadge', () => {
  test('ACTIVE state renders ⬤ and ACTIVE with green color', () => {
    const { lastFrame, unmount } = render(e(LlmBadge, { state: 'active', workflow: 'dev-story', startedAt: new Date().toISOString() }));
    const frame = lastFrame();
    assert.ok(frame.includes('\u2B24'));
    assert.ok(frame.includes('ACTIVE'));
    unmount();
  });

  test('PERMISSION state renders ⬤ and PERMISSION with yellow color', () => {
    const { lastFrame, unmount } = render(e(LlmBadge, { state: 'permission', workflow: 'dev-story', startedAt: new Date().toISOString() }));
    const frame = lastFrame();
    assert.ok(frame.includes('\u2B24'));
    assert.ok(frame.includes('PERMISSION'));
    unmount();
  });

  test('WAITING state renders ⬤ and WAITING', () => {
    const { lastFrame, unmount } = render(e(LlmBadge, { state: 'waiting', workflow: 'dev-story', startedAt: new Date().toISOString() }));
    const frame = lastFrame();
    assert.ok(frame.includes('\u2B24'));
    assert.ok(frame.includes('WAITING'));
    unmount();
  });

  test('INACTIVE state renders ⬤ and INACTIVE with dim styling', () => {
    const { lastFrame, unmount } = render(e(LlmBadge, { state: 'inactive', workflow: 'dev-story', startedAt: new Date().toISOString() }));
    const frame = lastFrame();
    assert.ok(frame.includes('\u2B24'));
    assert.ok(frame.includes('INACTIVE'));
    unmount();
  });

  test('workflow name and elapsed timer displayed', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { lastFrame, unmount } = render(e(LlmBadge, { state: 'active', workflow: 'code-review', startedAt: fiveMinAgo }));
    const frame = lastFrame();
    assert.ok(frame.includes('code-review'));
    assert.ok(frame.includes('5m'));
    unmount();
  });

  test('badge handles missing startedAt gracefully (no timer, no crash)', () => {
    const { lastFrame, unmount } = render(e(LlmBadge, { state: 'active', workflow: 'dev-story', startedAt: null }));
    const frame = lastFrame();
    assert.ok(frame.includes('ACTIVE'));
    assert.ok(frame.includes('dev-story'));
    unmount();
  });

  test('ERROR state renders ⬤ and ERROR with red background', () => {
    const { lastFrame, unmount } = render(e(LlmBadge, { state: 'error', workflow: 'dev-story', startedAt: new Date().toISOString() }));
    const frame = lastFrame();
    assert.ok(frame.includes('\u2B24'));
    assert.ok(frame.includes('ERROR'));
    unmount();
  });

  test('SUBAGENT state renders ⬤ and SUBAGENT in cyan', () => {
    const { lastFrame, unmount } = render(e(LlmBadge, { state: 'active:subagent', workflow: 'dev-story', startedAt: new Date().toISOString() }));
    const frame = lastFrame();
    assert.ok(frame.includes('\u2B24'));
    assert.ok(frame.includes('SUBAGENT'));
    unmount();
  });

  test('INTERRUPTED state renders ⬤ and INTERRUPTED with yellow background', () => {
    const { lastFrame, unmount } = render(e(LlmBadge, { state: 'interrupted', workflow: 'dev-story', startedAt: new Date().toISOString() }));
    const frame = lastFrame();
    assert.ok(frame.includes('\u2B24'));
    assert.ok(frame.includes('INTERRUPTED'));
    unmount();
  });
});

// --- SessionTabs state icon tests ---

describe('SessionTabs state icons', () => {
  function makeSession(llmState) {
    return {
      sessionId: `sess-${llmState}`,
      workflow: 'dev-story',
      llm_state: llmState,
      updated_at: new Date().toISOString(),
    };
  }

  test('error session shows red ⬤ icon in tabs', () => {
    const groups = new Map([['proj', [makeSession('error')]]]);
    const { lastFrame, unmount } = render(e(SessionTabs, {
      groups, activeProject: 'proj', activeSessionIndex: 0,
      config: {}, mode: 'single-project',
    }));
    const frame = lastFrame();
    assert.ok(frame.includes('\u2B24'));
    assert.ok(frame.includes('dev-story'));
    unmount();
  });

  test('active:subagent session shows cyan ⬤ icon in tabs', () => {
    const groups = new Map([['proj', [makeSession('active:subagent')]]]);
    const { lastFrame, unmount } = render(e(SessionTabs, {
      groups, activeProject: 'proj', activeSessionIndex: 0,
      config: {}, mode: 'single-project',
    }));
    const frame = lastFrame();
    assert.ok(frame.includes('\u2B24'));
    assert.ok(frame.includes('dev-story'));
    unmount();
  });

  test('interrupted session shows yellow ⬤ icon in tabs', () => {
    const groups = new Map([['proj', [makeSession('interrupted')]]]);
    const { lastFrame, unmount } = render(e(SessionTabs, {
      groups, activeProject: 'proj', activeSessionIndex: 0,
      config: {}, mode: 'single-project',
    }));
    const frame = lastFrame();
    assert.ok(frame.includes('\u2B24'));
    assert.ok(frame.includes('dev-story'));
    unmount();
  });
});

// --- FileTreeSection tests ---

describe('renderFileSection', () => {
  test('renders section header with count and tree structure', () => {
    const entries = [
      { path: 'src/a.js', in_project: true, is_new: false, agent_id: null },
      { path: 'src/b.js', in_project: true, is_new: false, agent_id: null },
    ];
    const { elements, items } = renderFileSection('EDITED FILES', entries);
    const { lastFrame, unmount } = render(e(ScrollableViewport, { items: elements, height: 20, scrollOffset: 0 }));
    const frame = lastFrame();
    assert.ok(frame.includes('EDITED FILES (2)'));
    assert.ok(frame.includes('a.js'));
    assert.ok(frame.includes('b.js'));
    assert.ok(items.length > 0);
    unmount();
  });

  test('* indicator for new files visible', () => {
    const entries = [
      { path: 'new-file.js', in_project: true, is_new: true, agent_id: null },
    ];
    const { elements } = renderFileSection('EDITED FILES', entries);
    const { lastFrame, unmount } = render(e(ScrollableViewport, { items: elements, height: 20, scrollOffset: 0 }));
    const frame = lastFrame();
    assert.ok(frame.includes('*'));
    unmount();
  });

  test('🔀 indicator for sub-agent visible', () => {
    const entries = [
      { path: 'agent.js', in_project: true, is_new: false, agent_id: 'sub-1' },
    ];
    const { elements } = renderFileSection('EDITED FILES', entries);
    const { lastFrame, unmount } = render(e(ScrollableViewport, { items: elements, height: 20, scrollOffset: 0 }));
    const frame = lastFrame();
    assert.ok(frame.includes('🔀'));
    unmount();
  });

  test('empty entries returns empty array (no header rendered)', () => {
    const { elements, items } = renderFileSection('EDITED FILES', []);
    assert.deepEqual(elements, []);
    assert.deepEqual(items, []);
  });
});

// --- BashSection tests ---

describe('renderBashSection', () => {
  test('deduplicated display with (xN) count', () => {
    const commands = [
      { cmd: 'npm test', at: '2026-01-01T00:00:00Z', agent_id: null },
      { cmd: 'npm test', at: '2026-01-01T00:01:00Z', agent_id: null },
      { cmd: 'npm test', at: '2026-01-01T00:02:00Z', agent_id: null },
    ];
    const { elements } = renderBashSection(commands);
    const { lastFrame, unmount } = render(e(ScrollableViewport, { items: elements, height: 20, scrollOffset: 0 }));
    const frame = lastFrame();
    assert.ok(frame.includes('COMMANDS (1)'));
    assert.ok(frame.includes('npm test (x3)'));
    unmount();
  });

  test('empty commands returns empty array', () => {
    const { elements, items } = renderBashSection([]);
    assert.deepEqual(elements, []);
    assert.deepEqual(items, []);
  });

  test('sub-agent 🔀 indicator', () => {
    const commands = [
      { cmd: 'git push', at: '2026-01-01T00:00:00Z', agent_id: 'sub-1' },
    ];
    const { elements } = renderBashSection(commands);
    const { lastFrame, unmount } = render(e(ScrollableViewport, { items: elements, height: 20, scrollOffset: 0 }));
    const frame = lastFrame();
    assert.ok(frame.includes('🔀'));
    unmount();
  });
});

// --- ShortcutBar tests ---

describe('ShortcutBar', () => {
  test('renders key and label for each action', () => {
    const actions = [
      { key: 'a', label: 'auto' },
      { key: 'Esc', label: 'home' },
    ];
    const { lastFrame, unmount } = render(e(ShortcutBar, { actions }));
    const frame = lastFrame();
    assert.ok(frame.includes('a'));
    assert.ok(frame.includes('auto'));
    assert.ok(frame.includes('Esc'));
    assert.ok(frame.includes('home'));
    unmount();
  });

  test('actions without color render with dim label (backward compat)', () => {
    const actions = [{ key: 'Esc', label: 'retour' }];
    const { lastFrame, unmount } = render(e(ShortcutBar, { actions }));
    const frame = lastFrame();
    assert.ok(frame.includes('Esc'));
    assert.ok(frame.includes('retour'));
    unmount();
  });

  test('actions with color prop render key and label in that color', () => {
    const actions = [
      { key: 's', label: 'tri', color: 'magenta' },
      { key: 'Esc', label: 'retour' },
    ];
    const { lastFrame, unmount } = render(e(ShortcutBar, { actions }));
    const frame = lastFrame();
    assert.ok(frame.includes('s'));
    assert.ok(frame.includes('tri'));
    assert.ok(frame.includes('Esc'));
    assert.ok(frame.includes('retour'));
    unmount();
  });

  test('mixed colored and uncolored actions render correctly', () => {
    const actions = [
      { key: '↑↓', label: 'scroll', color: 'cyan' },
      { key: 'd', label: 'détail', color: 'yellow' },
      { key: 'e', label: 'export', color: 'green' },
      { key: 'a', label: 'auto', color: 'magenta' },
      { key: 'Esc', label: 'home' },
    ];
    const { lastFrame, unmount } = render(e(ShortcutBar, { actions }));
    const frame = lastFrame();
    assert.ok(frame.includes('scroll'));
    assert.ok(frame.includes('détail'));
    assert.ok(frame.includes('export'));
    assert.ok(frame.includes('auto'));
    assert.ok(frame.includes('home'));
    unmount();
  });
});
