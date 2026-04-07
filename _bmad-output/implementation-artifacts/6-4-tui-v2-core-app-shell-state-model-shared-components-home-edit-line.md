# Story 6.4: TUI v2 Core — App shell, state model, shared components, Home + Edit Line

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer launching the TUI**,
I want **to see a 3-line preview at the top of every screen, navigate a flat Home menu with 6 options, and edit widgets per line with inline hide/show and grab-reorder shortcuts**,
So that **I can configure my multi-line statusline layout intuitively with instant visual feedback and no navigation confusion**.

## Acceptance Criteria

1. **Given** the developer runs `npx bmad-statusline` (no args)
   **When** the TUI launches
   **Then** `config-loader` loads the internal config (v2, migrated, or defaults — from 6.3)
   **And** a snapshot is captured via `useState` initializer (`structuredClone(initialConfig)`) — immutable for the session
   **And** the Home screen displays with the 3-line boxed preview at the top and 6 menu options below

2. **Given** the Home screen is displayed
   **When** the user sees the menu
   **Then** 6 options are shown: `Edit widget line 1`, `Edit widget line 2`, `Edit widget line 3`, `Reorder lines`, `Separator style`, `Reset to original`
   **And** the shortcut bar shows `↑↓ Navigate  Enter Select  q Quit`
   **And** the breadcrumb shows `Home`

3. **Given** the ThreeLinePreview component renders
   **When** it receives the config (or previewOverride if non-null)
   **Then** it displays a boxed frame with "Preview" label, 3 lines inside showing composed widget output per line
   **And** each widget is colored via `resolvePreviewColor()` from preview-utils.js (pattern 19)
   **And** widgets are joined with the configured separator
   **And** empty lines show blank inside the frame
   **And** ANSI colors render correctly via Ink `<Text color={...}>` — not escape codes (BF3 fix)

4. **Given** the user selects "Edit widget line 1" from Home
   **When** the Edit Line screen opens
   **Then** the breadcrumb shows `Home > Edit Line 1`
   **And** all 9 widgets from `INDIVIDUAL_WIDGETS` are listed (not just configured ones — BF1 fix)
   **And** each widget shows inline status: `Name  ■ visible  cyan` or `Name  □ hidden  brightBlack`
   **And** visible widgets appear in their config order, followed by hidden widgets
   **And** the shortcut bar shows `↑↓ Navigate  h Hide/Show  g Grab to reorder  c Color  s Save preset  l Load preset  Esc Back`

5. **Given** the user presses `h` on a visible widget in Edit Line
   **When** the toggle is processed
   **Then** the widget is removed from `config.lines[N].widgets` via `updateConfig(mutator)` (pattern 15)
   **And** its `colorModes` entry is preserved (not deleted — preserves color across hide/show cycles)
   **And** the preview updates in the same render cycle (FR-V2-9)
   **And** the inline status changes to `□ hidden`

6. **Given** the user presses `h` on a hidden widget
   **When** the toggle is processed
   **Then** the widget is added to `config.lines[N].widgets` with its preserved colorModes (or default color if first time)
   **And** the preview and inline status update instantly

7. **Given** the user presses `g` on a widget in Edit Line
   **When** grab mode activates
   **Then** the shortcut bar changes to `↑↓ Move  Enter Drop  Esc Cancel`
   **And** the grabbed widget shows a `← moving` marker
   **And** arrow keys swap the widget position with adjacent widgets in the `widgets` array
   **And** the preview updates live during reorder
   **And** Enter drops the widget at current position (persisted via `updateConfig`)
   **And** Escape cancels and restores original order

8. **Given** the user presses `c`, `s`, or `l` in Edit Line
   **When** the navigation processes the shortcut
   **Then** `navigate('colorPicker', { selectedWidget })`, `navigate('presetSave')`, or `navigate('presetLoad')` is called
   **And** the screen routing in app.js dispatches to the corresponding screen (implemented in 6.5)

9. **Given** the user selects "Reset to original" from Home
   **When** the reset executes
   **Then** `setConfig(structuredClone(snapshot))` restores the launch config atomically
   **And** `writeInternalConfig(restored)` persists to disk
   **And** `syncCcstatuslineFromScratch(restored)` rebuilds ccstatusline widgets
   **And** `previewOverride` is cleared
   **And** no render loop occurs (BF2 fix — no `useEffect` reads config and writes config)
   **And** the user remains on Home with the restored preview

10. **Given** Escape is pressed on any screen except Home
    **When** `goBack()` is called
    **Then** `previewOverride` is cleared, navStack is popped, previous screen is restored

11. **Given** `q` is pressed on the Home screen
    **When** the TUI processes the key
    **Then** the TUI exits cleanly to terminal

12. **Given** the Separator Style screen is accessed from Home
    **When** the user navigates to it
    **Then** the existing separator style screen (from v1) is rendered within the new ScreenLayout wrapper
    **And** preview-on-highlight works via `previewOverride` (pattern 17)

