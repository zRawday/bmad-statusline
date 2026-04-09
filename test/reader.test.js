import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const READER_PATH = path.resolve(__dirname, '..', 'src', 'reader', 'bmad-sl-reader.js');
const DEFAULTS_PATH = path.resolve(__dirname, '..', 'src', 'defaults.js');
const WORKFLOW_COLORS_PATH = path.resolve(__dirname, '..', 'src', 'reader', 'workflow-colors.cjs');

const ESC = '\x1b[';
const RESET = '\x1b[0m';
const FIXTURE_CONFIG_PATH = path.resolve(__dirname, 'fixtures', 'internal-config-default.json');

// Direct imports for internal-logic tests (no process spawn needed)
const _require = createRequire(import.meta.url);
const reader = _require(READER_PATH);
const sharedConstants = _require(path.resolve(__dirname, '..', 'src', 'reader', 'shared-constants.cjs'));

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

  it('formats story slug with double-hyphen 5-3-auth--login to 5-3 Auth Login', () => {
    writeStatus('fmt5', { story: '5-3-auth--login' });
    const result = execReader('story', 'fmt5');
    assert.equal(result, '5-3 Auth Login');
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

  // --- Story compact display mode ---

  it('story compact mode returns only number prefix via line command', () => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-cfg-'));
    const config = JSON.parse(fs.readFileSync(FIXTURE_CONFIG_PATH, 'utf8'));
    config.lines[0].colorModes['bmad-story'] = { mode: 'fixed', fixedColor: 'magenta', displayMode: 'compact' };
    fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify(config));
    writeStatus('compact1', { story: '7-5-auth-login' });
    const result = execReaderWithConfig('line 0', 'compact1', configDir);
    assert.ok(result.includes('7-5'), 'should contain story number');
    assert.ok(!result.includes('Auth Login'), 'should NOT contain title in compact mode');
    fs.rmSync(configDir, { recursive: true, force: true });
  });

  it('story full mode (default) returns number and title via line command', () => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-cfg-'));
    const config = JSON.parse(fs.readFileSync(FIXTURE_CONFIG_PATH, 'utf8'));
    // No displayMode set — should default to full
    fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify(config));
    writeStatus('full1', { story: '7-5-auth-login' });
    const result = execReaderWithConfig('line 0', 'full1', configDir);
    assert.ok(result.includes('7-5 Auth Login'), 'should contain full story name');
    fs.rmSync(configDir, { recursive: true, force: true });
  });

  it('standalone story command always returns full format (no lineConfig)', () => {
    writeStatus('standalone1', { story: '7-5-auth-login' });
    const result = execReader('story', 'standalone1');
    assert.equal(result, '7-5 Auth Login');
  });

  it('compact mode with no story returns empty string', () => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-cfg-'));
    const config = JSON.parse(fs.readFileSync(FIXTURE_CONFIG_PATH, 'utf8'));
    config.lines[0].colorModes['bmad-story'] = { mode: 'fixed', fixedColor: 'magenta', displayMode: 'compact' };
    fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify(config));
    writeStatus('compact-empty', {});
    const result = execReaderWithConfig('line 0', 'compact-empty', configDir);
    assert.ok(!result.includes('bmad'), 'should not contain any widget text for missing story');
    fs.rmSync(configDir, { recursive: true, force: true });
  });

  it('compact mode with non-matching slug returns slug as-is', () => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-cfg-'));
    const config = JSON.parse(fs.readFileSync(FIXTURE_CONFIG_PATH, 'utf8'));
    config.lines[0].colorModes['bmad-story'] = { mode: 'fixed', fixedColor: 'magenta', displayMode: 'compact' };
    fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify(config));
    writeStatus('compact-nomatch', { story: 'no-match' });
    const result = execReaderWithConfig('line 0', 'compact-nomatch', configDir);
    assert.ok(result.includes('no-match'), 'non-matching slug should pass through');
    fs.rmSync(configDir, { recursive: true, force: true });
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

  it('line 1: llmstate-only line renders llm state (AC #2)', () => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-cfg-'));
    fs.copyFileSync(FIXTURE_CONFIG_PATH, path.join(configDir, 'config.json'));
    writeStatus('line2', { project: 'Toulou' });
    const result = execReaderWithConfig('line 1', 'line2', configDir);
    assert.ok(result.includes('WAITING'), 'line 1 should render llmstate');
    fs.rmSync(configDir, { recursive: true, force: true });
  });

  it('line 2: empty line returns empty string (AC #2)', () => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-cfg-'));
    fs.copyFileSync(FIXTURE_CONFIG_PATH, path.join(configDir, 'config.json'));
    writeStatus('line2b', { project: 'Toulou' });
    const result = execReaderWithConfig('line 2', 'line2b', configDir);
    assert.equal(result, '', 'line 2 is empty in default config');
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

  it('line N: empty custom separator uses empty string (AC #5)', () => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-cfg-'));
    const config = JSON.parse(fs.readFileSync(FIXTURE_CONFIG_PATH, 'utf8'));
    config.separator = 'custom';
    config.customSeparator = '';
    fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify(config));
    writeStatus('line5c', { project: 'P', workflow: 'dev-story' });
    const result = execReaderWithConfig('line 0', 'line5c', configDir);
    // Segments should be concatenated with no separator between them
    assert.ok(!result.includes('\u2503'), 'should not contain default separator');
    assert.ok(!result.includes(' | '), 'should not contain pipe separator');
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

  // --- getStoryOrRequest returns story only (AC #11) — direct import ---

  it('getStoryOrRequest returns story, ignores missing request (AC #11)', () => {
    const result = reader.COMMANDS.story({ story: 'my-story' }, null);
    assert.equal(result, 'my-story');
  });

  it('getStoryOrRequest returns empty when no story (AC #11)', () => {
    const result = reader.COMMANDS.story({}, null);
    assert.equal(result, '');
  });

  // --- Individual extractors with valid data (AC #12) — direct import, no process spawn ---

  it('all individual extractors return correct output (AC #12)', () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const status = {
      project: 'Toulou',
      workflow: 'create-architecture',
      story: '3-1-hook-detection',
      step: { current: 3, current_name: 'starter', next_name: 'decisions', total: 8 },
      started_at: tenMinAgo
    };

    assert.ok(reader.COMMANDS.project(status, null).includes('Toulou'), 'project contains name');
    assert.equal(reader.COMMANDS.workflow(status, null), `${ESC}35mcreate-architecture${RESET}`);
    assert.equal(reader.COMMANDS.nextstep(status, null), 'decisions');
    assert.equal(reader.COMMANDS.progressstep(status, null), 'Step 3/8 starter');
    assert.equal(reader.COMMANDS.story(status, null), '3-1 Hook Detection');
    const timer = reader.COMMANDS.timer(status, null);
    assert.ok(timer.includes('m'), 'timer should show minutes');
  });

  // --- Alive file and cleanup ---

  it('touches .alive file on read', () => {
    writeStatus('alive1', { project: 'Test' });
    const alivePath = path.join(tmpDir, '.alive-alive1');
    fs.writeFileSync(alivePath, '');
    const past = new Date(Date.now() - 60000);
    fs.utimesSync(alivePath, past, past);
    const beforeMtime = fs.statSync(alivePath).mtimeMs;
    execReader('project', 'alive1');
    const afterMtime = fs.statSync(alivePath).mtimeMs;
    assert.ok(afterMtime >= beforeMtime, '.alive mtime should be refreshed');
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

  // --- Health command — direct import, no process spawn ---

  it('health fresh: green filled circle when updated_at < 60s ago', () => {
    const result = reader.COMMANDS.health({ updated_at: new Date().toISOString() }, null);
    assert.equal(result, `${ESC}32m\u25CF${RESET}`);
  });

  it('health stale: yellow filled circle when updated_at 60s-300s ago', () => {
    const result = reader.COMMANDS.health({ updated_at: new Date(Date.now() - 120 * 1000).toISOString() }, null);
    assert.equal(result, `${ESC}33m\u25CF${RESET}`);
  });

  it('health expired: dim empty circle when updated_at > 300s ago', () => {
    const result = reader.COMMANDS.health({ updated_at: new Date(Date.now() - 600 * 1000).toISOString() }, null);
    assert.equal(result, `${ESC}90m\u25CB${RESET}`);
  });

  it('health missing updated_at: dim empty circle', () => {
    const result = reader.COMMANDS.health({}, null);
    assert.equal(result, `${ESC}90m\u25CB${RESET}`);
  });

  it('health empty status object: dim empty circle (direct extractor)', () => {
    const result = reader.COMMANDS.health({}, null);
    assert.equal(result, `${ESC}90m\u25CB${RESET}`);
  });

  // --- Health extractor uses COLOR_CODES, not inline ANSI hex ---

  it('health extractor source uses COLOR_CODES constants (no inline hex escapes)', () => {
    const src = fs.readFileSync(READER_PATH, 'utf8');
    const healthStart = src.indexOf("health:");
    const healthEnd = src.indexOf('},', healthStart);
    const healthBlock = src.slice(healthStart, healthEnd);
    assert.ok(!healthBlock.includes("'\\x1b["), 'health extractor should not contain inline ANSI hex escapes');
    assert.ok(healthBlock.includes('COLOR_CODES.green'), 'should use COLOR_CODES.green');
    assert.ok(healthBlock.includes('COLOR_CODES.yellow'), 'should use COLOR_CODES.yellow');
    assert.ok(healthBlock.includes('COLOR_CODES.brightBlack'), 'should use COLOR_CODES.brightBlack');
  });

  // --- Standalone custom colors — direct import, no process spawn ---

  it('standalone project command uses custom projectColors from config', () => {
    const result = reader.COMMANDS.project(
      { project: 'MyProject' },
      { skillColors: {}, projectColors: { 'MyProject': 'red' } }
    );
    assert.equal(result, `${ESC}31mMyProject${RESET}`, 'should use custom red color from projectColors');
  });

  // --- BMAD_CACHE_DIR ---

  it('uses BMAD_CACHE_DIR env var', () => {
    writeStatus('envtest', { project: 'EnvTest' });
    fs.writeFileSync(path.join(tmpDir, '.alive-envtest'), '');
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

// --- SessionId sanitization tests — direct import, no process spawn ---

describe('sessionId sanitization', () => {
  it('sessionId containing ../ is invalid (path traversal)', () => {
    assert.equal(sharedConstants.isValidSessionId('../etc/passwd'), false);
  });

  it('sessionId containing / is invalid', () => {
    assert.equal(sharedConstants.isValidSessionId('foo/bar'), false);
  });

  it('sessionId containing backslash is invalid', () => {
    assert.equal(sharedConstants.isValidSessionId('foo\\bar'), false);
  });

  it('valid sessionId passes validation', () => {
    assert.equal(sharedConstants.isValidSessionId('valid-session-123'), true);
  });
});

// --- PurgeStale resilience tests ---

describe('purgeStale resilience', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-purge-'));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('purgeStale continues past deleted .alive files and purges stale ones', () => {
    // Create a stale session that should be purged
    const staleId = 'stale-purge-test';
    const alivePath = path.join(tmpDir, `.alive-${staleId}`);
    const statusPath = path.join(tmpDir, `status-${staleId}.json`);
    fs.writeFileSync(alivePath, '');
    fs.writeFileSync(statusPath, '{}');
    const past = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
    fs.utimesSync(alivePath, past, past);

    // Create a trigger session to invoke purgeStale
    fs.writeFileSync(
      path.join(tmpDir, `status-trigger-purge2.json`),
      JSON.stringify({ project: 'Test' })
    );

    // Execute — should not throw
    execSync(`node "${READER_PATH}" project`, {
      input: JSON.stringify({ session_id: 'trigger-purge2' }),
      encoding: 'utf8',
      env: { ...process.env, BMAD_CACHE_DIR: tmpDir },
    });

    // The stale session should have been purged
    assert.ok(!fs.existsSync(alivePath), 'stale .alive file should be deleted');
    assert.ok(!fs.existsSync(statusPath), 'stale status file should be deleted');
  });
});

// --- formatProgressStep cap tests — direct import, no process spawn ---

describe('formatProgressStep cap', () => {
  it('caps total at 999 when total exceeds 999', () => {
    const result = reader.formatProgressStep({ current: 5, total: 5000, current_name: 'bigstep' });
    assert.equal(result, 'Step 5/999 bigstep');
  });

  it('does not cap when total <= 999', () => {
    const result = reader.formatProgressStep({ current: 3, total: 100, current_name: 'normal' });
    assert.equal(result, 'Step 3/100 normal');
  });
});

// --- Color maps sync tests (AC #13) ---

describe('color maps sync', () => {
  const readerSrc = fs.readFileSync(READER_PATH, 'utf8');

  // Both reader and defaults now import from the same shared file (workflow-colors.cjs).
  // These tests verify the shared source is valid and the reader references it.

  const _require = createRequire(import.meta.url);
  const shared = _require(WORKFLOW_COLORS_PATH);

  it('AGENT_COLORS is removed from reader (AC #2, #13)', () => {
    assert.ok(!readerSrc.includes('AGENT_COLORS'), 'AGENT_COLORS should not exist in reader');
  });

  it('reader requires shared workflow-colors.cjs', () => {
    assert.ok(readerSrc.includes("require('./workflow-colors.cjs')"), 'reader should require shared file');
  });

  it('shared WORKFLOW_COLORS has expected keys (AC #13)', () => {
    const keys = Object.keys(shared.WORKFLOW_COLORS);
    assert.ok(keys.length > 30, `should have >30 workflow entries, got ${keys.length}`);
    assert.ok(keys.includes('dev-story'), 'should include dev-story');
    assert.ok(keys.includes('code-review'), 'should include code-review');
    assert.ok(keys.includes('agent-dev'), 'should include agent-dev');
  });

  it('shared WORKFLOW_PREFIX_COLORS has expected prefixes', () => {
    const prefixes = shared.WORKFLOW_PREFIX_COLORS.map(e => e.prefix);
    assert.ok(prefixes.length >= 4, `should have >=4 prefix entries, got ${prefixes.length}`);
    assert.ok(prefixes.includes('testarch-'), 'should include testarch-');
    assert.ok(prefixes.includes('wds-'), 'should include wds-');
  });

  it('shared WORKFLOW_COLORS contains no white entries (AC #7)', () => {
    for (const [key, value] of Object.entries(shared.WORKFLOW_COLORS)) {
      assert.notEqual(value, '\x1b[37m', `WORKFLOW_COLORS['${key}'] should not be white`);
    }
  });

  it('shared WORKFLOW_COLORS values are valid ANSI codes', () => {
    for (const [key, value] of Object.entries(shared.WORKFLOW_COLORS)) {
      assert.match(value, /^\x1b\[\d+m$/, `WORKFLOW_COLORS['${key}'] should be a valid ANSI code`);
    }
  });
});
