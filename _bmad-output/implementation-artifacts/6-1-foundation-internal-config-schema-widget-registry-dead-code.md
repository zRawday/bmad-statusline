# Story 6.1: Foundation — Internal config schema, widget registry defaults, dead code removal

Status: done

## Story

As a **bmad-statusline developer**,
I want **the internal config schema defined, widget defaults enriched, dead code from TUI v1 removed, and shared preview utilities created**,
So that **all subsequent stories build on a clean codebase with the foundational data structures in place**.

## Acceptance Criteria

1. **Given** `widget-registry.js` contains `COMPOSITE_WIDGETS`, `getCompositeWidgets()`, `buildWidgetConfig()`, `applyColorMode()`
   **When** dead code removal is applied
   **Then** all four are deleted, no remaining imports or references in any file
   **And** `INDIVIDUAL_WIDGETS` is preserved and enriched with `defaultColor` and `defaultMode` per widget (project=cyan/fixed, workflow=dynamic, step=yellow/fixed, nextstep=yellow/fixed, progress=green/fixed, progressbar=green/fixed, progressstep=brightCyan/fixed, story=magenta/fixed, timer=brightBlack/fixed)
   **And** `SEPARATOR_STYLES` and `getIndividualWidgets()` are preserved

2. **Given** the TUI v1 screens and components that are replaced in v2
   **When** dead code removal is applied
   **Then** the following files are deleted: `DualPreview.js`, `WidgetDetailScreen.js`, `ColorModeScreen.js`, `TargetLineScreen.js`, `WidgetsListScreen.js`, `WidgetOrderScreen.js`, `PlaceholderScreen.js`, `PresetsScreen.js`
   **And** `SelectWithPreview.js` is evaluated — kept if its `onHighlight` callback supports preview-override pattern, deleted otherwise
   **And** all imports/references to deleted files are removed from `app.js` and any other consuming files

3. **Given** the Architecture Rev.3 internal config schema
   **When** a `createDefaultConfig()` function is implemented in a shared utility
   **Then** it returns a valid default config object: separator `"serre"`, customSeparator `null`, 3 lines (line 0 with all default-enabled widgets + colorModes, lines 1-2 empty), presets `[null, null, null]`
   **And** default-enabled widgets for line 0 are: `bmad-project`, `bmad-workflow`, `bmad-progressstep`, `bmad-story`, `bmad-timer`

4. **Given** the need for shared preview logic across TUI components
   **When** `src/tui/preview-utils.js` is created
   **Then** it exports `SAMPLE_VALUES` (9 widget sample strings), `resolvePreviewColor(widgetId, colorModes)`, `WORKFLOW_SAMPLE_COLOR` constant, and `SEPARATOR_MAP` for preview rendering
   **And** `resolvePreviewColor` returns: widget default color if no colorModes entry, `WORKFLOW_SAMPLE_COLOR` if mode=dynamic, `fixedColor` if mode=fixed

5. **Given** tests need to validate the changes
   **When** tests are executed
   **Then** `tui-widget-registry.test.js` is updated: tests for deleted functions removed, new tests for `defaultColor`/`defaultMode` on each of the 9 widgets
   **And** `tui-preview-utils.test.js` is created: tests for `resolvePreviewColor` (dynamic, fixed, fallback to default), `SAMPLE_VALUES` has all 9 keys
   **And** new fixtures `internal-config-default.json` and `internal-config-multiline.json` are created in `test/fixtures/`
   **And** all existing tests pass (`npm test`)

## Tasks / Subtasks

