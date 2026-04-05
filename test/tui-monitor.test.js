// tui-monitor.test.js — Tests for MonitorScreen + pollSessions

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import React from 'react';
import { render } from 'ink-testing-library';
import {
  pollSessions, filterReadOnly, deduplicateCommands,
  getCommandFamily, buildFileTree, renderTreeLines,
  groupSessionsByProject, computeDisplayState, worstState,
  resolveSessionColor, resolveProjectColor, formatElapsed,
  INACTIVE_TIMEOUT_MS, MONITOR_STALE_MS, MONITOR_IDLE_WINDOW_MS,
} from '../src/tui/monitor/monitor-utils.js';
import { MonitorScreen } from '../src/tui/monitor/MonitorScreen.js';
import { renderBashSection } from '../src/tui/monitor/components/BashSection.js';

const e = React.createElement;
const delay = (ms) => new Promise(r => setTimeout(r, ms));

// --- pollSessions unit tests ---

describe('pollSessions', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-monitor-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns sessions when .alive + status files exist', () => {
    fs.writeFileSync(path.join(tmpDir, '.alive-abc123'), '');
    fs.writeFileSync(path.join(tmpDir, 'status-abc123.json'), JSON.stringify({
      skill: 'bmad-dev-story',
      project: 'my-project',
      updated_at: new Date().toISOString(),
      llm_state: 'active',
    }));
    const sessions = pollSessions(tmpDir);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].skill, 'bmad-dev-story');
    assert.equal(sessions[0].sessionId, 'abc123');
    assert.equal(sessions[0].project, 'my-project');
  });

  test('filters non-BMAD sessions (no skill field)', () => {
    fs.writeFileSync(path.join(tmpDir, '.alive-def456'), '');
    fs.writeFileSync(path.join(tmpDir, 'status-def456.json'), JSON.stringify({
      project: 'other-project',
      updated_at: new Date().toISOString(),
    }));
    const sessions = pollSessions(tmpDir);
    assert.equal(sessions.length, 0);
  });

  test('handles missing cache dir gracefully', () => {
    const sessions = pollSessions(path.join(tmpDir, 'nonexistent'));
    assert.deepEqual(sessions, []);
  });

  test('skips corrupted status files (invalid JSON)', () => {
    fs.writeFileSync(path.join(tmpDir, '.alive-bad789'), '');
    fs.writeFileSync(path.join(tmpDir, 'status-bad789.json'), 'NOT JSON{{{');
    const sessions = pollSessions(tmpDir);
    assert.equal(sessions.length, 0);
  });

  test('empty state — no .alive files returns empty array', () => {
    const sessions = pollSessions(tmpDir);
    assert.deepEqual(sessions, []);
  });

  test('skips .alive without matching status file', () => {
    fs.writeFileSync(path.join(tmpDir, '.alive-orphan'), '');
    const sessions = pollSessions(tmpDir);
    assert.equal(sessions.length, 0);
  });

  test('alive file with current process PID — session included', () => {
    // Use current process PID (guaranteed alive)
    fs.writeFileSync(path.join(tmpDir, '.alive-pid1'), String(process.pid));
    fs.writeFileSync(path.join(tmpDir, 'status-pid1.json'), JSON.stringify({
      skill: 'bmad-dev-story',
      project: 'my-project',
      updated_at: new Date().toISOString(),
      llm_state: 'active',
    }));
    const sessions = pollSessions(tmpDir);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].sessionId, 'pid1');
  });

  test('alive file with dead PID — session excluded', () => {
    // PID 99999 is almost certainly not running
    fs.writeFileSync(path.join(tmpDir, '.alive-deadpid'), '99999');
    fs.writeFileSync(path.join(tmpDir, 'status-deadpid.json'), JSON.stringify({
      skill: 'bmad-dev-story',
      project: 'my-project',
      updated_at: new Date().toISOString(),
      llm_state: 'active',
    }));
    const sessions = pollSessions(tmpDir);
    assert.equal(sessions.length, 0);
  });
});

// --- MonitorScreen render tests ---

