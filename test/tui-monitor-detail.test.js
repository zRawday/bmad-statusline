// tui-monitor-detail.test.js — Tests for detail mode + MonitorDetailScreen

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import React, { act } from 'react';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { render } from 'ink-testing-library';
import {
  findFirstSelectable, findNextSelectable, formatTime,
  mergeChronology, formatRelativeTime, generateCsv, writeCsvExport,
} from '../src/tui/monitor/monitor-utils.js';
import { MonitorDetailScreen } from '../src/tui/monitor/MonitorDetailScreen.js';
import { MonitorScreen } from '../src/tui/monitor/MonitorScreen.js';

const e = React.createElement;

// --- findFirstSelectable tests ---

describe('findFirstSelectable', () => {
  test('returns index of first selectable item', () => {
    const items = [
      { selectable: false, type: 'header' },
      { selectable: false, type: 'spacer' },
      { selectable: true, type: 'file' },
      { selectable: true, type: 'file' },
    ];
    assert.equal(findFirstSelectable(items), 2);
  });

  test('returns -1 for no selectables', () => {
    const items = [
      { selectable: false, type: 'header' },
      { selectable: false, type: 'spacer' },
    ];
    assert.equal(findFirstSelectable(items), -1);
  });

  test('returns 0 when first item is selectable', () => {
    const items = [
      { selectable: true, type: 'file' },
      { selectable: false, type: 'spacer' },
    ];
    assert.equal(findFirstSelectable(items), 0);
  });

  test('returns -1 for empty array', () => {
    assert.equal(findFirstSelectable([]), -1);
  });
});

// --- findNextSelectable tests ---

describe('findNextSelectable', () => {
  const items = [
    { selectable: false, type: 'header' },
    { selectable: true, type: 'file' },
    { selectable: false, type: 'dir' },
    { selectable: false, type: 'spacer' },
    { selectable: true, type: 'file' },
    { selectable: false, type: 'header' },
    { selectable: true, type: 'command' },
  ];

  test('moves forward to next selectable', () => {
    assert.equal(findNextSelectable(items, 1, 1), 4);
  });

  test('skips non-selectable items forward', () => {
    assert.equal(findNextSelectable(items, 0, 1), 1);
  });

  test('stays at current if none found forward', () => {
    assert.equal(findNextSelectable(items, 6, 1), 6);
  });

  test('moves backward to previous selectable', () => {
    assert.equal(findNextSelectable(items, 4, -1), 1);
  });

  test('skips non-selectable items backward', () => {
    assert.equal(findNextSelectable(items, 6, -1), 4);
  });

  test('stays at current if none found backward', () => {
    assert.equal(findNextSelectable(items, 1, -1), 1);
  });
});

// --- formatTime tests ---

describe('formatTime', () => {
  test('extracts HH:MM:SS from ISO string', () => {
    const result = formatTime('2026-04-04T14:23:07.000Z');
    // Time depends on timezone, just check HH:MM:SS format
    assert.match(result, /^\d{2}:\d{2}:\d{2}$/);
  });

  test('returns empty string for null', () => {
    assert.equal(formatTime(null), '');
  });

  test('returns empty string for undefined', () => {
    assert.equal(formatTime(undefined), '');
  });

  test('returns empty string for invalid date', () => {
    assert.equal(formatTime('not-a-date'), '');
  });

  test('returns empty string for empty string', () => {
    assert.equal(formatTime(''), '');
  });
});

// --- MonitorDetailScreen tests ---

