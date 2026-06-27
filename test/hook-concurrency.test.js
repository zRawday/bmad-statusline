import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOOK_PATH = path.resolve(__dirname, '..', 'src', 'hook', 'bmad-hook.js');
const READER_PATH = path.resolve(__dirname, '..', 'src', 'reader', 'bmad-sl-reader.js');

// Reproduces the real-world failure: a /bmad-* skill sets `workflow`, then an
// ultracode run fans out many parallel subagents whose tool events fire dozens of
// concurrent hook processes — all read-modify-writing the same status file. Before
// the fix, a hook that caught the file mid-write reset state to defaults and
// persisted workflow/story/step/started_at = null, silently losing the widgets.
describe('hook — concurrent writes preserve skill state', () => {
  let tmpDir, cacheDir, configDir;
  const SID = 'concurrency-test-session';

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-conc-proj-'));
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-conc-cache-'));
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-conc-config-'));

    fs.mkdirSync(path.join(tmpDir, '_bmad', 'bmm'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '_bmad', 'bmm', 'config.yaml'),
      'project_name: ConcProject\nuser_name: Tester\n'
    );
    // A file each concurrent hook will "Read" (in-project → full read-modify-write).
    for (let i = 0; i < 24; i++) {
      fs.writeFileSync(path.join(tmpDir, `file-${i}.ts`), `// file ${i}\n`);
    }
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(configDir, { recursive: true, force: true });
  });

  function seedActiveSession() {
    fs.mkdirSync(cacheDir, { recursive: true });
    // Alive file with this runner's PID → hook touchAlive takes the fast path (no wmic).
    fs.writeFileSync(path.join(cacheDir, `.alive-${SID}`), String(process.pid));
    // A realistic, already-active dev-story session (as if /bmad-dev-story was run).
    const reads = [];
    for (let i = 0; i < 400; i++) {
      reads.push({ path: `src/long/path/to/module-${i}.ts`, in_project: true, at: new Date().toISOString(), agent_id: null });
    }
    const status = {
      session_id: SID,
      project: 'ConcProject',
      skill: 'bmad-dev-story',
      workflow: 'dev-story',
      active_skill: null,
      story: '3-1-some-story',
      story_priority: 2,
      step: { current: 2, current_name: 'implement', next: 3, next_name: 'complete', total: 3, track: '' },
      last_read: null, last_write: null, last_write_op: null, document_name: null,
      started_at: '2026-06-26T22:00:00.000Z',
      updated_at: '2026-06-26T22:00:00.000Z',
      llm_state: 'active', llm_state_since: '2026-06-26T22:00:00.000Z',
      subagent_type: null, error_type: null,
      _outputFolders: [path.join(tmpDir, '_bmad-output').replace(/\\/g, '/')],
      reads, writes: [], commands: []
    };
    fs.writeFileSync(
      path.join(cacheDir, `status-${SID}.json`),
      JSON.stringify(status, null, 2) + '\n'
    );
  }

  function spawnReadHook(i) {
    const payload = {
      session_id: SID,
      cwd: tmpDir,
      hook_event_name: 'PostToolUse',
      tool_name: 'Read',
      tool_input: { file_path: path.join(tmpDir, `file-${i % 24}.ts`) },
      tool_use_id: `toolu_${i}`,
      agent_id: `agent${i % 20}`
    };
    return new Promise((resolve) => {
      const child = spawn('node', [HOOK_PATH], {
        env: { ...process.env, BMAD_CACHE_DIR: cacheDir, BMAD_CONFIG_DIR: configDir }
      });
      child.stdin.write(JSON.stringify(payload));
      child.stdin.end();
      child.on('close', () => resolve());
      child.on('error', () => resolve());
    });
  }

  // A torn file left behind by the OLD shared-temp bug must SELF-HEAL: the hook repairs
  // it to valid JSON rather than leaving the status line blank forever. Per-PID temps
  // make in-flight writes atomic, so a parse failure can only mean legacy corruption —
  // which writeStatus is allowed to overwrite. (Guards against the over-eager "preserve
  // everything unreadable" regression that would strand exactly the affected users.)
  it('repairs a persistently-corrupt status file (self-heal, no permanent blank)', async () => {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, `.alive-${SID}`), String(process.pid));
    const fp = path.join(cacheDir, `status-${SID}.json`);
    fs.writeFileSync(fp, '{"workflow":"dev-story","skill":"bmad-dev-story","reads":[{"path":"a"'); // truncated

    await spawnReadHook(0);

    const after = fs.readFileSync(fp, 'utf8');
    let parsed;
    assert.doesNotThrow(() => { parsed = JSON.parse(after); }, 'corrupt file must be repaired to valid JSON');
    assert.equal(parsed.project, 'ConcProject', 'repair re-detects project from config');
  });

  it('keeps workflow/skill/story/step across 24 concurrent hooks', async () => {
    seedActiveSession();

    // Fire 24 concurrent hooks — repeat a few rounds to widen the odds of a collision.
    for (let round = 0; round < 4; round++) {
      await Promise.all(Array.from({ length: 24 }, (_, i) => spawnReadHook(round * 24 + i)));
    }

    const fp = path.join(cacheDir, `status-${SID}.json`);
    const raw = fs.readFileSync(fp, 'utf8');

    // 1. File is never left corrupt (per-PID temp guarantees no torn shared write).
    let parsed;
    assert.doesNotThrow(() => { parsed = JSON.parse(raw); }, 'status file must remain valid JSON');

    // 2. Skill-derived state survives — the widgets the user was losing.
    assert.equal(parsed.workflow, 'dev-story', 'workflow must not be reset to null');
    assert.equal(parsed.skill, 'bmad-dev-story', 'skill must not be reset to null');
    assert.equal(parsed.story, '3-1-some-story', 'story must not be reset to null');
    assert.equal(parsed.step.current, 2, 'step.current must survive');
    assert.equal(parsed.started_at, '2026-06-26T22:00:00.000Z', 'started_at must not be reset to null');

    // 3. The hooks actually ran and wrote (reads grew beyond the seeded 400).
    assert.ok(parsed.reads.length > 400, `reads history should have grown past 400, got ${parsed.reads.length}`);
  });

  it('does not leak per-process temp files', () => {
    const leftovers = fs.readdirSync(cacheDir).filter(f => f.includes('.tmp'));
    assert.deepEqual(leftovers, [], `no .tmp files should remain, found: ${leftovers.join(', ')}`);
  });

  // Guards the orphan-temp reaper: a writer killed mid-write leaves a per-PID temp that
  // nothing else cleans up. The reader's purgeStale reaps temps older than 60s.
  it('reaps orphaned per-process temp files older than 60s', () => {
    fs.mkdirSync(cacheDir, { recursive: true });
    const sid = 'reap-test-session';
    fs.writeFileSync(path.join(cacheDir, `.alive-${sid}`), String(process.pid));

    const stale = path.join(cacheDir, `status-${sid}.json.99999.tmp`);
    fs.writeFileSync(stale, 'partial');
    const old = Date.now() - 5 * 60 * 1000;
    fs.utimesSync(stale, new Date(old), new Date(old)); // backdate > 60s

    const fresh = path.join(cacheDir, `status-${sid}.json.88888.tmp`);
    fs.writeFileSync(fresh, 'inflight'); // < 60s — an in-flight write, must survive

    execSync(`node "${READER_PATH}" workflow`, {
      input: JSON.stringify({ session_id: sid }),
      encoding: 'utf8',
      env: { ...process.env, BMAD_CACHE_DIR: cacheDir, BMAD_CONFIG_DIR: configDir }
    });

    assert.equal(fs.existsSync(stale), false, 'stale temp (>60s) must be reaped');
    assert.equal(fs.existsSync(fresh), true, 'fresh temp (<60s) must be kept');
  });
});
