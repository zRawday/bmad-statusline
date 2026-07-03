import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import doctor, { runHealthCheck, purgeCcstatuslineNpxCache } from '../src/doctor.js';
import { DEPLOY_FILES, VERSION_STAMP, getPackageVersion, getDeployedVersion } from '../src/deploy.js';

let tmpDir;

function makePaths() {
  const readerDir = path.join(tmpDir, 'reader');
  const claudeSettings = path.join(tmpDir, '.claude', 'settings.json');
  const ccstatuslineSettings = path.join(tmpDir, '.config', 'ccstatusline', 'settings.json');
  const npxCacheDir = path.join(tmpDir, '_npx');
  return { readerDir, claudeSettings, ccstatuslineSettings, npxCacheDir };
}

function setupHealthy(paths) {
  fs.mkdirSync(paths.readerDir, { recursive: true });
  // Stub every deployed file (derived from DEPLOY_FILES so the test can't drift)
  // and stamp the current version so check 6 sees a fresh deployment.
  for (const f of DEPLOY_FILES) {
    fs.writeFileSync(path.join(paths.readerDir, f.name), '// stub');
  }
  fs.writeFileSync(path.join(paths.readerDir, VERSION_STAMP), getPackageVersion() + '\n');
  fs.writeFileSync(path.join(paths.readerDir, 'config.json'), JSON.stringify({ lines: [] }));
  fs.mkdirSync(path.dirname(paths.claudeSettings), { recursive: true });
  fs.writeFileSync(paths.claudeSettings, JSON.stringify({ statusLine: { type: 'command', command: 'npx -y ccstatusline@latest' } }));
  fs.mkdirSync(path.dirname(paths.ccstatuslineSettings), { recursive: true });
  fs.writeFileSync(paths.ccstatuslineSettings, JSON.stringify({ lines: [[{ id: 'bmad-line-0', type: 'custom-command' }]] }));
}

// Plant an npx cache entry: dir/package.json with _npx.packages = specs
function plantNpxEntry(npxCacheDir, name, specs) {
  const dir = path.join(npxCacheDir, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ _npx: { packages: specs } }));
  return dir;
}

const okRunner = () => Promise.resolve({ ok: true, error: '' });
const failRunner = () => Promise.resolve({ ok: false, error: "'ccstatusline' is not recognized" });

function statusOf(checks, id) {
  const c = checks.find(x => x.id === id);
  return c && c.status;
}

beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-doctor-test-')); });
afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