describe('MonitorDetailScreen — edit detail', () => {
  test('renders title FILE DETAIL — EDITED and file path', async () => {
    const item = { text: 'a.js', selectable: true, type: 'file', data: { path: 'src/a.js', op: 'edit' } };
    const entries = [
      { path: 'src/a.js', op: 'edit', at: '2026-04-04T14:23:07.000Z', agent_id: null, old_string: 'old line', new_string: 'new line' },
    ];
    const { lastFrame, unmount } = render(e(MonitorDetailScreen, {
      item, entries, onBack: () => {}, isActive: true,
    }));
    await act(async () => {});
    const frame = lastFrame();
    assert.ok(frame.includes('FILE DETAIL — EDITED'));
    assert.ok(frame.includes('src/a.js'));
    unmount();
  });

  test('renders - old lines in red and + new lines in green', async () => {
    const item = { text: 'a.js', selectable: true, type: 'file', data: { path: 'src/a.js', op: 'edit' } };
    const entries = [
      { path: 'src/a.js', op: 'edit', at: '2026-04-04T14:23:07.000Z', agent_id: null, old_string: 'old value', new_string: 'new value' },
    ];
    const { lastFrame, unmount } = render(e(MonitorDetailScreen, {
      item, entries, onBack: () => {}, isActive: true,
    }));
    await act(async () => {});
    const frame = lastFrame();
    assert.ok(frame.includes('- old value'));
    assert.ok(frame.includes('+ new value'));
    unmount();
  });

  test('write op renders (file created) instead of diff', async () => {
    const item = { text: 'b.js', selectable: true, type: 'file', data: { path: 'src/b.js', op: 'write' } };
    const entries = [
      { path: 'src/b.js', op: 'write', at: '2026-04-04T14:25:33.000Z', agent_id: null },
    ];
    const { lastFrame, unmount } = render(e(MonitorDetailScreen, {
      item, entries, onBack: () => {}, isActive: true,
    }));
    await act(async () => {});
    const frame = lastFrame();
    assert.ok(frame.includes('(file created)'));
    unmount();
  });
});

describe('MonitorDetailScreen — read detail', () => {
  test('renders title FILE DETAIL — READ and timestamps', async () => {
    const item = { text: 'c.js', selectable: true, type: 'file', data: { path: 'src/c.js' } };
    const entries = [
      { path: 'src/c.js', at: '2026-04-04T14:23:07.000Z', agent_id: null },
      { path: 'src/c.js', at: '2026-04-04T14:25:33.000Z', agent_id: null },
    ];
    const { lastFrame, unmount } = render(e(MonitorDetailScreen, {
      item, entries, onBack: () => {}, isActive: true,
    }));
    await act(async () => {});
    const frame = lastFrame();
    assert.ok(frame.includes('FILE DETAIL — READ'));
    assert.ok(frame.includes('src/c.js'));
    unmount();
  });
});

describe('MonitorDetailScreen — bash detail', () => {
  test('renders title COMMAND DETAIL and command text', async () => {
    const item = { text: 'npm test', selectable: true, type: 'command', data: { cmd: 'npm test', entries: [] } };
    const entries = [
      { cmd: 'npm test', at: '2026-04-04T14:23:07.000Z', agent_id: null },
    ];
    const { lastFrame, unmount } = render(e(MonitorDetailScreen, {
      item, entries, onBack: () => {}, isActive: true,
    }));
    await act(async () => {});
    const frame = lastFrame();
    assert.ok(frame.includes('COMMAND DETAIL'));
    assert.ok(frame.includes('npm test'));
    unmount();
  });
});

describe('MonitorDetailScreen — sub-agent indicator', () => {
  test('read entries with agent_id show fork indicator', async () => {
    const item = { text: 'c.js', selectable: true, type: 'file', data: { path: 'src/c.js' } };
    const entries = [
      { path: 'src/c.js', at: '2026-04-04T14:23:07.000Z', agent_id: 'sub-1' },
    ];
    const { lastFrame, unmount } = render(e(MonitorDetailScreen, {
      item, entries, onBack: () => {}, isActive: true,
    }));
    await act(async () => {});
    const frame = lastFrame();
    assert.ok(frame.includes('\u{1F500}'));
    unmount();
  });

  test('bash entries with agent_id show fork indicator', async () => {
    const item = { text: 'git status', selectable: true, type: 'command', data: { cmd: 'git status', entries: [] } };
    const entries = [
      { cmd: 'git status', at: '2026-04-04T14:23:07.000Z', agent_id: 'sub-1' },
    ];
    const { lastFrame, unmount } = render(e(MonitorDetailScreen, {
      item, entries, onBack: () => {}, isActive: true,
    }));
    await act(async () => {});
    const frame = lastFrame();
    assert.ok(frame.includes('\u{1F500}'));
    unmount();
  });
});

