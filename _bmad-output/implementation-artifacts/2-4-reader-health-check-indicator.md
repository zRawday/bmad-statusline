# Story 2.4: Reader health check indicator

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer using BMAD statusline**,
I want **a `health` command in the reader that shows whether the status file is actively being updated**,
So that **I can tell at a glance if the hook is working or if the status data is stale**.

## Acceptance Criteria

1. **Given** the reader is called with command `health` **When** the status file `updated_at` timestamp is less than 60 seconds old **Then** the output is `●` (green dot, ANSI green `\x1b[32m`)

2. **Given** the reader is called with command `health` **When** the status file `updated_at` timestamp is between 60 and 300 seconds old **Then** the output is `●` (yellow dot, ANSI yellow `\x1b[33m`)

3. **Given** the reader is called with command `health` **When** the status file `updated_at` is older than 300 seconds or missing **Then** the output is `○` (dim dot, ANSI brightBlack `\x1b[90m`)

4. **Given** the reader is called with command `health` **When** no status file exists for the session **Then** the output is an empty string

5. **Given** the `health` command implementation **When** inspected **Then** it uses the `colorize()` helper with appropriate ANSI codes, consistent with existing reader patterns

6. **Given** `test/reader.test.js` **When** updated **Then** it tests the three health states (fresh, stale, expired) plus missing `updated_at` using fixture status files with controlled `updated_at` timestamps

## Tasks / Subtasks

