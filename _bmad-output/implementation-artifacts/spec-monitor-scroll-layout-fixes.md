---
title: Monitor scroll & layout fixes
type: bugfix
created: 2026-04-06
status: done
baseline_commit: f6bb5e0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Monitor TUI has display bugs: (1) `Text('')` spacers collapse to 0 rows in Ink, making all blank lines between sticky sections invisible; (2) section spacers inside the viewport were disabled (commented out), so content sections run together; (3) post-header spacers in FileTreeSection/BashSection also collapse; (4) `headerRows`/`footerRows` don't account for visible spacers, miscounting viewport height and causing scroll items to mix with sticky elements; (5) no spacer exists between SessionTabs and LlmBadge or between project/session tab rows.

**Approach:** Replace all `Text('')` with `Text(' ')` so spacers render as 1 row. Add missing spacers (tabs→badge, projectRow→sessionRow). Update `headerRows`/`footerRows` to count every visible spacer. Re-enable between-section spacers in the viewport.

## Boundaries & Constraints

**Always:** Every spacer occupying a terminal row must be counted in `headerRows` or `footerRows`. The sticky spacer between LlmBadge and viewport must remain visible at all scroll positions. `viewportHeight` must stay ≥ 1.

**Ask First:** If viewport height drops below 5 on small terminals, ask before adding fallback.

**Never:** Do not change scroll mechanics (slice-based viewport), section content rendering, or reorder/detail mode logic.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Multi-project at top | scrollOffset=0, 2+ projects | Blank lines: title↔tabs, projectRow↔sessionRow, tabs↔badge, badge↔content, content↔shortcuts | N/A |
| Single-session | 1 session, no tabs | Blank lines: title↔badge, badge↔content, content↔shortcuts | N/A |
| Scroll down then back | scrollOffset 0→N→0 | All sticky spacers persist, indicator shows ▲ when scrolled, space at top | N/A |
| Multiple sections visible | writes + reads + bash | Blank line between each section inside viewport | N/A |
| Terminal 15 rows, multi-project | rows=15 | viewportHeight = 15-12 = 3, no crash | Clamp max(1,...) |

</frozen-after-approval>

## Code Map

- `src/tui/monitor/MonitorScreen.js` -- Main layout, spacer rendering (L403,420,429), headerRows/footerRows (L181-192), section concatenation (L163-177)
- `src/tui/monitor/components/ScrollableViewport.js` -- Slice-based viewport, indicator placeholders (L17-25)
- `src/tui/monitor/components/SessionTabs.js` -- Project/session tab rows, multi-project return (L70-73)
- `src/tui/monitor/components/FileTreeSection.js` -- Post-header spacer (L17,49)
- `src/tui/monitor/components/BashSection.js` -- Post-header spacer (L15,44)

## Tasks & Acceptance

**Execution:**
- [x] `src/tui/monitor/components/FileTreeSection.js` -- Change `''` to `' '` at L17 (items metadata) and L49 (React element) so post-header spacer renders as 1 row.
- [x] `src/tui/monitor/components/BashSection.js` -- Change `''` to `' '` at L15 (items metadata) and L44 (React element) so post-header spacer renders as 1 row.
- [x] `src/tui/monitor/components/SessionTabs.js` -- In multi-project return (L70), add `e(Text, null, ' ')` between projectRow and sessionRow inside the column Box.
- [x] `src/tui/monitor/MonitorScreen.js` -- (a) Replace `e(Text, null, '')` with `e(Text, null, ' ')` at L403, L420, L429. (b) Add conditional spacer `showTabs ? e(Text, null, ' ') : null` between SessionTabs and LlmBadge. (c) Uncomment section spacers at L171-173. (d) Rewrite headerRows: `let headerRows = 2` (title+spacer); if showTabs, `+= (multi-project ? 3 : 1) + 1` (tabs+spacer); if currentSession, `+= 1` (badge); always `+= 1` (spacer before viewport). Set `footerRows = 2` (spacer+shortcuts).

**Acceptance Criteria:**
- Given multi-project monitor, when rendered, then blank lines visible between: title↔project tabs, project↔session tabs, session tabs↔badge, badge↔first section, each content section, last section↔shortcuts.
- Given monitor scrolled down then back to scrollOffset 0, when at top, then blank line between LlmBadge and first content section is visible.
- Given 3 non-empty sections (writes, reads, bash), when displayed, then each section separated by a blank line inside the viewport.
- Given 24-row terminal in multi-project, when rendered, then viewport = 12 rows, all fits without overflow or mixing.

## Verification

**Manual checks:**
- Run TUI monitor with multiple sessions, verify spacing matches desired layout
- Scroll up/down, verify no mixing between sticky and scrollable elements
- Toggle bash section on, verify inter-section spacers appear

## Suggested Review Order

**Viewport height calculation**

- headerRows/footerRows now count every visible spacer row
  [`MonitorScreen.js:180`](../../bmad-statusline/src/tui/monitor/MonitorScreen.js#L180)

**Sticky spacers in render tree**

- Title→tabs spacer, conditional tabs→badge spacer, badge→viewport, viewport→shortcuts
  [`MonitorScreen.js:405`](../../bmad-statusline/src/tui/monitor/MonitorScreen.js#L405)

- Re-enabled between-section spacers in viewport item concatenation
  [`MonitorScreen.js:170`](../../bmad-statusline/src/tui/monitor/MonitorScreen.js#L170)

**Component-level spacers**

- Spacer between projectRow and sessionRow in multi-project tabs
  [`SessionTabs.js:72`](../../bmad-statusline/src/tui/monitor/components/SessionTabs.js#L72)

- Post-header spacer now renders as 1 row (file sections)
  [`FileTreeSection.js:17`](../../bmad-statusline/src/tui/monitor/components/FileTreeSection.js#L17)

- Post-header spacer now renders as 1 row (bash section)
  [`BashSection.js:15`](../../bmad-statusline/src/tui/monitor/components/BashSection.js#L15)
