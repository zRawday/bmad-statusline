# Story 6.5: TUI v2 Sub-screens — Color Picker, Preset Save/Load, Reorder Lines

Status: done

## Story

As a developer configuring widget colors, saving presets, and rearranging line layout,
I want a color picker with Dynamic option for workflow, preset save/load from 3 shared slots with mini-preview, and a line reorder screen that swaps entire line contents,
So that I can fully customize my statusline appearance, quickly switch between configurations, and arrange lines to my preference.

## Acceptance Criteria

### AC1: Color Picker — Dynamic for Workflow

Given the user presses `c` on the `bmad-workflow` widget in Edit Line
When the Color Picker screen opens
Then the breadcrumb shows `Home > Edit Line N > Color: Workflow`
And the list shows `Dynamic` as the first option, followed by 14 ANSI colors (red, green, yellow, blue, magenta, cyan, white, brightRed, brightGreen, brightYellow, brightBlue, brightMagenta, brightCyan, brightWhite)
And the current color mode is pre-highlighted
And the shortcut bar shows `↑↓ Navigate  Enter Select  Esc Back`

### AC2: Color Picker — Non-Workflow (Fixed Only)

Given the user presses `c` on any widget other than `bmad-workflow`
When the Color Picker screen opens
Then the `Dynamic` option is NOT shown — only 14 fixed ANSI colors
And the current `fixedColor` is pre-highlighted

### AC3: Color Picker — Try-Before-You-Buy Preview

Given the user navigates the Color Picker list with arrow keys
When each color is highlighted
Then `previewOverride` updates to show the highlighted color on the widget (Pattern 17)
And the 3-line preview reflects the temporary color in real time

### AC4: Color Picker — Selection Persists

Given the user presses Enter on a color in Color Picker
When the selection is confirmed
Then `updateConfig` sets the widget's colorMode to `{ mode: "fixed", fixedColor: selectedColor }` (or `{ mode: "dynamic" }` if Dynamic selected)
And `previewOverride` is cleared
And the screen returns to Edit Line

### AC5: Color Picker — Cancellation Reverts

Given the user presses Escape in Color Picker
When the cancel is processed
Then `previewOverride` is cleared (reverts to persisted config)
And no config change occurs
And the screen returns to Edit Line

### AC6: Preset Save Screen

Given the user presses `s` in Edit Line
When the Preset Save screen opens
Then the breadcrumb shows `Home > Edit Line N > Save Preset`
And 3 slots are listed, each showing: slot number + name + mini-preview of stored widgets (or `(empty)` dim)
And the shortcut bar shows `↑↓ Navigate  Enter Save here  Esc Back`

### AC7: Preset Save — Empty Slot

Given the user selects an empty preset slot for save
When Enter is pressed
Then a TextInput prompt appears for naming the preset
And on Enter: the current line's `widgets` + `colorModes` are saved to the slot with the given name, config is persisted
And on Escape: naming is cancelled, no save occurs

### AC8: Preset Save — Overwrite

Given the user selects a non-empty preset slot for save
When Enter is pressed
Then a ConfirmDialog appears: `Overwrite slot N (name)? Enter / Esc`
And Enter confirms: current line config replaces the slot, name preserved (or updated via TextInput)
And Escape cancels: no change

### AC9: Preset Load Screen

Given the user presses `l` in Edit Line
When the Preset Load screen opens
Then the breadcrumb shows `Home > Edit Line N > Load Preset`
And 3 slots are listed with mini-previews
And the shortcut bar shows `↑↓ Navigate  Enter Load  Esc Back`

### AC10: Preset Load — Try-Before-You-Buy

Given the user highlights a non-empty preset slot in Preset Load
When arrow keys move to it
Then `previewOverride` shows the current line replaced with the preset's content

### AC11: Preset Load — Confirmation

Given the user presses Enter on a non-empty preset slot in Preset Load
When the load is confirmed
Then `updateConfig` replaces `config.lines[editingLine].widgets` and `config.lines[editingLine].colorModes` with the preset's stored values (current line only, FR-V2-14)
And `previewOverride` is cleared
And the screen returns to Edit Line

