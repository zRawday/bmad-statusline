# Story 8.7: LLM State Simplification — 5-State Model

Status: ready-for-dev

## Story

As a **developer monitoring Claude Code sessions**,
I want **the LLM state machine reduced from 7 states to 5 (active, permission, waiting, interrupted, error)**,
So that **state detection is simpler, more stable, and every displayed state maps to a clear, actionable meaning**.

## Acceptance Criteria

### AC1 — `active:subagent` removed: SubagentStart sets `active`

**Given** a `SubagentStart` hook event fires,
**When** `handleSubagentStart()` dispatches,
**Then** `llm_state = 'active'` (not `'active:subagent'`), `subagent_type` is still captured from payload, `error_type = null`.

### AC2 — `inactive` state removed everywhere

**Given** any session status,
**When** the reader, TUI monitor, or shared constants process it,
**Then** no code references `inactive` as a state value, `computeDisplayState()` no longer returns `'inactive'`, and `INACTIVE_TIMEOUT_MS` is removed from shared-constants.

### AC3 — `computeDisplayState()` simplified

**Given** a session status object,
**When** `computeDisplayState(status)` is called,
**Then** it returns `status.llm_state || 'waiting'` — no timeout check, no `inactive` fallback. A session with no `llm_state` or stale `updated_at` shows `waiting` (semantically correct: system awaits user).

### AC4 — `Notification` handler removed from hook

**Given** a `Notification` hook event fires,
**When** the hook dispatch table processes it,
**Then** it is a no-op (or removed from dispatch). Only `PermissionRequest` sets `permission` state.

### AC5 — `Notification` matcher removed from defaults and installer

**Given** `getHookConfig()` in `defaults.js`,
**When** generating the hook configuration,
**Then** the `Notification` key is absent from the hooks object. The installer no longer registers a `Notification` matcher in `~/.claude/settings.json`.

### AC6 — Reader renders only 5 states

**Given** the reader `LLM_STATES` config,
**When** defined,
**Then** it contains exactly: `permission`, `waiting`, `error`, `interrupted`, `active`. No `inactive` or `active:subagent` entries. Unknown states fall through to `active` styling (green).

### AC7 — LlmBadge renders only 5 states

**Given** `LLM_BADGE_CONFIG` in `LlmBadge.js`,
**When** defined,
**Then** it contains exactly: `active`, `permission`, `waiting`, `error`, `interrupted`. No `inactive` or `active:subagent`. Fallback for unknown state uses `active` config. The `state === 'inactive'` timer guard in `useEffect` is removed (timer always ticks).

### AC8 — SessionTabs renders only 5 states

**Given** `STATE_ICONS` in `SessionTabs.js`,
**When** defined,
**Then** it contains exactly: `active`, `permission`, `waiting`, `error`, `interrupted`. No `inactive` or `active:subagent`. Fallback uses `active` icon.

### AC9 — `LLM_STATE_PRIORITY` reduced to 5 entries

**Given** `LLM_STATE_PRIORITY` in `shared-constants.cjs`,
**When** defined,
**Then** it contains exactly: `active: 0`, `waiting: 1`, `interrupted: 1`, `error: 2`, `permission: 2`. Priority values renumbered from 0-2 (no gaps). `worstState()` continues to work unchanged (reads from this map).

### AC10 — `worstState()` fallback changed

**Given** `worstState()` in `monitor-utils.js`,
**When** computing the worst state across sessions,
**Then** the initial value is `'active'` (not `'inactive'`).

### AC11 — MonitorScreen fallback changed

**Given** `MonitorScreen.js` badge props,
**When** no session is selected,
**Then** the fallback state is `'waiting'` (not `'inactive'`).

### AC12 — All tests pass

**Given** tests,
**When** `npm test` executes,
**Then** all tests pass. Tests referencing `inactive`, `active:subagent`, or `Notification` are updated or removed. New tests confirm the 5-state model.

## Tasks / Subtasks

- [ ] Task 1: Update `shared-constants.cjs` (AC: 2, 3, 9)
  - [ ] 1.1 Remove `INACTIVE_TIMEOUT_MS` constant and its export
  - [ ] 1.2 Update `LLM_STATE_PRIORITY` to 5 entries: `active: 0`, `waiting: 1`, `interrupted: 1`, `error: 2`, `permission: 2`
  - [ ] 1.3 Simplify `computeDisplayState()` to `return status.llm_state || 'waiting'`

- [ ] Task 2: Update hook `bmad-hook.js` (AC: 1, 4)
  - [ ] 2.1 In `handleSubagentStart()` (line 673): change `status.llm_state = 'active:subagent'` → `status.llm_state = 'active'`
  - [ ] 2.2 Remove or no-op the `Notification` dispatch branch (line 153-154) and `handleNotification()` function (lines 620-633)

- [ ] Task 3: Update `defaults.js` (AC: 5)
  - [ ] 3.1 Remove the `Notification` entry from the hooks object in `getHookConfig()` (line 57-59)

