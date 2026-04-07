# Story 8.4: Shared Constants & Reader — New LLM State Support

Status: review

## Story

As a **developer monitoring Claude Code sessions**,
I want **the status line and monitor to display `error` and `active:subagent` states**,
so that **StopFailure errors and subagent activity are visible without checking the terminal**.

## Acceptance Criteria

1. **AC1 — LLM_STATE_PRIORITY exported from shared-constants.cjs.**
   `shared-constants.cjs` exports `LLM_STATE_PRIORITY` containing 6 states: `inactive` (0), `active` (1), `active:subagent` (1), `waiting` (2), `error` (3), `permission` (3). `defaults.js` re-exports it via the CJS bridge.

2. **AC2 — monitor-utils.js uses shared LLM_STATE_PRIORITY.**
   `monitor-utils.js` imports `LLM_STATE_PRIORITY` from `../../defaults.js` and deletes its local definition. `worstState()` behavior is unchanged for existing 4 states. New states `error` and `active:subagent` are correctly prioritized.

3. **AC3 — Reader formatLlmState() renders ERROR state.**
   Given `llm_state: 'error'` with fresh `updated_at`, the reader renders `⬤  ERROR` with red background (`\x1b[101m`) and white text (`\x1b[97m`) — same badge style as permission/waiting.

4. **AC4 — Reader formatLlmState() renders SUBAGENT state.**
   Given `llm_state: 'active:subagent'` with fresh `updated_at`, the reader renders `⬤  SUBAGENT` in cyan (`\x1b[36m`) — same text-only style as active/inactive.

5. **AC5 — Existing states unchanged.**
   `permission`, `waiting`, `active`, `inactive` render identically to current behavior. All existing `llmstate-widget.test.js` tests pass unmodified.

6. **AC6 — Unknown states fall back to inactive.**
   Any `llm_state` value not in `LLM_STATES` renders as INACTIVE (existing fallback preserved).

7. **AC7 — All tests pass.**
   New tests for `error` state rendering, `active:subagent` state rendering, `LLM_STATE_PRIORITY` export, `worstState()` with new states. All existing tests pass (`npm test`).

## Tasks / Subtasks

- [x] Task 1: Add `LLM_STATE_PRIORITY` to `shared-constants.cjs` (AC: 1)
  - [x] 1.1 Add constant after `SEPARATOR_VALUES`:
    ```js
    const LLM_STATE_PRIORITY = {
      inactive: 0,
      active: 1,
      'active:subagent': 1,
      waiting: 2,
      error: 3,
      permission: 3,
    };
    ```
  - [x] 1.2 Add `LLM_STATE_PRIORITY` to `module.exports`
- [x] Task 2: Bridge to ESM via `defaults.js` (AC: 1)
  - [x] 2.1 Add `export const LLM_STATE_PRIORITY = _sc.LLM_STATE_PRIORITY;` alongside existing re-exports (after line 108)
- [x] Task 3: Update `monitor-utils.js` to import from shared source (AC: 2)
  - [x] 3.1 Add `LLM_STATE_PRIORITY` to the import from `../../defaults.js` (line 7)
  - [x] 3.2 Delete local `const LLM_STATE_PRIORITY = { permission: 3, waiting: 2, active: 1, inactive: 0 };` (line 74)
  - [x] 3.3 Delete the comment `// computeDisplayState, INACTIVE_TIMEOUT_MS imported from defaults.js` (line 72) — stale after import change
  - [x] 3.4 Verify `worstState()` still works — the `|| 0` fallback handles any missing keys
