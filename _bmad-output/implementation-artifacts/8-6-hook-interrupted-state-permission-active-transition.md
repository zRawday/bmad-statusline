# Story 8.6: Hook — Interrupted State Detection & Permission-to-Active Transition Fix

Status: ready-for-dev

## Story

As a **developer monitoring Claude Code sessions**,
I want **the status line to show "interrupted" when I cancel or deny an action, and to return to "active" as soon as I accept a permission**,
So that **the Monitor and reader accurately reflect user-initiated interruptions and permission acceptance instead of showing stale states**.

## Acceptance Criteria

### AC1 — `interrupted` state on user interrupt (Ctrl+C / Escape)

**Given** a `PostToolUseFailure` hook event fires with `is_interrupt: true` in the payload,
**When** `handlePostToolUseFailure()` dispatches,
**Then** `llm_state = 'interrupted'`, `llm_state_since = now`, `subagent_type = null`, `error_type = null`.

### AC2 — `active` state preserved on non-interrupt tool failure

**Given** a `PostToolUseFailure` hook event fires with `is_interrupt` absent or `false`,
**When** `handlePostToolUseFailure()` dispatches,
**Then** `llm_state = 'active'`, `llm_state_since = now` (current behavior unchanged).

### AC3 — `interrupted` state on user permission denial

**Given** the user manually denies permission in the dialog (not auto-mode),
**When** the corresponding hook event fires,
**Then** `llm_state = 'interrupted'`, `llm_state_since = now`, `subagent_type = null`, `error_type = null`.

**Investigation required:** Determine which hook fires when the user manually denies permission. Candidates:
- `PostToolUseFailure` with `is_interrupt: true` — if so, AC1 already covers this case
- `PermissionDenied` — if this fires for both auto-mode AND manual denial
- Another event entirely

**Method:** Add `console.error(JSON.stringify(payload))` temporarily to stderr in each handler during dev, trigger a manual permission denial, and observe which handler fires. Remove debug logging before commit.

### AC4 — `active` state on auto-mode PermissionDenied

**Given** a `PermissionDenied` event fires (auto-mode classifier denial — Claude adapts automatically),
**When** `handlePermissionDenied()` dispatches,
**Then** behavior depends on AC3 investigation:
- **If** `PermissionDenied` fires ONLY for auto-mode → keep `llm_state = 'active'` (current behavior)
- **If** `PermissionDenied` fires for BOTH auto-mode and manual denial → add `is_interrupt` or equivalent check to differentiate, set `'interrupted'` for manual and `'active'` for auto

### AC5 — Permission-to-active transition on acceptance

**Given** the user accepts a permission in the dialog,
**When** the tool starts executing,
**Then** `llm_state` transitions from `'permission'` to `'active'` immediately — NOT when the tool finishes.

**Investigation required:** Determine the hook firing order. Two possibilities:

**Hypothesis A (PreToolUse fires BEFORE PermissionRequest):**
```
PreToolUse → active  →  PermissionRequest → permission  →  (accept)  →  ...tool runs...  →  PostToolUse → active
```
In this case, no hook fires between acceptance and tool completion. The state stays at `permission` during the entire tool execution.

**Hypothesis B (PreToolUse fires AFTER permission is resolved):**
```
PermissionRequest → permission  →  (accept)  →  PreToolUse → active  →  ...tool runs...  →  PostToolUse → active
```
In this case, PreToolUse already transitions to active after acceptance. Current code works.

**Method:** Same debug logging approach as AC3 — trigger a tool that needs permission, accept it, observe the event order in stderr.

**If Hypothesis A is confirmed (no hook between acceptance and completion):**
- For Read/Edit/Write: PostToolUse fires nearly instantly after acceptance — acceptable, no fix needed
- For Bash: the state stays at `permission` during the entire command execution — this is the real problem
- **Potential solutions to evaluate:**
  1. Check if `Notification` with a specific type fires on acceptance
  2. Accept the limitation and document it (permission shown during Bash execution after acceptance)
  3. If the dev finds no suitable hook, document the limitation in Dev Notes and close AC5 as "not feasible with current hook API"

### AC6 — `interrupted` in LLM_STATE_PRIORITY

**Given** `shared-constants.cjs`,
**When** `LLM_STATE_PRIORITY` is defined,
**Then** it contains `interrupted: 2` (same priority as `waiting` — both are "user is expected to act" states).