- [ ] Task 4: Update reader `bmad-sl-reader.js` (AC: 6)
  - [ ] 4.1 Remove `'active:subagent'` and `inactive` entries from `LLM_STATES` (lines 39-40)
  - [ ] 4.2 Change fallback in `formatLlmState()` from `LLM_STATES.inactive` to `LLM_STATES.active` (line 45)
  - [ ] 4.3 Remove `INACTIVE_TIMEOUT_MS` from the require destructure (line 16)

- [ ] Task 5: Update `LlmBadge.js` (AC: 7)
  - [ ] 5.1 Remove `inactive` and `'active:subagent'` from `LLM_BADGE_CONFIG` (lines 15-16)
  - [ ] 5.2 Change fallback from `LLM_BADGE_CONFIG.inactive` to `LLM_BADGE_CONFIG.active` (line 27)
  - [ ] 5.3 Remove the `if (state === 'inactive') return;` guard in `useEffect` (line 22) — timer always ticks
  - [ ] 5.4 Update file header comment to reflect 5-state model

- [ ] Task 6: Update `SessionTabs.js` (AC: 8)
  - [ ] 6.1 Remove `inactive` and `'active:subagent'` from `STATE_ICONS` (lines 15-16)
  - [ ] 6.2 Change fallbacks from `STATE_ICONS.inactive` to `STATE_ICONS.active` (lines 37, 61)

- [ ] Task 7: Update `monitor-utils.js` (AC: 10)
  - [ ] 7.1 Change `worstState()` initial value from `'inactive'` to `'active'` (line 73)
  - [ ] 7.2 Remove `INACTIVE_TIMEOUT_MS` from imports and re-exports (lines 7, 9)

- [ ] Task 8: Update `MonitorScreen.js` (AC: 11)
  - [ ] 8.1 Change fallback state from `'inactive'` to `'waiting'` (line 410)

- [ ] Task 9: Update installer to stop registering Notification matcher (AC: 5)
  - [ ] 9.1 Search `src/install.js` and related installer code for Notification registration logic — remove if present
  - [ ] 9.2 Verify the installer generates config WITHOUT the Notification key

- [ ] Task 10: Update tests (AC: 12)
  - [ ] 10.1 `test/hook.test.js`: Remove/update tests 7.1 (handleNotification sets permission), handleNotification ignores non-permission, handleNotification ignores missing field (lines 1714-1770)
  - [ ] 10.2 `test/hook.test.js`: Update test 8.2 AC#1 — SubagentStart now sets `active` not `active:subagent` (lines 2339-2380)
  - [ ] 10.3 `test/hook.test.js`: Update all `active:subagent` assertions to `active` (lines 2350, 2366, 2380, 2389, 2436-2469, 2518)
  - [ ] 10.4 `test/hook.test.js`: Update AC#10 state transition flow — remove Notification step (line 1976-1977)
  - [ ] 10.5 `test/hook.test.js`: Update 8.1 AC#4 error_type cleared on Notification test (line 2312-2314) — remove or replace
  - [ ] 10.6 `test/defaults.test.js`: Remove Notification from expected hook events (lines 44, 59, 96-102)
  - [ ] 10.7 `test/install.test.js`: Remove all Notification assertions (~12 occurrences, lines 290-588)
  - [ ] 10.8 `test/llmstate-widget.test.js`: Remove INACTIVE test (line 138-148) and SUBAGENT test (line 221-232)
  - [ ] 10.9 `test/tui-monitor-components.test.js`: Remove inactive LlmBadge test (line 140), active:subagent LlmBadge test (line 173), active:subagent SessionTabs test (line 213)
  - [ ] 10.10 `test/tui-monitor.test.js`: Update computeDisplayState tests — remove stale→inactive test (line 403), missing→inactive test (line 419); update worstState inactive tests (line 452-456)
  - [ ] 10.11 Run `npm test` — all tests pass, 0 failures

## Dev Notes

### Architecture Compliance

**Architecture revision:** Rev.5 — reduces LLM state machine from 7 to 5 states.

**Patterns to follow:**
- Pattern 0 (Hook Entry Point Structure) — maintain dispatch table structure
- Pattern 1 (Error Handling Triad) — hook is silent always
- Pattern 2 (Synchronous File I/O) — readFileSync/writeFileSync only
- Pattern 22 (Atomic write) — tmp + renameSync for status file writes

### Rationale for each removal

| Removed | Reason | Replacement |
|---------|--------|-------------|
| `active:subagent` | Same semantic as `active` — the LLM is working. `subagent_type` metadata field still distinguishes if needed. | `active` |
| `inactive` | Computed state with arbitrary 5-min timeout. No actionable meaning for the user. A session without activity is simply `waiting`. | `waiting` (for fallback), removed entirely (for timeout computation) |
| `Notification` handler | Redundant with `PermissionRequest`. Both set `permission` — double-write on the same state. `PermissionRequest` is the canonical signal. | Removed (only `PermissionRequest` remains) |

