---
title: 'Fix monitor: false permission, vanishing idle sessions, missing section spacing'
type: 'bugfix'
created: '2026-04-05'
status: 'done'
baseline_commit: 'dd89fc2'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Three monitor bugs: (1) sessions at a workflow greeting stage are incorrectly shown as "PERMISSION" because `handleNotification()` doesn't check `payload.notification.type`; (2) idle-but-open sessions vanish after 2 minutes because `pollSessions()` relies solely on alive file mtime; (3) content sections (modified files, read files, bash commands) are visually glued together with no blank line separators.

**Approach:** Guard `handleNotification()` on `notification.type === 'permission'`. In `pollSessions()`, fall back to `updated_at` from the status file when the alive file is stale. In MonitorScreen, insert spacer items between the three section arrays.

## Boundaries & Constraints

**Always:** Keep the hook silent on errors. Preserve backward compat for status files missing `updated_at`.

**Ask First:** Changing the idle visibility window beyond 30 minutes.

**Never:** Change the alive file cleanup mechanism (7-day `ALIVE_MAX_AGE_MS`). Add new dependencies.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Permission notification | `notification: { type: 'permission' }` | `llm_state = 'permission'` | N/A |
| Non-permission notification | `notification: { type: 'info' }` or missing | No state change, early return | N/A |
| Notification without `notification` field | `{ hook_event_name: 'Notification' }` | No state change, early return | N/A |
| Idle session, alive stale, updated_at fresh (<30min) | alive mtime 5min ago, updated_at 5min ago | Session included in poll, shown as 'inactive' | N/A |
| Idle session, alive stale, updated_at old (>30min) | alive mtime 35min ago, updated_at 35min ago | Session excluded from poll | N/A |
| Session with no updated_at in status | Legacy status file | Falls back to alive mtime check only | N/A |
| Two non-empty sections adjacent | Writes section + reads section both have entries | Blank line separates them visually | N/A |
| One empty section between two non-empty | Writes empty, reads + bash have entries | No double blank lines; single spacer between visible sections | N/A |

</frozen-after-approval>

## Code Map

- `src/hook/bmad-hook.js:551-560` -- `handleNotification()` — unconditionally sets permission, needs type guard
- `src/tui/monitor/monitor-utils.js:8,12-36` -- `MONITOR_STALE_MS` and `pollSessions()` — alive mtime gating, needs fallback to `updated_at`
- `src/tui/monitor/MonitorScreen.js:139-149` -- Section concatenation without spacers between writes/reads/bash
- `test/hook.test.js:1626-1632,1685-1700` -- Notification test + payload factory, needs non-permission test case
- `test/monitor-utils.test.js` -- pollSessions tests, needs idle session test case

## Tasks & Acceptance

**Execution:**
- [x] `src/hook/bmad-hook.js` -- Guard `handleNotification()`: return early unless `payload.notification && payload.notification.type === 'permission'` -- prevents false permission state
- [x] `src/tui/monitor/monitor-utils.js` -- Add `MONITOR_IDLE_WINDOW_MS = 30 * 60 * 1000`. In `pollSessions()`, when alive mtime > `MONITOR_STALE_MS`, read `updated_at` from the status JSON and include session if within `MONITOR_IDLE_WINDOW_MS` -- keeps idle sessions visible
- [x] `src/tui/monitor/MonitorScreen.js` -- Between the three section concatenations (lines 139-149), insert a spacer item+element between each pair of non-empty sections -- adds visual breathing room
- [x] `test/hook.test.js` -- Add test: non-permission notification should NOT change `llm_state`
- [x] `test/tui-monitor.test.js` -- Add test: idle session with stale alive but fresh `updated_at` appears in poll results
- [x] `src/tui/screens/HomeScreen.js` -- Move Monitor to the top of the menu in its own section (separator below), above the Edit widget lines

**Acceptance Criteria:**
- Given a Notification event with `notification.type !== 'permission'`, when the hook fires, then `llm_state` remains unchanged
- Given a Notification event with `notification.type === 'permission'`, when the hook fires, then `llm_state` is set to `'permission'`
- Given an idle session whose alive file is 5 min old but `updated_at` is 5 min ago, when the monitor polls, then the session appears with state `'inactive'`
- Given an idle session whose alive file and `updated_at` are both 35 min old, when the monitor polls, then the session is excluded
- Given two non-empty sections in the monitor, when rendered, then a blank line separates them visually

## Verification

**Commands:**
- `node --test test/hook.test.js` -- expected: all tests pass including new non-permission notification test
- `node --test test/monitor-utils.test.js` -- expected: all tests pass including new idle session visibility test

## Suggested Review Order

**Fausse permission — guard dans le hook**

- Guard notification.type: seule ligne qui élimine les faux positifs
  [`bmad-hook.js:553`](../../bmad-statusline/src/hook/bmad-hook.js#L553)

- Tests: non-permission ignoré + payload sans notification ignoré
  [`hook.test.js:1702`](../../bmad-statusline/test/hook.test.js#L1702)

**Sessions idle visibles — fallback updated_at**

- Fenêtre idle 30min + fallback quand alive stale
  [`monitor-utils.js:9`](../../bmad-statusline/src/tui/monitor/monitor-utils.js#L9)

- Logique pollSessions: fresh alive → include, stale → check updated_at
  [`monitor-utils.js:30`](../../bmad-statusline/src/tui/monitor/monitor-utils.js#L30)

- Patch review: NaN guard défensif dans computeDisplayState
  [`monitor-utils.js:70`](../../bmad-statusline/src/tui/monitor/monitor-utils.js#L70)

- Tests: idle inclus, >30min exclu, legacy sans updated_at exclu
  [`tui-monitor.test.js:1192`](../../bmad-statusline/test/tui-monitor.test.js#L1192)

**Espacement sections monitor**

- Spacer items/elements entre sections non-vides
  [`MonitorScreen.js:139`](../../bmad-statusline/src/tui/monitor/MonitorScreen.js#L139)

**Menu home — Monitor en premier**

- Monitor déplacé en tête avec séparateur dédié
  [`HomeScreen.js:10`](../../bmad-statusline/src/tui/screens/HomeScreen.js#L10)

- Tests navigation ajustés (+1 down pour le nouveau premier item)
  [`tui-app.test.js:118`](../../bmad-statusline/test/tui-app.test.js#L118)
