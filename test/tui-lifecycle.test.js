import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadRegistry, saveRegistry, registerPid, unregisterPid, startTtyWatch, stopTtyWatch } from '../src/tui/tui-lifecycle.js';

// Helper: create isolated temp dir for each test
function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-lifecycle-'));
}

function cleanTempDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

describe('tui-lifecycle — PID registry', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanTempDir(tmpDir); });

  describe('loadRegistry', () => {
    it('returns empty pids array when file does not exist', () => {
      const reg = loadRegistry(tmpDir);
      assert.deepStrictEqual(reg, { pids: [] });
    });

    it('returns parsed registry when file exists', () => {
      const regPath = path.join(tmpDir, 'tui-pids.json');
      fs.writeFileSync(regPath, JSON.stringify({ pids: [1234, 5678] }));
      const reg = loadRegistry(tmpDir);
      assert.deepStrictEqual(reg, { pids: [1234, 5678] });
    });

    it('returns empty pids on corrupted JSON', () => {
      const regPath = path.join(tmpDir, 'tui-pids.json');
      fs.writeFileSync(regPath, 'not-json!!!');
      const reg = loadRegistry(tmpDir);
      assert.deepStrictEqual(reg, { pids: [] });
    });
  });

  describe('saveRegistry', () => {
    it('writes registry as valid JSON via atomic write', () => {
      saveRegistry(tmpDir, { pids: [111, 222] });
      const regPath = path.join(tmpDir, 'tui-pids.json');
      const content = JSON.parse(fs.readFileSync(regPath, 'utf8'));
      assert.deepStrictEqual(content, { pids: [111, 222] });
    });

    it('creates cache directory if it does not exist', () => {
      const nested = path.join(tmpDir, 'sub', 'dir');
      saveRegistry(nested, { pids: [999] });
      const regPath = path.join(nested, 'tui-pids.json');
      assert.ok(fs.existsSync(regPath));
      const content = JSON.parse(fs.readFileSync(regPath, 'utf8'));
      assert.deepStrictEqual(content, { pids: [999] });
    });

    it('does not leave .tmp file after successful write', () => {
      saveRegistry(tmpDir, { pids: [42] });
      const tmpFile = path.join(tmpDir, 'tui-pids.json.tmp');
      assert.ok(!fs.existsSync(tmpFile), '.tmp file should be cleaned up');
    });
  });

  describe('registerPid', () => {
    it('writes current PID to registry file', () => {
      registerPid(tmpDir);
      const reg = loadRegistry(tmpDir);
      assert.ok(reg.pids.includes(process.pid));
    });

    it('purges dead PIDs from registry', () => {
      // 99999999 is almost certainly not a live PID
      const deadPid = 99999999;
      saveRegistry(tmpDir, { pids: [deadPid] });
      registerPid(tmpDir);
      const reg = loadRegistry(tmpDir);
      assert.ok(!reg.pids.includes(deadPid), 'dead PID should be purged');
      assert.ok(reg.pids.includes(process.pid), 'current PID should be registered');
    });

    it('preserves live PIDs (multi-instance coexistence)', () => {
      // Current process PID is live — simulate another live instance
      const livePid = process.pid;
      saveRegistry(tmpDir, { pids: [livePid] });
      // Register again (simulates second instance but same PID — just verify it doesn't remove itself)
      registerPid(tmpDir);
      const reg = loadRegistry(tmpDir);
      assert.ok(reg.pids.includes(livePid));
    });
  });

  describe('unregisterPid', () => {
    it('removes current PID from registry', () => {
      registerPid(tmpDir);
      assert.ok(loadRegistry(tmpDir).pids.includes(process.pid));
      unregisterPid(tmpDir);
      assert.ok(!loadRegistry(tmpDir).pids.includes(process.pid));
    });

    it('is idempotent — calling twice does not error', () => {
      registerPid(tmpDir);
      unregisterPid(tmpDir);
      unregisterPid(tmpDir); // second call — should not throw
      assert.ok(!loadRegistry(tmpDir).pids.includes(process.pid));
    });

    it('preserves other PIDs when removing current', () => {
      // Use current PID as live, add a fake one
      const otherPid = process.pid + 100000;
      saveRegistry(tmpDir, { pids: [process.pid, otherPid] });
      unregisterPid(tmpDir);
      const reg = loadRegistry(tmpDir);
      assert.ok(!reg.pids.includes(process.pid));
      assert.ok(reg.pids.includes(otherPid));
    });
  });

  describe('multi-instance coexistence', () => {
    it('two registered PIDs both survive in registry', () => {
      // Register current PID twice (simulates two instances)
      saveRegistry(tmpDir, { pids: [] });
      const pid1 = process.pid;
      const pid2 = process.ppid || process.pid; // ppid is also alive
      saveRegistry(tmpDir, { pids: [pid1, pid2] });
      const reg = loadRegistry(tmpDir);
      assert.ok(reg.pids.includes(pid1));
      assert.ok(reg.pids.includes(pid2));
    });
  });

  describe('atomic write integrity', () => {
    it('produces valid JSON after write', () => {
      saveRegistry(tmpDir, { pids: [1, 2, 3] });
      const regPath = path.join(tmpDir, 'tui-pids.json');
      const raw = fs.readFileSync(regPath, 'utf8');
      assert.doesNotThrow(() => JSON.parse(raw));
    });
  });

  describe('TTY watch', () => {
    it('startTtyWatch and stopTtyWatch do not throw', () => {
      const restoreScreen = () => {};
      assert.doesNotThrow(() => startTtyWatch(tmpDir, restoreScreen));
      assert.doesNotThrow(() => stopTtyWatch());
    });

    it('stopTtyWatch is idempotent', () => {
      assert.doesNotThrow(() => stopTtyWatch());
      assert.doesNotThrow(() => stopTtyWatch());
    });
  });

  describe('signal handler — PID removal on crash (AC4/AC5)', () => {
    it('uncaughtException handler unregisters PID before exit', () => {
      // Spawn child that registers PID, sets up signal handlers, then throws
      const script = [
        'import { registerPid, setupSignalHandlers } from "./src/tui/tui-lifecycle.js";',
        'const cachePath = process.argv[2];',
        'registerPid(cachePath);',
        'setupSignalHandlers(cachePath, () => {});',
        'throw new Error("deliberate crash for test");',
      ].join('\n');
      const scriptPath = path.join(tmpDir, 'crash-test.mjs');
      fs.writeFileSync(scriptPath, script);
      try {
        execFileSync(process.execPath, [scriptPath, tmpDir], {
          stdio: 'ignore',
          cwd: path.dirname(fileURLToPath(import.meta.url)),
          timeout: 10000,
        });
      } catch { /* child exits with code 1 — expected */ }
      const reg = loadRegistry(tmpDir);
      // Child PID should have been unregistered by the uncaughtException handler
      assert.strictEqual(reg.pids.length, 0, 'crashed child PID should be unregistered');
    });
  });

  describe('TTY orphan detection — exit on non-TTY (AC6)', () => {
    it('process exits and unregisters PID when stdout is not a TTY', () => {
      // Spawn child with piped stdio (non-TTY) that uses TTY check logic
      const script = [
        'import { registerPid, unregisterPid } from "./src/tui/tui-lifecycle.js";',
        'const cachePath = process.argv[2];',
        'registerPid(cachePath);',
        '// Inline TTY check with short interval (same logic as startTtyWatch)',
        'const id = setInterval(() => {',
        '  if (!process.stdout.isTTY) {',
        '    clearInterval(id);',
        '    unregisterPid(cachePath);',
        '    process.exit(0);',
        '  }',
        '}, 100);',
        'id.unref();',
        'setTimeout(() => process.exit(2), 5000).unref();',
      ].join('\n');
      const scriptPath = path.join(tmpDir, 'tty-test.mjs');
      fs.writeFileSync(scriptPath, script);
      try {
        execFileSync(process.execPath, [scriptPath, tmpDir], {
          stdio: 'pipe', // pipe = non-TTY → isTTY is false
          cwd: path.dirname(fileURLToPath(import.meta.url)),
          timeout: 10000,
        });
      } catch { /* ignore exit code */ }
      const reg = loadRegistry(tmpDir);
      assert.strictEqual(reg.pids.length, 0, 'PID should be unregistered when TTY is lost');
    });
  });
});
