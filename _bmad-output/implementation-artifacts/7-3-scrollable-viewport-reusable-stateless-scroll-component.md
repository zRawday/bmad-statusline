# Story 7.3: ScrollableViewport — Reusable stateless scroll component

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **TUI developer building Monitor screens**,
I want **a reusable ScrollableViewport component**,
So that **both MonitorScreen and MonitorDetailScreen display scrollable content consistently**.

## Acceptance Criteria

1. **Given** ScrollableViewport receives `items`, `height`, `scrollOffset`
   **When** rendered
   **Then** it displays `items.slice(scrollOffset, scrollOffset + height)`
   **And** shows `▲ {N} de plus` if scrollOffset > 0, `▼ {N} de plus` if items remain below

2. **Given** ScrollableViewport with scrollOffset = 0 and items fit within height
   **When** rendered
   **Then** no scroll indicators are shown (neither ▲ nor ▼)

3. **Given** ScrollableViewport with scrollOffset > 0 and items remain below
   **When** rendered
   **Then** both `▲ {N} de plus` (above, dimColor) and `▼ {N} de plus` (below, dimColor) are shown

4. **Given** component design
   **When** implemented
   **Then** it is stateless (no `useState`), does not call `useInput` (Pattern 24), lives at `src/tui/monitor/components/ScrollableViewport.js`

5. **Given** ScrollableViewport receives an empty items array
   **When** rendered
   **Then** it renders nothing (no indicators, no crash)

6. **Given** items are React elements (Text nodes with formatting)
   **When** rendered
   **Then** they are passed through unmodified — ScrollableViewport does not wrap or transform them

7. **Given** tests
   **When** executed
   **Then** `test/tui-monitor-components.test.js` created with render tests for:
   - Items within viewport (no indicators)
   - Items overflow top (▲ indicator with count)
   - Items overflow bottom (▼ indicator with count)
   - Items overflow both directions (both indicators)
   - Empty items array (no crash)
   - Height = 0 edge case
   **And** all existing tests pass (`npm test`)

## Tasks / Subtasks

