---
title: 'Reader-driven session cleanup on /clear'
type: 'feature'
created: '2026-04-06'
status: 'done'
baseline_commit: 'e8cd1d5'
context:
  - '_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** When a user runs `/clear` in a Claude Code session, the monitor continues showing the old session because no hook event fires and the alive file persists with a valid PID. The session only disappears after the user runs another command in the new conversation.

**Approach:** Leverage the fact that ccstatusline calls the reader with the NEW session_id immediately after `/clear`. When the reader detects an unknown session (no alive file), it performs PID detection + same-PID cleanup, deleting the old session's alive and status files. The monitor removes the session on its next poll (~1.5s).

## Boundaries & Constraints

**Always:**
- Reader remains CommonJS, zero npm dependencies, silent on errors (Pattern 1)
- Synchronous I/O only (Pattern 2)
- `findClaudeAncestorPid()` logic must match the hook's implementation exactly (wmic-based, Windows; silent fallback to null on other platforms)
- Same-PID cleanup must delete both `.alive-{sid}` and `status-{sid}.json` for stale sessions

**Ask First:**
- Any change to the monitor's `pollSessions()` filtering logic

**Never:**
- Modify the hook's existing cleanup logic (section 5a) — it remains as a redundant safety net
- Add async I/O or npm dependencies to the reader
- Break the reader for sessions where no alive file exists and no PID can be detected (graceful no-op)

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| /clear with ccstatusline | Reader called with new session_id, no alive file | PID detected, old alive+status deleted, new alive created | N/A |
| /clear, wmic fails | Reader called with new session_id, no alive file | Alive file created with empty content, no cleanup | Silent — old session persists until hook fires |
| Multiple lines called concurrently | 3 reader processes for line 0/1/2, all see no alive file | All 3 may run PID detection; first to write alive file wins, subsequent calls touch mtime | Safe — all write same PID, duplicate cleanup is idempotent |
| Session with alive file (normal) | Reader called with known session_id, alive file exists | Existing fast path: touch mtime only | N/A |
| Non-_bmad project session | Reader called, no alive file, no old sessions to clean | PID detection runs, no matching alive files found, alive file created | No-op cleanup, no harm |

</frozen-after-approval>

## Code Map

- `src/reader/bmad-sl-reader.js` -- Reader entry point; add `findClaudeAncestorPid()` and upgrade `touchAlive()` with PID detection + same-PID cleanup
- `src/hook/bmad-hook.js` -- Reference for `findClaudeAncestorPid()` (lines 632-651) and same-PID cleanup pattern (lines 74-90); no changes

## Tasks & Acceptance

**Execution:**
- [x] `src/reader/bmad-sl-reader.js` -- Add `findClaudeAncestorPid()` function (replicate from hook lines 632-651) -- Reader needs PID detection capability for cleanup
- [x] `src/reader/bmad-sl-reader.js` -- Upgrade `touchAlive()`: when alive file does not exist, run PID detection, create alive file with PID, then scan and delete other alive+status files with same PID -- This is the core cleanup mechanism triggered by ccstatusline's /clear re-render

**Acceptance Criteria:**
- Given a session visible in the monitor, when user runs `/clear` in that session, then the session disappears from the monitor within ~3 seconds (next reader call + next monitor poll)
- Given a session with no ccstatusline (edge case), when user runs `/clear` then runs a new command, then the old session disappears (hook's existing cleanup handles this — no regression)
- Given wmic failure or non-Windows platform, when reader encounters a new session, then alive file is created with empty content and no crash occurs

## Verification

**Commands:**
- `node --test test/*.test.js` -- expected: all existing tests pass (no regression)

**Manual checks:**
- Open monitor + second Claude session, run a skill, do `/clear`, observe session disappears from monitor within seconds

## Suggested Review Order

- Core change: reader creates alive file + same-PID cleanup when no alive file exists (after /clear)
  [`bmad-sl-reader.js:126`](../../bmad-statusline/src/reader/bmad-sl-reader.js#L126)

- PID detection function replicated from hook — wmic-based ancestor walk
  [`bmad-sl-reader.js:103`](../../bmad-statusline/src/reader/bmad-sl-reader.js#L103)

- Graceful bail when PID detection fails — avoids poisoning hook's fast path
  [`bmad-sl-reader.js:138`](../../bmad-statusline/src/reader/bmad-sl-reader.js#L138)

- Reference: hook's original implementation that the reader mirrors
  [`bmad-hook.js:632`](../../bmad-statusline/src/hook/bmad-hook.js#L632)