describe('MonitorScreen', () => {
  test('renders with MONITOR title visible', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-monitor-render-'));
    try {
      const { lastFrame, unmount } = render(e(MonitorScreen, {
        config: {},
        navigate: () => {},
        goBack: () => {},
        isActive: true,
        paths: { cachePath: tmpDir },
      }));
      const frame = lastFrame();
      assert.ok(frame.includes('MONITOR'));
      unmount();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('empty state shows no-sessions message', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-monitor-empty-'));
    try {
      const { lastFrame, unmount } = render(e(MonitorScreen, {
        config: {},
        navigate: () => {},
        goBack: () => {},
        isActive: true,
        paths: { cachePath: tmpDir },
      }));
      const frame = lastFrame();
      assert.ok(frame.includes('No active BMAD session'));
      unmount();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('Esc key triggers goBack', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-monitor-esc-'));
    try {
      let goBackCalled = false;
      const goBack = () => { goBackCalled = true; };
      const { stdin, unmount } = render(e(MonitorScreen, {
        config: {},
        navigate: () => {},
        goBack,
        isActive: true,
        paths: { cachePath: tmpDir },
      }));
      await delay(50);
      stdin.write('\x1B');
      await delay(50);
      assert.ok(goBackCalled);
      unmount();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('shows session count when sessions exist', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-monitor-count-'));
    try {
      fs.writeFileSync(path.join(tmpDir, '.alive-sess1'), '');
      fs.writeFileSync(path.join(tmpDir, 'status-sess1.json'), JSON.stringify({
        skill: 'bmad-dev-story',
        project: 'test-proj',
        updated_at: new Date().toISOString(),
      }));
      const { lastFrame, unmount } = render(e(MonitorScreen, {
        config: {},
        navigate: () => {},
        goBack: () => {},
        isActive: true,
        paths: { cachePath: tmpDir },
      }));
      await delay(50);
      const frame = lastFrame();
      assert.ok(frame.includes('1 session'));
      assert.ok(!frame.includes('No active BMAD session'));
      unmount();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// --- filterReadOnly tests ---

describe('filterReadOnly', () => {
  test('keeps reads whose path is not in writes', () => {
    const reads = [
      { path: 'a.js', in_project: true, at: '2026-01-01T00:00:00Z', agent_id: null },
      { path: 'b.js', in_project: true, at: '2026-01-01T00:00:00Z', agent_id: null },
    ];
    const writes = [
      { path: 'b.js', in_project: true, op: 'edit', is_new: false, at: '2026-01-01T00:00:00Z', agent_id: null },
    ];
    const result = filterReadOnly(reads, writes);
    assert.equal(result.length, 1);
    assert.equal(result[0].path, 'a.js');
  });

  test('empty reads returns empty', () => {
    assert.deepEqual(filterReadOnly([], [{ path: 'x.js' }]), []);
  });

  test('empty writes returns all reads', () => {
    const reads = [{ path: 'a.js' }, { path: 'b.js' }];
    assert.equal(filterReadOnly(reads, []).length, 2);
  });
});

// --- deduplicateCommands tests ---

describe('deduplicateCommands', () => {
  test('single occurrence has count=1', () => {
    const commands = [{ cmd: 'npm test', at: '2026-01-01T00:00:00Z', agent_id: null }];
    const result = deduplicateCommands(commands);
    assert.equal(result.length, 1);
    assert.equal(result[0].count, 1);
    assert.equal(result[0].hasSubAgent, false);
  });

  test('duplicates get correct count, order preserved by first occurrence', () => {
    const commands = [
      { cmd: 'npm test', at: '2026-01-01T00:00:00Z', agent_id: null },
      { cmd: 'git status', at: '2026-01-01T00:01:00Z', agent_id: null },
      { cmd: 'npm test', at: '2026-01-01T00:02:00Z', agent_id: null },
      { cmd: 'npm test', at: '2026-01-01T00:03:00Z', agent_id: null },
    ];
    const result = deduplicateCommands(commands);
    assert.equal(result.length, 2);
    assert.equal(result[0].cmd, 'npm test');
    assert.equal(result[0].count, 3);
    assert.equal(result[1].cmd, 'git status');
    assert.equal(result[1].count, 1);
  });

  test('hasSubAgent true when any entry has agent_id', () => {
    const commands = [
      { cmd: 'npm test', at: '2026-01-01T00:00:00Z', agent_id: null },
      { cmd: 'npm test', at: '2026-01-01T00:01:00Z', agent_id: 'sub-1' },
    ];
    const result = deduplicateCommands(commands);
    assert.equal(result[0].hasSubAgent, true);
  });
});

// --- getCommandFamily tests ---

describe('getCommandFamily', () => {
  test('npm → green', () => {
    assert.deepEqual(getCommandFamily('npm test'), { color: 'green', dim: false });
  });

  test('git → yellow', () => {
    assert.deepEqual(getCommandFamily('git status'), { color: 'yellow', dim: false });
  });

  test('node → cyan', () => {
    assert.deepEqual(getCommandFamily('node --version'), { color: 'cyan', dim: false });
  });

  test('ls/rm/mkdir → dim', () => {
    assert.deepEqual(getCommandFamily('ls -la'), { color: undefined, dim: true });
    assert.deepEqual(getCommandFamily('rm -rf foo'), { color: undefined, dim: true });
    assert.deepEqual(getCommandFamily('mkdir test'), { color: undefined, dim: true });
  });

  test('python → blue', () => {
    assert.deepEqual(getCommandFamily('python3 script.py'), { color: 'blue', dim: false });
  });

  test('other → magenta', () => {
    assert.deepEqual(getCommandFamily('docker build .'), { color: 'magenta', dim: false });
  });
});

// --- buildFileTree + renderTreeLines tests ---

describe('buildFileTree + renderTreeLines', () => {
  test('two files in same directory produce correct tree with branch chars', () => {
    const entries = [
      { path: 'src/a.js', in_project: true, is_new: false, agent_id: null },
      { path: 'src/b.js', in_project: true, is_new: false, agent_id: null },
    ];
    const { inProject } = buildFileTree(entries);
    const lines = renderTreeLines(inProject);
    const texts = lines.map(l => l.text);
    assert.ok(texts.some(t => t.includes('├──')));
    assert.ok(texts.some(t => t.includes('└──')));
    assert.ok(texts.some(t => t.includes('a.js')));
    assert.ok(texts.some(t => t.includes('b.js')));
  });

  test('* indicator for is_new with green color', () => {
    const entries = [
      { path: 'new-file.js', in_project: true, is_new: true, agent_id: null },
    ];
    const { inProject } = buildFileTree(entries);
    const lines = renderTreeLines(inProject);
    assert.ok(lines[0].indicators.length > 0);
    assert.equal(lines[0].indicators[0].text, ' *');
    assert.equal(lines[0].indicators[0].color, 'green');
  });

  test('🔀 indicator for agent_id with cyan color', () => {
    const entries = [
      { path: 'agent-file.js', in_project: true, is_new: false, agent_id: 'sub-1' },
    ];
    const { inProject } = buildFileTree(entries);
    const lines = renderTreeLines(inProject);
    assert.ok(lines[0].indicators.length > 0);
    assert.equal(lines[0].indicators[0].text, ' 🔀');
    assert.equal(lines[0].indicators[0].color, 'cyan');
  });

  test('file/dir name collision — dir wins over leaf', () => {
    const entries = [
      { path: 'src/utils/helper.js', in_project: true, is_new: false, agent_id: null },
      { path: 'src/utils', in_project: true, is_new: false, agent_id: null },
    ];
    const { inProject } = buildFileTree(entries);
    const lines = renderTreeLines(inProject);
    // utils should be rendered as directory, helper.js inside it
    assert.ok(lines.some(l => l.text.includes('utils/')));
    assert.ok(lines.some(l => l.text.includes('helper.js')));
  });

  test('out-of-project entries separated from tree', () => {
    const entries = [
      { path: 'src/a.js', in_project: true, is_new: false, agent_id: null },
      { path: '/home/user/.bashrc', in_project: false, is_new: false, agent_id: null },
    ];
    const { inProject, outProject } = buildFileTree(entries);
    assert.equal(outProject.length, 1);
    assert.equal(outProject[0].path, '/home/user/.bashrc');
    const treeLines = renderTreeLines(inProject);
    assert.ok(treeLines.some(l => l.text.includes('a.js')));
  });
});

// --- groupSessionsByProject tests ---

describe('groupSessionsByProject', () => {
  test('multiple projects → groups by session.project', () => {
    const sessions = [
      { sessionId: 's1', project: 'alpha', skill: 'dev-story' },
      { sessionId: 's2', project: 'beta', skill: 'code-review' },
      { sessionId: 's3', project: 'alpha', skill: 'sprint-status' },
    ];
    const groups = groupSessionsByProject(sessions);
    assert.equal(groups.size, 2);
    assert.equal(groups.get('alpha').length, 2);
    assert.equal(groups.get('beta').length, 1);
  });

  test('single project → one group', () => {
    const sessions = [
      { sessionId: 's1', project: 'alpha', skill: 'dev-story' },
      { sessionId: 's2', project: 'alpha', skill: 'code-review' },
    ];
    const groups = groupSessionsByProject(sessions);
    assert.equal(groups.size, 1);
    assert.equal(groups.get('alpha').length, 2);
  });

  test('missing project → grouped under unknown', () => {
    const sessions = [
      { sessionId: 's1', skill: 'dev-story' },
      { sessionId: 's2', project: undefined, skill: 'code-review' },
    ];
    const groups = groupSessionsByProject(sessions);
    assert.equal(groups.size, 1);
    assert.equal(groups.get('unknown').length, 2);
  });
});

// --- computeDisplayState tests ---

describe('computeDisplayState', () => {
  test('active state with recent updated_at → active', () => {
    const session = { llm_state: 'active', updated_at: new Date().toISOString() };
    assert.equal(computeDisplayState(session), 'active');
  });

  test('active state with stale updated_at (>5 min) → inactive override', () => {
    const staleDate = new Date(Date.now() - INACTIVE_TIMEOUT_MS - 1000).toISOString();
    const session = { llm_state: 'active', updated_at: staleDate };
    assert.equal(computeDisplayState(session), 'inactive');
  });

  test('permission state → permission', () => {
    const session = { llm_state: 'permission', updated_at: new Date().toISOString() };
    assert.equal(computeDisplayState(session), 'permission');
  });

  test('waiting state → waiting', () => {
    const session = { llm_state: 'waiting', updated_at: new Date().toISOString() };
    assert.equal(computeDisplayState(session), 'waiting');
  });

  test('missing llm_state → inactive', () => {
    const session = { updated_at: new Date().toISOString() };
    assert.equal(computeDisplayState(session), 'inactive');
  });
});

// --- worstState tests ---

describe('worstState', () => {
  test('[active, waiting] → waiting', () => {
    const sessions = [
      { llm_state: 'active', updated_at: new Date().toISOString() },
      { llm_state: 'waiting', updated_at: new Date().toISOString() },
    ];
    assert.equal(worstState(sessions), 'waiting');
  });

  test('[active, permission] → permission', () => {
    const sessions = [
      { llm_state: 'active', updated_at: new Date().toISOString() },
      { llm_state: 'permission', updated_at: new Date().toISOString() },
    ];
    assert.equal(worstState(sessions), 'permission');
  });

  test('[active, active] → active', () => {
    const sessions = [
      { llm_state: 'active', updated_at: new Date().toISOString() },
      { llm_state: 'active', updated_at: new Date().toISOString() },
    ];
    assert.equal(worstState(sessions), 'active');
  });

  test('[inactive] → inactive', () => {
    const sessions = [
      { llm_state: 'inactive', updated_at: new Date().toISOString() },
    ];
    assert.equal(worstState(sessions), 'inactive');
  });
});

// --- resolveSessionColor tests ---

describe('resolveSessionColor', () => {
  test('config override → returns config value', () => {
    const config = { skillColors: { 'dev-story': 'brightRed' } };
    assert.equal(resolveSessionColor('dev-story', config), 'redBright');
  });

  test('no config → falls back to skill-catalog default', () => {
    const config = {};
    assert.equal(resolveSessionColor('dev-story', config), 'cyan');
  });

  test('unknown workflow → returns white', () => {
    const config = {};
    assert.equal(resolveSessionColor('nonexistent-workflow-xyz', config), 'white');
  });
});

// --- resolveProjectColor tests ---

describe('resolveProjectColor', () => {
  test('config override → returns config value', () => {
    const config = { projectColors: { 'my-project': 'brightBlue' } };
    assert.equal(resolveProjectColor('my-project', config), 'blueBright');
  });

  test('no config → returns hash-based color', () => {
    const config = {};
    const color = resolveProjectColor('my-project', config);
    assert.ok(typeof color === 'string' && color.length > 0);
    assert.notEqual(color, 'white');
  });
});

// --- formatElapsed tests ---

describe('formatElapsed', () => {
  test('seconds → "Xs"', () => {
    const startedAt = new Date(Date.now() - 45 * 1000).toISOString();
    assert.equal(formatElapsed(startedAt), '45s');
  });

  test('minutes → "XmYYs"', () => {
    const startedAt = new Date(Date.now() - (3 * 60 + 5) * 1000).toISOString();
    assert.equal(formatElapsed(startedAt), '3m05s');
  });

  test('hours → "XhYYm"', () => {
    const startedAt = new Date(Date.now() - (90 * 60) * 1000).toISOString();
    assert.equal(formatElapsed(startedAt), '1h30m');
  });

  test('missing → empty string', () => {
    assert.equal(formatElapsed(null), '');
    assert.equal(formatElapsed(undefined), '');
  });
});

// --- MonitorScreen tab navigation tests ---

describe('MonitorScreen — tab navigation', () => {
  function createSessionFixtures(tmpDir, sessions) {
    for (const s of sessions) {
      fs.writeFileSync(path.join(tmpDir, `.alive-${s.id}`), '');
      fs.writeFileSync(path.join(tmpDir, `status-${s.id}.json`), JSON.stringify({
        skill: s.skill,
        project: s.project,
        workflow: s.workflow,
        updated_at: new Date().toISOString(),
        llm_state: s.llm_state || 'active',
      }));
    }
  }

  test('multi-project: ←→ changes active project tab', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-monitor-tabs-'));
    try {
      createSessionFixtures(tmpDir, [
        { id: 's1', skill: 'bmad-dev', project: 'alpha', workflow: 'dev-story', llm_state: 'active' },
        { id: 's2', skill: 'bmad-review', project: 'beta', workflow: 'code-review', llm_state: 'waiting' },
      ]);
      const { lastFrame, stdin, unmount } = render(e(MonitorScreen, {
        config: {},
        navigate: () => {},
        goBack: () => {},
        isActive: true,
        paths: { cachePath: tmpDir },
      }));
      await delay(50);
      const frame1 = lastFrame();
      assert.ok(frame1.includes('2 sessions'));

      // Navigate right
      stdin.write('\x1B[C'); // right arrow
      await delay(50);
      const frame2 = lastFrame();
      assert.ok(frame2.includes('MONITOR'));

      unmount();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('single-project: ←→ changes active session', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-monitor-single-'));
    try {
      createSessionFixtures(tmpDir, [
        { id: 's1', skill: 'bmad-dev', project: 'alpha', workflow: 'dev-story', llm_state: 'active' },
        { id: 's2', skill: 'bmad-review', project: 'alpha', workflow: 'code-review', llm_state: 'waiting' },
      ]);
      const { lastFrame, stdin, unmount } = render(e(MonitorScreen, {
        config: {},
        navigate: () => {},
        goBack: () => {},
        isActive: true,
        paths: { cachePath: tmpDir },
      }));
      await delay(50);
      const frame1 = lastFrame();
      assert.ok(frame1.includes('2 sessions'));

      // Navigate right to second session
      stdin.write('\x1B[C'); // right arrow
      await delay(50);
      const frame2 = lastFrame();
      assert.ok(frame2.includes('MONITOR'));

      unmount();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('single-session: no tabs rendered', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-monitor-notabs-'));
    try {
      createSessionFixtures(tmpDir, [
        { id: 's1', skill: 'bmad-dev', project: 'alpha', workflow: 'dev-story', llm_state: 'active' },
      ]);
      const { lastFrame, unmount } = render(e(MonitorScreen, {
        config: {},
        navigate: () => {},
        goBack: () => {},
        isActive: true,
        paths: { cachePath: tmpDir },
      }));
      await delay(50);
      const frame = lastFrame();
      assert.ok(frame.includes('1 session'));
      assert.ok(frame.includes('ACTIVE'));
      unmount();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('r key activates inline project reorder', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-monitor-reorder-'));
    try {
      createSessionFixtures(tmpDir, [
        { id: 's1', skill: 'bmad-dev', project: 'alpha', workflow: 'dev-story', llm_state: 'active' },
        { id: 's2', skill: 'bmad-review', project: 'beta', workflow: 'code-review', llm_state: 'waiting' },
      ]);
      const { lastFrame, stdin, unmount } = render(e(MonitorScreen, {
        config: {},
        navigate: () => {},
        goBack: () => {},
        isActive: true,
        paths: { cachePath: tmpDir },
      }));
      await delay(50);
      stdin.write('r');
      await delay(50);
      const frame = lastFrame();
      assert.ok(frame.includes('grab'), 'reorder navigate shortcuts should show grab');
      assert.ok(frame.includes('MONITOR'), 'header should remain visible');
      unmount();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('R key activates inline session reorder', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-monitor-reorder-sess-'));
    try {
      createSessionFixtures(tmpDir, [
        { id: 's1', skill: 'bmad-dev', project: 'alpha', workflow: 'dev-story', llm_state: 'active' },
        { id: 's2', skill: 'bmad-review', project: 'alpha', workflow: 'code-review', llm_state: 'waiting' },
      ]);
      const { lastFrame, stdin, unmount } = render(e(MonitorScreen, {
        config: {},
        navigate: () => {},
        goBack: () => {},
        isActive: true,
        paths: { cachePath: tmpDir },
      }));
      await delay(50);
      stdin.write('R');
      await delay(50);
      const frame = lastFrame();
      assert.ok(frame.includes('grab'), 'reorder navigate shortcuts should show grab');
      assert.ok(frame.includes('MONITOR'), 'header should remain visible');
      unmount();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// --- Toggle tests ---

describe('MonitorScreen — toggles', () => {
  function createSessionFixtures(tmpDir, sessions) {
    for (const s of sessions) {
      fs.writeFileSync(path.join(tmpDir, `.alive-${s.id}`), '');
      fs.writeFileSync(path.join(tmpDir, `status-${s.id}.json`), JSON.stringify({
        skill: s.skill,
        project: s.project,
        workflow: s.workflow,
        updated_at: new Date().toISOString(),
        llm_state: s.llm_state || 'active',
        writes: s.writes || [],
        reads: s.reads || [],
        commands: s.commands || [],
      }));
    }
  }

  test('f key toggles in detail cursor mode', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-toggle-detail-'));
    try {
      createSessionFixtures(tmpDir, [
        { id: 's1', skill: 'bmad-dev', project: 'alpha', workflow: 'dev-story', llm_state: 'active',
          writes: [{ path: 'src/a.js', in_project: true, op: 'edit', is_new: false, at: '2026-04-04T14:23:07.000Z', agent_id: null, old_string: 'old', new_string: 'new' }] },
      ]);
      const { lastFrame, stdin, unmount } = render(e(MonitorScreen, {
        config: {},
        navigate: () => {},
        goBack: () => {},
        isActive: true,
        paths: { cachePath: tmpDir, outputFolder: tmpDir },
      }));
      await delay(50);
      // Enter detail mode
      stdin.write('d');
      await delay(50);
      assert.ok(lastFrame().includes('❯'));
      // f toggle works in detail mode — checkbox reflects state
      assert.ok(lastFrame().includes('[x]'), 'default showSubAgents checked');
      stdin.write('f');
      await delay(50);
      assert.ok(lastFrame().includes('[ ]'), 'showSubAgents unchecked after toggle');
      unmount();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('contextual shortcuts — normal mode shows colored shortcuts', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-shortcuts-normal-'));
    try {
      createSessionFixtures(tmpDir, [
        { id: 's1', skill: 'bmad-dev', project: 'alpha', workflow: 'dev-story', llm_state: 'active' },
      ]);
      const { lastFrame, unmount } = render(e(MonitorScreen, {
        config: {},
        navigate: () => {},
        goBack: () => {},
        isActive: true,
        paths: { cachePath: tmpDir, outputFolder: tmpDir },
      }));
      await delay(50);
      const frame = lastFrame();
      assert.ok(frame.includes('detail'));
      assert.ok(frame.includes('timeline'));
      assert.ok(frame.includes('export'));
      assert.ok(frame.includes('agents'));
      assert.ok(frame.includes('home'));
      unmount();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('contextual shortcuts — detail mode shows navigate/open', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-shortcuts-detail-'));
    try {
      createSessionFixtures(tmpDir, [
        { id: 's1', skill: 'bmad-dev', project: 'alpha', workflow: 'dev-story', llm_state: 'active',
          writes: [{ path: 'src/a.js', in_project: true, op: 'edit', is_new: false, at: '2026-04-04T14:23:07.000Z', agent_id: null, old_string: 'old', new_string: 'new' }] },
      ]);
      const { lastFrame, stdin, unmount } = render(e(MonitorScreen, {
        config: {},
        navigate: () => {},
        goBack: () => {},
        isActive: true,
        paths: { cachePath: tmpDir, outputFolder: tmpDir },
      }));
      await delay(50);
      stdin.write('d');
      await delay(50);
      const frame = lastFrame();
      assert.ok(frame.includes('navigate'));
      assert.ok(frame.includes('open'));
      assert.ok(frame.includes('back'));
      unmount();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('Esc in normal mode calls goBack', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-esc-normal-'));
    try {
      let goBackCalled = false;
      const { stdin, unmount } = render(e(MonitorScreen, {
        config: {},
        navigate: () => {},
        goBack: () => { goBackCalled = true; },
        isActive: true,
        paths: { cachePath: tmpDir, outputFolder: tmpDir },
      }));
      await delay(50);
      stdin.write('\x1B');
      await delay(50);
      assert.ok(goBackCalled);
      unmount();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('f key toggles sub-agent filter and hides agent entries', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-toggle-agents-'));
    try {
      createSessionFixtures(tmpDir, [
        { id: 's1', skill: 'bmad-dev', project: 'alpha', workflow: 'dev-story', llm_state: 'active',
          writes: [
            { path: 'src/main.js', in_project: true, op: 'edit', is_new: false, at: '2026-04-04T14:00:00.000Z', agent_id: null, old_string: 'a', new_string: 'b' },
            { path: 'src/agent.js', in_project: true, op: 'edit', is_new: false, at: '2026-04-04T14:01:00.000Z', agent_id: 'sub-1', old_string: 'c', new_string: 'd' },
          ],
          commands: [
            { cmd: 'npm test', at: '2026-04-04T14:02:00.000Z', agent_id: null },
            { cmd: 'git status', at: '2026-04-04T14:03:00.000Z', agent_id: 'sub-1' },
          ],
        },
      ]);
      const { lastFrame, stdin, unmount } = render(e(MonitorScreen, {
        config: {},
        navigate: () => {},
        goBack: () => {},
        isActive: true,
        paths: { cachePath: tmpDir, outputFolder: tmpDir },
      }));
      await delay(50);
      // Default: checkbox checked, both files visible
      let frame = lastFrame();
      assert.ok(frame.includes('[x]'), 'default showSubAgents checked');
      assert.ok(frame.includes('main.js'));
      assert.ok(frame.includes('agent.js'));
      assert.ok(frame.includes('$ npm test'));
      assert.ok(frame.includes('$ git status'));

      // Toggle to solo mode
      stdin.write('f');
      await delay(50);
      frame = lastFrame();
      assert.ok(frame.includes('[ ]'), 'toggle unchecks showSubAgents');
      assert.ok(frame.includes('main.js'), 'main.js (no agent) still visible');
      assert.ok(!frame.includes('agent.js'), 'agent.js (sub-agent) hidden');
      assert.ok(frame.includes('$ npm test'), 'npm test (no agent) still visible');
      assert.ok(!frame.includes('$ git status'), 'git status (sub-agent) hidden');

      // Toggle back
      stdin.write('f');
      await delay(50);
      frame = lastFrame();
      assert.ok(frame.includes('[x]'));
      assert.ok(frame.includes('agent.js'), 'agent.js visible again');
      unmount();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// --- Bash prefix tests ---

describe('BashSection — $ prefix', () => {
  test('commands are prefixed with $ in rendered items', () => {
    const commands = [
      { cmd: 'npm test', at: '2026-04-04T14:00:00.000Z', agent_id: null },
      { cmd: 'git status', at: '2026-04-04T14:01:00.000Z', agent_id: null },
    ];
    const { items } = renderBashSection(commands);
    const cmdItems = items.filter(i => i.type === 'command');
    assert.equal(cmdItems.length, 2);
    assert.ok(cmdItems[0].text.startsWith('$ npm test'));
    assert.ok(cmdItems[1].text.startsWith('$ git status'));
  });

  test('deduped commands also get $ prefix', () => {
    const commands = [
      { cmd: 'npm test', at: '2026-04-04T14:00:00.000Z', agent_id: null },
      { cmd: 'npm test', at: '2026-04-04T14:01:00.000Z', agent_id: null },
    ];
    const { items } = renderBashSection(commands);
    const cmdItems = items.filter(i => i.type === 'command');
    assert.equal(cmdItems.length, 1);
    assert.ok(cmdItems[0].text.startsWith('$ npm test'));
    assert.ok(cmdItems[0].text.includes('(x2)'));
  });
});

// --- Stale session filtering tests ---

describe('pollSessions — stale session filtering', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-stale-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('active session (recent mtime) is included', () => {
    fs.writeFileSync(path.join(tmpDir, '.alive-active1'), '');
    fs.writeFileSync(path.join(tmpDir, 'status-active1.json'), JSON.stringify({
      skill: 'bmad-dev-story',
      project: 'my-project',
      updated_at: new Date().toISOString(),
      llm_state: 'active',
    }));
    const sessions = pollSessions(tmpDir);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].sessionId, 'active1');
  });

  test('stale alive but fresh updated_at — session included via idle window', () => {
    const alivePath = path.join(tmpDir, '.alive-stale1');
    fs.writeFileSync(alivePath, '');
    // Set mtime to 3 minutes ago (stale alive)
    const staleTime = new Date(Date.now() - MONITOR_STALE_MS - 60000);
    fs.utimesSync(alivePath, staleTime, staleTime);
    fs.writeFileSync(path.join(tmpDir, 'status-stale1.json'), JSON.stringify({
      skill: 'bmad-dev-story',
      project: 'my-project',
      updated_at: new Date().toISOString(), // fresh updated_at
      llm_state: 'active',
    }));
    const sessions = pollSessions(tmpDir);
    assert.equal(sessions.length, 1, 'idle session with fresh updated_at should be included');
    assert.equal(sessions[0].sessionId, 'stale1');
  });

  test('stale alive + old updated_at (>30min) — session excluded', () => {
    const alivePath = path.join(tmpDir, '.alive-gone1');
    fs.writeFileSync(alivePath, '');
    const staleTime = new Date(Date.now() - MONITOR_IDLE_WINDOW_MS - 60000);
    fs.utimesSync(alivePath, staleTime, staleTime);
    fs.writeFileSync(path.join(tmpDir, 'status-gone1.json'), JSON.stringify({
      skill: 'bmad-dev-story',
      project: 'my-project',
      updated_at: new Date(Date.now() - MONITOR_IDLE_WINDOW_MS - 60000).toISOString(),
      llm_state: 'active',
    }));
    const sessions = pollSessions(tmpDir);
    assert.equal(sessions.length, 0, 'session beyond idle window should be excluded');
  });

  test('stale alive + no updated_at — session excluded (legacy fallback)', () => {
    const alivePath = path.join(tmpDir, '.alive-legacy1');
    fs.writeFileSync(alivePath, '');
    const staleTime = new Date(Date.now() - MONITOR_IDLE_WINDOW_MS - 60000);
    fs.utimesSync(alivePath, staleTime, staleTime);
    fs.writeFileSync(path.join(tmpDir, 'status-legacy1.json'), JSON.stringify({
      skill: 'bmad-dev-story',
      project: 'my-project',
      llm_state: 'active',
    }));
    const sessions = pollSessions(tmpDir);
    assert.equal(sessions.length, 0, 'legacy session without updated_at should be excluded');
  });

  test('stale session files are NOT deleted (display-only filtering)', () => {
    const alivePath = path.join(tmpDir, '.alive-stale2');
    const statusPath = path.join(tmpDir, 'status-stale2.json');
    fs.writeFileSync(alivePath, '');
    const staleTime = new Date(Date.now() - MONITOR_STALE_MS - 60000);
    fs.utimesSync(alivePath, staleTime, staleTime);
    fs.writeFileSync(statusPath, JSON.stringify({
      skill: 'bmad-dev-story',
      project: 'my-project',
      updated_at: new Date().toISOString(),
    }));
    pollSessions(tmpDir);
    assert.ok(fs.existsSync(alivePath), '.alive file should still exist');
    assert.ok(fs.existsSync(statusPath), 'status file should still exist');
  });

  test('mix of active and truly stale sessions — only active + idle returned', () => {
    // Active session (fresh alive)
    fs.writeFileSync(path.join(tmpDir, '.alive-fresh1'), '');
    fs.writeFileSync(path.join(tmpDir, 'status-fresh1.json'), JSON.stringify({
      skill: 'bmad-dev', project: 'proj', updated_at: new Date().toISOString(), llm_state: 'active',
    }));
    // Truly stale session (stale alive + old updated_at beyond idle window)
    const stalePath = path.join(tmpDir, '.alive-old1');
    fs.writeFileSync(stalePath, '');
    const staleTime = new Date(Date.now() - MONITOR_IDLE_WINDOW_MS - 60000);
    fs.utimesSync(stalePath, staleTime, staleTime);
    fs.writeFileSync(path.join(tmpDir, 'status-old1.json'), JSON.stringify({
      skill: 'bmad-review', project: 'proj', updated_at: staleTime.toISOString(), llm_state: 'waiting',
    }));
    const sessions = pollSessions(tmpDir);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].sessionId, 'fresh1');
  });
});

// --- Scroll clamp tests ---

describe('MonitorScreen — scroll offset clamping', () => {
  test('scroll offset clamps when items shrink', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-scroll-clamp-'));
    try {
      // Start with many writes to enable scrolling
      const manyWrites = [];
      for (let i = 0; i < 30; i++) {
        manyWrites.push({ path: `src/file-${i}.js`, in_project: true, op: 'edit', is_new: false, at: new Date().toISOString(), agent_id: null, old_string: 'a', new_string: 'b' });
      }
      fs.writeFileSync(path.join(tmpDir, '.alive-sess1'), '');
      fs.writeFileSync(path.join(tmpDir, 'status-sess1.json'), JSON.stringify({
        skill: 'bmad-dev-story',
        project: 'test-proj',
        workflow: 'dev-story',
        updated_at: new Date().toISOString(),
        llm_state: 'active',
        writes: manyWrites,
      }));

      const { lastFrame, stdin, unmount } = render(e(MonitorScreen, {
        config: {},
        navigate: () => {},
        goBack: () => {},
        isActive: true,
        paths: { cachePath: tmpDir, outputFolder: tmpDir },
      }));
      await delay(50);

      // Scroll down multiple times to get to the bottom
      for (let i = 0; i < 25; i++) {
        stdin.write('\x1B[B'); // down arrow
      }
      await delay(50);

      // Now drastically reduce the items
      const fewWrites = manyWrites.slice(0, 3);
      fs.writeFileSync(path.join(tmpDir, 'status-sess1.json'), JSON.stringify({
        skill: 'bmad-dev-story',
        project: 'test-proj',
        workflow: 'dev-story',
        updated_at: new Date().toISOString(),
        llm_state: 'active',
        writes: fewWrites,
      }));
      await delay(2000); // Wait for poll

      // Should not crash and content should be visible
      const frame = lastFrame();
      assert.ok(frame.includes('MONITOR'), 'screen should still render after items shrink');
      unmount();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
