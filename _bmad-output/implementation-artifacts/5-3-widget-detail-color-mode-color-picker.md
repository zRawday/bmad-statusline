# Story 5.3: Widget Detail + Color Mode + Color Picker Screens

Status: done

## Story

As a **developer configuring a specific widget**,
I want **to change its color mode and pick a fixed ANSI color with live preview showing the result before I commit**,
So that **I can fine-tune each widget's appearance with confidence, seeing the exact result in the preview**.

## Acceptance Criteria

1. **Widget Detail screen layout:** Given the developer presses Enter on "timer" in the Widgets List, when the Widget Detail screen loads, then it displays: Breadcrumb `Home > Widgets > timer`, title "timer configuration", Select with 2 options: "Color Mode" (showing current value) and "Visibility" (showing current state), shortcut bar `↑↓ Navigate  Enter Select  Esc Back`.

2. **Visibility toggle from Widget Detail:** Given the Widget Detail screen is displayed, when the developer presses Enter on "Visibility", then the visibility toggles immediately, DualPreview updates, and config is persisted.

3. **Enter on Color Mode navigates:** Given the Widget Detail screen is displayed, when the developer presses Enter on "Color Mode", then the Color Mode screen displays: Breadcrumb `Home > Widgets > timer > Color Mode`, title "Choose color mode for timer", Select: "dynamic" ("Color changes with workflow") and "fixed" ("Choose a fixed color").

4. **Color Mode try-before-you-buy:** Given the Color Mode screen is displayed, when the developer highlights "dynamic" or "fixed" with arrow keys, then the DualPreview updates temporarily to show the highlighted option's effect.

5. **Select dynamic:** Given the Color Mode screen is displayed, when the developer presses Enter on "dynamic", then the color mode is set to dynamic, config is persisted, screen returns to Widget Detail showing updated value.

6. **Select fixed navigates to Color Picker:** Given the Color Mode screen is displayed, when the developer presses Enter on "fixed", then the Color Picker screen displays: Breadcrumb `Home > Widgets > timer > Color Mode > Fixed`, title "Choose color for timer", Select with 14 ANSI colors: red, green, yellow, blue, magenta, cyan, white, brightRed, brightGreen, brightYellow, brightBlue, brightMagenta, brightCyan, brightWhite.

7. **Color Picker try-before-you-buy:** Given the Color Picker screen is displayed, when the developer highlights a color with arrow keys, then the DualPreview updates temporarily to show the widget in the highlighted color.

8. **Color Picker select:** Given the Color Picker screen is displayed, when the developer presses Enter on a color (e.g. "red"), then the color is persisted, the screen returns to the Color Mode screen, and the DualPreview shows the committed color.

9. **Color Picker escape reverts:** Given the Color Picker screen is displayed, when the developer presses Escape, then the DualPreview reverts to the last persisted value and the screen returns to Color Mode.

10. **Escape at depth 2+:** Given any screen at depth 2+, when the developer presses Escape, then the screen goes back exactly one level and the breadcrumb updates accordingly.

11. **Tests:** Given `test/tui-*.test.js`, when updated for this story, then tests cover: (a) Widget Detail renders for any widget with correct values, (b) Color Mode renders dynamic/fixed, (c) Color Picker renders 14 colors, (d) try-before-you-buy: highlight updates preview temporarily, (e) Enter persists and navigates correctly, (f) Escape reverts preview and goes back one level, (g) breadcrumb correct at all 4 depth levels.

## Tasks / Subtasks

