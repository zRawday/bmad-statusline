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
    // Monitor → Weekly usage → Edit widget line 1 (2 arrow-downs, seps skipped)
    await act(async () => { stdin.write('\x1B[B'); });
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
    // Navigate down to Reset (7 arrow-downs: Monitor→weeklyUsage→edit1→2→3→reorder→separator→reset, seps skipped)
    for (let i = 0; i < 7; i++) {
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

    // Navigate to separator (6 downs: Monitor→weeklyUsage→editLine1→2→3→reorder→separator, seps skipped)
    for (let i = 0; i < 6; i++) {
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

    // Select Reset (7 downs: Monitor→weeklyUsage→editLine1→2→3→reorder→separator→reset, seps skipped)
    for (let i = 0; i < 7; i++) {
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

    // Navigate to separator (6 downs: Monitor → weeklyUsage → Edit1 → Edit2 → Edit3 → Reorder → Separator)
    for (let i = 0; i < 6; i++) {
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


// ─── Auto-allow global flag — App-owned round trip ──────────────────────────
// Regression guard for the defect where AutoAllowMenu wrote config.json directly:
// App loads the config at startup and full-replaces the file on quit, so the direct
// write was silently undone. The disabling direction is the dangerous one — the user
// believes machine-wide auto-approval is off while the hook keeps allowing.

describe('App — auto-allow global flag persistence', () => {
  function seedSession(cacheDir, id) {
    fs.writeFileSync(path.join(cacheDir, '.alive-' + id), '');
    fs.writeFileSync(path.join(cacheDir, 'status-' + id + '.json'), JSON.stringify({
      skill: 'bmad-dev', project: 'alpha', workflow: 'dev-story',
      updated_at: new Date().toISOString(), llm_state: 'active',
    }));
  }

  // Drives the real App: Home -> Monitor -> auto-allow menu -> toggle Always ->
  // Esc (close menu) -> Esc (back Home) -> q (quit, which full-replaces config.json).
  async function toggleAlwaysAndQuit(paths, cacheDir) {
    const prevCache = process.env.BMAD_CACHE_DIR;
    process.env.BMAD_CACHE_DIR = cacheDir;
    try {
      const { stdin, lastFrame, unmount } = render(e(App, { paths }));
      // unmount in finally: MonitorScreen polls on an interval, so an assertion
      // failure here would otherwise hang the test runner instead of reporting.
      try {
        await act(async () => { stdin.write('\r'); });          // Enter on "Monitor"
        await act(async () => {});                              // let polling land
        assert.ok(lastFrame().includes('MONITOR'), 'monitor screen open');

        await act(async () => { stdin.write('a'); });            // open auto-allow menu
        assert.ok(lastFrame().includes('WARNING'), 'auto-allow menu open');

        await act(async () => { stdin.write('\u001B[B'); });     // cursor -> "Always"
        await act(async () => { stdin.write('\r'); });           // toggle
        await act(async () => { stdin.write('\u001B'); });       // Esc closes menu
        await act(async () => { stdin.write('\u001B'); });       // Esc back to Home
        await act(async () => { stdin.write('q'); });            // quit -> writeInternalConfig
        await act(async () => { await new Promise(r => setTimeout(r, 50)); });
      } finally {
        unmount();
      }
    } finally {
      if (prevCache === undefined) delete process.env.BMAD_CACHE_DIR;
      else process.env.BMAD_CACHE_DIR = prevCache;
    }
    return JSON.parse(fs.readFileSync(paths.internalConfig, 'utf8'));
  }

  test('enabling Always survives quitting the TUI', async () => {
    const cacheDir = makeTmpDir();
    seedSession(cacheDir, 'appaa1');
    const paths = makePathsWithConfig(createDefaultConfig());
    const written = await toggleAlwaysAndQuit(paths, cacheDir);
    assert.equal(written.autoAllow, true, 'autoAllow must persist as true after quit');
  });

  test('disabling Always survives quitting the TUI (safety-critical direction)', async () => {
    const cacheDir = makeTmpDir();
    seedSession(cacheDir, 'appaa2');
    const config = createDefaultConfig();
    config.autoAllow = true;
    const paths = makePathsWithConfig(config);
    const written = await toggleAlwaysAndQuit(paths, cacheDir);
    assert.equal(written.autoAllow, false,
      'turning auto-allow off must not be reverted to true by the App config write');
  });

  test('toggling Always leaves the rest of the config intact', async () => {
    const cacheDir = makeTmpDir();
    seedSession(cacheDir, 'appaa3');
    const config = createDefaultConfig();
    const paths = makePathsWithConfig(config);
    const written = await toggleAlwaysAndQuit(paths, cacheDir);
    assert.equal(written.autoAllow, true);
    assert.equal(written.lines.length, 3, 'widget layout preserved');
    assert.deepEqual(written.lines[0].widgets, config.lines[0].widgets, 'line 1 widgets preserved');
    assert.equal(written.separator, config.separator, 'separator preserved');
  });

  test('the flag is committed immediately, not left in the debounce window', async () => {
    // A signal-driven exit inside the 300ms debounce must not lose a permission flag.
    const cacheDir = makeTmpDir();
    seedSession(cacheDir, 'appaa4');
    const paths = makePathsWithConfig(createDefaultConfig());
    const prevCache = process.env.BMAD_CACHE_DIR;
    process.env.BMAD_CACHE_DIR = cacheDir;
    try {
      const { stdin, unmount } = render(e(App, { paths }));
      try {
        await act(async () => { stdin.write('\r'); });
        await act(async () => {});
        await act(async () => { stdin.write('a'); });
        await act(async () => { stdin.write('\u001B[B'); });
        await act(async () => { stdin.write('\r'); });
        // No quit, no debounce wait — the value must already be on disk.
        const written = JSON.parse(fs.readFileSync(paths.internalConfig, 'utf8'));
        assert.equal(written.autoAllow, true, 'autoAllow must be written in the same tick');
      } finally {
        unmount();
      }
    } finally {
      if (prevCache === undefined) delete process.env.BMAD_CACHE_DIR;
      else process.env.BMAD_CACHE_DIR = prevCache;
    }
  });
});