### AC12: Preset Load — Empty Slot No-Op

Given the user presses Enter on an empty preset slot in Preset Load
When the action is processed
Then nothing happens (no-op — empty slot cannot be loaded)

### AC13: Reorder Lines Screen

Given the user selects "Reorder lines" from Home
When the Reorder Lines screen opens
Then the breadcrumb shows `Home > Reorder Lines`
And 3 lines are listed, each showing a summary of widget names (or `(empty)`)
And the shortcut bar shows `↑↓ Navigate  Enter Grab  Esc Back`

### AC14: Reorder Lines — Grab Mode

Given the user presses Enter on a line in Reorder Lines
When grab mode activates
Then the shortcut bar changes to `↑↓ Move  Enter Drop  Esc Cancel`
And the grabbed line shows a `← moving` marker
And arrow keys swap entire line contents (widgets, colorModes) with the adjacent line
And the 3-line preview updates live during swap
And Enter drops, persisting the swap via `updateConfig`
And Escape cancels, restoring original line positions

### AC15: Preset Persistence

Given presets persist across TUI sessions (FR-V2-13)
When the user saves a preset and relaunches the TUI
Then the preset is loaded from `config.json` presets array with name and content intact

### AC16: Tests

Given tests need to validate the changes
When tests are executed
Then `tui-screens.test.js` (or per-screen test files) tests: ColorPicker (Dynamic shown for workflow only, fixed colors for others, preview-on-highlight, selection persists), PresetSaveScreen (empty slot, overwrite confirm), PresetLoadScreen (replaces current line only, empty slot no-op), ReorderLinesScreen (swap contents, preview updates)
And all existing tests pass (`npm test`)

## Tasks / Subtasks

- [x] Task 1: Create PresetSaveScreen (AC: 6, 7, 8, 15)
  - [x] 1.1 Create `src/tui/screens/PresetSaveScreen.js`
  - [x] 1.2 Render 3 slots: slot number + name + mini-preview (visible widget names joined by `·`, colored via `resolvePreviewColor`), or `(empty)` dim
  - [x] 1.3 Breadcrumb: `['Home', 'Edit Line ${editingLine + 1}', 'Save Preset']`
  - [x] 1.4 On Enter (empty slot): show TextInput for name, then `updateConfig(cfg => { cfg.presets[slotIndex] = { name, widgets: [...cfg.lines[editingLine].widgets], colorModes: {...cfg.lines[editingLine].colorModes} }; })`
  - [x] 1.5 On Enter (non-empty slot): show ConfirmDialog `Overwrite slot N (name)?`, then on confirm: overwrite preset, on cancel: no-op
  - [x] 1.6 On Escape (TextInput or ConfirmDialog): cancel, no change
  - [x] 1.7 On Escape (list): `goBack()`
  - [x] 1.8 Use ScreenLayout with shortcuts `↑↓ Navigate  Enter Save here  Esc Back`
- [x] Task 2: Create PresetLoadScreen (AC: 9, 10, 11, 12)
  - [x] 2.1 Create `src/tui/screens/PresetLoadScreen.js`
  - [x] 2.2 Render 3 slots with mini-preview (same format as save screen)
  - [x] 2.3 Breadcrumb: `['Home', 'Edit Line ${editingLine + 1}', 'Load Preset']`
  - [x] 2.4 On highlight (non-empty slot): `setPreviewOverride(configWithPresetApplied)` — try-before-you-buy (Pattern 17)
  - [x] 2.5 On Enter (non-empty slot): `updateConfig(cfg => { cfg.lines[editingLine].widgets = [...preset.widgets]; cfg.lines[editingLine].colorModes = {...preset.colorModes}; })`, `setPreviewOverride(null)`, `goBack()`
  - [x] 2.6 On Enter (empty slot): no-op
  - [x] 2.7 On Escape: `goBack()` (clears previewOverride automatically)
  - [x] 2.8 Use ScreenLayout with shortcuts `↑↓ Navigate  Enter Load  Esc Back`
