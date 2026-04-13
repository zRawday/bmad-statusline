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
});
