import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import clean from '../src/clean.js';

function captureOutput(fn) {
  const logs = [];
  const origLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try { fn(); } finally { console.log = origLog; }
  return logs.join('\n');
}

describe('clean command', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-clean-test-'));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('deletes expired pair (alive mtime exceeds ALIVE_MAX_AGE_MS)', () => {
    const cacheDir = path.join(tmpDir, 'expired-pair');
    fs.mkdirSync(cacheDir);
    fs.writeFileSync(path.join(cacheDir, 'status-abc.json'), '{}');
    fs.writeFileSync(path.join(cacheDir, '.alive-abc'), '');

    // Set alive mtime to 8 days ago (exceeds 7-day threshold)
    const pastMs = Date.now() - (8 * 24 * 60 * 60 * 1000);
    const pastSec = pastMs / 1000;
    fs.utimesSync(path.join(cacheDir, '.alive-abc'), pastSec, pastSec);

    const output = captureOutput(() => clean({ cacheDir, homeDir: tmpDir }));

    assert.ok(output.includes('\u2713'), 'should contain success marker');
    assert.ok(output.includes('2 file(s) purged'), 'should report 2 files purged');
    assert.ok(!fs.existsSync(path.join(cacheDir, 'status-abc.json')), 'status file deleted');
    assert.ok(!fs.existsSync(path.join(cacheDir, '.alive-abc')), 'alive file deleted');
  });

  it('preserves recent orphaned status file (may be resumed)', () => {
    const cacheDir = path.join(tmpDir, 'orphan-status-recent');
    fs.mkdirSync(cacheDir);
    fs.writeFileSync(path.join(cacheDir, 'status-orphan.json'), '{}');
    // Just created — mtime is now, well within 7-day window

    const output = captureOutput(() => clean({ cacheDir, homeDir: tmpDir }));

    assert.ok(output.includes('already clean'), 'recent orphan should not be purged');
    assert.ok(fs.existsSync(path.join(cacheDir, 'status-orphan.json')), 'recent orphaned status preserved');
  });

  it('deletes old orphaned status file (>7 days, no corresponding alive)', () => {
    const cacheDir = path.join(tmpDir, 'orphan-status-old');
    fs.mkdirSync(cacheDir);
    fs.writeFileSync(path.join(cacheDir, 'status-orphan.json'), '{}');
    // Set mtime to 8 days ago
    const pastMs = Date.now() - (8 * 24 * 60 * 60 * 1000);
    const pastSec = pastMs / 1000;
    fs.utimesSync(path.join(cacheDir, 'status-orphan.json'), pastSec, pastSec);

    const output = captureOutput(() => clean({ cacheDir, homeDir: tmpDir }));

    assert.ok(output.includes('1 file(s) purged'));
    assert.ok(!fs.existsSync(path.join(cacheDir, 'status-orphan.json')), 'old orphaned status deleted');
  });

  it('deletes orphaned alive file (no corresponding status)', () => {
    const cacheDir = path.join(tmpDir, 'orphan-alive');
    fs.mkdirSync(cacheDir);
    fs.writeFileSync(path.join(cacheDir, '.alive-orphan'), '');

    const output = captureOutput(() => clean({ cacheDir, homeDir: tmpDir }));

    assert.ok(output.includes('1 file(s) purged'));
    assert.ok(!fs.existsSync(path.join(cacheDir, '.alive-orphan')), 'orphaned alive deleted');
  });

  it('preserves active pair (alive mtime within ALIVE_MAX_AGE_MS)', () => {
    const cacheDir = path.join(tmpDir, 'active-pair');
    fs.mkdirSync(cacheDir);
    fs.writeFileSync(path.join(cacheDir, 'status-active.json'), '{}');
    fs.writeFileSync(path.join(cacheDir, '.alive-active'), '');
    // alive file has recent mtime (just created) — within 7-day threshold

    const output = captureOutput(() => clean({ cacheDir, homeDir: tmpDir }));

    assert.ok(output.includes('already clean'), 'should report already clean');
    assert.ok(fs.existsSync(path.join(cacheDir, 'status-active.json')), 'status preserved');
    assert.ok(fs.existsSync(path.join(cacheDir, '.alive-active')), 'alive preserved');
  });

  it('handles mixed state: expired, orphaned, and active in one directory', () => {
    const cacheDir = path.join(tmpDir, 'mixed');
    fs.mkdirSync(cacheDir);

    // Expired pair
    fs.writeFileSync(path.join(cacheDir, 'status-expired.json'), '{}');
    fs.writeFileSync(path.join(cacheDir, '.alive-expired'), '');
    const pastMs = Date.now() - (8 * 24 * 60 * 60 * 1000);
    const pastSec = pastMs / 1000;
    fs.utimesSync(path.join(cacheDir, '.alive-expired'), pastSec, pastSec);

    // Orphaned status — recent (should be kept for resume)
    fs.writeFileSync(path.join(cacheDir, 'status-no-alive.json'), '{}');

    // Orphaned status — old (should be deleted)
    fs.writeFileSync(path.join(cacheDir, 'status-old-orphan.json'), '{}');
    const oldMs = Date.now() - (8 * 24 * 60 * 60 * 1000);
    const oldSec = oldMs / 1000;
    fs.utimesSync(path.join(cacheDir, 'status-old-orphan.json'), oldSec, oldSec);

    // Orphaned alive (no status)
    fs.writeFileSync(path.join(cacheDir, '.alive-no-status'), '');

    // Active pair (recent alive)
    fs.writeFileSync(path.join(cacheDir, 'status-fresh.json'), '{}');
    fs.writeFileSync(path.join(cacheDir, '.alive-fresh'), '');

    // Non-matching file
    fs.writeFileSync(path.join(cacheDir, 'readme.txt'), 'keep me');

    const output = captureOutput(() => clean({ cacheDir, homeDir: tmpDir }));

    assert.ok(output.includes('4 file(s) purged'), 'should purge 4 files (2 expired + 1 old orphan status + 1 orphan alive)');

    // Expired pair deleted
    assert.ok(!fs.existsSync(path.join(cacheDir, 'status-expired.json')), 'expired status deleted');
    assert.ok(!fs.existsSync(path.join(cacheDir, '.alive-expired')), 'expired alive deleted');

    // Old orphan status deleted, recent orphan preserved
    assert.ok(!fs.existsSync(path.join(cacheDir, 'status-old-orphan.json')), 'old orphaned status deleted');
    assert.ok(fs.existsSync(path.join(cacheDir, 'status-no-alive.json')), 'recent orphaned status preserved');
    assert.ok(!fs.existsSync(path.join(cacheDir, '.alive-no-status')), 'orphaned alive deleted');

    // Active pair preserved
    assert.ok(fs.existsSync(path.join(cacheDir, 'status-fresh.json')), 'active status preserved');
    assert.ok(fs.existsSync(path.join(cacheDir, '.alive-fresh')), 'active alive preserved');

    // Non-matching preserved
    assert.ok(fs.existsSync(path.join(cacheDir, 'readme.txt')), 'non-matching file preserved');
  });

  it('reports already clean for empty cache directory', () => {
    const cacheDir = path.join(tmpDir, 'empty');
    fs.mkdirSync(cacheDir);

    const output = captureOutput(() => clean({ cacheDir, homeDir: tmpDir }));

    assert.ok(output.includes('\u25CB'), 'should contain skipped marker');
    assert.ok(output.includes('already clean'));
  });

  it('reports directory not found for non-existent cache directory', () => {
    const cacheDir = path.join(tmpDir, 'does-not-exist');

    const output = captureOutput(() => clean({ cacheDir, homeDir: tmpDir }));

    assert.ok(output.includes('\u25CB'), 'should contain skipped marker');
    assert.ok(output.includes('directory not found'));
  });

  it('preserves non-matching files and reports already clean', () => {
    const cacheDir = path.join(tmpDir, 'non-matching');
    fs.mkdirSync(cacheDir);
    fs.writeFileSync(path.join(cacheDir, 'readme.txt'), 'keep me');
    fs.writeFileSync(path.join(cacheDir, 'config.json'), '{}');

    const output = captureOutput(() => clean({ cacheDir, homeDir: tmpDir }));

    assert.ok(output.includes('already clean'), 'should report already clean');
    assert.ok(fs.existsSync(path.join(cacheDir, 'readme.txt')), 'readme.txt preserved');
    assert.ok(fs.existsSync(path.join(cacheDir, 'config.json')), 'config.json preserved');
  });
});
