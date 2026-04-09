---
title: 'Resume session state preservation — survive SessionEnd for full widget recovery'
type: 'bugfix'
created: '2026-04-09'
status: 'done'
baseline_commit: 'fcf9b58'
context: ['_bmad-output/project-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** When Claude Code resumes a session (`--resume`), `handleSessionEnd` has already deleted the `status-{id}.json` file on close. Only project is recovered (proactive detection from `config.yaml`), but skill, workflow, started_at (timer), step, story, and active_skill are lost. The session also cannot reappear in the monitor.

**Approach:** SessionEnd keeps the status file and only deletes the `.alive` file. The alive file controls monitor visibility (no alive = invisible; resume recreates it). Orphaned status files are cleaned opportunistically at TUI launch (>7 days) and by `clean` command (also >7 days for orphans).

## Boundaries & Constraints

**Always:** Preserve existing `readStatus`/`writeStatus` contracts. Use `ALIVE_MAX_AGE_MS` from `shared-constants.cjs` for the 7-day threshold. Synchronous I/O only (Pattern 2). Silent error handling in hook (Pattern 1).

**Ask First:** Changing the stale-PID cleanup (lines 74-90) to also preserve status files — same rationale as SessionEnd but different trigger.

**Never:** Add new fields to the status file. Change `pollSessions()` discovery logic (alive + PID check already correct). Touch reader code.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| SessionEnd normal | alive + status exist | alive deleted, status preserved | Silent on unlink errors |
| Resume after SessionEnd | status exists, no alive | touchAlive recreates alive; readStatus returns full state | readStatus returns defaults if file corrupted |
| TUI launch with old orphans | orphan status mtime > 7 days | Deleted silently | Skip on unlink errors |
| TUI launch with recent orphans | orphan status mtime < 7 days | Kept (may be resumed) | N/A |
| `clean` with orphan status | status without alive, mtime > 7 days | Deleted | Existing logError pattern |
| `clean` with recent orphan | status without alive, mtime < 7 days | Kept | N/A |
| Stale PID cleanup | other session has same PID | alive deleted, status preserved | Silent |

</frozen-after-approval>

## Code Map

- `src/hook/bmad-hook.js:646-650` -- handleSessionEnd: currently deletes both files
- `src/hook/bmad-hook.js:74-90` -- stale PID cleanup: currently deletes both files
- `src/tui/app.js:239-258` -- launchTui: TUI entry point, pre-render init
- `src/clean.js:93-100` -- orphaned status deletion: currently unconditional
- `src/reader/shared-constants.cjs:6` -- ALIVE_MAX_AGE_MS (7 days)
- `test/hook.test.js:2143-2174` -- SessionEnd tests
- `test/clean.test.js` -- clean command tests
- `test/tui-monitor.test.js` -- pollSessions tests (verify no changes needed)

## Tasks & Acceptance

**Execution:**
- [x] `src/hook/bmad-hook.js` -- In handleSessionEnd, remove the status file deletion line (keep only alive deletion) -- status must survive for resume
- [x] `src/hook/bmad-hook.js` -- In stale PID cleanup (lines 84-85), remove the status file deletion -- same rationale, orphan cleanup handles it later
- [x] `src/clean.js` -- In orphaned status branch (lines 93-100), add mtime age check: only delete if `status mtime > ALIVE_MAX_AGE_MS` -- protect recent orphans that may be resumed
- [x] `src/tui/app.js` -- In launchTui, before render, add opportunistic cleanup: scan cache dir for `status-*.json` without matching `.alive-*`, delete if mtime > ALIVE_MAX_AGE_MS -- silent, no UI impact
- [x] `test/hook.test.js` -- Update SessionEnd tests: assert alive deleted but status preserved
- [x] `test/clean.test.js` -- Add tests: orphan status < 7 days is kept, orphan status > 7 days is deleted
- [x] `test/tui-app.test.js` -- Add test for opportunistic cleanup on TUI launch

**Acceptance Criteria:**
- Given a session with skill/workflow/started_at, when SessionEnd fires, then status file is preserved and alive file is deleted
- Given a preserved status file, when SessionStart (resume) fires, then readStatus returns full state including skill, workflow, started_at
- Given a resumed session with preserved status, when monitor polls, then session appears with correct skill and timer
- Given orphaned status files older than 7 days, when TUI launches, then orphans are silently deleted
- Given orphaned status files younger than 7 days, when TUI launches or `clean` runs, then orphans are kept

## Verification

**Commands:**
- `node --test test/hook.test.js` -- expected: all pass including updated SessionEnd tests
- `node --test test/clean.test.js` -- expected: all pass including new orphan age tests
- `node --test test/tui-app.test.js` -- expected: all pass including cleanup test

## Suggested Review Order

**Status preservation on session close/resume**

- SessionEnd now only deletes alive file — the core behavioral change
  [`bmad-hook.js:644`](../../src/hook/bmad-hook.js#L644)

- Stale PID cleanup also preserves status — same rationale, different trigger
  [`bmad-hook.js:84`](../../src/hook/bmad-hook.js#L84)

**Orphan cleanup (new safety net)**

- TUI launch: opportunistic scan deletes orphaned status > 7 days
  [`app.js:240`](../../src/tui/app.js#L240)

- clean.js: orphaned status now respects 7-day age threshold
  [`clean.js:94`](../../src/clean.js#L94)

**Tests**

- SessionEnd tests: alive deleted, status preserved with all fields
  [`hook.test.js:2143`](../../test/hook.test.js#L2143)

- Clean: recent orphan preserved, old orphan deleted, mixed state
  [`clean.test.js:47`](../../test/clean.test.js#L47)

- TUI cleanup: old/recent/paired/missing-dir coverage
  [`tui-app.test.js:243`](../../test/tui-app.test.js#L243)
