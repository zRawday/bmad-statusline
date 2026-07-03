import { describe, it } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(__dirname, '..', 'bin', 'cli.js');

function run(args = '', expectFail = false, env = undefined) {
  try {
    const stdout = execSync(`node "${CLI}" ${args}`, {
      encoding: 'utf8',
      env: env ? { ...process.env, ...env } : process.env,
    });
    return { stdout, exitCode: 0 };
  } catch (err) {
    if (expectFail) {
      return { stdout: err.stdout || '', exitCode: err.status };
    }
    throw err;
  }
}

describe('bin/cli.js', () => {
  it('prints usage and exits 0 with --help', () => {
    const { stdout, exitCode } = run('--help');
    assert.strictEqual(exitCode, 0);
    assert.ok(stdout.includes('install'));
    assert.ok(stdout.includes('uninstall'));
    assert.ok(stdout.includes('clean'));
  });

  it('prints usage and exits 0 with -h', () => {
    const { stdout, exitCode } = run('-h');
    assert.strictEqual(exitCode, 0);
    assert.ok(stdout.includes('install'));
  });

  it('TUI module loads and exports default function', async () => {
    const mod = await import('../src/tui/app.js');
    assert.strictEqual(typeof mod.default, 'function');
  });

  it('prints usage and exits 1 for unknown command', () => {
    const { stdout, exitCode } = run('foo', true);
    assert.strictEqual(exitCode, 1);
    assert.ok(stdout.includes('install'));
  });

  // install is tested via test/install.test.js with injected paths
  // Running it here would modify real ~/.claude/ and ~/.config/ files
  it('install module loads without error', async () => {
    const mod = await import('../src/install.js');
    assert.strictEqual(typeof mod.default, 'function');
  });

  it('uninstall module loads without error', async () => {
    const mod = await import('../src/uninstall.js');
    assert.strictEqual(typeof mod.default, 'function');
  });

  it('runs clean command without error (isolated cache dir)', () => {
    // BMAD_CACHE_DIR injected so `npm test` never deletes the developer's real
    // session files — and the run is hermetic. Seed an expired pair to make the
    // smoke test assert actual behavior.
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-cli-clean-'));
    try {
      const statusPath = path.join(tmpDir, 'status-cliclean.json');
      const alivePath = path.join(tmpDir, '.alive-cliclean');
      fs.writeFileSync(statusPath, '{}');
      fs.writeFileSync(alivePath, '');
      const past = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      fs.utimesSync(statusPath, past, past);
      fs.utimesSync(alivePath, past, past);
      const { stdout, exitCode } = run('clean', false, { BMAD_CACHE_DIR: tmpDir });
      assert.strictEqual(exitCode, 0);
      assert.ok(stdout.includes('2 file(s) purged'), 'expired pair purged');
      assert.ok(!fs.existsSync(statusPath) && !fs.existsSync(alivePath));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
