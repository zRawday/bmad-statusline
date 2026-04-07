# Story 4.7: Uninstaller — 3-generation backward compat

Status: done

## Story

As a **developer removing bmad-statusline**,
I want **`npx bmad-statusline uninstall` to cleanly remove hook config from all 3 event types and handle artifacts from Phase 1, Phase 2, and Phase 4 installs**,
So that **my system is fully clean regardless of which version was originally installed**.

## Acceptance Criteria

1. **Phase 4 removal (3 event types):** Given `~/.claude/settings.json` contains bmad-hook entries across `UserPromptSubmit`, `PostToolUse`, and `SessionStart`, uninstall removes only entries with command containing `bmad-hook.js` from all 3 event type arrays, preserving all other hooks. Creates `.bak` backup before writing. Validates post-write by rereading and parsing.
2. **Phase 2 only removal:** Given `~/.claude/settings.json` has bmad-hook entries only in `PostToolUse` (Phase 2 install — Skill + Read matchers), uninstall removes the matching entries from `PostToolUse` and does not error on missing `UserPromptSubmit` or `SessionStart` keys.
3. **No entries skip:** Given `~/.claude/settings.json` has no bmad-hook entries in any event type, uninstall skips and logs `○ skipped`.
4. **Empty array preservation:** Given an event type array (e.g., `PostToolUse`) becomes empty after removing bmad entries, the empty array is left in place (not deleted) — other tools may expect the key to exist.
5. **Phase 1 CLAUDE.md backward compat:** Given `.claude/CLAUDE.md` contains `<!-- bmad-statusline:start -->` markers from a Phase 1 install, uninstall removes the markers and content between them, logs `✓`.
6. **Phase 1 permissions backward compat:** Given `.claude/settings.local.json` contains permission rules matching `BMAD_PROJ_DIR`, uninstall removes the matching rules, logs `✓`.
7. **Mixed-generation cleanup:** Given a system with both Phase 4 hook entries AND Phase 1 CLAUDE.md markers, both are cleaned in a single pass — all 3 generations handled.
8. **Idempotent:** Given uninstall has already been run, a second run shows all targets `○ skipped`, exit 0.
9. **Tests updated:** `test/uninstall.test.js` tests: (a) removal from 3 event type keys, (b) Phase 2 only removal, (c) no entries skip, (d) Phase 1 CLAUDE.md backward compat, (e) Phase 1 permissions backward compat, (f) mixed-generation cleanup, (g) idempotency, (h) preservation of non-bmad hooks.

## Tasks / Subtasks

