# Story 7.9: Toggles & Polish — Auto-scroll, Bell, Contextual Shortcuts

Status: done

## Story

As a **developer actively monitoring sessions**,
I want **real-time UX enhancements for sustained supervision**,
So that **the Monitor is practical for long-running use**.

## Acceptance Criteria

1. **Auto-scroll toggle (`a`):** Pressing `a` toggles auto-scroll on/off. When on, `[AUTO]` indicator visible in shortcut bar area. On new poll data (session content change), scroll jumps to latest entry (bottom). When off, scroll position stays manual.

2. **Bell toggle (`b`):** Pressing `b` toggles bell on/off. Shows `[bell]` when enabled, `[bell off]` when disabled. When enabled, emits `\x07` (BEL character) on LLM state transition to `permission` or `waiting` (only on actual transitions, not repeated polls with same state).

3. **Timestamp toggle (`t`):** Pressing `t` toggles timestamp display between absolute (`14:23:07`) and relative (`il y a 2min`). Applies in detail pages and chronology (normal mode file/command sections do not display timestamps — toggle has no visible effect there). MonitorDetailScreen's existing `t` handler for chronology becomes driven by this global state. Toggle works in normal mode, detail cursor mode, and chronology mode.

4. **Sort toggle (`s`):** Pressing `s` toggles sort between alphabetical and chronological. Applies to chronology page sorting and file tree ordering (pre-sort entries before passing to render functions). MonitorDetailScreen's existing `s` handler for chronology becomes driven by this global state. Toggle works in normal mode, detail cursor mode, and chronology mode.

5. **Color-coded shortcut bar:** ShortcutBar renders keys+labels with category colors: navigation keys (cyan), mode keys (yellow), action keys (green), toggle keys (magenta), Esc (dim). Backward compatible — existing callers without color prop unchanged.

6. **Contextual shortcuts per mode (Pattern 25):** Different shortcut arrays for 3 primary modes: normal, detail, chronology. Each shortcut includes `{ key, label, color }` where color maps to category. Export prompt and confirm modes bypass ShortcutBar entirely (ExportPrompt component replaces it, confirm shows path text) — no separate shortcut arrays needed for those.

7. **Esc in normal mode:** Calls `goBack()` to return to Home (already implemented, verify preserved).

8. **Tests:** All toggles on/off state, bell BEL emission, timestamp/sort switching across modes, shortcut color rendering, contextual shortcut arrays per mode, Esc navigation. All existing tests pass (`npm test`).

## Tasks / Subtasks

