import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

// --- Reader output tests (run reader as subprocess to test CJS module) ---

const READER_PATH = path.join(import.meta.dirname, '..', 'src', 'reader', 'bmad-sl-reader.js');

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const COLOR = {
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  brightBlack: '\x1b[90m',
};
const BG = {
  brightRed: '\x1b[101m',
  brightYellow: '\x1b[103m',
  brightBlue: '\x1b[104m',
};
const FG = {
  black: '\x1b[30m',
  white: '\x1b[97m',
};

describe('LLM State widget — reader output', () => {
  let tmpDir;
  let configDir;
  let cacheDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llmstate-test-'));
    configDir = path.join(tmpDir, 'config');
    cacheDir = path.join(tmpDir, 'cache');
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(cacheDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeConfig(widgets = ['bmad-llmstate']) {
    const config = {
      separator: 'modere',
      customSeparator: null,
      lines: [
        {
          widgets,
          widgetOrder: widgets,
          colorModes: { 'bmad-llmstate': { mode: 'dynamic' } },
        },
        { widgets: [], widgetOrder: [], colorModes: {} },
        { widgets: [], widgetOrder: [], colorModes: {} },
      ],
      skillColors: {},
      projectColors: {},
      presets: [null, null, null],
    };
    fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify(config, null, 2));
  }

  function writeStatus(sessionId, data) {
    fs.writeFileSync(path.join(cacheDir, `status-${sessionId}.json`), JSON.stringify(data, null, 2));
    // Create alive file so reader finds it
    fs.writeFileSync(path.join(cacheDir, `.alive-${sessionId}`), '');
    // Touch alive to be fresh
    const now = new Date();
    fs.utimesSync(path.join(cacheDir, `.alive-${sessionId}`), now, now);
  }

  function runReader(sessionId = 'test1', lineIndex = 0) {
    const env = {
      ...process.env,
      BMAD_CONFIG_DIR: configDir,
      BMAD_CACHE_DIR: cacheDir,
    };
    try {
      return execFileSync('node', [READER_PATH, 'line', String(lineIndex)], {
        env,
        encoding: 'utf8',
        input: JSON.stringify({ session_id: sessionId }),
        timeout: 5000,
      });
    } catch (e) {
      return e.stdout || '';
    }
  }

  it('renders PERMISSION with brightYellow bg and black text', () => {
    writeConfig();
    writeStatus('test1', {
      session_id: 'test1',
      llm_state: 'permission',
      updated_at: new Date().toISOString(),
    });
    const output = runReader();
    assert.ok(output.includes('PERMISSION'), `should contain PERMISSION, got: ${JSON.stringify(output)}`);
    assert.ok(output.includes(BG.brightYellow), 'should contain brightYellow background');
    assert.ok(output.includes(FG.black), 'should contain black foreground');
    assert.ok(output.includes('\u2B24'), 'should contain filled circle');
    // Verify padding spaces around content
    const plain = output.replace(/\x1b\[[0-9;]*m/g, '');
    assert.ok(plain.startsWith(' '), 'should have leading space inside bg');
    assert.ok(plain.includes('PERMISSION '), 'should have trailing space after label');
  });

  it('renders WAITING with brightBlue bg and white text', () => {
    writeConfig();
    writeStatus('test1', {
      session_id: 'test1',
      llm_state: 'waiting',
      updated_at: new Date().toISOString(),
    });
    const output = runReader();
    assert.ok(output.includes('WAITING'), `should contain WAITING, got: ${JSON.stringify(output)}`);
    assert.ok(output.includes(BG.brightBlue), 'should contain brightBlue background');
    assert.ok(output.includes(FG.white), 'should contain white foreground');
  });

  it('renders ACTIVE in green without bold', () => {
    writeConfig();
    writeStatus('test1', {
      session_id: 'test1',
      llm_state: 'active',
      updated_at: new Date().toISOString(),
    });
    const output = runReader();
    assert.ok(output.includes('ACTIVE'), `should contain ACTIVE, got: ${JSON.stringify(output)}`);
    assert.ok(!output.includes(BOLD), 'should NOT contain BOLD escape');
    assert.ok(output.includes(COLOR.green), 'should contain green color');
  });

  it('renders INACTIVE in grey without bold for explicit inactive', () => {
    writeConfig();
    writeStatus('test1', {
      session_id: 'test1',
      llm_state: 'inactive',
      updated_at: new Date().toISOString(),
    });
    const output = runReader();
    assert.ok(output.includes('INACTIVE'), `should contain INACTIVE, got: ${JSON.stringify(output)}`);
    assert.ok(!output.includes(BOLD), 'should NOT contain BOLD escape');
    assert.ok(output.includes(COLOR.brightBlack), 'should contain grey color');
  });

  it('renders INACTIVE when llm_state is missing', () => {
    writeConfig();
    writeStatus('test1', {
      session_id: 'test1',
      updated_at: new Date().toISOString(),
    });
    const output = runReader();
    assert.ok(output.includes('INACTIVE'), `should fallback to INACTIVE, got: ${JSON.stringify(output)}`);
  });

  it('renders INACTIVE when session is stale (>5 min)', () => {
    writeConfig();
    const staleTime = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    writeStatus('test1', {
      session_id: 'test1',
      llm_state: 'permission',
      updated_at: staleTime,
    });
    const output = runReader();
    assert.ok(output.includes('INACTIVE'), `stale session should show INACTIVE, got: ${JSON.stringify(output)}`);
    assert.ok(!output.includes('PERMISSION'), 'should NOT show PERMISSION for stale session');
  });

  it('renders empty when no session exists', () => {
    writeConfig();
    const output = runReader();
    assert.equal(output, '', 'should be empty with no session');
  });

  it('has two spaces between circle and label', () => {
    writeConfig();
    writeStatus('test1', {
      session_id: 'test1',
      llm_state: 'active',
      updated_at: new Date().toISOString(),
    });
    const output = runReader();
    // Strip ANSI to check spacing
    const plain = output.replace(/\x1b\[[0-9;]*m/g, '');
    assert.ok(plain.includes('\u2B24  ACTIVE'), `should have 2 spaces between circle and label, got: ${JSON.stringify(plain)}`);
  });

  it('renders ERROR with brightRed bg and white text', () => {
    writeConfig();
    writeStatus('test1', {
      session_id: 'test1',
      llm_state: 'error',
      updated_at: new Date().toISOString(),
    });
    const output = runReader();
    assert.ok(output.includes('ERROR'), `should contain ERROR, got: ${JSON.stringify(output)}`);
    assert.ok(output.includes(BG.brightRed), 'should contain brightRed background');
    assert.ok(output.includes(FG.white), 'should contain white foreground');
    assert.ok(output.includes('\u2B24'), 'should contain filled circle');
  });

  it('renders SUBAGENT in cyan without bold', () => {
    writeConfig();
    writeStatus('test1', {
      session_id: 'test1',
      llm_state: 'active:subagent',
      updated_at: new Date().toISOString(),
    });
    const output = runReader();
    assert.ok(output.includes('SUBAGENT'), `should contain SUBAGENT, got: ${JSON.stringify(output)}`);
    assert.ok(output.includes(COLOR.cyan), 'should contain cyan color');
    assert.ok(!output.includes(BOLD), 'should NOT contain BOLD escape');
  });
});
