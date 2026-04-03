import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const READER_PATH = path.resolve(__dirname, '..', 'src', 'reader', 'bmad-sl-reader.js');
const DEFAULTS_PATH = path.resolve(__dirname, '..', 'src', 'defaults.js');

const ESC = '\x1b[';
const RESET = '\x1b[0m';
const FIXTURE_CONFIG_PATH = path.resolve(__dirname, 'fixtures', 'internal-config-default.json');

describe('reader color output', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-test-'));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeStatus(sessionId, statusObj) {
    fs.writeFileSync(
      path.join(tmpDir, `status-${sessionId}.json`),
      JSON.stringify(statusObj)
    );
  }

  function execReader(command, sessionId) {
    return execSync(`node "${READER_PATH}" ${command}`, {
      input: JSON.stringify({ session_id: sessionId }),
      encoding: 'utf8',
      env: { ...process.env, BMAD_CACHE_DIR: tmpDir },
    });
  }

  function execReaderWithConfig(args, sessionId, configDir) {
    return execSync(`node "${READER_PATH}" ${args}`, {
      input: JSON.stringify({ session_id: sessionId }),
      encoding: 'utf8',
      env: { ...process.env, BMAD_CACHE_DIR: tmpDir, BMAD_CONFIG_DIR: configDir },
    });
  }

  // --- Removed commands return empty (AC #1) ---

  it('agent command returns empty string (AC #1)', () => {
    writeStatus('dead1', { agent: ['Amelia'] });
    const result = execReader('agent', 'dead1');
    assert.equal(result, '');
  });

  it('request command returns empty string (AC #1)', () => {
    writeStatus('dead2', { request: 'fix login bug' });
    const result = execReader('request', 'dead2');
    assert.equal(result, '');
  });

  it('document command returns empty string (AC #1)', () => {
    writeStatus('dead3', { document: 'architecture.md' });
    const result = execReader('document', 'dead3');
    assert.equal(result, '');
  });

  // --- Workflow coloring ---

  it('colors known workflow', () => {
    writeStatus('wf1', { workflow: 'dev-story' });
    const result = execReader('workflow', 'wf1');
    assert.equal(result, `${ESC}36mdev-story${RESET}`);
  });

  it('colors prefix-matched workflow', () => {
    writeStatus('wf2', { workflow: 'testarch-automate' });
    const result = execReader('workflow', 'wf2');
    assert.equal(result, `${ESC}31mtestarch-automate${RESET}`);
  });

  it('colors wds- prefix workflow', () => {
    writeStatus('wf3', { workflow: 'wds-4-ux-design' });
    const result = execReader('workflow', 'wf3');
    assert.equal(result, `${ESC}94mwds-4-ux-design${RESET}`);
  });

  it('outputs unknown workflow as plain text', () => {
    writeStatus('wf4', { workflow: 'unknown-workflow' });
    const result = execReader('workflow', 'wf4');
    assert.equal(result, 'unknown-workflow');
    assert.ok(!result.includes(ESC), 'should not contain ANSI codes');
  });

  // --- Plain text extractors ---

  it('project returns dynamically colored text', () => {
    writeStatus('pt1', { project: 'Toulou' });
    const result = execReader('project', 'pt1');
    assert.ok(result.includes('Toulou'), 'contains project name');
    assert.ok(result.includes(ESC), 'contains ANSI color');
  });

  it('nextstep returns plain text', () => {
    writeStatus('pt3', { step: { next_name: 'testing' } });
    const result = execReader('nextstep', 'pt3');
    assert.equal(result, 'testing');
    assert.ok(!result.includes(ESC));
  });

  it('progressstep shows Step prefix with step name', () => {
    writeStatus('pt6', { step: { current: 3, current_name: 'starter', total: 8 } });
    const result = execReader('progressstep', 'pt6');
    assert.equal(result, 'Step 3/8 starter');
    assert.ok(!result.includes(ESC));
  });

  it('progressstep shows Step prefix without step name', () => {
    writeStatus('pt6b', { step: { current: 2, current_name: null, total: 4 } });
    const result = execReader('progressstep', 'pt6b');
    assert.equal(result, 'Step 2/4');
  });

  it('story returns plain text', () => {
    writeStatus('pt7', { story: '1-3-reader-colors' });
    const result = execReader('story', 'pt7');
    assert.equal(result, '1-3 Reader Colors');
    assert.ok(!result.includes(ESC));
  });

  it('timer returns plain text', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    writeStatus('pt10', { started_at: fiveMinAgo });
    const result = execReader('timer', 'pt10');
    assert.ok(!result.includes(ESC));
    assert.ok(result.includes('m'));
  });

  // --- Progress edge cases (AC #9, #10) ---

  it('progressstep with step.current: 1 shows 1/total (AC #9)', () => {
    writeStatus('prog2', { step: { current: 1, current_name: 'init', total: 6 } });
    const result = execReader('progressstep', 'prog2');
    assert.equal(result, 'Step 1/6 init');
  });

  it('progressstep with missing step returns empty (AC #10)', () => {
    writeStatus('prog4', {});
    const result = execReader('progressstep', 'prog4');
    assert.equal(result, '');
  });

  // --- Removed composite commands return empty (AC #8) ---

  it('compact returns empty string after removal (AC #8)', () => {
    writeStatus('comp1', { project: 'Toulou', workflow: 'dev-story' });
    const result = execReader('compact', 'comp1');
    assert.equal(result, '');
  });

  it('full returns empty string after removal (AC #8)', () => {
    writeStatus('comp2', { project: 'Toulou', workflow: 'dev-story' });
    const result = execReader('full', 'comp2');
    assert.equal(result, '');
  });

  it('minimal returns empty string after removal (AC #8)', () => {
    writeStatus('comp3', { workflow: 'dev-story' });
    const result = execReader('minimal', 'comp3');
    assert.equal(result, '');
  });

  // --- Story name formatting (AC #6) ---

  it('formats story slug 5-3-auth-login to 5-3 Auth Login (AC #6)', () => {
    writeStatus('fmt1', { story: '5-3-auth-login' });
    const result = execReader('story', 'fmt1');
    assert.equal(result, '5-3 Auth Login');
  });

  it('formats story slug 4-2-user-registration-flow (AC #6)', () => {
    writeStatus('fmt2', { story: '4-2-user-registration-flow' });
    const result = execReader('story', 'fmt2');
    assert.equal(result, '4-2 User Registration Flow');
  });

  it('returns non-matching slug as-is (AC #6)', () => {
    writeStatus('fmt3', { story: 'some-other-thing' });
    const result = execReader('story', 'fmt3');
    assert.equal(result, 'some-other-thing');
  });

  it('returns empty string for empty story (AC #6)', () => {
    writeStatus('fmt4', {});
    const result = execReader('story', 'fmt4');
    assert.equal(result, '');
  });

  // --- line N command (AC #1, #2, #3, #4, #5) ---

  it('line 0: composes widgets with separator and colors (AC #1)', () => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-cfg-'));
    fs.copyFileSync(FIXTURE_CONFIG_PATH, path.join(configDir, 'config.json'));
    writeStatus('line1', {
      project: 'Toulou',
      workflow: 'dev-story',
      step: { current: 3, total: 6, current_name: 'coding' },
      story: '5-3-auth-login',
      started_at: new Date(Date.now() - 5 * 60 * 1000).toISOString()
    });
    const result = execReaderWithConfig('line 0', 'line1', configDir);
    // Should contain all 5 widgets joined by ┃ (serre separator)
    assert.ok(result.includes('\u2503'), 'should use serre separator');
    // project = dynamic color (hash-based: Toulou → magenta)
    assert.ok(result.includes(`${ESC}35mToulou${RESET}`), 'project should have hash-based dynamic color');
    // workflow = dynamic (workflow's own ANSI preserved)
    assert.ok(result.includes(`${ESC}36mdev-story${RESET}`), 'workflow should have own color');
    // story = magenta fixed
    assert.ok(result.includes(`${ESC}35m5-3 Auth Login${RESET}`), 'story should be magenta with formatted name');
    // progressstep = brightCyan fixed
    assert.ok(result.includes(`${ESC}96mStep 3/6 coding${RESET}`), 'progressstep should be brightCyan');
    fs.rmSync(configDir, { recursive: true, force: true });
  });

  it('line 1: empty widgets returns empty string (AC #2)', () => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-cfg-'));
    fs.copyFileSync(FIXTURE_CONFIG_PATH, path.join(configDir, 'config.json'));
    writeStatus('line2', { project: 'Toulou' });
    const result = execReaderWithConfig('line 1', 'line2', configDir);
    assert.equal(result, '');
    fs.rmSync(configDir, { recursive: true, force: true });
  });

  it('line 2: empty widgets returns empty string (AC #2)', () => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-cfg-'));
    fs.copyFileSync(FIXTURE_CONFIG_PATH, path.join(configDir, 'config.json'));
    writeStatus('line2b', { project: 'Toulou' });
    const result = execReaderWithConfig('line 2', 'line2b', configDir);
    assert.equal(result, '');
    fs.rmSync(configDir, { recursive: true, force: true });
  });

  it('line N: missing config returns empty string (AC #3)', () => {
    const configDir = path.join(os.tmpdir(), 'bmad-nonexistent-' + Date.now());
    writeStatus('line3', { project: 'Toulou' });
    const result = execReaderWithConfig('line 0', 'line3', configDir);
    assert.equal(result, '');
  });

  it('line N: corrupted config returns empty string (AC #3)', () => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-cfg-'));
    fs.writeFileSync(path.join(configDir, 'config.json'), '{invalid json!!!');
    writeStatus('line3b', { project: 'Toulou' });
    const result = execReaderWithConfig('line 0', 'line3b', configDir);
    assert.equal(result, '');
    fs.rmSync(configDir, { recursive: true, force: true });
  });

  it('line N: BMAD_CONFIG_DIR env var is used (AC #4)', () => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-cfg-'));
    fs.copyFileSync(FIXTURE_CONFIG_PATH, path.join(configDir, 'config.json'));
    writeStatus('line4', { project: 'TestProject' });
    const result = execReaderWithConfig('line 0', 'line4', configDir);
    // Should use the config from the custom dir — project widget present
    assert.ok(result.includes('TestProject'), 'should read config from BMAD_CONFIG_DIR');
    fs.rmSync(configDir, { recursive: true, force: true });
  });

  it('line N: separator styles resolve correctly (AC #5)', () => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-cfg-'));
    // Write config with modere separator
    const config = JSON.parse(fs.readFileSync(FIXTURE_CONFIG_PATH, 'utf8'));
    config.separator = 'modere';
    fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify(config));
    writeStatus('line5', { project: 'P', workflow: 'dev-story' });
    const result = execReaderWithConfig('line 0', 'line5', configDir);
    assert.ok(result.includes(' \u2503 '), 'should use modere separator (padded)');
    fs.rmSync(configDir, { recursive: true, force: true });
  });

  it('line N: large separator style resolves correctly (AC #5)', () => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-cfg-'));
    const config = JSON.parse(fs.readFileSync(FIXTURE_CONFIG_PATH, 'utf8'));
    config.separator = 'large';
    fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify(config));
    writeStatus('line5b', { project: 'P', workflow: 'dev-story' });
    const result = execReaderWithConfig('line 0', 'line5b', configDir);
    assert.ok(result.includes('  \u2503  '), 'should use large separator (wide padded)');
    fs.rmSync(configDir, { recursive: true, force: true });
  });

  it('line N: custom separator resolves correctly (AC #5)', () => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-cfg-'));
    const config = JSON.parse(fs.readFileSync(FIXTURE_CONFIG_PATH, 'utf8'));
    config.separator = 'custom';
    config.customSeparator = ' | ';
    fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify(config));
    writeStatus('line6', { project: 'P', workflow: 'dev-story' });
    const result = execReaderWithConfig('line 0', 'line6', configDir);
    assert.ok(result.includes(' | '), 'should use custom separator');
    fs.rmSync(configDir, { recursive: true, force: true });
  });

  it('line N: empty extractor results are skipped (AC #1)', () => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-cfg-'));
    fs.copyFileSync(FIXTURE_CONFIG_PATH, path.join(configDir, 'config.json'));
    // Only project has a value — others are empty
    writeStatus('line7', { project: 'Toulou' });
    const result = execReaderWithConfig('line 0', 'line7', configDir);
    // Should only contain project, no double separators
    assert.ok(!result.includes('\u2503\u2503'), 'should not have double separators');
    assert.ok(result.includes('Toulou'));
    fs.rmSync(configDir, { recursive: true, force: true });
  });

  it('line N: invalid line index returns empty (line 3)', () => {
    writeStatus('line8', { project: 'Toulou' });
    const result = execSync(`node "${READER_PATH}" line 3`, {
      input: JSON.stringify({ session_id: 'line8' }),
      encoding: 'utf8',
      env: { ...process.env, BMAD_CACHE_DIR: tmpDir },
    });
    assert.equal(result, '');
  });

  it('line N: negative line index returns empty', () => {
    writeStatus('line9', { project: 'Toulou' });
    const result = execSync(`node "${READER_PATH}" line -1`, {
      input: JSON.stringify({ session_id: 'line9' }),
      encoding: 'utf8',
      env: { ...process.env, BMAD_CACHE_DIR: tmpDir },
    });
    assert.equal(result, '');
  });

  it('line N: non-numeric line index returns empty', () => {
    writeStatus('line10', { project: 'Toulou' });
    const result = execSync(`node "${READER_PATH}" line abc`, {
      input: JSON.stringify({ session_id: 'line10' }),
      encoding: 'utf8',
      env: { ...process.env, BMAD_CACHE_DIR: tmpDir },
    });
    assert.equal(result, '');
  });

  // --- getStoryOrRequest returns story only (AC #11) ---

  it('getStoryOrRequest returns story, ignores missing request (AC #11)', () => {
    writeStatus('sor1', { story: 'my-story' });
    const result = execReader('story', 'sor1');
    assert.equal(result, 'my-story');
  });

  it('getStoryOrRequest returns empty when no story (AC #11)', () => {
    writeStatus('sor2', {});
    const result = execReader('story', 'sor2');
    assert.equal(result, '');
  });

  // --- Individual extractors with valid data (AC #12) ---

  it('all individual extractors return correct output (AC #12)', () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    writeStatus('ind1', {
      project: 'Toulou',
      workflow: 'create-architecture',
      story: '3-1-hook-detection',
      step: { current: 3, current_name: 'starter', next_name: 'decisions', total: 8 },
      started_at: tenMinAgo
    });

    assert.ok(execReader('project', 'ind1').includes('Toulou'), 'project contains name');
    assert.equal(execReader('workflow', 'ind1'), `${ESC}35mcreate-architecture${RESET}`);
    assert.equal(execReader('nextstep', 'ind1'), 'decisions');
    assert.equal(execReader('progressstep', 'ind1'), 'Step 3/8 starter');
    assert.equal(execReader('story', 'ind1'), '3-1 Hook Detection');
    const timer = execReader('timer', 'ind1');
    assert.ok(timer.includes('m'), 'timer should show minutes');
  });

  // --- Alive file and cleanup ---

  it('touches .alive file on read', () => {
    writeStatus('alive1', { project: 'Test' });
    execReader('project', 'alive1');
    const alivePath = path.join(tmpDir, '.alive-alive1');
    assert.ok(fs.existsSync(alivePath), '.alive file should exist');
  });

  it('purges stale alive and status files', () => {
    const staleId = 'stale-session';
    const alivePath = path.join(tmpDir, `.alive-${staleId}`);
    const statusPath = path.join(tmpDir, `status-${staleId}.json`);
    fs.writeFileSync(alivePath, '');
    fs.writeFileSync(statusPath, '{}');
    const past = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
    fs.utimesSync(alivePath, past, past);

    writeStatus('trigger-purge', { project: 'Test' });
    execReader('project', 'trigger-purge');

    assert.ok(!fs.existsSync(alivePath), 'stale .alive file should be deleted');
    assert.ok(!fs.existsSync(statusPath), 'stale status file should be deleted');
  });

  // --- Health command ---

  it('health fresh: green filled circle when updated_at < 60s ago', () => {
    writeStatus('health-fresh', { updated_at: new Date().toISOString() });
    const result = execReader('health', 'health-fresh');
    assert.equal(result, `${ESC}32m\u25CF${RESET}`);
  });

  it('health stale: yellow filled circle when updated_at 60s-300s ago', () => {
    writeStatus('health-stale', { updated_at: new Date(Date.now() - 120 * 1000).toISOString() });
    const result = execReader('health', 'health-stale');
    assert.equal(result, `${ESC}33m\u25CF${RESET}`);
  });

  it('health expired: dim empty circle when updated_at > 300s ago', () => {
    writeStatus('health-expired', { updated_at: new Date(Date.now() - 600 * 1000).toISOString() });
    const result = execReader('health', 'health-expired');
    assert.equal(result, `${ESC}90m\u25CB${RESET}`);
  });

  it('health missing updated_at: dim empty circle', () => {
    writeStatus('health-missing', {});
    const result = execReader('health', 'health-missing');
    assert.equal(result, `${ESC}90m\u25CB${RESET}`);
  });

  it('health no status file: empty string', () => {
    const result = execReader('health', 'health-nonexistent-session');
    assert.equal(result, '');
  });

  // --- BMAD_CACHE_DIR ---

  it('uses BMAD_CACHE_DIR env var', () => {
    writeStatus('envtest', { project: 'EnvTest' });
    const result = execReader('project', 'envtest');
    assert.equal(result, `${ESC}96mEnvTest${RESET}`);
    assert.ok(fs.existsSync(path.join(tmpDir, '.alive-envtest')));
  });

  // --- Error handling ---

  it('returns empty string for missing status file', () => {
    const result = execReader('project', 'nonexistent-session');
    assert.equal(result, '');
  });

  it('returns empty string for unknown command', () => {
    writeStatus('err1', { project: 'Test' });
    const result = execSync(`node "${READER_PATH}" badcommand`, {
      input: JSON.stringify({ session_id: 'err1' }),
      encoding: 'utf8',
      env: { ...process.env, BMAD_CACHE_DIR: tmpDir },
    });
    assert.equal(result, '');
  });

  it('returns empty string for bad JSON stdin', () => {
    const result = execSync(`node "${READER_PATH}" project`, {
      input: 'not-json',
      encoding: 'utf8',
      env: { ...process.env, BMAD_CACHE_DIR: tmpDir },
    });
    assert.equal(result, '');
  });

  it('returns empty string when no stdin session_id', () => {
    const result = execSync(`node "${READER_PATH}" project`, {
      input: JSON.stringify({}),
      encoding: 'utf8',
      env: { ...process.env, BMAD_CACHE_DIR: tmpDir },
    });
    assert.equal(result, '');
  });
});