13. **Given** tests need to validate the changes
    **When** tests are executed
    **Then** `tui-app.test.js` is updated: tests for multi-line state initialization, `updateConfig` produces correct shape, `resetToOriginal` matches snapshot, navigation push/pop, `previewOverride` cleared on goBack
    **And** `tui-components.test.js` is created: ThreeLinePreview renders 3 lines with correct colors, empty line handling, ReorderList navigate/grab/drop modes
    **And** all existing tests pass (`npm test`)

## Tasks / Subtasks

- [x] Task 1: Rewrite app.js with v2 state model (AC: #1, #9, #10, #11)
  - [x]1.1 Replace `tuiState`/`snapshot` with v2 state: `config` (useState), `snapshot` (useState initializer with `structuredClone`), `previewOverride` (useState null), `editingLine` (useState null), `selectedWidget` (useState null)
  - [x]1.2 Implement `updateConfig(mutator)` helper per pattern 15: `structuredClone(prev)` -> `mutator(next)` -> `writeInternalConfig(next, paths)` -> `syncCcstatuslineIfNeeded(prev, next, paths)` -> `return next`
  - [x]1.3 Implement `resetToOriginal()`: `setConfig(structuredClone(snapshot))` -> `writeInternalConfig` -> `syncCcstatuslineFromScratch` -> `setPreviewOverride(null)`
  - [x]1.4 Update `navigate(screenName, context)` to set `editingLine` and `selectedWidget` from context
  - [x]1.5 Update `goBack()` to clear `previewOverride` on every back navigation
  - [x]1.6 Remove `deriveTuiState`, `onConfigChange`, `presets` state, `KNOWN_SEPARATORS`, `FallbackScreen` — all dead code
  - [x]1.7 Remove `useEffect` for config loading — load synchronously in `useState` initializer instead (BF2 prevention)

- [x] Task 2: Implement screen routing in app.js (AC: #1, #4, #8, #12)
  - [x]2.1 Route `home` -> HomeScreen, `editLine` -> EditLineScreen, `colorPicker` -> ColorPickerScreen, `separator` -> SeparatorStyleScreen, `presetSave` / `presetLoad` / `reorderLines` -> FallbackScreen (placeholder until 6.5)
  - [x]2.2 Pass standard screen props to all screens per pattern 18: `config`, `updateConfig`, `previewOverride`, `setPreviewOverride`, `navigate`, `goBack`, `editingLine`, `selectedWidget`. Also pass `isActive: !statusMessage` to control `useInput` activation on each screen.
  - [x]2.4 For ColorPickerScreen routing: resolve `widgetName` from `getIndividualWidgets().find(w => w.id === selectedWidget)?.name` in the router, pass as prop alongside standard props
  - [x]2.5 Preserve statusMessage overlay pattern from v1: `statusMessage` state, `useInput` dismissal on any keypress, `StatusMessage` component renders above current screen when active
  - [x]2.3 Export `App` and `launchTui` (preserve existing entry point contract)

- [x] Task 3: Create ThreeLinePreview component (AC: #3)
  - [x]3.1 Create `src/tui/components/ThreeLinePreview.js`
  - [x]3.2 Accept `config` prop (the effective config = `previewOverride || config`)
  - [x]3.3 Render a `<Box borderStyle="round" borderColor="dim">` with "Preview" Text label above
  - [x]3.4 For each of 3 lines: map `config.lines[i].widgets` to `<Text color={resolvePreviewColor(id, colorModes)}>` segments with `SAMPLE_VALUES[id]` as text
  - [x]3.5 Join widget segments with separator resolved from `SEPARATOR_MAP[config.separator]` (or `config.customSeparator` if custom)
  - [x]3.6 Empty lines (no widgets) render as blank inside the frame

- [x] Task 4: Update ScreenLayout to use ThreeLinePreview (AC: #3)
  - [x]4.1 Replace `title` prop with ThreeLinePreview — remove the `title` text element
  - [x]4.2 Props: `breadcrumb`, `config` (for preview), `previewOverride` (optional), `shortcuts`, `children`
  - [x]4.3 Layout order: Breadcrumb -> empty line -> "Preview" label + boxed frame -> empty line -> children -> empty line -> ShortcutBar
  - [x]4.4 Pass `previewOverride || config` to ThreeLinePreview

- [x] Task 5: Rewrite HomeScreen for v2 (AC: #2)
  - [x]5.1 Replace 6 menu options with v2: `📝 Edit widget line 1`, `📝 Edit widget line 2`, `📝 Edit widget line 3`, `🔀 Reorder lines`, `✦ Separator style`, `↩ Reset to original`
  - [x]5.2 Map `editLine1/2/3` selections to `navigate('editLine', { editingLine: 0/1/2 })`
  - [x]5.3 Map `reset` to direct `resetToOriginal()` call (not a screen navigation)
  - [x]5.4 Props: standard screen props (pattern 18) + `onQuit`

- [x] Task 6: Create EditLineScreen (AC: #4, #5, #6, #7, #8)
  - [x]6.1 Create `src/tui/screens/EditLineScreen.js`
  - [x]6.2 Build widget list: all 9 from `getIndividualWidgets()`, visible first (in config order), then hidden — BF1 fix
  - [x]6.3 Render each widget with inline status: `Name  ■ visible  colorName` or `Name  □ hidden  brightBlack`
  - [x]6.4 Implement `h` shortcut — toggle visibility: remove from/add to `config.lines[editingLine].widgets` via `updateConfig`. Preserve `colorModes` entry on hide. Use default color on first-time show.
  - [x]6.5 Implement `g` shortcut — activate grab mode for visible widgets only (no-op on hidden widgets). Reuse the existing `ReorderList` component from `components/ReorderList.js` — pass visible widget list as `items`, wire `onDrop` to `updateConfig`, `onCancel` to revert, `onMove` to live preview update. Do NOT reimplement grab/move/drop logic from scratch.
  - [x]6.6 Implement `c` shortcut — `navigate('colorPicker', { selectedWidget: currentWidgetId })`
  - [x]6.7 Implement `s` shortcut — `navigate('presetSave')` (screen implemented in 6.5)
  - [x]6.8 Implement `l` shortcut — `navigate('presetLoad')` (screen implemented in 6.5)
  - [x]6.9 Breadcrumb: `['Home', 'Edit Line N']` where N = editingLine + 1

- [x] Task 7: Adapt existing screens for v2 props (AC: #12)
  - [x]7.1 Update SeparatorStyleScreen: replace `tuiState`/`onConfigChange` with v2 props (`config`, `updateConfig`, `previewOverride`, `setPreviewOverride`, `goBack`, `isActive`). Replace `onConfigChange({separator: v})` with `updateConfig(cfg => { cfg.separator = v; cfg.customSeparator = null; })`. Replace `onConfigChange({separator:'custom', customSeparator:v})` with `updateConfig(cfg => { cfg.separator = 'custom'; cfg.customSeparator = v; })`. Replace local `previewTuiState` with `setPreviewOverride`. Update `getCurrentSeparatorContent` to read from `config` not `tuiState`. Keep the dual-mode `select`/`textInput` pattern and `SelectWithPreview` usage.
  - [x]7.2 Update ColorPickerScreen: replace `tuiState`/`onConfigChange` with v2 props. Add `Dynamic` option for `bmad-workflow` only. Use `setPreviewOverride` for highlight (builds full config clone with temporary color on `config.lines[editingLine].colorModes[widgetId]`). On Enter: `updateConfig` + `goBack()`. On Escape: `goBack()`. Breadcrumb: `['Home', 'Edit Line N', 'Color: WidgetName']`. Keep `SelectWithPreview` usage.
  - [x]7.3 Pass `config` and `previewOverride` to ScreenLayout in both screens (ScreenLayout computes effective config internally)

- [x] Task 8: Update tests (AC: #13)
  - [x]8.1 Rewrite `tui-app.test.js`: test v2 state init (config + snapshot), updateConfig shape, resetToOriginal restores snapshot, navigation push/pop, previewOverride cleared on goBack, Home renders 6 v2 options
  - [x]8.2 Add ThreeLinePreview tests to `tui-components.test.js`: renders 3 lines with correct colors, empty line blank, separator rendering, custom separator
  - [x]8.3 Update existing component tests if props changed (ScreenLayout no longer has `title` prop)
  - [x]8.4 Run full `npm test` — all 315+ tests must pass

## Dev Notes

### Architecture Compliance

**Stack — use ONLY these:**
- Node.js >= 20, plain JavaScript ESM (NO TypeScript, NO JSX, NO build step)
- `ink` v6.8.0, `react` v19.2.4, `@inkjs/ui` v2.0.0
- `React.createElement` everywhere — alias as `const e = React.createElement`
- Testing: `node:test` + `node:assert/strict` + `ink-testing-library`

**Critical patterns to follow:**

- **Pattern 1** — Error Handling: TUI uses StatusMessage, never console.log. Config reads fall back to defaults silently.
- **Pattern 2** — Synchronous File I/O everywhere. No async, no promises, no callbacks for file operations.
- **Pattern 3** — ANSI: `<Text color={...}>` in TUI. Never inline escape codes in React components.
- **Pattern 14** — Internal Config I/O: `writeInternalConfig` — no backup, no validate. Corrupted falls back to defaults. `JSON.stringify(config, null, 2) + '\n'`.
- **Pattern 15** — TUI State Mutation (CRITICAL): `updateConfig(mutator)` — `structuredClone(prev)` -> mutator(next) -> writeInternalConfig(next) -> syncCcstatuslineIfNeeded(prev, next) -> return next. **NEVER mutate config directly. NEVER use spread operator for deep copy. NEVER write config in a useEffect.**
- **Pattern 16** — ccstatusline Sync: Only on line occupancy changes (empty↔non-empty). `syncCcstatuslineIfNeeded` for incremental, `syncCcstatuslineFromScratch` for reset.
- **Pattern 17** — Preview Override: `previewOverride` is transient React state, never written to disk. Cleared in `goBack()`. Screens that use it: Color Picker, Separator Style. Screens that don't: Home, Edit Line.
- **Pattern 18** — Screen Props Contract: Every screen receives `{ config, updateConfig, previewOverride, setPreviewOverride, navigate, goBack, editingLine, selectedWidget, isActive }`. `isActive` controls `useInput` activation (false when statusMessage overlay is shown). Screens never call `setConfig` directly.
- **Pattern 19** — Color Resolution: Use `resolvePreviewColor(widgetId, colorModes)` from `preview-utils.js`. Never duplicate this logic.

### Bug Fixes Incorporated in This Story

**BF1: Hidden-by-default widgets cannot be shown**
- Root cause (v1): Widget list derived from ccstatusline config which only has enabled widgets. Widgets with `defaultEnabled: false` never appear.
- Fix: Edit Line always renders all 9 widgets from `INDIVIDUAL_WIDGETS`. Visibility = presence in `config.lines[N].widgets`. Widget list source is the static registry, not the config.

**BF2: Reset to original causes infinite render loop**
- Root cause (v1): `resetToOriginal()` -> `setTuiState(snapshot)` -> useEffect depends on tuiState -> calls `saveConfig()` -> calls `setTuiState()` -> infinite loop.
- Fix: No useEffect that reads `config` and writes `config`. Config loaded synchronously in useState initializer. Writes happen inside `updateConfig` or `resetToOriginal`, never in effects. Snapshot captured once via useState initializer.

**BF3: Preview shows no colors**
- Root cause (v1): Color values not mapped correctly to Ink `<Text color>` props.
- Fix: ThreeLinePreview renders each widget as `<Text color={resolvedColor}>{value}</Text>`. Color from `resolvePreviewColor()`. No ANSI escape codes in React.

### v2 State Model Specification

Replace the entire v1 state model. Current `tuiState` object with `visibleWidgets`, `widgetOrder`, `colorModes`, `separator`, `targetLine`, `rawConfig` is **deleted**.

```js
// v2 state — in App component
const [config, setConfig] = useState(() => loadConfig(paths));           // v2 internal config
const [snapshot] = useState(() => structuredClone(config));              // immutable launch snapshot
const [previewOverride, setPreviewOverride] = useState(null);           // transient preview
const [screen, setScreen] = useState('home');                           // current screen
const [navStack, setNavStack] = useState([]);                           // navigation history
const [editingLine, setEditingLine] = useState(null);                   // 0|1|2|null
const [selectedWidget, setSelectedWidget] = useState(null);             // widget ID|null
const [statusMessage, setStatusMessage] = useState(null);               // error display

// updateConfig helper — pattern 15
function updateConfig(mutator) {
  setConfig(prev => {
    const next = structuredClone(prev);
    mutator(next);
    writeInternalConfig(next, paths);
    syncCcstatuslineIfNeeded(prev, next, paths);
    return next;
  });
}

// resetToOriginal — BF2-safe
function resetToOriginal() {
  const restored = structuredClone(snapshot);
  setConfig(restored);
  writeInternalConfig(restored, paths);
  syncCcstatuslineFromScratch(restored, paths);
  setPreviewOverride(null);
}

// navigate — sets context vars
function navigate(screenName, context = {}) {
  setNavStack(prev => [...prev, screen]);
  setScreen(screenName);
  if (context.editingLine !== undefined) setEditingLine(context.editingLine);
  if (context.selectedWidget !== undefined) setSelectedWidget(context.selectedWidget);
}

// goBack — always clears previewOverride
function goBack() {
  setPreviewOverride(null);
  if (navStack.length > 0) {
    setScreen(navStack[navStack.length - 1]);
    setNavStack(prev => prev.slice(0, -1));
  }
}
```

**Key difference from v1:** No `useEffect` for loading config. Config loaded synchronously in `useState` initializer. `loadConfig(paths)` is a synchronous function (pattern 2). This eliminates the loading state and prevents BF2.

### Screen Routing Map

```
screen === 'home'         -> HomeScreen
screen === 'editLine'     -> EditLineScreen
screen === 'colorPicker'  -> ColorPickerScreen
screen === 'separator'    -> SeparatorStyleScreen
screen === 'presetSave'   -> FallbackScreen (placeholder until 6.5)
screen === 'presetLoad'   -> FallbackScreen (placeholder until 6.5)
screen === 'reorderLines' -> FallbackScreen (placeholder until 6.5)
```

### HomeScreen v2 Options

```js
const HOME_OPTIONS = [
  { label: '📝 Edit widget line 1', value: 'editLine1' },
  { label: '📝 Edit widget line 2', value: 'editLine2' },
  { label: '📝 Edit widget line 3', value: 'editLine3' },
  { label: '🔀 Reorder lines',      value: 'reorderLines' },
  { label: '✦  Separator style',    value: 'separator' },
  { label: '↩  Reset to original',  value: 'reset' },
];
```

Handle `editLine1/2/3` -> `navigate('editLine', { editingLine: 0/1/2 })`. Handle `reset` -> `resetToOriginal()` directly.

### ThreeLinePreview Component Specification

```js
// ThreeLinePreview.js — Renders 3-line boxed preview with ANSI colors
// Props: { config } — the effective config (previewOverride || config)

function ThreeLinePreview({ config }) {
  const separator = config.separator === 'custom' && config.customSeparator
    ? config.customSeparator
    : (SEPARATOR_MAP[config.separator] || SEPARATOR_MAP.serre);

  return e(Box, { flexDirection: 'column' },
    e(Text, null, 'Preview'),
    e(Box, { borderStyle: 'round', borderColor: 'dim', flexDirection: 'column' },
      ...config.lines.map((line, i) => renderLine(line, separator, i))
    )
  );
}

function renderLine(line, separator, lineIndex) {
  if (!line.widgets || line.widgets.length === 0) {
    return e(Text, { key: lineIndex }, ' ');  // blank line inside frame
  }
  // Build segments: <Text color={color}>{sampleValue}</Text> joined by separator
  const segments = [];
  for (const widgetId of line.widgets) {
    const value = SAMPLE_VALUES[widgetId];
    if (!value) continue;
    const color = resolvePreviewColor(widgetId, line.colorModes);
    if (segments.length > 0) segments.push(e(Text, { key: `sep-${widgetId}` }, separator));
    segments.push(e(Text, { key: widgetId, color }, value));
  }
  return e(Text, { key: lineIndex }, ...segments);
}
```

Import from `preview-utils.js`: `SAMPLE_VALUES`, `SEPARATOR_MAP`, `resolvePreviewColor`.

### EditLineScreen Component Specification

Two modes: `navigate` (default) and `grab` (after pressing `g`).

**Widget list construction (BF1 fix):**
```js
const allWidgets = getIndividualWidgets(); // all 9
const lineWidgets = config.lines[editingLine].widgets;
const visible = lineWidgets.map(id => allWidgets.find(w => w.id === id)).filter(Boolean);
const hidden = allWidgets.filter(w => !lineWidgets.includes(w.id));
const widgetList = [...visible, ...hidden]; // visible first, then hidden
```

**Inline status rendering per widget:**
```js
const isVisible = lineWidgets.includes(widget.id);
const colorMode = config.lines[editingLine].colorModes[widget.id];
const colorName = colorMode?.mode === 'dynamic' ? 'dynamic' : (colorMode?.fixedColor || widget.defaultColor);
// Format: "Project        ■ visible   cyan"  or  "Step           □ hidden    yellow"
```

**h shortcut — toggle visibility:**
```js
updateConfig(cfg => {
  const line = cfg.lines[editingLine];
  const idx = line.widgets.indexOf(widgetId);
  if (idx >= 0) {
    line.widgets.splice(idx, 1);          // hide: remove from widgets (keep colorModes!)
  } else {
    line.widgets.push(widgetId);          // show: add to end
    if (!line.colorModes[widgetId]) {     // first time: set default color
      const widget = allWidgets.find(w => w.id === widgetId);
      line.colorModes[widgetId] = widget.defaultMode === 'dynamic'
        ? { mode: 'dynamic' }
        : { mode: 'fixed', fixedColor: widget.defaultColor };
    }
  }
});
```

**g shortcut — grab/reorder (only visible widgets):**
- **No-op if cursor is on a hidden widget** — grab only applies to visible widgets in the top section of the list.
- Reuse the existing `ReorderList` component (`src/tui/components/ReorderList.js`). Pass visible widgets as `items` (with `id` and `label` props). Wire callbacks:
  - `onMove(newOrder)` — live preview update (optional, for visual feedback)
  - `onDrop(newOrder)` — `updateConfig(cfg => { cfg.lines[editingLine].widgets = newOrder; })`
  - `onCancel()` — revert to pre-grab order, no config write
  - `onBack()` — exit grab mode (Escape in navigate mode = goBack to Home)
- Do NOT reimplement grab/move/drop logic. ReorderList already handles dual-mode (navigate/moving), arrow swap, Enter drop, Escape cancel.

**c/s/l shortcuts:**
```js
if (input === 'c' && currentWidget) navigate('colorPicker', { selectedWidget: currentWidget.id });
if (input === 's') navigate('presetSave');
if (input === 'l') navigate('presetLoad');
```

### ScreenLayout v2 Changes

Current ScreenLayout has a `title` prop and passes `tuiState`. Change to:

```js
export function ScreenLayout({ breadcrumb, config, previewOverride, shortcuts, children }) {
  const effectiveConfig = previewOverride || config;
  return e(Box, { flexDirection: 'column' },
    e(Breadcrumb, { path: breadcrumb }),
    e(Text, null, ' '),
    e(ThreeLinePreview, { config: effectiveConfig }),
    e(Text, null, ' '),
    children,
    e(Text, null, ' '),
    e(ShortcutBar, { actions: shortcuts }),
  );
}
```

**Breaking change:** `tuiState` prop removed, replaced by `config` + `previewOverride`. `title` prop removed. All screen callers must be updated.

### SeparatorStyleScreen v2 Adaptation

Replace `tuiState` prop with `config`. Replace `onConfigChange` with `updateConfig` + `setPreviewOverride`. Keep the dual-mode `select`/`textInput` pattern and `SelectWithPreview` component.

```js
// On highlight (select mode):
setPreviewOverride(() => {
  const preview = structuredClone(config);
  preview.separator = value;
  return preview;
});

// On select (named separator):
updateConfig(cfg => {
  cfg.separator = value;
  cfg.customSeparator = null;
});
setPreviewOverride(null);

// On select 'custom': switch to textInput mode (same as current behavior)

// On custom separator submit:
updateConfig(cfg => {
  cfg.separator = 'custom';
  cfg.customSeparator = value;
});
setPreviewOverride(null);

// getCurrentSeparatorContent: read from `config.separator` / `config.customSeparator` (not tuiState)

// On back / Escape:
goBack();  // clears previewOverride automatically
```

### ColorPickerScreen v2 Adaptation

Replace `tuiState`/`onConfigChange` with v2 props. Add Dynamic option for `bmad-workflow`.

```js
// Build options: Dynamic first (only for bmad-workflow), then 14 ANSI colors
const isWorkflow = widgetId === 'bmad-workflow';
const options = isWorkflow
  ? [{ label: 'Dynamic', value: 'dynamic' }, ...COLOR_OPTIONS]
  : COLOR_OPTIONS;

// On highlight:
setPreviewOverride(() => {
  const preview = structuredClone(config);
  preview.lines[editingLine].colorModes[widgetId] = value === 'dynamic'
    ? { mode: 'dynamic' }
    : { mode: 'fixed', fixedColor: value };
  return preview;
});

// On select:
updateConfig(cfg => {
  cfg.lines[editingLine].colorModes[widgetId] = value === 'dynamic'
    ? { mode: 'dynamic' }
    : { mode: 'fixed', fixedColor: value };
});
setPreviewOverride(null);
goBack();
```

Breadcrumb: `['Home', 'Edit Line N', 'Color: WidgetName']`.

### Navigation Model

```
Screen tree (max depth 2):
home
├── editLine(editingLine: 0|1|2)
│   ├── colorPicker(selectedWidget)  ← implemented
│   ├── presetSave                   ← placeholder (6.5)
│   └── presetLoad                   ← placeholder (6.5)
├── reorderLines                     ← placeholder (6.5)
└── separator                        ← implemented
```

### Existing Files to Modify

| File | Action |
|------|--------|
| `src/tui/app.js` | **REWRITE** — v2 state model, screen routing, updateConfig, navigation |
| `src/tui/components/ScreenLayout.js` | **MODIFY** — replace `title`/`tuiState` with ThreeLinePreview + `config`/`previewOverride` |
| `src/tui/screens/HomeScreen.js` | **REWRITE** — v2 menu options, v2 props |
| `src/tui/screens/SeparatorStyleScreen.js` | **MODIFY** — v2 props (config/updateConfig/setPreviewOverride/goBack) |
| `src/tui/screens/ColorPickerScreen.js` | **MODIFY** — v2 props, Dynamic option, editingLine-aware colorModes |
| `test/tui-app.test.js` | **REWRITE** — v2 state model tests |
| `test/tui-components.test.js` | **MODIFY** — add ThreeLinePreview tests, update ScreenLayout tests |

### New Files to Create

| File | Purpose |
|------|---------|
| `src/tui/components/ThreeLinePreview.js` | 3-line boxed preview with ANSI colors |
| `src/tui/screens/EditLineScreen.js` | Per-line widget list with h/g/c/s/l shortcuts |

### Files NOT to Touch

- `src/tui/config-loader.js` — no changes needed (v2 API from 6.3)
- `src/tui/config-writer.js` — no changes needed (v2 API from 6.3)
- `src/tui/widget-registry.js` — no changes needed (v2 from 6.1)
- `src/tui/preview-utils.js` — no changes needed (created in 6.1)
- `src/tui/components/Breadcrumb.js` — no changes needed
- `src/tui/components/ShortcutBar.js` — no changes needed
- `src/tui/components/ReorderList.js` — no changes needed (will be used in EditLineScreen's grab mode and in 6.5's ReorderLinesScreen)
- `src/tui/components/ConfirmDialog.js` — no changes needed
- `src/tui/components/SelectWithPreview.js` — still used by SeparatorStyleScreen and ColorPickerScreen after v2 adaptation. Keep as-is.

### Deferred Review Findings from 6.3 to Address

- **[Defer→Fix] onConfigChange writes stale rawConfig clone to disk [app.js:85-92]** — Fixed by deleting onConfigChange entirely, replaced by `updateConfig(mutator)`.
- **[Defer→Fix] writeInternalConfig silently swallows errors; app.js catch blocks are dead code [config-writer.js:27-36, app.js:91-95]** — Fixed by removing try/catch around writeInternalConfig calls in app.js. Pattern 14 mandates silent failure in writeInternalConfig itself.
- **[Defer→Fix] deriveTuiState expects v1 array format for config.lines — incompatible with v2 [from 6.1 review]** — Fixed by deleting deriveTuiState entirely.

### Internal Config Schema (Reference)

```json
{
  "separator": "serre",
  "customSeparator": null,
  "lines": [
    {
      "widgets": ["bmad-project", "bmad-workflow", "bmad-progressstep", "bmad-story", "bmad-timer"],
      "colorModes": {
        "bmad-project": { "mode": "fixed", "fixedColor": "cyan" },
        "bmad-workflow": { "mode": "dynamic" },
        "bmad-progressstep": { "mode": "fixed", "fixedColor": "brightCyan" },
        "bmad-story": { "mode": "fixed", "fixedColor": "magenta" },
        "bmad-timer": { "mode": "fixed", "fixedColor": "brightBlack" }
      }
    },
    { "widgets": [], "colorModes": {} },
    { "widgets": [], "colorModes": {} }
  ],
  "presets": [null, null, null]
}
```

Schema rules:
- `separator`: `"serre"` | `"modere"` | `"large"` | `"custom"`. Global, all lines.
- `lines`: always length 3. `widgets` = visible, ordered. `colorModes` = all configured (including hidden).
- `colorModes[id].mode`: `"dynamic"` (only `bmad-workflow`) or `"fixed"` with `fixedColor`.
- `presets`: always length 3. Each null or `{ name, widgets, colorModes }`.

### Dependencies from Stories 6.1-6.3

Already implemented and available:
- `createDefaultConfig()` from `widget-registry.js`
- `getIndividualWidgets()` from `widget-registry.js` — 9 widgets with id, name, defaultEnabled, defaultColor, defaultMode
- `SAMPLE_VALUES`, `SEPARATOR_MAP`, `WORKFLOW_SAMPLE_COLOR`, `resolvePreviewColor()` from `preview-utils.js`
- `loadConfig(paths)` from `config-loader.js` — returns v2 config object directly (synchronous)
- `writeInternalConfig(config, paths)` from `config-writer.js` — pattern 14
- `syncCcstatuslineIfNeeded(oldConfig, newConfig, paths)` from `config-writer.js` — pattern 16
- `syncCcstatuslineFromScratch(config, paths)` from `config-writer.js` — full rebuild

### Constraints

1. **No useEffect for config loading** — load synchronously in useState initializer (BF2 prevention)
2. **No useEffect that reads and writes config** — all writes in updateConfig or resetToOriginal
3. **structuredClone for all deep copies** — never spread operator
4. **Snapshot immutable** — captured once at mount, never updated
5. **previewOverride cleared in goBack()** — always, no exceptions
6. **All 9 widgets in Edit Line** — not just configured ones (BF1 fix)
7. **colorModes preserved on hide** — remove from widgets array, keep colorModes entry
8. **Separator style screen must still work** — existing functionality preserved through v2 props adaptation
9. **TUI partially non-functional for 6.5 screens** — presetSave, presetLoad, reorderLines route to FallbackScreen. This is expected.

### Project Structure Notes

- Source files in `bmad-statusline/src/tui/` (ESM, `const e = React.createElement` convention)
- Components in `bmad-statusline/src/tui/components/`
- Screens in `bmad-statusline/src/tui/screens/`
- Tests in `bmad-statusline/test/` with `tui-{name}.test.js` pattern
- Fixtures in `bmad-statusline/test/fixtures/` as JSON files
- Current test count: 315 tests, 0 failures

### Previous Story Intelligence (6.3)

Key learnings from 6.3 implementation:
- `loadConfig(paths)` is synchronous and returns v2 config directly. No more `{ config, bmadWidgets, currentLine, error }` wrapper.
- `writeInternalConfig(config, paths)` accepts `paths` parameter for testability (`paths.internalConfig`).
- `syncCcstatuslineIfNeeded(oldConfig, newConfig, paths)` and `syncCcstatuslineFromScratch(config, paths)` both accept `paths` for testability.
- `deriveTuiState` was patched in 6.3 for API compat but is marked for deletion in 6.4.
- `app.js` has `onConfigChange` handler writing stale rawConfig — confirmed deferred issue to fix.
- `structuredClone()` confirmed working in Node >= 20.
- 315 tests passing at end of 6.3 (after code review fix).

### Git Patterns from Recent Commits

- Commit format: `6-4-tui-v2-core-app-shell-state-model-shared-components-home-edit-line: <description>`
- Code review fix format: `fix(6-4-tui-v2-core-app-shell-state-model-shared-components-home-edit-line): <description>`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.4] — BDD acceptance criteria and user story
- [Source: _bmad-output/planning-artifacts/architecture.md#TUI Multi-Line State Model] — v2 state model specification
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern 15] — TUI State Mutation (updateConfig)
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern 17] — Preview Override (try-before-you-buy)
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern 18] — Screen Props Contract
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern 19] — Color Resolution in Preview
- [Source: _bmad-output/planning-artifacts/architecture.md#ThreeLinePreview Rendering] — Preview component spec
- [Source: _bmad-output/planning-artifacts/architecture.md#TUI Navigation Model] — NavStack and screen tree
- [Source: _bmad-output/planning-artifacts/architecture.md#Bug Fix Architecture BF1/BF2/BF3] — Root causes and fixes
- [Source: _bmad-output/planning-artifacts/architecture.md#Complete Project Directory Structure] — File locations
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Home Screen] — Menu options, layout, shortcuts
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Edit Widget Line] — Widget list, inline status, h/g/c/s/l shortcuts
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#ThreeLinePreview] — Boxed 3-line preview spec
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Navigation Patterns] — Breadcrumb, Escape behavior
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Separator Style] — Preview-on-highlight
- [Source: _bmad-output/project-context.md#Pattern 14-19] — All TUI v2 patterns
- [Source: _bmad-output/implementation-artifacts/6-3-config-system-config-loader-v2-config-writer-v2-migration.md] — Previous story learnings, API signatures, review findings

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation, no blocking issues encountered.

### Completion Notes List

- Task 1-2: Rewrote app.js with v2 state model. Removed deriveTuiState, onConfigChange, KNOWN_SEPARATORS, FallbackScreen (kept as minimal placeholder), useEffect config loading. Implemented config/snapshot useState, updateConfig(mutator) per pattern 15, resetToOriginal() BF2-safe, navigate/goBack with context vars and previewOverride clearing. Screen routing for home, editLine, colorPicker, separator, plus fallback for 6.5 screens.
- Task 3: Created ThreeLinePreview.js — renders 3-line boxed preview with ANSI colors via resolvePreviewColor(), SAMPLE_VALUES, SEPARATOR_MAP. Empty lines render blank. Custom separator support.
- Task 4: Updated ScreenLayout — replaced title/tuiState props with ThreeLinePreview + config/previewOverride props. ScreenLayout now computes effectiveConfig internally.
- Task 5: Rewrote HomeScreen with 6 v2 options (Edit line 1/2/3, Reorder lines, Separator style, Reset). Uses navigate() with editingLine context. resetToOriginal() called directly for reset.
- Task 6: Created EditLineScreen with BF1 fix (all 9 widgets from registry, not just configured). Inline status display (visible/hidden with color). h shortcut toggles visibility preserving colorModes. g shortcut activates grab mode via ReorderList component. c/s/l shortcuts navigate to sub-screens.
- Task 7: Adapted SeparatorStyleScreen and ColorPickerScreen for v2 props (config, updateConfig, setPreviewOverride, goBack). Added Dynamic option for bmad-workflow in ColorPicker. Breadcrumb updated to v2 navigation path.
- Task 8: Rewrote tui-app.test.js for v2 state model tests. Added ThreeLinePreview tests and updated ScreenLayout tests in tui-components.test.js. Updated tui-separator.test.js and tui-widget-detail.test.js for v2 props. All 325 tests pass.

### Change Log

- 2026-04-01: Implemented story 6.4 — TUI v2 core (app shell, state model, shared components, Home + Edit Line screens)

### Review Findings

- [x] [Review][Decision] `g` key enters ReorderList navigate mode instead of immediate grab — resolved: added `initialMode`/`initialIndex` props to ReorderList, EditLineScreen passes `initialMode: 'moving'` for AC7 compliance
- [x] [Review][Patch] React hooks violation — `useInput` after conditional early return [EditLineScreen.js:47-84] — fixed: moved `useInput` above conditional return, `isActive: !grabMode` controls deactivation
- [x] [Review][Patch] Hidden widget status color `gray` instead of `brightBlack` (AC4) [EditLineScreen.js:143] — fixed
- [x] [Review][Patch] No unit tests for EditLineScreen (AC13) — fixed: created `tui-edit-line.test.js` with 11 tests (BF1, h toggle, g grab, shortcuts, inline status)
- [x] [Review][Dismiss] `afterEach` imported but unused [tui-app.test.js:1] — false positive, `afterEach` IS used at line 36
- [x] [Review][Defer] I/O inside React state updater (Strict Mode double-fire) [app.js:38-46] — deferred, spec-mandated Pattern 15

### File List

**New files:**
- src/tui/components/ThreeLinePreview.js
- src/tui/screens/EditLineScreen.js

**Modified files:**
- src/tui/app.js (rewrite — v2 state model, screen routing)
- src/tui/components/ScreenLayout.js (v2 props, ThreeLinePreview integration)
- src/tui/screens/HomeScreen.js (rewrite — v2 menu options)
- src/tui/screens/SeparatorStyleScreen.js (v2 props adaptation)
- src/tui/screens/ColorPickerScreen.js (v2 props, Dynamic option)
- test/tui-app.test.js (rewrite — v2 state model tests)
- test/tui-components.test.js (ThreeLinePreview tests, ScreenLayout v2 tests)
- test/tui-separator.test.js (v2 props)
- test/tui-widget-detail.test.js (v2 props, Dynamic option test)
- _bmad-output/implementation-artifacts/sprint-status.yaml (status update)
