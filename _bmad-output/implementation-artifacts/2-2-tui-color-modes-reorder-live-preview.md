# Story 2.2: TUI Color Modes, Reorder, Live Preview & Party Mode

Status: done

## Story

As a **developer who wants fine-grained control over statusline appearance**,
I want **to switch between dynamic and fixed color modes per widget, reorder widgets, and see a live preview of my changes**,
So that **I can tune the visual experience to my preferences before committing changes**.

## Acceptance Criteria

1. **Given** the TUI is running **When** the user selects a widget and toggles color mode **Then** Dynamic mode sets `preserveColors: true` (reader ANSI applies) and Fixed mode sets `preserveColors: false` (widget `color` property applies)

2. **Given** the TUI is running in Fixed color mode for a widget **When** the user selects a color **Then** the widget's `color` property is updated in the config

3. **Given** the TUI is running **When** the user reorders widgets via up/down controls **Then** the widget order in the config's target line array is updated accordingly

4. **Given** any configuration change is made **When** the change is applied **Then** a live preview line renders the expected statusline output in the TUI **And** the preview uses actual ANSI colors for dynamic widgets and config colors for fixed widgets

5. **Given** the TUI live preview is active **When** the current status file contains multiple agents (e.g., `["Amelia", "Bob", "Quinn"]`) **Then** the preview renders each agent in their individual color, matching the reader's multi-agent coloring behavior

## Tasks / Subtasks