// --- Color maps sync tests (AC #13) ---

describe('color maps sync', () => {
  const readerSrc = fs.readFileSync(READER_PATH, 'utf8');
  const defaultsSrc = fs.readFileSync(DEFAULTS_PATH, 'utf8');

  function extractMapKeys(src, mapName) {
    const mapStart = src.indexOf(`const ${mapName}`);
    if (mapStart === -1) {
      const exportStart = src.indexOf(`export const ${mapName}`);
      if (exportStart === -1) return [];
      const mapEnd = src.indexOf('};', exportStart);
      const mapBlock = src.slice(exportStart, mapEnd);
      const regex = /'\s*([^']+)'\s*:\s*'\\x1b/g;
      const keys = [];
      let match;
      while ((match = regex.exec(mapBlock)) !== null) {
        keys.push(match[1]);
      }
      return keys.sort();
    }
    const mapEnd = src.indexOf('};', mapStart);
    const mapBlock = src.slice(mapStart, mapEnd);
    const regex = /'\s*([^']+)'\s*:\s*'\\x1b/g;
    const keys = [];
    let match;
    while ((match = regex.exec(mapBlock)) !== null) {
      keys.push(match[1]);
    }
    return keys.sort();
  }

  function extractPrefixArray(src) {
    const varName = 'WORKFLOW_PREFIX_COLORS';
    let start = src.indexOf(`const ${varName}`);
    if (start === -1) start = src.indexOf(`export const ${varName}`);
    if (start === -1) return [];
    const end = src.indexOf('];', start);
    const block = src.slice(start, end);
    const regex = /prefix:\s*'([^']+)'/g;
    const prefixes = [];
    let match;
    while ((match = regex.exec(block)) !== null) {
      prefixes.push(match[1]);
    }
    return prefixes.sort();
  }

  it('AGENT_COLORS is removed from reader (AC #2, #13)', () => {
    assert.ok(!readerSrc.includes('AGENT_COLORS'), 'AGENT_COLORS should not exist in reader');
  });

  it('WORKFLOW_COLORS keys match between reader and defaults (AC #13)', () => {
    const readerKeys = extractMapKeys(readerSrc, 'WORKFLOW_COLORS');
    const defaultsKeys = extractMapKeys(defaultsSrc, 'WORKFLOW_COLORS');
    assert.ok(readerKeys.length > 0, 'reader should have WORKFLOW_COLORS keys');
    assert.ok(defaultsKeys.length > 0, 'defaults should have WORKFLOW_COLORS keys');
    assert.deepStrictEqual(readerKeys, defaultsKeys);
  });

  it('WORKFLOW_PREFIX_COLORS prefixes match between reader and defaults', () => {
    const readerPrefixes = extractPrefixArray(readerSrc);
    const defaultsPrefixes = extractPrefixArray(defaultsSrc);
    assert.ok(readerPrefixes.length > 0, 'reader should have prefix entries');
    assert.ok(defaultsPrefixes.length > 0, 'defaults should have prefix entries');
    assert.deepStrictEqual(readerPrefixes, defaultsPrefixes);
  });

  it('WORKFLOW_COLORS contains no white entries (AC #7)', () => {
    function extractMapEntries(src, mapName) {
      let start = src.indexOf(`const ${mapName}`);
      if (start === -1) start = src.indexOf(`export const ${mapName}`);
      if (start === -1) return [];
      const end = src.indexOf('};', start);
      const block = src.slice(start, end);
      const regex = /'([^']+)'\s*:\s*'(\\x1b\[\d+m)'/g;
      const entries = [];
      let match;
      while ((match = regex.exec(block)) !== null) {
        entries.push({ key: match[1], value: match[2] });
      }
      return entries;
    }
    const readerEntries = extractMapEntries(readerSrc, 'WORKFLOW_COLORS');
    const defaultsEntries = extractMapEntries(defaultsSrc, 'WORKFLOW_COLORS');
    for (const entry of readerEntries) {
      assert.notEqual(entry.value, '\\x1b[37m', `reader WORKFLOW_COLORS['${entry.key}'] should not be white`);
    }
    for (const entry of defaultsEntries) {
      assert.notEqual(entry.value, '\\x1b[37m', `defaults WORKFLOW_COLORS['${entry.key}'] should not be white`);
    }
  });

  it('WORKFLOW_COLORS values match between reader and defaults (AC #7)', () => {
    function extractMapKV(src, mapName) {
      let start = src.indexOf(`const ${mapName}`);
      if (start === -1) start = src.indexOf(`export const ${mapName}`);
      if (start === -1) return {};
      const end = src.indexOf('};', start);
      const block = src.slice(start, end);
      const regex = /'([^']+)'\s*:\s*'(\\x1b\[\d+m)'/g;
      const map = {};
      let match;
      while ((match = regex.exec(block)) !== null) {
        map[match[1]] = match[2];
      }
      return map;
    }
    const readerKV = extractMapKV(readerSrc, 'WORKFLOW_COLORS');
    const defaultsKV = extractMapKV(defaultsSrc, 'WORKFLOW_COLORS');
    assert.ok(Object.keys(readerKV).length > 0, 'reader should have entries');
    assert.deepStrictEqual(readerKV, defaultsKV, 'WORKFLOW_COLORS values should match between reader and defaults');
  });
});