- [x] Task 1: Fix empty array deletion in `uninstallTarget5()` (AC: #4)
  - [x] 1.1 Remove the `if (config.hooks[event].length === 0) delete config.hooks[event]` line — empty arrays must be preserved after bmad entry removal
  - [x] 1.2 Remove the `if (Object.keys(config.hooks).length === 0) delete config.hooks` line — preserve hooks object
- [x] Task 2: Add Phase 2 only removal test (AC: #2)
  - [x] 2.1 Add test `'removes Phase 2 Skill+Read matchers from PostToolUse only'` — load `claude-settings-with-hooks-phase2.json` fixture, run uninstall, verify both Skill and Read bmad entries removed from PostToolUse, no errors on missing UserPromptSubmit/SessionStart keys
- [x] Task 3: Add mixed-generation cleanup test (AC: #7)
  - [x] 3.1 Add test `'cleans all 3 generations in single pass'` — set up temp dir with Phase 4 hooks fixture + CLAUDE.md with markers + settings.local.json with BMAD_PROJ_DIR rule, run uninstall, verify all targets cleaned in one pass
- [x] Task 4: Update existing Target 5 tests for empty array preservation (AC: #4, #9)
  - [x] 4.1 Update `'removes bmad-hook entries from all event types'` test (or equivalent) — assert event type keys still exist with empty arrays after bmad entry removal, instead of asserting keys are deleted
  - [x] 4.2 Update any test asserting `config.hooks` is deleted — it should now be preserved as empty object
- [x] Task 5: Verify existing tests still cover remaining ACs (AC: #1, #3, #5, #6, #8, #9h)
  - [x] 5.1 Verify test for Phase 4 removal exists and covers 3 event types with backup/validation
  - [x] 5.2 Verify test for no-entries skip exists
  - [x] 5.3 Verify test for CLAUDE.md marker removal exists
  - [x] 5.4 Verify test for BMAD_PROJ_DIR rule removal exists
  - [x] 5.5 Verify idempotency test exists
  - [x] 5.6 Verify non-bmad hook preservation test exists

## Dev Notes

### Scope — What's Actually Changing

This story is **small**. The current `uninstallTarget5()` already handles all 3 generations correctly via a generic `Object.keys(config.hooks)` loop that detects any entry with `bmad-hook.js` in its command. The code change is a **single behavior fix** (stop deleting empty arrays) plus **two new tests**.

### Error Handling: VERBOSE (Installer)

The uninstaller uses the verbose philosophy from the Error Handling Triad. Log every action with `logSuccess`/`logSkipped`/`logError` helpers. This is the **opposite** of the hook and reader which are silent.

### Config JSON Mutation Sequence (Uninstaller)

Every write to `settings.json` MUST follow:
```
read -> parse -> backup(.bak) -> modify in memory -> stringify(null, 2) -> write -> reread -> parse(validate)
```
Already implemented in `writeJsonSafe()` and `backupFile()` — reuse them.

### Files To Modify

| File | Action |
|------|--------|
| `bmad-statusline/src/uninstall.js` | Modify `uninstallTarget5()` — remove empty key/object deletion |
| `bmad-statusline/test/uninstall.test.js` | Modify — update empty array assertions + add 2 new tests |

### Current Target 5 Code — What To Change

The current `uninstallTarget5()` has this removal logic:

```js
for (const event of Object.keys(config.hooks)) {
  if (!Array.isArray(config.hooks[event])) continue;
  config.hooks[event] = config.hooks[event].filter(entry => !isBmadHook(entry));
  if (config.hooks[event].length === 0) delete config.hooks[event];   // ← REMOVE THIS LINE
}
if (Object.keys(config.hooks).length === 0) delete config.hooks;      // ← REMOVE THIS LINE
```

**After change:**
```js
for (const event of Object.keys(config.hooks)) {
  if (!Array.isArray(config.hooks[event])) continue;
  config.hooks[event] = config.hooks[event].filter(entry => !isBmadHook(entry));
}
```

That's it. Two lines removed. The `isBmadHook` detection and filter loop are already correct for all 3 generations.

### Why Empty Arrays Must Be Preserved

The AC states: "other tools may expect the key to exist." Claude Code and other hook consumers may check `hooks.PostToolUse` and expect it to be an array. Deleting the key could cause those tools to fail or behave differently than having an empty array.

### 3-Generation Detection — Already Handled

| Generation | How Detected by Current Code |
|------------|------------------------------|
| Phase 1 (CLAUDE.md/permissions) | Target 6 (`<!-- bmad-statusline:start -->` markers) + Target 7 (`BMAD_PROJ_DIR` rules) — separate targets, unchanged |
| Phase 2 (PostToolUse Skill+Read) | Target 5 generic loop: `isBmadHook()` checks if entry's hooks contain `bmad-hook.js` in command — Skill matcher IS detected because command contains `bmad-hook.js` |
| Phase 4 (5-matcher, 3 event types) | Target 5 generic loop: iterates ALL `Object.keys(config.hooks)` — covers UserPromptSubmit, PostToolUse, SessionStart |

No new detection logic needed. The generic `isBmadHook` + `Object.keys` loop handles all generations.

### Test: Phase 2 Only Removal

Use existing `test/fixtures/claude-settings-with-hooks-phase2.json` fixture:
```json
{
  "permissions": {},
  "hooks": {
    "PostToolUse": [
      { "matcher": "Skill", "hooks": [{ "type": "command", "command": "node \"~/.config/bmad-statusline/bmad-hook.js\"" }] },
      { "matcher": "Read", "hooks": [{ "type": "command", "command": "node \"~/.config/bmad-statusline/bmad-hook.js\"" }] }
    ]
  }
}
```

**Expected after uninstall:** `hooks.PostToolUse` is empty array `[]` (preserved, not deleted). No errors from missing UserPromptSubmit or SessionStart keys.

### Test: Mixed-Generation Cleanup

Set up temp dir with:
1. `claude-settings-with-hooks.json` fixture → hooks with all 3 event types (Phase 4)
2. `claude-md-with-block.md` fixture → CLAUDE.md with markers (Phase 1)
3. `settings-local-with-bmad.json` fixture → settings.local.json with BMAD_PROJ_DIR (Phase 1)

Run uninstall once. Assert:
- Target 5: hooks cleaned (entries removed, empty arrays preserved)
- Target 6: CLAUDE.md markers removed
- Target 7: BMAD_PROJ_DIR rules removed
- Output contains success markers for all 3 targets

### Test: Existing Target 5 Assertions To Update

Any test that currently asserts:
- `assert(!config.hooks.PostToolUse)` → change to `assert.deepStrictEqual(config.hooks.PostToolUse, [])`
- `assert(!config.hooks)` → change to `assert.deepStrictEqual(config.hooks, { UserPromptSubmit: [], PostToolUse: [], SessionStart: [] })` (or whatever event types were present)

### Existing Test Coverage Verification

From current test suite analysis, these tests already exist:
- Phase 4 removal from multiple event types — exists (Target 5, 6 tests)
- Non-bmad hook preservation — exists
- Empty hook cleanup and backup — exists (needs assertion update)
- CLAUDE.md marker removal — exists (Target 6, 3 tests)
- BMAD_PROJ_DIR rule removal — exists (Target 7, 5 tests)
- Idempotency — exists (1 test)
- No entries skip — exists

**Only 2 new tests needed** (Phase 2 fixture + mixed-generation). Remaining is assertion updates.

### Synchronous File I/O

All file operations MUST use `fs.readFileSync` / `fs.writeFileSync`. Never async. Correctness guarantee — not a style choice.

### Test Patterns

Tests use `node:test` + `node:assert/strict`. Temp dirs via `fs.mkdtempSync`, fixtures from `test/fixtures/`, paths injection via `createPaths(baseDir)`. `captureOutput()` helper captures `console.log` for assertion.

### What This Story Does NOT Do

- Does NOT modify hook script logic (`src/hook/bmad-hook.js`) — stories 4.2-4.5
- Does NOT modify reader (`src/reader/`) — no reader changes in Epic 4
- Does NOT modify installer (`src/install.js`) — story 4.6
- Does NOT modify defaults (`src/defaults.js`) — story 4.6
- Does NOT modify clean command (`src/clean.js`) — story 4.8
- Does NOT modify TUI — no TUI changes in Epic 4
- Does NOT add any new detection logic — existing `isBmadHook` + `Object.keys` loop is already correct

### Project Structure Notes

- `bmad-statusline/src/uninstall.js` — ESM module, exports a single default function. 7 internal targets. Target 5 is the only one modified.
- `bmad-statusline/test/uninstall.test.js` — ESM, `node:test` + `node:assert/strict`, temp dir pattern with `createPaths(baseDir)`, fixture loading via `copyFixture()`, output capture via `captureOutput()`.
- `bmad-statusline/test/fixtures/` — JSON fixtures for install/uninstall tests. `claude-settings-with-hooks-phase2.json` already exists from story 4-6.
- Run tests: `npm test` (runs `node --test test/*.test.js`, currently 212 tests passing)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md — Uninstall Changes, 3-Generation Backward Compat table]
- [Source: _bmad-output/planning-artifacts/epics.md — Story 4.7 acceptance criteria]
- [Source: _bmad-output/project-context.md — Config JSON Mutation Sequence, Error Handling Triad, Uninstall targets, Architectural Boundaries]
- [Source: _bmad-output/implementation-artifacts/4-6-defaults-installer-5-matcher-config.md — Previous story: 5-matcher config, Phase 2 fixture creation]
- [Source: bmad-statusline/src/uninstall.js — Current uninstallTarget5() with empty key deletion logic]
- [Source: bmad-statusline/test/uninstall.test.js — Current 26 uninstall tests, Target 5 assertions to update]
- [Source: bmad-statusline/test/fixtures/claude-settings-with-hooks.json — Phase 4 5-matcher fixture]
- [Source: bmad-statusline/test/fixtures/claude-settings-with-hooks-phase2.json — Phase 2 Skill+Read fixture]
- [Source: bmad-statusline/test/fixtures/claude-md-with-block.md — Phase 1 CLAUDE.md marker fixture]
- [Source: bmad-statusline/test/fixtures/settings-local-with-bmad.json — Phase 1 BMAD_PROJ_DIR fixture]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation, no debugging needed.

### Completion Notes List

- Removed 2 lines from `uninstallTarget5()` that deleted empty arrays and the hooks object after bmad entry removal. Empty arrays and hooks object are now preserved per AC #4.
- Added test `'removes Phase 2 Skill+Read matchers from PostToolUse only'` — validates Phase 2 only removal with no errors on missing event types (AC #2).
- Added test `'cleans all 3 generations in single pass'` — validates Phase 4 hooks + Phase 1 CLAUDE.md markers + Phase 1 BMAD_PROJ_DIR rules all cleaned in a single uninstall run (AC #7).
- Updated 2 existing Target 5 tests: assertions now verify empty arrays are preserved instead of asserting keys are deleted (AC #4).
- Verified all remaining ACs covered by existing tests: Phase 4 removal (#1), no-entries skip (#3), CLAUDE.md markers (#5), BMAD_PROJ_DIR rules (#6), idempotency (#8), non-bmad hook preservation (#9h).
- Full regression suite: 214 tests passing (212 → 214, +2 new tests), 0 failures.

### File List

- `bmad-statusline/src/uninstall.js` — modified (removed empty array/object deletion in uninstallTarget5)
- `bmad-statusline/test/uninstall.test.js` — modified (updated 2 assertions + added 2 new tests)

### Change Log

- 2026-03-30: Story 4-7 implemented — empty array preservation fix + 2 new tests (Phase 2 only, mixed-generation)