describe('runHealthCheck', () => {
  it('all healthy → every check ok, healthy=true', async () => {
    const paths = makePaths();
    setupHealthy(paths);
    const { checks, healthy } = await runHealthCheck(paths, okRunner);
    assert.equal(healthy, true);
    for (const id of ['reader', 'config', 'statusline', 'widgets', 'npx', 'version']) {
      assert.equal(statusOf(checks, id), 'ok', `${id} should be ok`);
    }
    // Fresh stamp → no resync → the stub files must be untouched
    const reader = fs.readFileSync(path.join(paths.readerDir, 'bmad-sl-reader.js'), 'utf8');
    assert.equal(reader, '// stub', 'up-to-date deployment must not be rewritten');
  });

  it('stale version stamp → auto-resync, status repaired, real files deployed', async () => {
    const paths = makePaths();
    setupHealthy(paths);
    fs.writeFileSync(path.join(paths.readerDir, VERSION_STAMP), '0.0.1\n');
    const { checks, healthy } = await runHealthCheck(paths, okRunner);
    assert.equal(statusOf(checks, 'version'), 'repaired');
    assert.equal(healthy, true);
    assert.equal(getDeployedVersion(paths.readerDir), getPackageVersion(), 'stamp updated to package version');
    const reader = fs.readFileSync(path.join(paths.readerDir, 'bmad-sl-reader.js'), 'utf8');
    assert.ok(reader.includes('use strict'), 'stub replaced by the real reader');
  });

  it('unstamped deployment (pre-v1.4 install) → resynced (repaired)', async () => {
    const paths = makePaths();
    setupHealthy(paths);
    fs.rmSync(path.join(paths.readerDir, VERSION_STAMP));
    const { checks } = await runHealthCheck(paths, okRunner);
    assert.equal(statusOf(checks, 'version'), 'repaired', 'unstamped deployment is resynced');
    assert.equal(getDeployedVersion(paths.readerDir), getPackageVersion());
  });

  it('broken npx cache → purges only ccstatusline entry and repairs', async () => {
    const paths = makePaths();
    setupHealthy(paths);
    const ccDir = plantNpxEntry(paths.npxCacheDir, 'aaa', ['ccstatusline@latest']);
    const otherDir = plantNpxEntry(paths.npxCacheDir, 'bbb', ['some-other-pkg@1.0.0']);
    // Runner fails while the ccstatusline cache entry exists, succeeds once purged
    const runner = () => Promise.resolve({ ok: !fs.existsSync(ccDir), error: 'broken' });

    const { checks, healthy } = await runHealthCheck(paths, runner);
    assert.equal(statusOf(checks, 'npx'), 'repaired');
    assert.equal(healthy, true);
    assert.ok(!fs.existsSync(ccDir), 'ccstatusline cache entry deleted');
    assert.ok(fs.existsSync(otherDir), 'non-ccstatusline cache entry preserved');
  });

  it('broken cache but still failing after purge → npx fail, healthy=false', async () => {
    const paths = makePaths();
    setupHealthy(paths);
    plantNpxEntry(paths.npxCacheDir, 'aaa', ['ccstatusline']);
    const { checks, healthy } = await runHealthCheck(paths, failRunner);
    assert.equal(statusOf(checks, 'npx'), 'fail');
    assert.equal(healthy, false);
  });

  it('npx fails with no ccstatusline cache to purge → npx fail', async () => {
    const paths = makePaths();
    setupHealthy(paths);
    fs.mkdirSync(paths.npxCacheDir, { recursive: true }); // empty
    const { checks } = await runHealthCheck(paths, failRunner);
    const npx = checks.find(c => c.id === 'npx');
    assert.equal(npx.status, 'fail');
    assert.match(npx.detail, /no ccstatusline cache/);
  });

  it('reader files missing → reader fail', async () => {
    const paths = makePaths();
    setupHealthy(paths);
    fs.rmSync(path.join(paths.readerDir, 'shared-constants.cjs'));
    const { checks, healthy } = await runHealthCheck(paths, okRunner);
    assert.equal(statusOf(checks, 'reader'), 'fail');
    assert.equal(healthy, false);
  });

  it('config.json invalid → config fail', async () => {
    const paths = makePaths();
    setupHealthy(paths);
    fs.writeFileSync(path.join(paths.readerDir, 'config.json'), '{ not json');
    const { checks, healthy } = await runHealthCheck(paths, okRunner);
    assert.equal(statusOf(checks, 'config'), 'fail');
    assert.equal(healthy, false);
  });

  it('statusLine missing → statusline fail', async () => {
    const paths = makePaths();
    setupHealthy(paths);
    fs.writeFileSync(paths.claudeSettings, JSON.stringify({ hooks: {} }));
    const { checks } = await runHealthCheck(paths, okRunner);
    assert.equal(statusOf(checks, 'statusline'), 'fail');
  });

  it('no bmad-line widgets → widgets fail', async () => {
    const paths = makePaths();
    setupHealthy(paths);
    fs.writeFileSync(paths.ccstatuslineSettings, JSON.stringify({ lines: [[{ id: 'model' }]] }));
    const { checks } = await runHealthCheck(paths, okRunner);
    assert.equal(statusOf(checks, 'widgets'), 'fail');
  });
});

describe('purgeCcstatuslineNpxCache', () => {
  it('returns [] when cache dir is absent', () => {
    assert.deepEqual(purgeCcstatuslineNpxCache(path.join(tmpDir, 'nope')), []);
  });

  it('deletes only ccstatusline entries', () => {
    const npx = path.join(tmpDir, '_npx');
    const cc1 = plantNpxEntry(npx, 'a', ['ccstatusline@latest']);
    const cc2 = plantNpxEntry(npx, 'b', ['ccstatusline']);
    const other = plantNpxEntry(npx, 'c', ['ccstatusline-fork@2.0.0']);
    const purged = purgeCcstatuslineNpxCache(npx);
    assert.equal(purged.length, 2);
    assert.ok(!fs.existsSync(cc1) && !fs.existsSync(cc2));
    assert.ok(fs.existsSync(other), 'similarly-named package preserved');
  });
});

describe('doctor (CLI wrapper)', () => {
  function captureExit(fn) {
    const origLog = console.log;
    const origExit = process.exit;
    const logs = [];
    let exitCode = null;
    console.log = (...a) => logs.push(a.join(' '));
    process.exit = (c) => { exitCode = c; throw new Error('__exit__'); };
    return (async () => {
      try { await fn(); } catch (e) { if (e.message !== '__exit__') throw e; }
      finally { console.log = origLog; process.exit = origExit; }
      return { logs: logs.join('\n'), exitCode };
    })();
  }

  it('exits 0 and prints healthy when all checks pass', async () => {
    const paths = makePaths();
    setupHealthy(paths);
    const { logs, exitCode } = await captureExit(() => doctor(paths, okRunner));
    assert.equal(exitCode, null, 'should not call process.exit');
    assert.match(logs, /healthy/i);
  });

  it('exits 1 when a check fails', async () => {
    const paths = makePaths();
    setupHealthy(paths);
    fs.rmSync(path.join(paths.readerDir, 'bmad-sl-reader.js'));
    const { exitCode } = await captureExit(() => doctor(paths, okRunner));
    assert.equal(exitCode, 1);
  });
});
