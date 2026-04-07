# Story 5.4: Target Line + Separator Style + Reset to Original

Status: done

## Story

As a **developer customizing the statusline layout**,
I want **to choose which terminal line the status bar occupies, customize the separator between widgets, and reset all changes to the original launch state**,
So that **I can control the visual layout of my statusline and safely experiment knowing I can revert everything**.

## Acceptance Criteria

1. **Target Line screen:** Given developer presses Enter on "Target Line" from Home screen, then displays: breadcrumb `Home > Target Line`, title "Choose which status bar line to use", list with 3 options ("Line 0 (top)", "Line 1 (middle)", "Line 2 (bottom)"), current selection highlighted, shortcut bar `↑↓ Navigate  Enter Select  Esc Back`.

2. **Target Line try-before-you-buy:** Given Target Line screen is displayed, when developer arrow-keys to highlight a line option, then DualPreview updates temporarily to show the highlighted target line value.

3. **Target Line persist:** Given developer presses Enter on a line option, then target line is persisted to config and DualPreview shows committed value.

4. **Target Line escape:** Given developer presses Escape on Target Line screen, then preview reverts to last persisted value and returns to Home.

5. **Separator Style screen:** Given developer presses Enter on "Separator Style" from Home screen, then displays: breadcrumb `Home > Separator Style`, title "Choose separator between widgets", list with 4 options showing preview: "tight" (`myproject┃dev-story`), "moderate" (`myproject ┃ dev-story`), "wide" (`myproject  ┃  dev-story`), "custom" ("Enter custom separator string"), shortcut bar `↑↓ Navigate  Enter Select  Esc Back`.

6. **Separator try-before-you-buy:** Given Separator Style screen is displayed, when developer arrow-keys to highlight a separator option, then DualPreview updates temporarily with highlighted separator style.

7. **Separator persist:** Given developer presses Enter on "tight", "moderate", or "wide", then separator is persisted and DualPreview updates.

8. **Custom separator:** Given developer presses Enter on "custom", then TextInput opens pre-filled with current separator value. Enter confirms and persists. Escape cancels and returns to separator list.

9. **Separator escape:** Given developer presses Escape on Separator Style screen (in select mode), then preview reverts to persisted value and returns to Home.

10. **Reset to original:** Given developer presses Enter on "Reset to original" from Home screen, then config snapshot taken at TUI launch is restored, DualPreview updates, Home screen remains displayed. _(Already implemented in story 5-1 — verify it works correctly with new `customSeparator` field.)_

11. **Tests:** Tests cover: (a) Target Line renders 3 options with correct selection, (b) Separator Style renders 4 options with inline preview text, (c) custom separator TextInput pre-fills current value, (d) try-before-you-buy on both screens, (e) Reset restores launch snapshot and updates preview, (f) Escape reverts and returns to Home.

## Tasks / Subtasks

