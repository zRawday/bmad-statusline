// tui-app.test.js — Tests for v2 App shell, state model, and HomeScreen

import { describe, test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { render } from 'ink-testing-library';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { HomeScreen } from '../src/tui/screens/HomeScreen.js';
import { App, cleanOrphanedStatusFiles } from '../src/tui/app.js';
import { createDefaultConfig } from '../src/tui/widget-registry.js';

const e = React.createElement;

let tmpDirs = [];
function makeTmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tui-app-test-'));
  tmpDirs.push(dir);
  return dir;
}

function makePathsWithConfig(config) {
  const tmpDir = makeTmpDir();
  const internalDir = path.join(tmpDir, 'internal');
  fs.mkdirSync(internalDir, { recursive: true });
  fs.writeFileSync(path.join(internalDir, 'config.json'), JSON.stringify(config, null, 2), 'utf8');
  return {
    internalConfig: path.join(internalDir, 'config.json'),
    ccstatuslineConfig: path.join(tmpDir, 'nonexistent.json'),
  };
}

afterEach(() => {
  for (const dir of tmpDirs) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
  tmpDirs = [];
});

describe('HomeScreen v2', () => {
  const mockConfig = createDefaultConfig();

  test('renders 6 v2 menu options', () => {
    const { lastFrame } = render(e(HomeScreen, {
      config: mockConfig,
      previewOverride: null,
      navigate: () => {},
      resetToOriginal: () => {},
      onQuit: () => {},
      isActive: true,
    }));
    const frame = lastFrame();
    assert.ok(frame.includes('Edit widget line 1'), 'Edit line 1');
    assert.ok(frame.includes('Edit widget line 2'), 'Edit line 2');
    assert.ok(frame.includes('Edit widget line 3'), 'Edit line 3');
    assert.ok(frame.includes('Reorder lines'), 'Reorder lines');
    assert.ok(frame.includes('Separator style'), 'Separator style');
    assert.ok(frame.includes('Reset to original'), 'Reset');
  });

  test('home screen shows screen name label', () => {
    const { lastFrame } = render(e(HomeScreen, {
      config: mockConfig,
      previewOverride: null,
      navigate: () => {},
      resetToOriginal: () => {},
      onQuit: () => {},
      isActive: true,
    }));
    const frame = lastFrame();
    assert.ok(!frame.includes('Home >'), 'no breadcrumb');
    assert.ok(frame.includes('Home'), 'screen name label shown');
  });

  test('renders ThreeLinePreview', () => {
    const { lastFrame } = render(e(HomeScreen, {
      config: mockConfig,
      previewOverride: null,
      navigate: () => {},
      resetToOriginal: () => {},
      onQuit: () => {},
      isActive: true,
    }));
    assert.ok(lastFrame().includes('Preview'), 'preview label');
    assert.ok(lastFrame().includes('myproject'), 'preview shows sample value');
  });

  test('q key calls onQuit', () => {
    let quitCalled = false;
    const { stdin } = render(e(HomeScreen, {
      config: mockConfig,
      previewOverride: null,
      navigate: () => {},
      resetToOriginal: () => {},
      onQuit: () => { quitCalled = true; },
      isActive: true,
    }));
    stdin.write('q');
    assert.ok(quitCalled);
  });

  test('navigation calls navigate with editLine context', async () => {
    let navigatedTo = null;
    let navContext = null;
    const { stdin } = render(e(HomeScreen, {
      config: mockConfig,
      previewOverride: null,
      navigate: (screen, ctx) => { navigatedTo = screen; navContext = ctx; },
      resetToOriginal: () => {},
      onQuit: () => {},
      isActive: true,
    }));
    // First option is Monitor, arrow down to Edit widget line 1
    await act(async () => { stdin.write('\x1B[B'); });
    await act(async () => { stdin.write('\r'); });
    assert.equal(navigatedTo, 'editLine');
    assert.deepStrictEqual(navContext, { editingLine: 0 });
  });

  test('Reset to original calls resetToOriginal', async () => {
    let resetCalled = false;
    const { stdin } = render(e(HomeScreen, {
      config: mockConfig,
      previewOverride: null,
      navigate: () => {},
      resetToOriginal: () => { resetCalled = true; },
      onQuit: () => {},
      isActive: true,
    }));
    // Navigate down to Reset (6 arrow-downs: Monitor→edit1→2→3→reorder→separator→reset, seps skipped)
    for (let i = 0; i < 6; i++) {
      await act(async () => { stdin.write('\x1B[B'); });
    }
    await act(async () => { stdin.write('\r'); });
    assert.ok(resetCalled);
  });
});