- [x] Task 4: Add new states to reader `LLM_STATES` (AC: 3, 4, 5, 6)
  - [x] 4.1 Replace the `LLM_STATES` map in `bmad-sl-reader.js` (lines 33-38) with this final ordering — badge-style states first, then text-style:
    ```js
    const LLM_STATES = {
      permission:        { bg: '\x1b[103m', fg: '\x1b[30m', label: 'PERMISSION' },
      waiting:           { bg: '\x1b[104m', fg: '\x1b[97m', label: 'WAITING' },
      error:             { bg: '\x1b[101m', fg: '\x1b[97m', label: 'ERROR' },
      active:            { color: '\x1b[32m',  label: 'ACTIVE' },
      'active:subagent': { color: '\x1b[36m',  label: 'SUBAGENT' },
      inactive:          { color: '\x1b[90m',  label: 'INACTIVE' },
    };
    ```
    `error` uses bright red bg (101m) + white text — same badge pattern as permission/waiting.
    `active:subagent` uses cyan (36m) — text-only pattern matching active/inactive. Cyan = agent convention.
  - [x] 4.2 Verify `formatLlmState()` (lines 40-47) needs NO logic changes — it calls `computeLlmDisplayState(status)` which is an **alias** for `computeDisplayState` imported at line 16: `{ computeDisplayState: computeLlmDisplayState }`. Existing code handles bg/fg vs color patterns and unknown-state fallback via `LLM_STATES[state] || LLM_STATES.inactive`
- [x] Task 5: Update tests (AC: 7)
  - [x] 5.1 In `test/llmstate-widget.test.js`: add 2 new tests **inside the describe block, before its closing `});` on line 189**. Add these ANSI constants at the top alongside existing ones: `BG.brightRed = '\x1b[101m'` and `COLOR.cyan = '\x1b[36m'`
    - `renders ERROR with brightRed bg and white text` — write status with `llm_state: 'error'`, assert output contains `ERROR`, `\x1b[101m` (BG.brightRed), `\x1b[97m` (FG.white), `\u2B24`
    - `renders SUBAGENT in cyan without bg` — write status with `llm_state: 'active:subagent'`, assert output contains `SUBAGENT`, `\x1b[36m` (COLOR.cyan), no BOLD
  - [x] 5.2 In `test/tui-monitor.test.js`: add 3 new tests **inside the `describe('worstState')` block, before its closing `});` on line 457**
    - `[active, error] → error` — assert.equal(worstState(...), 'error')
    - `[error, permission] → error` — both priority 3, `>` comparison means first-encountered wins. assert.equal(worstState([{error}, {permission}]), 'error')
    - `[active:subagent, waiting] → waiting` — assert.equal(worstState(...), 'waiting')
  - [x] 5.3 Run full test suite: `npm test` — all existing + new tests pass

## Dev Notes

### Hook State Values (Source of Truth)

Story 8.1/8.2 handlers write these `llm_state` values to status files:

| Handler | llm_state | Extra fields |
|---------|-----------|--------------|
| handlePermissionRequest | `'permission'` | error_type=null |
| handleStopFailure | `'error'` | error_type=payload value |
| handleSessionEnd | (deletes file) | — |
| handleSubagentStart | `'active:subagent'` | subagent_type=payload value |
| handleSubagentStop | `'active'` | subagent_type=null |
| handlePostToolUseFailure | `'active'` | error_type=null |
| handlePermissionDenied | `'active'` | error_type=null |

Only **2 new display states** need reader support: `error` (exact string `'error'`, lowercase) and `active:subagent` (exact string `'active:subagent'`, with colon). All others map to existing states. The reader does NOT need `LLM_STATE_PRIORITY` — only the `LLM_STATES` display map matters here.

### computeDisplayState() — No Changes Needed

`computeDisplayState()` in `shared-constants.cjs:34-40` returns `status.llm_state || 'inactive'` — it already passes through `'error'` and `'active:subagent'` values. The 5-minute timeout override to `'inactive'` is correct for all states.

### formatLlmState() — No Logic Changes Needed

The existing function at `bmad-sl-reader.js:40-47` already handles:
- bg/fg pattern for badge-style states (permission, waiting, **error**)
- color-only pattern for text-style states (active, inactive, **active:subagent**)
- Fallback to inactive for unknown states via `LLM_STATES[state] || LLM_STATES.inactive`

Only the `LLM_STATES` map needs new entries. Zero logic changes.

### worstState() — No Logic Changes Needed