### AC7 — Reader renders INTERRUPTED state

**Given** `llm_state: 'interrupted'` with fresh `updated_at`,
**When** the reader renders the `llmstate` widget,
**Then** it renders `⬤  INTERRUPTED` with orange/yellow background (`\x1b[43m`) and black text (`\x1b[30m`) — badge-style, visually distinct from WAITING (blue bg) and PERMISSION (yellow-bright bg).

### AC8 — Monitor LlmBadge renders INTERRUPTED state

**Given** `llm_state: 'interrupted'` in session status,
**When** `LlmBadge` renders,
**Then** it shows `⬤ INTERRUPTED` with `bgColor: 'yellow'`, `fgColor: '#000000'` — badge-style consistent with other high-priority states.

### AC9 — Monitor SessionTabs shows INTERRUPTED icon

**Given** a session with `llm_state: 'interrupted'`,
**When** `SessionTabs` renders,
**Then** `STATE_ICONS` includes `interrupted` with yellow-colored `⬤` icon.

### AC10 — All tests pass

**Given** tests,
**When** `npm test` executes,
**Then** all existing tests pass AND new tests cover:
- `handlePostToolUseFailure` with `is_interrupt: true` → `interrupted`
- `handlePostToolUseFailure` without `is_interrupt` → `active` (unchanged)
- New state in `LLM_STATE_PRIORITY`
- Reader `interrupted` rendering
- LlmBadge `interrupted` rendering
- SessionTabs `interrupted` icon
- `worstState()` aggregation with `interrupted`

## Tasks / Subtasks

- [ ] Task 0: Investigation — hook firing order and user denial event (AC: 3, 4, 5)
  - [ ] 0.1 Add temporary `console.error` debug logging to `handlePreToolUse`, `handlePermissionRequest`, `handlePostToolUseFailure`, `handlePermissionDenied`, `handleStop` to log `hook_event_name` + `payload` keys
  - [ ] 0.2 Trigger a tool that needs permission (e.g., Bash), observe the event order: does PreToolUse fire before or after PermissionRequest?
  - [ ] 0.3 Accept the permission, observe which events fire between acceptance and tool completion
  - [ ] 0.4 Deny a permission manually, observe which hook fires (PostToolUseFailure with is_interrupt? PermissionDenied? Other?)
  - [ ] 0.5 Press Ctrl+C during a Bash command, observe PostToolUseFailure payload — confirm `is_interrupt: true` is present
  - [ ] 0.6 Remove all debug logging before proceeding
  - [ ] 0.7 Document findings in Dev Notes section of this story file

- [ ] Task 1: Update `handlePostToolUseFailure()` in `bmad-hook.js` (AC: 1, 2)
  - [ ] 1.1 Read `payload.is_interrupt` (or equivalent field from investigation)
  - [ ] 1.2 If `is_interrupt === true` → set `llm_state = 'interrupted'`
  - [ ] 1.3 If `is_interrupt` is absent or false → keep `llm_state = 'active'` (current behavior)

- [ ] Task 2: Update `handlePermissionDenied()` in `bmad-hook.js` based on investigation (AC: 3, 4)
  - [ ] 2.1 Based on Task 0 findings, apply appropriate logic:
    - If manual denial fires PermissionDenied → add `'interrupted'` for manual, keep `'active'` for auto
    - If manual denial fires PostToolUseFailure → no changes to PermissionDenied (AC1 covers it)
    - If both auto and manual fire PermissionDenied with no way to differentiate → set `'interrupted'` for all (acceptable: auto-mode denied is still an interruption visible to user)

- [ ] Task 3: Fix permission-to-active transition based on investigation (AC: 5)
  - [ ] 3.1 Based on Task 0 findings:
    - If Hypothesis B confirmed → current code works, no changes needed
    - If Hypothesis A confirmed → evaluate potential solutions from AC5
    - Document the chosen solution or limitation in Dev Notes

- [ ] Task 4: Add `interrupted` to `LLM_STATE_PRIORITY` in `shared-constants.cjs` (AC: 6)
  - [ ] 4.1 Add `interrupted: 2` to the `LLM_STATE_PRIORITY` object (after `'active:subagent': 1`)

- [ ] Task 5: Add `interrupted` to reader `LLM_STATES` in `bmad-sl-reader.js` (AC: 7)
  - [ ] 5.1 Add entry: `interrupted: { bg: '\x1b[43m', fg: '\x1b[30m', label: 'INTERRUPTED' }` — badge-style, placed after `error` entry