- [x] Task 3: Create ReorderLinesScreen (AC: 13, 14)
  - [x] 3.1 Create `src/tui/screens/ReorderLinesScreen.js`
  - [x] 3.2 Build items array: 3 entries with `{ id: '0', label: 'Line 1: project · workflow · ...' }` (or `(empty)`)
  - [x] 3.3 Breadcrumb: `['Home', 'Reorder Lines']`
  - [x] 3.4 Use existing `ReorderList` component — props: `{ items, isActive, onMove, onDrop, onCancel, onBack }`
  - [x] 3.5 `onMove(newOrder)`: `setPreviewOverride(configWithSwappedLines)` for live preview during swap
  - [x] 3.6 `onDrop(newOrder)`: `updateConfig(cfg => { reorder cfg.lines to match newOrder })`, `setPreviewOverride(null)`
  - [x] 3.7 `onCancel()`: `setPreviewOverride(null)` (revert preview, stay on screen)
  - [x] 3.8 `onBack()`: `goBack()`
  - [x] 3.9 Shortcut bar: navigate mode `↑↓ Navigate  Enter Grab  Esc Back`, grab mode `↑↓ Move  Enter Drop  Esc Cancel`
  - [x] 3.10 Use `onModeChange` callback from ReorderList to switch shortcut bar
- [x] Task 4: Wire screen routing in app.js (AC: all)
  - [x] 4.1 Import PresetSaveScreen, PresetLoadScreen, ReorderLinesScreen
  - [x] 4.2 Add `if (screen === 'presetSave')` route → `e(PresetSaveScreen, { ...screenProps })`
  - [x] 4.3 Add `if (screen === 'presetLoad')` route → `e(PresetLoadScreen, { ...screenProps })`
  - [x] 4.4 Add `if (screen === 'reorderLines')` route → `e(ReorderLinesScreen, { ...screenProps })`
  - [x] 4.5 Remove FallbackScreen (or keep for safety but no 6.5 screens should hit it)
- [x] Task 5: Create tests (AC: 16)
  - [x] 5.1 Create `test/tui-preset.test.js`: PresetSaveScreen (empty slot save, overwrite confirm/cancel, naming), PresetLoadScreen (load replaces current line, empty slot no-op, preview-on-highlight)
  - [x] 5.2 Create `test/tui-reorder-lines.test.js`: ReorderLinesScreen (renders 3 lines, swap contents, preview updates, drop persists, cancel reverts)
  - [x] 5.3 Verify all existing tests still pass (`npm test`)

## Dev Notes

### Architecture Patterns & Constraints

**State Model (already implemented in app.js — DO NOT modify):**
- `config` / `setConfig` — persisted v2 internal config
- `snapshot` — immutable launch snapshot (for reset only)
- `previewOverride` / `setPreviewOverride` — transient try-before-you-buy preview
- `editingLine` — 0|1|2, set by navigate context from EditLineScreen
- Screen routing via `screen` + `navStack` + `navigate()`/`goBack()`

**Pattern 15 — updateConfig (CRITICAL — never mutate config directly):**
```js
updateConfig(cfg => {
  // mutate cfg (deep clone already done by updateConfig)
  cfg.presets[slotIndex] = { name, widgets, colorModes };
});
```
- `structuredClone` done inside `updateConfig` — caller just mutates the clone
- Disk write + ccstatusline sync handled by `updateConfig`
- NEVER `config.lines[0].widgets.push(...)` — React won't detect

**Pattern 17 — previewOverride (try-before-you-buy):**
```js
// On highlight:
setPreviewOverride(() => {
  const preview = structuredClone(config);
  preview.lines[editingLine].widgets = [...preset.widgets];
  preview.lines[editingLine].colorModes = {...preset.colorModes};
  return preview;
});
// On select (Enter): updateConfig(...) + setPreviewOverride(null) + goBack()
// On cancel (Escape): goBack() clears previewOverride automatically
```

**Pattern 18 — Screen Props Contract (every screen receives):**
```js
{ config, updateConfig, previewOverride, setPreviewOverride, navigate, goBack, editingLine, selectedWidget, isActive }
```
- `isActive` gates `useInput` — false when statusMessage overlay shown
- All `useInput` hooks MUST be called unconditionally (before any conditional returns)

