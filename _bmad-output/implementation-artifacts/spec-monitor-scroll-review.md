---
title: 'Fix monitor scroll rendering corruption'
type: 'bugfix'
created: '2026-04-07'
status: 'done'
baseline_commit: '672fb60'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Scrolling in the TUI monitor corrupts displayed lines. When scrolling by 1, trailing characters from longer previous lines bleed into shorter replacement lines (e.g. `MonitorScreen.js 🔀.js 🔀`). Combined with polling data updates, the viewport becomes an unreadable mix of stale and current content.

**Approach:** Remove the position-based stable key strategy (`slot-N`) from `ScrollableViewport` and let items keep their original content-based keys. This makes Ink unmount/remount shifted elements on scroll, producing clean full-line rewrites instead of in-place partial updates that leave trailing character residue.

## Boundaries & Constraints

**Always:** Both MonitorScreen (normal + detail mode) and MonitorDetailScreen must scroll cleanly. Viewport height calculation and indicator counts (`▲ N more` / `▼ N more`) must remain unchanged.

**Ask First:** If removing stable keys introduces visible flicker on scroll, discuss alternative approaches (e.g. ANSI clear-to-EOL padding) before proceeding.

**Never:** Do not change scroll offset logic, input handling, or clamping formulas — those work correctly. Do not change how items are built in FileTreeSection, BashSection, or MonitorScreen section concatenation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Scroll down 1 | 20 items, viewport=10, offset 0→1 | All 10 visible lines show correct content, no trailing chars | N/A |
| Scroll into shorter content | Long line at slot replaced by short line | Short line renders cleanly, no residual characters | N/A |
| Content update during scroll | Polling changes items between renders | Fresh items display correctly at current offset | N/A |
| Fewer items than viewport | 3 items, viewport=10 | 3 content lines + 7 padding lines, no artifacts | N/A |

</frozen-after-approval>

## Code Map

- `bmad-statusline/src/tui/monitor/components/ScrollableViewport.js` -- Core fix: remove cloneElement key override, keep original element keys, use distinct keys for padding slots
- `bmad-statusline/test/tui-monitor.test.js` -- Extend scroll test to verify content correctness after scroll, not just crash-safety

## Tasks & Acceptance

**Execution:**
- [x] `ScrollableViewport.js` -- Remove `React.cloneElement(visible[i], { key: 'slot-${i}' })` and push `visible[i]` directly; rename padding keys to `pad-${i}` to avoid collisions with content keys
- [x] `tui-monitor.test.js` -- Add test: render 10 items in viewport of 5, scroll down 1, verify visible slice matches items[1..5] and indicator counts are correct

**Acceptance Criteria:**
- Given a monitor with more items than viewport height, when scrolling down by 1, then every visible line displays correct content with no trailing character residue
- Given polling updates that change item content between scroll steps, when the viewport re-renders, then lines reflect current data only

## Verification

**Commands:**
- `cd bmad-statusline && node --experimental-vm-modules node_modules/.bin/jest test/tui-monitor.test.js --no-coverage` -- expected: all tests pass

**Manual checks:**
- Launch monitor with an active session, scroll up/down repeatedly — no line corruption or character bleed

## Suggested Review Order

- Core fix: stable keys removed, original element keys preserved for clean Ink rewrites
  [`ScrollableViewport.js:28`](../../bmad-statusline/src/tui/monitor/components/ScrollableViewport.js#L28)

- Padding slots renamed `pad-N` to avoid key collisions with content elements
  [`ScrollableViewport.js:30`](../../bmad-statusline/src/tui/monitor/components/ScrollableViewport.js#L30)

- New test validates content correctness at offset 0 and offset 1 with indicator counts
  [`tui-monitor.test.js:1041`](../../bmad-statusline/test/tui-monitor.test.js#L1041)
