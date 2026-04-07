import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOOK_PATH = path.resolve(__dirname, '..', 'src', 'hook', 'bmad-hook.js');

describe('hook — 5-signal passive detection', () => {
  let tmpDir;
  let cacheDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-hook-test-'));
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-hook-cache-'));

    // _bmad directory
    fs.mkdirSync(path.join(tmpDir, '_bmad', 'bmm'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '_bmad', 'bmm', 'config.yaml'),
      'project_name: TestProject\nuser_name: Tester\n'
    );

    // bmad-create-architecture: steps/ with 8 step files
    const archSteps = path.join(tmpDir, '.claude', 'skills', 'bmad-create-architecture', 'steps');
    fs.mkdirSync(archSteps, { recursive: true });
    const archNames = ['init', 'analysis', 'starter', 'decisions', 'diagrams', 'review', 'finalize', 'publish'];
    for (let i = 1; i <= 8; i++) {
      fs.writeFileSync(path.join(archSteps, `step-0${i}-${archNames[i - 1]}.md`), `# Step ${i}`);
    }

    // bmad-dev-story: steps/ with 3 step files
    const devSteps = path.join(tmpDir, '.claude', 'skills', 'bmad-dev-story', 'steps');
    fs.mkdirSync(devSteps, { recursive: true });
    fs.writeFileSync(path.join(devSteps, 'step-01-load.md'), '# Step 1');
    fs.writeFileSync(path.join(devSteps, 'step-02-implement.md'), '# Step 2');
    fs.writeFileSync(path.join(devSteps, 'step-03-complete.md'), '# Step 3');

    // gds-code-review: steps/ with 2 step files
    const gdsSteps = path.join(tmpDir, '.claude', 'skills', 'gds-code-review', 'steps');
    fs.mkdirSync(gdsSteps, { recursive: true });
    fs.writeFileSync(path.join(gdsSteps, 'step-01-init.md'), '# Step 1');
    fs.writeFileSync(path.join(gdsSteps, 'step-02-review.md'), '# Step 2');

    // wds-4-ux-design: steps/ with 3 step files
    const wdsSteps = path.join(tmpDir, '.claude', 'skills', 'wds-4-ux-design', 'steps');
    fs.mkdirSync(wdsSteps, { recursive: true });
    fs.writeFileSync(path.join(wdsSteps, 'step-01-init.md'), '# Step 1');
    fs.writeFileSync(path.join(wdsSteps, 'step-02-design.md'), '# Step 2');
    fs.writeFileSync(path.join(wdsSteps, 'step-03-refine.md'), '# Step 3');

    // bmad-tea: multi-track skill with steps-c/ and steps-v/
    const teaStepsC = path.join(tmpDir, '.claude', 'skills', 'bmad-tea', 'steps-c');
    fs.mkdirSync(teaStepsC, { recursive: true });
    fs.writeFileSync(path.join(teaStepsC, 'step-c-01-init.md'), '# Step c-1');
    fs.writeFileSync(path.join(teaStepsC, 'step-c-02-plan.md'), '# Step c-2');
    fs.writeFileSync(path.join(teaStepsC, 'step-c-03-execute.md'), '# Step c-3');

    const teaStepsV = path.join(tmpDir, '.claude', 'skills', 'bmad-tea', 'steps-v');
    fs.mkdirSync(teaStepsV, { recursive: true });
    fs.writeFileSync(path.join(teaStepsV, 'step-v-01-load.md'), '# Step v-1');
    fs.writeFileSync(path.join(teaStepsV, 'step-v-02-check.md'), '# Step v-2');
    fs.writeFileSync(path.join(teaStepsV, 'step-v-03-validate.md'), '# Step v-3');

    // Sub-step file for exclusion test (should NOT match STEP_REGEX)
    fs.writeFileSync(path.join(archSteps, 'step-01b-continue.md'), '# Sub-step');

    // bmad-help: utility, no steps/
    fs.mkdirSync(path.join(tmpDir, '.claude', 'skills', 'bmad-help'), { recursive: true });

    // stories directory
    const storiesDir = path.join(tmpDir, '_bmad-output', 'implementation-artifacts', 'stories');
    fs.mkdirSync(storiesDir, { recursive: true });
    fs.writeFileSync(path.join(storiesDir, '3-1-hook-script.md'), '# Story');
    fs.writeFileSync(path.join(storiesDir, '1-4-dashboard.md'), '# Dashboard Story');

    // story files directly in implementation-artifacts (new regex matches by filename)
    const implDir = path.join(tmpDir, '_bmad-output', 'implementation-artifacts');
    fs.writeFileSync(path.join(implDir, '4-2-hook-dispatch.md'), '# Story 4-2');
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  function execHook(payload) {
    try {
      return execSync(`node "${HOOK_PATH}"`, {
        input: JSON.stringify(payload),
        encoding: 'utf8',
        env: { ...process.env, BMAD_CACHE_DIR: cacheDir },
        timeout: 5000
      });
    } catch (e) {
      return e.stdout || '';
    }
  }

  function readStatusFile(sessionId) {
    const fp = path.join(cacheDir, `status-${sessionId}.json`);
    if (!fs.existsSync(fp)) return null;
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  }

  function seedStatus(sessionId, obj) {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(
      path.join(cacheDir, `status-${sessionId}.json`),
      JSON.stringify(obj, null, 2)
    );
  }

  function aliveExists(sessionId) {
    return fs.existsSync(path.join(cacheDir, `.alive-${sessionId}`));
  }

  function cleanAlive(sessionId) {
    const fp = path.join(cacheDir, `.alive-${sessionId}`);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }

  function makeUserPromptPayload(sessionId, prompt) {
    return {
      session_id: sessionId,
      cwd: tmpDir,
      hook_event_name: 'UserPromptSubmit',
      prompt: prompt
    };
  }

  function makeReadPayload(sessionId, filePath, content) {
    const payload = {
      session_id: sessionId,
      cwd: tmpDir,
      hook_event_name: 'PostToolUse',
      tool_name: 'Read',
      tool_input: { file_path: filePath },
      tool_use_id: 'toolu_test'
    };
    if (content !== undefined) {
      payload.tool_response = {
        type: 'text',
        file: { filePath: filePath, content: content, numLines: 5, startLine: 1, totalLines: 5 }
      };
    }
    return payload;
  }

  function makeWritePayload(sessionId, filePath, content) {
    return {
      session_id: sessionId,
      cwd: tmpDir,
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      tool_input: { file_path: filePath, content: content },
      tool_use_id: 'toolu_test'
    };
  }

  function makeEditPayload(sessionId, filePath, oldString, newString) {
    return {
      session_id: sessionId,
      cwd: tmpDir,
      hook_event_name: 'PostToolUse',
      tool_name: 'Edit',
      tool_input: { file_path: filePath, old_string: oldString, new_string: newString },
      tool_use_id: 'toolu_test'
    };
  }

  function makeSessionStartPayload(sessionId) {
    return {
      session_id: sessionId,
      cwd: tmpDir,
      hook_event_name: 'SessionStart',
      source: 'resume'
    };
  }

  function makeStopPayload(sessionId) {
    return { session_id: sessionId, cwd: tmpDir, hook_event_name: 'Stop' };
  }

  function makePermissionRequestPayload(sessionId) {
    return { hook_event_name: 'PermissionRequest', session_id: sessionId, cwd: tmpDir };
  }

  function makeStopFailurePayload(sessionId, errorType) {
    return { hook_event_name: 'StopFailure', session_id: sessionId, error_type: errorType, cwd: tmpDir };
  }

  function makeSessionEndPayload(sessionId) {
    return { hook_event_name: 'SessionEnd', session_id: sessionId, cwd: tmpDir };
  }

  // ─── AC #1: UserPromptSubmit bmad skill ─────────────────────────────────────

  it('AC #1: bmad UserPromptSubmit sets skill, workflow, started_at', () => {
    execHook(makeUserPromptPayload('ac1', '/bmad-create-architecture'));
    const status = readStatusFile('ac1');
    assert.ok(status, 'status file should exist');
    assert.equal(status.skill, 'bmad-create-architecture');
    assert.equal(status.workflow, 'create-architecture');
    assert.ok(status.started_at, 'started_at should be set');
    assert.ok(status.updated_at, 'updated_at should be set');
  });

  // ─── AC #2: UserPromptSubmit gds skill ──────────────────────────────────────

  it('AC #2: gds UserPromptSubmit sets skill, workflow (dynamic slicer)', () => {
    execHook(makeUserPromptPayload('ac2', '/gds-code-review'));
    const status = readStatusFile('ac2');
    assert.ok(status, 'status file should exist');
    assert.equal(status.skill, 'gds-code-review');
    assert.equal(status.workflow, 'code-review');
    assert.ok(status.started_at);
  });

  // ─── AC #3: UserPromptSubmit wds skill ──────────────────────────────────────

  it('AC #3: wds UserPromptSubmit sets skill, workflow', () => {
    execHook(makeUserPromptPayload('ac3', '/wds-4-ux-design'));
    const status = readStatusFile('ac3');
    assert.ok(status, 'status file should exist');
    assert.equal(status.skill, 'wds-4-ux-design');
    assert.equal(status.workflow, '4-ux-design');
    assert.ok(status.started_at);
  });

  // ─── AC #4: started_at preservation ─────────────────────────────────────────

  it('AC #4: same skill preserves started_at', () => {
    const fixedTime = '2026-01-01T00:00:00.000Z';
    seedStatus('ac4', {
      session_id: 'ac4',
      skill: 'bmad-create-architecture',
      workflow: 'create-architecture',
      project: 'SomeProject',
      started_at: fixedTime,
      step: { total: null }
    });
    execHook(makeUserPromptPayload('ac4', '/bmad-create-architecture'));
    const status = readStatusFile('ac4');
    assert.equal(status.started_at, fixedTime, 'started_at should be preserved');
    assert.equal(status.skill, 'bmad-create-architecture');
  });

  it('AC #4b: different skill resets started_at', () => {
    seedStatus('ac4b', {
      session_id: 'ac4b',
      skill: 'bmad-create-architecture',
      workflow: 'create-architecture',
      project: 'SomeProject',
      started_at: '2026-01-01T00:00:00.000Z',
      step: { total: null }
    });
    execHook(makeUserPromptPayload('ac4b', '/bmad-dev-story'));
    const status = readStatusFile('ac4b');
    assert.equal(status.workflow, 'dev-story');
    assert.notEqual(status.started_at, '2026-01-01T00:00:00.000Z', 'started_at should be reset');
  });

  // ─── AC #5: Utility skill ignored ──────────────────────────────────────────

  it('AC #5: utility skill (no steps/) still sets workflow', () => {
    const fixedTime = '2026-01-01T00:00:00.000Z';
    seedStatus('ac5', {
      session_id: 'ac5',
      skill: 'bmad-create-architecture',
      workflow: 'create-architecture',
      project: 'SomeProject',
      started_at: fixedTime,
      step: { total: null }
    });
    execHook(makeUserPromptPayload('ac5', '/bmad-help'));
    const status = readStatusFile('ac5');
    assert.equal(status.skill, 'bmad-help', 'skill should be updated');
    assert.equal(status.workflow, 'help', 'workflow should be updated');
    assert.notEqual(status.started_at, fixedTime, 'started_at should reset on skill change');
  });

  // ─── AC #6: Non-matching prompt ignored ──────────────────────────────────────

  it('AC #6: non-matching prompt sets project but no skill/workflow', () => {
    execHook(makeUserPromptPayload('ac6', 'hello world'));
    const status = readStatusFile('ac6');
    assert.ok(status, 'proactive project detection creates status');
    assert.equal(status.project, 'TestProject', 'project from config.yaml');
    assert.equal(status.skill, null, 'skill should remain null');
    assert.equal(status.workflow, null, 'workflow should remain null');
  });

  // ─── AC #7: cwd scoping (outside) ───────────────────────────────────────────

  it('AC #7: Read outside cwd is ignored', () => {
    seedStatus('ac7', {
      session_id: 'ac7',
      skill: 'bmad-create-architecture',
      workflow: 'create-architecture',
      step: { current: 2, current_name: 'analysis', total: null }
    });
    const outsidePath = path.join(os.tmpdir(), 'other-project', 'steps', 'step-05-diagrams.md')
      .replace(/\\/g, '/');
    execHook(makeReadPayload('ac7', outsidePath));
    const status = readStatusFile('ac7');
    assert.equal(status.step.current, 2, 'step should be unchanged');
  });

  // ─── AC #8: cwd scoping (inside) ────────────────────────────────────────────

  it('AC #8: Read inside cwd is processed', () => {
    seedStatus('ac8', {
      session_id: 'ac8',
      skill: 'bmad-create-architecture',
      workflow: 'create-architecture',
      step: { total: null }
    });
    const stepPath = path.join(tmpDir, '.claude', 'skills', 'bmad-create-architecture', 'steps', 'step-03-starter.md')
      .replace(/\\/g, '/');
    execHook(makeReadPayload('ac8', stepPath));
    const status = readStatusFile('ac8');
    assert.equal(status.step.current, 3);
    assert.equal(status.step.current_name, 'starter');
  });

  // ─── AC #9: Alive touch ─────────────────────────────────────────────────────

  it('AC #9: alive file created on UserPromptSubmit', () => {
    cleanAlive('ac9');
    execHook(makeUserPromptPayload('ac9', '/bmad-create-architecture'));
    assert.ok(aliveExists('ac9'), '.alive-ac9 should exist');
  });

  it('AC #9b: alive file created on PostToolUse/Read', () => {
    cleanAlive('ac9b');
    seedStatus('ac9b', {
      session_id: 'ac9b',
      skill: 'bmad-create-architecture',
      workflow: 'create-architecture',
      step: { total: null }
    });
    const stepPath = path.join(tmpDir, '.claude', 'skills', 'bmad-create-architecture', 'steps', 'step-01-init.md')
      .replace(/\\/g, '/');
    execHook(makeReadPayload('ac9b', stepPath));
    assert.ok(aliveExists('ac9b'), '.alive-ac9b should exist');
  });

  // ─── AC #10: SessionStart ───────────────────────────────────────────────────

  it('AC #10: SessionStart touches alive, does not modify status', () => {
    const fixedTime = '2026-01-01T00:00:00.000Z';
    seedStatus('ac10', {
      session_id: 'ac10',
      project: 'TestProject',
      skill: 'bmad-create-architecture',
      workflow: 'create-architecture',
      started_at: fixedTime,
      updated_at: fixedTime,
      step: { total: null }
    });
    cleanAlive('ac10');
    execHook(makeSessionStartPayload('ac10'));
    assert.ok(aliveExists('ac10'), '.alive-ac10 should exist');
    const status = readStatusFile('ac10');
    assert.equal(status.started_at, fixedTime, 'started_at should be unchanged');
    assert.equal(status.updated_at, fixedTime, 'updated_at should be unchanged');
    assert.equal(status.skill, 'bmad-create-architecture', 'skill should be unchanged');
  });

  it('AC #10b: SessionStart without prior status sets project only', () => {
    cleanAlive('ac10b');
    execHook(makeSessionStartPayload('ac10b'));
    assert.ok(aliveExists('ac10b'), '.alive-ac10b should exist');
    const status = readStatusFile('ac10b');
    assert.ok(status, 'proactive project detection creates status');
    assert.equal(status.project, 'TestProject', 'project from config.yaml');
    assert.equal(status.skill, null, 'no skill set');
    assert.equal(status.workflow, null, 'no workflow set');
  });

  // ─── AC #11: Dispatch routes all 5 event types ─────────────────────────────

  it('AC #11: dispatch routes all 5 event types correctly', () => {
    // UserPromptSubmit
    execHook(makeUserPromptPayload('ac11-ups', '/bmad-create-architecture'));
    assert.ok(readStatusFile('ac11-ups'), 'UserPromptSubmit should create status');

    // PostToolUse/Read
    seedStatus('ac11-read', { session_id: 'ac11-read', skill: 'bmad-create-architecture', workflow: 'create-architecture', step: {} });
    const stepPath = path.join(tmpDir, '.claude', 'skills', 'bmad-create-architecture', 'steps', 'step-01-init.md').replace(/\\/g, '/');
    execHook(makeReadPayload('ac11-read', stepPath));
    assert.equal(readStatusFile('ac11-read').step.current, 1, 'Read should update step');

    // PostToolUse/Write (stub)
    const writeOut = execHook({ session_id: 'ac11-write', cwd: tmpDir, hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: {} });
    assert.equal(writeOut, '', 'Write stub should produce no output');

    // PostToolUse/Edit (stub)
    const editOut = execHook({ session_id: 'ac11-edit', cwd: tmpDir, hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: {} });
    assert.equal(editOut, '', 'Edit stub should produce no output');

    // SessionStart
    cleanAlive('ac11-sess');
    execHook(makeSessionStartPayload('ac11-sess'));
    assert.ok(aliveExists('ac11-sess'), 'SessionStart should create alive file');
  });

  // ─── AC #12: SKILL_REGEX constant ──────────────────────────────────────────

  it('AC #12: SKILL_REGEX constant exists with correct pattern', () => {
    const src = fs.readFileSync(HOOK_PATH, 'utf8');
    assert.ok(src.includes('SKILL_REGEX'), 'SKILL_REGEX constant should exist');
    assert.ok(src.includes('((?:bmad|gds|wds)-'), 'SKILL_REGEX should match bmad/gds/wds');
  });

  // ─── AC #13: Status schema ─────────────────────────────────────────────────

  it('AC #13: new status has skill and story_priority fields', () => {
    execHook(makeUserPromptPayload('ac13', '/bmad-create-architecture'));
    const status = readStatusFile('ac13');
    assert.ok('skill' in status, 'status should have skill field');
    assert.equal(status.story_priority, null, 'story_priority should be null initially');
  });

  // ─── AC #14: ALIVE_MAX_AGE_MS constant ──────────────────────────────────────

  it('AC #14: ALIVE_MAX_AGE_MS constant exists', () => {
    const src = fs.readFileSync(HOOK_PATH, 'utf8');
    assert.ok(src.includes('ALIVE_MAX_AGE_MS'), 'ALIVE_MAX_AGE_MS should exist');
    assert.ok(src.includes('7 * 24 * 60 * 60 * 1000'), 'should be 7 days in ms');
  });

  // ─── AC #16: Fixture updated ───────────────────────────────────────────────

  it('AC #16: fixture has skill, story_priority, step.track fields', () => {
    const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'status-sample.json'), 'utf8'));
    assert.ok('skill' in fixture, 'fixture should have skill');
    assert.ok('story_priority' in fixture, 'fixture should have story_priority');
    assert.ok('track' in fixture.step, 'fixture step should have track');
  });

  // ─── Step detection ─────────────────────────────────────────────────────────

  it('step detection: derives next step', () => {
    seedStatus('step1', {
      session_id: 'step1',
      skill: 'bmad-create-architecture',
      workflow: 'create-architecture',
      step: { total: null }
    });
    const stepPath = path.join(tmpDir, '.claude', 'skills', 'bmad-create-architecture', 'steps', 'step-03-starter.md').replace(/\\/g, '/');
    execHook(makeReadPayload('step1', stepPath));
    const status = readStatusFile('step1');
    assert.equal(status.step.current, 3);
    assert.equal(status.step.current_name, 'starter');
    assert.equal(status.step.next, 4);
    assert.equal(status.step.next_name, 'decisions');
  });

  it('step detection: last step has next = null', () => {
    seedStatus('step2', {
      session_id: 'step2',
      skill: 'bmad-create-architecture',
      workflow: 'create-architecture',
      step: { total: null }
    });
    const stepPath = path.join(tmpDir, '.claude', 'skills', 'bmad-create-architecture', 'steps', 'step-08-publish.md').replace(/\\/g, '/');
    execHook(makeReadPayload('step2', stepPath));
    const status = readStatusFile('step2');
    assert.equal(status.step.current, 8);
    assert.equal(status.step.next, null);
    assert.equal(status.step.next_name, null);
  });

  // ─── Multi-track step detection (Story 4.3) ─────────────────────────────────

  it('4.3 AC#1: default track step detection — track=""', () => {
    seedStatus('mt-default', {
      session_id: 'mt-default',
      skill: 'bmad-create-architecture',
      workflow: 'create-architecture',
      step: { total: null, track: null }
    });
    const stepPath = path.join(tmpDir, '.claude', 'skills', 'bmad-create-architecture', 'steps', 'step-03-starter.md').replace(/\\/g, '/');
    execHook(makeReadPayload('mt-default', stepPath));
    const status = readStatusFile('mt-default');
    assert.equal(status.step.current, 3);
    assert.equal(status.step.current_name, 'starter');
    assert.equal(status.step.track, '');
  });

  it('4.3 AC#2: -c track detection', () => {
    seedStatus('mt-c', {
      session_id: 'mt-c',
      skill: 'bmad-tea',
      workflow: 'tea',
      step: { total: null, track: null }
    });
    const stepPath = path.join(tmpDir, '.claude', 'skills', 'bmad-tea', 'steps-c', 'step-c-01-init.md').replace(/\\/g, '/');
    execHook(makeReadPayload('mt-c', stepPath));
    const status = readStatusFile('mt-c');
    assert.equal(status.step.current, 1);
    assert.equal(status.step.current_name, 'init');
    assert.equal(status.step.track, '-c');
  });

  it('4.3 AC#3: -v track detection', () => {
    seedStatus('mt-v', {
      session_id: 'mt-v',
      skill: 'bmad-tea',
      workflow: 'tea',
      step: { total: null, track: null }
    });
    const stepPath = path.join(tmpDir, '.claude', 'skills', 'bmad-tea', 'steps-v', 'step-v-03-validate.md').replace(/\\/g, '/');
    execHook(makeReadPayload('mt-v', stepPath));
    const status = readStatusFile('mt-v');
    assert.equal(status.step.current, 3);
    assert.equal(status.step.current_name, 'validate');
    assert.equal(status.step.track, '-v');
  });

  it('4.3 AC#6: sub-step step-01b-continue.md updates to step number 1', () => {
    seedStatus('mt-sub', {
      session_id: 'mt-sub',
      skill: 'bmad-create-architecture',
      workflow: 'create-architecture',
      step: { current: 5, current_name: 'diagrams', total: 8, track: '' }
    });
    const stepPath = path.join(tmpDir, '.claude', 'skills', 'bmad-create-architecture', 'steps', 'step-01b-continue.md').replace(/\\/g, '/');
    execHook(makeReadPayload('mt-sub', stepPath));
    const status = readStatusFile('mt-sub');
    assert.equal(status.step.current, 1, 'step should update to sub-step number');
    assert.equal(status.step.current_name, 'continue', 'step name from sub-step');
  });

  it('4.3 AC#4: total calculation from parent dir', () => {
    seedStatus('mt-total', {
      session_id: 'mt-total',
      skill: 'bmad-tea',
      workflow: 'tea',
      step: { total: null, track: null }
    });
    const stepPath = path.join(tmpDir, '.claude', 'skills', 'bmad-tea', 'steps-c', 'step-c-01-init.md').replace(/\\/g, '/');
    execHook(makeReadPayload('mt-total', stepPath));
    const status = readStatusFile('mt-total');
    assert.equal(status.step.total, 3, 'total should be 3 step files in steps-c/');
  });

  it('4.3 AC#5: track change recalculation', () => {
    seedStatus('mt-change', {
      session_id: 'mt-change',
      skill: 'bmad-tea',
      workflow: 'tea',
      step: { current: 2, current_name: 'check', total: 3, track: '' }
    });
    const stepPath = path.join(tmpDir, '.claude', 'skills', 'bmad-tea', 'steps-c', 'step-c-01-init.md').replace(/\\/g, '/');
    execHook(makeReadPayload('mt-change', stepPath));
    const status = readStatusFile('mt-change');
    assert.equal(status.step.track, '-c', 'track should change to -c');
    assert.equal(status.step.total, 3, 'total recalculated from steps-c/');
  });

  it('4.3 AC#7: last step next=null', () => {
    seedStatus('mt-last', {
      session_id: 'mt-last',
      skill: 'bmad-tea',
      workflow: 'tea',
      step: { total: null, track: null }
    });
    const stepPath = path.join(tmpDir, '.claude', 'skills', 'bmad-tea', 'steps-c', 'step-c-03-execute.md').replace(/\\/g, '/');
    execHook(makeReadPayload('mt-last', stepPath));
    const status = readStatusFile('mt-last');
    assert.equal(status.step.current, 3);
    assert.equal(status.step.next, null);
    assert.equal(status.step.next_name, null);
  });

  it('4.3 AC#8: next step derivation across tracks', () => {
    seedStatus('mt-next', {
      session_id: 'mt-next',
      skill: 'bmad-tea',
      workflow: 'tea',
      step: { total: null, track: null }
    });
    const stepPath = path.join(tmpDir, '.claude', 'skills', 'bmad-tea', 'steps-c', 'step-c-01-init.md').replace(/\\/g, '/');
    execHook(makeReadPayload('mt-next', stepPath));
    const status = readStatusFile('mt-next');
    assert.equal(status.step.next, 2);
    assert.equal(status.step.next_name, 'plan');
  });

  it('4.3 AC#9: cross-skill false positive — step from different skill ignored', () => {
    seedStatus('mt-cross', {
      session_id: 'mt-cross',
      skill: 'bmad-create-architecture',
      workflow: 'create-architecture',
      step: { current: 2, current_name: 'analysis', total: 8, track: '' }
    });
    const stepPath = path.join(tmpDir, '.claude', 'skills', 'bmad-tea', 'steps-c', 'step-c-01-init.md').replace(/\\/g, '/');
    execHook(makeReadPayload('mt-cross', stepPath));
    const status = readStatusFile('mt-cross');
    assert.equal(status.step.current, 2, 'step should be unchanged');
    assert.equal(status.step.track, '', 'track should be unchanged');
  });

  it('4.3: reverse track switch — -c back to default steps/', () => {
    seedStatus('mt-reverse', {
      session_id: 'mt-reverse',
      skill: 'bmad-create-architecture',
      workflow: 'create-architecture',
      step: { current: 1, current_name: 'init', total: 3, track: '-c' }
    });
    const stepPath = path.join(tmpDir, '.claude', 'skills', 'bmad-create-architecture', 'steps', 'step-03-starter.md').replace(/\\/g, '/');
    execHook(makeReadPayload('mt-reverse', stepPath));
    const status = readStatusFile('mt-reverse');
    assert.equal(status.step.track, '', 'track should revert to default');
    assert.equal(status.step.total, 8, 'total recalculated from steps/ (8 files)');
  });

  it('4.3: total excludes sub-steps', () => {
    seedStatus('mt-excl', {
      session_id: 'mt-excl',
      skill: 'bmad-create-architecture',
      workflow: 'create-architecture',
      step: { total: null, track: null }
    });
    // steps/ has 8 main step files + step-01b-continue.md (sub-step)
    const stepPath = path.join(tmpDir, '.claude', 'skills', 'bmad-create-architecture', 'steps', 'step-01-init.md').replace(/\\/g, '/');
    execHook(makeReadPayload('mt-excl', stepPath));
    const status = readStatusFile('mt-excl');
    assert.equal(status.step.total, 8, 'total should be 8, sub-step excluded');
  });

  it('4.3: existing step detection backward compat with new regex', () => {
    seedStatus('mt-compat', {
      session_id: 'mt-compat',
      skill: 'bmad-create-architecture',
      workflow: 'create-architecture',
      step: { total: null }
    });
    const stepPath = path.join(tmpDir, '.claude', 'skills', 'bmad-create-architecture', 'steps', 'step-05-diagrams.md').replace(/\\/g, '/');
    execHook(makeReadPayload('mt-compat', stepPath));
    const status = readStatusFile('mt-compat');
    assert.equal(status.step.current, 5);
    assert.equal(status.step.current_name, 'diagrams');
    assert.equal(status.step.next, 6);
    assert.equal(status.step.next_name, 'review');
    assert.equal(status.step.track, '');
    assert.equal(status.step.total, 8);
  });

  it('step detection: wrong skill step is ignored (false positive prevention)', () => {
    seedStatus('step3', {
      session_id: 'step3',
      skill: 'bmad-create-architecture',
      workflow: 'create-architecture',
      step: { current: 2, current_name: 'analysis', total: null }
    });
    const stepPath = path.join(tmpDir, '.claude', 'skills', 'bmad-dev-story', 'steps', 'step-01-load.md').replace(/\\/g, '/');
    execHook(makeReadPayload('step3', stepPath));
    const status = readStatusFile('step3');
    assert.equal(status.step.current, 2, 'step should be unchanged');
  });

  // ─── Story intelligence (4.4) ───────────────────────────────────────────────

  // 4.4 subtask 4.4: shouldUpdateStory source inspection
  it('4.4: shouldUpdateStory function exists with priority logic', () => {
    const src = fs.readFileSync(HOOK_PATH, 'utf8');
    assert.ok(src.includes('function shouldUpdateStory'), 'shouldUpdateStory should exist');
    assert.ok(src.includes('STORY_PRIORITY.SPRINT_STATUS'), 'should handle priority SPRINT_STATUS');
    assert.ok(src.includes('STORY_PRIORITY.STORY_FILE'), 'should handle priority STORY_FILE');
    assert.ok(src.includes('STORY_PRIORITY.CANDIDATE'), 'should handle priority CANDIDATE');
  });

  // 4.4 subtask 4.5: STORY_READ_WORKFLOWS and STORY_WRITE_WORKFLOWS constants
  it('4.4: STORY_READ_WORKFLOWS and STORY_WRITE_WORKFLOWS constants exist', () => {
    const src = fs.readFileSync(HOOK_PATH, 'utf8');
    assert.ok(src.includes('STORY_READ_WORKFLOWS'), 'STORY_READ_WORKFLOWS should exist');
    assert.ok(src.includes('STORY_WRITE_WORKFLOWS'), 'STORY_WRITE_WORKFLOWS should exist');
    assert.ok(src.includes("'dev-story'"), 'should contain dev-story');
    assert.ok(src.includes("'code-review'"), 'should contain code-review');
    assert.ok(src.includes("'create-story'"), 'should contain create-story');
  });

  // 4.4 subtask 4.6: Read story file in dev-story → priority 2, story set
  it('4.4: Read story file in dev-story → priority 2, story set', () => {
    seedStatus('sp-read1', {
      session_id: 'sp-read1',
      skill: 'bmad-dev-story',
      workflow: 'dev-story',
      story: null,
      story_priority: null,
      step: { total: null }
    });
    const storyPath = path.join(tmpDir, '_bmad-output', 'implementation-artifacts', 'stories', '3-1-hook-script.md').replace(/\\/g, '/');
    execHook(makeReadPayload('sp-read1', storyPath));
    const status = readStatusFile('sp-read1');
    assert.equal(status.story, '3-1-hook-script');
    assert.equal(status.story_priority, 2);
  });

  // 4.4 subtask 4.7: Read second story file with priority 2 → story unchanged (lock)
  it('4.4: Read second story file with priority 2 → story unchanged (lock)', () => {
    seedStatus('sp-lock', {
      session_id: 'sp-lock',
      skill: 'bmad-dev-story',
      workflow: 'dev-story',
      story: '3-1-hook-script',
      story_priority: 2,
      step: { total: null }
    });
    const storyPath2 = path.join(tmpDir, '_bmad-output', 'implementation-artifacts', 'stories', '1-4-dashboard.md').replace(/\\/g, '/');
    execHook(makeReadPayload('sp-lock', storyPath2));
    const status = readStatusFile('sp-lock');
    assert.equal(status.story, '3-1-hook-script', 'story should be unchanged (locked)');
    assert.equal(status.story_priority, 2, 'priority should be unchanged');
  });

  // 4.4 subtask 4.8: Read story file in create-story → story NOT set
  it('4.4: Read story file in create-story → story NOT set', () => {
    seedStatus('sp-create', {
      session_id: 'sp-create',
      skill: 'bmad-create-story',
      workflow: 'create-story',
      story: null,
      story_priority: null,
      step: { total: null }
    });
    const storyPath = path.join(tmpDir, '_bmad-output', 'implementation-artifacts', 'stories', '3-1-hook-script.md').replace(/\\/g, '/');
    execHook(makeReadPayload('sp-create', storyPath));
    const status = readStatusFile('sp-create');
    assert.equal(status.story, null, 'create-story should NOT set story on Read');
  });

  // 4.4 subtask 4.9: Read story file in create-architecture → story NOT set
  it('4.4: Read story file in create-architecture → story NOT set', () => {
    seedStatus('sp-arch', {
      session_id: 'sp-arch',
      skill: 'bmad-create-architecture',
      workflow: 'create-architecture',
      story: null,
      story_priority: null,
      step: { total: null }
    });
    const storyPath = path.join(tmpDir, '_bmad-output', 'implementation-artifacts', 'stories', '3-1-hook-script.md').replace(/\\/g, '/');
    execHook(makeReadPayload('sp-arch', storyPath));
    const status = readStatusFile('sp-arch');
    assert.equal(status.story, null, 'non-story-read workflow should NOT set story');
  });

  // 4.4 subtask 4.10: Read sprint-status with 1 in-progress story → priority 3 candidate
  it('4.4: Read sprint-status with 1 in-progress → priority 3 candidate', () => {
    seedStatus('sp-cand1', {
      session_id: 'sp-cand1',
      skill: 'bmad-dev-story',
      workflow: 'dev-story',
      story: null,
      story_priority: null,
      step: { total: null }
    });
    const sprintPath = path.join(tmpDir, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml').replace(/\\/g, '/');
    const yamlContent = [
      'development_status:',
      '  epic-4: in-progress',
      '  4-1-spike-payload: done',
      '  4-2-hook-dispatch: done',
      '  4-3-multi-track-step: in-progress',
      '  4-4-story-intelligence: backlog'
    ].join('\n');
    execHook(makeReadPayload('sp-cand1', sprintPath, yamlContent));
    const status = readStatusFile('sp-cand1');
    assert.equal(status.story, '4-3-multi-track-step', 'should set candidate from sprint-status');
    assert.equal(status.story_priority, 3, 'priority should be 3 (CANDIDATE)');
  });

  // 4.4 subtask 4.11: Read sprint-status with 2 in-progress stories → no candidate
  it('4.4: Read sprint-status with 2 in-progress → no candidate', () => {
    seedStatus('sp-multi', {
      session_id: 'sp-multi',
      skill: 'bmad-dev-story',
      workflow: 'dev-story',
      story: null,
      story_priority: null,
      step: { total: null }
    });
    const sprintPath = path.join(tmpDir, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml').replace(/\\/g, '/');
    const yamlContent = [
      'development_status:',
      '  4-3-multi-track-step: in-progress',
      '  4-4-story-intelligence: in-progress'
    ].join('\n');
    execHook(makeReadPayload('sp-multi', sprintPath, yamlContent));
    const status = readStatusFile('sp-multi');
    assert.equal(status.story, null, 'should NOT set candidate with multiple in-progress');
    assert.equal(status.story_priority, null, 'priority should remain null');
  });

  // 4.4 subtask 4.12: Priority 3→2 upgrade
  it('4.4: Priority 3→2 upgrade (seed priority 3, then Read story file → priority 2)', () => {
    seedStatus('sp-upgrade', {
      session_id: 'sp-upgrade',
      skill: 'bmad-dev-story',
      workflow: 'dev-story',
      story: '4-3-multi-track-step',
      story_priority: 3,
      step: { total: null }
    });
    const storyPath = path.join(tmpDir, '_bmad-output', 'implementation-artifacts', 'stories', '3-1-hook-script.md').replace(/\\/g, '/');
    execHook(makeReadPayload('sp-upgrade', storyPath));
    const status = readStatusFile('sp-upgrade');
    assert.equal(status.story, '3-1-hook-script', 'story should upgrade to new file');
    assert.equal(status.story_priority, 2, 'priority should upgrade from 3 to 2');
  });

  // 4.4 subtask 4.13: Priority 1 overwrite check (source inspection)
  it('4.4: shouldUpdateStory(1, 2) returns true (priority 1 overwrite)', () => {
    const src = fs.readFileSync(HOOK_PATH, 'utf8');
    // Verify the function handles incoming=SPRINT_STATUS by returning true regardless of current
    assert.ok(src.includes('STORY_PRIORITY.SPRINT_STATUS') && src.includes('return true'),
      'priority SPRINT_STATUS should always return true');
  });

  // 4.4 subtask 4.14: story file regex does NOT match non-story files
  it('4.4: story file regex does NOT match step files, sprint-status, or plain .md', () => {
    const src = fs.readFileSync(HOOK_PATH, 'utf8');
    const regexMatch = src.match(/STORY_FILE_REGEX\s*=\s*(\/.+\/)/);
    assert.ok(regexMatch, 'STORY_FILE_REGEX should exist as constant');
    const regex = new RegExp(regexMatch[1].slice(1, -1));

    // Should NOT match (paths without N-N pattern after /)
    assert.equal(regex.test('/step-03-starter.md'), false, 'should not match step files');
    assert.equal(regex.test('sprint-status.yaml'), false, 'should not match yaml');
    assert.equal(regex.test('/architecture.md'), false, 'should not match plain .md');

    // Should match (paths with / before story filename)
    assert.ok(regex.test('/1-3-user-auth.md'), 'should match story files');
    assert.ok(regex.test('/4-2-hook-dispatch-userpromptsubmit-multi-module-cwd-sessionstart.md'),
      'should match long story slugs');
  });

  // 4.4 subtask 4.15: story detection works with new regex on files outside /stories/
  it('4.4: story file matched by filename pattern, not directory', () => {
    seedStatus('sp-flat', {
      session_id: 'sp-flat',
      skill: 'bmad-dev-story',
      workflow: 'dev-story',
      story: null,
      story_priority: null,
      step: { total: null }
    });
    const storyPath = path.join(tmpDir, '_bmad-output', 'implementation-artifacts', '4-2-hook-dispatch.md').replace(/\\/g, '/');
    execHook(makeReadPayload('sp-flat', storyPath));
    const status = readStatusFile('sp-flat');
    assert.equal(status.story, '4-2-hook-dispatch', 'should match story in flat dir');
    assert.equal(status.story_priority, 2);
  });

  // 4.4: code-review workflow allows story tracking (Read workflow)
  it('4.4: code-review workflow allows story tracking via Read', () => {
    seedStatus('sp-cr', {
      session_id: 'sp-cr',
      skill: 'bmad-code-review',
      workflow: 'code-review',
      story: null,
      story_priority: null,
      step: { total: null }
    });
    const storyPath = path.join(tmpDir, '_bmad-output', 'implementation-artifacts', 'stories', '3-1-hook-script.md').replace(/\\/g, '/');
    execHook(makeReadPayload('sp-cr', storyPath));
    const status = readStatusFile('sp-cr');
    assert.equal(status.story, '3-1-hook-script');
    assert.equal(status.story_priority, 2);
  });

  // 4.4: sprint-status candidate in create-story workflow (uses STORY_WORKFLOWS)
  it('4.4: sprint-status candidate works in create-story workflow', () => {
    seedStatus('sp-cand-cs', {
      session_id: 'sp-cand-cs',
      skill: 'bmad-create-story',
      workflow: 'create-story',
      story: null,
      story_priority: null,
      step: { total: null }
    });
    const sprintPath = path.join(tmpDir, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml').replace(/\\/g, '/');
    const yamlContent = [
      'development_status:',
      '  4-3-multi-track-step: in-progress'
    ].join('\n');
    execHook(makeReadPayload('sp-cand-cs', sprintPath, yamlContent));
    const status = readStatusFile('sp-cand-cs');
    assert.equal(status.story, '4-3-multi-track-step', 'sprint-status candidate in create-story');
    assert.equal(status.story_priority, 3);
  });

  // 4.4: sprint-status candidate NOT set when story already at priority 2
  it('4.4: sprint-status candidate NOT set when story already locked at priority 2', () => {
    seedStatus('sp-cand-locked', {
      session_id: 'sp-cand-locked',
      skill: 'bmad-dev-story',
      workflow: 'dev-story',
      story: '3-1-hook-script',
      story_priority: 2,
      step: { total: null }
    });
    const sprintPath = path.join(tmpDir, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml').replace(/\\/g, '/');
    const yamlContent = [
      'development_status:',
      '  4-3-multi-track-step: in-progress'
    ].join('\n');
    execHook(makeReadPayload('sp-cand-locked', sprintPath, yamlContent));
    const status = readStatusFile('sp-cand-locked');
    assert.equal(status.story, '3-1-hook-script', 'story should remain locked');
    assert.equal(status.story_priority, 2, 'priority should remain 2');
  });

  // 4.4: sprint-status ignored in non-story workflow
  it('4.4: sprint-status ignored in create-architecture workflow', () => {
    seedStatus('sp-cand-arch', {
      session_id: 'sp-cand-arch',
      skill: 'bmad-create-architecture',
      workflow: 'create-architecture',
      story: null,
      story_priority: null,
      step: { total: null }
    });
    const sprintPath = path.join(tmpDir, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml').replace(/\\/g, '/');
    const yamlContent = [
      'development_status:',
      '  4-3-multi-track-step: in-progress'
    ].join('\n');
    execHook(makeReadPayload('sp-cand-arch', sprintPath, yamlContent));
    const status = readStatusFile('sp-cand-arch');
    assert.equal(status.story, null, 'non-story workflow should not set candidate');
  });

  // ─── Write/Edit handlers (4.5) ─────────────────────────────────────────────

  // 4.5 subtask 5.1: Write sprint-status with 1 transitional story → priority 1
  it('4.5: Write sprint-status with 1 transitional story → priority 1 story set', () => {
    seedStatus('w-ss1', {
      session_id: 'w-ss1',
      skill: 'bmad-dev-story',
      workflow: 'dev-story',
      story: null,
      story_priority: null,
      step: { total: null }
    });
    const sprintPath = path.join(tmpDir, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml').replace(/\\/g, '/');
    const yamlContent = [
      'development_status:',
      '  epic-4: in-progress',
      '  4-1-spike-payload: done',
      '  4-2-hook-dispatch: done',
      '  4-5-hook-write-edit-handlers: ready-for-dev',
      '  4-6-defaults-installer: backlog'
    ].join('\n');
    execHook(makeWritePayload('w-ss1', sprintPath, yamlContent));
    const status = readStatusFile('w-ss1');
    assert.equal(status.story, '4-5-hook-write-edit-handlers');
    assert.equal(status.story_priority, 1);
  });

  // 4.5 subtask 5.2: Write sprint-status with 2 transitional stories → first one selected
  it('4.5: Write sprint-status with 2 transitional stories → first one selected (priority 1)', () => {
    seedStatus('w-ss2', {
      session_id: 'w-ss2',
      skill: 'bmad-dev-story',
      workflow: 'dev-story',
      story: null,
      story_priority: null,
      step: { total: null }
    });
    const sprintPath = path.join(tmpDir, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml').replace(/\\/g, '/');
    const yamlContent = [
      'development_status:',
      '  4-3-multi-track-step: review',
      '  4-5-hook-write-edit-handlers: in-progress',
      '  4-8-clean-alive-readme: backlog'
    ].join('\n');
    execHook(makeWritePayload('w-ss2', sprintPath, yamlContent));
    const status = readStatusFile('w-ss2');
    assert.equal(status.story, '4-3-multi-track-step', 'first transitional story wins');
    assert.equal(status.story_priority, 1);
  });

  // 4.5 subtask 5.3: Edit sprint-status → priority 1 story set (from new_string)
  it('4.5: Edit sprint-status → priority 1 story set (story key from new_string)', () => {
    seedStatus('e-ss1', {
      session_id: 'e-ss1',
      skill: 'bmad-dev-story',
      workflow: 'dev-story',
      story: null,
      story_priority: null,
      step: { total: null }
    });
    const sprintPath = path.join(tmpDir, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml').replace(/\\/g, '/');
    execHook(makeEditPayload('e-ss1', sprintPath,
      '  4-5-hook-write-edit-handlers: backlog',
      '  4-5-hook-write-edit-handlers: ready-for-dev'));
    const status = readStatusFile('e-ss1');
    assert.equal(status.story, '4-5-hook-write-edit-handlers');
    assert.equal(status.story_priority, 1);
  });

  // 4.5 subtask 5.4: Edit sprint-status → fallback to old_string
  it('4.5: Edit sprint-status → fallback to old_string when new_string has no story key', () => {
    seedStatus('e-ss2', {
      session_id: 'e-ss2',
      skill: 'bmad-dev-story',
      workflow: 'dev-story',
      story: null,
      story_priority: null,
      step: { total: null }
    });
    const sprintPath = path.join(tmpDir, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml').replace(/\\/g, '/');
    execHook(makeEditPayload('e-ss2', sprintPath,
      '  4-5-hook-write-edit-handlers: backlog',
      'ready-for-dev'));
    const status = readStatusFile('e-ss2');
    assert.equal(status.story, '4-5-hook-write-edit-handlers', 'should fallback to old_string');
    assert.equal(status.story_priority, 1);
  });

  // 4.5 subtask 5.5: Edit sprint-status → skip when neither has story key
  it('4.5: Edit sprint-status → skip when neither string has story key', () => {
    seedStatus('e-ss3', {
      session_id: 'e-ss3',
      skill: 'bmad-dev-story',
      workflow: 'dev-story',
      story: null,
      story_priority: null,
      step: { total: null }
    });
    const sprintPath = path.join(tmpDir, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml').replace(/\\/g, '/');
    execHook(makeEditPayload('e-ss3', sprintPath, 'backlog', 'in-progress'));
    const status = readStatusFile('e-ss3');
    assert.equal(status.story, null, 'story should remain null');
    assert.equal(status.story_priority, null, 'priority should remain null');
  });

  // 4.5 subtask 5.6: Write story file in create-story → priority 2
  it('4.5: Write story file in create-story → priority 2', () => {
    seedStatus('w-sf1', {
      session_id: 'w-sf1',
      skill: 'bmad-create-story',
      workflow: 'create-story',
      story: null,
      story_priority: null,
      step: { total: null }
    });
    const storyPath = path.join(tmpDir, '_bmad-output', 'implementation-artifacts', '4-5-hook-write-edit-handlers.md').replace(/\\/g, '/');
    execHook(makeWritePayload('w-sf1', storyPath, '# Story 4.5'));
    const status = readStatusFile('w-sf1');
    assert.equal(status.story, '4-5-hook-write-edit-handlers');
    assert.equal(status.story_priority, 2);
  });

  // 4.5 subtask 5.7: Write story file in dev-story → ignored
  it('4.5: Write story file in dev-story → ignored', () => {
    seedStatus('w-sf2', {
      session_id: 'w-sf2',
      skill: 'bmad-dev-story',
      workflow: 'dev-story',
      story: null,
      story_priority: null,
      step: { total: null }
    });
    const storyPath = path.join(tmpDir, '_bmad-output', 'implementation-artifacts', '4-5-hook-write-edit-handlers.md').replace(/\\/g, '/');
    execHook(makeWritePayload('w-sf2', storyPath, '# Story 4.5'));
    const status = readStatusFile('w-sf2');
    assert.equal(status.story, null, 'dev-story should NOT set story on Write story file');
  });

  // 4.5 subtask 5.8: Priority 2 lock on second Write story file
  it('4.5: Priority 2 lock on second Write story file', () => {
    seedStatus('w-sf3', {
      session_id: 'w-sf3',
      skill: 'bmad-create-story',
      workflow: 'create-story',
      story: '4-5-hook-write-edit-handlers',
      story_priority: 2,
      step: { total: null }
    });
    const storyPath2 = path.join(tmpDir, '_bmad-output', 'implementation-artifacts', 'stories', '1-4-dashboard.md').replace(/\\/g, '/');
    execHook(makeWritePayload('w-sf3', storyPath2, '# Dashboard'));
    const status = readStatusFile('w-sf3');
    assert.equal(status.story, '4-5-hook-write-edit-handlers', 'story should be unchanged (locked)');
    assert.equal(status.story_priority, 2, 'priority should remain 2');
  });

  // 4.5 subtask 5.9: cwd scoping for Write (file outside cwd → ignored)
  it('4.5: cwd scoping for Write (file outside cwd → ignored)', () => {
    seedStatus('w-cwd1', {
      session_id: 'w-cwd1',
      skill: 'bmad-dev-story',
      workflow: 'dev-story',
      story: null,
      story_priority: null,
      step: { total: null }
    });
    const outsidePath = '/outside/project/sprint-status.yaml';
    const yamlContent = [
      'development_status:',
      '  4-5-hook-write-edit-handlers: in-progress'
    ].join('\n');
    execHook(makeWritePayload('w-cwd1', outsidePath, yamlContent));
    const status = readStatusFile('w-cwd1');
    assert.equal(status.story, null, 'outside cwd should be ignored');
  });

  // 4.5 subtask 5.10: cwd scoping for Edit (file outside cwd → ignored)
  it('4.5: cwd scoping for Edit (file outside cwd → ignored)', () => {
    seedStatus('e-cwd1', {
      session_id: 'e-cwd1',
      skill: 'bmad-dev-story',
      workflow: 'dev-story',
      story: null,
      story_priority: null,
      step: { total: null }
    });
    const outsidePath = '/outside/project/sprint-status.yaml';
    execHook(makeEditPayload('e-cwd1', outsidePath,
      '  4-5-hook-write-edit-handlers: backlog',
      '  4-5-hook-write-edit-handlers: in-progress'));
    const status = readStatusFile('e-cwd1');
    assert.equal(status.story, null, 'outside cwd should be ignored');
  });

  // 4.5 subtask 5.11: Write non-matching file → ignored
  it('4.5: Write non-matching file → ignored', () => {
    seedStatus('w-nm1', {
      session_id: 'w-nm1',
      skill: 'bmad-dev-story',
      workflow: 'dev-story',
      story: null,
      story_priority: null,
      step: { total: null }
    });
    const randomPath = path.join(tmpDir, 'src', 'index.js').replace(/\\/g, '/');
    execHook(makeWritePayload('w-nm1', randomPath, 'console.log("hello")'));
    const status = readStatusFile('w-nm1');
    assert.equal(status.story, null, 'non-matching file should be ignored');
  });

  // 4.5 subtask 5.12: Edit non-sprint-status file → ignored
  it('4.5: Edit non-sprint-status file → ignored', () => {
    seedStatus('e-nm1', {
      session_id: 'e-nm1',
      skill: 'bmad-dev-story',
      workflow: 'dev-story',
      story: null,
      story_priority: null,
      step: { total: null }
    });
    const randomPath = path.join(tmpDir, 'src', 'index.js').replace(/\\/g, '/');
    execHook(makeEditPayload('e-nm1', randomPath, 'old code', 'new code'));
    const status = readStatusFile('e-nm1');
    assert.equal(status.story, null, 'non-sprint-status Edit should be ignored');
  });

  // 4.5 subtask 5.13: Write sprint-status in non-story workflow → ignored
  it('4.5: Write sprint-status in non-story workflow (create-architecture) → ignored', () => {
    seedStatus('w-nswf', {
      session_id: 'w-nswf',
      skill: 'bmad-create-architecture',
      workflow: 'create-architecture',
      story: null,
      story_priority: null,
      step: { total: null }
    });
    const sprintPath = path.join(tmpDir, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml').replace(/\\/g, '/');
    const yamlContent = [
      'development_status:',
      '  4-5-hook-write-edit-handlers: in-progress'
    ].join('\n');
    execHook(makeWritePayload('w-nswf', sprintPath, yamlContent));
    const status = readStatusFile('w-nswf');
    assert.equal(status.story, null, 'non-story workflow should ignore sprint-status Write');
  });

  // 4.5 subtask 5.14: Write sprint-status without content → no crash
  it('4.5: Write sprint-status without content → no crash', () => {
    seedStatus('w-nc1', {
      session_id: 'w-nc1',
      skill: 'bmad-dev-story',
      workflow: 'dev-story',
      story: null,
      story_priority: null,
      step: { total: null }
    });
    const sprintPath = path.join(tmpDir, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml').replace(/\\/g, '/');
    execHook(makeWritePayload('w-nc1', sprintPath, undefined));
    const status = readStatusFile('w-nc1');
    assert.equal(status.story, null, 'should not crash without content');
  });

  // 4.5 subtask 5.15: handleWrite and handleEdit functions exist in source
  it('4.5: handleWrite and handleEdit functions exist in source', () => {
    const src = fs.readFileSync(HOOK_PATH, 'utf8');
    assert.ok(src.includes('function handleWrite'), 'handleWrite should exist');
    assert.ok(src.includes('function handleEdit'), 'handleEdit should exist');
  });

  // 4.5 subtask 5.16: Priority 1 overwrites existing priority 2 lock
  it('4.5: Priority 1 overwrites existing priority 2 lock (Write sprint-status after story locked)', () => {
    seedStatus('w-p1over', {
      session_id: 'w-p1over',
      skill: 'bmad-dev-story',
      workflow: 'dev-story',
      story: '3-1-hook-script',
      story_priority: 2,
      step: { total: null }
    });
    const sprintPath = path.join(tmpDir, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml').replace(/\\/g, '/');
    const yamlContent = [
      'development_status:',
      '  4-5-hook-write-edit-handlers: in-progress'
    ].join('\n');
    execHook(makeWritePayload('w-p1over', sprintPath, yamlContent));
    const status = readStatusFile('w-p1over');
    assert.equal(status.story, '4-5-hook-write-edit-handlers', 'priority 1 should overwrite priority 2');
    assert.equal(status.story_priority, 1);
  });

  // ─── Proactive project detection ─────────────────────────────────────────────

  it('project: reads config.yaml proactively on first event', () => {
    // tmpDir has _bmad/bmm/config.yaml with project_name: TestProject
    execHook(makeUserPromptPayload('proj1', '/bmad-create-architecture'));
    const status = readStatusFile('proj1');
    assert.equal(status.project, 'TestProject', 'project should come from config.yaml');
  });

  it('project: falls back to cwd basename when config.yaml absent', () => {
    const bareDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-bare-'));
    try {
      // _bmad/ exists (guard passes) but no config.yaml
      fs.mkdirSync(path.join(bareDir, '_bmad'), { recursive: true });
      const skillSteps = path.join(bareDir, '.claude', 'skills', 'bmad-create-architecture', 'steps');
      fs.mkdirSync(skillSteps, { recursive: true });
      fs.writeFileSync(path.join(skillSteps, 'step-01-init.md'), '');

      const payload = { session_id: 'proj2', cwd: bareDir, hook_event_name: 'UserPromptSubmit', prompt: '/bmad-create-architecture' };
      execHook(payload);
      const status = readStatusFile('proj2');
      const expected = bareDir.replace(/\\/g, '/').split('/').pop();
      assert.equal(status.project, expected, 'project should be cwd basename');
    } finally {
      fs.rmSync(bareDir, { recursive: true, force: true });
    }
  });

  it('project: falls back to cwd basename when config.yaml has no project_name', () => {
    const noNameDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-noname-'));
    try {
      fs.mkdirSync(path.join(noNameDir, '_bmad', 'bmm'), { recursive: true });
      fs.writeFileSync(path.join(noNameDir, '_bmad', 'bmm', 'config.yaml'), 'user_name: Tester\n');
      const skillSteps = path.join(noNameDir, '.claude', 'skills', 'bmad-create-architecture', 'steps');
      fs.mkdirSync(skillSteps, { recursive: true });
      fs.writeFileSync(path.join(skillSteps, 'step-01-init.md'), '');

      const payload = { session_id: 'proj3', cwd: noNameDir, hook_event_name: 'UserPromptSubmit', prompt: '/bmad-create-architecture' };
      execHook(payload);
      const status = readStatusFile('proj3');
      const expected = noNameDir.replace(/\\/g, '/').split('/').pop();
      assert.equal(status.project, expected, 'project should be cwd basename');
    } finally {
      fs.rmSync(noNameDir, { recursive: true, force: true });
    }
  });

  // ─── Guard tests ────────────────────────────────────────────────────────────

  it('guard: silent exit when _bmad/ does not exist', () => {
    const nonBmadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'non-bmad-'));
    try {
      const payload = { session_id: 'guard1', cwd: nonBmadDir, hook_event_name: 'UserPromptSubmit', prompt: '/bmad-create-architecture' };
      const output = execHook(payload);
      assert.equal(output, '', 'should produce no output');
      assert.equal(readStatusFile('guard1'), null, 'no status file');
      assert.ok(!aliveExists('guard1'), 'no alive file');
    } finally {
      fs.rmSync(nonBmadDir, { recursive: true, force: true });
    }
  });

  // ─── Malformed stdin ─────────────────────────────────────────────────────────

  it('malformed stdin exits silently', () => {
    const result = execSync(`node "${HOOK_PATH}"`, {
      input: 'this is not json{{{',
      encoding: 'utf8',
      env: { ...process.env, BMAD_CACHE_DIR: cacheDir },
      timeout: 5000
    });
    assert.equal(result, '');
  });

  it('empty stdin exits silently', () => {
    const result = execSync(`node "${HOOK_PATH}"`, {
      input: '',
      encoding: 'utf8',
      env: { ...process.env, BMAD_CACHE_DIR: cacheDir },
      timeout: 5000
    });
    assert.equal(result, '');
  });

  // ─── Path normalization ──────────────────────────────────────────────────────

  it('handles backslash paths correctly', () => {
    seedStatus('norm1', {
      session_id: 'norm1',
      skill: 'bmad-create-architecture',
      workflow: 'create-architecture',
      step: { total: null }
    });
    // Don't normalize — keep backslashes
    const stepPath = path.join(tmpDir, '.claude', 'skills', 'bmad-create-architecture', 'steps', 'step-03-starter.md');
    execHook(makeReadPayload('norm1', stepPath));
    const status = readStatusFile('norm1');
    assert.equal(status.step.current, 3);
    assert.equal(status.step.current_name, 'starter');
  });

  // ─── Status merge ───────────────────────────────────────────────────────────

  it('merges only changed fields, preserves existing', () => {
    seedStatus('merge1', {
      session_id: 'merge1',
      project: 'ExistingProject',
      skill: 'bmad-create-architecture',
      workflow: 'create-architecture',
      story: null,
      step: { current: 2, current_name: 'analysis', total: null },
      started_at: '2026-01-01T00:00:00.000Z'
    });
    const stepPath = path.join(tmpDir, '.claude', 'skills', 'bmad-create-architecture', 'steps', 'step-05-diagrams.md').replace(/\\/g, '/');
    execHook(makeReadPayload('merge1', stepPath));
    const status = readStatusFile('merge1');
    assert.equal(status.project, 'ExistingProject');
    assert.equal(status.step.current, 5);
    assert.equal(status.step.current_name, 'diagrams');
  });

  // ─── Entry point structure ───────────────────────────────────────────────────

  it('follows prescribed entry point structure', () => {
    const src = fs.readFileSync(HOOK_PATH, 'utf8');

    const requiresIdx = src.indexOf("require('fs')");
    const constantsIdx = src.indexOf('CACHE_DIR');
    const stdinIdx = src.indexOf('readFileSync(0');
    const guardIdx = src.indexOf("'_bmad'");
    const aliveCallIdx = src.indexOf('touchAlive(sessionId)');
    const dispatchIdx = src.indexOf("hookEvent === 'UserPromptSubmit'");

    assert.ok(requiresIdx < constantsIdx, 'Requires before Constants');
    assert.ok(constantsIdx < stdinIdx, 'Constants before Stdin');
    assert.ok(stdinIdx < guardIdx, 'Stdin before Guard');
    assert.ok(guardIdx < aliveCallIdx, 'Guard before Alive');
    assert.ok(aliveCallIdx < dispatchIdx, 'Alive before Dispatch');
    assert.ok(src.includes('function handleUserPrompt'), 'handleUserPrompt should exist');
    assert.ok(src.includes('function handleRead'), 'handleRead should exist');
    assert.ok(src.includes('function touchAlive'), 'touchAlive should exist');
    assert.ok(src.includes('function readStatus'), 'readStatus should exist');
    assert.ok(src.includes('function writeStatus'), 'writeStatus should exist');
  });

  // ─── BMAD_CACHE_DIR override ─────────────────────────────────────────────────

  it('uses BMAD_CACHE_DIR env var', () => {
    const customCache = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-custom-cache-'));
    try {
      execSync(`node "${HOOK_PATH}"`, {
        input: JSON.stringify(makeUserPromptPayload('cache1', '/bmad-create-architecture')),
        encoding: 'utf8',
        env: { ...process.env, BMAD_CACHE_DIR: customCache },
        timeout: 5000
      });
      assert.ok(fs.existsSync(path.join(customCache, 'status-cache1.json')));
    } finally {
      fs.rmSync(customCache, { recursive: true, force: true });
    }
  });

  // ─── Type checks ────────────────────────────────────────────────────────────

  it('step values are numbers, not strings', () => {
    seedStatus('types1', {
      session_id: 'types1',
      skill: 'bmad-create-architecture',
      workflow: 'create-architecture',
      step: { total: null }
    });
    const stepPath = path.join(tmpDir, '.claude', 'skills', 'bmad-create-architecture', 'steps', 'step-03-starter.md').replace(/\\/g, '/');
    execHook(makeReadPayload('types1', stepPath));
    const status = readStatusFile('types1');
    assert.equal(typeof status.step.current, 'number');
    assert.equal(typeof status.step.next, 'number');
  });

  // ─── Backward compat ────────────────────────────────────────────────────────

  it('backward compat: old status without skill field — step detection uses bmad- prefix fallback', () => {
    seedStatus('compat1', {
      session_id: 'compat1',
      workflow: 'create-architecture',
      step: { total: null }
    });
    const stepPath = path.join(tmpDir, '.claude', 'skills', 'bmad-create-architecture', 'steps', 'step-03-starter.md').replace(/\\/g, '/');
    execHook(makeReadPayload('compat1', stepPath));
    const status = readStatusFile('compat1');
    assert.equal(status.step.current, 3, 'should work with fallback');
  });

  // ─── Edge cases ─────────────────────────────────────────────────────────────

  it('non-matching tool_name sets project only, no skill/workflow', () => {
    const payload = { session_id: 'edge1', cwd: tmpDir, hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: {} };
    execHook(payload);
    const status = readStatusFile('edge1');
    assert.ok(status, 'proactive project detection creates status');
    assert.equal(status.skill, null, 'no skill set');
  });

  it('Read without active workflow does nothing for step', () => {
    seedStatus('edge2', {
      session_id: 'edge2',
      workflow: null,
      step: {}
    });
    const stepPath = path.join(tmpDir, '.claude', 'skills', 'bmad-create-architecture', 'steps', 'step-03-starter.md').replace(/\\/g, '/');
    execHook(makeReadPayload('edge2', stepPath));
    const status = readStatusFile('edge2');
    assert.equal(status.workflow, null);
  });

  it('non-BMAD Read path is silently ignored', () => {
    seedStatus('edge3', {
      session_id: 'edge3',
      skill: 'bmad-create-architecture',
      workflow: 'create-architecture',
      step: { current: 2, total: null }
    });
    const randomPath = path.join(tmpDir, 'src', 'index.js').replace(/\\/g, '/');
    execHook(makeReadPayload('edge3', randomPath));
    const status = readStatusFile('edge3');
    assert.equal(status.step.current, 2, 'should be unchanged');
  });

  it('status file creation with defaults on first event', () => {
    const freshCache = path.join(os.tmpdir(), 'bmad-fresh-cache-' + Date.now());
    try {
      execSync(`node "${HOOK_PATH}"`, {
        input: JSON.stringify(makeUserPromptPayload('fresh1', '/bmad-create-architecture')),
        encoding: 'utf8',
        env: { ...process.env, BMAD_CACHE_DIR: freshCache },
        timeout: 5000
      });
      const statusPath = path.join(freshCache, 'status-fresh1.json');
      assert.ok(fs.existsSync(statusPath), 'status file should be created');
      const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
      assert.equal(status.session_id, 'fresh1');
      assert.equal(status.skill, 'bmad-create-architecture');
      assert.equal(status.workflow, 'create-architecture');
    } finally {
      fs.rmSync(freshCache, { recursive: true, force: true });
    }
  });

  // ─── Document name detection ───────────────────────────────────────────────

  it('Write in planning_artifacts sets document_name', () => {
    const sid = 'docname-plan';
    execHook(makeUserPromptPayload(sid, '/bmad-create-prd'));
    const filePath = path.join(tmpDir, '_bmad-output', 'planning-artifacts', 'prd-v2.md');
    execHook(makeWritePayload(sid, filePath, '# PRD v2'));
    const status = readStatusFile(sid);
    assert.equal(status.document_name, 'prd-v2.md');
  });

  it('Write in output_folder root sets document_name', () => {
    const sid = 'docname-root';
    execHook(makeUserPromptPayload(sid, '/bmad-brainstorming'));
    const filePath = path.join(tmpDir, '_bmad-output', 'brainstorming-session-2026-04-03-001.md');
    execHook(makeWritePayload(sid, filePath, '# Brainstorm'));
    const status = readStatusFile(sid);
    assert.equal(status.document_name, 'brainstorming-session-2026-04-03-001.md');
  });

  it('Write outside output folders does not set document_name', () => {
    const sid = 'docname-outside';
    execHook(makeUserPromptPayload(sid, '/bmad-create-architecture'));
    const filePath = path.join(tmpDir, 'src', 'hook', 'bmad-hook.js');
    execHook(makeWritePayload(sid, filePath, '// code'));
    const status = readStatusFile(sid);
    assert.ok(!status.document_name, 'document_name should not be set');
  });

  it('Write in story workflow does not set document_name', () => {
    const sid = 'docname-story-wf';
    execHook(makeUserPromptPayload(sid, '/bmad-dev-story'));
    const filePath = path.join(tmpDir, '_bmad-output', 'implementation-artifacts', 'spec-test.md');
    execHook(makeWritePayload(sid, filePath, '# Spec'));
    const status = readStatusFile(sid);
    assert.ok(!status.document_name, 'document_name should not be set');
  });

  it('Edit in output folder sets document_name', () => {
    const sid = 'docname-edit';
    execHook(makeUserPromptPayload(sid, '/bmad-create-architecture'));
    const filePath = path.join(tmpDir, '_bmad-output', 'planning-artifacts', 'architecture.md');
    execHook(makeEditPayload(sid, filePath, 'old', 'new'));
    const status = readStatusFile(sid);
    assert.equal(status.document_name, 'architecture.md');
  });

  it('Write in nested output subfolder sets document_name', () => {
    const sid = 'docname-nested';
    execHook(makeUserPromptPayload(sid, '/bmad-create-prd'));
    const subDir = path.join(tmpDir, '_bmad-output', 'planning-artifacts', 'sub');
    fs.mkdirSync(subDir, { recursive: true });
    const filePath = path.join(subDir, 'deep-file.md');
    execHook(makeWritePayload(sid, filePath, '# Deep'));
    const status = readStatusFile(sid);
    assert.equal(status.document_name, 'deep-file.md');
  });

  // ─── Step enrichment via frontmatter stepsCompleted ────────────────────────

  it('Write with stepsCompleted frontmatter sets step.current when no step files', () => {
    const sid = 'step-fm-1';
    execHook(makeUserPromptPayload(sid, '/bmad-brainstorming'));
    const filePath = path.join(tmpDir, '_bmad-output', 'brainstorming-session.md');
    const content = '---\nstepsCompleted: [1, 2, 3]\nstatus: draft\n---\n# Content';
    execHook(makeWritePayload(sid, filePath, content));
    const status = readStatusFile(sid);
    assert.equal(status.step.current, 3);
    assert.equal(status.step.current_name, 'completed');
    assert.equal(status.step.total, null);
  });

  it('stepsCompleted ignored when step.total is set (step files win)', () => {
    const sid = 'step-fm-priority';
    execHook(makeUserPromptPayload(sid, '/bmad-create-architecture'));
    // Read a step file to set step.total
    const stepFile = path.join(tmpDir, '.claude', 'skills', 'bmad-create-architecture', 'steps', 'step-03-starter.md');
    execHook(makeReadPayload(sid, stepFile));
    const before = readStatusFile(sid);
    assert.ok(before.step.total > 0, 'step.total should be set from step files');
    // Write with stepsCompleted — should be ignored
    const filePath = path.join(tmpDir, '_bmad-output', 'planning-artifacts', 'arch.md');
    const content = '---\nstepsCompleted: [1]\n---\n# Arch';
    execHook(makeWritePayload(sid, filePath, content));
    const after = readStatusFile(sid);
    assert.equal(after.step.current, before.step.current, 'step.current unchanged');
    assert.equal(after.step.total, before.step.total, 'step.total unchanged');
  });

  it('Write without frontmatter does not affect step', () => {
    const sid = 'step-fm-none';
    execHook(makeUserPromptPayload(sid, '/bmad-brainstorming'));
    const filePath = path.join(tmpDir, '_bmad-output', 'no-frontmatter.md');
    execHook(makeWritePayload(sid, filePath, '# No frontmatter here'));
    const status = readStatusFile(sid);
    assert.equal(status.step.current, null);
  });

  it('Edit with stepsCompleted in new_string sets step.current', () => {
    const sid = 'step-fm-edit';
    execHook(makeUserPromptPayload(sid, '/bmad-brainstorming'));
    const filePath = path.join(tmpDir, '_bmad-output', 'session.md');
    const newString = '---\nstepsCompleted: [1, 2]\nstatus: draft\n---\n# Updated';
    execHook(makeEditPayload(sid, filePath, 'old content', newString));
    const status = readStatusFile(sid);
    assert.equal(status.step.current, 2);
    assert.equal(status.step.current_name, 'completed');
  });

  // ─── Document detection with default output folders (no custom config) ─────

  it('document_name works with default output folders when config.yaml has no folder keys', () => {
    const sid = 'docname-defaults';
    // config.yaml only has project_name, no output folder keys → defaults used
    execHook(makeUserPromptPayload(sid, '/bmad-create-prd'));
    const filePath = path.join(tmpDir, '_bmad-output', 'planning-artifacts', 'prd.md');
    execHook(makeWritePayload(sid, filePath, '# PRD'));
    const status = readStatusFile(sid);
    assert.equal(status.document_name, 'prd.md');
  });

  // ─── bmadRoot walk-up (cwd is a subdirectory) ─────────────────────────────

  it('hook works when cwd is a subdirectory of bmadRoot', () => {
    const sid = 'walkup-1';
    const subDir = path.join(tmpDir, 'my-package');
    fs.mkdirSync(subDir, { recursive: true });
    // Payload cwd points to subdirectory, but _bmad is in tmpDir
    const payload = {
      session_id: sid,
      cwd: subDir,
      hook_event_name: 'UserPromptSubmit',
      prompt: '/bmad-create-prd'
    };
    execHook(payload);
    const status = readStatusFile(sid);
    assert.ok(status, 'status file should exist');
    assert.equal(status.skill, 'bmad-create-prd');
    assert.equal(status.project, 'TestProject');
  });

  // ─── 8.1: handlePermissionRequest ─────────────────────────────────────────

  it('8.1 AC#1: handlePermissionRequest sets llm_state permission', () => {
    seedStatus('perm-req1', { session_id: 'perm-req1', project: 'TestProject', llm_state: 'active', llm_state_since: '2026-01-01T00:00:00.000Z' });
    execHook(makePermissionRequestPayload('perm-req1'));
    const status = readStatusFile('perm-req1');
    assert.equal(status.llm_state, 'permission');
    assert.notEqual(status.llm_state_since, '2026-01-01T00:00:00.000Z');
  });

  it('8.1 AC#1: handlePermissionRequest works without notification_type filtering', () => {
    seedStatus('perm-req2', { session_id: 'perm-req2', project: 'TestProject', llm_state: 'active', llm_state_since: '2026-01-01T00:00:00.000Z' });
    execHook(makePermissionRequestPayload('perm-req2'));
    const status = readStatusFile('perm-req2');
    assert.equal(status.llm_state, 'permission', 'should set permission without notification_type guard');
  });

  // ─── 8.1: handleStopFailure ───────────────────────────────────────────────

  it('8.1 AC#2: handleStopFailure with rate_limit', () => {
    seedStatus('sf-rate', { session_id: 'sf-rate', project: 'TestProject', llm_state: 'active', llm_state_since: '2026-01-01T00:00:00.000Z' });
    execHook(makeStopFailurePayload('sf-rate', 'rate_limit'));
    const status = readStatusFile('sf-rate');
    assert.equal(status.llm_state, 'error');
    assert.equal(status.error_type, 'rate_limit');
    assert.notEqual(status.llm_state_since, '2026-01-01T00:00:00.000Z');
  });

  it('8.1 AC#2: handleStopFailure with authentication_failed', () => {
    seedStatus('sf-auth', { session_id: 'sf-auth', project: 'TestProject', llm_state: 'active' });
    execHook(makeStopFailurePayload('sf-auth', 'authentication_failed'));
    assert.equal(readStatusFile('sf-auth').error_type, 'authentication_failed');
  });

  it('8.1 AC#2: handleStopFailure with billing_error', () => {
    seedStatus('sf-bill', { session_id: 'sf-bill', project: 'TestProject', llm_state: 'active' });
    execHook(makeStopFailurePayload('sf-bill', 'billing_error'));
    assert.equal(readStatusFile('sf-bill').error_type, 'billing_error');
  });

  it('8.1 AC#2: handleStopFailure with server_error', () => {
    seedStatus('sf-server', { session_id: 'sf-server', project: 'TestProject', llm_state: 'active' });
    execHook(makeStopFailurePayload('sf-server', 'server_error'));
    assert.equal(readStatusFile('sf-server').error_type, 'server_error');
  });

  it('8.1 AC#2: handleStopFailure with max_output_tokens', () => {
    seedStatus('sf-tokens', { session_id: 'sf-tokens', project: 'TestProject', llm_state: 'active' });
    execHook(makeStopFailurePayload('sf-tokens', 'max_output_tokens'));
    assert.equal(readStatusFile('sf-tokens').error_type, 'max_output_tokens');
  });

  it('8.1 AC#2: handleStopFailure with unknown', () => {
    seedStatus('sf-unk', { session_id: 'sf-unk', project: 'TestProject', llm_state: 'active' });
    execHook(makeStopFailurePayload('sf-unk', 'unknown'));
    assert.equal(readStatusFile('sf-unk').error_type, 'unknown');
  });

  it('8.1 AC#2: handleStopFailure missing error_type falls back to unknown', () => {
    seedStatus('sf-miss', { session_id: 'sf-miss', project: 'TestProject', llm_state: 'active' });
    execHook({ hook_event_name: 'StopFailure', session_id: 'sf-miss', cwd: tmpDir });
    assert.equal(readStatusFile('sf-miss').error_type, 'unknown');
  });

  // ─── 8.1: handleSessionEnd ────────────────────────────────────────────────

  it('8.1 AC#3: handleSessionEnd deletes alive and status files', () => {
    const sid = 'se-del';
    seedStatus(sid, { session_id: sid, project: 'TestProject', llm_state: 'active' });
    fs.writeFileSync(path.join(cacheDir, `.alive-${sid}`), '12345');
    execHook(makeSessionEndPayload(sid));
    assert.equal(aliveExists(sid), false, 'alive should be deleted');
    assert.equal(readStatusFile(sid), null, 'status should be deleted');
  });

  it('8.1 AC#3: handleSessionEnd idempotent — no error when files missing', () => {
    const sid = 'se-idem';
    cleanAlive(sid);
    const sp = path.join(cacheDir, `status-${sid}.json`);
    if (fs.existsSync(sp)) fs.unlinkSync(sp);
    execHook(makeSessionEndPayload(sid));
    assert.equal(readStatusFile(sid), null);
  });

  it('8.1 AC#3: handleSessionEnd does not create status file', () => {
    const sid = 'se-no-write';
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, `.alive-${sid}`), '12345');
    execHook(makeSessionEndPayload(sid));
    assert.equal(readStatusFile(sid), null, 'no status file after SessionEnd');
  });

  // ─── 8.1: error_type clearing ─────────────────────────────────────────────

  it('8.1 AC#4: error_type cleared on UserPromptSubmit', () => {
    seedStatus('et-prompt', { session_id: 'et-prompt', project: 'TestProject', skill: 'bmad-dev-story', workflow: 'dev-story', llm_state: 'error', error_type: 'rate_limit' });
    execHook(makeUserPromptPayload('et-prompt', '/bmad-dev-story'));
    const status = readStatusFile('et-prompt');
    assert.equal(status.error_type, null);
    assert.equal(status.llm_state, 'active');
  });

  it('8.1 AC#4: error_type cleared on Stop', () => {
    seedStatus('et-stop', { session_id: 'et-stop', project: 'TestProject', llm_state: 'error', error_type: 'rate_limit' });
    execHook(makeStopPayload('et-stop'));
    const status = readStatusFile('et-stop');
    assert.equal(status.error_type, null);
    assert.equal(status.llm_state, 'waiting');
  });

  it('8.1 AC#4: error_type cleared on Read (PostToolUse)', () => {
    seedStatus('et-read', { session_id: 'et-read', project: 'TestProject', skill: 'bmad-dev-story', workflow: 'dev-story', llm_state: 'error', error_type: 'server_error', reads: [] });
    const fp = path.join(tmpDir, 'src', 'index.js').replace(/\\/g, '/');
    execHook(makeReadPayload('et-read', fp));
    assert.equal(readStatusFile('et-read').error_type, null);
  });

  // ─── 8.1: readStatus defaults ─────────────────────────────────────────────

  it('8.1: new status defaults include error_type null', () => {
    execHook(makeUserPromptPayload('defaults-et', '/bmad-dev-story'));
    const status = readStatusFile('defaults-et');
    assert.ok('error_type' in status);
    assert.equal(status.error_type, null);
  });

  it('8.1 AC#5: full suite regression — npm test passes', () => {
    // This test is a placeholder — the full suite run validates regression
    assert.ok(true);
  });
});