- [ ] Task 6: Add `interrupted` to LlmBadge in `LlmBadge.js` (AC: 8)
  - [ ] 6.1 Add entry: `interrupted: { bgColor: 'yellow', fgColor: '#000000', icon: '\u2B24', label: 'INTERRUPTED' }` — uses bgColor path (badge rendering)

- [ ] Task 7: Add `interrupted` to SessionTabs in `SessionTabs.js` (AC: 9)
  - [ ] 7.1 Add entry: `interrupted: { icon: '\u2B24', color: 'yellow' }`

- [ ] Task 8: Add tests (AC: 10)
  - [ ] 8.1 `test/hook.test.js`: PostToolUseFailure with `is_interrupt: true` → `llm_state = 'interrupted'`
  - [ ] 8.2 `test/hook.test.js`: PostToolUseFailure without `is_interrupt` → `llm_state = 'active'` (existing test, verify still passes)
  - [ ] 8.3 `test/hook.test.js`: Any handler-specific tests based on Task 0/2 findings
  - [ ] 8.4 `test/llmstate-widget.test.js`: Reader renders INTERRUPTED with yellow bg and black text
  - [ ] 8.5 `test/tui-monitor-components.test.js`: LlmBadge INTERRUPTED render with yellow background
  - [ ] 8.6 `test/tui-monitor-components.test.js`: SessionTabs INTERRUPTED icon in yellow
  - [ ] 8.7 `test/tui-monitor.test.js`: `worstState` with `interrupted` — `[active, interrupted] → interrupted`, `[interrupted, waiting] → waiting`
  - [ ] 8.8 Run `npm test` — all existing + new tests pass

## Dev Notes

### Architecture Compliance

**Architecture revision:** Rev.5 — extends LLM state machine from 6 to 7 states.

**Patterns to follow:**
- Pattern 0 (Hook Entry Point Structure) — dispatch table, constants → helpers → handlers → main
- Pattern 1 (Error Handling Triad) — hook is silent always, never console.log/console.error (except temporary investigation in Task 0)
- Pattern 2 (Synchronous File I/O) — readFileSync/writeFileSync only
- Pattern 22 (Atomic write) — tmp + renameSync for status file writes

### Files to Modify

| File | Action | Scope |
|------|--------|-------|
| `src/hook/bmad-hook.js` | Modify `handlePostToolUseFailure()`, possibly `handlePermissionDenied()`, possibly `handlePreToolUse()` | Lines 594-715 |
| `src/reader/shared-constants.cjs` | Add `interrupted: 2` to `LLM_STATE_PRIORITY` | Line ~25 |
| `src/reader/bmad-sl-reader.js` | Add `interrupted` entry to `LLM_STATES` | Line ~36 |
| `src/tui/monitor/components/LlmBadge.js` | Add `interrupted` entry to `LLM_BADGE_CONFIG` | Line ~14 |
| `src/tui/monitor/components/SessionTabs.js` | Add `interrupted` entry to `STATE_ICONS` | Line ~14 |
| `test/hook.test.js` | New tests for interrupted state | After line ~2477 |
| `test/llmstate-widget.test.js` | New test for interrupted rendering | After existing tests |
| `test/tui-monitor-components.test.js` | New tests for interrupted badge + tabs | After existing tests |
| `test/tui-monitor.test.js` | New worstState test with interrupted | After existing tests |

### Current Handler Code (lines 693-715 of bmad-hook.js)

```js
// ─── 19. handlePostToolUseFailure (tool failure) ───────────────────────────
function handlePostToolUseFailure() {
  const status = readStatus(sessionId);
  const now = new Date().toISOString();
  status.llm_state = 'active';        // ← change: check is_interrupt
  status.subagent_type = null;
  status.error_type = null;
  status.llm_state_since = now;
  status.session_id = sessionId;
  writeStatus(sessionId, status);
}

// ─── 20. handlePermissionDenied (auto-mode denied) ─────────────────────────
function handlePermissionDenied() {
  const status = readStatus(sessionId);
  const now = new Date().toISOString();
  status.llm_state = 'active';        // ← might need change based on investigation
  status.subagent_type = null;
  status.error_type = null;
  status.llm_state_since = now;
  status.session_id = sessionId;
  writeStatus(sessionId, status);
}
```

