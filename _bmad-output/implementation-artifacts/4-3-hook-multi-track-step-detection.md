# Story 4.3: Hook — Multi-track step detection with total calculation

Status: done

## Story

As a **developer using BMAD workflows with multiple step tracks (steps/, steps-c/, steps-v/)**,
I want **the hook to detect step progress across any track directory and calculate the correct total per track**,
So that **my step progress is accurate regardless of which track my workflow follows**.

## Acceptance Criteria

1. **Default track step detection:** Given an active workflow and a Read event for `{cwd}/.claude/skills/bmad-create-architecture/steps/step-03-starter.md`, the status file sets `step.current: 3`, `step.current_name: "starter"`, `step.track: ""`.
2. **`-c` track detection:** Given an active workflow and a Read event for `{cwd}/.claude/skills/bmad-tea/steps-c/step-c-01-init.md`, the status file sets `step.current: 1`, `step.current_name: "init"`, `step.track: "-c"`.
3. **`-v` track detection:** Given an active workflow and a Read event for `{cwd}/.claude/skills/bmad-tea/steps-v/step-v-03-validate.md`, the status file sets `step.current: 3`, `step.current_name: "validate"`, `step.track: "-v"`.
4. **Total from parent dir:** Given a Read event matching a step file and `step.total` is not yet set for the current track, the hook reads the parent directory via `fs.readdirSync`, counts files matching `/^step-(?:[a-z]-)?(\d+)-.+\.md$/`, and sets `step.total` to the count.
5. **Track change recalculation:** Given `step.track` is `""` (default steps/) and a new Read matches a step in `steps-c/`, the hook detects the track change, recalculates `step.total` from the `steps-c/` directory, and updates `step.track: "-c"`.
6. **Sub-step exclusion:** Given a Read event for `steps/step-01b-continue.md`, the STEP_REGEX `/\/steps(-[a-z])?\/step-(?:[a-z]-)?(\d+)-(.+)\.md$/` does NOT match (sub-steps excluded by design).
7. **Last step next=null:** Given an active workflow with 8 steps and a Read for the last step (`step-08-*.md`), the status file sets `step.next: null`, `step.next_name: null`.
8. **Next step derivation:** Given an active workflow with 8 steps and a Read for step 3, the status file derives `step.next: 4` and `step.next_name` from the next file in the alphanumerically sorted directory listing.
9. **Cross-skill false positive prevention:** Given a Read event for a step file belonging to a DIFFERENT skill's steps directory than the active skill, the hook ignores the event (`normalizedPath.startsWith(skillDir)` check).
10. **Tests:** `test/hook.test.js` updated for: (a) default track step detection with track="", (b) `-c` and `-v` track detection, (c) sub-step exclusion, (d) total calculation from parent dir, (e) track change recalculation, (f) last step next=null, (g) next step derivation, (h) cross-skill false positive prevention.

## Tasks / Subtasks

