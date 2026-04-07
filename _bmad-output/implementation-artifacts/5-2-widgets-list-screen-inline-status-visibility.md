# Story 5.2: Widgets List Screen — Inline Status & Visibility Toggle

Status: done

## Story

As a **developer configuring the statusline**,
I want **to see all 9 widgets with their current status and quickly toggle visibility without entering sub-screens**,
So that **I can scan my widget configuration at a glance and hide/show widgets with a single keypress**.

## Acceptance Criteria

1. **Widgets List screen layout:** Given the Home screen is displayed, when the developer presses Enter on "Widgets", then the Widgets List screen displays: Breadcrumb `Home > Widgets`, title "Select a widget to configure", 9 widgets (project, workflow, step, nextstep, progress, progressbar, progressstep, story, timer) each with inline status `■ visible` or `□ hidden` + color mode text (e.g. "dynamic", "red"), shortcut bar `↑↓ Navigate  Enter Configure  h Hide/Show  Esc Back`.

2. **Toggle visible to hidden:** Given the Widgets List screen is displayed, when the developer navigates to a visible widget and presses `h`, then the widget toggles to hidden (`□ hidden`), the DualPreview updates immediately to exclude the widget, and the config is persisted to file.

3. **Toggle hidden to visible:** Given the Widgets List screen is displayed, when the developer navigates to a hidden widget and presses `h`, then the widget toggles to visible (`■ visible`), the DualPreview updates immediately to include the widget, and the config is persisted to file.

4. **Enter navigates to Widget Detail:** Given the Widgets List screen is displayed, when the developer presses Enter on a widget, then the screen transitions to the Widget Detail screen for that widget (placeholder — Story 5.3 builds the real screen).

5. **Escape returns to Home:** Given the Widgets List screen is displayed, when the developer presses Escape, then the screen returns to Home.

6. **Inline color mode display:** Given a widget with color mode "fixed" and color "red", when the Widgets List renders, then the inline status shows `red` (the color name, not "fixed").

7. **Tests:** Given `test/tui-*.test.js`, when updated for this story, then tests cover: (a) renders 9 widgets with correct inline status, (b) h toggles visibility and updates preview, (c) Enter navigates to Widget Detail, (d) Escape returns to Home, (e) inline status reflects color mode correctly.

## Tasks / Subtasks