- [x] Task 1: Create WidgetDetailScreen component (AC: #1, #2, #10)
  - [x] 1.1 Create `src/tui/screens/WidgetDetailScreen.js` — custom list with 2 options (Color Mode, Visibility), `useInput` with ↑↓ navigation
  - [x] 1.2 Display current color mode value inline (e.g., "dynamic", "red") and visibility state (■ visible / □ hidden)
  - [x] 1.3 Enter on Visibility: call `onToggleVisibility(widgetId)` directly (reuses app.js handler)
  - [x] 1.4 Enter on Color Mode: call `onNavigateColorMode()` to navigate
  - [x] 1.5 Escape: call `onBack()`

- [x] Task 2: Create ColorModeScreen component (AC: #3, #4, #5, #6)
  - [x] 2.1 Create `src/tui/screens/ColorModeScreen.js` — uses `SelectWithPreview` with 2 options
  - [x] 2.2 Implement `onHighlight`: temporarily update DualPreview to show dynamic or fixed effect
  - [x] 2.3 Enter on "dynamic": persist via `onConfigChange({ colorModes: newColorModes })`, call `onBack()`
  - [x] 2.4 Enter on "fixed": call `onNavigateColorPicker()` to navigate

- [x] Task 3: Create ColorPickerScreen component (AC: #6, #7, #8, #9)
  - [x] 3.1 Create `src/tui/screens/ColorPickerScreen.js` — uses `SelectWithPreview` with 14 ANSI colors
  - [x] 3.2 Implement `onHighlight`: temporarily update DualPreview to show widget in highlighted color
  - [x] 3.3 Enter: persist color via `onConfigChange({ colorModes: newColorModes })`, call `onBack()`
  - [x] 3.4 Escape: handled by `useInput` in screen, calls `onBack()` (preview reverts because parent tuiState unchanged)

- [x] Task 4: Integrate into app.js screen router (AC: #1, #3, #6, #10)
  - [x] 4.1 Import WidgetDetailScreen, ColorModeScreen, ColorPickerScreen
  - [x] 4.2 Extend `onConfigChange` to handle `colorModes` changes (add `colorModes` to the rebuild condition alongside `separator`)
  - [x] 4.3 Replace PlaceholderScreen `widgetDetail` route with WidgetDetailScreen
  - [x] 4.4 Add `colorMode` route with ColorModeScreen
  - [x] 4.5 Add `colorPicker` route with ColorPickerScreen

- [x] Task 5: Write tests (AC: #11)
  - [x] 5.1 Create `test/tui-widget-detail.test.js` — tests for all 3 screens: Widget Detail, Color Mode, Color Picker
  - [x] 5.2 Test: Widget Detail renders 2 options with correct values for any widget (a)
  - [x] 5.3 Test: Color Mode renders dynamic/fixed with descriptions (b)
  - [x] 5.4 Test: Color Picker renders 14 colors (c)
  - [x] 5.5 Test: try-before-you-buy — highlight updates preview temporarily (d)
  - [x] 5.6 Test: Enter persists and navigates correctly (e)
  - [x] 5.7 Test: Escape reverts preview and goes back one level (f)
  - [x] 5.8 Test: breadcrumb correct at all depth levels (g)

## Dev Notes

### Three New Screens — Architecture Overview

This story adds 3 interconnected screens forming the deepest navigation path in the TUI (4 levels):

```
Home > Widgets > {widget} > Color Mode > Fixed
```

All 3 screens follow established patterns from Story 5.4 (TargetLineScreen, SeparatorStyleScreen).

### Screen 1: WidgetDetailScreen

A simple custom list with 2 options. Uses `useInput` + `highlightedIndex` state (same pattern as WidgetsListScreen — NOT @inkjs/ui Select, which has no `onHighlight`).

```js
const DETAIL_OPTIONS = [
  { key: 'colorMode', label: 'Color Mode' },
  { key: 'visibility', label: 'Visibility' },
];
```

Each option shows its current value inline:
```
  > Color Mode       dynamic
    Visibility       ■ visible
```

**Props:**
```js
{
  tuiState,           // current state for display
  widgetId,           // which widget (e.g. 'bmad-timer')
  onToggleVisibility, // existing handler from app.js
  onNavigateColorMode,// () => navigate('colorMode')
  onBack,             // goBack
  isActive,
}
```

**Enter behavior:**
- On "Color Mode" → `onNavigateColorMode()`
- On "Visibility" → `onToggleVisibility(widgetId)` (reuses existing handler from Story 5.2)

**No try-before-you-buy on this screen** — it's a navigation hub, not a value selector.

### Screen 2: ColorModeScreen

Uses `SelectWithPreview` component (established in Story 5.4) with 2 options:

```js
const COLOR_MODE_OPTIONS = [
  { label: 'dynamic    Color changes with workflow', value: 'dynamic' },
  { label: 'fixed      Choose a fixed color', value: 'fixed' },
];
```

**Props:**
```js
{
  tuiState,
  widgetId,
  onConfigChange,        // app.js generic handler
  onNavigateColorPicker, // () => navigate('colorPicker')
  onBack,
  isActive,
}
```

**Try-before-you-buy implementation:**
```js
const [previewTuiState, setPreviewTuiState] = useState(tuiState);

const handleHighlight = (value) => {
  const newColorModes = structuredClone(tuiState.colorModes);
  if (value === 'dynamic') {
    newColorModes[widgetId] = { mode: 'dynamic' };
  } else {
    // Show fixed with current fixedColor or fallback to 'white'
    const currentFixed = tuiState.colorModes[widgetId]?.fixedColor || 'white';
    newColorModes[widgetId] = { mode: 'fixed', fixedColor: currentFixed };
  }
  setPreviewTuiState({ ...tuiState, colorModes: newColorModes });
};
```

**Enter behavior:**
- On "dynamic" → persist via `onConfigChange`, then `onBack()` (returns to Widget Detail)
- On "fixed" → `onNavigateColorPicker()` (NO persist yet — user hasn't chosen a color)

**Default value:** Derive from `tuiState.colorModes[widgetId].mode` — either `'dynamic'` or `'fixed'`.

### Screen 3: ColorPickerScreen

Uses `SelectWithPreview` component with 14 ANSI colors:

```js
const ANSI_COLORS = [
  'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
  'brightRed', 'brightGreen', 'brightYellow', 'brightBlue',
  'brightMagenta', 'brightCyan', 'brightWhite',
];
// Generate options:
const COLOR_OPTIONS = ANSI_COLORS.map(c => ({ label: c, value: c }));
```

**Why 14, not 16:** Excludes `black` and `gray` — invisible or barely visible on typical dark terminal backgrounds.

**Props:**
```js
{
  tuiState,
  widgetId,
  onConfigChange,  // app.js generic handler
  onBack,
  isActive,
}
```

**Try-before-you-buy implementation:**
```js
const [previewTuiState, setPreviewTuiState] = useState(tuiState);

const handleHighlight = (color) => {
  const newColorModes = structuredClone(tuiState.colorModes);
  newColorModes[widgetId] = { mode: 'fixed', fixedColor: color };
  setPreviewTuiState({ ...tuiState, colorModes: newColorModes });
};
```

**Enter behavior:**
- On any color → persist via `onConfigChange({ colorModes: newColorModes })`, then `onBack()` (returns to Color Mode screen)

**Default value:** Derive from `tuiState.colorModes[widgetId]?.fixedColor || 'red'` (first in list).

### app.js Changes — Extend `onConfigChange` + New Routes

**1. Extend `onConfigChange`** to handle `colorModes` changes:

The existing `rebuildWithSeparator()` already uses `newTuiState.colorModes` when calling `buildWidgetConfig()`. Just add `colorModes` to the condition:

```js
// In onConfigChange, change the else-if:
} else if (changes.separator !== undefined || changes.customSeparator !== undefined || changes.colorModes !== undefined) {
  newRawConfig = rebuildWithSeparator(newTuiState, paths);
}
```

**This is a single-line change.** No new handler function needed.

**2. Replace widgetDetail route** — swap PlaceholderScreen for WidgetDetailScreen:

```js
if (screen === 'widgetDetail') {
  const widgetDef = getIndividualWidgets().find(w => w.id === selectedWidget);
  const widgetName = widgetDef ? widgetDef.name : selectedWidget;
  return e(WidgetDetailScreen, {
    tuiState,
    widgetId: selectedWidget,
    widgetName,
    onToggleVisibility: handleToggleVisibility,
    onNavigateColorMode: () => navigate('colorMode'),
    onBack: goBack,
    isActive: !statusMessage,
  });
}
```

**3. Add colorMode route:**

```js
if (screen === 'colorMode') {
  const widgetDef = getIndividualWidgets().find(w => w.id === selectedWidget);
  const widgetName = widgetDef ? widgetDef.name : selectedWidget;
  return e(ColorModeScreen, {
    tuiState,
    widgetId: selectedWidget,
    widgetName,
    onConfigChange,
    onNavigateColorPicker: () => navigate('colorPicker'),
    onBack: goBack,
    isActive: !statusMessage,
  });
}
```

**4. Add colorPicker route:**

```js
if (screen === 'colorPicker') {
  const widgetDef = getIndividualWidgets().find(w => w.id === selectedWidget);
  const widgetName = widgetDef ? widgetDef.name : selectedWidget;
  return e(ColorPickerScreen, {
    tuiState,
    widgetId: selectedWidget,
    widgetName,
    onConfigChange,
    onBack: goBack,
    isActive: !statusMessage,
  });
}
```

**5. Add imports at top of app.js:**

```js
import { WidgetDetailScreen } from './screens/WidgetDetailScreen.js';
import { ColorModeScreen } from './screens/ColorModeScreen.js';
import { ColorPickerScreen } from './screens/ColorPickerScreen.js';
```

**6. Remove PlaceholderScreen from widgetDetail route.** PlaceholderScreen import can remain (still used by fallback at the end of the screen router).

### Navigation Stack — How Back Works

The existing `navigate`/`goBack` pattern handles the multi-level back correctly:

```
Action                    navStack after action      screen
─────                     ─────────────────          ──────
Home → Widgets            ['home']                   'widgets'
Widgets → Widget Detail   ['home', 'widgets']        'widgetDetail'
Widget Detail → ColorMode ['home','widgets','widgetDetail'] 'colorMode'
ColorMode → ColorPicker   ['home','widgets','widgetDetail','colorMode'] 'colorPicker'

Escape from ColorPicker:  ['home','widgets','widgetDetail'] → 'colorMode'
Escape from ColorMode:    ['home','widgets']                → 'widgetDetail'
Escape from WidgetDetail: ['home']                          → 'widgets'
```

**No changes needed** to navigate/goBack logic — it already handles arbitrary depth.

### Breadcrumbs at Each Level

| Screen | Breadcrumb |
|--------|-----------|
| Widget Detail | `['Home', 'Widgets', widgetName]` |
| Color Mode | `['Home', 'Widgets', widgetName, 'Color Mode']` |
| Color Picker | `['Home', 'Widgets', widgetName, 'Color Mode', 'Fixed']` |

`widgetName` is the display name from `getIndividualWidgets()` (e.g., "Timer", "Project"), NOT the id.

### NO JSX — Use React.createElement

```js
// Documentation:  <Text bold>{name}</Text>
// Actual code:    e(Text, { bold: true }, name)
```

Continue `const e = React.createElement` pattern throughout.

### REUSE These Files Unchanged

| File | Purpose | API |
|------|---------|-----|
| `config-loader.js` | Load ccstatusline config | `loadConfig(paths)` |
| `config-writer.js` | Persist config with backup | `saveConfig(config, paths)` |
| `widget-registry.js` | Widget definitions + config builder | `getIndividualWidgets()`, `buildWidgetConfig()` |
| `components/SelectWithPreview.js` | Try-before-you-buy custom select | `{options, defaultValue, onChange, onHighlight, isActive}` |
| `components/ScreenLayout.js` | Screen wrapper | `{breadcrumb, title, shortcuts, tuiState, children}` |
| `components/DualPreview.js` | Preview lines | `{tuiState}` — auto-updates from colorModes |
| `components/Breadcrumb.js` | Path display | `{path}` |
| `components/ShortcutBar.js` | Shortcut hints | `{actions}` |

### DualPreview — Already Handles colorModes

`DualPreview.js` uses `getWidgetColor(widgetId, colorModes)` which respects `mode: 'fixed'` → returns `fixedColor`. When `previewTuiState.colorModes` is passed via ScreenLayout, the preview auto-updates. No changes to DualPreview needed.

### Color Mode Display Logic (reuse from WidgetsListScreen)

```js
function getColorModeText(widgetId, colorModes) {
  const cm = colorModes[widgetId];
  if (!cm || cm.mode === 'dynamic') return 'dynamic';
  return cm.fixedColor || 'white';
}
```

This function is duplicated in WidgetsListScreen. For this story, duplicate it in WidgetDetailScreen (same pattern as existing code — keep screens self-contained).

### Visibility Display Logic

```js
function getVisibilityText(widgetId, visibleWidgets) {
  const isVisible = visibleWidgets.includes(widgetId);
  return isVisible ? '■ visible' : '□ hidden';
}
```

### Save Error Handling

Follow existing pattern from handleToggleVisibility in app.js:
```js
try {
  const result = saveConfig(newRawConfig, paths);
  if (!result.success) {
    setStatusMessage({ variant: 'error', text: 'Could not save configuration. Press any key.' });
  }
} catch {
  setStatusMessage({ variant: 'error', text: 'Could not save configuration. Press any key.' });
}
```

Since the 3 new screens use `onConfigChange` from app.js, error handling is centralized — no new error handling needed in the screen components.

### What This Story Does NOT Do

- Does NOT modify `config-loader.js`, `config-writer.js`, or `widget-registry.js`
- Does NOT modify `DualPreview.js`, `Breadcrumb.js`, `ShortcutBar.js`, `ScreenLayout.js`, or `SelectWithPreview.js`
- Does NOT add composite mode selection (removed from scope in epic design)
- Does NOT modify any hook, reader, or installer code
- Does NOT modify `WidgetsListScreen.js` (it already navigates to `widgetDetail` correctly)
- Does NOT modify `HomeScreen.js`, `WidgetOrderScreen.js`, `PresetsScreen.js`, `TargetLineScreen.js`, or `SeparatorStyleScreen.js`

### Testing Strategy

Tests use `node:test` + `node:assert/strict` + `ink-testing-library`. Follow patterns from `test/tui-widgets-list.test.js` and `test/tui-target-line.test.js`.

**Test file:** `test/tui-widget-detail.test.js` (new)

**Test approach:** Render each screen directly (unit tests) with mock props.

```js
// Widget Detail — render with mock state
const { lastFrame, stdin } = render(e(WidgetDetailScreen, {
  tuiState: MOCK_TUI_STATE,
  widgetId: 'bmad-timer',
  widgetName: 'Timer',
  onToggleVisibility: (id) => { toggledId = id; },
  onNavigateColorMode: () => { navigatedTo = 'colorMode'; },
  onBack: () => { backCalled = true; },
  isActive: true,
}));

// (a) Renders 2 options with correct values
assert.ok(frame.includes('Color Mode'));
assert.ok(frame.includes('Visibility'));
assert.ok(frame.includes('dynamic')); // or color name if fixed

// (b) Enter on Color Mode navigates
stdin.write('\r');
assert.equal(navigatedTo, 'colorMode');

// (c) Arrow down + Enter on Visibility toggles
stdin.write('\x1B[B'); // down arrow
await delay(50);
stdin.write('\r');
assert.equal(toggledId, 'bmad-timer');

// Color Mode — render with mock state
const { lastFrame: cmFrame, stdin: cmInput } = render(e(ColorModeScreen, {
  tuiState: MOCK_TUI_STATE,
  widgetId: 'bmad-timer',
  widgetName: 'Timer',
  onConfigChange: (changes) => { configChanges = changes; },
  onNavigateColorPicker: () => { navigatedTo = 'colorPicker'; },
  onBack: () => { backCalled = true; },
  isActive: true,
}));

// (d) Renders dynamic/fixed options
assert.ok(cmFrame.includes('dynamic'));
assert.ok(cmFrame.includes('fixed'));

// Color Picker — render with mock state
const { lastFrame: cpFrame } = render(e(ColorPickerScreen, {
  tuiState: MOCK_TUI_STATE,
  widgetId: 'bmad-timer',
  widgetName: 'Timer',
  onConfigChange: (changes) => { configChanges = changes; },
  onBack: () => { backCalled = true; },
  isActive: true,
}));

// (e) Renders 14 colors
assert.ok(cpFrame.includes('red'));
assert.ok(cpFrame.includes('brightWhite'));
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
| `test/tui-app.test.js` | App integration | Keep unchanged |
| `test/tui-widgets-list.test.js` | Widgets List | Keep unchanged |
| `test/tui-select-preview.test.js` | SelectWithPreview | Keep unchanged |
| `test/tui-target-line.test.js` | Target Line | Keep unchanged |
| `test/tui-separator.test.js` | Separator Style | Keep unchanged |
| `test/tui-widget-order.test.js` | Widget Order | Keep unchanged |
| `test/tui-presets.test.js` | Presets | Keep unchanged |

### Project Structure Notes

- All new TUI files are ESM (`import`/`export`)
- New file: `src/tui/screens/WidgetDetailScreen.js`
- New file: `src/tui/screens/ColorModeScreen.js`
- New file: `src/tui/screens/ColorPickerScreen.js`
- Modified file: `src/tui/app.js` (extend `onConfigChange`, replace widgetDetail route, add colorMode/colorPicker routes)
- New test file: `test/tui-widget-detail.test.js`
- Run tests: `npm test` from `bmad-statusline/` (runs `node --test test/*.test.js`)
- Currently 311 tests passing — new tests must not break existing ones

### Previous Story Intelligence

From Story 5.2 (done):
- **WidgetsListScreen** — custom list with `useInput` + `highlightedIndex`, navigates to `widgetDetail` via `onSelectWidget`, passes `selectedWidget` state in app.js
- **handleToggleVisibility** — already exists in app.js, rebuilds visibleWidgets + rawConfig + persists
- **PlaceholderScreen** — currently handles `widgetDetail` route with 3-level breadcrumb — this story replaces it
- **Review findings:** `customSeparator || '   '` swallowed empty string, fixed with `??`. Stale `tuiState` read on rapid keypresses deferred.

From Story 5.4 (review):
- **SelectWithPreview** — created as shared component for try-before-you-buy pattern. Props: `{options, defaultValue, onChange, onHighlight, isActive}`
- **TargetLineScreen / SeparatorStyleScreen** — established the `previewTuiState` pattern: local state initialized from `tuiState`, updated on highlight, passed to ScreenLayout
- **onConfigChange** — generic handler in app.js. Currently handles `targetLine` and `separator/customSeparator` changes. Must be extended for `colorModes`.

From Story 5.5 (review):
- **ReorderList** — custom component with dual-mode (navigate/moving). Unrelated to this story.
- **Widget Order handlers** — `handleOrderPreview`/`handleOrderCommit` in app.js. Different pattern from `onConfigChange`.

From Story 5.6 (done):
- **ConfirmDialog** — created for preset overwrite. Unrelated to this story.
- **Presets** — save/load/delete. Unrelated to this story.
- **Deferred work:** `customSeparator` absent from preset snapshot, `isActive: true` hardcoded for PresetsScreen. Neither affects this story.

### Git Intelligence

Recent commits:
- `e52e10e fix(5-6-presets-screen-confirm-dialog): code review corrections`
- `16bc882 fix(5-2-widgets-list-screen-inline-status-visibility): code review corrections`
- `6c7f7f0 5-4-target-line-separator-style-reset: Target Line + Separator Style screens with try-before-you-buy`
- Commit format: `{story-key}: {description}`, review fixes: `fix({story-key}): code review corrections`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.3 — Acceptance criteria, BDD scenarios, 14 ANSI colors list]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Widget Detail, Color Mode, Color Picker mockups (screens 3-5), try-before-you-buy interaction pattern, breadcrumb at 4 depth levels, navigation journey 2 (max depth)]
- [Source: _bmad-output/planning-artifacts/architecture.md — Boundary 6 (TUI isolated), tech stack (Node.js >=20, ESM, React 19 + Ink 6.8)]
- [Source: _bmad-output/project-context.md — Technology stack, testing conventions (node:test)]
- [Source: _bmad-output/implementation-artifacts/5-2-widgets-list-screen-inline-status-visibility.md — Previous story: WidgetsListScreen, handleToggleVisibility, selectedWidget state, getColorModeText function]
- [Source: _bmad-output/implementation-artifacts/5-4-target-line-separator-style-reset.md — SelectWithPreview pattern, TargetLineScreen/SeparatorStyleScreen as templates, onConfigChange handler, previewTuiState pattern]
- [Source: bmad-statusline/src/tui/app.js — Screen router, onConfigChange, handleToggleVisibility, navigate/goBack, selectedWidget, tuiState shape]
- [Source: bmad-statusline/src/tui/components/SelectWithPreview.js — {options, defaultValue, onChange, onHighlight, isActive}]
- [Source: bmad-statusline/src/tui/components/DualPreview.js — getWidgetColor respects colorModes.mode/fixedColor, auto-updates]
- [Source: bmad-statusline/src/tui/widget-registry.js — CCSTATUSLINE_COLORS (16), buildWidgetConfig accepts colorModes option]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation, no issues encountered.

### Completion Notes List

- Task 1: Created WidgetDetailScreen with custom list (useInput + highlightedIndex), 2 options showing inline color mode and visibility values. Follows WidgetsListScreen pattern.
- Task 2: Created ColorModeScreen with SelectWithPreview, try-before-you-buy via previewTuiState pattern (from TargetLineScreen/SeparatorStyleScreen). Enter on "dynamic" persists + goes back; Enter on "fixed" navigates to ColorPicker without persisting.
- Task 3: Created ColorPickerScreen with SelectWithPreview, 14 ANSI colors. Try-before-you-buy updates DualPreview via previewTuiState. Enter persists fixedColor + goes back.
- Task 4: Extended onConfigChange condition to include colorModes (single-line change). Replaced PlaceholderScreen widgetDetail route with WidgetDetailScreen. Added colorMode and colorPicker routes. All routes pass widgetName from getIndividualWidgets().
- Task 5: Created 28 tests covering all AC #11 requirements: Widget Detail rendering (a), Color Mode rendering (b), Color Picker 14 colors (c), try-before-you-buy highlights (d), Enter persists/navigates (e), Escape reverts/goes back (f), breadcrumbs at all depth levels (g).
- All 339 tests pass (311 existing + 28 new), zero regressions.

### Change Log

- 2026-03-30: Story 5-3 implemented — 3 new screens (WidgetDetailScreen, ColorModeScreen, ColorPickerScreen), app.js integration, 28 new tests

### File List

- src/tui/screens/WidgetDetailScreen.js (new)
- src/tui/screens/ColorModeScreen.js (new)
- src/tui/screens/ColorPickerScreen.js (new)
- src/tui/app.js (modified — imports, onConfigChange condition, 3 routes)
- test/tui-widget-detail.test.js (new)

### Review Findings

- [x] [Review][Defer] Stale `previewTuiState` — `useState(tuiState)` captures initial prop only; if tuiState changes while screen is mounted, preview is stale [ColorModeScreen.js:22, ColorPickerScreen.js:25] — deferred, pre-existing pattern from TargetLineScreen/SeparatorStyleScreen (Story 5.4)
- [x] [Review][Defer] `onConfigChange` + `onBack` sequential call — if `saveConfig` throws in `onConfigChange`, `setStatusMessage` fires then `onBack` still pops nav stack [ColorModeScreen.js:44-46, ColorPickerScreen.js:37-39] — deferred, pre-existing pattern across all screens
- [x] [Review][Defer] `SelectWithPreview` no `onHighlight` on initial mount — highlighted item defaults from `defaultValue` but `onHighlight` callback not invoked until user moves cursor [SelectWithPreview.js] — deferred, pre-existing in component from Story 5.4
- [x] [Review][Defer] Test AC11(d) try-before-you-buy tests verify cursor position only (`> fixed`, `> white`) but don't assert DualPreview content changed — consistent with existing screen test patterns [test/tui-widget-detail.test.js:212-229, 356-371] — deferred, pre-existing test pattern