- [x] Task 1: Enhance ShortcutBar with color support (AC: #5)
  - [x] 1.1 Add optional `color` property to action objects in ShortcutBar
  - [x] 1.2 Render key+label in specified Ink color when present, fall back to existing bold/dim style
  - [x] 1.3 Verify existing TUI screens (HomeScreen, EditLineScreen, etc.) still render correctly (no color = no change)

- [x] Task 2: Define contextual shortcut arrays with categories (AC: #5, #6)
  - [x] 2.1 Create `NORMAL_SHORTCUTS` array: `◄►/↑↓` (cyan), `d détail`/`c chrono` (yellow), `e export` (green), `a auto`/`b bell`/`s tri`/`t temps` (magenta), `Esc home` (dim)
  - [x] 2.2 Create `DETAIL_SHORTCUTS` array: `↑↓ naviguer`/`Enter ouvrir` (cyan), `a auto`/`b bell`/`s tri`/`t temps` (magenta), `Esc retour` (dim)
  - [x] 2.3 Update `CHRONO_SHORTCUTS` in MonitorDetailScreen with color categories: `↑↓ scroll` (cyan), `s tri`/`t temps` (magenta), `Esc retour` (dim)
  - [x] 2.4 Update `getShortcuts()` in MonitorScreen to return the appropriate contextual array per mode
  - [x] 2.5 Update MonitorDetailScreen's shortcut constant to use color categories

- [x] Task 3: Implement auto-scroll toggle (AC: #1)
  - [x] 3.1 Add `autoScroll` state (boolean, default `false`) to MonitorScreen
  - [x] 3.2 Add `a` key handler in normal mode AND detail cursor mode to toggle `autoScroll`
  - [x] 3.3 On poll data change (sessions update), if `autoScroll === true`, set `scrollOffset` to `Math.max(0, items.length - viewportHeight)`
  - [x] 3.4 Show `[AUTO]` indicator in shortcut bar area when enabled

- [x] Task 4: Implement bell toggle (AC: #2)
  - [x] 4.1 Add `bellEnabled` state (boolean, default `false`) to MonitorScreen
  - [x] 4.2 Add `prevLlmState` ref (useRef) to track previous LLM state per session
  - [x] 4.3 Add `b` key handler in normal mode AND detail cursor mode to toggle `bellEnabled`
  - [x] 4.4 On poll: compare `currentSession.llm_state` to `prevLlmState.current`. If state transitioned to `permission` or `waiting` AND `bellEnabled`, emit `process.stdout.write('\x07')`
  - [x] 4.5 Update `prevLlmState.current` after comparison
  - [x] 4.6 Show `[bell]` or `[bell off]` indicator

- [x] Task 5: Lift timestamp/sort toggles to global state (AC: #3, #4)
  - [x] 5.1 Add `timeFormat` state ('absolute'|'relative', default 'absolute') to MonitorScreen
  - [x] 5.2 Add `sortMode` state ('chrono'|'alpha', default 'chrono') to MonitorScreen
  - [x] 5.3 Add `t` key handler in normal mode AND detail cursor mode to toggle `timeFormat`
  - [x] 5.4 Add `s` key handler in normal mode AND detail cursor mode to toggle `sortMode`
  - [x] 5.5 Pass `timeFormat` and `sortMode` as props to MonitorDetailScreen
  - [x] 5.6 Remove local `timeFormat`/`sortMode` state from MonitorDetailScreen — use props instead
  - [x] 5.7 MonitorDetailScreen `s`/`t` handlers call parent callbacks (`onToggleSort`, `onToggleTime`) to update global state
  - [x] 5.8 Apply `sortMode` to file tree sections: pre-sort `writes`/`readOnly` arrays by path (alpha) or timestamp (chrono) before passing to `renderFileSection`. Same for `commands` array before `renderBashSection`.
  - [x] 5.9 `timeFormat` has no visible effect in normal mode sections (they don't display timestamps). Only affects detail pages and chronology via props. No changes needed for normal mode rendering.

- [x] Task 6: Tests (AC: #8)
  - [x] 6.1 ShortcutBar color rendering tests — verify colored output when color prop present, dim fallback when absent
  - [x] 6.2 Auto-scroll toggle tests — `a` key toggles, `[AUTO]` indicator, scroll jump on new data
  - [x] 6.3 Bell toggle tests — `b` key toggles, `[bell]`/`[bell off]` indicator, BEL emission on state transition (mock `process.stdout.write`)
  - [x] 6.4 Timestamp toggle tests — `t` key toggles between absolute/relative display
  - [x] 6.5 Sort toggle tests — `s` key toggles between chrono/alpha ordering
  - [x] 6.6 Contextual shortcut array tests — verify correct shortcut set per mode
  - [x] 6.7 Esc navigation test — verify `goBack()` in normal mode
  - [x] 6.8 Run full suite `npm test` — all existing tests pass

- [x] Task 7: Full regression pass (AC: #8)
  - [x] 7.1 Run `npm test` and confirm 0 failures
  - [x] 7.2 Verify no regressions in detail mode, chronology, export flow

## Dev Notes

### Architecture Compliance

- **Runtime:** Node.js >= 20, ESM for TUI
- **Framework:** React 19 + Ink 6.8 + @inkjs/ui 2.0
- **Element creation:** `const e = React.createElement;` — NO JSX anywhere
- **Testing:** `node:test` + `node:assert/strict` + `ink-testing-library`
- **File I/O:** Synchronous only (Pattern 2)
- **Error handling:** TUI uses StatusMessage (Pattern 1)

### Import Changes Required

MonitorScreen.js current import: `import React, { useState, useEffect } from 'react';`
Must expand to: `import React, { useState, useEffect, useRef } from 'react';` (needed for `prevLlmState` ref in bell logic).

### Critical Patterns to Follow

- **Pattern 2 (Sync I/O):** All file operations via `readFileSync`/`writeFileSync`. No async/await, no promises.
- **Pattern 3 (ANSI colors):** Use Ink `<Text color={...}>` / `dimColor` props in TUI. Never inline ANSI codes.
- **Pattern 15 (State mutation):** Never mutate state directly. Use `structuredClone` + setter.
- **Pattern 23 (Monitor Cache I/O Isolation):** All cache reads in `monitor-utils.js` only. Components receive data via props.
- **Pattern 24 (Viewport Scroll Externalized State):** ScrollableViewport is stateless. Parent manages `scrollOffset` + keybindings.
- **Pattern 25 (Contextual Shortcut Bar):** Different shortcut arrays per mode (normal, detail, chronology, export). This story enhances these with color categories.
- **Pattern 26 (Tree navigation with selectable flag):** Cursor skips non-selectable lines.
- **Pattern 27 (Monitor Props Contract):** MonitorScreen receives `{ config, navigate, goBack, isActive, paths: { cachePath, outputFolder } }`.

### Project Structure Notes

Files to MODIFY:
```
bmad-statusline/src/tui/components/ShortcutBar.js          ← Add optional color prop
bmad-statusline/src/tui/monitor/MonitorScreen.js            ← Add toggle states, key handlers, global s/t, auto-scroll, bell
bmad-statusline/src/tui/monitor/MonitorDetailScreen.js      ← Replace local s/t state with props + parent callbacks
```

Files to modify for tests:
```
bmad-statusline/test/tui-monitor.test.js                    ← Toggle tests, shortcut color tests
bmad-statusline/test/tui-monitor-detail.test.js             ← Updated s/t tests for prop-driven behavior
bmad-statusline/test/tui-monitor-components.test.js         ← ShortcutBar color rendering tests
```

NO new files needed. All changes are modifications to existing files.

### Previous Story Intelligence

**From Story 7.8 (Chronology & Export):**
- MonitorScreen state machine: NORMAL → DETAIL → DETAIL PAGE, NORMAL → CHRONOLOGY, NORMAL → EXPORT PROMPT → EXPORT CONFIRM
- `exportMode` state (null|'prompt'|'confirm') gates main useInput: `isActive && !reorderMode && !detailItem && !exportMode`
- `getShortcuts()` returns different arrays based on mode — extend this with color categories
- MonitorDetailScreen has local `sortMode` ('chrono'|'alpha') and `timeFormat` ('absolute'|'relative') — these become props
- `buildChronologyDetail()` already handles sort/time toggling — refactor to accept params from props
- ExportPrompt renders in same slot as ShortcutBar (bottom of screen)
- Code review corrections: `*` indicator guard on `type === 'WRITE'`, try-catch on export, gated `c`/`e` on `currentSession`
- 501 tests, 0 failures after story 7.8

**From Story 7.7 (Detail Mode & Pages):**
- `formatTime()` already exists in monitor-utils.js — reuse for absolute timestamps
- `formatRelativeTime()` already exists in monitor-utils.js — reuse for relative timestamps
- Review patches applied: null guard on `new_string`, don't enter detail mode if no selectables

**From Story 7.6 (File & Bash Sections):**
- `buildFileTree` groups by path, `renderTreeLines` produces items
- `deduplicateCommands` returns groups with `entries[]`
- Review patches: Windows path splitting, null path guard

### Git Intelligence

Recent commits follow pattern: `7-N: Title — Subtitle` for story commits, `review(7-N): corrections` for review fixes.
Convention: `const e = React.createElement;`, named exports for screens, default export for utility components, `describe` + `test` pattern, `delay(50)` for async renders, `unmount()` in render tests.

### Key Implementation Details

**ShortcutBar Enhancement:**
Current ShortcutBar (17 lines) renders `actions` as `<Text bold>{key}</Text> <Text dimColor>{label}</Text>`. Add optional `color` field per action:
```js
// When action.color is present:
e(Text, { color: action.color, bold: true }, action.key)
e(Text, { color: action.color }, ' ' + action.label)

// When action.color is absent (backward compat):
e(Text, { bold: true }, action.key)
e(Text, { dimColor: true }, ' ' + action.label)
```

**Color Categories for Shortcuts:**
```js
const SHORTCUT_COLORS = {
  navigation: 'cyan',     // ◄► ↑↓ Tab
  mode: 'yellow',         // d détail, c chrono
  action: 'green',        // e export, Enter ouvrir
  toggle: 'magenta',      // a auto, b bell, s tri, t temps
  escape: undefined,      // Esc → dimColor (no color prop = existing behavior)
};
```

**Normal Mode Shortcuts:**
```js
const NORMAL_SHORTCUTS = [
  { key: '◄►', label: 'onglets', color: 'cyan' },
  { key: '↑↓', label: 'scroll', color: 'cyan' },
  { key: 'd', label: 'détail', color: 'yellow' },
  { key: 'c', label: 'chrono', color: 'yellow' },
  { key: 'e', label: 'export', color: 'green' },
  { key: 'a', label: 'auto', color: 'magenta' },
  { key: 'b', label: 'bell', color: 'magenta' },
  { key: 's', label: 'tri', color: 'magenta' },
  { key: 't', label: 'temps', color: 'magenta' },
  { key: 'Esc', label: 'home' },  // dimColor fallback
];
```

**Detail Cursor Mode Shortcuts:**
```js
const DETAIL_SHORTCUTS = [
  { key: '↑↓', label: 'naviguer', color: 'cyan' },
  { key: 'Enter', label: 'ouvrir', color: 'green' },
  { key: 'a', label: 'auto', color: 'magenta' },
  { key: 'b', label: 'bell', color: 'magenta' },
  { key: 's', label: 'tri', color: 'magenta' },
  { key: 't', label: 'temps', color: 'magenta' },
  { key: 'Esc', label: 'retour' },  // dimColor fallback
];
```

**Chronology Page Shortcuts:**
```js
const CHRONO_SHORTCUTS = [
  { key: '↑↓', label: 'scroll', color: 'cyan' },
  { key: 's', label: 'tri', color: 'magenta' },
  { key: 't', label: 'temps', color: 'magenta' },
  { key: 'Esc', label: 'retour' },  // dimColor fallback
];
```

**Auto-Scroll Logic:**
```js
// In MonitorScreen, after sessions poll updates:
useEffect(() => {
  if (autoScroll && currentSession) {
    // items = all rendered content items (files + commands + sections)
    const totalItems = /* compute total visible items */;
    setScrollOffset(Math.max(0, totalItems - viewportHeight));
  }
}, [sessions, autoScroll]);
// Reset scroll on toggle off is NOT required — just stop auto-jumping
```

**Bell Logic:**
```js
const prevLlmState = useRef(null);

// In poll effect or render:
useEffect(() => {
  if (!currentSession) return;
  const newState = computeDisplayState(currentSession);
  if (bellEnabled && prevLlmState.current &&
      prevLlmState.current !== newState &&
      (newState === 'permission' || newState === 'waiting')) {
    process.stdout.write('\x07');
  }
  prevLlmState.current = newState;
}, [currentSession, bellEnabled]);
```

**Toggle Key Handler Scope:**
All four toggles (`a`, `b`, `s`, `t`) must work in MonitorScreen's main `useInput` in BOTH the normal mode branch AND the detail cursor mode branch. The existing `useInput` at line ~144 has `if (detailMode === 'detail') { ... } else { ... }` — add toggle handlers to BOTH branches. When `detailItem` is set (MonitorDetailScreen visible), those keys are handled by MonitorDetailScreen instead.

**Global s/t Lifting:**
MonitorDetailScreen currently has:
```js
const [sortMode, setSortMode] = useState('chrono');
const [timeFormat, setTimeFormat] = useState('absolute');
```
Replace with props:
```js
// MonitorDetailScreen({ item, entries, onBack, isActive, sortMode, timeFormat, onToggleSort, onToggleTime })
```
The `s` and `t` key handlers in MonitorDetailScreen call `onToggleSort()` and `onToggleTime()` instead of local setters. MonitorScreen owns the state and passes it down.

**Reuse Existing Utilities:**
- `computeDisplayState()` from monitor-utils.js — already imported in MonitorScreen, use for bell state comparison
- `formatTime()` from monitor-utils.js — for absolute timestamp rendering
- `formatRelativeTime()` from monitor-utils.js — for relative timestamp rendering
- `mergeChronology()` — already used for chronology, no changes needed

**Toggle Indicators:**
Show toggle state indicators near shortcut bar or as prefix. Options:
- Append indicators to shortcut bar: `[AUTO] [bell] [alpha] [relative]`
- Or render as a separate status line above the shortcut bar

**Required approach:** render active toggle indicators as a single dim magenta `<Text>` line between the content and ShortcutBar. Only render when at least one toggle is active. Example: `[AUTO] [bell] [alpha] [relatif]`. BEL character (`\x07`) is safe to write directly to `process.stdout` — it produces no visual output, only a terminal bell/notification. No conflict with Ink rendering.

### Anti-Patterns to Avoid

- **DO NOT** use JSX — project uses `React.createElement` via `const e = React.createElement;`
- **DO NOT** use async/await for file I/O — use sync I/O (Pattern 2)
- **DO NOT** add `useState` or `useInput` inside ScrollableViewport — it's stateless (Pattern 24)
- **DO NOT** import `fs` or `path` in MonitorDetailScreen — it receives data via props (Pattern 23)
- **DO NOT** emit BEL on every poll — only on actual state transitions (prev !== current)
- **DO NOT** break existing detail mode, tab navigation, reorder overlay, or export flow
- **DO NOT** break existing chronology `s`/`t` behavior — same functionality, just lifted to parent
- **DO NOT** create new files — all changes are modifications to existing files
- **DO NOT** forget `unmount()` in render tests
- **DO NOT** forget unique `key` props on React elements in arrays
- **DO NOT** mock `process.stdout.write` globally — scope mock to bell-specific tests only

### Scope Boundary

**This story covers:**
- `a` toggle (auto-scroll with `[AUTO]` indicator)
- `b` toggle (bell with `[bell]`/`[bell off]` indicator + BEL emission)
- `t` toggle lifted to global (absolute ↔ relative timestamps)
- `s` toggle lifted to global (chrono ↔ alpha sort)
- ShortcutBar color-coded categories (backward compatible)
- Contextual shortcut arrays per mode with colors
- Tests for all new functionality

**This story does NOT cover:**
- New monitor features (already complete in 7.1-7.8)
- Changes to hook, reader, or installer
- Changes to main TUI configurator screens
- New components (all work in existing files)

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 7, Story 7.9]
- [Source: _bmad-output/planning-artifacts/architecture.md — Patterns 24, 25, 26, 27]
- [Source: _bmad-output/planning-artifacts/architecture.md — Monitor Components section]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Shortcut bar UX]
- [Source: _bmad-output/implementation-artifacts/7-8-chronology-export-timeline-csv-generation.md — Previous story intelligence]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
None — clean implementation, no debug issues encountered.

### Completion Notes List
- Task 1: ShortcutBar enhanced with optional `color` property per action — backward compatible, existing callers unchanged
- Task 2: Contextual shortcut arrays with color categories for normal mode (navigation=cyan, mode=yellow, action=green, toggle=magenta, Esc=dim), detail cursor mode, and chronology mode
- Task 3: Auto-scroll toggle (`a` key) with `[AUTO]` indicator, auto-jumps to bottom on poll data change
- Task 4: Bell toggle (`b` key) with `[bell]` indicator, emits BEL char on LLM state transition to permission/waiting using useRef for previous state tracking
- Task 5: Lifted timeFormat/sortMode from MonitorDetailScreen local state to MonitorScreen global state, passed as props with callbacks. Applied sortMode to file tree and command sections pre-sort
- Task 6: 16 new tests added — ShortcutBar color (4), toggle indicators (5), detail mode toggles (1), bell BEL emission (1), contextual shortcuts (2), Esc navigation (1), prop-driven sort/time rendering (2)
- Task 7: Full regression pass — 517 tests, 0 failures
- Updated existing MonitorDetailScreen s/t tests to prop-driven approach (callback verification + direct prop rendering)

### Review Findings

- [x] [Review][Defer] `[bell off]` indicator missing when bell is disabled — AC #2 says "Shows [bell] when enabled, [bell off] when disabled" but dev notes say "Only render when at least one toggle is active." Deferred: user wants all toggle states always visible in the appropriate shortcut area, not hidden when default. Will address in a future polish pass.
- [x] [Review][Patch] Bell false-positive on session switch — prevLlmState ref not reset when session changes, causes spurious BEL on tab switch [MonitorScreen.js:~149]
- [x] [Review][Patch] Auto-scroll fires in detail cursor mode — no guard on detailMode, viewport jumps on every poll while user navigates cursor [MonitorScreen.js:~168]
- [x] [Review][Patch] Bell test monkey-patch not in finally block — process.stdout.write restore can be skipped on assertion failure [tui-monitor.test.js:~969]
- [x] [Review][Patch] Missing test: bell NOT emitting on repeated polls with same state [tui-monitor.test.js]
- [x] [Review][Patch] Missing test: bell on transition to `waiting` state [tui-monitor.test.js]
- [x] [Review][Patch] Missing test: auto-scroll data jump on new poll data [tui-monitor.test.js]

### Change Log
- 2026-04-04: Story 7.9 implemented — toggles, color-coded shortcuts, global sort/time state

### File List
- bmad-statusline/src/tui/components/ShortcutBar.js (modified — optional color prop)
- bmad-statusline/src/tui/monitor/MonitorScreen.js (modified — toggle states, key handlers, auto-scroll/bell effects, sort pre-processing, toggle indicators, props to detail screen)
- bmad-statusline/src/tui/monitor/MonitorDetailScreen.js (modified — props instead of local state, color categories on shortcuts, callbacks for s/t)
- bmad-statusline/test/tui-monitor.test.js (modified — toggle tests, contextual shortcut tests, Esc test)
- bmad-statusline/test/tui-monitor-detail.test.js (modified — updated s/t tests for prop-driven approach)
- bmad-statusline/test/tui-monitor-components.test.js (modified — ShortcutBar color rendering tests)