`worstState()` at `monitor-utils.js:76-83` uses `(LLM_STATE_PRIORITY[state] || 0)` — the `|| 0` fallback means any state NOT in the priority map is treated as lowest priority. After this story, `LLM_STATE_PRIORITY` includes all 6 states, so `error` and `active:subagent` are correctly prioritized. Logic is identical.

### Color Choices

| State | ANSI | Ink equivalent | Rationale |
|-------|------|----------------|-----------|
| error | bg:`\x1b[101m` fg:`\x1b[97m` | bgColor: 'redBright', color: 'white' | Red = error convention. Badge style (bg) for urgency, matching permission/waiting. |
| active:subagent | `\x1b[36m` | color: 'cyan' | Cyan = agent convention (see AGENT_COLORS Amelia, Barry). Text-only style matching active/inactive. |

### LLM_STATE_PRIORITY Values

| State | Priority | Rationale |
|-------|----------|-----------|
| inactive | 0 | No activity, lowest concern |
| active | 1 | Normal work in progress |
| active:subagent | 1 | Subagent working — same as active (still producing output) |
| waiting | 2 | LLM stopped, may need attention |
| error | 3 | Error condition, needs attention |
| permission | 3 | User must respond, highest urgency |

`error` and `permission` share priority 3 — both require user attention. In `worstState()` aggregation, whichever session is encountered last wins when priorities tie. This is acceptable: both are equally critical.

### Files to Touch

| File | Action | Lines |
|------|--------|-------|
| `bmad-statusline/src/reader/shared-constants.cjs` | Add `LLM_STATE_PRIORITY` constant + export | After line 19, add to exports at line 65 |
| `bmad-statusline/src/defaults.js` | Bridge `LLM_STATE_PRIORITY` re-export | After line 108 |
| `bmad-statusline/src/reader/bmad-sl-reader.js` | Add 2 entries to `LLM_STATES` map | Lines 33-38 |
| `bmad-statusline/src/tui/monitor/monitor-utils.js` | Import `LLM_STATE_PRIORITY`, delete local | Lines 7, 72-74 |
| `bmad-statusline/test/llmstate-widget.test.js` | 2 new reader subprocess tests | After line 188 |
| `bmad-statusline/test/tui-monitor.test.js` | 3 new worstState tests | After line 456 |

### Scope Boundaries

**In scope:**
- `shared-constants.cjs` — LLM_STATE_PRIORITY
- `defaults.js` — ESM bridge
- `bmad-sl-reader.js` — LLM_STATES map (2 new entries, no logic changes)
- `monitor-utils.js` — import refactor (delete local, import shared)
- Tests for above

**Out of scope (story 8.5):**
- `LlmBadge.js` — Monitor badge display for error/subagent states
- `LLM_BADGE_CONFIG` — Monitor's Ink-based color config
- `SessionTabs.js` — Monitor tab display

**Out of scope (deferred work, pre-existing):**
- Stale UserPromptSubmit wildcard cleanup (deferred from 8.3)
- Missing hook test coverage for subagent_type clearing (deferred from 8.2)

### Previous Story Intelligence (8.3)

**Key learnings:**
- `defaults.js` uses `createRequire` bridge pattern to re-export CJS constants — follow the same `export const X = _sc.X;` pattern
- `monitor-utils.js` imports from `../../defaults.js` (2 directory levels up) — not from shared-constants directly
- Existing tests use subprocess execution for reader tests (`execFileSync` with `BMAD_CONFIG_DIR` / `BMAD_CACHE_DIR` env vars)
- Test pattern: `writeConfig()` + `writeStatus()` helpers + `runReader()` subprocess

**From 8.3 completion notes:**
- UserPromptSubmit changed to regex `(?:bmad|gds|wds)[:-]`, PreToolUse to single wildcard
- All 16 matchers / 13 event types confirmed working

### Patterns to Follow

- **Pattern 1** — Error Handling: Reader is silent always. Return empty string on any error.
- **Pattern 2** — File I/O: Synchronous fs everywhere.
- **Pattern 3** — ANSI Color Wrapping: Reader uses `colorize()` helper. BUT `formatLlmState()` uses inline ANSI (bg/fg pattern), NOT colorize — this is the existing pattern, keep it.
- **Pattern 23** — Monitor Cache I/O: All cache reads through `monitor-utils.js`.