**Pattern 2 — Synchronous I/O everywhere.** No async/promises for file operations.

**Pattern 1 — Error Handling: TUI uses StatusMessage.** Never console.log, never crash on recoverable error.

### Internal Config Schema (Reference)

```json
{
  "separator": "serre",
  "customSeparator": null,
  "lines": [
    { "widgets": ["bmad-project", "bmad-workflow", ...], "colorModes": { "bmad-project": { "mode": "fixed", "fixedColor": "cyan" }, ... } },
    { "widgets": [], "colorModes": {} },
    { "widgets": [], "colorModes": {} }
  ],
  "presets": [null, null, null]
}
```

**Preset slot schema:**
```json
{ "name": "dev-focus", "widgets": ["bmad-project", "bmad-workflow"], "colorModes": { "bmad-project": {...}, "bmad-workflow": {...} } }
```
- `presets` is always length 3. Each slot is `null` (empty) or a preset object
- Preset saves `widgets` + `colorModes` for the current line only
- Preset load replaces current line's `widgets` + `colorModes` only (not other lines, not separator)

### Existing Components to Reuse (DO NOT recreate)

| Component | Location | Usage in 6.5 |
|-----------|----------|-------------|
| `ScreenLayout` | `src/tui/components/ScreenLayout.js` | Wraps every screen: `{ breadcrumb, config, previewOverride, shortcuts, children }` |
| `SelectWithPreview` | `src/tui/components/SelectWithPreview.js` | PresetLoadScreen (highlight → preview). Props: `{ options, defaultValue, onChange, onHighlight, isActive }` |
| `ReorderList` | `src/tui/components/ReorderList.js` | ReorderLinesScreen. Props: `{ items, isActive, onMove, onDrop, onCancel, onBack, onModeChange, initialMode, initialIndex }` |
| `ConfirmDialog` | `src/tui/components/ConfirmDialog.js` | PresetSaveScreen overwrite confirm. Props: `{ message, onConfirm, onCancel, isActive }` |
| `resolvePreviewColor()` | `src/tui/preview-utils.js` | Mini-preview color in preset slot display |
| `SAMPLE_VALUES` | `src/tui/preview-utils.js` | Mini-preview widget labels |
| `getIndividualWidgets()` | `src/tui/widget-registry.js` | Widget metadata (9 widgets) |
| `createDefaultConfig()` | `src/tui/widget-registry.js` | Test fixture defaults |

### Existing Screen Pattern to Follow (from ColorPickerScreen.js)

```js
import React from 'react';
import { useInput } from 'ink';
import { ScreenLayout } from '../components/ScreenLayout.js';
const e = React.createElement;

const SHORTCUTS = [{ key: '↑↓', label: 'Navigate' }, { key: 'Enter', label: 'Select' }, { key: 'Esc', label: 'Back' }];

export function MyScreen({ config, updateConfig, previewOverride, setPreviewOverride, goBack, editingLine, isActive }) {
  // Local state, handlers...
  useInput((_input, key) => {
    if (key.escape) goBack();
  }, { isActive });

  return e(ScreenLayout, { breadcrumb: [...], config, previewOverride, shortcuts: SHORTCUTS },
    // content children
  );
}
```

### Routing Wiring in app.js

EditLineScreen already calls:
- `navigate('presetSave')` on `s` key
- `navigate('presetLoad')` on `l` key

HomeScreen already calls:
- `navigate('reorderLines')` on "Reorder lines" menu item

Currently these all fall through to `FallbackScreen`. Add routes before the fallback.

### Mini-Preview Rendering for Preset Slots

Build a text summary of a preset's content for slot display:
```js
function formatPresetSlot(preset, slotIndex) {
  if (!preset) return `${slotIndex + 1}. (empty)`;  // dim
  const summary = preset.widgets.map(id => {
    const w = getIndividualWidgets().find(w => w.id === id);
    return w ? w.name : id;
  }).join(' · ');
  return `${slotIndex + 1}. ${preset.name}    ${summary}`;
}
```

### ReorderLines — Line Swap Logic