### Color Convention for `interrupted`

| Component | Color | Rationale |
|-----------|-------|-----------|
| Reader | bg: `\x1b[43m` (yellow), fg: `\x1b[30m` (black) | Badge-style. Yellow = caution/interruption. Distinct from permission (103m = bright yellow) and waiting (104m = blue). |
| LlmBadge | `bgColor: 'yellow'`, `fgColor: '#000000'` | Standard yellow (not bright) to differentiate from permission (yellowBright). |
| SessionTabs | `color: 'yellow'` | Matches LlmBadge yellow. Distinct from permission (yellow in tabs — NOTE: potential conflict, see below). |

**Color conflict note:** `permission` already uses `color: 'yellow'` in SessionTabs. For `interrupted`, consider using `'yellowBright'` instead to differentiate, OR change permission to `'yellowBright'` and interrupted to `'yellow'`. The dev should pick the most readable combination. If they're close enough to cause confusion, the `label` text (`INTERRUPTED` vs `PERMISSION`) is the primary differentiator.

### Previous Story Intelligence (8.5)

- Clean implementation pattern: only add config entries to existing objects, no logic changes
- `LlmBadge.js` uses `fgColor` (not `color`) for entries with `bgColor` — follow this convention
- `SessionTabs.js` uses `color` for all entries
- Tests follow existing patterns: `render(e(Component, props))`, assert `lastFrame().includes(text)`
- 3 pre-existing test failures in "MonitorScreen — toggles" exist on main — not regressions

### Scope Boundaries

**In scope:** Hook handler logic changes, new `interrupted` state across all display layers, investigation of hook firing order, tests.

**Out of scope:**
- Installer/defaults changes — no new hook matchers needed (uses existing PostToolUseFailure, PermissionDenied, PreToolUse)
- `computeDisplayState()` changes — it already passes through any `llm_state` value
- `worstState()` changes — it already uses `LLM_STATE_PRIORITY` with `|| 0` fallback

### Anti-Patterns to Avoid

- Do NOT add async code — Pattern 2 mandates synchronous fs everywhere
- Do NOT use `console.log` or `console.error` in the hook (except temporary Task 0 investigation) — Pattern 1
- Do NOT modify `computeDisplayState()` — it passes through `llm_state` as-is
- Do NOT modify `worstState()` — it reads from `LLM_STATE_PRIORITY` which we're updating
- Do NOT modify the LlmBadge/SessionTabs rendering logic — only add config entries
- Do NOT leave Task 0 debug logging in the final commit

### References

- [Source: src/hook/bmad-hook.js] — dispatch table lines 131-169, handlePreToolUse lines 594-605, handlePermissionRequest lines 635-646, handlePostToolUseFailure lines 693-703, handlePermissionDenied lines 705-715
- [Source: src/reader/shared-constants.cjs] — LLM_STATE_PRIORITY lines 21-28
- [Source: src/reader/bmad-sl-reader.js] — LLM_STATES lines 33-40, formatLlmState lines 42-49
- [Source: src/tui/monitor/components/LlmBadge.js] — LLM_BADGE_CONFIG lines 9-16
- [Source: src/tui/monitor/components/SessionTabs.js] — STATE_ICONS lines 9-16
- [Source: _bmad-output/implementation-artifacts/8-2-hook-subagent-start-stop-post-tool-use-failure-permission-denied.md] — Original handler implementation, AC3/AC4
- [Source: _bmad-output/implementation-artifacts/8-4-shared-constants-reader-new-llm-state-support.md] — LLM_STATE_PRIORITY, reader state rendering
- [Source: _bmad-output/implementation-artifacts/8-5-monitor-badge-error-subagent-display.md] — LlmBadge/SessionTabs config entry pattern
- [Source: _bmad-output/planning-artifacts/architecture.md#LLM-State-Machine] — State machine diagram line 993

### Claude Code Hooks Reference (for investigation)

**Hook firing order (to verify):**
- `PreToolUse` — "Before any tool call executes" — fires before or after permission check?
- `PermissionRequest` — "When permission dialog appears"
- `PermissionDenied` — "When auto mode classifier denies" — fires for manual denial too?
- `PostToolUseFailure` — "After tool fails, including interrupts" — `is_interrupt` field available

**PostToolUseFailure payload fields:** `tool_name`, `tool_input`, `error`, `is_interrupt` (boolean)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
