import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { loadConfig } from '../src/tui/config-loader.js';

describe('config-loader v2', () => {
  let tmpDir;
  let internalDir;
  let ccDir;
  let originalEnv;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-tui-loader-'));
    internalDir = path.join(tmpDir, 'internal');
    ccDir = path.join(tmpDir, 'ccstatusline');
  });

  beforeEach(() => {
    originalEnv = process.env.BMAD_CONFIG_DIR;
    // Clean dirs between tests
    if (fs.existsSync(internalDir)) fs.rmSync(internalDir, { recursive: true, force: true });
    if (fs.existsSync(ccDir)) fs.rmSync(ccDir, { recursive: true, force: true });
    fs.mkdirSync(internalDir, { recursive: true });
    fs.mkdirSync(ccDir, { recursive: true });
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.BMAD_CONFIG_DIR;
    } else {
      process.env.BMAD_CONFIG_DIR = originalEnv;
    }
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

  function writeInternalConfig(config) {
    fs.writeFileSync(internalConfigPath(), JSON.stringify(config, null, 2) + '\n');
  }

  function writeCcConfig(config) {
    fs.writeFileSync(ccConfigPath(), JSON.stringify(config, null, 2) + '\n');
  }

  // --- AC #1: Valid v2 config loaded directly ---
  it('loads valid v2 config directly when config.json exists with lines array of 3', () => {
    const v2Config = JSON.parse(
      fs.readFileSync(path.join(import.meta.dirname, 'fixtures', 'internal-config-default.json'), 'utf8')
    );
    writeInternalConfig(v2Config);

    const result = loadConfig(makePaths());

    assert.deepStrictEqual(result, v2Config);
  });

  it('loads multiline v2 config with presets', () => {
    const v2Config = JSON.parse(
      fs.readFileSync(path.join(import.meta.dirname, 'fixtures', 'internal-config-multiline.json'), 'utf8')
    );
    writeInternalConfig(v2Config);

    const result = loadConfig(makePaths());

    assert.deepStrictEqual(result, v2Config);
  });

  // --- AC #3: First install ---
  it('creates default config on first install (no config.json, no bmad widgets)', () => {
    const emptyCc = JSON.parse(
      fs.readFileSync(path.join(import.meta.dirname, 'fixtures', 'ccstatusline-settings-empty.json'), 'utf8')
    );
    writeCcConfig(emptyCc);

    const result = loadConfig(makePaths());

    // Should match createDefaultConfig() output
    const defaultConfig = JSON.parse(
      fs.readFileSync(path.join(import.meta.dirname, 'fixtures', 'internal-config-default.json'), 'utf8')
    );
    assert.deepStrictEqual(result, defaultConfig);

    // Should have written config.json
    assert.ok(fs.existsSync(internalConfigPath()), 'config.json should be written on first install');
  });

  it('creates default config when no ccstatusline config exists either', () => {
    // No ccstatusline config file, no internal config file
    const result = loadConfig(makePaths());

    assert.ok(Array.isArray(result.lines));
    assert.equal(result.lines.length, 3);
    assert.ok(result.lines[0].widgets.length > 0, 'default config should have widgets on line 0');
    assert.ok(fs.existsSync(internalConfigPath()), 'config.json should be written');
  });

  // --- AC #4: Corrupted config fallback ---
  it('falls back to createDefaultConfig() on corrupted config.json', () => {
    fs.writeFileSync(internalConfigPath(), '{not valid json!!!');

    const result = loadConfig(makePaths());

    // Should get defaults, not crash
    assert.ok(Array.isArray(result.lines));
    assert.equal(result.lines.length, 3);
    assert.ok(result.lines[0].widgets.length > 0);
  });

  it('falls back to defaults when config.json has invalid v2 structure', () => {
    // Valid JSON but missing lines array
    writeInternalConfig({ version: 1, widgets: ['bmad-compact'] });

    const result = loadConfig(makePaths());

    assert.ok(Array.isArray(result.lines));
    assert.equal(result.lines.length, 3);
  });

  // --- AC #5: alternate internal config path ---
  // Note: BMAD_CONFIG_DIR is evaluated at module load time (ESM constant).
  // In production it works (env set before process start). Here we test
  // the paths.internalConfig override with a non-default fixture.
  it('loads from alternate internal config path (non-default fixture)', () => {
    const altDir = path.join(tmpDir, 'alt-config');
    fs.mkdirSync(altDir, { recursive: true });
    const altConfigPath = path.join(altDir, 'config.json');

    const multiline = JSON.parse(
      fs.readFileSync(path.join(import.meta.dirname, 'fixtures', 'internal-config-multiline.json'), 'utf8')
    );
    fs.writeFileSync(altConfigPath, JSON.stringify(multiline, null, 2) + '\n');

    const result = loadConfig({
      internalConfig: altConfigPath,
      ccstatuslineConfig: ccConfigPath(),
    });

    assert.deepStrictEqual(result, multiline);
    assert.equal(result.separator, 'modere');
    assert.equal(result.lines[1].widgets.length, 2);
  });

  // --- Story + Document → Current Item conversion ---

  describe('conversion of a config saved with the Story and Document widgets', () => {
    const LEGACY_FIXTURE = path.join(import.meta.dirname, 'fixtures', 'internal-config-legacy-story-docname.json');

    function writeRaw(raw) {
      fs.writeFileSync(internalConfigPath(), raw);
    }

    function readDisk() {
      return JSON.parse(fs.readFileSync(internalConfigPath(), 'utf8'));
    }

    it('converts the in-memory config: each line shows Current Item where Story stood', () => {
      writeRaw(fs.readFileSync(LEGACY_FIXTURE, 'utf8'));

      const result = loadConfig(makePaths());

      assert.deepStrictEqual(result.lines[0].widgets, [
        'bmad-project', 'bmad-workflow', 'bmad-activeskill', 'bmad-currentitem', 'bmad-progressstep', 'bmad-timer',
      ]);
      for (const l of result.lines) {
        assert.equal(l.widgetOrder.length, 12);
        assert.equal(l.widgetOrder.indexOf('bmad-currentitem'), 4, 'position of Story kept in widgetOrder, not appended last');
        assert.ok(!l.widgetOrder.includes('bmad-story') && !l.widgetOrder.includes('bmad-docname'));
      }
      assert.deepStrictEqual(result.lines[0].colorModes['bmad-currentitem'], {
        mode: 'fixed', fixedColor: 'magenta', documentColor: 'brightYellow',
      });
    });

    it('copies the original to config.json.bak and writes the converted file at once', () => {
      const raw = fs.readFileSync(LEGACY_FIXTURE, 'utf8');
      writeRaw(raw);

      const result = loadConfig(makePaths());

      assert.equal(fs.readFileSync(internalConfigPath() + '.bak', 'utf8'), raw, '.bak holds the pre-conversion file, byte for byte');
      assert.deepStrictEqual(readDisk(), result, 'the file on disk is the converted config');
      assert.ok(!JSON.stringify(readDisk()).includes('bmad-story'));
      assert.ok(!JSON.stringify(readDisk()).includes('bmad-docname'));
    });

    it('keeps both colors and the story mode of a customized config', () => {
      const cfg = JSON.parse(fs.readFileSync(LEGACY_FIXTURE, 'utf8'));
      cfg.lines[0].colorModes['bmad-story'] = { mode: 'fixed', fixedColor: 'red', displayMode: 'compact' };
      cfg.lines[0].colorModes['bmad-docname'] = { mode: 'fixed', fixedColor: 'blue' };
      writeInternalConfig(cfg);

      const result = loadConfig(makePaths());

      assert.deepStrictEqual(result.lines[0].colorModes['bmad-currentitem'], {
        mode: 'fixed', fixedColor: 'red', documentColor: 'blue', displayMode: 'compact',
      });
      assert.deepStrictEqual(readDisk().lines[0].colorModes['bmad-currentitem'], result.lines[0].colorModes['bmad-currentitem']);
    });

    it('converts presets too', () => {
      const cfg = JSON.parse(fs.readFileSync(LEGACY_FIXTURE, 'utf8'));
      cfg.presets = [
        { name: 'mine', lines: [
          { widgets: ['bmad-project', 'bmad-docname', 'bmad-story'], widgetOrder: ['bmad-docname', 'bmad-project', 'bmad-story'] },
          { widgets: [], widgetOrder: [] },
          { widgets: ['bmad-story'], widgetOrder: ['bmad-story'] },
        ], separator: 'serre', customSeparator: null },
        null,
        { name: 'v1 shape', widgets: ['bmad-story'], colorModes: {} },
      ];
      writeInternalConfig(cfg);

      const result = loadConfig(makePaths());

      assert.deepStrictEqual(result.presets[0].lines[0], { widgets: ['bmad-project', 'bmad-currentitem'], widgetOrder: ['bmad-currentitem', 'bmad-project'] });
      assert.deepStrictEqual(result.presets[0].lines[2], { widgets: ['bmad-currentitem'], widgetOrder: ['bmad-currentitem'] });
      assert.equal(result.presets[1], null);
      assert.deepStrictEqual(result.presets[2], cfg.presets[2], 'malformed preset left alone');
      assert.deepStrictEqual(readDisk().presets, result.presets);
    });

    it('a second load changes nothing: no rewrite, the .bak keeps the original', () => {
      const raw = fs.readFileSync(LEGACY_FIXTURE, 'utf8');
      writeRaw(raw);
      const first = loadConfig(makePaths());
      const onDisk = fs.readFileSync(internalConfigPath(), 'utf8');

      const second = loadConfig(makePaths());

      assert.deepStrictEqual(second, first);
      assert.equal(fs.readFileSync(internalConfigPath(), 'utf8'), onDisk, 'file not rewritten');
      assert.equal(fs.readFileSync(internalConfigPath() + '.bak', 'utf8'), raw, '.bak still the original');
    });

    it('an already converted config is not backed up nor rewritten', () => {
      const current = fs.readFileSync(path.join(import.meta.dirname, 'fixtures', 'internal-config-default.json'), 'utf8');
      writeRaw(current);

      loadConfig(makePaths());

      assert.ok(!fs.existsSync(internalConfigPath() + '.bak'), 'no .bak');
      assert.equal(fs.readFileSync(internalConfigPath(), 'utf8'), current, 'file untouched');
    });

    // A customized legacy config: it does not convert to the default config, so a result
    // carrying these values proves the user's config was converted, not replaced by defaults.
    function writeCustomizedLegacy() {
      const cfg = JSON.parse(fs.readFileSync(LEGACY_FIXTURE, 'utf8'));
      cfg.lines[0].colorModes['bmad-story'] = { mode: 'fixed', fixedColor: 'red', displayMode: 'compact' };
      cfg.lines[0].colorModes['bmad-docname'] = { mode: 'fixed', fixedColor: 'blue' };
      writeInternalConfig(cfg);
      return fs.readFileSync(internalConfigPath(), 'utf8');
    }

    function assertConvertedInMemory(result) {
      assert.deepStrictEqual(result.lines[0].colorModes['bmad-currentitem'], {
        mode: 'fixed', fixedColor: 'red', documentColor: 'blue', displayMode: 'compact',
      });
      assert.ok(result.lines[0].widgets.includes('bmad-currentitem'));
      assert.ok(!result.lines[0].widgets.includes('bmad-story'));
      assert.ok(!fs.existsSync(internalConfigPath() + '.corrupt'), 'not treated as a corrupt config');
    }

    it('a backup failure is silent: the config is still converted in memory, the file stays as it was', () => {
      const raw = writeCustomizedLegacy();
      fs.mkdirSync(internalConfigPath() + '.bak'); // a directory in the way: copyFileSync fails

      let result;
      assert.doesNotThrow(() => { result = loadConfig(makePaths()); });

      assertConvertedInMemory(result);
      assert.equal(fs.readFileSync(internalConfigPath(), 'utf8'), raw, 'original not overwritten without a backup');
    });

    it('a write failure is silent: the config is still converted in memory, the file stays as it was', () => {
      const raw = writeCustomizedLegacy();
      // The writer goes through config.json.tmp: a directory there makes the write fail
      fs.mkdirSync(internalConfigPath() + '.tmp');

      let result;
      assert.doesNotThrow(() => { result = loadConfig(makePaths()); });

      assertConvertedInMemory(result);
      assert.equal(fs.readFileSync(internalConfigPath(), 'utf8'), raw, 'config.json untouched by the failed write');
    });

    it('writes only config.json and config.json.bak, next to the given path', () => {
      writeRaw(fs.readFileSync(LEGACY_FIXTURE, 'utf8'));
      loadConfig(makePaths());
      assert.deepStrictEqual(fs.readdirSync(internalDir).sort(), ['config.json', 'config.json.bak']);
    });
  });
});