- [x] Task 1: Add `health` command to COMMANDS map in reader (AC: #1, #2, #3, #5)
  - [x] 1.1 Add health thresholds as constants at top of reader: `FRESH_THRESHOLD_MS = 60000`, `STALE_THRESHOLD_MS = 300000`
  - [x] 1.2 Add `health` entry to the COMMANDS object: compute age from `s.updated_at`, return colored symbol via `colorize()`
  - [x] 1.3 Fresh (< 60s): `colorize('\u25CF', '\x1b[32m')` — green filled circle
  - [x] 1.4 Stale (60s–300s): `colorize('\u25CF', '\x1b[33m')` — yellow filled circle
  - [x] 1.5 Expired (> 300s) or missing/invalid `updated_at`: `colorize('\u25CB', '\x1b[90m')` — dim empty circle
  - [x] 1.6 Handle edge cases: `isNaN(ageMs)`, negative age, missing `updated_at` — all return dim circle

- [x] Task 2: Handle "no status file" case (AC: #4)
  - [x] 2.1 Verify existing main() flow: when `readStatusFile()` returns null, `process.stdout.write('')` already fires before COMMANDS — **no code change needed**, just confirm behavior

- [x] Task 3: Add health command tests to reader test suite (AC: #6)
  - [x] 3.1 Test fresh state: write status with `updated_at: new Date().toISOString()`, assert output is `\x1b[32m●\x1b[0m`
  - [x] 3.2 Test stale state: write status with `updated_at` 120 seconds ago, assert output is `\x1b[33m●\x1b[0m`
  - [x] 3.3 Test expired state: write status with `updated_at` 600 seconds ago, assert output is `\x1b[90m○\x1b[0m`
  - [x] 3.4 Test missing `updated_at`: write status `{}`, assert output is `\x1b[90m○\x1b[0m`
  - [x] 3.5 Test no status file: use nonexistent session_id, assert output is empty string
  - [x] 3.6 Run `npm test` — reader tests pass (42 existing + new), zero regressions

- [x] Task 4: Clean up standalone health.js (AC: #5)
  - [x] 4.1 Delete `src/reader/health.js` — its logic is now inlined in the reader, and it is NOT referenced by any other file
  - [x] 4.2 Verify no imports of `./health.js` or `./health` exist anywhere in the codebase

## Dev Notes

### Critical Architecture Constraint: Reader is Standalone Self-Contained

The reader (`src/reader/bmad-sl-reader.js`) is a **standalone CommonJS module** deployed as a single file to `~/.config/bmad-statusline/`. It cannot `require()` external files — everything must be inlined. The installer target #3 copies only this single file.

A preparatory file `src/reader/health.js` already exists with the health check logic, but it uses its own ANSI constants (`GREEN`, `YELLOW`, `DIM`) instead of `colorize()`. **Do NOT require it**. Instead, inline the logic directly into the COMMANDS map using the reader's existing `colorize()` helper. Then delete `health.js`.

### Existing `health.js` as Reference (DO NOT IMPORT)

File `src/reader/health.js` (30 lines) contains:
- `getHealthIndicator(updatedAt)` — threshold logic (60s/300s) with ANSI output
- `FRESH_THRESHOLD_MS = 60000`, `STALE_THRESHOLD_MS = 300000`
- Uses raw ANSI template literals, NOT `colorize()`

Use it as a **reference for the threshold logic**, then delete it after inlining.

### Implementation Pattern — Follow Existing COMMANDS Entries

The `health` command follows the same pattern as other individual extractors. Example reference — `timer`:

```js
timer: (s) => formatTimer(s.started_at),
```

For `health`, inline is cleaner than a helper function given its simplicity:

```js
health: (s) => {
  const updatedAt = s.updated_at;
  if (!updatedAt) return colorize('\u25CB', '\x1b[90m');
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  if (isNaN(ageMs) || ageMs < 0) return colorize('\u25CB', '\x1b[90m');
  if (ageMs < FRESH_THRESHOLD_MS) return colorize('\u25CF', '\x1b[32m');
  if (ageMs < STALE_THRESHOLD_MS) return colorize('\u25CF', '\x1b[33m');
  return colorize('\u25CB', '\x1b[90m');
},
```

### Unicode Characters

- `\u25CF` = `●` (BLACK CIRCLE — filled dot)
- `\u25CB` = `○` (WHITE CIRCLE — empty/open dot)

### ANSI Codes Used by Health

| State | Symbol | ANSI Code | `colorize()` Call |
|-------|--------|-----------|-------------------|
| Fresh (< 60s) | ● | `\x1b[32m` (green) | `colorize('\u25CF', '\x1b[32m')` |
| Stale (60s–300s) | ● | `\x1b[33m` (yellow) | `colorize('\u25CF', '\x1b[33m')` |
| Expired (> 300s) | ○ | `\x1b[90m` (brightBlack/dim) | `colorize('\u25CB', '\x1b[90m')` |
| Missing/invalid | ○ | `\x1b[90m` (brightBlack/dim) | `colorize('\u25CB', '\x1b[90m')` |

These are consistent with existing reader color usage: `\x1b[32m` (green) and `\x1b[33m` (yellow) are both in `WORKFLOW_COLORS`, `\x1b[90m` (dim) is used for the composite separator.

### No Status File → Empty String (Already Handled)

The reader's `main()` flow (lines 190-218) already returns empty string when no status file exists:
```js
const status = readStatusFile(sessionId);
if (!status) {
  process.stdout.write('');
  return;
}
```
This covers AC #4 without any new code. Just verify via test.

### No Composite Changes

The `health` command is **individual only** — it is NOT added to compact/full/minimal composites. It's a standalone indicator meant for a separate ccstatusline widget slot.

### Error Handling: Silent (Reader Pattern)

Per project conventions: reader = **silent always**. Return empty string or dim circle on any error. Never `console.log`, never `console.error`, never throw.

### Test Pattern — Controlled Timestamps

Tests must use controlled `updated_at` timestamps to guarantee deterministic results:

```js
// Fresh: just now
writeStatus('health-fresh', { updated_at: new Date().toISOString() });

// Stale: 2 minutes ago (well within 60s-300s range)
writeStatus('health-stale', { updated_at: new Date(Date.now() - 120 * 1000).toISOString() });

// Expired: 10 minutes ago (well past 300s)
writeStatus('health-expired', { updated_at: new Date(Date.now() - 600 * 1000).toISOString() });
```

Use wide margins from thresholds (120s for stale, 600s for expired) to avoid flaky tests from execution timing.

### Test Baseline

- **42 reader tests** currently passing (2 suites: `reader color output` + `color maps sync`)
- Add health tests to the existing `reader color output` describe block
- Expected final count: 42 + 5 new = **47 tests**
- Install tests have a pre-existing failure (unrelated to this story, `install.test.js:340`)

### Project Structure Notes

- All changes within `bmad-statusline/src/reader/` and `bmad-statusline/test/` — aligned with Boundary 2 (Reader)
- No installer changes needed — reader is a single-file deploy, no new files to copy
- No TUI changes needed — health is not a composite widget and doesn't affect widget-registry
- No hook changes needed — `updated_at` is already written by the hook on every status file write

### Files to Modify

| File | Change |
|------|--------|
| `bmad-statusline/src/reader/bmad-sl-reader.js` | Add `FRESH_THRESHOLD_MS`/`STALE_THRESHOLD_MS` constants, add `health` entry to COMMANDS map |
| `bmad-statusline/test/reader.test.js` | Add 5 health command tests (fresh, stale, expired, missing updated_at, no status file) |

### Files to Delete

| File | Reason |
|------|--------|
| `bmad-statusline/src/reader/health.js` | Logic inlined into reader; standalone file is dead code post-integration |

### Files NOT to Modify

- `src/hook/bmad-hook.js` — already writes `updated_at` on every status write
- `src/install.js` — reader is single-file deploy, no new targets
- `src/uninstall.js` — no new artifacts to clean
- `src/defaults.js` — no new color maps or config
- `src/tui/app.js` — health is not a TUI widget
- `src/tui/widget-registry.js` — health is not registered as a TUI widget
- `test/fixtures/status-sample.json` — already has `updated_at` field

### Previous Story Intelligence (2.2)

From Story 2.2 completion notes:
- **142 total tests** across all test files (42 reader + others), 0 regressions at time of 2.2
- Install tests have a pre-existing failure at `install.test.js:340` — do not attempt to fix
- Guard patterns: always check for null/undefined before property access
- Reader changes don't require TUI changes unless composites are affected (they aren't here)

### Git Intelligence

Recent commits (2026-03-29):
- Epic 3 (hook pivot) is fully implemented: stories 3-1 through 3-7 all done
- Code review fixes applied: regex anchoring, numeric step sorting, dead code removal (`getStoryOrRequest()`)
- `updated_at` is reliably set by the hook (`writeStatus` in `bmad-hook.js`) on every PostToolUse event

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4] — acceptance criteria, BDD format
- [Source: _bmad-output/project-context.md#Critical Implementation Rules #8] — ANSI Color Wrapping, colorize() helper
- [Source: _bmad-output/project-context.md#Critical Implementation Rules #1] — Error Handling Triad (reader = silent)
- [Source: _bmad-output/project-context.md#Status File Schema] — updated_at field, ISO 8601 string
- [Source: _bmad-output/project-context.md#Architectural Boundaries #2] — Reader boundary (standalone CJS)
- [Source: bmad-statusline/src/reader/bmad-sl-reader.js] — current reader code (221 lines), COMMANDS map, colorize() helper
- [Source: bmad-statusline/src/reader/health.js] — preparatory health logic (reference, to be deleted)
- [Source: bmad-statusline/test/reader.test.js] — 42 tests, execSync pattern, BMAD_CACHE_DIR injection
- [Source: _bmad-output/implementation-artifacts/2-2-tui-color-modes-reorder-live-preview.md] — previous story learnings

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation, no debugging required.

### Completion Notes List

- Added `FRESH_THRESHOLD_MS` (60s) and `STALE_THRESHOLD_MS` (300s) constants to reader
- Added `health` command to COMMANDS map: computes age from `s.updated_at`, returns colored dot via `colorize()`
- Fresh (< 60s) → green ● | Stale (60-300s) → yellow ● | Expired/missing → dim ○
- Edge cases handled: `isNaN(ageMs)`, negative age, missing `updated_at` all return dim circle
- No-status-file case confirmed handled by existing `main()` flow (returns empty string)
- Added 5 health tests to `reader color output` suite (fresh, stale, expired, missing updated_at, no status file)
- Test count: 42 → 47 (0 regressions in reader suite)
- Deleted standalone `src/reader/health.js` — logic fully inlined, no imports referenced it
- Pre-existing failures in install.test.js and hook.test.js are unrelated (Epic 4 WIP)

### Change Log

- 2026-03-30: Implemented health check indicator — inlined health command in reader, added 5 tests, deleted standalone health.js

### File List

- `bmad-statusline/src/reader/bmad-sl-reader.js` — MODIFIED (added FRESH/STALE thresholds + health COMMANDS entry)
- `bmad-statusline/test/reader.test.js` — MODIFIED (added 5 health command tests)
- `bmad-statusline/src/reader/health.js` — DELETED (logic inlined into reader)
