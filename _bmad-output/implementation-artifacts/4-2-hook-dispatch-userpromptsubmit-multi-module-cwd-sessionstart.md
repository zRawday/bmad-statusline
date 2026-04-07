# Story 4.2: Hook dispatch evolution — 5-signal entry point, UserPromptSubmit, multi-module, cwd guard, SessionStart, alive

Status: done

## Story

As a **developer using BMAD, GDS, or WDS workflows**,
I want **the hook to detect workflow activation from any module via UserPromptSubmit, scope all file events to the current project, and persist session liveness**,
So that **my status tracking works across all BMAD ecosystem modules with no cross-project contamination and survives session resume**.

## Acceptance Criteria

1. **UserPromptSubmit bmad skill:** Given prompt `/bmad-create-architecture` and `{cwd}/.claude/skills/bmad-create-architecture/steps/` exists, status file sets `skill: "bmad-create-architecture"`, `workflow: "create-architecture"`, `started_at` to now.
2. **UserPromptSubmit gds skill:** Given prompt `/gds-code-review` and `{cwd}/.claude/skills/gds-code-review/steps/` exists, status file sets `skill: "gds-code-review"`, `workflow: "code-review"` (dynamic slicer).
3. **UserPromptSubmit wds skill:** Given prompt `/wds-4-ux-design` and steps exist, status file sets `skill: "wds-4-ux-design"`, `workflow: "4-ux-design"`.
4. **started_at preservation:** Re-triggering the same skill preserves `started_at`. Changing skill resets it.
5. **Utility skill ignored:** `/bmad-help` with no `steps*/` directory — hook ignores, preserves current status.
6. **Non-matching prompt ignored:** Plain text prompt (e.g. "hello") — hook exits silently. Matcher does NOT filter UserPromptSubmit; internal regex is the guard.
7. **cwd scoping (outside):** Read event with `file_path` outside `payload.cwd` (after forward-slash normalization on BOTH fields) — hook ignores.
8. **cwd scoping (inside):** Read event with `file_path` inside `payload.cwd` — existing Read handler proceeds (step/story/project unchanged).
9. **Alive touch:** Every event passing `_bmad/` guard touches `.alive-{session_id}` via `fs.writeFileSync`.
10. **SessionStart:** Receives `SessionStart` event (matcher `"resume"`) — touches `.alive-{session_id}` and exits (no status file modification).
11. **Dispatch order:** Source branches on `hook_event_name` first, then `tool_name` for PostToolUse.
12. **SKILL_REGEX:** Constant is `/((?:bmad|gds|wds)-[\w-]+)/`, dynamic slicer uses `skillName.slice(skillName.indexOf('-') + 1)`.
13. **Status schema:** Stores `skill` (full name), `workflow` (stripped name), `story_priority: null` as initial value.
14. **ALIVE_MAX_AGE_MS:** Constant is `7 * 24 * 60 * 60 * 1000`.
15. **Tests:** `test/hook.test.js` updated for: bmad/gds/wds skills, utility ignored, non-matching ignored, cwd scoping, alive creation, SessionStart, started_at lifecycle, dispatch routing.
16. **Fixture:** `test/fixtures/status-sample.json` updated with `skill`, `story_priority`, `step.track` fields.

## Tasks / Subtasks