- [x] Task 1: Dead code removal from widget-registry.js (AC: #1)
  - [x] 1.1 Delete `COMPOSITE_WIDGETS` array (lines 17-21)
  - [x] 1.2 Delete `getCompositeWidgets()` function (lines 39-41)
  - [x] 1.3 Delete `buildWidgetConfig()` function and nested `applyColorMode()` (lines 47-116)
  - [x] 1.4 Add `defaultColor` and `defaultMode` fields to each entry in `INDIVIDUAL_WIDGETS`
  - [x] 1.5 Verify `SEPARATOR_STYLES`, `getIndividualWidgets()`, `CCSTATUSLINE_COLORS`, `getWorkflowColors()` are preserved
  - [x] 1.6 Remove `getCompositeWidgets` from exports
  - [x] 1.7 Add `createDefaultConfig` to the module's public API (export)

- [x] Task 2: Delete TUI v1 dead screen/component files (AC: #2)
  - [x] 2.1 Delete `src/tui/components/DualPreview.js`
  - [x] 2.2 Delete `src/tui/screens/WidgetDetailScreen.js`
  - [x] 2.3 Delete `src/tui/screens/ColorModeScreen.js`
  - [x] 2.4 Delete `src/tui/screens/TargetLineScreen.js`
  - [x] 2.5 Delete `src/tui/screens/WidgetsListScreen.js`
  - [x] 2.6 Delete `src/tui/screens/WidgetOrderScreen.js`
  - [x] 2.7 Delete `src/tui/screens/PlaceholderScreen.js`
  - [x] 2.8 Delete `src/tui/screens/PresetsScreen.js`
  - [x] 2.9 Evaluate `src/tui/components/SelectWithPreview.js` — check if `onHighlight` callback can support preview-override pattern (pattern 17). If not reusable, delete.
  - [x] 2.10 Remove all imports/references to deleted files from `src/tui/app.js`

- [x] Task 3: Create `createDefaultConfig()` (AC: #3)
  - [x] 3.1 Add `export function createDefaultConfig()` in `widget-registry.js` (it knows the widget metadata). Ensure it is exported in the module's public API.
  - [x] 3.2 Default config shape: `{ separator: 'serre', customSeparator: null, lines: [line0, emptyLine, emptyLine], presets: [null, null, null] }`
  - [x] 3.3 Line 0 widgets derived from `INDIVIDUAL_WIDGETS.filter(w => w.defaultEnabled).map(w => w.id)` in their array order
  - [x] 3.4 Line 0 colorModes built from those widgets: each gets `{ mode: w.defaultMode }` plus `fixedColor: w.defaultColor` when mode is `'fixed'`
  - [x] 3.5 Empty lines: `{ widgets: [], colorModes: {} }`

- [x] Task 4: Create `src/tui/preview-utils.js` (AC: #4)
  - [x] 4.1 Create file with ESM exports
  - [x] 4.2 Export `SAMPLE_VALUES` object — 9 keys mapping widget IDs to sample display strings
  - [x] 4.3 Export `WORKFLOW_SAMPLE_COLOR` constant (e.g. `'green'` — representative color, not computed)
  - [x] 4.4 Export `SEPARATOR_MAP` — same separators as SEPARATOR_STYLES but using Unicode box chars: `{ serre: '\u2503', modere: ' \u2503 ', large: '  \u2503  ' }`
  - [x] 4.5 Export `resolvePreviewColor(widgetId, colorModes)` function per pattern 19
  - [x] 4.6 Import `getIndividualWidgets` from `'./widget-registry.js'` for `getDefaultColor()` helper (same directory — relative path)

- [x] Task 5: Update tests (AC: #5)
  - [x] 5.1 Update `test/tui-widget-registry.test.js`: remove tests for `getCompositeWidgets`, `buildWidgetConfig`; add tests for `defaultColor`/`defaultMode` on each of 9 widgets; add test for `createDefaultConfig()` output shape
  - [x] 5.2 Create `test/tui-preview-utils.test.js`: test `resolvePreviewColor` (dynamic returns WORKFLOW_SAMPLE_COLOR, fixed returns fixedColor, missing returns widget default), test `SAMPLE_VALUES` has all 9 keys, test `SEPARATOR_MAP` has 3 keys
  - [x] 5.3 Create `test/fixtures/internal-config-default.json` — snapshot of `createDefaultConfig()` output
  - [x] 5.4 Create `test/fixtures/internal-config-multiline.json` — sample multi-line config with presets populated (for use in later stories). Example shape:
    ```json
    {
      "separator": "modere",
      "customSeparator": null,
      "lines": [
        {
          "widgets": ["bmad-project", "bmad-workflow", "bmad-progressstep"],
          "colorModes": {
            "bmad-project": { "mode": "fixed", "fixedColor": "cyan" },
            "bmad-workflow": { "mode": "dynamic" },
            "bmad-progressstep": { "mode": "fixed", "fixedColor": "brightCyan" }
          }
        },
        {
          "widgets": ["bmad-story", "bmad-timer"],
          "colorModes": {
            "bmad-story": { "mode": "fixed", "fixedColor": "magenta" },
            "bmad-timer": { "mode": "fixed", "fixedColor": "brightBlack" }
          }
        },
        { "widgets": [], "colorModes": {} }
      ],
      "presets": [
        { "name": "dev-focus", "widgets": ["bmad-project", "bmad-workflow", "bmad-progressstep"], "colorModes": { "bmad-project": { "mode": "fixed", "fixedColor": "cyan" }, "bmad-workflow": { "mode": "dynamic" }, "bmad-progressstep": { "mode": "fixed", "fixedColor": "brightCyan" } } },
        null,
        null
      ]
    }
    ```
  - [x] 5.5 Delete dead test files that exclusively test deleted components: `test/tui-widget-detail.test.js`, `test/tui-target-line.test.js`, `test/tui-widgets-list.test.js`, `test/tui-widget-order.test.js`, `test/tui-presets.test.js`, `test/tui-select-preview.test.js` (only if SelectWithPreview is deleted). Read each file first to verify it exclusively tests a deleted component before deleting.
  - [x] 5.6 Update `test/tui-components.test.js` — remove DualPreview tests if present
  - [x] 5.7 Update `test/tui-app.test.js` — remove references to deleted screens, remove tests for `buildWidgetConfig` usage, fix any imports of deleted modules. Also verify `test/tui-separator.test.js` has no dead imports from deleted files (SeparatorStyleScreen is PRESERVED — do NOT delete this test file).
  - [x] 5.8 Run `npm test` and confirm all tests pass (0 failures). Baseline: 289 tests at end of story 5.6. Expected after 6.1: ~120-150 tests (many deleted with dead screens/helpers). Significant deviation from expected range means something was missed or accidentally removed.

- [x] Task 6: Verify no dangling references (AC: #1, #2)
  - [x] 6.1 Grep the entire `bmad-statusline/` directory for: `COMPOSITE_WIDGETS`, `getCompositeWidgets`, `buildWidgetConfig`, `applyColorMode`, `DualPreview`, `WidgetDetailScreen`, `ColorModeScreen`, `TargetLineScreen`, `WidgetsListScreen`, `WidgetOrderScreen`, `PlaceholderScreen`, `PresetsScreen`
  - [x] 6.2 Fix any remaining references found

## Dev Notes

### Architecture Compliance

**Stack — use ONLY these:**
- Node.js >= 20, plain JavaScript ESM (NO TypeScript, NO JSX, NO build step)
- `ink` v6.8.0, `react` v19.2.4, `@inkjs/ui` v2.0.0
- `React.createElement` everywhere — alias as `const e = React.createElement`
- Testing: `node:test` + `node:assert/strict` + `ink-testing-library`

**Critical patterns to follow:**
- Pattern 1 — Error Handling: TUI uses StatusMessage, never console.log. Reader silent always.
- Pattern 2 — Synchronous File I/O everywhere. No async, no promises.
- Pattern 3 — ANSI: `colorize()` in reader, `<Text color={...}>` in TUI. Never inline escapes.
- Pattern 14 — Internal Config I/O: No backup before write, corrupted falls back to defaults.
- Pattern 19 — Color Resolution: `resolvePreviewColor()` in `preview-utils.js`, never duplicated.

### Dead Code Removal Details

**widget-registry.js — DELETE these elements:**

| Element | Current Location (line refs approximate) | Notes |
|---------|------------------------------------------|-------|
| `COMPOSITE_WIDGETS` array | Lines 17-21 | 3 preset combinations (compact/full/minimal) |
| `getCompositeWidgets()` | Lines 39-41 | Returns copies of COMPOSITE_WIDGETS |
| `applyColorMode(id, defaultColor)` | Lines 53-59 (nested in buildWidgetConfig) | Applies color config to widget |
| `buildWidgetConfig(enabledWidgets, readerPath, options)` | Lines 47-116 | Entire function including nested applyColorMode |

**widget-registry.js — PRESERVE these:**
- `INDIVIDUAL_WIDGETS` (lines 5-15) — enriched with `defaultColor`, `defaultMode`
- `SEPARATOR_STYLES` (lines 23-27)
- `CCSTATUSLINE_COLORS` (lines 29-33)
- `getIndividualWidgets()` (lines 35-37)
- `getWorkflowColors()` (lines 43-45) — consumed by later stories
- `WORKFLOW_COLORS` import from `../defaults.js` — needed by `getWorkflowColors()`, do NOT remove as "unused"

**TUI v1 files to DELETE:**

| File | Reason |
|------|--------|
| `src/tui/components/DualPreview.js` | Replaced by ThreeLinePreview (story 6.4) |
| `src/tui/screens/WidgetDetailScreen.js` | Absorbed by Edit Line inline shortcuts |
| `src/tui/screens/ColorModeScreen.js` | Dynamic/fixed is widget-determined in v2 |
| `src/tui/screens/TargetLineScreen.js` | Replaced by per-line editing model |
| `src/tui/screens/WidgetsListScreen.js` | Replaced by EditLineScreen |
| `src/tui/screens/WidgetOrderScreen.js` | Replaced by ReorderList in EditLineScreen |
| `src/tui/screens/PlaceholderScreen.js` | No longer needed |
| `src/tui/screens/PresetsScreen.js` | Replaced by PresetScreen (split save/load) |

**SelectWithPreview.js — EVALUATE (pre-assessment: KEEP):**
Pre-assessment: `SelectWithPreview.js` has an `onHighlight(value)` callback that fires the highlighted option value on arrow navigation, plus `onChange` on Enter. This IS compatible with pattern 17 — the consumer can use `onHighlight` to call `setPreviewOverride()`. **Recommend KEEP.** Dev should confirm by reading the file and verifying no tight coupling to DualPreview. Document final decision in completion notes.

**OUT OF SCOPE — Dead code deferred to later stories:**
The architecture dead code table also lists elements that belong to other stories. Do NOT touch these in 6.1:
- `compact`/`full`/`minimal` handlers in `bmad-sl-reader.js` — deferred to story **6.2** (reader `line N` command)
- `bmad-compact` definition in `defaults.js` — deferred to story **6.6** (installer per-line deployment, replaces with `bmad-line-0`)
- These remain functional dead code until their respective stories remove them.

### INDIVIDUAL_WIDGETS Enrichment

Add `defaultColor` and `defaultMode` to each widget entry:

```js
const INDIVIDUAL_WIDGETS = [
  { id: 'bmad-project',      command: 'project',      name: 'Project',       defaultEnabled: true,  defaultColor: 'cyan',       defaultMode: 'fixed' },
  { id: 'bmad-workflow',     command: 'workflow',     name: 'Workflow',      defaultEnabled: true,  defaultColor: null,         defaultMode: 'dynamic' },
  { id: 'bmad-step',         command: 'step',         name: 'Step',          defaultEnabled: false, defaultColor: 'yellow',     defaultMode: 'fixed' },
  { id: 'bmad-nextstep',     command: 'nextstep',     name: 'Next Step',     defaultEnabled: false, defaultColor: 'yellow',     defaultMode: 'fixed' },
  { id: 'bmad-progress',     command: 'progress',     name: 'Progress',      defaultEnabled: false, defaultColor: 'green',      defaultMode: 'fixed' },
  { id: 'bmad-progressbar',  command: 'progressbar',  name: 'Progress Bar',  defaultEnabled: false, defaultColor: 'green',      defaultMode: 'fixed' },
  { id: 'bmad-progressstep', command: 'progressstep', name: 'Progress+Step', defaultEnabled: true,  defaultColor: 'brightCyan', defaultMode: 'fixed' },
  { id: 'bmad-story',        command: 'story',        name: 'Story',         defaultEnabled: true,  defaultColor: 'magenta',    defaultMode: 'fixed' },
  { id: 'bmad-timer',        command: 'timer',        name: 'Timer',         defaultEnabled: true,  defaultColor: 'brightBlack', defaultMode: 'fixed' },
];
```

Note: `bmad-workflow` has `defaultColor: null` and `defaultMode: 'dynamic'` — it's the ONLY widget with dynamic mode.

### createDefaultConfig() Specification

```js
export function createDefaultConfig() {
  const widgets = INDIVIDUAL_WIDGETS.filter(w => w.defaultEnabled);
  const colorModes = {};
  for (const w of widgets) {
    colorModes[w.id] = w.defaultMode === 'dynamic'
      ? { mode: 'dynamic' }
      : { mode: 'fixed', fixedColor: w.defaultColor };
  }
  return {
    separator: 'serre',
    customSeparator: null,
    lines: [
      { widgets: widgets.map(w => w.id), colorModes },
      { widgets: [], colorModes: {} },
      { widgets: [], colorModes: {} },
    ],
    presets: [null, null, null],
  };
}
```

Expected output (line 0 widgets): `['bmad-project', 'bmad-workflow', 'bmad-progressstep', 'bmad-story', 'bmad-timer']`

### preview-utils.js Specification

```js
import { getIndividualWidgets } from './widget-registry.js';

export const WORKFLOW_SAMPLE_COLOR = 'green';

export const SAMPLE_VALUES = {
  'bmad-project': 'myproject',
  'bmad-workflow': 'dev-story',
  'bmad-step': 'Step 2 Discover',
  'bmad-nextstep': 'Next: Step 3',
  'bmad-progress': '40%',
  'bmad-progressbar': '\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591\u2591',
  'bmad-progressstep': 'Tasks 2/5',
  'bmad-story': '4-2 Auth Login',
  'bmad-timer': '12:34',
};

export const SEPARATOR_MAP = {
  serre: '\u2503',
  modere: ' \u2503 ',
  large: '  \u2503  ',
};

export function resolvePreviewColor(widgetId, colorModes) {
  const mode = colorModes[widgetId];
  if (!mode) {
    const widgets = getIndividualWidgets();
    const widget = widgets.find(w => w.id === widgetId);
    return widget ? widget.defaultColor : 'white';
  }
  if (mode.mode === 'dynamic') return WORKFLOW_SAMPLE_COLOR;
  return mode.fixedColor;
}
```

### Internal Config Schema (Reference)

Location: `~/.config/bmad-statusline/config.json`

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

**Schema rules:**
- `separator` is global (top-level), applied to all lines. Values: `"serre"`, `"modere"`, `"large"`, `"custom"`.
- `customSeparator` is a string, only used when `separator === "custom"`. Null otherwise.
- `lines` is always length 3. Each line has `widgets` (ordered array of visible widget IDs) and `colorModes`.
- `widgets` contains only **visible** widgets in **display order**. Widget not in any line = hidden everywhere.
- `colorModes` contains entries for all configured widgets (including hidden ones — preserves color across hide/show).
- `colorModes[id].mode` is `"dynamic"` (only `bmad-workflow`) or `"fixed"`. When fixed, `fixedColor` is ANSI color name.
- `presets` is always length 3. Each slot is null or `{ name, widgets, colorModes }`.

### Test File Cleanup Strategy

**Dead test files to evaluate (read before deleting):**
- `test/tui-widget-detail.test.js` — tests WidgetDetailScreen (DELETED) -> DELETE test file
- `test/tui-target-line.test.js` — tests TargetLineScreen (DELETED) -> DELETE test file
- `test/tui-widgets-list.test.js` — tests WidgetsListScreen (DELETED) -> DELETE test file
- `test/tui-widget-order.test.js` — tests WidgetOrderScreen (DELETED) -> DELETE test file
- `test/tui-presets.test.js` — tests PresetsScreen (DELETED) -> DELETE test file
- `test/tui-select-preview.test.js` — tests SelectWithPreview -> DELETE only if SelectWithPreview is deleted

**IMPORTANT: Read each test file first. Only delete if it exclusively tests a deleted component.**

**Test files to KEEP and verify:**
- `test/tui-separator.test.js` — tests SeparatorStyleScreen which is PRESERVED. Do NOT delete. Verify no dead imports from deleted files.
- `test/tui-components.test.js` — remove DualPreview tests if present, keep ConfirmDialog/ReorderList/ShortcutBar/Breadcrumb tests

### app.js Cleanup Scope

Current `app.js` (484 lines) imports and references deleted screens/components. After dead code removal:
- Remove imports of all deleted screens (WidgetDetailScreen, ColorModeScreen, TargetLineScreen, WidgetsListScreen, WidgetOrderScreen, PlaceholderScreen, PresetsScreen)
- Remove import of DualPreview
- Remove the screen routing cases for deleted screens
- Remove helper functions only used by deleted screens (e.g., `moveWidgetsToLine`, composite-mode related logic)
- **Keep:** Navigation infrastructure (`navigate`, `goBack`, navStack), state management, config persistence, preset storage, SeparatorStyleScreen routing, HomeScreen routing, ColorPickerScreen routing
- **Note:** Do NOT rewrite app.js to the v2 state model — that's story 6.4. Only remove dead code that references deleted files.

### CRITICAL: `buildWidgetConfig` Circular Dependency

Deleting `buildWidgetConfig` from `widget-registry.js` will break 5 call sites in `app.js`:
- `buildDefaultTuiState()` (line ~76) — calls `buildWidgetConfig()`
- `rebuildWithSeparator()` (line ~112) — calls `buildWidgetConfig()`
- `handleOrderCommit()` (line ~189) — calls `buildWidgetConfig()`
- `handleToggleVisibility()` (line ~213) — calls `buildWidgetConfig()`
- `handleLoadPreset()` (line ~273) — calls `buildWidgetConfig()`
- The `import { buildWidgetConfig }` on line ~10 will fail at runtime

**Resolution strategy:** After deleting `buildWidgetConfig` from widget-registry.js, the dev MUST also clean up app.js to remove these broken call sites. Since the v2 state model (story 6.4) will completely replace these functions, the approach here is:

1. **Remove** the `buildWidgetConfig` import from app.js
2. **Remove** the 5 helper functions that call it: `buildDefaultTuiState`, `rebuildWithSeparator`, `handleOrderCommit`, `handleToggleVisibility`, `handleLoadPreset`
3. **Remove** any screen routing or handler code that calls these helpers (they serve deleted screens)
4. **Keep** app.js bootable with the remaining infrastructure: `deriveTuiState`, `loadConfig`, `saveConfig`, config persistence, navigation, HomeScreen, SeparatorStyleScreen, ColorPickerScreen routing
5. **The TUI will be partially non-functional** after this story (deleted screens, deleted helpers) — this is expected. Story 6.4 rebuilds app.js with the v2 state model.
6. **Update `tui-app.test.js`** accordingly — remove tests for deleted helpers, keep tests for preserved functionality

The `isBmad()` predicate, `KNOWN_SEPARATORS`, and `deriveTuiState()` should be evaluated: keep if still used by remaining code, remove if only used by deleted helpers. Read app.js carefully during implementation to trace dependencies.

### Previous Story Intelligence (5.6 — Presets Screen)

**Key learnings from story 5.6:**
- Custom list with `useInput` was preferred over `@inkjs/ui Select` for complex key handling (s/d/Enter/Escape)
- Preset persistence via `rawConfig.presets` key — config-loader/writer pass through unknown keys
- `structuredClone()` for deep copies (confirmed working in Node >= 20)
- `buildDefaultTuiState(paths)` / `deriveTuiState(result)` used for computing factory defaults
- `delay(50)` pattern in async tests — potentially flaky but pre-existing convention
- 289 tests passing at end of story 5.6

**Deferred items from 5.6 code review:**
- `customSeparator` absent from preset snapshot (regression from 5-4)
- `isActive: true` hardcoded for PresetsScreen in app.js (inconsistency from 5-5)
- `config.presets` not validated at read time
- These deferred items do NOT need to be fixed in 6.1 — they will be obsoleted by 6.4's rewrite

### Git Patterns from Recent Commits

- Commit format: `6-1-foundation-internal-config-schema-widget-registry-dead-code: <description>`
- Code review fix format: `fix(6-1-foundation-internal-config-schema-widget-registry-dead-code): <description>`
- All Epic 5 stories follow this pattern consistently

### Project Structure Notes

- Components in `src/tui/components/` with PascalCase naming
- Screens in `src/tui/screens/` with `{Name}Screen.js` pattern
- Tests in `test/` with `tui-{name}.test.js` pattern
- Fixtures in `test/fixtures/` as JSON files
- ESM for all TUI code (`import`/`export`), CJS for reader/hook
- No build step — plain JavaScript

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.1] — Acceptance criteria and story definition
- [Source: _bmad-output/planning-artifacts/architecture.md#Dead Code Removal Scope] — Complete dead code inventory
- [Source: _bmad-output/planning-artifacts/architecture.md#Internal Config Architecture] — Schema specification
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern 19] — resolvePreviewColor specification
- [Source: _bmad-output/planning-artifacts/architecture.md#ThreeLinePreview Rendering] — SAMPLE_VALUES specification
- [Source: _bmad-output/planning-artifacts/prd.md#UX3] — Default widget colors table
- [Source: _bmad-output/project-context.md#Dead Code Removal Scope] — Dead code inventory repeated
- [Source: _bmad-output/project-context.md#Pattern 14] — Internal Config I/O rules
- [Source: _bmad-output/project-context.md#Pattern 19] — Color Resolution rules
- [Source: _bmad-output/implementation-artifacts/5-6-presets-screen-confirm-dialog.md] — Previous story learnings

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation, no blocking issues.

### Completion Notes List

- **Task 1**: Deleted COMPOSITE_WIDGETS, getCompositeWidgets(), buildWidgetConfig() with nested applyColorMode() from widget-registry.js. Enriched all 9 INDIVIDUAL_WIDGETS entries with defaultColor and defaultMode per specification. Added createDefaultConfig() export. SEPARATOR_STYLES, CCSTATUSLINE_COLORS, getIndividualWidgets(), getWorkflowColors() all preserved. WORKFLOW_COLORS import preserved.
- **Task 2**: Deleted 8 TUI v1 files (DualPreview.js, WidgetDetailScreen.js, ColorModeScreen.js, TargetLineScreen.js, WidgetsListScreen.js, WidgetOrderScreen.js, PlaceholderScreen.js, PresetsScreen.js). **SelectWithPreview.js: KEPT** — confirmed onHighlight callback supports pattern 17 preview-override, no coupling to DualPreview. Cleaned app.js: removed all deleted screen imports/routing, removed dead helpers (buildDefaultTuiState, rebuildWithSeparator, handleOrderCommit, handleToggleVisibility, handleLoadPreset, moveWidgetsToLine, isBmad predicate), replaced buildWidgetConfig usage with createDefaultConfig. Also removed DualPreview from ScreenLayout.js.
- **Task 3**: createDefaultConfig() implemented in widget-registry.js per specification. Returns correct default config shape with 5 default-enabled widgets on line 0, proper colorModes, 2 empty lines, and 3 null presets.
- **Task 4**: Created src/tui/preview-utils.js with SAMPLE_VALUES (9 keys), WORKFLOW_SAMPLE_COLOR ('green'), SEPARATOR_MAP (3 Unicode box drawing separators), and resolvePreviewColor() per pattern 19.
- **Task 5**: Updated tui-widget-registry.test.js (removed 15 dead tests, added 12 new tests for defaultColor/defaultMode/createDefaultConfig). Created tui-preview-utils.test.js (12 tests). Updated tui-widget-detail.test.js (kept ColorPickerScreen tests only). Updated tui-widget-order.test.js (kept ReorderList tests only). Updated tui-components.test.js (removed DualPreview tests+import). Updated tui-app.test.js (removed DualPreview assertion). Deleted tui-target-line.test.js, tui-widgets-list.test.js, tui-presets.test.js. tui-select-preview.test.js KEPT (SelectWithPreview kept). tui-separator.test.js verified clean — no dead imports. Created fixtures: internal-config-default.json, internal-config-multiline.json. **Final: 285 tests, 0 failures.**
- **Task 6**: Grepped entire bmad-statusline/ directory for all deleted identifiers. Only matches: code comments explaining removals. Zero dangling references.

### Review Findings

- [x] [Review][Patch] resolvePreviewColor returns null for bmad-workflow when no colorModes entry — fixed: fallback to WORKFLOW_SAMPLE_COLOR for dynamic widgets [src/tui/preview-utils.js:30]
- [x] [Review][Patch] resolvePreviewColor returns undefined when fixedColor absent — fixed: fallback to 'white' [src/tui/preview-utils.js:33]
- [x] [Review][Patch] Fallback screen has no useInput handler — fixed: added FallbackScreen component with useInput [src/tui/app.js:15-21]
- [x] [Review][Patch] tui-preview-utils.test.js uses `it` instead of project convention `test` — fixed [test/tui-preview-utils.test.js]
- [x] [Review][Defer] onConfigChange does not persist separator changes to rawConfig — expected interim regression, rebuildWithSeparator deleted per spec [src/tui/app.js:132-146] — deferred to story 6.4
- [x] [Review][Defer] rawConfig in default-state uses `{ lines: [[], [], []] }` instead of v2 config objects — expected interim state per spec [src/tui/app.js:85,98] — deferred to story 6.4
- [x] [Review][Defer] Duplicate default-state construction blocks (not-found and invalid-json branches identical) [src/tui/app.js:76-101] — deferred to story 6.4
- [x] [Review][Defer] selectedWidget/setSelectedWidget state has no setter call site after routing cleanup [src/tui/app.js:70] — expected interim, story 6.4
- [x] [Review][Defer] presets state loaded but no consumer screen remains [src/tui/app.js:71,109] — expected interim, story 6.4
- [x] [Review][Defer] deriveTuiState expects v1 array format for config.lines — incompatible with v2 object format [src/tui/app.js:36-50] — deferred to story 6.3/6.4
- [x] [Review][Defer] SEPARATOR_STYLES preserved but unreachable dead constant (only consumer was deleted buildWidgetConfig) [src/tui/widget-registry.js:17-21] — spec explicitly says preserve

### Change Log

- 2026-04-01: Story 6.1 implementation complete — internal config schema foundation, widget registry enrichment, dead code removal, preview-utils creation, 285 tests passing.

### File List

**Modified:**
- src/tui/widget-registry.js — deleted COMPOSITE_WIDGETS/getCompositeWidgets/buildWidgetConfig/applyColorMode, enriched INDIVIDUAL_WIDGETS, added createDefaultConfig()
- src/tui/app.js — removed dead screen imports/routing/helpers, replaced buildWidgetConfig with createDefaultConfig
- src/tui/components/ScreenLayout.js — removed DualPreview import and rendering
- test/tui-widget-registry.test.js — removed dead tests, added defaultColor/defaultMode/createDefaultConfig tests
- test/tui-widget-detail.test.js — kept ColorPickerScreen tests only, removed WidgetDetailScreen/ColorModeScreen
- test/tui-widget-order.test.js — kept ReorderList tests only, removed WidgetOrderScreen
- test/tui-components.test.js — removed DualPreview import/tests
- test/tui-app.test.js — removed DualPreview assertions, fixed for createDefaultConfig usage

**Created:**
- src/tui/preview-utils.js — SAMPLE_VALUES, WORKFLOW_SAMPLE_COLOR, SEPARATOR_MAP, resolvePreviewColor()
- test/tui-preview-utils.test.js — 12 tests for preview-utils
- test/fixtures/internal-config-default.json — createDefaultConfig() output snapshot
- test/fixtures/internal-config-multiline.json — multi-line config sample with presets

**Deleted:**
- src/tui/components/DualPreview.js
- src/tui/screens/WidgetDetailScreen.js
- src/tui/screens/ColorModeScreen.js
- src/tui/screens/TargetLineScreen.js
- src/tui/screens/WidgetsListScreen.js
- src/tui/screens/WidgetOrderScreen.js
- src/tui/screens/PlaceholderScreen.js
- src/tui/screens/PresetsScreen.js
- test/tui-target-line.test.js
- test/tui-widgets-list.test.js
- test/tui-presets.test.js