### Anti-Patterns to Avoid

- Do NOT change `computeDisplayState()` — it already passes through new state values
- Do NOT change `formatLlmState()` logic — only add entries to the `LLM_STATES` map
- Do NOT change `worstState()` logic — only the imported `LLM_STATE_PRIORITY` map changes
- Do NOT touch `LlmBadge.js` or any Monitor component — that's story 8.5
- Do NOT add async code — Pattern 2 mandates synchronous fs everywhere
- Do NOT modify hook handlers — done in stories 8.1/8.2

### Project Structure Notes

- `shared-constants.cjs` is CommonJS (`module.exports`) — NOT ESM
- `defaults.js` is ESM (`export const`) — bridges CJS via `createRequire`
- `monitor-utils.js` is ESM — imports from defaults.js, NOT from shared-constants directly
- `bmad-sl-reader.js` is CommonJS — uses `require('./shared-constants.cjs')` directly
- Tests use `node:test` + `node:assert/strict`

### References

- [Source: bmad-statusline/src/hook/bmad-hook.js#handleStopFailure, lines 648-658] — sets `llm_state = 'error'`
- [Source: bmad-statusline/src/hook/bmad-hook.js#handleSubagentStart, lines 669-678] — sets `llm_state = 'active:subagent'`
- [Source: bmad-statusline/src/reader/shared-constants.cjs, lines 1-76] — current constants, needs LLM_STATE_PRIORITY
- [Source: bmad-statusline/src/reader/bmad-sl-reader.js, lines 33-47] — LLM_STATES + formatLlmState()
- [Source: bmad-statusline/src/tui/monitor/monitor-utils.js, lines 72-83] — local LLM_STATE_PRIORITY + worstState()
- [Source: bmad-statusline/src/defaults.js, lines 98-108] — CJS bridge pattern
- [Source: _bmad-output/implementation-artifacts/8-2-hook-subagent-start-stop-post-tool-use-failure-permission-denied.md, lines 64-65] — scope deferral to 8.4
- [Source: _bmad-output/implementation-artifacts/8-3-installer-defaults-new-hook-matcher-registration.md] — previous story learnings
- [Source: _bmad-output/planning-artifacts/architecture.md#LLM State Machine, lines 993-1008]
- [Source: _bmad-output/planning-artifacts/architecture.md#Error Handling Triad, lines 1082-1089]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation, no debugging needed.

### Completion Notes List

- Added `LLM_STATE_PRIORITY` constant to `shared-constants.cjs` with 6 states (inactive:0, active:1, active:subagent:1, waiting:2, error:3, permission:3)
- Bridged to ESM via `defaults.js` using existing `createRequire` pattern
- Replaced local `LLM_STATE_PRIORITY` in `monitor-utils.js` with shared import from `defaults.js` — deleted stale comment
- Added `error` (brightRed bg badge) and `active:subagent` (cyan text) to `LLM_STATES` in reader — zero logic changes to `formatLlmState()`
- Added 2 reader subprocess tests: ERROR rendering, SUBAGENT rendering
- Added 3 worstState unit tests: error wins over active, error ties with permission (first wins), waiting wins over active:subagent
- All existing tests pass — no regressions

### Change Log

- 2026-04-07: Story 8.4 implemented — shared LLM_STATE_PRIORITY, reader error/subagent display, monitor-utils import refactor, 5 new tests

### File List

- src/reader/shared-constants.cjs (modified — added LLM_STATE_PRIORITY constant + export)
- src/defaults.js (modified — added LLM_STATE_PRIORITY re-export)
- src/tui/monitor/monitor-utils.js (modified — import from defaults.js, deleted local LLM_STATE_PRIORITY + stale comment)
- src/reader/bmad-sl-reader.js (modified — added error + active:subagent to LLM_STATES map)
- test/llmstate-widget.test.js (modified — added BG.brightRed, COLOR.cyan constants + 2 new tests)
- test/tui-monitor.test.js (modified — added 3 new worstState tests)