Swapping lines means swapping entire `{ widgets, colorModes }` objects:
```js
function swapLines(cfg, indexA, indexB) {
  const temp = cfg.lines[indexA];
  cfg.lines[indexA] = cfg.lines[indexB];
  cfg.lines[indexB] = temp;
}
```
Used inside `updateConfig(cfg => swapLines(cfg, ...))` on drop. ccstatusline sync triggers automatically via `syncCcstatuslineIfNeeded` if a line changed empty↔non-empty status.

### TextInput for Preset Naming

Use `TextInput` from `@inkjs/ui`:
```js
import { TextInput } from '@inkjs/ui';
// ...
e(TextInput, { placeholder: 'Preset name', onSubmit: (name) => { /* save */ }, isDisabled: !isActive })
```
On submit: save preset with given name. On Escape: cancel naming (set local state to dismiss TextInput).

### Project Structure Notes

- New files go in existing directories:
  - `src/tui/screens/PresetSaveScreen.js`
  - `src/tui/screens/PresetLoadScreen.js`
  - `src/tui/screens/ReorderLinesScreen.js`
  - `test/tui-preset.test.js`
  - `test/tui-reorder-lines.test.js`
- Modified file: `src/tui/app.js` (add 3 screen routes + imports)
- No new utility files needed — all helpers already exist

### Previous Story Intelligence (6.4)

**Key learnings from 6.4:**
- React hooks must be called unconditionally — `useInput` before any conditional returns (hooks violation fix)
- `g` key in EditLineScreen enters ReorderList in navigate mode, not immediate grab — resolved via `initialMode`/`initialIndex` props on ReorderList
- Hidden widget inline status uses `brightBlack` color (not `gray`)
- I/O inside React state updater (Pattern 15) is spec-mandated and acceptable
- Test baseline: 325 tests passing — must maintain or exceed

**Files created/modified in 6.4:**
- `src/tui/app.js` — REWRITE (v2 state model, screen routing with FallbackScreen for 6.5 placeholders)
- `src/tui/screens/EditLineScreen.js` — NEW (h/g/c/s/l shortcuts, all 9 widgets from registry)
- `src/tui/components/ThreeLinePreview.js` — NEW (3-line boxed preview)
- `src/tui/screens/HomeScreen.js` — REWRITE (6 v2 menu options)
- Tests: `tui-app.test.js`, `tui-components.test.js`, `tui-edit-line.test.js` (updated/new)

**Code conventions established:**
- `const e = React.createElement;` alias in every file
- `structuredClone` for deep copies (never spread for nested objects)
- Shortcuts as `[{ key, label }]` arrays passed to ScreenLayout
- Test helper: `makeScreenProps(overrides)` factory with standard defaults
- `delay(ms)` for async state settling in tests
- Keyboard sim: `stdin.write('\x1B[A')` up, `'\x1B[B'` down, `'\r'` Enter, `'\x1B'` Escape

### Git Intelligence

Recent commits show 6.4 (TUI v2 core) and 6.6 (installer v2) implemented. Story 6.5 fills the last TUI gap — sub-screens for presets and line reorder. The codebase has the full v2 infrastructure; this story adds the remaining screen implementations.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 6, Story 6.5] — User story, acceptance criteria, BDD scenarios
- [Source: _bmad-output/planning-artifacts/architecture.md#TUI Multi-Line State Model] — State model, updateConfig, previewOverride
- [Source: _bmad-output/planning-artifacts/architecture.md#Internal Config Schema] — config.json contract, preset schema
- [Source: _bmad-output/planning-artifacts/architecture.md#Screen Tree] — Navigation architecture max depth 2
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Screens 5-8] — Preset Save/Load, Reorder Lines UX
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Try-Before-You-Buy] — Preview-on-highlight interaction
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Preset Overwrite Confirmation] — ConfirmDialog for non-empty slot
- [Source: bmad-statusline/src/tui/app.js] — Current screen routing, FallbackScreen placeholder
- [Source: bmad-statusline/src/tui/screens/ColorPickerScreen.js] — Reference pattern for screen implementation
- [Source: bmad-statusline/src/tui/components/ReorderList.js] — ReorderList API (items, onMove, onDrop, onCancel, onBack, onModeChange)
- [Source: bmad-statusline/src/tui/components/ConfirmDialog.js] — ConfirmDialog API (message, onConfirm, onCancel, isActive)
- [Source: bmad-statusline/src/tui/components/SelectWithPreview.js] — SelectWithPreview API (options, defaultValue, onChange, onHighlight, isActive)
- [Source: _bmad-output/implementation-artifacts/6-4-tui-v2-core-app-shell-state-model-shared-components-home-edit-line.md] — Previous story learnings

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation, no debug issues encountered.