### Priority renumbering

Old: `inactive:0, active:1, active:subagent:1, interrupted:2, waiting:2, error:3, permission:3`

New: `active:0, waiting:1, interrupted:1, error:2, permission:2`

Semantic grouping preserved:
- 0 = LLM is working (user does nothing)
- 1 = LLM stopped, user expected to act (naturally or by interruption)
- 2 = Blocked state requiring attention (error or permission)

### Files to Modify

| File | Action | Key lines |
|------|--------|-----------|
| `src/reader/shared-constants.cjs` | Remove `INACTIVE_TIMEOUT_MS`, update `LLM_STATE_PRIORITY`, simplify `computeDisplayState()` | 7, 21-29, 44-50, 77-78 |
| `src/hook/bmad-hook.js` | Change SubagentStart to `active`, remove Notification handler | 153-154, 620-633, 673 |
| `src/defaults.js` | Remove Notification matcher | 57-59 |
| `src/reader/bmad-sl-reader.js` | Remove inactive/subagent from `LLM_STATES`, fix fallback | 16, 39-40, 45 |
| `src/tui/monitor/components/LlmBadge.js` | Remove inactive/subagent, fix fallback, remove timer guard | 1, 15-16, 22, 27 |
| `src/tui/monitor/components/SessionTabs.js` | Remove inactive/subagent, fix fallbacks | 15-16, 37, 61 |
| `src/tui/monitor/monitor-utils.js` | Remove INACTIVE_TIMEOUT_MS import/export, fix worstState initial | 7, 9, 73 |
| `src/tui/monitor/MonitorScreen.js` | Fix fallback state | 410 |
| `src/install.js` | Remove Notification registration if present | TBD |
| `test/hook.test.js` | Remove Notification tests, update subagent tests | ~20 changes |
| `test/defaults.test.js` | Remove Notification assertions | 44, 59, 96-102 |
| `test/install.test.js` | Remove Notification assertions | ~12 occurrences |
| `test/llmstate-widget.test.js` | Remove inactive/subagent tests | 138-148, 221-232 |
| `test/tui-monitor-components.test.js` | Remove inactive/subagent tests | 140, 173, 213 |
| `test/tui-monitor.test.js` | Update computeDisplayState + worstState tests | 403-456 |

### Previous Story Intelligence (8.6)

- Config-entry-only changes in display layers — follow same pattern (just remove entries)
- `worstState()` and `computeDisplayState()` are thin wrappers over `LLM_STATE_PRIORITY` — safe to update
- Tests follow existing patterns: update assertions, remove dead test cases
- `subagent_type` metadata field is independent of `llm_state` — can still be captured even when state is `active`

### Scope Boundaries

**In scope:** State machine reduction across hook, reader, TUI, defaults, installer, shared-constants, and all tests.

**Out of scope:**
- Hook dispatch table structure — keep all event listeners (SubagentStart still dispatches, just sets `active`)
- `subagent_type` field — still captured in status, just not tied to a separate state
- `ALIVE_MAX_AGE_MS` — still used for session cleanup, unrelated to display state
- Adding new states or features

### Anti-Patterns to Avoid

- Do NOT add async code — Pattern 2 mandates synchronous fs everywhere
- Do NOT use `console.log` or `console.error` in the hook — Pattern 1
- Do NOT remove the `SubagentStart`/`SubagentStop` handlers entirely — they still track `subagent_type` metadata
- Do NOT remove `ALIVE_MAX_AGE_MS` — it's for session file cleanup, not display state
- Do NOT change `worstState()` logic beyond the initial value — it reads `LLM_STATE_PRIORITY` dynamically
- Do NOT leave dead `INACTIVE_TIMEOUT_MS` imports in any file

### References

- [Source: src/reader/shared-constants.cjs] — LLM_STATE_PRIORITY lines 21-29, computeDisplayState lines 44-50, INACTIVE_TIMEOUT_MS line 7
- [Source: src/hook/bmad-hook.js] — dispatch table lines 131-169, handleNotification lines 620-633, handleSubagentStart line 673
- [Source: src/defaults.js] — Notification matcher lines 57-59
- [Source: src/reader/bmad-sl-reader.js] — LLM_STATES lines 33-41, formatLlmState lines 43-50
- [Source: src/tui/monitor/components/LlmBadge.js] — LLM_BADGE_CONFIG lines 9-17, timer guard line 22, fallback line 27
- [Source: src/tui/monitor/components/SessionTabs.js] — STATE_ICONS lines 9-17, fallbacks lines 37, 61
- [Source: src/tui/monitor/monitor-utils.js] — worstState line 73, imports line 7, re-exports line 9
- [Source: src/tui/monitor/MonitorScreen.js] — fallback state line 410
- [Source: _bmad-output/implementation-artifacts/8-6-hook-interrupted-state-permission-active-transition.md] — Previous story context, investigation findings

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