- [x] Task 1: Evolve hook dispatch structure (AC: #6, #11)
  - [x] 1.1 Replace `hookEvent === 'UserPromptSubmit'` + `hookEvent === 'PostToolUse' && tool_name === 'Read'` with full 3-branch dispatch on `hook_event_name` (UserPromptSubmit / PostToolUse / SessionStart)
  - [x] 1.2 Under PostToolUse, branch on `tool_name`: Read (existing), Write (stub `process.exit(0)` for story 4.5), Edit (stub for 4.5)
  - [x] 1.3 Move `_bmad/` guard BEFORE dispatch (applies to all events, not just PostToolUse)
  - [x] 1.4 Add alive touch after `_bmad/` guard, before dispatch
- [x] Task 2: Evolve handlePromptSubmit to multi-module (AC: #1, #2, #3, #4, #5, #12, #13)
  - [x] 2.1 Replace regex `/^\s*\/?(bmad-[\w-]+)/` with `SKILL_REGEX = /((?:bmad|gds|wds)-[\w-]+)/`
  - [x] 2.2 Replace `skill.slice(5)` with dynamic slicer `skillName.slice(skillName.indexOf('-') + 1)`
  - [x] 2.3 Replace trackable check from `workflow.md` existence to `steps*/` directory existence (glob for `steps/` or `steps-*/`)
  - [x] 2.4 Remove step counting from handlePromptSubmit (deferred to first Read in story 4.3)
  - [x] 2.5 Store both `skill` (full name) and `workflow` (stripped) in status, add `story_priority: null` init
  - [x] 2.6 Use full `skillName` for path construction, not `'bmad-' + workflowName`
- [x] Task 3: Add cwd scoping to handleRead (AC: #7, #8)
  - [x] 3.1 Add `isInProject(filePath, cwd)` check at top of handleRead, before any pattern matching
  - [x] 3.2 Normalize both `file_path` and `cwd` to forward slashes before comparison
  - [x] 3.3 Update false-positive prevention in step detection to use `status.skill` (full name) instead of `'bmad-' + activeWorkflow`
- [x] Task 4: Add SessionStart handler + alive mechanism (AC: #9, #10, #14)
  - [x] 4.1 Add `ALIVE_MAX_AGE_MS` constant
  - [x] 4.2 Add `touchAlive(sessionId)` helper: `fs.writeFileSync(path.join(CACHE_DIR, '.alive-' + sessionId), '')`
  - [x] 4.3 Call `touchAlive` after `_bmad/` guard on every invocation
  - [x] 4.4 Add `handleSessionStart`: no-op (alive already touched)
- [x] Task 5: Update status file defaults (AC: #13)
  - [x] 5.1 Add `skill: null`, `story_priority: null` to `readStatus` default object
  - [x] 5.2 Add `step.track: null` to step defaults (prep for story 4.3)
- [x] Task 6: Update tests (AC: #15, #16)
  - [x] 6.1 Add UserPromptSubmit tests: bmad, gds, wds skill detection with correct workflow/skill extraction
  - [x] 6.2 Add test: utility skill (no steps/) ignored, status preserved
  - [x] 6.3 Add test: non-matching prompt exits silently
  - [x] 6.4 Add test: cwd scoping — Read inside cwd processed, Read outside cwd ignored
  - [x] 6.5 Add test: alive file created on hook invocation
  - [x] 6.6 Add test: SessionStart touches alive, does not modify status
  - [x] 6.7 Add test: started_at preserved on same skill, reset on different skill
  - [x] 6.8 Add test: dispatch routes all 5 event types correctly (UserPromptSubmit, Read, Write, Edit, SessionStart)
  - [x] 6.9 Update test fixtures: create `gds-*` and `wds-*` skill dirs alongside `bmad-*` in temp dirs
  - [x] 6.10 Update `test/fixtures/status-sample.json` with `skill`, `story_priority`, `step.track`

## Dev Notes

### Error Handling: SILENT ALWAYS

The hook is in the **silent** component of the error handling triad. **Never** `console.log`, `console.error`, or throw. Every failure path must exit silently (`process.exit(0)` or `return`).

### Synchronous I/O Only

All file operations MUST use `fs.readFileSync` / `fs.writeFileSync`. Never `fs.promises` or async/await. This is a **correctness guarantee** preventing race conditions between sequential hook invocations — not a style choice.

### File To Modify

**Single file:** `src/hook/bmad-hook.js` (+ tests + fixture)

This is the only source file modified in this story. No reader changes. No installer changes (story 4.6).

### Current Hook Structure (what you're evolving)

The current hook at `src/hook/bmad-hook.js` (222 lines) has this structure:
```
1. Requires (fs, path, os)
2. Constants (CACHE_DIR, STORY_WORKFLOWS, normalize, isSafeId)
3. Stdin parsing (try/catch → exit 0)
4. Event routing: UserPromptSubmit → handlePromptSubmit → exit; else _bmad/ guard → PostToolUse Read → handleRead; else exit
5. handlePromptSubmit: regex /^\s*\/?(bmad-[\w-]+)/ → slice(5) → workflow.md check → step counting → status update
6. handleRead: config/step/story detection → gated by active workflow → status update
7. Status helpers: readStatus, writeStatus
```

### Target Hook Structure (after this story)

```
1. Requires (fs, path, os)
2. Constants (CACHE_DIR, ALIVE_MAX_AGE_MS, normalize, isSafeId, SKILL_REGEX)
3. Stdin parsing (try/catch → exit 0)
4. Guard: _bmad/ existence check → exit if absent
5. Alive touch: touchAlive(session_id)
6. Dispatch on hook_event_name:
   - UserPromptSubmit → handleUserPrompt
   - PostToolUse → Read: handleRead | Write: exit (stub) | Edit: exit (stub) | else: exit
   - SessionStart → (no-op, alive already touched)
   - else → exit
7. handleUserPrompt: SKILL_REGEX → dynamic slicer → steps*/ check → status update
8. handleRead: cwd scoping → normalize → step/story/project → gated by active skill → status update
9. Status helpers: readStatus (with new default fields), writeStatus
```

### Critical Changes from Current Code

**1. Regex change — multi-module:**
```js
// CURRENT (line ~50):
const slashMatch = prompt.match(/^\s*\/?(bmad-[\w-]+)/);
// TARGET:
const SKILL_REGEX = /((?:bmad|gds|wds)-[\w-]+)/;
const match = prompt.match(SKILL_REGEX);
```

**2. Dynamic slicer — replaces hardcoded slice(5):**
```js
// CURRENT (line ~57):
const workflowName = skill.slice(5);
// TARGET:
const workflowName = skillName.slice(skillName.indexOf('-') + 1);
```

**3. Trackable check — steps*/ instead of workflow.md:**
```js
// CURRENT (line ~61):
if (!fs.existsSync(path.join(skillDir, 'workflow.md'))) return;
// TARGET: Check for any steps/ or steps-*/ directory
const skillDir = path.join(promptCwd, '.claude', 'skills', skillName);
const hasSteps = fs.existsSync(path.join(skillDir, 'steps'))
  || fs.readdirSync(skillDir).some(f => /^steps-[a-z]$/.test(f));
// Note: readdirSync wrapped in try/catch → return on failure (silent)
```

**4. Remove step counting from handlePromptSubmit:**
```js
// CURRENT (lines ~64-68): reads steps/ dir and counts
// TARGET: Remove entirely. Set step.total = null. Story 4.3 calculates total at first Read.
```

**5. False-positive prevention — use skill (full name) not workflow:**
```js
// CURRENT (line ~128):
const expectedPrefix = normalize(path.join(cwd, '.claude', 'skills', 'bmad-' + activeWorkflow, 'steps')) + '/';
// TARGET: use status.skill (full name)
const expectedPrefix = normalize(path.join(cwd, '.claude', 'skills', activeSkill, 'steps')) + '/';
```
Note: `activeSkill` comes from `status.skill`. If `status.skill` is null (old status file without the field), fall back to `'bmad-' + activeWorkflow` for backward compat during transition.

**6. cwd scoping — new guard in handleRead:**
```js
// ADD at top of handleRead, after extracting filePath:
const normPath = normalize(filePath);
const normCwd = normalize(cwd);
if (!normPath.startsWith(normCwd)) return; // outside project
```
Note: current code already does `const normCwd = normalize(cwd) + '/';` — update to `normalize(cwd)` without trailing slash, then use `startsWith(normCwd + '/')` or `startsWith(normCwd)` consistently. Use `normCwd + '/'` to avoid false match on `/project-dir-backup/`.

**7. _bmad/ guard — move before dispatch:**
```js
// CURRENT: guard is between UserPromptSubmit and PostToolUse routing
// TARGET: guard is immediately after stdin parsing, before any dispatch
```
The current code runs `handlePromptSubmit()` BEFORE the `_bmad/` guard, which also has its own internal `_bmad/` check. In the new structure, a single `_bmad/` guard protects everything.

**8. Status defaults — new fields:**
```js
// readStatus default return:
{
  session_id: sessionId,
  project: null,
  skill: null,           // NEW
  workflow: null,
  story: null,
  story_priority: null,  // NEW
  step: {
    current: null,
    current_name: null,
    next: null,
    next_name: null,
    total: null,
    track: null           // NEW (prep for 4.3)
  },
  started_at: null,
  updated_at: null
}
```

### Spike-Validated Payload Formats

**UserPromptSubmit** (from `test/fixtures/spike-userpromptsubmit-payload.json`):
```json
{
  "session_id": "test-session-001",
  "cwd": "C:/Users/test/project",
  "hook_event_name": "UserPromptSubmit",
  "prompt": "/bmad-create-architecture"
}
```
- Field is `prompt`, NOT `user_message`
- `cwd` may have forward or backslashes depending on platform

**SessionStart** (from spike):
```json
{
  "session_id": "test-session-001",
  "cwd": "C:/Users/test/project",
  "hook_event_name": "SessionStart",
  "source": "resume"
}
```
- No `permission_mode` field
- `source: "resume"` for `claude --continue` / `claude --resume`

**PostToolUse Read** (existing, unchanged):
```json
{
  "session_id": "...",
  "cwd": "C:\\Users\\...",
  "hook_event_name": "PostToolUse",
  "tool_name": "Read",
  "tool_input": { "file_path": "C:\\Users\\...\\step-01-init.md" },
  "tool_response": { "file": { "content": "..." } }
}
```
- `file_path` uses BACKSLASHES on Windows — normalize before any matching

### Test Patterns (from existing hook.test.js)

Tests use `child_process.execSync` with synthetic JSON on stdin + temp directories:
```js
const hookScript = path.join(__dirname, '..', 'src', 'hook', 'bmad-hook.js');

// Create temp dir with skill structure
fs.mkdirSync(path.join(tmpDir, '_bmad'), { recursive: true });
fs.mkdirSync(path.join(tmpDir, '.claude', 'skills', 'bmad-create-architecture', 'steps'), { recursive: true });
fs.writeFileSync(path.join(tmpDir, '.claude', 'skills', 'bmad-create-architecture', 'steps', 'step-01-init.md'), '');

// Set BMAD_CACHE_DIR for testability
const env = { ...process.env, BMAD_CACHE_DIR: cacheDir };

// Execute hook with payload
execSync(`echo '${JSON.stringify(payload)}' | node "${hookScript}"`, { cwd: tmpDir, env });
```

**New test fixtures needed for this story:**
- `gds-code-review` skill dir with steps
- `wds-4-ux-design` skill dir with steps
- `bmad-help` skill dir WITHOUT steps (utility)
- Files outside `cwd` for scoping tests

### STORY_WORKFLOWS Constant

The current `STORY_WORKFLOWS = ['create-story', 'dev-story', 'code-review']` remains unchanged in this story. Story 4.4 will evolve story gating to the priority system. Keep it as-is.

### Write/Edit Handler Stubs

This story adds Write and Edit branches to the dispatch but they are **no-ops** (just `process.exit(0)` or empty). Story 4.5 implements the actual handlers. This keeps the dispatch structure clean for 4.3/4.4 to build on.

### Backward Compatibility

Old status files (from Phase 2/3) won't have `skill`, `story_priority`, or `step.track`. The `readStatus()` function reads whatever JSON is on disk. New fields will be `undefined` until the hook writes them. Handle gracefully:
- `status.skill` undefined → fall back to `'bmad-' + status.workflow` for path construction
- `story_priority` undefined → treat as `null`
- `step.track` undefined → treat as `null`

### Project Structure Notes

- `src/hook/bmad-hook.js` — CommonJS, zero deps, deployed standalone
- `src/hook/package.json` — CJS marker `{ "type": "commonjs" }` (do not modify)
- `test/hook.test.js` — uses `node:test` + `node:assert/strict`
- `test/fixtures/status-sample.json` — update with new fields
- `test/fixtures/spike-userpromptsubmit-payload.json` — read-only reference

### What This Story Does NOT Do

- Does NOT modify step detection regex (story 4.3)
- Does NOT implement story intelligence / priority system (story 4.4)
- Does NOT implement Write/Edit handlers (story 4.5)
- Does NOT modify installer/defaults/uninstaller (story 4.6/4.7)
- Does NOT modify clean command (story 4.8)
- Does NOT modify reader (no reader changes in Epic 4)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md — Multi-Signal Hook Architecture, Multi-Module Support, cwd Scoping, Session Resume, Skill Name Normalization, Trackable Skill Detection]
- [Source: _bmad-output/planning-artifacts/epics.md — Story 4.2 acceptance criteria, FR19-21, FR28-30]
- [Source: _bmad-output/project-context.md — Error Handling Triad, Sync I/O, Path Normalization, Hook Entry Point Structure, Status File Schema]
- [Source: bmad-statusline/test/fixtures/spike-userpromptsubmit-payload.json — Empirical payload formats]
- [Source: bmad-statusline/src/hook/bmad-hook.js — Current implementation (222 lines)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation, all 42 tests passed on first run.

### Completion Notes List

- Rewrote `bmad-hook.js` from 222-line 2-signal hook to 253-line 5-signal hook
- 3-branch dispatch: UserPromptSubmit / PostToolUse (Read + Write/Edit stubs) / SessionStart
- `_bmad/` guard moved before all dispatch (single guard replaces two)
- `SKILL_REGEX = /((?:bmad|gds|wds)-[\w-]+)/` — multi-module detection
- Dynamic slicer `skillName.slice(skillName.indexOf('-') + 1)` replaces hardcoded `slice(5)`
- Trackable check: `steps*/` directory existence replaces `workflow.md` check
- Step counting removed from handleUserPrompt (deferred to story 4.3)
- cwd scoping: `normPath.startsWith(normCwd + '/')` guard at top of handleRead
- False-positive prevention uses `status.skill` with `'bmad-' + workflow` fallback for backward compat
- `touchAlive(sessionId)` writes `.alive-{session_id}` on every guarded event
- `ALIVE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000` constant added (used by story 4.8)
- Status defaults: added `skill: null`, `story_priority: null`, `step.track: null`
- Proactive project detection: reads config.yaml at first event (before dispatch), falls back to cwd basename
- Removed handleRead config.yaml detection (superseded by proactive detection)
- Tests: complete rewrite — 41 tests covering all 16 ACs + backward compat + edge cases
- Fixture: `status-sample.json` updated with `skill`, `story_priority`, `step.track`

### File List

- `bmad-statusline/src/hook/bmad-hook.js` — modified (complete rewrite)
- `bmad-statusline/test/hook.test.js` — modified (complete rewrite, 42 tests)
- `bmad-statusline/test/fixtures/status-sample.json` — modified (new fields)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — modified (status update)

### Review Findings

- [x] [Review][Patch] `project_name` regex `\s*` crosses newline boundary — captures next YAML line when `project_name:` has no inline value. Replace `\s*` with `[ \t]*`. [bmad-hook.js:42] ✅ Fixed
- [x] [Review][Defer] SKILL_REGEX unanchored — matches skill names mid-sentence in user prompts. Spec (AC #12) explicitly prescribes this pattern. Mitigated by `steps/` trackable check. Revisit if false positives observed. [bmad-hook.js:12]
- [x] [Review][Defer] `steps-[a-z]` regex too restrictive + handleRead doesn't support `steps-*` variant directories — only matches single-letter suffixes; step detection regex only matches literal `/steps/`. No current skills use variants. Deferred to story 4.3. [bmad-hook.js:89,133]
- [x] [Review][Defer] cwd with trailing slash breaks path scoping — `normCwd + '/'` becomes double-slash. Pre-existing pattern, not introduced by this change. [bmad-hook.js:124]
- [x] [Review][Defer] Windows case-insensitive filesystem vs case-sensitive `startsWith` — path casing mismatch possible on Windows. Pre-existing pattern across all path comparisons. [bmad-hook.js:124]
- [x] [Review][Defer] Settings fixture `claude-settings-with-hooks.json` stale — still declares old 2-signal model. Deferred to story 4.6 (installer/defaults). [test/fixtures/]

### Change Log

- 2026-03-30: Implemented all 6 tasks — 5-signal dispatch, multi-module SKILL_REGEX, cwd scoping, SessionStart+alive, status defaults, proactive project detection, 41 tests
- 2026-03-30: Code review — 1 patch, 5 deferred, 14 dismissed
