---
title: 'Monitor inline tab reorder'
type: 'feature'
created: '2026-04-05'
status: 'done'
baseline_commit: '865e589'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** When reordering project or session tabs in the monitor, a full-screen overlay replaces the entire view, losing visual context (header, tabs, badge).

**Approach:** Move reorder interaction directly into the tab bar. Cursor navigation and grab/drop happen inline on the tabs themselves. Content area hides during reorder; header, badge, and shortcut bar remain visible with adapted shortcuts.

## Boundaries & Constraints

**Always:** Left/right arrows for navigation and movement. Enter to grab/drop. Escape to cancel grab (grabbed mode) or exit reorder (navigate mode). First tab auto-selected on entry. Clamp cursor at boundaries (no wrap).

**Ask First:** Visual styling changes beyond cursor highlight and grab indicator.

**Never:** Do not modify ReorderList.js. Do not change reorder trigger keys (r/R). Do not persist reorder to disk.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Enter project reorder | `r` with 2+ projects | Content hides, cursor on first project tab, shortcuts adapt | N/A |
| Enter session reorder | `R` with 2+ sessions | Content hides, cursor on first session tab, shortcuts adapt | N/A |
| Navigate | ◄► in navigate mode | Cursor moves between tabs | Clamp at 0 / length-1 |
| Grab | Enter in navigate | Tab enters grabbed state, indicator changes | N/A |
| Move | ◄► in grabbed mode | Grabbed tab swaps with neighbor, tabs reorder visually | Clamp at boundaries |
| Drop | Enter in grabbed | Order saved, back to navigate, stays in reorder | N/A |
| Cancel grab | Esc in grabbed | Reverts to pre-grab order, back to navigate | N/A |
| Exit reorder | Esc in navigate | Reorder cleared, content reappears, shortcuts restore | N/A |

</frozen-after-approval>

## Code Map

- `src/tui/monitor/MonitorScreen.js` -- Reorder state, input handling, layout gating, shortcuts
- `src/tui/monitor/components/SessionTabs.js` -- Cursor/grab visual rendering on tab row

## Tasks & Acceptance

**Execution:**
- [x] `SessionTabs.js` -- Add `reorderTarget`, `reorderCursor`, `reorderGrabbed` props; apply cursor highlight and grab indicator styling on the target row's tabs
- [x] `MonitorScreen.js` -- Replace early-return reorder overlays (lines 309-339) with inline logic: add `reorderCursor`/`reorderGrabbed`/`reorderSnapshot` state, add dedicated `useInput` for reorder keys, initialize `projectOrder`/`sessionOrders` on reorder entry, hide content area when `reorderMode` active, pass reorder props to SessionTabs, add reorder shortcuts to `getShortcuts`, remove `ReorderList` import

**Acceptance Criteria:**
- Given 2+ projects, when `r`, then content hides, first project tab shows cursor, shortcuts show `◄► navigate  Enter grab  Esc back`
- Given 2+ sessions, when `R`, then content hides, first session tab shows cursor, shortcuts adapt
- Given navigate mode, when Enter, then grabbed indicator appears, shortcuts change to `◄► move  Enter drop  Esc cancel`
- Given grabbed tab, when ◄►, then tab swaps with neighbor in the tab bar
- Given grabbed tab, when Enter, then order commits, returns to navigate within reorder
- Given grabbed tab, when Esc, then order reverts to pre-grab state, back to navigate
- Given navigate mode, when Esc, then reorder exits, content reappears, normal shortcuts restore

## Verification

**Commands:**
- `cd bmad-statusline && node --test test/tui-monitor*.test.js 2>/dev/null || echo "no monitor tests"` -- expected: no regressions

## Suggested Review Order

**Reorder shortcuts & state**

- Entry point: reorder-specific shortcuts drive the whole UX
  [`MonitorScreen.js:37`](../../bmad-statusline/src/tui/monitor/MonitorScreen.js#L37)

- New reorder state: cursor, grabbed, snapshot
  [`MonitorScreen.js:88`](../../bmad-statusline/src/tui/monitor/MonitorScreen.js#L88)

- Reorder triggers initialize order arrays before entering mode
  [`MonitorScreen.js:267`](../../bmad-statusline/src/tui/monitor/MonitorScreen.js#L267)

**Inline reorder input handler**

- Dedicated useInput: grab/drop/cancel/navigate with cursor clamp
  [`MonitorScreen.js:303`](../../bmad-statusline/src/tui/monitor/MonitorScreen.js#L303)

**Tab visual feedback**

- SessionTabs receives reorder props, cursor highlight and ◂ grab indicator
  [`SessionTabs.js:16`](../../bmad-statusline/src/tui/monitor/components/SessionTabs.js#L16)

**Layout gating**

- Content hidden during reorder, reorder props passed to SessionTabs
  [`MonitorScreen.js:390`](../../bmad-statusline/src/tui/monitor/MonitorScreen.js#L390)

**Tests**

- Updated tests: overlay assertions replaced with inline reorder checks
  [`tui-monitor.test.js:588`](../../bmad-statusline/test/tui-monitor.test.js#L588)