describe('MonitorDetailScreen — Esc key', () => {
  test('Esc calls onBack callback', async () => {
    let backCalled = false;
    const item = { text: 'a.js', selectable: true, type: 'file', data: { path: 'src/a.js', op: 'edit' } };
    const entries = [
      { path: 'src/a.js', op: 'edit', at: '2026-04-04T14:23:07.000Z', agent_id: null, old_string: 'old', new_string: 'new' },
    ];
    const { stdin, unmount } = render(e(MonitorDetailScreen, {
      item, entries, onBack: () => { backCalled = true; }, isActive: true,
    }));
    await act(async () => {});
    await act(async () => { stdin.write('\x1B'); });
    assert.ok(backCalled);
    unmount();
  });
});

// --- MonitorScreen detail mode tests ---

describe('MonitorScreen — detail mode', () => {
  function createSessionWithData(tmpDir) {
    fs.writeFileSync(path.join(tmpDir, '.alive-sess1'), '');
    fs.writeFileSync(path.join(tmpDir, 'status-sess1.json'), JSON.stringify({
      skill: 'bmad-dev-story',
      project: 'test-proj',
      workflow: 'dev-story',
      updated_at: new Date().toISOString(),
      llm_state: 'active',
      writes: [
        { path: 'src/a.js', in_project: true, op: 'edit', is_new: false, at: '2026-04-04T14:23:07.000Z', agent_id: null, old_string: 'old', new_string: 'new' },
      ],
      reads: [
        { path: 'src/b.js', in_project: true, at: '2026-04-04T14:25:33.000Z', agent_id: null },
      ],
      commands: [
        { cmd: 'npm test', at: '2026-04-04T14:30:00.000Z', agent_id: null },
      ],
    }));
  }

  test('d key activates detail mode with cursor', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-detail-d-'));
    try {
      createSessionWithData(tmpDir);
      const { lastFrame, stdin, unmount } = render(e(MonitorScreen, {
        config: {},
        navigate: () => {},
        goBack: () => {},
        isActive: true,
        paths: { cachePath: tmpDir },
        pollInterval: 10,
      }));
      await act(async () => {});
      await act(async () => { stdin.write('d'); });
      const frame = lastFrame();
      assert.ok(frame.includes('❯'));
      unmount();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('Esc from detail mode returns to normal (no cursor)', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-detail-esc-'));
    try {
      createSessionWithData(tmpDir);
      const { lastFrame, stdin, unmount } = render(e(MonitorScreen, {
        config: {},
        navigate: () => {},
        goBack: () => {},
        isActive: true,
        paths: { cachePath: tmpDir },
        pollInterval: 10,
      }));
      await act(async () => {});
      await act(async () => { stdin.write('d'); });
      assert.ok(lastFrame().includes('❯'));
      await act(async () => { stdin.write('\x1B'); });
      assert.ok(!lastFrame().includes('❯'));
      unmount();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// --- mergeChronology tests ---

describe('mergeChronology', () => {
  test('merges reads, writes, and commands into sorted timeline', () => {
    const reads = [{ path: 'a.js', at: '2026-04-04T14:23:08.000Z', agent_id: null }];
    const writes = [{ path: 'b.js', op: 'write', at: '2026-04-04T14:23:07.000Z', is_new: true, agent_id: null }];
    const commands = [{ cmd: 'npm test', at: '2026-04-04T14:23:09.000Z', agent_id: null }];
    const result = mergeChronology(writes, reads, commands);
    assert.equal(result.length, 3);
    assert.equal(result[0].type, 'WRITE');
    assert.equal(result[1].type, 'READ');
    assert.equal(result[2].type, 'BASH');
  });

  test('assigns EDIT type for writes with op=edit', () => {
    const writes = [{ path: 'c.js', op: 'edit', at: '2026-04-04T14:23:07.000Z', is_new: false, agent_id: null, old_string: 'a', new_string: 'b' }];
    const result = mergeChronology(writes, [], []);
    assert.equal(result[0].type, 'EDIT');
    assert.equal(result[0].old_string, 'a');
    assert.equal(result[0].new_string, 'b');
  });

  test('handles empty arrays', () => {
    const result = mergeChronology([], [], []);
    assert.equal(result.length, 0);
  });

  test('handles null/undefined arrays', () => {
    const result = mergeChronology(null, undefined, null);
    assert.equal(result.length, 0);
  });
});

// --- formatRelativeTime tests ---

describe('formatRelativeTime', () => {
  test('returns seconds format for < 60s', () => {
    const now = new Date(Date.now() - 30 * 1000).toISOString();
    const result = formatRelativeTime(now);
    assert.ok(result.endsWith('s ago'));
  });

  test('returns minutes format for < 60min', () => {
    const now = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const result = formatRelativeTime(now);
    assert.ok(result.includes('min'));
  });

  test('returns hours format for < 24h', () => {
    const now = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    const result = formatRelativeTime(now);
    assert.ok(result.includes('h'));
  });

  test('returns days format for >= 24h', () => {
    const now = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const result = formatRelativeTime(now);
    assert.ok(result.includes('d ago'));
  });

  test('returns empty string for null', () => {
    assert.equal(formatRelativeTime(null), '');
  });

  test('returns empty string for invalid', () => {
    assert.equal(formatRelativeTime('not-a-date'), '');
  });
});

// --- generateCsv tests ---

describe('generateCsv — light mode', () => {
  test('generates header and aggregated rows', () => {
    const writes = [
      { path: 'a.js', op: 'write', at: '2026-04-04T14:23:07.000Z', is_new: true, agent_id: null },
      { path: 'a.js', op: 'write', at: '2026-04-04T14:24:07.000Z', is_new: false, agent_id: null },
    ];
    const reads = [{ path: 'b.js', at: '2026-04-04T14:25:00.000Z', agent_id: null }];
    const csv = generateCsv('light', writes, reads, []);
    const lines = csv.split('\n');
    assert.equal(lines[0], 'type,path,count');
    assert.ok(lines.some(l => l.includes('WRITE') && l.includes('a.js') && l.includes('2')));
    assert.ok(lines.some(l => l.includes('READ') && l.includes('b.js') && l.includes('1')));
  });
});

describe('generateCsv — full mode', () => {
  test('generates header and per-event rows', () => {
    const writes = [{ path: 'a.js', op: 'write', at: '2026-04-04T14:23:07.000Z', is_new: true, agent_id: null }];
    const csv = generateCsv('full', writes, [], []);
    const lines = csv.split('\n');
    assert.equal(lines[0], 'type,path,operation,timestamp,detail');
    assert.ok(lines[1].includes('WRITE'));
    assert.ok(lines[1].includes('file created'));
  });

  test('EDIT detail shows truncated old → new', () => {
    const writes = [{ path: 'a.js', op: 'edit', at: '2026-04-04T14:23:07.000Z', is_new: false, agent_id: null,
      old_string: 'const x = 1', new_string: 'const x = 2' }];
    const csv = generateCsv('full', writes, [], []);
    assert.ok(csv.includes('const x = 1'));
    assert.ok(csv.includes('const x = 2'));
  });

  test('CSV escapes commas and quotes', () => {
    const writes = [{ path: 'a,b.js', op: 'write', at: '2026-04-04T14:23:07.000Z', is_new: true, agent_id: null }];
    const csv = generateCsv('full', writes, [], []);
    assert.ok(csv.includes('"a,b.js"'));
  });
});

// --- writeCsvExport tests ---

describe('writeCsvExport', () => {
  test('creates directory, writes file, returns correct path format', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-csv-'));
    try {
      const csvContent = 'type,path,count\nREAD,a.js,1';
      const filePath = writeCsvExport(tmpDir, 'light', csvContent);
      assert.ok(filePath.includes('monitor-light-'));
      assert.ok(filePath.endsWith('.csv'));
      assert.ok(fs.existsSync(filePath));
      const content = fs.readFileSync(filePath, 'utf8');
      assert.equal(content, csvContent);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('creates monitor subdirectory if missing', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-csv-dir-'));
    try {
      const filePath = writeCsvExport(tmpDir, 'full', 'header\nrow');
      assert.ok(fs.existsSync(path.join(tmpDir, 'monitor')));
      assert.ok(filePath.includes('monitor-full-'));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// --- Chronology rendering tests ---

describe('MonitorDetailScreen — chronology', () => {
  test('renders CHRONOLOGY title and color-coded entries', async () => {
    const item = { type: 'chronology', text: 'timeline', selectable: false, data: null };
    const entries = [
      { at: '2026-04-04T14:23:07.000Z', type: 'READ', path: 'src/a.js', cmd: null, agent_id: null, is_new: false, op: null, old_string: null, new_string: null },
      { at: '2026-04-04T14:23:08.000Z', type: 'WRITE', path: 'src/b.js', cmd: null, agent_id: null, is_new: false, op: 'write', old_string: null, new_string: null },
      { at: '2026-04-04T14:23:09.000Z', type: 'EDIT', path: 'src/c.js', cmd: null, agent_id: null, is_new: false, op: 'edit', old_string: 'a', new_string: 'b' },
      { at: '2026-04-04T14:23:10.000Z', type: 'BASH', path: null, cmd: 'npm test', agent_id: null, is_new: false, op: null, old_string: null, new_string: null },
    ];
    const { lastFrame, unmount } = render(e(MonitorDetailScreen, {
      item, entries, onBack: () => {}, isActive: true,
    }));
    await act(async () => {});
    const frame = lastFrame();
    assert.ok(frame.includes('CHRONOLOGY'));
    assert.ok(frame.includes('src/a.js'));
    assert.ok(frame.includes('src/b.js'));
    assert.ok(frame.includes('npm test'));
    unmount();
  });

  test('shows * on is_new entries and fork on agent_id entries', async () => {
    const item = { type: 'chronology', text: 'timeline', selectable: false, data: null };
    const entries = [
      { at: '2026-04-04T14:23:07.000Z', type: 'WRITE', path: 'src/new.js', cmd: null, agent_id: null, is_new: true, op: 'write', old_string: null, new_string: null },
      { at: '2026-04-04T14:23:08.000Z', type: 'READ', path: 'src/sub.js', cmd: null, agent_id: 'sub-1', is_new: false, op: null, old_string: null, new_string: null },
    ];
    const { lastFrame, unmount } = render(e(MonitorDetailScreen, {
      item, entries, onBack: () => {}, isActive: true,
    }));
    await act(async () => {});
    const frame = lastFrame();
    assert.ok(frame.includes('*'));
    assert.ok(frame.includes('\u{1F500}'));
    unmount();
  });

  test('s key calls onToggleSort callback', async () => {
    const item = { type: 'chronology', text: 'timeline', selectable: false, data: null };
    const entries = [
      { at: '2026-04-04T14:23:10.000Z', type: 'READ', path: 'z-file.js', cmd: null, agent_id: null, is_new: false, op: null, old_string: null, new_string: null },
      { at: '2026-04-04T14:23:07.000Z', type: 'READ', path: 'a-file.js', cmd: null, agent_id: null, is_new: false, op: null, old_string: null, new_string: null },
    ];
    let sortToggled = false;
    const { stdin, unmount } = render(e(MonitorDetailScreen, {
      item, entries, onBack: () => {}, isActive: true,
      sortMode: 'chrono', onToggleSort: () => { sortToggled = true; },
    }));
    await act(async () => {});
    await act(async () => { stdin.write('s'); });
    assert.ok(sortToggled, 'onToggleSort should be called');
    unmount();
  });

  test('alpha sortMode prop renders entries in alphabetical order', async () => {
    const item = { type: 'chronology', text: 'timeline', selectable: false, data: null };
    const entries = [
      { at: '2026-04-04T14:23:07.000Z', type: 'READ', path: 'z-file.js', cmd: null, agent_id: null, is_new: false, op: null, old_string: null, new_string: null },
      { at: '2026-04-04T14:23:10.000Z', type: 'READ', path: 'a-file.js', cmd: null, agent_id: null, is_new: false, op: null, old_string: null, new_string: null },
    ];
    const { lastFrame, unmount } = render(e(MonitorDetailScreen, {
      item, entries, onBack: () => {}, isActive: true,
      sortMode: 'alpha',
    }));
    await act(async () => {});
    const frame = lastFrame();
    const aPos = frame.indexOf('a-file.js');
    const zPos = frame.indexOf('z-file.js');
    assert.ok(aPos < zPos, 'alpha: a-file before z-file');
    unmount();
  });

  test('t key calls onToggleTime callback', async () => {
    const item = { type: 'chronology', text: 'timeline', selectable: false, data: null };
    const entries = [
      { at: new Date(Date.now() - 120000).toISOString(), type: 'READ', path: 'src/a.js', cmd: null, agent_id: null, is_new: false, op: null, old_string: null, new_string: null },
    ];
    let timeToggled = false;
    const { stdin, unmount } = render(e(MonitorDetailScreen, {
      item, entries, onBack: () => {}, isActive: true,
      timeFormat: 'absolute', onToggleTime: () => { timeToggled = true; },
    }));
    await act(async () => {});
    await act(async () => { stdin.write('t'); });
    assert.ok(timeToggled, 'onToggleTime should be called');
    unmount();
  });

  test('relative timeFormat prop renders relative timestamps', async () => {
    const item = { type: 'chronology', text: 'timeline', selectable: false, data: null };
    const entries = [
      { at: new Date(Date.now() - 120000).toISOString(), type: 'READ', path: 'src/a.js', cmd: null, agent_id: null, is_new: false, op: null, old_string: null, new_string: null },
    ];
    const { lastFrame, unmount } = render(e(MonitorDetailScreen, {
      item, entries, onBack: () => {}, isActive: true,
      timeFormat: 'relative',
    }));
    await act(async () => {});
    const frame = lastFrame();
    assert.ok(frame.includes('ago'));
    unmount();
  });
});

// --- ExportPrompt tests ---

describe('ExportPrompt', async () => {
  // Dynamic import to avoid issues with ESM
  const { ExportPrompt } = await import('../src/tui/monitor/components/ExportPrompt.js');

  test('l key calls onSelect with light', async () => {
    let selected = null;
    const { stdin, unmount } = render(e(ExportPrompt, {
      onSelect: (mode) => { selected = mode; },
      onCancel: () => {},
      isActive: true,
    }));
    await act(async () => {});
    await act(async () => { stdin.write('l'); });
    assert.equal(selected, 'light');
    unmount();
  });

  test('f key calls onSelect with full', async () => {
    let selected = null;
    const { stdin, unmount } = render(e(ExportPrompt, {
      onSelect: (mode) => { selected = mode; },
      onCancel: () => {},
      isActive: true,
    }));
    await act(async () => {});
    await act(async () => { stdin.write('f'); });
    assert.equal(selected, 'full');
    unmount();
  });

  test('Esc calls onCancel', async () => {
    let cancelled = false;
    const { stdin, unmount } = render(e(ExportPrompt, {
      onSelect: () => {},
      onCancel: () => { cancelled = true; },
      isActive: true,
    }));
    await act(async () => {});
    await act(async () => { stdin.write('\x1B'); });
    assert.ok(cancelled);
    unmount();
  });
});

// --- MonitorScreen c/e key tests ---

describe('MonitorScreen — chronology and export', () => {
  function createSessionWithData(tmpDir) {
    fs.writeFileSync(path.join(tmpDir, '.alive-sess1'), '');
    fs.writeFileSync(path.join(tmpDir, 'status-sess1.json'), JSON.stringify({
      skill: 'bmad-dev-story',
      project: 'test-proj',
      workflow: 'dev-story',
      updated_at: new Date().toISOString(),
      llm_state: 'active',
      writes: [
        { path: 'src/a.js', in_project: true, op: 'edit', is_new: false, at: '2026-04-04T14:23:07.000Z', agent_id: null, old_string: 'old', new_string: 'new' },
      ],
      reads: [
        { path: 'src/b.js', in_project: true, at: '2026-04-04T14:25:33.000Z', agent_id: null },
      ],
      commands: [
        { cmd: 'npm test', at: '2026-04-04T14:30:00.000Z', agent_id: null },
      ],
    }));
  }

  test('c key opens chronology view', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-chrono-'));
    try {
      createSessionWithData(tmpDir);
      const { lastFrame, stdin, unmount } = render(e(MonitorScreen, {
        config: {},
        navigate: () => {},
        goBack: () => {},
        isActive: true,
        paths: { cachePath: tmpDir, outputFolder: tmpDir },
        pollInterval: 10,
      }));
      await act(async () => {});
      await act(async () => { stdin.write('c'); });
      const frame = lastFrame();
      assert.ok(frame.includes('CHRONOLOGY'));
      unmount();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('e key shows export prompt', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-export-'));
    try {
      createSessionWithData(tmpDir);
      const { lastFrame, stdin, unmount } = render(e(MonitorScreen, {
        config: {},
        navigate: () => {},
        goBack: () => {},
        isActive: true,
        paths: { cachePath: tmpDir, outputFolder: tmpDir },
        pollInterval: 10,
      }));
      await act(async () => {});
      await act(async () => { stdin.write('e'); });
      const frame = lastFrame();
      assert.ok(frame.includes('Export:'));
      assert.ok(frame.includes('light'));
      assert.ok(frame.includes('full'));
      unmount();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('Esc cancels export prompt without exporting', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-export-esc-'));
    try {
      createSessionWithData(tmpDir);
      const { lastFrame, stdin, unmount } = render(e(MonitorScreen, {
        config: {},
        navigate: () => {},
        goBack: () => {},
        isActive: true,
        paths: { cachePath: tmpDir, outputFolder: tmpDir },
        pollInterval: 10,
      }));
      await act(async () => {});
      await act(async () => { stdin.write('e'); });
      let frame = lastFrame();
      assert.ok(frame.includes('Export:'));
      await act(async () => { stdin.write('\x1B'); });
      frame = lastFrame();
      assert.ok(!frame.includes('Export:'));
      assert.ok(!frame.includes('Exported:'));
      // Verify no CSV was written
      const monitorDir = path.join(tmpDir, 'monitor');
      const csvExists = fs.existsSync(monitorDir) && fs.readdirSync(monitorDir).some(f => f.endsWith('.csv'));
      assert.ok(!csvExists, 'No CSV should be written after Esc cancel');
      unmount();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('export confirm shows path then dismisses on any key', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-export-confirm-'));
    try {
      createSessionWithData(tmpDir);
      const { lastFrame, stdin, unmount } = render(e(MonitorScreen, {
        config: {},
        navigate: () => {},
        goBack: () => {},
        isActive: true,
        paths: { cachePath: tmpDir, outputFolder: tmpDir },
        pollInterval: 10,
      }));
      await act(async () => {});
      await act(async () => { stdin.write('e'); });
      await act(async () => { stdin.write('l'); });
      let frame = lastFrame();
      assert.ok(frame.includes('Exported:'));
      assert.ok(frame.includes('monitor-light-'));
      // Any key dismisses
      await act(async () => { stdin.write('x'); });
      frame = lastFrame();
      assert.ok(!frame.includes('Exported:'));
      unmount();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