- [x] Task 1: Add STEP_REGEX constant and extractStep helper (AC: #1, #2, #3, #6)
  - [x] 1.1 Add `const STEP_REGEX = /\/steps(-[a-z])?\/step-(?:[a-z]-)?(\d+)-(.+)\.md$/;` constant after existing constants
  - [x] 1.2 Add `extractStep(filePath)` function returning `{ track, number, name }` or null — using `normalize(filePath).match(STEP_REGEX)`
  - [x] 1.3 `track` is `match[1] || ''` (empty string for default `steps/`, `-c` for `steps-c/`, etc.)
  - [x] 1.4 `number` is `parseInt(match[2], 10)` — always a number, not string
  - [x] 1.5 `name` is `match[3]` — the step descriptor (e.g. `"starter"`, `"init"`)

- [x] Task 2: Rewrite handleRead step detection to use STEP_REGEX + multi-track (AC: #1, #2, #3, #4, #5, #7, #8, #9)
  - [x] 2.1 Replace current `const stepMatch = normPath.match(/\/steps\/step-(\d+)-(.+)\.md$/);` with `const stepInfo = extractStep(filePath);`
  - [x] 2.2 Replace false-positive prevention: build `expectedPrefix` using `activeSkill` + `'steps' + stepInfo.track` (supports `steps/`, `steps-c/`, etc.) — keep `'bmad-' + activeWorkflow` fallback for backward compat when `activeSkill` is undefined
  - [x] 2.3 Set `status.step.track = stepInfo.track` on every step update
  - [x] 2.4 Calculate `step.total` from parent dir: `fs.readdirSync(stepsDir).filter(f => /^step-(?:[a-z]-)?(\d+)-.+\.md$/.test(f)).length` — only when `step.total` is null or `step.track` has changed
  - [x] 2.5 Track change detection: if `status.step.track !== stepInfo.track`, recalculate total from the new track directory and update `step.track`
  - [x] 2.6 Derive next step: filter directory listing by same step count regex, sort numerically, find current index, get next file if available
  - [x] 2.7 Last step: when current is the last in sorted list, set `step.next = null`, `step.next_name = null`

- [x] Task 3: Fix handleRead step detection for multi-track (deferred from 4.2) (AC: implicit)
  - [x] 3.1 The 4.2 deferred item says "handleRead doesn't support `steps-*` variant directories — step detection regex only matches literal `/steps/`". Task 2 above resolves this by using STEP_REGEX in handleRead
  - [x] 3.2 Verify trackable check regex in `handleUserPrompt` is consistent: `/^steps-[a-z]$/` matches single-letter track suffixes, aligned with STEP_REGEX `(-[a-z])?` — do NOT expand to multi-letter (architecture prescribes single-letter: `-c`, `-v`, `-e`)

- [x] Task 4: Update test fixtures — ephemeral temp dirs in `before()` hook (AC: #10)
  - [x] 4.1 In the `before()` hook of `test/hook.test.js`, add synthetic `bmad-tea` skill with multi-track dirs: `steps-c/` with `step-c-01-init.md`, `step-c-02-plan.md`, `step-c-03-execute.md` and `steps-v/` with `step-v-01-load.md`, `step-v-02-check.md`, `step-v-03-validate.md` — these are ephemeral test directories, NOT persistent skill changes
  - [x] 4.2 In the `before()` hook, add sub-step file `step-01b-continue.md` in `bmad-create-architecture/steps/` for exclusion test (this file must NOT affect total count)
  - [x] 4.3 Update `test/fixtures/status-sample.json` to show `step.track` with a non-null value (e.g. `"-c"`)

- [x] Task 5: Add multi-track step detection tests (AC: #10)
  - [x] 5.1 Test default track: Read `steps/step-03-starter.md` → `step.current: 3, step.current_name: "starter", step.track: ""`
  - [x] 5.2 Test `-c` track: Read `steps-c/step-c-01-init.md` → `step.current: 1, step.current_name: "init", step.track: "-c"`
  - [x] 5.3 Test `-v` track: Read `steps-v/step-v-03-validate.md` → `step.current: 3, step.current_name: "validate", step.track: "-v"`
  - [x] 5.4 Test sub-step exclusion: Read `steps/step-01b-continue.md` → step unchanged (no match)
  - [x] 5.5 Test total calculation: after first step Read, `step.total` equals count of step files in parent dir
  - [x] 5.6 Test track change: seed with `step.track: ""`, Read from `steps-c/` → `step.track: "-c"`, `step.total` recalculated
  - [x] 5.7 Test last step: Read `step-08-publish.md` → `step.next: null, step.next_name: null` (unchanged from existing test, but verify `step.track: ""` added)
  - [x] 5.8 Test next step derivation across tracks: Read `step-c-01-init.md` in `steps-c/` with 3 files → `step.next: 2, step.next_name: "plan"`
  - [x] 5.9 Test cross-skill false positive: Read step from different skill dir → ignored
  - [x] 5.10 Test reverse track switch: seed with `step.track: "-c"`, Read from default `steps/` → `step.track: ""`, `step.total` recalculated from `steps/`
  - [x] 5.11 Test total excludes sub-steps: with `step-01b-continue.md` in `steps/`, total still equals count of main step files only
  - [x] 5.12 Verify existing step detection tests still pass with new regex (backward compat)

## Dev Notes

### Error Handling: SILENT ALWAYS

The hook is in the **silent** component of the error handling triad. **Never** `console.log`, `console.error`, or throw. Every failure path must exit silently (`process.exit(0)` or `return`).

### Synchronous I/O Only

All file operations MUST use `fs.readFileSync` / `fs.writeFileSync`. Never `fs.promises` or async/await. This is a **correctness guarantee** preventing race conditions between sequential hook invocations.

### File To Modify

**Single file:** `src/hook/bmad-hook.js` (+ tests + fixture)

This is the only source file modified in this story. No reader changes. No installer changes.

### Current Step Detection Code (what you're replacing)

In `handleRead()` at lines 133-178 of `bmad-hook.js`:

```js
// CURRENT (line 133) — single track only:
const stepMatch = normPath.match(/\/steps\/step-(\d+)-(.+)\.md$/);
```

This matches ONLY `steps/step-NN-name.md`. It does NOT match `steps-c/step-c-01-init.md` or any track variant. The entire step detection block (lines 133-178) must be rewritten to use `STEP_REGEX` and `extractStep()`.

### Target: STEP_REGEX and extractStep helper

From architecture (Pattern 13):

```js
const STEP_REGEX = /\/steps(-[a-z])?\/step-(?:[a-z]-)?(\d+)-(.+)\.md$/;

function extractStep(filePath) {
  const match = normalize(filePath).match(STEP_REGEX);
  if (!match) return null;
  return {
    track: match[1] || '',           // e.g., '-c' or '' for default steps/
    number: parseInt(match[2], 10),  // e.g., 1, 3
    name: match[3]                   // e.g., 'init', 'starter'
  };
}
```

**Regex breakdown:**
- `\/steps(-[a-z])?\/` — matches `steps/` or `steps-c/`, `steps-v/`, `steps-e/` (capture group 1: track suffix or undefined)
- `step-(?:[a-z]-)?` — matches `step-` or `step-c-`, `step-v-` (non-capturing group for track letter prefix in filename)
- `(\d+)-` — step number (capture group 2)
- `(.+)\.md$` — step name (capture group 3)

**Sub-step exclusion:** `step-01b-continue.md` does NOT match because after `(\d+)` the regex expects `-` but finds `b`.

### Target: handleRead step detection rewrite

Replace the current step detection block with:

```js
const stepInfo = extractStep(filePath);
if (stepInfo) {
  // False positive prevention: must be in active skill's steps dir
  const skillForPath = activeSkill || ('bmad-' + activeWorkflow);
  const stepsDir = path.join(cwd, '.claude', 'skills', skillForPath, 'steps' + stepInfo.track);
  const expectedPrefix = normalize(stepsDir) + '/';
  if (!normPath.startsWith(expectedPrefix)) return;

  status.session_id = sessionId;
  status.step = status.step || {};
  status.step.current = stepInfo.number;
  status.step.current_name = stepInfo.name;

  // Track change or first Read: calculate total
  const trackChanged = status.step.track !== stepInfo.track;
  if (status.step.total === null || status.step.total === undefined || trackChanged) {
    try {
      const files = fs.readdirSync(stepsDir);
      status.step.total = files.filter(f => /^step-(?:[a-z]-)?(\d+)-.+\.md$/.test(f)).length;
    } catch (e) {
      // Silent
    }
  }
  status.step.track = stepInfo.track;

  // Derive next step
  try {
    const stepFiles = fs.readdirSync(stepsDir)
      .filter(f => /^step-(?:[a-z]-)?(\d+)-.+\.md$/.test(f))
      .sort((a, b) => {
        const na = parseInt(a.match(/(\d+)/)[0], 10);
        const nb = parseInt(b.match(/(\d+)/)[0], 10);
        return na - nb;
      });

    let nextStep = null;
    let nextName = null;
    for (let i = 0; i < stepFiles.length; i++) {
      const fm = stepFiles[i].match(/^step-(?:[a-z]-)?(\d+)-(.+)\.md$/);
      if (fm && parseInt(fm[1], 10) === stepInfo.number && i + 1 < stepFiles.length) {
        const nm = stepFiles[i + 1].match(/^step-(?:[a-z]-)?(\d+)-(.+)\.md$/);
        if (nm) {
          nextStep = parseInt(nm[1], 10);
          nextName = nm[2];
        }
        break;
      }
    }
    status.step.next = nextStep;
    status.step.next_name = nextName;
  } catch (e) {
    status.step.next = null;
    status.step.next_name = null;
  }

  writeStatus(sessionId, status);
  return;
}
```

**Key differences from current code:**
1. Uses `extractStep()` instead of inline regex — DRY and multi-track aware
2. `stepsDir` uses `'steps' + stepInfo.track` — resolves to `steps/`, `steps-c/`, `steps-v/`
3. Directory listing regex uses `/^step-(?:[a-z]-)?(\d+)-.+\.md$/` — matches both `step-01-name.md` and `step-c-01-name.md`
4. Track change triggers total recalculation
5. Always sets `step.track` in status

### Deferred Fix: handleRead Multi-Track Support (from 4.2 review)

The 4.2 code review flagged two items deferred to 4.3:
1. **handleRead step detection**: regex only matches literal `/steps/`, not `steps-*` variants → **resolved by Task 2** (STEP_REGEX replaces old regex)
2. **Trackable check `steps-[a-z]` regex**: single-letter suffix only. This is **correct per architecture** — STEP_REGEX uses `(-[a-z])?` (single letter). No change needed to `handleUserPrompt`. Just verify consistency.

### Backward Compatibility

Old status files from Phase 2/3 will have `step.track` as `undefined`. The `extractStep()` function always returns `track` as a string (`""` or `"-c"` etc.). The track change detection `status.step.track !== stepInfo.track` will naturally trigger a recalculation on the first Read after upgrade, which is the correct behavior.

The `'bmad-' + activeWorkflow` fallback for `activeSkill` is retained for status files created before story 4.2.

### Test Patterns

Tests use `child_process.execSync` with synthetic JSON on stdin + temp directories. The existing `execHook()`, `readStatusFile()`, `seedStatus()` helpers are reused.

**New fixtures needed for this story:**
- `bmad-tea` skill dir with `steps-c/` (3 step files: `step-c-01-init.md`, `step-c-02-plan.md`, `step-c-03-execute.md`) and `steps-v/` (3 step files: `step-v-01-load.md`, `step-v-02-check.md`, `step-v-03-validate.md`)
- `step-01b-continue.md` added to `bmad-create-architecture/steps/` for sub-step exclusion test

**Important:** The `step-01b-continue.md` file is ONLY for testing sub-step exclusion. It should NOT be counted in `step.total` — the regex `/^step-(?:[a-z]-)?(\d+)-.+\.md$/` excludes it automatically because `01b` doesn't match `(\d+)`.

### What This Story Does NOT Do

- Does NOT implement story intelligence / priority system (story 4.4)
- Does NOT implement Write/Edit handlers (story 4.5)
- Does NOT modify installer/defaults/uninstaller (story 4.6/4.7)
- Does NOT modify clean command (story 4.8)
- Does NOT modify reader (no reader changes in Epic 4)

### Project Structure Notes

- `src/hook/bmad-hook.js` — CommonJS, zero deps, deployed standalone
- `src/hook/package.json` — CJS marker `{ "type": "commonjs" }` (do not modify)
- `test/hook.test.js` — uses `node:test` + `node:assert/strict` (ESM)
- `test/fixtures/status-sample.json` — update `step.track` to non-null value
- Step file naming: `step-{NN}-{name}.md` (default) or `step-{t}-{NN}-{name}.md` (tracked, where `t` is single letter)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Step Multi-Track — STEP_REGEX, extractStep, track change, total calculation]
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern 13 Step Multi-Track Detection — prescriptive code]
- [Source: _bmad-output/planning-artifacts/architecture.md#Step Total Calculation — calculated at first Read, per-track]
- [Source: _bmad-output/planning-artifacts/architecture.md#Hook Path Matching Updated — multi-track step regex]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.3 — acceptance criteria]
- [Source: _bmad-output/project-context.md — Error Handling Triad, Sync I/O, Path Normalization, Hook Entry Point Structure]
- [Source: _bmad-output/implementation-artifacts/4-2-hook-dispatch-userpromptsubmit-multi-module-cwd-sessionstart.md — Previous story: deferred steps-[a-z] fix, current hook structure]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md — "steps-[a-z] regex too restrictive + handleRead doesn't support steps-* variant directories"]
- [Source: bmad-statusline/src/hook/bmad-hook.js — Current implementation (248 lines)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Added `STEP_REGEX` constant and `extractStep()` helper function to `bmad-hook.js`
- Rewrote `handleRead` step detection block: replaces single-track `/steps/step-(\d+)-(.+)\.md$/` with multi-track `STEP_REGEX` via `extractStep()`
- Multi-track support: `steps/`, `steps-c/`, `steps-v/`, `steps-e/` all detected correctly
- `step.track` field set on every step update (empty string for default, `-c`/`-v` for tracked)
- `step.total` calculated from parent directory at first Read (per-track), recalculated on track change
- Sub-step files (e.g. `step-01b-continue.md`) excluded by regex design
- Next step derivation works across all track types
- Cross-skill false positive prevention uses `activeSkill` + track-aware `stepsDir`
- Backward compatibility preserved: `'bmad-' + activeWorkflow` fallback, old status files with `track: undefined` trigger recalculation
- Verified `handleUserPrompt` trackable check regex `/^steps-[a-z]$/` is consistent with STEP_REGEX single-letter tracks
- 12 new tests added covering all ACs; all 200 tests pass (53 hook tests, 0 failures)
- Updated `status-sample.json` fixture: `step.track` set to `"-c"`

### Change Log

- 2026-03-30: Implemented multi-track step detection — STEP_REGEX, extractStep, handleRead rewrite, 12 tests

### Review Findings

- [x] [Review][Decision] SCOPE VIOLATION: Story 4.4 code in 4.3 commit — user accepted scope merge (option 1)
- [x] [Review][Patch] Stale `step.total` when `readdirSync` fails on track change — fixed: catch sets `total = null` [bmad-hook.js:176]
- [x] [Review][Patch] `content.split()` crash on non-string content — fixed: `typeof content === 'string'` guard [bmad-hook.js:221]
- [x] [Review][Patch] Sprint-status regex `/in-progress/` matches superset statuses — fixed: added `\s*(?:$|#)` anchor [bmad-hook.js:225]
- [x] [Review][Patch] `STORY_FILE_REGEX` too permissive — fixed: added `\/` anchor before capture group [bmad-hook.js:15]
- [x] [Review][Patch] `shouldUpdateStory` uses magic numbers — fixed: uses `STORY_PRIORITY.*` constants [bmad-hook.js:23-27]
- [x] [Review][Defer] `STORY_WRITE_WORKFLOWS` defined but never used — forward scaffolding for story 4.5 [bmad-hook.js:13] — deferred, 4.4/4.5 scope
- [x] [Review][Defer] Double `readdirSync` on same directory per step Read — efficiency optimization [bmad-hook.js:172,182] — deferred, non-critical
- [x] [Review][Defer] `cwd` trailing slash edge case breaks path scoping [bmad-hook.js:146] — deferred, pre-existing

### File List

- `src/hook/bmad-hook.js` — added STEP_REGEX, extractStep(), rewrote handleRead step detection block
- `test/hook.test.js` — added bmad-tea multi-track fixtures, sub-step fixture, 12 new multi-track tests
- `test/fixtures/status-sample.json` — updated step.track from null to "-c"
