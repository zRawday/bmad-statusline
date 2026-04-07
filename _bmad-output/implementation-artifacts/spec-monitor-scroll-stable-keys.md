---
title: 'Scroll stable keys — fix monitor viewport artifacts'
type: 'bugfix'
created: '2026-04-06'
status: 'done'
baseline_commit: 'd37e852'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Scrolling in the monitor page creates visual artifacts — lines mix together and don't all scroll simultaneously. `ScrollableViewport` uses content-based keys inherited from upstream sections, causing React/Ink to perform bulk mount/unmount/move operations on every scroll step instead of in-place updates. The viewport Box also lacks a fixed height, allowing layout shifts when item count varies.

**Approach:** Replace content-based keys with stable position-based keys (`slot-0`...`slot-N`) via `React.cloneElement`, pad unused slots to maintain constant height, and set an explicit `height` prop on the viewport Box to clip any line-wrap overflow.

## Boundaries & Constraints

**Always:** Fix confined to `ScrollableViewport.js` only. Both consumers (`MonitorScreen`, `MonitorDetailScreen`) must keep working without changes. Padding slots render as single-space `Text` elements (visually invisible).

**Ask First:** Any change to viewport height calculations in `MonitorScreen.js` or `MonitorDetailScreen.js`.

**Never:** Do not modify section rendering logic (`FileTreeSection.js`, `BashSection.js`). Do not change scroll offset/input handling in either screen. Do not alter visual appearance of content or indicators.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Normal scroll | items.length > height, user presses arrow | All visible lines update simultaneously, no tearing | N/A |
| Fewer items than height | items.length < height | Items shown + padding slots, stable footer position | N/A |
| Zero items | items = [] | Empty Box returned, no crash | N/A |
| Detail mode scroll | displayItems are Box-wrapped | Position keys applied to Box elements, smooth scroll | N/A |
| Data refresh during scroll | Poll adds items while user is scrolled | Layout height unchanged, no layout jump | N/A |

</frozen-after-approval>

## Code Map

- `bmad-statusline/src/tui/monitor/components/ScrollableViewport.js` -- Sole file to modify: viewport rendering with stable keys
- `bmad-statusline/src/tui/monitor/MonitorScreen.js` -- Primary consumer (monitor page) — read-only verification
- `bmad-statusline/src/tui/monitor/MonitorDetailScreen.js` -- Secondary consumer (timeline, detail) — read-only verification

## Tasks & Acceptance

**Execution:**
- [x] `bmad-statusline/src/tui/monitor/components/ScrollableViewport.js` -- Replace `...visible` spread with position-keyed loop: `React.cloneElement(visible[i], { key: 'slot-' + i })`, pad remaining slots to `height` with `e(Text, { key: 'slot-' + i }, ' ')`, add `height: height + 2` on outer Box

**Acceptance Criteria:**
- Given the monitor page with multiple sections, when scrolling up/down, then all lines update simultaneously without visual artifacts
- Given fewer items than viewport height, when viewing the monitor, then layout remains stable with consistent footer position
- Given the timeline/detail page, when scrolling, then behavior is unchanged (no regression)

## Verification

**Manual checks (if no CLI):**
- Launch TUI, navigate to monitor with active session data, scroll up/down repeatedly — verify no visual artifacts
- Switch to timeline page, scroll — verify no regression
- Resize terminal on monitor page — verify layout adjusts cleanly

## Suggested Review Order

- Stable position-keyed loop replaces content-key spread — the core fix
  [`ScrollableViewport.js:26`](../../bmad-statusline/src/tui/monitor/components/ScrollableViewport.js#L26)

- Fixed `height` prop on viewport Box clips overflow and locks layout
  [`ScrollableViewport.js:40`](../../bmad-statusline/src/tui/monitor/components/ScrollableViewport.js#L40)

- Padding empty slots to maintain constant child count
  [`ScrollableViewport.js:29`](../../bmad-statusline/src/tui/monitor/components/ScrollableViewport.js#L29)
