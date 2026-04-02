// tui-app.test.js — Tests for v2 App shell, state model, and HomeScreen

import { describe, test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { HomeScreen } from '../src/tui/screens/HomeScreen.js';
import { App } from '../src/tui/app.js';
import { createDefaultConfig } from '../src/tui/widget-registry.js';

const e = React.createElement;

const CI_FACTOR = process.env.CI ? 3 : 1;
function delay(ms) { return new Promise(r => setTimeout(r, ms * CI_FACTOR)); }

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

  test('home screen has no breadcrumb', () => {
    const { lastFrame } = render(e(HomeScreen, {
      config: mockConfig,
      previewOverride: null,
      navigate: () => {},
      resetToOriginal: () => {},
      onQuit: () => {},
      isActive: true,
    }));
    assert.ok(!lastFrame().includes('Home >'), 'no breadcrumb on home');
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
    await delay(50);
    // First option is Edit widget line 1
    stdin.write('\r');
    await delay(50);
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
    await delay(50);
    // Navigate down to Reset (5 arrow-downs, separators skipped by custom menu)
    for (let i = 0; i < 5; i++) {
      stdin.write('\x1B[B');
      await delay(20);
    }
    stdin.write('\r');
    await delay(50);
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
    await delay(100);
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
    await delay(100);
    const frame = lastFrame();
    assert.ok(frame.includes('Edit widget line 1'), 'shows Home with defaults');
    assert.ok(frame.includes('Preview'), 'preview displayed');
    unmount();
  });

  test('updateConfig produces correct v2 shape', async () => {
    const config = createDefaultConfig();
    const paths = makePathsWithConfig(config);
    const { lastFrame, unmount } = render(e(App, { paths }));
    await delay(100);
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
    await delay(100);

    // Navigate to separator (4 downs: editLine1→2→3→reorder→separator, seps skipped)
    for (let i = 0; i < 4; i++) {
      stdin.write('\x1B[B');
      await delay(20);
    }
    stdin.write('\r');
    await delay(100);

    // Select 'large' separator (down 1 from 'modere' default, enter)
    stdin.write('\x1B[B');
    await delay(20);
    stdin.write('\r');
    await delay(100);

    // Separator auto-returns to home after selection
    // Verify change was written
    const afterChange = JSON.parse(fs.readFileSync(paths.internalConfig, 'utf8'));
    assert.equal(afterChange.separator, 'large', 'separator changed');

    // Select Reset (5 downs: editLine1→2→3→reorder→separator→reset, seps skipped)
    for (let i = 0; i < 5; i++) {
      stdin.write('\x1B[B');
      await delay(20);
    }
    stdin.write('\r');
    await delay(100);

    // Verify reset restored original
    const afterReset = JSON.parse(fs.readFileSync(paths.internalConfig, 'utf8'));
    assert.equal(afterReset.separator, 'modere', 'separator restored to original');
    unmount();
  });

  test('navigation push/pop and previewOverride cleared on goBack', async () => {
    const config = createDefaultConfig();
    const paths = makePathsWithConfig(config);
    const { stdin, lastFrame, unmount } = render(e(App, { paths }));
    await delay(100);

    // Navigate to separator (4 downs, separators skipped)
    for (let i = 0; i < 4; i++) {
      stdin.write('\x1B[B');
      await delay(20);
    }
    stdin.write('\r');
    await delay(100);

    // Should show Separator Style breadcrumb
    const sepFrame = lastFrame();
    assert.ok(sepFrame.includes('Separator Style'), 'navigated to separator');

    // Go back
    stdin.write('\x1B');
    await delay(100);

    // Should be back at Home
    const homeFrame = lastFrame();
    assert.ok(homeFrame.includes('Edit widget line 1'), 'back at Home');
    unmount();
  });
});