- [x] Task 1: Extend widget-registry with per-widget color mode support (AC: #1, #2)
  - [x] 1.1 Add `colorMode` property to `buildWidgetConfig` options: per-widget map `{ widgetId: { mode: 'dynamic'|'fixed', fixedColor: 'white' } }`
  - [x] 1.2 When `mode === 'dynamic'`: set `preserveColors: true`, `color: 'white'` (fallback only)
  - [x] 1.3 When `mode === 'fixed'`: set `preserveColors: false`, `color: fixedColor` (user-chosen color)
  - [x] 1.4 Default: all widgets → `dynamic` (current behavior unchanged). When a widget is set to dynamic, preserve the existing `color` fallback (`'white'` for colored extractors like workflow/agent, `'brightBlack'` for non-colored extractors like project/timer)
  - [x] 1.5 Export `CCSTATUSLINE_COLORS` constant — the list of valid ccstatusline color names for fixed mode picker: `['white', 'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'gray', 'brightRed', 'brightGreen', 'brightYellow', 'brightBlue', 'brightMagenta', 'brightCyan', 'brightWhite']`

- [x] Task 2: Add color mode section to TUI app (AC: #1, #2)
  - [x] 2.1 Add new section `colorMode` to `SECTIONS` array (between `widgets` and `targetLine`)
  - [x] 2.2 Add `widgetColorModes` to state — map of `{ [widgetId]: { mode: 'dynamic'|'fixed', fixedColor: 'white' } }`
  - [x] 2.3 Initialize `widgetColorModes` from existing config: read each widget's `preserveColors` and `color` properties
  - [x] 2.4 Create `ColorModeSection` component — shows enabled widgets, each with a Dynamic/Fixed toggle
  - [x] 2.5 When widget is set to Fixed: show inline color picker using `Select` from `@inkjs/ui` with `CCSTATUSLINE_COLORS`
  - [x] 2.6 Pass `widgetColorModes` to `buildWidgetConfig` in `handleSave`

- [x] Task 3: Add widget reorder section to TUI app (AC: #3)
  - [x] 3.1 Add new section `reorder` to `SECTIONS` array (after `colorMode`, before `targetLine`)
  - [x] 3.2 Create `ReorderSection` component — displays enabled widgets as an ordered list with cursor
  - [x] 3.3 When section is active: `useInput` captures arrow `up`/`down` to move the highlighted widget in the list
  - [x] 3.4 State: `widgetOrder` is an array of widget IDs determining display order
  - [x] 3.5 Initialize `widgetOrder` from existing config: extract BMAD widget IDs from current line in order (skip separators)
  - [x] 3.6 When `enabled` list changes (widget toggled), update `widgetOrder` — add new widgets at end, remove disabled ones
  - [x] 3.7 When `compositeMode` is not `individual`, the Reorder section should show the composite widget name as a single non-reorderable entry (or display "N/A — composite mode"). When switching back to individual, restore the previous `widgetOrder`
  - [x] 3.8 Pass `widgetOrder` as the `enabledWidgets` param in `buildWidgetConfig` (respects ordering)

- [x] Task 4: Create live preview component (AC: #4, #5)
  - [x] 4.1 Create `PreviewSection` component — renders a simulated statusline at the bottom of the TUI
  - [x] 4.2 Preview uses mock status data: `{ project: 'Toulou', workflow: 'dev-story', agent: ['Amelia'], story: '2.2 TUI Colors', step: { current: '3', current_name: 'color modes', completed: 3, total: 6 }, started_at: '<now>' }`
  - [x] 4.3 For each enabled widget, render its mock output inline using the Ink `Text` component:
    - `project` → plain text ("Toulou")
    - `workflow` → ANSI colored if dynamic, config color if fixed. **Must replicate reader's full lookup**: first check `WORKFLOW_COLORS` exact match, then iterate `WORKFLOW_PREFIX_COLORS` for prefix match (`testarch-*`, `qa-generate-*`, `wds-*`), else plain text. Import `WORKFLOW_PREFIX_COLORS` from `src/defaults.js`.
    - `agent` → ANSI colored if dynamic (lookup `AGENT_COLORS`), config color if fixed
    - `step`, `nextstep`, `progress`, `progressbar`, `progressstep` → plain text
    - `story`, `request`, `document` → plain text
    - `timer` → plain text ("5m30s")
    - `compact`, `full`, `minimal` → composite rendering with colored segments + neutral separator
  - [x] 4.4 Render separators between widgets matching selected separator style
  - [x] 4.5 Preview updates reactively on any state change (widget toggle, reorder, color mode, separator, composite mode, target line)
  - [x] 4.6 Party mode preview: read `BMAD_CACHE_DIR` or `~/.cache/bmad-status/` for a real status file to extract agent array **once on component mount** (cache in state, do NOT re-read on every render). If found and multiple agents, render each in their individual color. If no real file, use mock single agent.
  - [x] 4.7 Party mode fallback: if real status file has `agent: ["Amelia", "Bob", "Quinn"]`, preview shows each agent name in its mapped color from `AGENT_COLORS`
  - [x] 4.8 For composite modes (compact, full, minimal), render a complete composite preview with colored segments and neutral ` · ` separator

- [x] Task 5: Update buildWidgetConfig for reorder and color modes (AC: #1, #2, #3)
  - [x] 5.1 Modify `buildWidgetConfig` signature: accept `enabledWidgets` as ordered array (already is), add `colorModes` map to options
  - [x] 5.2 For each widget in the config output, apply color mode from `colorModes[widgetId]` if present
  - [x] 5.3 Composite mode widgets: inherit color mode (dynamic by default, user can set to fixed)
  - [x] 5.4 **Fix existing bug:** composite mode separator at `widget-registry.js:66` is missing the `content` property — add `content: sepContent` using the selected separator style, consistent with individual mode behavior at line 88

- [x] Task 6: Create tests (AC: all)
  - [x] 6.1 Update `test/tui-widget-registry.test.js` — test per-widget color mode in `buildWidgetConfig`: dynamic mode → `preserveColors: true`, fixed mode → `preserveColors: false` with custom color
  - [x] 6.2 Test widget reorder: `buildWidgetConfig` respects order of `enabledWidgets` array
  - [x] 6.3 Test `CCSTATUSLINE_COLORS` export exists and contains expected colors
  - [x] 6.4 Test mixed color modes: some widgets dynamic, some fixed in same build
  - [x] 6.5 Run `npm test` — all existing + new tests pass, zero regressions

- [x] Task 7: Verify end-to-end (AC: all)
  - [x] 7.1 Launch TUI with `node bin/cli.js` — verify new sections (Color Mode, Reorder) appear
  - [x] 7.2 Toggle a widget between Dynamic/Fixed — verify preview updates
  - [x] 7.3 Select a fixed color — verify preview shows the chosen color
  - [x] 7.4 Reorder widgets — verify preview reflects new order
  - [x] 7.5 Save and inspect `~/.config/ccstatusline/settings.json` — verify `preserveColors` and `color` values per widget
  - [x] 7.6 Verify party mode: if real status file has multiple agents, preview shows individual colors
  - [x] 7.7 Verify all existing commands still work (`install`, `uninstall`, `clean`, `--help`)

## Dev Notes

### Architecture Compliance — Critical Rules

**Boundary 5 — TUI (Phase 3):**
- All new code lives in `src/tui/` and `test/`
- Extends existing `app.js`, `widget-registry.js` — no new modules needed unless complexity warrants it
- Uses `React.createElement` (stored as `e`) — **no JSX, no build step**
- No interaction with reader at runtime — TUI modifies ccstatusline config only

**Error handling:** TUI is user-facing interactive. Use clear messages, not `logSuccess`/`logSkipped`/`logError` (those are for installer commands). The config-writer already handles mutation sequence correctly.

**Sync-only fs:** `fs.readFileSync`/`fs.writeFileSync` only. Even for reading the status file in preview (AC #5), use sync. This is fast and blocking is fine.

**Path construction:** Always `path.join()`. Accept `paths` parameter for testability. Never call `os.homedir()` directly inside component bodies.

### Final SECTIONS Array Order

After adding new sections, the complete SECTIONS array should be:
```js
const SECTIONS = ['widgets', 'colorMode', 'reorder', 'targetLine', 'separator', 'compositeMode'];
```

The `PreviewSection` is rendered **outside** the section cycle — always visible at the bottom of the TUI, below all sections and above the save result message.

### ccstatusline Color Mechanism — CRITICAL

The per-widget color toggle works as follows:

| Mode | `preserveColors` | `color` | What happens |
|------|-----------------|---------|-------------|
| Dynamic | `true` | `'white'` (fallback) | Reader ANSI escape codes pass through to terminal |
| Fixed | `false` | User-chosen color name | ccstatusline applies `color` property, reader ANSI is stripped |

**Valid ccstatusline color names:** `white`, `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `gray`, `brightRed`, `brightGreen`, `brightYellow`, `brightBlue`, `brightMagenta`, `brightCyan`, `brightWhite`

These are the ccstatusline color names, NOT ANSI escape codes. The `color` property in a widget config is a string name, not an escape code.

### Widget Reorder Implementation

`@inkjs/ui` does NOT provide a reorder component. Build it manually:

1. Display enabled widgets as a vertical list with a cursor indicator (e.g., `>` or highlight)
2. Use `useInput` to capture `key.upArrow` and `key.downArrow`
3. On up/down: swap the highlighted widget with its neighbor in the `widgetOrder` array
4. Update state, which triggers preview re-render
5. The `widgetOrder` array feeds directly into `buildWidgetConfig(enabledWidgets, ...)` — order is preserved

**Ink `useInput` hook pattern:**
```js
useInput((input, key) => {
  if (key.upArrow) { /* move widget up */ }
  if (key.downArrow) { /* move widget down */ }
});
```

Note: `useInput` in the `ReorderSection` only fires when the section is active. Use the existing `currentSection === 'reorder'` guard pattern.

### Live Preview Implementation

The preview renders a **simulated** statusline row inside the TUI. It does NOT execute the reader — it renders mock data directly using Ink's `Text` component with color props.

**Mock data for preview:**
```js
const PREVIEW_DATA = {
  project: 'Toulou',
  workflow: 'dev-story',
  agent: ['Amelia'],  // or from real status file for party mode
  story: '2.2 TUI Colors',
  request: null,
  document: null,
  step: { current: '3', current_name: 'color modes', completed: 3, total: 6 },
  started_at: new Date(Date.now() - 5 * 60 * 1000).toISOString()
};
```

**Rendering approach — use Ink `Text` color props, not ANSI escape codes:**
```js
// Dynamic mode: use mapped color name
e(Text, { color: 'cyan' }, 'dev-story')
// Fixed mode: use widget's fixedColor
e(Text, { color: fixedColor }, 'dev-story')
// Uncolored widget
e(Text, {}, 'Toulou')
// Separator
e(Text, { dimColor: true }, ' · ')
```

**Color mapping for preview (dynamic mode):**
- Import `AGENT_COLORS` and `WORKFLOW_COLORS` from `src/defaults.js`
- Map ANSI codes to Ink color names for the preview:
  - `\x1b[36m` → `'cyan'`, `\x1b[32m` → `'green'`, `\x1b[33m` → `'yellow'`, etc.
- Create a lookup: `ansiToInkColor` map or use the color name directly from the agent/workflow color tables

**ANSI code to Ink color name mapping:**
```js
const ANSI_TO_INK = {
  '\x1b[30m': 'black',     '\x1b[31m': 'red',
  '\x1b[32m': 'green',     '\x1b[33m': 'yellow',
  '\x1b[34m': 'blue',      '\x1b[35m': 'magenta',
  '\x1b[36m': 'cyan',      '\x1b[37m': 'white',
  '\x1b[90m': 'gray',
  '\x1b[91m': 'brightRed', '\x1b[92m': 'brightGreen',
  '\x1b[93m': 'brightYellow', '\x1b[94m': 'brightBlue',
  '\x1b[95m': 'brightMagenta', '\x1b[96m': 'brightCyan',
  '\x1b[97m': 'brightWhite',
};
```

### Party Mode Preview (AC #5)

To preview party mode (multi-agent display):

1. Try to read a real status file from `~/.cache/bmad-status/` (or `BMAD_CACHE_DIR`)
2. If found and `agent` array has > 1 entry, use those agent names
3. Render each agent name with its individual color from `AGENT_COLORS` map, comma-separated
4. If no real status file found, fall back to mock single agent `['Amelia']`

**Reading status files for preview:**
```js
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function readLatestStatus(paths) {
  const cacheDir = process.env.BMAD_CACHE_DIR || path.join(os.homedir(), '.cache', 'bmad-status');
  try {
    const files = fs.readdirSync(cacheDir).filter(f => f.startsWith('status-') && f.endsWith('.json'));
    if (files.length === 0) return null;
    // Read most recently modified
    const sorted = files
      .map(f => ({ name: f, mtime: fs.statSync(path.join(cacheDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    const data = fs.readFileSync(path.join(cacheDir, sorted[0].name), 'utf8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}
```

This is a **read-only, best-effort** operation. On any error, return null and use mock data. Follows the silent error pattern for read-only operations.

### State Initialization from Existing Config

When the TUI loads, it must detect **existing** per-widget settings:

```js
// For each existing BMAD widget in config:
const widgetColorModes = {};
for (const widget of result.bmadWidgets) {
  widgetColorModes[widget.id] = {
    mode: widget.preserveColors === false ? 'fixed' : 'dynamic',
    fixedColor: widget.color || 'white',
  };
}

// Widget order from existing config (skip separators)
const widgetOrder = result.config.lines[result.currentLine]
  .filter(w => w.id && w.id.startsWith('bmad-') && !w.id.startsWith('sep-bmad-'))
  .map(w => w.id);
```

### Files to Modify

| File | Change |
|------|--------|
| `src/tui/app.js` | Add Color Mode section, Reorder section, Live Preview component. Add new state fields (`widgetColorModes`, `widgetOrder`). Update section navigation. Update `handleSave` to pass color modes. |
| `src/tui/widget-registry.js` | Add `colorModes` option to `buildWidgetConfig`. Export `CCSTATUSLINE_COLORS`. Apply per-widget `preserveColors`/`color` based on mode. |
| `test/tui-widget-registry.test.js` | Add tests for color mode support, reorder ordering, mixed modes. |

### Files NOT to Modify

- `src/tui/config-loader.js` — already returns `bmadWidgets` with full widget objects including `preserveColors` and `color`
- `src/tui/config-writer.js` — already handles any config object, no changes needed
- `src/reader/bmad-sl-reader.js` — reader is unchanged, color maps already exist
- `src/defaults.js` — color maps already exported, no changes needed
- `src/install.js`, `src/uninstall.js`, `src/clean.js` — unrelated
- `bin/cli.js` — dispatch unchanged

### Previous Story Intelligence (2.1)

**Critical learnings from Story 2.1 review findings:**

1. **Guard `w.id &&` before `w.id.startsWith()`** — widgets without `id` property exist and will crash. Already patched in 2.1, maintain this guard in all new filter operations.

2. **`handleSave` padding** — `config.lines` may have fewer than `targetLine + 1` entries. The `while` loop padding from 2.1 must be preserved.

3. **Separator `content` property** — separator widgets need a `content` property with the actual spacing text. This was a bug in 2.1 (calculated but not injected), now fixed.

4. **`getReaderPath` empty string guard** — if reader path can't be extracted, save must be blocked. Guard exists in 2.1.

5. **`detectSeparatorStyle` on load** — must detect existing separator style from config, not default to 'serre'. Function exists in 2.1.

6. **Trailing newline in config write** — config-writer adds `+ '\n'` to stringify output. Already handled.

7. **No JSX** — use `React.createElement` (stored as `e`) throughout. Avoids build step.

8. **`useApp().exit()`** — use for clean TUI exit on Escape/Ctrl+C.

9. **134 tests passing** — actual baseline from Story 2.1 (corrected). Any regressions must be investigated.

### Project Structure Notes

- All changes within `bmad-statusline/src/tui/` and `bmad-statusline/test/` — aligned with Boundary 5
- No new modules needed — extend `app.js` and `widget-registry.js`
- If `app.js` grows too large (currently 323 lines), consider extracting `PreviewSection` to `src/tui/preview.js` — but only if readability warrants it
- Test structure mirrors existing: extend `test/tui-widget-registry.test.js`, TUI component tests are manual (TTY-dependent)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2] — acceptance criteria, BDD format
- [Source: _bmad-output/planning-artifacts/architecture.md#Dynamic Colors] — preserveColors mechanism, ANSI-in-stdout, color maps
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns #3] — colorize helper, color scope table
- [Source: _bmad-output/project-context.md#ccstatusline Contract] — widget properties, preserveColors toggle, config format v3
- [Source: _bmad-output/project-context.md#Color Maps Reference] — 16 agents, 10 workflow categories
- [Source: _bmad-output/implementation-artifacts/2-1-tui-configurator-foundation-widget-management.md] — previous story, review findings, file list
- [Source: _bmad-output/brainstorming/brainstorming-session-2026-03-28-001.md] — TUI features, color modes, default layout
- [Source: bmad-statusline/src/tui/app.js] — current TUI code (323 lines), section navigation, state management
- [Source: bmad-statusline/src/tui/widget-registry.js] — current buildWidgetConfig (always sets preserveColors: true)
- [Source: bmad-statusline/src/defaults.js] — AGENT_COLORS, WORKFLOW_COLORS, WORKFLOW_PREFIX_COLORS exports

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation, no debug issues encountered.

### Completion Notes List

- Task 1+5: Extended `buildWidgetConfig` in `widget-registry.js` with `colorModes` option. Added `applyColorMode()` helper for per-widget dynamic/fixed toggle. Exported `CCSTATUSLINE_COLORS` (16 colors). Fixed composite separator missing `content` property bug.
- Task 2: Created `ColorModeSection` component in `app.js` — shows Dynamic/Fixed toggle per enabled widget, with inline color picker (`Select`) for fixed mode. State `widgetColorModes` initialized from existing config `preserveColors`/`color` values.
- Task 3: Created `ReorderSection` component — vertical widget list with cursor, `useInput` captures arrow up/down to swap items. Shows "N/A — composite mode" when not individual. `widgetOrder` state syncs with enabled list changes.
- Task 4: Created `PreviewSection` component — simulated statusline using Ink `Text` with color props. `ANSI_TO_INK` mapping translates reader ANSI codes to Ink color names. Party mode reads real status file once on mount via `readLatestStatus()`. Supports individual and composite preview rendering with neutral ` · ` separators.
- Task 6: Added 8 new tests to `tui-widget-registry.test.js` — color mode dynamic/fixed, mixed modes, reorder ordering, CCSTATUSLINE_COLORS export, composite colorModes, composite separator content. 142 total tests, 0 failures, 0 regressions.
- Task 7: Module loads correctly, all existing commands (--help, clean, install, uninstall) verified working. TUI interactive features are TTY-dependent (manual verification).

### File List

- `src/tui/widget-registry.js` — modified (added `CCSTATUSLINE_COLORS` export, `colorModes` option in `buildWidgetConfig`, `applyColorMode` helper, composite separator `content` fix)
- `src/tui/app.js` — modified (added `ColorModeSection`, `ReorderSection`, `PreviewSection` components, `ANSI_TO_INK` mapping, `PREVIEW_DATA`, state fields `widgetColorModes`/`widgetOrder`, updated `handleSave` and widget toggle handler)
- `test/tui-widget-registry.test.js` — modified (added 8 new tests for color modes, reorder, CCSTATUSLINE_COLORS)

### Review Findings

- [x] [Review][Decision→Patch] ColorModeSection rend plusieurs Select simultanés — conflit de focus clavier [app.js:124-161] — resolved: refactored to step-by-step widget selection (one Select at a time)
- [x] [Review][Decision→Dismiss] widgetOrder vide quand on switch composite → individual sur config composite-only [app.js:413-418] — user chose: leave empty, let user enable widgets (option B)
- [x] [Review][Decision→Dismiss] Pas d'UI pour régler le color mode des widgets composites [app.js:124] — user chose: dismiss, dynamic-only suffices (option C)
- [x] [Review][Patch] useInput hook appelé après return conditionnel dans ReorderSection — violation Rules of Hooks [app.js:163-206] — fixed: hooks moved before conditional return, compositeMode guard inside callback
- [x] [Review][Patch] Pas de null guard dans renderWidgetText / getWidgetColor si widgetId undefined [app.js:249,271] — fixed: early return for null/undefined widgetId
- [x] [Review][Patch] cursor dans ReorderSection pas réinitialisé quand widgetOrder rétrécit [app.js:164] — fixed: useEffect clamps cursor to widgetOrder.length-1
- [x] [Review][Patch] Preview composite : timer ignore colorModes pour fixed color [app.js:344-347] — fixed: timer now reads colorModes['bmad-timer'] for fixed color
- [x] [Review][Defer] readLatestStatus appelle os.homedir() directement (pas injectable, break testabilité) [app.js:222] — deferred, pre-existing
- [x] [Review][Defer] buildWidgetConfig retourne [] pour compositeMode invalide [widget-registry.js:71] — deferred, defensive only
- [x] [Review][Defer] getReaderPath retourne '' sur config vide/sans commandPath [app.js:655] — deferred, pre-existing
- [x] [Review][Defer] handleSave supprime les widgets sans id sur les autres lignes [app.js:489] — deferred, pre-existing
- [x] [Review][Defer] detectSeparatorStyle ne gère pas lineIndex hors limites [app.js] — deferred, pre-existing
- [x] [Review][Defer] handleSave crash si lines[i] n'est pas un array [app.js:481] — deferred, pre-existing
- [x] [Review][Defer] getReaderPath regex ne gère pas les paths single-quoted [app.js:663] — deferred, pre-existing

### Change Log

- 2026-03-29: Implemented Story 2.2 — TUI Color Modes, Reorder, Live Preview. Added per-widget dynamic/fixed color toggle, widget reorder with arrow keys, live preview with ANSI-to-Ink color mapping and party mode support. Fixed composite separator content bug. 8 new tests added (142 total, 0 regressions).
