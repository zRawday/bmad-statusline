# Story 8.2: Hook — SubagentStart/Stop, PostToolUseFailure, PermissionDenied handlers

Status: done

## Story

As a **developer monitoring Claude Code sessions**,
I want **visibility into sub-agent lifecycle and transparent handling of tool failures/denials**,
So that **the Monitor accurately shows when a sub-agent is working and doesn't display false states on auto-mode denials**.

## Acceptance Criteria

1. **Given** a `SubagentStart` hook event fires with `agent_type: "Explore"`, **When** the hook dispatches, **Then** `handleSubagentStart()` sets `llm_state = "active:subagent"`, `subagent_type = "Explore"`, `llm_state_since = now`. `subagent_type` is never null when `llm_state === "active:subagent"`.

2. **Given** a `SubagentStop` hook event fires, **When** the hook dispatches, **Then** `handleSubagentStop()` sets `llm_state = "active"`, `subagent_type = null`, `llm_state_since = now`.

3. **Given** a `PostToolUseFailure` hook event fires, **When** the hook dispatches, **Then** `handlePostToolUseFailure()` sets `llm_state = "active"`, `llm_state_since = now` (Claude adapts autonomously).

4. **Given** a `PermissionDenied` hook event fires, **When** the hook dispatches, **Then** `handlePermissionDenied()` sets `llm_state = "active"`, `llm_state_since = now` (auto-mode denied, Claude adapts).

5. **Given** any event transitions away from `active:subagent` state, **Then** `subagent_type` is cleared to null.

6. **Given** tests, **When** executed, **Then** tests for all 4 handlers, `subagent_type` field coupling, state transitions in/out of `active:subagent`, and all existing tests pass (`npm test`).

## Tasks / Subtasks

- [x] Task 1: Add 4 new handler functions to `bmad-hook.js` (AC: 1, 2, 3, 4)
  - [x] 1.1 Add `handleSubagentStart()` — reads status, sets `llm_state = "active:subagent"`, `subagent_type` from payload, `llm_state_since = now`, writes status
  - [x] 1.2 Add `handleSubagentStop()` — reads status, sets `llm_state = "active"`, `subagent_type = null`, `llm_state_since = now`, writes status
  - [x] 1.3 Add `handlePostToolUseFailure()` — reads status, sets `llm_state = "active"`, `llm_state_since = now`, writes status
  - [x] 1.4 Add `handlePermissionDenied()` — reads status, sets `llm_state = "active"`, `llm_state_since = now`, writes status
- [x] Task 2: Extend dispatch table in section 6 (AC: 1, 2, 3, 4)
  - [x] 2.1 Add 4 new `else if` branches after existing `PermissionRequest` dispatch for `PermissionDenied`, `PostToolUseFailure`, `SubagentStart`, `SubagentStop`
- [x] Task 3: Ensure `subagent_type` field clearing on state transitions (AC: 5)
  - [x] 3.1 Every handler that sets `llm_state` to anything other than `"active:subagent"` must clear `subagent_type = null`
  - [x] 3.2 Handlers affected: `handleSubagentStop`, `handlePostToolUseFailure`, `handlePermissionDenied`, plus all existing handlers (handleUserPrompt, handleRead, handleWrite, handleEdit, handleBash, handlePreToolUse, handleStop, handleNotification, handlePermissionRequest, handleStopFailure)
- [x] Task 4: Add tests to `test/hook.test.js` (AC: 6)
  - [x] 4.1 `handleSubagentStart` sets `llm_state = "active:subagent"`, `subagent_type` from payload
  - [x] 4.2 `handleSubagentStart` with various `agent_type` values (Explore, Plan, general-purpose)
  - [x] 4.3 `handleSubagentStop` sets `llm_state = "active"`, clears `subagent_type`
  - [x] 4.4 `handlePostToolUseFailure` sets `llm_state = "active"`
  - [x] 4.5 `handlePermissionDenied` sets `llm_state = "active"`
  - [x] 4.6 `subagent_type` clearing: transition from `active:subagent` to `active` via Stop, PostToolUseFailure, PermissionDenied
  - [x] 4.7 All existing tests still pass
- [x] Task 5: Verify `npm test` passes with all existing + new tests (AC: 6)

## Dev Notes

### Architecture Compliance

**File to modify:** `bmad-statusline/src/hook/bmad-hook.js` (the single hook entry point, CJS, ~766 lines)

**File to modify (tests):** `bmad-statusline/test/hook.test.js`

**Architecture revision:** Rev.5 — this story implements FR70, FR71, FR73, FR74

### Scope Boundaries

**In scope:** 4 new handlers, dispatch extension, subagent_type clearing, tests.

**Out of scope (other stories):**
- `handlePermissionRequest`, `handleStopFailure`, `handleSessionEnd` → story 8.1
- Installer/defaults new matcher registration → story 8.3
- `shared-constants.cjs` LLM_STATE_PRIORITY update → story 8.4
- Reader `formatLlmState()` for new states → story 8.4
- LlmBadge display for error/subagent → story 8.5

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- CRLF line endings in bmad-hook.js required using node scripts for patching instead of Edit tool (Edit tool replacements with \n didn't match \r\n file)
- Story 8.1 was already implemented on this branch — error_type field and handlers (PermissionRequest, StopFailure, SessionEnd) already present
- New handlers also clear error_type = null for consistency with 8.1 pattern

### Completion Notes List

- Added 4 handler functions: handleSubagentStart (section 17), handleSubagentStop (section 18), handlePostToolUseFailure (section 19), handlePermissionDenied (section 20)
- Extended dispatch table with 4 new branches between PermissionRequest and SessionStart
- Added subagent_type = null clearing to all 11 existing handlers that set llm_state
- Added subagent_type field to readStatus defaults (compact + expanded) and normalization
- All new handlers also clear error_type = null for 8.1 compatibility
- 9 new tests added covering all 4 handlers and subagent_type field coupling
- All 126 hook tests pass, 0 regressions

### File List

- bmad-statusline/src/hook/bmad-hook.js (modified — 4 new handlers, dispatch extension, subagent_type clearing in all handlers, readStatus defaults)
- bmad-statusline/test/hook.test.js (modified — 9 new tests for 8.2 ACs)

### Change Log

- 2026-04-07: Story 8.2 implemented — 4 new hook handlers, dispatch, subagent_type field support, 9 tests

### Review Findings

- [x] [Review][Patch] AC#1 invariant: `handleSubagentStart` allows `subagent_type=null` when `llm_state='active:subagent'` — fix `payload.agent_type || null` → `payload.agent_type || 'unknown'` [bmad-hook.js:674]
- [x] [Review][Patch] `readStatus` normalization uses `||` instead of `??` — coerces empty strings to null [bmad-hook.js:830-831]
- [x] [Review][Defer] Missing AC#5 test coverage for `subagent_type` clearing via existing handlers (UserPromptSubmit, Read, Write, Edit, Bash, PreToolUse, Stop, Notification) — deferred, test gap only
- [x] [Review][Defer] No test for `StopFailure` clearing `subagent_type` from `active:subagent` state — deferred, 8.1 scope
- [x] [Review][Defer] No test for `SubagentStart` overwriting existing error state — deferred, cross-state edge case
- [x] [Review][Defer] No integration test for full subagent lifecycle sequence — deferred, nice-to-have
- [x] [Review][Defer] Missing test for `error_type` clearing via Read/Write/Edit/Bash handlers — deferred, 8.1 scope