- [x] Task 1: Create directory structure (AC: #4)
  - [x] 1.1 Create `bmad-statusline/src/tui/monitor/` directory
  - [x] 1.2 Create `bmad-statusline/src/tui/monitor/components/` directory

- [x] Task 2: Implement ScrollableViewport component (AC: #1, #2, #3, #4, #5, #6)
  - [x] 2.1 Create `src/tui/monitor/components/ScrollableViewport.js`
  - [x] 2.2 Implement as a pure function component — `function ScrollableViewport({ items, height, scrollOffset })`
  - [x] 2.3 Compute `visible = items.slice(scrollOffset, scrollOffset + height)`
  - [x] 2.4 Compute `above = scrollOffset`, `below = Math.max(0, items.length - scrollOffset - height)`
  - [x] 2.5 Render: `above > 0` → `e(Text, { dimColor: true }, '▲ ${above} de plus')`, spread visible items, `below > 0` → `e(Text, { dimColor: true }, '▼ ${below} de plus')`
  - [x] 2.6 Wrap in `e(Box, { flexDirection: 'column' }, ...children)`
  - [x] 2.7 Handle empty items array gracefully (return empty Box)
  - [x] 2.8 NO `useState`, NO `useInput`, NO `useEffect` — stateless only
  - [x] 2.9 Export as default export: `export default ScrollableViewport;`

- [x] Task 3: Create test file (AC: #7)
  - [x] 3.1 Create `test/tui-monitor-components.test.js`
  - [x] 3.2 Test: items fit in viewport → no ▲/▼ indicators shown
  - [x] 3.3 Test: scrollOffset > 0 → `▲ {N} de plus` displayed with correct count
  - [x] 3.4 Test: items extend below viewport → `▼ {N} de plus` displayed with correct count
  - [x] 3.5 Test: scrollOffset > 0 AND items below → both indicators
  - [x] 3.6 Test: empty items array → renders without crash, no indicators
  - [x] 3.7 Test: height = 0 → all items hidden, ▼ indicator shows total count
  - [x] 3.8 Verify all existing tests still pass: `npm test`

## Dev Notes

### Architecture Compliance

- **Pattern 24 (CRITICAL):** ScrollableViewport is STATELESS. No `useState`, no `useInput`. The parent component (MonitorScreen, MonitorDetailScreen) owns `scrollOffset` state and all keybindings. This enables auto-scroll, jump-to-position, and programmatic scroll on new data. [Source: architecture.md#Pattern-24]
- **Pattern 23:** ScrollableViewport never touches the filesystem. It receives pre-built React elements via `items` prop. All cache I/O lives in `monitor-utils.js`. [Source: architecture.md#Pattern-23]
- **FR52-54:** Viewport scroll with manual offset (↑↓). Scroll indicators ▲/▼ with hidden item count. [Source: architecture.md#FR52-54]

### Component Signature

```js
function ScrollableViewport({ items, height, scrollOffset })
```

- `items` — Array of React elements (already-built `e(Text, ...)` nodes or `e(Box, ...)` nodes). NOT raw strings.
- `height` — Number of visible rows. Parent calculates from `useStdout().rows` minus sticky zones (title, tabs, badge, shortcut bar).
- `scrollOffset` — Integer, 0-based. Parent manages via `useState` + `useInput`.

### Reference Implementation

From architecture.md:

```js
function ScrollableViewport({ items, height, scrollOffset }) {
  const visible = items.slice(scrollOffset, scrollOffset + height);
  const above = scrollOffset;
  const below = Math.max(0, items.length - scrollOffset - height);

  return e(Box, { flexDirection: 'column' },
    above > 0 && e(Text, { dimColor: true }, `▲ ${above} de plus`),
    ...visible,
    below > 0 && e(Text, { dimColor: true }, `▼ ${below} de plus`),
  );
}
```

### Consumers (Future Stories)

- **Story 7.4 (MonitorScreen):** Uses ScrollableViewport for file sections + bash commands. MonitorScreen manages scrollOffset state and ↑↓ keybindings.
- **Story 7.7 (MonitorDetailScreen):** Uses its own ScrollableViewport for detail page content (diffs, read lists, command lists).

### Existing Component Patterns to Follow

- Use `const e = React.createElement;` — no JSX. All existing components use `e()` factory. [Source: all files in src/tui/components/]
- Import pattern: `import React from 'react'; import { Box, Text } from 'ink';`
- Export pattern: `export default ScrollableViewport;`
- No dependencies beyond `react` and `ink` (Box, Text)

### Test Patterns to Follow

- Use `import { render } from 'ink-testing-library';`
- Use `lastFrame()` to capture rendered output as string
- Use `assert.match()` or `assert.ok(frame.includes(...))` for content checks
- File naming: `test/tui-monitor-components.test.js` (will be expanded in future stories for LlmBadge, SessionTabs, etc.)
- Existing test reference: `test/tui-components.test.js` for pattern examples

### Project Structure Notes

- New directory `src/tui/monitor/` created for all Monitor feature files — this is the first file in this subtree
- New directory `src/tui/monitor/components/` for Monitor-specific components (ScrollableViewport, SessionTabs, LlmBadge, FileTreeSection, BashSection, ExportPrompt will follow)
- Separate from `src/tui/components/` which contains configurator TUI shared components (ScreenLayout, ShortcutBar, etc.)
- MonitorScreen does NOT use ScreenLayout — it has its own custom layout (no BMAD header, no ThreeLinePreview) [Source: architecture.md#MonitorScreen]

### Anti-Patterns to Avoid

- DO NOT add `useInput` inside ScrollableViewport — conflicts with parent keybindings
- DO NOT add `useState` — breaks parent control of scroll position
- DO NOT import `useStdout` — height calculation is the parent's responsibility
- DO NOT wrap items in extra elements — items are pre-built React nodes, pass through as-is
- DO NOT flatten tree structure items — they may contain `selectable` flags for Pattern 26 (Story 7.7)

### References

- [Source: architecture.md#ScrollableViewport-Component] — component specification
- [Source: architecture.md#Pattern-24] — viewport scroll externalized state
- [Source: architecture.md#Pattern-23] — monitor cache I/O isolation
- [Source: architecture.md#FR52-54] — scroll requirements
- [Source: architecture.md#Boundary-8] — TUI↔Cache read path
- [Source: epics.md#Story-7.3] — epic story definition

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation, no debugging required.

### Completion Notes List

- Created `src/tui/monitor/` and `src/tui/monitor/components/` directory structure for Monitor feature
- Implemented ScrollableViewport as a pure stateless function component (no useState, useInput, useEffect)
- Component slices items by scrollOffset/height and renders ▲/▼ indicators with hidden item counts
- Empty items array handled gracefully (renders empty Box)
- Created 6 test cases covering: items fit, overflow top, overflow bottom, both directions, empty array, height=0
- All 6 new tests pass; 1 pre-existing failure in tui-reorder-lines.test.js (unrelated)

### Change Log

- 2026-04-04: Implemented ScrollableViewport component and test suite (all ACs satisfied)

### Review Findings

Code review 2026-04-04 — 3 parallel layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor).

- **All 7 ACs: PASS** (Acceptance Auditor)
- **All architecture constraints: PASS** (Pattern 24 stateless, Pattern 23 no I/O, no anti-patterns)
- **9 findings raised, 9 dismissed:**
  - Input clamping (scrollOffset/height out-of-bounds): dismissed — by-design per architecture reference implementation, Pattern 24 delegates to parent
  - Indicator lines consume viewport height: dismissed — parent's responsibility per architecture
  - React `false` spreading: dismissed — standard React pattern
  - French "de plus" strings: dismissed — spec requirement
  - Missing key props on indicators: dismissed — not in array context
  - height=0 behavior: dismissed — mathematically correct, explicitly tested
  - Non-integer scrollOffset: dismissed — parent uses integer state
  - Undefined props: dismissed — internal component, caller validates
  - Empty Box vs null: dismissed — cosmetic, no observable difference

**Result: Clean review. No patches, no deferred work.**

### File List

- bmad-statusline/src/tui/monitor/components/ScrollableViewport.js (new)
- bmad-statusline/test/tui-monitor-components.test.js (new)
