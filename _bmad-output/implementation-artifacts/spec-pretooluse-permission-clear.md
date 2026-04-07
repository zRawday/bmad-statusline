---
title: 'PreToolUse hook to clear permission state on tool start'
type: 'feature'
created: '2026-04-06'
status: 'done'
baseline_commit: '9f018a7'
context:
  - '_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The LLM "permission" state activates when Claude Code requests user approval (Notification event) but only clears when the tool finishes (PostToolUse). For long-running commands (builds, npm install, tests), the status line shows PERMISSION for the entire execution duration even though the user already approved — it should show ACTIVE.

**Approach:** Subscribe to the `PreToolUse` hook event, which fires after user approval but before tool execution. Add a lightweight handler that transitions `llm_state` from `permission` to `active` on any PreToolUse, closing the gap between approval and PostToolUse.

## Boundaries & Constraints

**Always:** Follow Pattern 1 (silent always for hook). Follow Pattern 2 (synchronous I/O only). The PreToolUse handler must be minimal — set `llm_state = 'active'` and `llm_state_since`, write status, return. No history tracking, no content extraction.

**Ask First:** Adding PreToolUse matchers for tools beyond Read/Write/Edit/Bash (e.g. Agent, Glob, Grep).

**Never:** Extract tool_input content in PreToolUse — that's PostToolUse's job. Never add new LLM state values. Never change existing PostToolUse handlers — they remain the primary state writers.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Permission then tool start | llm_state=permission → PreToolUse fires | llm_state=active, llm_state_since updated | N/A |
| Auto-approved tool (no permission asked) | llm_state=active → PreToolUse fires | llm_state=active (idempotent refresh) | N/A |
| PreToolUse for unknown tool name | PreToolUse with tool_name not in R/W/E/B | Still sets llm_state=active (generic handler) | N/A |
| Rapid permission→PreToolUse race | Two events in quick succession | Last writer wins — both write active, no conflict | N/A |

</frozen-after-approval>

## Code Map

- `src/defaults.js:25-49` -- Hook config: add PreToolUse matcher entries
- `src/hook/bmad-hook.js:131-153` -- Event dispatch: add PreToolUse branch
- `src/hook/bmad-hook.js:575-586` -- handleNotification: context for permission state setter
- `test/hook.test.js:1684-1710` -- Existing permission tests: add PreToolUse transition tests

## Tasks & Acceptance

**Execution:**
- [x] `src/defaults.js` -- Add `PreToolUse` array to `getHookConfig()` with matchers for Read, Write, Edit, Bash (same pattern as PostToolUse)
- [x] `src/hook/bmad-hook.js` -- Add `PreToolUse` dispatch branch in section 6 and `handlePreToolUse()` handler that sets `llm_state = 'active'` + `llm_state_since` + writes status
- [x] `test/hook.test.js` -- Add tests: PreToolUse clears permission→active; PreToolUse is idempotent on active state; full transition cycle permission→PreToolUse→PostToolUse

**Acceptance Criteria:**
- Given llm_state is `permission`, when a `PreToolUse` event fires, then llm_state becomes `active` and llm_state_since is updated
- Given llm_state is `active`, when a `PreToolUse` event fires, then llm_state remains `active` (idempotent)
- Given the full cycle Notification→PreToolUse→PostToolUse, when each event fires in sequence, then states transition permission→active→active

## Verification

**Commands:**
- `npm test` -- expected: all existing + new tests pass

## Suggested Review Order

**Hook dispatch & handler**

- New dispatch branch routes PreToolUse before PostToolUse
  [`bmad-hook.js:135`](../../bmad-statusline/src/hook/bmad-hook.js#L135)

- Minimal handler: read status, set active, write — no history/content extraction
  [`bmad-hook.js:566`](../../bmad-statusline/src/hook/bmad-hook.js#L566)

**Hook config**

- PreToolUse matchers added for Read/Write/Edit/Bash, mirrors PostToolUse
  [`defaults.js:33`](../../bmad-statusline/src/defaults.js#L33)

**Tests**

- Core test: permission→active transition on PreToolUse
  [`hook.test.js:1747`](../../bmad-statusline/test/hook.test.js#L1747)

- Idempotency: active stays active
  [`hook.test.js:1767`](../../bmad-statusline/test/hook.test.js#L1767)

- Full cycle: active→waiting→permission→active(Pre)→active(Post)
  [`hook.test.js:1939`](../../bmad-statusline/test/hook.test.js#L1939)

- Dispatch test updated: 6 event types including PreToolUse
  [`hook.test.js:375`](../../bmad-statusline/test/hook.test.js#L375)

**Install & fixtures**

- Phase 4 fixture updated with PreToolUse matchers
  [`claude-settings-with-hooks-phase4.json:15`](../../bmad-statusline/test/fixtures/claude-settings-with-hooks-phase4.json#L15)

- Install tests updated: 12 matchers across 6 event types
  [`install.test.js:262`](../../bmad-statusline/test/install.test.js#L262)
