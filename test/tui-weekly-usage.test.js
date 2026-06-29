// tui-weekly-usage.test.js — Tests for WeeklyUsageScreen + Home option/routing

import { describe, test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { render } from 'ink-testing-library';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { WeeklyUsageScreen } from '../src/tui/screens/WeeklyUsageScreen.js';
import { HomeScreen } from '../src/tui/screens/HomeScreen.js';
import { createDefaultConfig } from '../src/tui/widget-registry.js';
import { WEEKDAY_LABELS } from '../src/defaults.js';

const e = React.createElement;

let tmpDirs = [];
function makeTmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tui-weekly-test-'));
  tmpDirs.push(dir);
  return dir;
}

function makeProps(overrides = {}) {
  return {
    config: createDefaultConfig(),
    previewOverride: null,
    goBack: () => {},
    isActive: true,
    paths: { cachePath: makeTmpDir() },
    ...overrides,
  };
}

const flush = async () => { await act(async () => {}); };

afterEach(() => {
  for (const dir of tmpDirs) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
  tmpDirs = [];
});

describe('WeeklyUsageScreen', () => {
  test('(a) populated render shows both bars + zone status line + a weekday label', async () => {
    const tmpDir = makeTmpDir();
    // Deterministic recipe: timePct ≈ 50, used 47 → sweet/blue/SWEET SPOT (margin from 45/50 boundaries)
    const WEEK_MS = 7 * 24 * 3600 * 1000;
    const resetsAtSec = Math.floor((Date.now() + WEEK_MS / 2) / 1000);
    fs.writeFileSync(
      path.join(tmpDir, 'weekly-usage.json'),
      JSON.stringify({ used_percentage: 47, resets_at: resetsAtSec, captured_at: '2026-06-10T00:00:00.000Z' }),
      'utf8',
    );
    let app;
    await act(async () => { app = render(e(WeeklyUsageScreen, makeProps({ paths: { cachePath: tmpDir } }))); });
    await flush();
    const frame = app.lastFrame();
    assert.match(frame, /Weekly: SWEET SPOT/);
    assert.ok(frame.includes('█'), 'has filled block glyphs (both bars)');
    assert.ok(frame.includes('47.0%'), 'percentage with one decimal, no space before %');
    assert.ok(WEEKDAY_LABELS.some(l => frame.includes(l)), 'has at least one day-tick label');
    app.unmount();
  });

  test('(b) empty state shows grey placeholder + waiting message + "--"', async () => {
    const tmpDir = makeTmpDir(); // no weekly-usage.json written
    let app;
    await act(async () => { app = render(e(WeeklyUsageScreen, makeProps({ paths: { cachePath: tmpDir } }))); });
    await flush();
    const frame = app.lastFrame();
    assert.match(frame, /Waiting for usage data/);
    assert.match(frame, /Weekly: --/);
    assert.ok(frame.includes('░'), 'has grey placeholder glyph');
    app.unmount();
  });

  test('(b2) invalid JSON falls back to empty state', async () => {
    const tmpDir = makeTmpDir();
    fs.writeFileSync(path.join(tmpDir, 'weekly-usage.json'), '{ not valid json', 'utf8');
    let app;
    await act(async () => { app = render(e(WeeklyUsageScreen, makeProps({ paths: { cachePath: tmpDir } }))); });
    await flush();
    assert.match(app.lastFrame(), /Waiting for usage data/);
    app.unmount();
  });

  test('(c) Esc calls goBack', async () => {
    const tmpDir = makeTmpDir();
    let backCalled = false;
    let app;
    await act(async () => {
      app = render(e(WeeklyUsageScreen, makeProps({ paths: { cachePath: tmpDir }, goBack: () => { backCalled = true; }, isActive: true })));
    });
    await act(async () => { app.stdin.write('\x1B'); });
    assert.ok(backCalled, 'goBack invoked on Escape');
    app.unmount();
  });

  test('(d) reads cache only — no config writer called, no config file written', async () => {
    const tmpDir = makeTmpDir();
    let updateCalled = false;
    let app;
    await act(async () => {
      app = render(e(WeeklyUsageScreen, makeProps({ paths: { cachePath: tmpDir }, updateConfig: () => { updateCalled = true; } })));
    });
    await flush();
    const files = fs.readdirSync(tmpDir);
    assert.ok(!files.some(f => f.includes('config')), 'no config file written into cache dir');
    assert.equal(updateCalled, false, 'updateConfig is never called (read-only screen)');
    app.unmount();
  });

  test('(e) HomeScreen lists Weekly usage and routes to it', async () => {
    let navigatedTo = null;
    const { stdin, lastFrame, unmount } = render(e(HomeScreen, {
      config: createDefaultConfig(),
      previewOverride: null,
      navigate: (screen) => { navigatedTo = screen; },
      resetToOriginal: () => {},
      onQuit: () => {},
      isActive: true,
    }));
    assert.ok(lastFrame().includes('Weekly usage'), 'Home shows Weekly usage option');
    // Monitor is index 0, Weekly usage is index 1 → 1 down + Enter
    await act(async () => { stdin.write('\x1B[B'); });
    await act(async () => { stdin.write('\r'); });
    assert.equal(navigatedTo, 'weeklyUsage');
    unmount();
  });
});
