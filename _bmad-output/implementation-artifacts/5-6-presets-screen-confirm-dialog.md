# Story 5.6: Presets screen with ConfirmDialog

Status: done

## Story

As a **developer managing statusline configurations**,
I want **to save my current configuration to named presets, load them instantly, and delete unused ones**,
So that **I can quickly switch between different statusline setups for different workflows without reconfiguring from scratch**.

## Acceptance Criteria

1. **Given** the Home screen is displayed **When** the developer presses Enter on "Presets" **Then** the Presets screen displays:
   - Breadcrumb: `Home > Presets`
   - Title: "Load or manage configuration presets"
   - Select with 4 entries: "Default" (factory defaults), "Custom 1", "Custom 2", "Custom 3"
   - Saved presets show their name (e.g. `Custom 1  dev-focus (saved)`), empty slots show `(empty)` in dim text
   - Shortcut bar: `↑↓ Navigate  Enter Load  s Save current here  d Delete  Esc Back`

2. **Given** the Presets screen is displayed **When** the developer presses Enter on "Default" **Then** the factory default configuration is loaded, applied to config, persisted to file **And** the DualPreview updates immediately to show the default configuration.

3. **Given** the Presets screen is displayed **When** the developer presses Enter on a saved custom preset (e.g. "Custom 1 dev-focus") **Then** the preset's complete snapshot is loaded (widgets visibility + colors, order, target line, separator) **And** the config is persisted and the DualPreview updates.

4. **Given** the Presets screen is displayed with the cursor on an empty slot **When** the developer presses `s` **Then** a TextInput appears for the preset name **And** Enter confirms: the current config is saved to that slot with the given name, no confirmation needed **And** Escape cancels the save.

5. **Given** the Presets screen is displayed with the cursor on a saved preset **When** the developer presses `s` **Then** a ConfirmDialog appears: "Overwrite Custom 1 (dev-focus)? Enter / Esc" **And** Enter overwrites the preset with the current config **And** Escape cancels, no change.

6. **Given** the Presets screen is displayed with the cursor on a saved custom preset **When** the developer presses `d` **Then** the preset is deleted, the slot shows `(empty)` in dim text.

7. **Given** the Presets screen is displayed with the cursor on "Default" **When** the developer presses `d` **Then** nothing happens — the Default preset cannot be deleted.

8. **Given** the Presets screen is displayed **When** the developer presses Escape **Then** the screen returns to Home.

9. **Given** the ConfirmDialog component **When** visible **Then** it replaces the current screen content with the confirmation message and Enter/Esc options.

10. **Given** `test/tui-*.test.js` **When** updated for this story **Then** tests cover: (a) renders 4 preset entries with correct status (saved/empty), (b) Enter loads preset and updates config + preview, (c) `s` on empty slot opens TextInput, (d) `s` on saved slot shows ConfirmDialog, (e) `d` deletes custom preset, (f) `d` on Default is ignored, (g) ConfirmDialog Enter/Esc behavior, (h) Escape returns to Home.

## Tasks / Subtasks