### Completion Notes List

- Task 1: Created PresetSaveScreen with 3-slot list, TextInput naming for empty slots, ConfirmDialog overwrite for non-empty slots, ScreenLayout with breadcrumb and shortcuts.
- Task 2: Created PresetLoadScreen with 3-slot list, try-before-you-buy preview on highlight (Pattern 17), load replaces current line only (FR-V2-14), empty slot no-op.
- Task 3: Created ReorderLinesScreen using existing ReorderList component with dual-mode shortcuts (navigate/moving), live preview on swap, drop persists via updateConfig, cancel reverts.
- Task 4: Wired 3 new screen routes in app.js, removed FallbackScreen (replaced with inline fallback text), added imports for all 3 screens.
- Task 5: Created 27 new tests (17 preset, 10 reorder). Full suite: 370 pass, 0 fail (baseline was 343).

### File List

- `bmad-statusline/src/tui/screens/PresetSaveScreen.js` — NEW
- `bmad-statusline/src/tui/screens/PresetLoadScreen.js` — NEW
- `bmad-statusline/src/tui/screens/ReorderLinesScreen.js` — NEW
- `bmad-statusline/src/tui/app.js` — MODIFIED (3 screen routes + imports, removed FallbackScreen)
- `bmad-statusline/test/tui-preset.test.js` — NEW
- `bmad-statusline/test/tui-reorder-lines.test.js` — NEW
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — MODIFIED (story status in-progress → review)

### Change Log

- 2026-04-01: Implemented story 6.5 — PresetSaveScreen, PresetLoadScreen, ReorderLinesScreen, app.js routing, 27 new tests (370 total pass)

### Review Findings

- [x] [Review][Decision] AC8 partial — overwrite preserves name only → FIXED: added rename TextInput after confirm (user chose to implement)
- [x] [Review][Patch] `handleDrop` reads stale `config` closure instead of `cfg` parameter [ReorderLinesScreen.js:50-54] → FIXED
- [x] [Review][Patch] `config.presets` may be undefined — crashes both preset screens if config.json missing `presets` key [PresetSaveScreen.js:32, PresetLoadScreen.js:28] → FIXED
- [x] [Review][Patch] `preset.widgets` undefined crashes `formatPresetSlot` if preset object has no widgets key [PresetSaveScreen.js:21, PresetLoadScreen.js:19] → FIXED
- [x] [Review][Patch] Inline fallback is a dead-end — no goBack, user trapped on unknown screen [app.js:131-133] → FIXED
- [x] [Review][Patch] Mini-preview doesn't use `resolvePreviewColor` for colored widget names (spec Task 1.2 + component reuse table) [PresetSaveScreen.js:18-26, PresetLoadScreen.js:16-24] → FIXED
- [x] [Review][Patch] ReorderLinesScreen stays on screen after drop — stale labels due to ReorderList useState(items) ignoring prop updates. Fix: goBack() after drop [ReorderLinesScreen.js:50-54] → FIXED
- [x] [Review][Defer] `formatPresetSlot` duplicated across PresetSaveScreen and PresetLoadScreen — DRY concern, spec says "no new utility files"
- [x] [Review][Defer] No preview on initial render for slot 0 in PresetLoadScreen — consistent with existing ColorPickerScreen pattern (SelectWithPreview doesn't fire onHighlight on mount either)
- [x] [Review][Defer] Tests use fixed 50ms `delay()` — CI-fragile, pre-existing pattern from story 6.4
- [x] [Review][Defer] PresetLoadScreen doesn't use `SelectWithPreview` component — spec violation but functionally correct, refactoring to match spec requires significant rework
