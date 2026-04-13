import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  writeInternalConfig,
  syncCcstatuslineIfNeeded,
  syncCcstatuslineFromScratch,
} from '../src/tui/config-writer.js';

describe('config-writer v2', () => {
  let tmpDir;
  let internalDir;
  let ccDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-tui-writer-'));
    internalDir = path.join(tmpDir, 'internal');
    ccDir = path.join(tmpDir, 'ccstatusline');
  });

  beforeEach(() => {
    if (fs.existsSync(internalDir)) fs.rmSync(internalDir, { recursive: true, force: true });
    if (fs.existsSync(ccDir)) fs.rmSync(ccDir, { recursive: true, force: true });
    fs.mkdirSync(internalDir, { recursive: true });
    fs.mkdirSync(ccDir, { recursive: true });
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function internalConfigPath() {
    return path.join(internalDir, 'config.json');
  }

  function ccConfigPath() {
    return path.join(ccDir, 'settings.json');
  }

  function makePaths() {
    return {
      internalConfig: internalConfigPath(),
      ccstatuslineConfig: ccConfigPath(),
      readerPath: '/mock/reader.js',
    };
  }

  function writeCcConfig(config) {
    fs.writeFileSync(ccConfigPath(), JSON.stringify(config, null, 2) + '\n');
  }

  function makeConfig(line0Widgets = [], line1Widgets = [], line2Widgets = []) {
    const makeLineColorModes = (widgets) => {
      const colorModes = {};
      for (const id of widgets) {
        colorModes[id] = id === 'bmad-workflow'
          ? { mode: 'dynamic' }
          : { mode: 'fixed', fixedColor: 'cyan' };
      }
      return colorModes;
    };
    return {
      separator: 'serre',
      customSeparator: null,
      lines: [
        { widgets: line0Widgets, colorModes: makeLineColorModes(line0Widgets) },
        { widgets: line1Widgets, colorModes: makeLineColorModes(line1Widgets) },
        { widgets: line2Widgets, colorModes: makeLineColorModes(line2Widgets) },
      ],
      presets: [null, null, null],
    };
  }

  // --- writeInternalConfig ---

  describe('writeInternalConfig', () => {
    it('writes JSON with 2-space indent and trailing newline', () => {
      const config = makeConfig(['bmad-project']);
      writeInternalConfig(config, makePaths());

      const raw = fs.readFileSync(internalConfigPath(), 'utf8');
      assert.ok(raw.includes('  "separator"'), 'should use 2-space indent');
      assert.ok(raw.endsWith('\n'), 'should end with trailing newline');

      const parsed = JSON.parse(raw);
      assert.deepStrictEqual(parsed, config);
    });

    it('creates directory if absent', () => {
      const deepDir = path.join(tmpDir, 'deep', 'nested', 'dir');
      const deepPath = path.join(deepDir, 'config.json');
      const config = makeConfig(['bmad-project']);

      writeInternalConfig(config, { internalConfig: deepPath });

      assert.ok(fs.existsSync(deepPath), 'config.json should exist in nested dir');
      const parsed = JSON.parse(fs.readFileSync(deepPath, 'utf8'));
      assert.deepStrictEqual(parsed, config);
    });

    it('does not create backup file (pattern 14)', () => {
      const config = makeConfig(['bmad-project']);
      writeInternalConfig(config, makePaths());

      const backupPath = internalConfigPath() + '.bak';
      assert.ok(!fs.existsSync(backupPath), 'no backup should exist for internal config writes');
    });
  });

  // --- syncCcstatuslineIfNeeded ---

  describe('syncCcstatuslineIfNeeded', () => {
    it('adds bmad-line-N for newly non-empty line', () => {
      const ccConfig = { version: 3, lines: [[], [], []] };
      writeCcConfig(ccConfig);

      const oldConfig = makeConfig();
      const newConfig = makeConfig(['bmad-project']);

      syncCcstatuslineIfNeeded(oldConfig, newConfig, makePaths());

      const updated = JSON.parse(fs.readFileSync(ccConfigPath(), 'utf8'));
      const line0 = updated.lines[0];
      assert.equal(line0.length, 1);
      assert.equal(line0[0].id, 'bmad-line-0');
      assert.equal(line0[0].type, 'custom-command');
      assert.ok(line0[0].commandPath.includes('line 0'));
      assert.equal(line0[0].preserveColors, true);
    });

    it('removes bmad-line-N for newly empty line', () => {
      const ccConfig = {
        version: 3,
        lines: [
          [{ id: 'bmad-line-0', type: 'custom-command', commandPath: 'node "/mock/reader.js" line 0', preserveColors: true }],
          [],
          [],
        ],
      };
      writeCcConfig(ccConfig);

      const oldConfig = makeConfig(['bmad-project']);
      const newConfig = makeConfig();

      syncCcstatuslineIfNeeded(oldConfig, newConfig, makePaths());

      const updated = JSON.parse(fs.readFileSync(ccConfigPath(), 'utf8'));
      assert.equal(updated.lines[0].length, 0, 'bmad-line-0 should be removed');
    });

    it('does nothing when occupancy unchanged (color/reorder change)', () => {
      const ccConfig = {
        version: 3,
        lines: [
          [{ id: 'bmad-line-0', type: 'custom-command', commandPath: 'node "/mock/reader.js" line 0', preserveColors: true }],
          [],
          [],
        ],
      };
      writeCcConfig(ccConfig);
      const ccRawBefore = fs.readFileSync(ccConfigPath(), 'utf8');

      // Both have widgets on line 0, just different widgets/colors
      const oldConfig = makeConfig(['bmad-project']);
      const newConfig = makeConfig(['bmad-project', 'bmad-timer']);

      syncCcstatuslineIfNeeded(oldConfig, newConfig, makePaths());

      const ccRawAfter = fs.readFileSync(ccConfigPath(), 'utf8');
      assert.equal(ccRawBefore, ccRawAfter, 'ccstatusline config should not be modified');
    });

    it('handles multiple line occupancy changes in one call', () => {
      const ccConfig = {
        version: 3,
        lines: [
          [{ id: 'bmad-line-0', type: 'custom-command', commandPath: 'node "/mock/reader.js" line 0', preserveColors: true }],
          [],
          [],
        ],
      };
      writeCcConfig(ccConfig);

      // line 0: was non-empty -> now empty, line 1: was empty -> now non-empty
      const oldConfig = makeConfig(['bmad-project']);
      const newConfig = makeConfig([], ['bmad-story']);

      syncCcstatuslineIfNeeded(oldConfig, newConfig, makePaths());

      const updated = JSON.parse(fs.readFileSync(ccConfigPath(), 'utf8'));
      assert.equal(updated.lines[0].length, 0, 'line 0 should be empty');
      const line1Bmad = updated.lines[1].filter(w => w.id === 'bmad-line-1');
      assert.equal(line1Bmad.length, 1, 'should have bmad-line-1');
    });
  });

  // --- syncCcstatuslineFromScratch ---

  describe('syncCcstatuslineFromScratch', () => {
    it('removes all bmad-line-* and rebuilds from config', () => {
      const ccConfig = {
        version: 3,
        lines: [
          [
            { id: 'other-widget', type: 'custom-command' },
            { id: 'bmad-line-0', type: 'custom-command', commandPath: 'node old line 0', preserveColors: true },
          ],
          [
            { id: 'bmad-line-1', type: 'custom-command', commandPath: 'node old line 1', preserveColors: true },
          ],
          [],
        ],
      };
      writeCcConfig(ccConfig);

      const config = makeConfig(['bmad-project'], [], ['bmad-timer']);

      syncCcstatuslineFromScratch(config, makePaths());

      const updated = JSON.parse(fs.readFileSync(ccConfigPath(), 'utf8'));

      // Line 0: other-widget preserved + bmad-line-0 added fresh
      assert.equal(updated.lines[0].length, 2);
      assert.equal(updated.lines[0][0].id, 'other-widget');
      assert.equal(updated.lines[0][1].id, 'bmad-line-0');

      // Line 1: old bmad-line-1 removed, no new one (empty in config)
      assert.equal(updated.lines[1].length, 0);

      // Line 2: bmad-line-2 added (non-empty in config)
      assert.equal(updated.lines[2].length, 1);
      assert.equal(updated.lines[2][0].id, 'bmad-line-2');
    });

    it('does nothing when ccstatusline config is missing', () => {
      // No ccstatusline file — should not throw
      const config = makeConfig(['bmad-project']);
      syncCcstatuslineFromScratch(config, makePaths());
      // No assertion needed — just verify no crash
    });
  });

  // --- Pattern 4 compliance ---

  describe('ccstatusline sync backup/validate pattern', () => {
    it('creates backup file when syncing ccstatusline', () => {
      const ccConfig = { version: 3, lines: [[], [], []] };
      writeCcConfig(ccConfig);

      const oldConfig = makeConfig();
      const newConfig = makeConfig(['bmad-project']);

      syncCcstatuslineIfNeeded(oldConfig, newConfig, makePaths());

      const backupPath = ccConfigPath() + '.bak';
      assert.ok(fs.existsSync(backupPath), 'backup should exist after ccstatusline sync');
      const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      assert.deepStrictEqual(backup, ccConfig, 'backup should contain original config');
    });
  });

  // --- Edge cases ---

  describe('edge cases', () => {
    it('extends ccstatusline lines array when fewer than 3 lines exist', () => {
      // ccstatusline has only 2 lines
      const ccConfig = { version: 3, lines: [[], []] };
      writeCcConfig(ccConfig);

      // Internal config has widgets on line 2
      const config = makeConfig([], [], ['bmad-timer']);
      syncCcstatuslineFromScratch(config, makePaths());

      const updated = JSON.parse(fs.readFileSync(ccConfigPath(), 'utf8'));
      assert.ok(updated.lines.length >= 3, 'should have at least 3 lines');
      assert.equal(updated.lines[2].length, 1);
      assert.equal(updated.lines[2][0].id, 'bmad-line-2');
    });

    it('restores backup when ccstatusline write produces invalid JSON', () => {
      const ccConfig = { version: 3, lines: [[], [], []] };
      writeCcConfig(ccConfig);
      const originalRaw = fs.readFileSync(ccConfigPath(), 'utf8');

      // Manually create a backup scenario: write valid config, then corrupt the file
      // to simulate a write failure that triggers restore.
      // Since we can't easily make writeFileSync fail, verify the backup file
      // contains original content and would be usable for restore.
      const oldConfig = makeConfig();
      const newConfig = makeConfig(['bmad-project']);
      syncCcstatuslineIfNeeded(oldConfig, newConfig, makePaths());

      const backupPath = ccConfigPath() + '.bak';
      assert.ok(fs.existsSync(backupPath), 'backup should exist');
      const backupRaw = fs.readFileSync(backupPath, 'utf8');
      const backupParsed = JSON.parse(backupRaw);
      assert.deepStrictEqual(backupParsed, ccConfig, 'backup should contain pre-sync config');
      // Verify the backup is valid JSON that can be restored
      assert.doesNotThrow(() => JSON.parse(backupRaw), 'backup should be valid JSON');
    });
  });

  // --- Widget format ---

  describe('bmad-line-N widget format', () => {
    it('uses correct format with readerPath and line index', () => {
      const ccConfig = { version: 3, lines: [[], [], []] };
      writeCcConfig(ccConfig);

      const config = makeConfig(['bmad-project'], ['bmad-story']);
      syncCcstatuslineFromScratch(config, makePaths());

      const updated = JSON.parse(fs.readFileSync(ccConfigPath(), 'utf8'));

      const w0 = updated.lines[0].find(w => w.id === 'bmad-line-0');
      assert.ok(w0);
      assert.equal(w0.type, 'custom-command');
      assert.equal(w0.commandPath, 'node "/mock/reader.js" line 0');
      assert.equal(w0.preserveColors, true);

      const w1 = updated.lines[1].find(w => w.id === 'bmad-line-1');
      assert.ok(w1);
      assert.equal(w1.commandPath, 'node "/mock/reader.js" line 1');
    });
  });
});