describe('App v2 — state model', () => {
  test('loads default config and shows Home screen with v2 options', async () => {
    const tmpDir = makeTmpDir();
    const paths = {
      internalConfig: path.join(tmpDir, 'internal', 'config.json'),
      ccstatuslineConfig: path.join(tmpDir, 'nonexistent.json'),
    };
    const { lastFrame, unmount } = render(e(App, { paths }));
    const frame = lastFrame();
    assert.ok(frame.includes('Edit widget line 1'), 'v2 menu option');
    assert.ok(frame.includes('Preview'), 'preview displayed');
    unmount();
  });

  test('falls back to defaults on corrupted config.json', async () => {
    const tmpDir = makeTmpDir();
    const internalDir = path.join(tmpDir, 'internal');
    fs.mkdirSync(internalDir, { recursive: true });
    fs.writeFileSync(path.join(internalDir, 'config.json'), '{ invalid json !!!', 'utf8');
    const paths = { internalConfig: path.join(internalDir, 'config.json'), ccstatuslineConfig: path.join(tmpDir, 'nonexistent.json') };
    const { lastFrame, unmount } = render(e(App, { paths }));
    const frame = lastFrame();
    assert.ok(frame.includes('Edit widget line 1'), 'shows Home with defaults');
    assert.ok(frame.includes('Preview'), 'preview displayed');
    unmount();
  });

  test('updateConfig produces correct v2 shape', async () => {
    const config = createDefaultConfig();
    const paths = makePathsWithConfig(config);
    const { lastFrame, unmount } = render(e(App, { paths }));
    // Verify config was written correctly by checking internal config file
    const written = JSON.parse(fs.readFileSync(paths.internalConfig, 'utf8'));
    assert.ok(Array.isArray(written.lines), 'lines is array');
    assert.equal(written.lines.length, 3, '3 lines');
    assert.ok(Array.isArray(written.lines[0].widgets), 'widgets is array');
    assert.ok(typeof written.lines[0].colorModes === 'object', 'colorModes is object');
    unmount();
  });

  test('resetToOriginal restores snapshot', async () => {
    const config = createDefaultConfig();
    const paths = makePathsWithConfig(config);
    const { stdin, lastFrame, unmount } = render(e(App, { paths }));

    // Navigate to separator (5 downs: Monitor→editLine1→2→3→reorder→separator, seps skipped)
    for (let i = 0; i < 5; i++) {
      await act(async () => { stdin.write('\x1B[B'); });
    }
    await act(async () => { stdin.write('\r'); });

    // Select 'large' separator (down 1 from 'modere' default, enter)
    await act(async () => { stdin.write('\x1B[B'); });
    await act(async () => { stdin.write('\r'); });

    // Wait for debounced config write (300ms debounce in app.js)
    await act(async () => { await new Promise(r => setTimeout(r, 400)); });

    // Separator auto-returns to home after selection
    // Verify change was written
    const afterChange = JSON.parse(fs.readFileSync(paths.internalConfig, 'utf8'));
    assert.equal(afterChange.separator, 'large', 'separator changed');

    // Select Reset (6 downs: Monitor→editLine1→2→3→reorder→separator→reset, seps skipped)
    for (let i = 0; i < 6; i++) {
      await act(async () => { stdin.write('\x1B[B'); });
    }
    await act(async () => { stdin.write('\r'); });

    // Wait for debounced config write
    await act(async () => { await new Promise(r => setTimeout(r, 400)); });

    // Verify reset restored original
    const afterReset = JSON.parse(fs.readFileSync(paths.internalConfig, 'utf8'));
    assert.equal(afterReset.separator, 'modere', 'separator restored to original');
    unmount();
  });

  test('navigation push/pop and previewOverride cleared on goBack', async () => {
    const config = createDefaultConfig();
    const paths = makePathsWithConfig(config);
    const { stdin, lastFrame, unmount } = render(e(App, { paths }));

    // Navigate to separator (5 downs: Monitor → Edit1 → Edit2 → Edit3 → Reorder → Separator)
    for (let i = 0; i < 5; i++) {
      await act(async () => { stdin.write('\x1B[B'); });
    }
    await act(async () => { stdin.write('\r'); });

    // Should show Separator Style screen name label
    const sepFrame = lastFrame();
    assert.ok(sepFrame.includes('Separator Style'), 'navigated to separator');

    // Go back
    await act(async () => { stdin.write('\x1B'); });

    // Should be back at Home
    const homeFrame = lastFrame();
    assert.ok(homeFrame.includes('Edit widget line 1'), 'back at Home');
    unmount();
  });
});

describe('cleanOrphanedStatusFiles', () => {
  test('deletes orphaned status files older than 7 days', () => {
    const cacheDir = makeTmpDir();
    // Old orphan (no alive, mtime > 7 days)
    const statusPath = path.join(cacheDir, 'status-old.json');
    fs.writeFileSync(statusPath, '{}');
    const pastMs = Date.now() - (8 * 24 * 60 * 60 * 1000);
    const pastSec = pastMs / 1000;
    fs.utimesSync(statusPath, pastSec, pastSec);

    cleanOrphanedStatusFiles(cacheDir);

    assert.ok(!fs.existsSync(statusPath), 'old orphan should be deleted');
  });

  test('preserves recent orphaned status files', () => {
    const cacheDir = makeTmpDir();
    // Recent orphan (no alive, mtime is now)
    const statusPath = path.join(cacheDir, 'status-recent.json');
    fs.writeFileSync(statusPath, '{}');

    cleanOrphanedStatusFiles(cacheDir);

    assert.ok(fs.existsSync(statusPath), 'recent orphan should be kept');
  });

  test('preserves status files that have a matching alive file', () => {
    const cacheDir = makeTmpDir();
    // Old status WITH alive — not orphaned
    const statusPath = path.join(cacheDir, 'status-paired.json');
    fs.writeFileSync(statusPath, '{}');
    fs.writeFileSync(path.join(cacheDir, '.alive-paired'), '12345');
    const pastMs = Date.now() - (8 * 24 * 60 * 60 * 1000);
    const pastSec = pastMs / 1000;
    fs.utimesSync(statusPath, pastSec, pastSec);

    cleanOrphanedStatusFiles(cacheDir);

    assert.ok(fs.existsSync(statusPath), 'paired status should not be touched');
  });

  test('does not throw on missing cache directory', () => {
    const missingDir = path.join(os.tmpdir(), 'nonexistent-cleanup-test-' + Date.now());
    assert.doesNotThrow(() => cleanOrphanedStatusFiles(missingDir));
  });
});