- [x] Task 1: Create ConfirmDialog shared component (AC: #9)
  - [x] 1.1 Create `src/tui/components/ConfirmDialog.js` — single-line message overlay with Enter/Esc handling via `useInput`
  - [x] 1.2 Props: `{ message, onConfirm, onCancel, isActive }`
  - [x] 1.3 When visible, renders message text replacing screen content
  - [x] 1.4 Add ConfirmDialog unit tests to `test/tui-components.test.js`

- [x] Task 2: Create PresetsScreen component (AC: #1, #2, #3, #4, #5, #6, #7, #8)
  - [x] 2.1 Create `src/tui/screens/PresetsScreen.js`
  - [x] 2.2 Internal state: `mode` ('list' | 'naming' | 'confirm'), `presets` array (Default + 3 custom slots), `highlightedIndex`
  - [x] 2.3 List mode: render preset entries via custom list with useInput, handle Enter (load), `s` (save), `d` (delete), Esc (back)
  - [x] 2.4 Naming mode: render TextInput for preset name, Enter confirms save, Esc cancels
  - [x] 2.5 Confirm mode: render ConfirmDialog for overwrite, Enter overwrites, Esc cancels
  - [x] 2.6 Default preset: always present, loads factory defaults via `buildDefaultTuiState()`, `d` is no-op
  - [x] 2.7 Loading a preset: apply complete snapshot to tuiState, persist via `onLoadPreset` callback

- [x] Task 3: Preset persistence (AC: #2, #3, #4, #6)
  - [x] 3.1 Store presets in config file under a `presets` key (array of 3 custom slots, each `{ name, snapshot }` or `null`)
  - [x] 3.2 Load presets on TUI launch in `app.js` (read from config, default to 3 empty slots)
  - [x] 3.3 Save presets on every preset modification (save/delete) via `saveConfig`

- [x] Task 4: Wire PresetsScreen into app.js screen router (AC: #1, #8)
  - [x] 4.1 Import PresetsScreen, replace PlaceholderScreen for `'presets'` route
  - [x] 4.2 Pass required props: `tuiState`, `presets`, `onLoadPreset`, `onSavePreset`, `onDeletePreset`, `onBack`
  - [x] 4.3 Implement preset callback handlers in App that update tuiState + persist config

- [x] Task 5: Tests (AC: #10)
  - [x] 5.1 Add ConfirmDialog tests to `test/tui-components.test.js`
  - [x] 5.2 Create `test/tui-presets.test.js`: 10 test cases covering all 8 AC #10 requirements

### Review Findings

- [x] [Review][Patch] Merge duplicate `import` from `'ink'` in ConfirmDialog.js [`ConfirmDialog.js:4-5`]
- [x] [Review][Patch] Add test for naming flow submit happy path — test (c2) exercises `s` → type name → Enter → `onSavePreset` called [`tui-presets.test.js`]
- [x] [Review][Defer] `customSeparator` absent du snapshot preset — round-trip impossible pour séparateurs custom [`app.js:handleSavePreset`] — deferred, regression from 5-4 commit
- [x] [Review][Defer] `isActive: true` codé en dur pour PresetsScreen dans app.js — devrait être `!statusMessage` [`app.js:404`] — deferred, inconsistency from 5-5 commit
- [x] [Review][Defer] `delay(50)` dans tous les tests async — potentiellement flaky sur CI lent [`tui-presets.test.js`] — deferred, pre-existing pattern
- [x] [Review][Defer] `config.presets` pas validé à la lecture du fichier config [`app.js:155-157`] — deferred, robustness improvement

## Dev Notes

### Architecture Compliance

**Stack — use ONLY these:**
- Node.js >= 20, plain JavaScript ESM (NO TypeScript, NO JSX, NO build step)
- `ink` v6.8.0, `react` v19.2.4, `@inkjs/ui` v2.0.0
- `React.createElement` everywhere — alias as `const e = React.createElement`
- Testing: `node:test` + `node:assert/strict` + `ink-testing-library`

**REUSE unchanged — do NOT modify:**
- `src/tui/config-loader.js` — `loadConfig(paths)` returns `{ config, bmadWidgets, currentLine, error }`
- `src/tui/config-writer.js` — `saveConfig(config, paths)` returns `{ success, error }`
- `src/tui/widget-registry.js` — `getIndividualWidgets()`, `buildWidgetConfig(widgetIds, readerPath, options)`, `CCSTATUSLINE_COLORS`

**REUSE unchanged — shared components from Story 5.1:**
- `src/tui/components/Breadcrumb.js` — props: `{ path: string[] }`
- `src/tui/components/ShortcutBar.js` — props: `{ actions: [{ key, label }] }`
- `src/tui/components/DualPreview.js` — props: `{ tuiState }`, renders "Complete:" and "Steps:" lines
- `src/tui/components/ScreenLayout.js` — props: `{ breadcrumb, title, shortcuts, tuiState, children }`, enforces vertical structure

### Screen Pattern (Established in 5.1)

Every screen wraps content in ScreenLayout:

```js
import React, { useState } from 'react';
import { useInput } from 'ink';
import { ScreenLayout } from '../components/ScreenLayout.js';
const e = React.createElement;

export function PresetsScreen({ tuiState, presets, onLoadPreset, onSavePreset, onDeletePreset, onBack, isActive }) {
  // internal state for mode, naming input, etc.
  return e(ScreenLayout, {
    breadcrumb: ['Home', 'Presets'],
    title: 'Load or manage configuration presets',
    shortcuts: PRESETS_SHORTCUTS,
    tuiState
  },
    // content area: preset list / TextInput / ConfirmDialog
  );
}
```

### State Management

**App-level tuiState (single source of truth):**
```js
tuiState = {
  visibleWidgets: ['bmad-project', 'bmad-workflow', ...],
  widgetOrder: [...],
  colorModes: { 'bmad-timer': { mode: 'fixed', fixedColor: 'red' }, ... },
  separator: 'serre' | 'modere' | 'large' | 'custom',
  targetLine: 0 | 1 | 2,
  rawConfig: { /* ccstatusline config object */ }
}
```

**Preset data model — each custom slot:**
```js
// null = empty slot, object = saved preset
{ name: 'dev-focus', snapshot: { visibleWidgets, widgetOrder, colorModes, separator, targetLine } }
```

**Default preset** is NOT stored — it is always computed fresh via `buildWidgetConfig(allWidgetIds, readerPath)` to get factory defaults, then derive tuiState from the result. Reuse the same `buildDefaultTuiState(paths)` / `deriveTuiState(result)` functions from `app.js`.

**Loading a preset:** Replace current tuiState with preset's snapshot (spread snapshot fields over current tuiState, keep rawConfig updated). Rebuild rawConfig from snapshot fields using `buildWidgetConfig()` with the preset's widget IDs and options, then call `saveConfig()`.

### ConfirmDialog Component Design

- NOT a screen (not pushed to navStack) — it is an inline overlay within PresetsScreen
- Rendered conditionally when `mode === 'confirm'` inside PresetsScreen
- Single line: `"Overwrite Custom 1 (dev-focus)? Enter / Esc"` — use `Text` with default color
- `useInput` handles Enter (onConfirm callback) and Escape (onCancel callback)
- Guard with `isActive` prop to prevent key capture when not visible
- File: `src/tui/components/ConfirmDialog.js` — reusable for potential future use

### Preset Persistence Strategy

Presets must survive across TUI sessions. Store them in the ccstatusline config file alongside existing config:

```js
// In the config object (rawConfig), add a presets key:
rawConfig.presets = [
  null,                                          // Custom 1 (empty)
  { name: 'dev-focus', snapshot: { ... } },     // Custom 2 (saved)
  null                                           // Custom 3 (empty)
];
```

- On TUI launch (`app.js` useEffect): read `config.presets` if present, default to `[null, null, null]`
- On preset save/delete: update `rawConfig.presets`, call `saveConfig(rawConfig, paths)`
- `config-loader.js` and `config-writer.js` pass through unknown keys — they read/write the full JSON object, so adding a `presets` key requires NO changes to those files

### Key Interaction Flows

**Load preset (Enter):**
1. Get selected preset index
2. If Default: compute default tuiState via `buildWidgetConfig()` + `deriveTuiState()`
3. If saved custom: apply `preset.snapshot` fields to tuiState
4. Rebuild rawConfig from new tuiState, persist via `saveConfig()`
5. `setTuiState()` triggers DualPreview re-render — preview IS the feedback

**Save to empty slot (s):**
1. `mode` → `'naming'`, render TextInput
2. User types name, presses Enter
3. Create preset: `{ name, snapshot: { visibleWidgets, widgetOrder, colorModes, separator, targetLine } }` (deep copy via `structuredClone()`)
4. Store in `presets[index]`, persist via `saveConfig()`
5. `mode` → `'list'`

**Save to saved slot (s) — overwrite:**
1. `mode` → `'confirm'`, render ConfirmDialog with preset name
2. Enter: overwrite preset snapshot with current tuiState (structuredClone), persist
3. Escape: `mode` → `'list'`, no change

**Delete (d):**
1. If Default slot: no-op (return immediately)
2. Set `presets[index] = null`, persist via `saveConfig()`
3. Slot renders as `(empty)` with dim text

### Rendering Preset Entries

Build Select options dynamically from presets state:

```js
const options = [
  { label: 'Default             Load factory defaults', value: 'default' },
  ...presets.map((p, i) => ({
    label: p
      ? `Custom ${i + 1}  ${p.name} (saved)`
      : `Custom ${i + 1}  (empty)`,   // dim text for (empty) — use Text with dimColor in custom render
    value: `custom-${i}`
  }))
];
```

Note: @inkjs/ui Select options use string labels. For dim text on `(empty)`, you may need a custom list component using `useInput` instead of Select. Alternatively, include `(empty)` as plain text — acceptable if dim styling is not achievable with Select.

### TextInput Usage

Import `TextInput` from `@inkjs/ui`:

```js
import { TextInput } from '@inkjs/ui';

// In naming mode:
e(TextInput, {
  placeholder: 'Enter preset name',
  onSubmit: (value) => { /* save preset with name=value, mode → list */ },
  // Note: TextInput from @inkjs/ui does NOT have onCancel
  // Handle Escape via useInput alongside TextInput
})
```

**Escape handling in naming mode:** Use `useInput` with `isActive: mode === 'naming'` to catch Escape key and revert to list mode. TextInput captures Enter via `onSubmit`.

### File Changes Summary

| Action | File | Description |
|--------|------|-------------|
| CREATE | `src/tui/components/ConfirmDialog.js` | Reusable confirmation overlay component |
| CREATE | `src/tui/screens/PresetsScreen.js` | Presets list + save/load/delete with inline TextInput and ConfirmDialog |
| MODIFY | `src/tui/app.js` | Add presets state, preset callbacks, wire PresetsScreen route |
| MODIFY | `test/tui-components.test.js` | Add ConfirmDialog tests |
| CREATE or MODIFY | `test/tui-presets.test.js` or `test/tui-app.test.js` | Add 8+ PresetsScreen test cases |

### Project Structure Notes

Files align with established structure from Story 5.1:
- Components in `src/tui/components/` with PascalCase naming
- Screens in `src/tui/screens/` with `{Name}Screen.js` pattern
- Tests in `test/` with `tui-{name}.test.js` pattern

No conflicts with existing files. PlaceholderScreen.js remains for screens not yet built (widgets, order, targetLine, separator).

### Previous Story Intelligence (5.1)

**Learnings to apply:**
- `@inkjs/ui` Select is **uncontrolled** — `onChange` fires on Enter, no `onHighlight` callback. For try-before-you-buy preview, you would need a custom list. For Presets this is acceptable since we don't need preview-on-highlight.
- Use `useApp().exit()` for clean exit — never `process.exit()`
- `structuredClone()` for deep copies (Node >= 17, project requires >= 20)
- StatusMessage pattern for error overlay: set state → render overlay → useInput to dismiss
- `buildWidgetConfig(allWidgetIds, readerPath)` to create factory default config — do NOT call a nonexistent `buildDefaultConfig()`
- `deriveTuiState(result)` in `app.js` converts loadConfig result to tuiState shape
- DualPreview returns `null` when `tuiState` is null — guard rendering
- All widget IDs: `project`, `workflow`, `step`, `nextstep`, `progress`, `progressbar`, `progressstep`, `story`, `timer`

**Git patterns from recent commits:**
- Commit format: `5-6-presets-screen-confirm-dialog: <description>`
- Code review fix format: `fix(5-6-presets-screen-confirm-dialog): <description>`

### Testing Patterns (from 5.1)

```js
import { describe, test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
const e = React.createElement;

// Mock tuiState for component tests:
const MOCK_TUI_STATE = {
  visibleWidgets: ['bmad-project', 'bmad-workflow', 'bmad-step', 'bmad-story', 'bmad-timer'],
  widgetOrder: ['bmad-project', 'bmad-workflow', 'bmad-step', 'bmad-story', 'bmad-timer'],
  colorModes: {},
  separator: 'modere',
  targetLine: 1,
  rawConfig: {}
};

// Helper for async rendering:
const delay = (ms) => new Promise(r => setTimeout(r, ms));

// Temp dirs for config tests:
function makeTmpDir() { /* fs.mkdtempSync pattern */ }

// Stdin simulation for key presses:
// stdin.write('s')        — letter key
// stdin.write('\r')       — Enter
// stdin.write('\x1B')     — Escape
// stdin.write('\x1B[B')   — Arrow down
```

**Required test cases (AC #10):**
1. Renders 4 preset entries with correct status (saved/empty)
2. Enter loads preset and updates config + preview
3. `s` on empty slot opens TextInput
4. `s` on saved slot shows ConfirmDialog
5. `d` deletes custom preset (slot becomes empty)
6. `d` on Default is ignored
7. ConfirmDialog Enter/Esc behavior
8. Escape returns to Home

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.6] — Acceptance criteria
- [Source: _bmad-output/planning-artifacts/architecture.md#TUI Screens] — Component and screen patterns
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Presets Screen] — UX mockup, preset behavior, ConfirmDialog spec
- [Source: _bmad-output/implementation-artifacts/5-1-app-shell-shared-components-home-screen.md] — Previous story learnings, established patterns
- [Source: _bmad-output/project-context.md] — Tech stack, testing conventions, error handling rules

## Change Log

- 2026-03-30: Initial implementation — ConfirmDialog component, PresetsScreen with full save/load/delete/overwrite flows, preset persistence in config, app.js wiring, 10 PresetsScreen tests + 4 ConfirmDialog tests

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

No issues encountered during implementation.

### Completion Notes List

- Created ConfirmDialog shared component with Enter/Esc key handling and isActive guard
- Created PresetsScreen with 3 modes (list/naming/confirm), custom list rendering with arrow navigation, dim styling for empty slots
- Used custom list with useInput instead of @inkjs/ui Select to support s/d key handling alongside navigation
- Implemented preset persistence: presets stored as array in rawConfig.presets, loaded on TUI launch, saved on every modification
- Added preset callback handlers in app.js: handleLoadPreset (default via buildDefaultTuiState, custom via snapshot apply + buildWidgetConfig), handleSavePreset (structuredClone snapshot), handleDeletePreset (null slot + persist)
- Wired PresetsScreen into app.js screen router replacing PlaceholderScreen for 'presets' route
- 14 new tests: 4 ConfirmDialog unit tests (tui-components.test.js), 10 PresetsScreen tests (tui-presets.test.js) covering all 8 AC #10 requirements
- Full test suite: 289 tests pass, 0 failures, 0 regressions

### File List

- `bmad-statusline/src/tui/components/ConfirmDialog.js` (CREATE)
- `bmad-statusline/src/tui/screens/PresetsScreen.js` (CREATE)
- `bmad-statusline/src/tui/app.js` (MODIFY)
- `bmad-statusline/test/tui-components.test.js` (MODIFY)
- `bmad-statusline/test/tui-presets.test.js` (CREATE)