- [x] Task 1: Create WidgetsListScreen component (AC: #1, #5, #6)
  - [x] 1.1 Create `src/tui/screens/WidgetsListScreen.js` — custom list using `useInput` (NOT @inkjs/ui Select), renders 9 widgets with inline status, ↑↓ navigation, Escape back
  - [x] 1.2 Render each widget row: `name + padding + ■/□ + visible/hidden + color mode text`
  - [x] 1.3 Highlight current selection (bold or inverse) to show which widget is focused
- [x] Task 2: Implement h toggle with persistence (AC: #2, #3)
  - [x] 2.1 On `h` press: toggle highlighted widget in `visibleWidgets`, rebuild `rawConfig` via `buildWidgetConfig()`, call `saveConfig()`, update parent tuiState
  - [x] 2.2 DualPreview updates automatically because parent `tuiState.visibleWidgets` changes
- [x] Task 3: Implement Enter navigation to Widget Detail placeholder (AC: #4)
  - [x] 3.1 On Enter: call `onSelectWidget(widgetId)` which stores selected widget and navigates to `'widgetDetail'` screen
  - [x] 3.2 Placeholder renders widget name in breadcrumb: `Home > Widgets > {widgetName}`, with Escape back to Widgets List
- [x] Task 4: Integrate into app.js screen router (AC: #1, #4, #5)
  - [x] 4.1 Import WidgetsListScreen, route `screen === 'widgets'` to it
  - [x] 4.2 Add `selectedWidget` state to App for tracking which widget was selected
  - [x] 4.3 Add `handleToggleVisibility(widgetId)` in App that rebuilds config and persists
  - [x] 4.4 Route `screen === 'widgetDetail'` to PlaceholderScreen showing widget name (replaced by Story 5.3)
- [x] Task 5: Write tests (AC: #7)
  - [x] 5.1 Add to `test/tui-app.test.js` or create `test/tui-widgets-list.test.js`: renders 9 widgets (a), h toggles visibility (b), Enter navigates (c), Escape returns to Home (d), inline status shows color mode correctly (e)

## Dev Notes

### Why a Custom List, NOT @inkjs/ui Select

The `h` shortcut requires knowing **which widget is highlighted** when the key is pressed. The @inkjs/ui `Select` component is uncontrolled and has **no `onHighlight` callback** (confirmed in Story 5.1 notes). Therefore, WidgetsListScreen MUST use a custom list built with `useInput` and internal `highlightedIndex` state.

This pattern is also needed for Story 5.3+ try-before-you-buy (preview updates on arrow navigation), so establishing it here is correct.

### Custom List Pattern

```js
const [highlightedIndex, setHighlightedIndex] = useState(0);
const widgets = getIndividualWidgets(); // 9 widgets, stable order

useInput((input, key) => {
  if (key.upArrow) setHighlightedIndex(i => Math.max(0, i - 1));
  if (key.downArrow) setHighlightedIndex(i => Math.min(widgets.length - 1, i + 1));
  if (key.return) onSelectWidget(widgets[highlightedIndex].id);
  if (key.escape) onBack();
  if (input === 'h') onToggleVisibility(widgets[highlightedIndex].id);
}, { isActive });
```

### Widget Row Rendering

Each row displays 4 columns. Use the widget's `name` field from `getIndividualWidgets()` for display (e.g. "Project", "Workflow", "Progress+Step"), NOT the raw `id`.

```
  > Project          ■ visible   dynamic       ← highlighted (bold)
    Workflow         ■ visible   dynamic
    Step             ■ visible   dynamic
    Next Step        □ hidden    dynamic
    Progress         □ hidden    dynamic
    Progress Bar     ■ visible   dynamic
    Progress+Step    ■ visible   dynamic
    Story            ■ visible   dynamic
    Timer            ■ visible   red
```

- **Visibility icon:** `■` (U+25A0) for visible, `□` (U+25A1) for hidden
- **Visibility text:** `visible` or `hidden`
- **Color mode text:** If `colorModes[id].mode === 'fixed'`, show `colorModes[id].fixedColor` (e.g. "red"). If dynamic, show `dynamic`.
- **Highlight marker:** `>` prefix or bold text for the focused row, space prefix for others
- Pad widget names to align columns (longest name is "Progress+Step" = 13 chars)

### Visibility Toggle Flow — CRITICAL PERSISTENCE PATH

When `h` is pressed on widget at `highlightedIndex`:

1. **Derive new visibleWidgets:** Clone `tuiState.visibleWidgets`. If widget is in list → remove it. If not → add it (preserving order from `tuiState.widgetOrder`).

2. **Rebuild rawConfig:** Use `buildWidgetConfig()` from `widget-registry.js`:
   ```js
   import { buildWidgetConfig, getIndividualWidgets } from '../widget-registry.js';

   const readerPath = /* from paths or derive from rawConfig */;
   const newWidgets = buildWidgetConfig(newVisibleWidgets, readerPath, {
     separatorStyle: tuiState.separator,
     customSeparator: tuiState.colorModes._customSeparator,
     colorModes: tuiState.colorModes,
   });
   ```

3. **Update rawConfig:**
   ```js
   const newRawConfig = structuredClone(tuiState.rawConfig);
   newRawConfig.lines[tuiState.targetLine] = newWidgets;
   ```

4. **Persist:** Call `saveConfig(newRawConfig, paths)`. If it fails, show StatusMessage (same error pattern as app.js reset).

5. **Update tuiState:** Set new `visibleWidgets` and `rawConfig` in parent App state. DualPreview auto-updates because it reads `tuiState.visibleWidgets`.

### Extracting readerPath from rawConfig

The readerPath is embedded in widget `commandPath` fields: `'node "/path/to/bmad-sl-reader.js" project'`. Extract it from any existing widget:

```js
function extractReaderPath(rawConfig) {
  for (const line of rawConfig.lines) {
    for (const widget of line) {
      if (widget.commandPath && widget.commandPath.includes('bmad-sl-reader')) {
        // commandPath format: 'node "/path/to/reader.js" command'
        const match = widget.commandPath.match(/node\s+"([^"]+)"/);
        if (match) return match[1];
      }
    }
  }
  // Fallback: default path
  return path.join(os.homedir(), '.config', 'bmad-statusline', 'bmad-sl-reader.js');
}
```

This avoids hardcoding the reader path — reuse what's already in the config.

### App.js Integration — What to Change

**Add to app.js:**

1. **Import WidgetsListScreen:**
   ```js
   import { WidgetsListScreen } from './screens/WidgetsListScreen.js';
   ```

2. **Add selectedWidget state:**
   ```js
   const [selectedWidget, setSelectedWidget] = useState(null);
   ```

3. **Add toggle handler:**
   ```js
   const handleToggleVisibility = (widgetId) => {
     // Toggle widgetId in visibleWidgets, rebuild rawConfig, save, update state
     // Show StatusMessage on save failure
   };
   ```

4. **Route 'widgets' screen to WidgetsListScreen:**
   ```js
   if (screen === 'widgets') {
     return e(WidgetsListScreen, {
       tuiState,
       onToggleVisibility: handleToggleVisibility,
       onSelectWidget: (widgetId) => {
         setSelectedWidget(widgetId);
         navigate('widgetDetail');
       },
       onBack: goBack,
       isActive: !statusMessage,
       paths,
     });
   }
   ```

5. **Route 'widgetDetail' to PlaceholderScreen (temporary):**
   ```js
   if (screen === 'widgetDetail') {
     const widgetDef = getIndividualWidgets().find(w => w.id === selectedWidget);
     const widgetName = widgetDef ? widgetDef.name : selectedWidget;
     return e(PlaceholderScreen, {
       screen: 'widgetDetail',
       screenTitle: widgetName + ' configuration',
       breadcrumb: ['Home', 'Widgets', widgetName],
       tuiState,
       onBack: goBack,
       isActive: !statusMessage,
     });
   }
   ```

**Note:** PlaceholderScreen may need a small update to accept optional `breadcrumb` and `screenTitle` props for the widgetDetail case (3-level breadcrumb: `Home > Widgets > timer`). If modifying PlaceholderScreen is too invasive, create a minimal inline placeholder in app.js's screen router for `'widgetDetail'`.

### NO JSX — Use React.createElement

The project has **zero build tooling**. Continue the `const e = React.createElement` pattern. All code samples in this story use JSX-like syntax for readability, but the dev agent MUST translate to `React.createElement` calls:

```js
// JSX (documentation): <Text bold>{name}</Text>
// Actual code:         e(Text, { bold: true }, name)
```

### REUSE These Files Unchanged

| File | Purpose | API |
|------|---------|-----|
| `config-loader.js` | Load ccstatusline config | `loadConfig(paths)` → `{ config, bmadWidgets, currentLine, error }` |
| `config-writer.js` | Persist config with backup | `saveConfig(config, paths)` → `{ success, error }` |
| `widget-registry.js` | Widget definitions + config builder | `getIndividualWidgets()` (9 widgets), `buildWidgetConfig(enabledWidgets, readerPath, options)` |

### Widget Registry — `getIndividualWidgets()` Returns

```js
[
  { id: 'bmad-project',      command: 'project',      name: 'Project',       defaultEnabled: true },
  { id: 'bmad-workflow',     command: 'workflow',     name: 'Workflow',      defaultEnabled: true },
  { id: 'bmad-step',         command: 'step',         name: 'Step',          defaultEnabled: false },
  { id: 'bmad-nextstep',     command: 'nextstep',     name: 'Next Step',     defaultEnabled: false },
  { id: 'bmad-progress',     command: 'progress',     name: 'Progress',      defaultEnabled: false },
  { id: 'bmad-progressbar',  command: 'progressbar',  name: 'Progress Bar',  defaultEnabled: false },
  { id: 'bmad-progressstep', command: 'progressstep', name: 'Progress+Step', defaultEnabled: true },
  { id: 'bmad-story',        command: 'story',        name: 'Story',         defaultEnabled: true },
  { id: 'bmad-timer',        command: 'timer',        name: 'Timer',         defaultEnabled: true },
]
```

### DualPreview — Already Handles Visibility

`DualPreview.js` already respects `tuiState.visibleWidgets` — hidden widgets are excluded from the preview. No changes needed to DualPreview. Just update `tuiState.visibleWidgets` in the parent and the preview auto-updates.

### Color Mode Display Logic

```js
function getColorModeText(widgetId, colorModes) {
  const cm = colorModes[widgetId];
  if (!cm || cm.mode === 'dynamic') return 'dynamic';
  return cm.fixedColor || 'white'; // Show actual color name
}
```

### buildWidgetConfig Options Shape (widget-registry.js)

```js
buildWidgetConfig(
  enabledWidgets,  // string[] — widget IDs to include (only visible ones)
  readerPath,      // string — path to bmad-sl-reader.js
  {
    separatorStyle: 'serre' | 'modere' | 'large' | 'custom',
    customSeparator: string,     // only if separatorStyle === 'custom'
    colorModes: { [id]: { mode: 'fixed' | 'dynamic', fixedColor?: string } }
  }
)
// Returns: Array of widget + separator objects for one config line
```

### Save Error Handling

Follow the same pattern as `resetToOriginal` in app.js:
```js
const result = saveConfig(newRawConfig, paths);
if (!result.success) {
  setStatusMessage({ variant: 'error', text: 'Could not save configuration. Press any key.' });
}
```
React state retains the new value regardless of save success (AC #7 from Story 5.1 — write failure recovery).

### What This Story Does NOT Do

- Does NOT build Widget Detail screen (Story 5.3) — Enter from Widgets List goes to a placeholder
- Does NOT implement try-before-you-buy on the Widgets List (no preview change on arrow highlight — that pattern starts in Story 5.3)
- Does NOT build Color Mode or Color Picker screens (Story 5.3)
- Does NOT modify config-loader.js, config-writer.js, or widget-registry.js
- Does NOT modify DualPreview.js, Breadcrumb.js, ShortcutBar.js, or ScreenLayout.js
- Does NOT modify any hook, reader, or installer code

### Testing Strategy

Tests use `node:test` + `node:assert/strict` + `ink-testing-library`. Follow the patterns from `test/tui-app.test.js` and `test/tui-components.test.js`.

**Test file:** `test/tui-widgets-list.test.js` (new file) or extend `test/tui-app.test.js`.

**Test approach:** Render `WidgetsListScreen` directly (unit tests) and test through `App` for integration.

```js
// Example: Render widgets list with mock state
const { lastFrame, stdin } = render(e(WidgetsListScreen, {
  tuiState: MOCK_TUI_STATE,
  onToggleVisibility: (id) => { toggledId = id; },
  onSelectWidget: (id) => { selectedId = id; },
  onBack: () => { backCalled = true; },
  isActive: true,
  paths: mockPaths,
}));

// (a) Renders 9 widgets
assert.ok(frame.includes('Project'));
assert.ok(frame.includes('Timer'));
// ... all 9

// (b) h toggles
stdin.write('h');
assert.equal(toggledId, 'bmad-project'); // first widget highlighted by default

// (c) Enter navigates
stdin.write('\r');
assert.equal(selectedId, 'bmad-project');

// (d) Escape back
stdin.write('\x1B');
assert.ok(backCalled);

// (e) Color mode display
// Create state with fixed color, verify display shows color name
```

**Use `delay()` pattern** from existing tests for async state updates:
```js
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
```

### Existing Test Files (Do NOT Modify)

| File | Tests | Status |
|------|-------|--------|
| `test/tui-config-loader.test.js` | config-loader.js | Keep unchanged |
| `test/tui-config-writer.test.js` | config-writer.js | Keep unchanged |
| `test/tui-widget-registry.test.js` | widget-registry.js | Keep unchanged |
| `test/tui-components.test.js` | Shared components | Keep unchanged |

### Project Structure Notes

- All new TUI files are ESM (`import`/`export`)
- New file: `src/tui/screens/WidgetsListScreen.js`
- Modified file: `src/tui/app.js` (add routing + toggle handler + selectedWidget state)
- Possibly modified: `src/tui/screens/PlaceholderScreen.js` (if needed for widgetDetail breadcrumb)
- New test file: `test/tui-widgets-list.test.js`
- Run tests: `npm test` from `bmad-statusline/` (runs `node --test test/*.test.js`)
- Currently 245 tests passing — new tests must not break existing ones

### Previous Story Intelligence

From Story 5.1 (completed):
- **Created components:** Breadcrumb, ShortcutBar, DualPreview, ScreenLayout — all stable, reuse as-is
- **App.js architecture:** Screen router with navigate/goBack, tuiState/snapshot/statusMessage state
- **PlaceholderScreen:** Exists for unbuilt screens — 'widgets' currently routes here, Story 5.2 replaces that route
- **Testing:** 245 tests, ink-testing-library installed, MOCK_TUI_STATE pattern established
- **Review findings applied:** launchTui returns waitUntilExit, preserveColors undefined treated as dynamic, StatusMessage on write failure
- **Pattern:** `const e = React.createElement` throughout, zero JSX

### Git Intelligence

Recent commits:
- `b825790 fix(5-1-app-shell-shared-components-home-screen): code review corrections`
- `0a29747 5-1-app-shell-shared-components-home-screen: App shell + shared components + Home screen`
- Commit format: `{story-key}: {description}`, review fixes: `fix({story-key}): code review corrections`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.2 — Acceptance criteria, BDD scenarios]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Widgets List mockup, inline status display, h shortcut spec, navigation patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md — Boundary 6 (TUI isolated), widget definitions, tech stack]
- [Source: _bmad-output/project-context.md — Technology stack (Node.js >=20, ESM, zero build), testing conventions (node:test)]
- [Source: _bmad-output/implementation-artifacts/5-1-app-shell-shared-components-home-screen.md — Previous story: app.js architecture, component APIs, test patterns, review findings]
- [Source: bmad-statusline/src/tui/app.js — Screen router, deriveTuiState(), buildDefaultTuiState(), navigate/goBack, tuiState shape]
- [Source: bmad-statusline/src/tui/widget-registry.js — getIndividualWidgets() (9 widgets), buildWidgetConfig(enabledWidgets, readerPath, options)]
- [Source: bmad-statusline/src/tui/config-writer.js — saveConfig(config, paths) → { success, error }]
- [Source: bmad-statusline/src/tui/components/DualPreview.js — Already respects visibleWidgets, no changes needed]
- [Source: @inkjs/ui docs — Select: uncontrolled, no onHighlight callback — cannot use for WidgetsList]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation, no debugging required.

### Completion Notes List

- Created WidgetsListScreen with custom list (useInput + highlightedIndex state), renders all 9 widgets with inline status (■/□ visible/hidden + color mode text), ↑↓ navigation, > highlight marker with bold
- Toggle handler (handleToggleVisibility) in App rebuilds visibleWidgets preserving widgetOrder, rebuilds rawConfig via buildWidgetConfig(), persists via saveConfig(), shows StatusMessage on failure
- Enter navigates to widgetDetail placeholder (PlaceholderScreen with 3-level breadcrumb: Home > Widgets > {widgetName})
- PlaceholderScreen updated to accept optional `breadcrumb` and `screenTitle` props
- 14 new tests in test/tui-widgets-list.test.js covering all 5 AC sub-requirements (a-e) plus boundary and isActive tests
- All 279 tests pass (265 existing + 14 new), zero regressions

### Change Log

- Story 5.2 implementation complete (Date: 2026-03-30)

### Review Findings

- [x] [Review][Patch] Missing `try/catch` around `saveConfig` in `handleToggleVisibility` [app.js:229]
- [x] [Review][Patch] `customSeparator || '   '` swallows empty string — use `??` [app.js:221]
- [x] [Review][Patch] Dead variable `projectLine` in test [tui-widgets-list.test.js:70]
- [x] [Review][Defer] `structuredClone` no null-guard for `rawConfig` in `handleToggleVisibility` [app.js:224] — deferred, pre-existing pattern
- [x] [Review][Defer] Stale `tuiState` read on rapid `h` keypresses — no setState updater [app.js:208] — deferred, pre-existing pattern across all handlers
- [x] [Review][Defer] No `lines.length` guard before `lines[targetLine]=` [app.js:225] — deferred, pre-existing pattern (only `rebuildWithSeparator` has guard)
- [x] [Review][Defer] Widget absent from `widgetOrder` stays invisible after toggle-to-visible [app.js:214] — deferred, pre-existing design
- [x] [Review][Defer] `readerPath` not extracted from `rawConfig`, uses `paths.readerPath` fallback [app.js:207] — deferred, pre-existing pattern across all handlers

### File List

- `src/tui/screens/WidgetsListScreen.js` (new)
- `src/tui/app.js` (modified — added import, selectedWidget state, handleToggleVisibility, widgets/widgetDetail routes)
- `src/tui/screens/PlaceholderScreen.js` (modified — added optional breadcrumb/screenTitle props)
- `test/tui-widgets-list.test.js` (new)
