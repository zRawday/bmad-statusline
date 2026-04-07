---
title: 'Fix permission state detection in hook and display'
type: 'bugfix'
created: '2026-04-06'
status: 'done'
baseline_commit: '4dba89c'
context:
  - '_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** When the LLM is in permission mode (waiting for user to approve/deny a tool call), the monitor LlmBadge and statusline widget display "WAITING" instead of "PERMISSION". The `handleNotification()` function in the hook checks `payload.notification.type === 'permission'`, but this payload structure was a guess — the architecture doc (line 1945) notes the exact Notification payload format is undocumented. The detection never fires.

**Approach:** Add a diagnostic payload dump in the Notification handler to capture the real payload from Claude Code, then fix `handleNotification()` to match the actual structure. If the Notification event doesn't fire for permission prompts, investigate alternative detection via the Stop payload or PreToolUse.

## Boundaries & Constraints

**Always:** Follow Pattern 1 (hook = silent always, no console output). Diagnostic dump writes to CACHE_DIR only. Remove all diagnostic code before final commit.

**Ask First:** If Notification event doesn't fire at all for permissions, the fallback detection mechanism (e.g. PreToolUse, Stop payload inspection) needs human sign-off before implementing.

**Never:** Break existing llm_state transitions (active, waiting, inactive). Never add console.log/error to hook code.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Permission prompt appears | Notification event fires with permission payload | `llm_state = 'permission'`, badge shows PERMISSION | N/A |
| Non-permission notification | Notification event with other type | No llm_state change (silent return) | N/A |
| Notification without expected fields | Malformed or minimal payload | No llm_state change (silent return) | Silent exit per Pattern 1 |
| Stop fires before permission | Stop event | `llm_state = 'waiting'`, then overridden by permission on Notification | N/A |
| Tool auto-approved (no permission) | PostToolUse fires directly | `llm_state = 'active'` (unchanged behavior) | N/A |

</frozen-after-approval>

## Code Map

- `bmad-statusline/src/hook/bmad-hook.js:575-586` -- handleNotification: permission detection logic to fix
- `bmad-statusline/src/hook/bmad-hook.js:131-153` -- dispatch: routes Notification events
- `bmad-statusline/src/reader/bmad-sl-reader.js:34` -- LLM_STATES permission entry (display OK, no change needed)
- `bmad-statusline/src/tui/monitor/components/LlmBadge.js:11` -- permission badge config (display OK, no change needed)
- `bmad-statusline/src/reader/shared-constants.cjs:34-40` -- computeDisplayState (no change needed)
- `bmad-statusline/test/hook.test.js:1625-1735` -- Notification test helpers and tests to update

## Tasks & Acceptance

**Execution:**
- [x] `bmad-statusline/src/hook/bmad-hook.js` -- Add temporary diagnostic: in handleNotification, write full `JSON.stringify(payload)` to `path.join(CACHE_DIR, '_notif-debug.json')` BEFORE the type guard. This captures the real payload structure.
- [x] Manual trigger -- Trigger a permission prompt in Claude Code (any non-auto-approved tool) and read `~/.cache/bmad-status/_notif-debug.json` to identify the actual payload structure.
- [x] `bmad-statusline/src/hook/bmad-hook.js` -- Fix `handleNotification()`: changed `payload.notification.type !== 'permission'` to `payload.notification_type !== 'permission_prompt'` (top-level field, correct value).
- [x] `bmad-statusline/test/hook.test.js` -- Update `makeNotificationPayload()` and related tests to use real payload structure (`notification_type: 'permission_prompt'` top-level, `idle_prompt` for non-permission).
- [x] `bmad-statusline/src/hook/bmad-hook.js` -- Remove diagnostic dump code.

**Acceptance Criteria:**
- Given the LLM generates a tool call that requires user permission, when the permission prompt appears, then `llm_state` in the status file is `'permission'` (not `'waiting'`).
- Given the LLM generates a tool call that is auto-approved, when PostToolUse fires, then `llm_state` remains `'active'` (no regression).
- Given a non-permission Notification fires, when handleNotification runs, then no llm_state change occurs.

## Verification

**Commands:**
- `node --test test/hook.test.js` -- expected: all tests pass including updated Notification tests

**Manual checks (if no CLI):**
- Trigger a permission prompt in Claude Code → check monitor shows PERMISSION badge, statusline widget shows PERMISSION label

## Suggested Review Order

- Guard fix: flat field `notification_type` replaces nested `notification.type`, correct value `permission_prompt`
  [`bmad-hook.js:577`](../../bmad-statusline/src/hook/bmad-hook.js#L577)

- Test helper updated to match real Claude Code payload structure
  [`hook.test.js:1630`](../../bmad-statusline/test/hook.test.js#L1630)

- Non-permission test uses real `idle_prompt` value instead of fictional `info`
  [`hook.test.js:1714`](../../bmad-statusline/test/hook.test.js#L1714)

- Missing-field test description updated to match new field name
  [`hook.test.js:1722`](../../bmad-statusline/test/hook.test.js#L1722)