- [x] Task 1: Create SelectWithPreview shared component (AC: #2, #6)
  - [x] 1.1 Create `src/tui/components/SelectWithPreview.js` — custom select built with `useInput`, renders option list with `>` indicator, fires `onHighlight` on arrow keys and `onChange` on Enter
  - [x] 1.2 Props: `options` (`[{label, value}]`), `defaultValue`, `onChange`, `onHighlight`, `isActive`
- [x] Task 2: Create TargetLineScreen (AC: #1, #2, #3, #4)
  - [x] 2.1 Create `src/tui/screens/TargetLineScreen.js` — 3 options, try-before-you-buy via local preview state, persist on Enter, revert+back on Escape
- [x] Task 3: Create SeparatorStyleScreen (AC: #5, #6, #7, #8, #9)
  - [x] 3.1 Create `src/tui/screens/SeparatorStyleScreen.js` — dual-mode: select mode (4 options) + TextInput mode (custom separator)
  - [x] 3.2 Select mode: try-before-you-buy, Enter on tight/moderate/wide persists, Enter on "custom" switches to TextInput mode
  - [x] 3.3 TextInput mode: pre-fill current value, Enter confirms+persists, Escape returns to select mode (not to Home)
- [x] Task 4: Update app.js — config change handler + routing (AC: #1, #5, #10)
  - [x] 4.1 Add `customSeparator` field to tuiState — update `deriveTuiState` and `buildDefaultTuiState`
  - [x] 4.2 Add `onConfigChange(changes)` callback — merges changes into tuiState, rebuilds rawConfig, saves, handles errors
  - [x] 4.3 Route `'targetLine'` and `'separator'` to new screen components (replace PlaceholderScreen)
  - [x] 4.4 Fix `buildDefaultTuiState` rawConfig: ensure 3 lines exist (`[defaultConfig, [], []]`)
- [x] Task 5: Update DualPreview custom separator (AC: #6, #8)
  - [x] 5.1 Change DualPreview to read `tuiState.customSeparator` instead of `colorModes._customSeparator`
- [x] Task 6: Write tests (AC: #11)
  - [x] 6.1 Create `test/tui-target-line.test.js` — renders 3 options, default highlight, Escape back
  - [x] 6.2 Create `test/tui-separator.test.js` — renders 4 options with preview labels, custom TextInput
  - [x] 6.3 Create `test/tui-select-preview.test.js` — SelectWithPreview: highlight indicator, onHighlight callback, onChange callback

## Dev Notes

### File Plan

```
src/tui/
├── app.js                              # UPDATE: onConfigChange, customSeparator, routing
├── components/
│   ├── Breadcrumb.js                   # UNCHANGED
│   ├── DualPreview.js                  # UPDATE: read tuiState.customSeparator
│   ├── ScreenLayout.js                 # UNCHANGED
│   ├── ShortcutBar.js                  # UNCHANGED
│   └── SelectWithPreview.js            # NEW
└── screens/
    ├── HomeScreen.js                   # UNCHANGED
    ├── PlaceholderScreen.js            # UNCHANGED (still used for widgets, presets, order)
    ├── TargetLineScreen.js             # NEW
    └── SeparatorStyleScreen.js         # NEW
test/
├── tui-select-preview.test.js          # NEW
├── tui-target-line.test.js             # NEW
└── tui-separator.test.js              # NEW
```

### REUSE Unchanged

| File | API |
|------|-----|
| `config-loader.js` | `loadConfig(paths)` → `{ config, bmadWidgets, currentLine, error }` |
| `config-writer.js` | `saveConfig(config, paths)` → `{ success, error }` |
| `widget-registry.js` | `buildWidgetConfig(enabledIds, readerPath, opts)` — opts: `{ separatorStyle, customSeparator, colorModes }` |

### NO JSX — Use React.createElement

`const e = React.createElement` throughout. All code samples below use JSX for readability — translate to `e()` calls in implementation.

### SelectWithPreview — Custom Select Component

@inkjs/ui Select has **NO onHighlight callback** (confirmed in story 5-1). Build a custom select for try-before-you-buy:

```js
// src/tui/components/SelectWithPreview.js
export function SelectWithPreview({ options, defaultValue, onChange, onHighlight, isActive }) {
  const defaultIndex = Math.max(0, options.findIndex(o => o.value === defaultValue));
  const [index, setIndex] = useState(defaultIndex);

  useInput((input, key) => {
    if (key.upArrow) {
      const next = Math.max(0, index - 1);
      setIndex(next);
      if (onHighlight) onHighlight(options[next].value);
    }
    if (key.downArrow) {
      const next = Math.min(options.length - 1, index + 1);
      setIndex(next);
      if (onHighlight) onHighlight(options[next].value);
    }
    if (key.return) {
      if (onChange) onChange(options[index].value);
    }
  }, { isActive });

  return e(Box, { flexDirection: 'column' },
    ...options.map((opt, i) =>
      e(Text, { key: opt.value },
        i === index ? '> ' : '  ',
        opt.label
      )
    )
  );
}
```

**DO NOT handle Escape** inside SelectWithPreview — the parent screen handles Escape for revert+back.

This component will be reused by story 5.3 (Color Picker) and potentially 5.5.

### Try-Before-You-Buy Pattern

Each screen manages a local `previewTuiState` for temporary preview:

```js
function TargetLineScreen({ tuiState, onConfigChange, onBack, isActive }) {
  // Local preview state — separate from persisted tuiState
  const [previewTuiState, setPreviewTuiState] = useState(tuiState);

  const handleHighlight = (value) => {
    setPreviewTuiState({ ...tuiState, targetLine: value });
  };

  const handleSelect = (value) => {
    onConfigChange({ targetLine: value });
    onBack();
  };

  useInput((_input, key) => {
    if (key.escape) onBack();
  }, { isActive });

  return e(ScreenLayout, {
    breadcrumb: ['Home', 'Target Line'],
    title: 'Choose which status bar line to use',
    shortcuts: TARGET_LINE_SHORTCUTS,
    tuiState: previewTuiState,  // ← LOCAL preview state, not persisted tuiState
  },
    e(SelectWithPreview, { ... })
  );
}
```

**Key insight:** ScreenLayout receives `tuiState` for DualPreview. Pass the local `previewTuiState` to show temporary changes. When user presses Escape, the parent (app.js) renders with the real persisted `tuiState` — preview auto-reverts.

### Target Line Options

```js
const TARGET_LINE_OPTIONS = [
  { label: 'Line 0 (top)', value: 0 },
  { label: 'Line 1 (middle)', value: 1 },
  { label: 'Line 2 (bottom)', value: 2 },
];

const TARGET_LINE_SHORTCUTS = [
  { key: '↑↓', label: 'Navigate' },
  { key: 'Enter', label: 'Select' },
  { key: 'Esc', label: 'Back' },
];
```

### Separator Style Options

```js
const SEPARATOR_OPTIONS = [
  { label: 'tight      myproject\u2503dev-story\u25034.2 - Auth Login', value: 'serre' },
  { label: 'moderate   myproject \u2503 dev-story \u2503 4.2 - Auth Login', value: 'modere' },
  { label: 'wide       myproject  \u2503  dev-story  \u2503  4.2 - Auth Login', value: 'large' },
  { label: 'custom     Enter custom separator string', value: 'custom' },
];
```

**Display name → internal name mapping:**
- "tight" = `'serre'`
- "moderate" = `'modere'`
- "wide" = `'large'`
- "custom" = `'custom'`

### Separator Screen — Dual Mode

Two modes: select mode (4-option list) and TextInput mode (editing custom separator).

```js
function SeparatorStyleScreen({ tuiState, onConfigChange, onBack, isActive }) {
  const [mode, setMode] = useState('select'); // 'select' | 'textInput'
  const [previewTuiState, setPreviewTuiState] = useState(tuiState);

  const handleHighlight = (value) => {
    setPreviewTuiState({ ...tuiState, separator: value });
  };

  const handleSelect = (value) => {
    if (value === 'custom') {
      setMode('textInput');
      return;
    }
    onConfigChange({ separator: value, customSeparator: null });
    // Stay on screen — user can change again. Do NOT call onBack().
  };

  // TextInput submit
  const handleCustomSubmit = (value) => {
    onConfigChange({ separator: 'custom', customSeparator: value });
    setMode('select');
  };

  useInput((_input, key) => {
    if (key.escape) {
      if (mode === 'textInput') {
        setMode('select');
        setPreviewTuiState(tuiState);  // Revert preview
      } else {
        onBack();
      }
    }
  }, { isActive });

  if (mode === 'textInput') {
    return e(ScreenLayout, { ..., tuiState: previewTuiState },
      e(Text, null, 'Enter custom separator:'),
      e(Text, null, ' '),
      e(TextInput, {
        defaultValue: getCurrentSeparatorContent(tuiState),
        onSubmit: handleCustomSubmit,
      })
    );
  }

  return e(ScreenLayout, { ..., tuiState: previewTuiState },
    e(SelectWithPreview, { options: SEPARATOR_OPTIONS, ... })
  );
}
```

**Escape behavior by mode:**
- Select mode: Escape → back to Home
- TextInput mode: Escape → back to select mode (cancel input, revert preview)

**Persist behavior:** After selecting tight/moderate/wide, the screen stays displayed (unlike Target Line which goes back on Enter). This lets the user compare styles rapidly.

### TextInput Pre-fill — getCurrentSeparatorContent Helper

```js
// Known separator content strings (from widget-registry.js SEPARATOR_STYLES — not exported)
const SEPARATOR_CONTENT = {
  serre:  '   ',         // 3 spaces
  modere: '      ',      // 6 spaces
  large:  '               ', // 15 spaces
};

function getCurrentSeparatorContent(tuiState) {
  if (tuiState.separator === 'custom' && tuiState.customSeparator) {
    return tuiState.customSeparator;
  }
  return SEPARATOR_CONTENT[tuiState.separator] || SEPARATOR_CONTENT.serre;
}
```

### @inkjs/ui TextInput API (v2.0)

```js
import { TextInput } from '@inkjs/ui';

e(TextInput, {
  defaultValue: 'pre-filled text',       // Initial value
  placeholder: 'Type here...',           // Grey text when empty
  onSubmit: (value) => { /* Enter */ },  // Fires on Enter with final text
})
```

- **No onCancel** — handle Escape via `useInput` in parent screen
- `isDisabled` — set true when screen is inactive

### onConfigChange — Centralized Config Update in app.js

Add to app.js:

```js
const onConfigChange = (changes) => {
  const newTuiState = { ...tuiState, ...changes };

  let newRawConfig;
  if (changes.targetLine !== undefined && changes.targetLine !== tuiState.targetLine) {
    // Move bmad widgets between lines
    newRawConfig = moveWidgetsToLine(tuiState.rawConfig, tuiState.targetLine, changes.targetLine);
  } else if (changes.separator !== undefined || changes.customSeparator !== undefined) {
    // Rebuild widget array with new separator
    newRawConfig = rebuildWithSeparator(newTuiState, paths);
  } else {
    newRawConfig = structuredClone(tuiState.rawConfig);
  }

  newTuiState.rawConfig = newRawConfig;
  setTuiState(newTuiState);

  const result = saveConfig(newRawConfig, paths);
  if (!result.success) {
    setStatusMessage({ variant: 'error', text: 'Could not save configuration. Press any key.' });
  }
};
```

**This handler will be reused by stories 5.2 (visibility), 5.3 (color modes), 5.5 (widget order).** Keep it generic.

### moveWidgetsToLine — Target Line Config Mutation

```js
function moveWidgetsToLine(rawConfig, oldLine, newLine) {
  const config = structuredClone(rawConfig);
  // Ensure all 3 lines exist (buildDefaultTuiState only creates 1 line)
  while (config.lines.length < 3) config.lines.push([]);

  const isBmad = w => w.id.startsWith('bmad-') || w.id.startsWith('sep-bmad-');

  // Extract bmad widgets from old line
  const bmadWidgets = config.lines[oldLine].filter(isBmad);
  // Remove them from old line (keep non-bmad widgets)
  config.lines[oldLine] = config.lines[oldLine].filter(w => !isBmad(w));
  // Append to new line
  config.lines[newLine] = [...config.lines[newLine], ...bmadWidgets];

  return config;
}
```

**BUG FIX NEEDED:** `buildDefaultTuiState` creates `rawConfig: { lines: [defaultConfig] }` — only 1 line element. Moving to line 1 or 2 would crash. Fix `buildDefaultTuiState`:

```js
rawConfig: { lines: [defaultConfig, [], []] },  // Always 3 lines
```

### rebuildWithSeparator — Separator Config Mutation

```js
function rebuildWithSeparator(newTuiState, paths) {
  const enabledWidgets = newTuiState.widgetOrder.filter(
    id => newTuiState.visibleWidgets.includes(id)
  );
  const readerPath = (paths && paths.readerPath) || path.join(os.homedir(), '.config', 'bmad-statusline', 'bmad-sl-reader.js');

  const widgetLine = buildWidgetConfig(enabledWidgets, readerPath, {
    separatorStyle: newTuiState.separator === 'custom' ? 'custom' : newTuiState.separator,
    customSeparator: newTuiState.customSeparator || '   ',
    colorModes: newTuiState.colorModes,
  });

  const config = structuredClone(newTuiState.rawConfig);
  while (config.lines.length < 3) config.lines.push([]);

  const isBmad = w => w.id.startsWith('bmad-') || w.id.startsWith('sep-bmad-');
  // Remove old bmad widgets from target line
  config.lines[newTuiState.targetLine] = config.lines[newTuiState.targetLine].filter(w => !isBmad(w));
  // Add rebuilt widgets
  config.lines[newTuiState.targetLine] = [...config.lines[newTuiState.targetLine], ...widgetLine];

  return config;
}
```

### Add customSeparator to tuiState

**deriveTuiState — replace length-based detection with exact match + custom fallback:**

```js
// Known separator content for exact matching
const KNOWN_SEPARATORS = {
  '   ': 'serre',
  '      ': 'modere',
  '               ': 'large',
};

function deriveTuiState(result) {
  // ... existing colorModes logic unchanged ...

  let separator = 'serre';
  let customSeparator = null;

  if (result.config && result.config.lines) {
    const line = result.config.lines[result.currentLine];
    if (Array.isArray(line)) {
      const sep = line.find(w => w && w.type === 'separator');
      if (sep && sep.content) {
        const match = KNOWN_SEPARATORS[sep.content];
        if (match) {
          separator = match;
        } else {
          separator = 'custom';
          customSeparator = sep.content;
        }
      }
    }
  }

  return {
    visibleWidgets: result.bmadWidgets.map(w => w.id),
    widgetOrder: result.bmadWidgets.map(w => w.id),
    colorModes,
    separator,
    customSeparator,
    targetLine: result.currentLine,
    rawConfig: result.config,
  };
}
```

**buildDefaultTuiState — add customSeparator + fix rawConfig lines:**

```js
return {
  visibleWidgets: defaultEnabled,
  widgetOrder: defaultEnabled,
  colorModes,
  separator: 'serre',
  customSeparator: null,     // ADD
  targetLine: 0,
  rawConfig: { lines: [defaultConfig, [], []] },  // FIX: 3 lines
};
```

### DualPreview — Fix Custom Separator Source

Current code (line 53-55 of DualPreview.js) reads custom separator from a hidden `colorModes._customSeparator` field:

```js
// CURRENT (bad):
const sep = separator === 'custom'
  ? (colorModes._customSeparator || ' | ')
  : (VISUAL_SEPARATORS[separator] || VISUAL_SEPARATORS.modere);
```

**Replace with tuiState.customSeparator:**

```js
// NEW:
const { widgetOrder, visibleWidgets, colorModes, separator, customSeparator } = tuiState;
// ...
const sep = separator === 'custom'
  ? (customSeparator || ' | ')
  : (VISUAL_SEPARATORS[separator] || VISUAL_SEPARATORS.modere);
```

Update `buildLine` signature to accept `customSeparator` parameter, or destructure it from `tuiState` in the `DualPreview` body and pass it through.

### Screen Router Update in app.js

Add imports and replace placeholder routes:

```js
import { TargetLineScreen } from './screens/TargetLineScreen.js';
import { SeparatorStyleScreen } from './screens/SeparatorStyleScreen.js';

// In screen router:
if (screen === 'targetLine') {
  return e(TargetLineScreen, {
    tuiState,
    onConfigChange,
    onBack: goBack,
    isActive: !statusMessage,
  });
}
if (screen === 'separator') {
  return e(SeparatorStyleScreen, {
    tuiState,
    onConfigChange,
    onBack: goBack,
    isActive: !statusMessage,
  });
}
```

### Reset to Original — Verify Only

Already implemented in app.js `resetToOriginal()`. Verify:
1. `structuredClone(snapshot)` includes `customSeparator` field (it will, since snapshot is taken from tuiState which now has it)
2. DualPreview updates correctly after restore
3. No additional work needed

### Testing Strategy

Tests use `node:test` + `node:assert/strict` + `ink-testing-library` (installed in story 5-1).

**ink-testing-library key simulation:**
```js
const { lastFrame, stdin } = render(e(Component, props));
stdin.write('\x1B[A');  // Up arrow
stdin.write('\x1B[B');  // Down arrow
stdin.write('\r');       // Enter
stdin.write('\x1B');    // Escape
```

**Mock tuiState for tests:**
```js
const mockTuiState = {
  visibleWidgets: ['bmad-project', 'bmad-workflow', 'bmad-progressstep', 'bmad-story', 'bmad-timer'],
  widgetOrder: ['bmad-project', 'bmad-workflow', 'bmad-progressstep', 'bmad-story', 'bmad-timer'],
  colorModes: {
    'bmad-project': { mode: 'dynamic' },
    'bmad-workflow': { mode: 'dynamic' },
    'bmad-progressstep': { mode: 'dynamic' },
    'bmad-story': { mode: 'dynamic' },
    'bmad-timer': { mode: 'dynamic' },
  },
  separator: 'serre',
  customSeparator: null,
  targetLine: 0,
  rawConfig: { lines: [[], [], []] },
};
```

**Test cases per file:**

`test/tui-select-preview.test.js`:
- Renders options with `>` on default highlighted item
- Arrow down moves highlight indicator
- Calls `onHighlight` with option value on arrow key
- Calls `onChange` with option value on Enter

`test/tui-target-line.test.js`:
- Renders 3 line options: "Line 0", "Line 1", "Line 2"
- Default highlight matches current targetLine
- Escape calls onBack

`test/tui-separator.test.js`:
- Renders 4 separator options with inline preview text
- Labels contain "tight", "moderate", "wide", "custom"
- Escape calls onBack

### Existing Tests — Do NOT Modify

| File | Tests |
|------|-------|
| `test/tui-config-loader.test.js` | config-loader.js |
| `test/tui-config-writer.test.js` | config-writer.js |
| `test/tui-widget-registry.test.js` | widget-registry.js |
| `test/tui-components.test.js` | Shared components (Breadcrumb, ShortcutBar, DualPreview, ScreenLayout) |
| `test/tui-app.test.js` | App + Home screen |

### What This Story Does NOT Do

- Does NOT build the Widgets List screen (Story 5.2)
- Does NOT build Widget Detail / Color Mode / Color Picker screens (Story 5.3)
- Does NOT build Widget Order / ReorderList (Story 5.5)
- Does NOT build Presets / ConfirmDialog (Story 5.6)
- Does NOT modify config-loader.js, config-writer.js, or widget-registry.js
- Does NOT modify any hook, reader, or installer code

### Project Structure Notes

- All new TUI files are ESM (`import`/`export`)
- Components in `src/tui/components/`, screens in `src/tui/screens/`
- Run tests: `npm test` from `bmad-statusline/` (runs `node --test test/*.test.js`)
- Currently 245+ tests passing — new tests must not break existing ones

### Previous Story Intelligence

From Story 5-1 (completed):
- `const e = React.createElement` — no JSX, no build tooling
- Screen router: `screen` state + `navStack` for back-tracking
- ScreenLayout enforces vertical structure (breadcrumb/title/content/preview/shortcuts)
- DualPreview renders from `tuiState` prop — pass local preview state for try-before-you-buy
- `structuredClone()` for deep copies (Node.js >= 20)
- StatusMessage overlay with any-key dismiss for write errors
- Review found: `preserveColors: undefined` treated as `false` — be defensive with boolean checks
- Review found: `launchTui` must return `waitUntilExit()` (caller contract)
- 245 tests passing after story 5-1

### Git Intelligence

Recent commits:
- `b825790 fix(5-1-app-shell-shared-components-home-screen): code review corrections`
- `0a29747 5-1-app-shell-shared-components-home-screen: App shell + shared components + Home screen`

Convention: `{story-key}: {description}`, review fixes: `fix({story-key}): code review corrections`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.4 — AC, BDD scenarios (lines 1237-1296)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Target Line mockup (screen 8), Separator mockup (screen 9), try-before-you-buy, TextInput patterns, DualPreview spec]
- [Source: _bmad-output/planning-artifacts/architecture.md — TUI boundary 6, config format, widget-registry API, tech stack]
- [Source: _bmad-output/implementation-artifacts/5-1-app-shell-shared-components-home-screen.md — Screen router, component patterns, Select API (no onHighlight), testing]
- [Source: bmad-statusline/src/tui/app.js — Screen router, tuiState schema, deriveTuiState, resetToOriginal, buildDefaultTuiState]
- [Source: bmad-statusline/src/tui/components/DualPreview.js — VISUAL_SEPARATORS, colorModes._customSeparator hack (line 53-55)]
- [Source: bmad-statusline/src/tui/widget-registry.js — buildWidgetConfig(ids, path, opts), SEPARATOR_STYLES (not exported): serre=3sp, modere=6sp, large=15sp]
- [Source: bmad-statusline/src/tui/config-writer.js — saveConfig(config, paths) → {success, error}]
- [Source: @inkjs/ui v2.0 — Select: no onHighlight; TextInput: defaultValue + onSubmit; StatusMessage: variant prop]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation with no blockers.

### Completion Notes List

- Task 1: Created SelectWithPreview.js — custom select component with `useInput`, `>` highlight indicator, boundary-safe arrow navigation, `onHighlight` and `onChange` callbacks. 8 tests.
- Task 2: Created TargetLineScreen.js — 3 line options (0/1/2), try-before-you-buy via local `previewTuiState`, persist on Enter + navigate back, revert on Escape. 6 tests.
- Task 3: Created SeparatorStyleScreen.js — dual-mode screen (select + TextInput). Select shows 4 separator styles with inline preview. "custom" switches to TextInput mode with pre-filled current value. Escape behavior differs by mode. 7 tests.
- Task 4: Updated app.js — added `customSeparator` to tuiState in both `deriveTuiState` (exact-match detection replacing length-based heuristic) and `buildDefaultTuiState` (fixed rawConfig to always have 3 lines). Added generic `onConfigChange` handler with `moveWidgetsToLine` and `rebuildWithSeparator` helpers. Added screen routes for `targetLine` and `separator`. Fixed `handleToggleVisibility` to use `tuiState.customSeparator` instead of `colorModes._customSeparator`.
- Task 5: Updated DualPreview.js — `buildLine` now accepts `customSeparator` parameter; `DualPreview` destructures it from `tuiState` instead of reading hidden `colorModes._customSeparator` field.
- Task 6: All 3 test files created. 21 new tests total. Full suite: 310 tests, 0 failures.

### Change Log

- 2026-03-30: Story 5-4 implemented — Target Line screen, Separator Style screen, SelectWithPreview component, onConfigChange handler, DualPreview fix, 21 new tests

### Review Findings

- [x] [Review][Patch] `handleOrderCommit` ne passe pas `customSeparator` à `buildWidgetConfig` [app.js:218] ✓ fixed
- [x] [Review][Patch] Preset save/load omet `customSeparator` du snapshot et de la restauration [app.js:269,294] ✓ fixed
- [x] [Review][Patch] `onConfigChange` manque try/catch autour de `saveConfig` (pattern existant dans le reste du fichier) [app.js:254] ✓ fixed
- [x] [Review][Patch] `moveWidgetsToLine` ne protège pas les indices >= 3 — pad to max(oldLine, newLine) [app.js:94] ✓ fixed
- [x] [Review][Patch] `isBmad` dupliqué dans `moveWidgetsToLine` et `rebuildWithSeparator` — extraire au niveau module [app.js:98,113] ✓ fixed
- [x] [Review][Patch] Custom separator vide `''` crée incohérence état/affichage — guard dans handleCustomSubmit [SeparatorStyleScreen.js:59] ✓ fixed
- [x] [Review][Patch] Tests try-before-you-buy manquants pour TargetLineScreen et SeparatorStyleScreen [AC#11(d)] ✓ fixed
- [x] [Review][Patch] Test manquant : Escape en mode TextInput retourne au select (pas Home) [AC#11(f)] ✓ fixed
- [x] [Review][Defer] `KNOWN_SEPARATORS`/`SEPARATOR_CONTENT` dupliqués avec widget-registry.js — deferred, hors scope story
- [x] [Review][Defer] Tests utilisent `delay(50)` fixe — pattern flaky préexistant — deferred, pre-existing
- [x] [Review][Defer] `MOCK_TUI_STATE` dans tui-app.test.js manque `customSeparator: null` — deferred, pas d'impact fonctionnel

### File List

New files:
- bmad-statusline/src/tui/components/SelectWithPreview.js
- bmad-statusline/src/tui/screens/TargetLineScreen.js
- bmad-statusline/src/tui/screens/SeparatorStyleScreen.js
- bmad-statusline/test/tui-select-preview.test.js
- bmad-statusline/test/tui-target-line.test.js
- bmad-statusline/test/tui-separator.test.js

Modified files:
- bmad-statusline/src/tui/app.js
- bmad-statusline/src/tui/components/DualPreview.js
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/5-4-target-line-separator-style-reset.md
