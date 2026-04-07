# Story 2.1: TUI Configurator — Foundation & Widget Management

Status: done

## Story

As a **developer who wants to customize their BMAD statusline**,
I want **to launch an interactive TUI via `npx bmad-statusline` that shows my current widget configuration and lets me toggle widgets on/off, choose a target line, and select separator style**,
So that **I can personalize my statusline layout without editing JSON files manually**.

## Acceptance Criteria

1. **Given** `npx bmad-statusline` is run with no arguments (Phase 3 behavior) **When** the TUI launches **Then** it reads `~/.config/ccstatusline/settings.json` and displays the current BMAD widget configuration

2. **Given** the TUI is running **When** the user toggles a widget on/off **Then** the change is reflected in the live preview and saved to ccstatusline config on confirm

3. **Given** the TUI is running **When** the user selects a target line (1, 2, or 3) **Then** BMAD widgets are moved to the selected line in the config

4. **Given** the TUI is running **When** the user selects a separator style (Serre/3sp, Modere/6sp, Large/15sp, Custom) **Then** separators between BMAD widgets update accordingly in the config

5. **Given** the TUI is running **When** the user selects composite mode (compact, full, or minimal) **Then** individual widgets are replaced by the selected composite widget and vice versa

6. **Given** the TUI writes config changes **When** the file is saved **Then** it follows the config mutation sequence (backup, write, validate)

7. **Given** `package.json` dependencies **When** Phase 3 begins **Then** `ink`, `react`, and `@inkjs/ui` are added as dependencies (ESM-compatible)

8. **Given** `~/.config/ccstatusline/settings.json` does not exist or contains invalid JSON **When** the TUI launches **Then** it displays an error message suggesting to run `npx bmad-statusline install` first and exits gracefully

9. **Given** `~/.config/ccstatusline/settings.json` exists but contains no BMAD widgets **When** the TUI launches **Then** it displays a message suggesting to run `npx bmad-statusline install` first and exits gracefully

10. **Given** the TUI is running **When** the user presses `Escape` or `Ctrl+C` **Then** the TUI exits without saving pending changes

11. **Given** the TUI is running **When** the user navigates **Then** arrow keys move between options, `Enter` confirms selection, `Tab` cycles between sections

## Tasks / Subtasks

- [x] Task 1: Add Phase 3 dependencies (AC: #7)
  - [x] 1.1 Run `npm install ink@6.8.0 react@^19.0.0 @inkjs/ui@2.0.0` in `bmad-statusline/`
  - [x] 1.2 Verify `package.json` updated with correct versions
  - [x] 1.3 Verify all existing tests still pass (`npm test`) — no regressions from dependency addition

- [x] Task 2: Update CLI dispatch for TUI (AC: #1)
  - [x] 2.1 Modify `bin/cli.js`: when no command argument is provided (and not `--help`/`-h`), `await import('../src/tui/app.js')` and call the exported render function
  - [x] 2.2 Update USAGE text to reflect that no-argument now launches the TUI configurator
  - [x] 2.3 Keep existing command dispatch (`install`, `uninstall`, `clean`) unchanged

- [x] Task 3: Create config loader module `src/tui/config-loader.js` (AC: #1, #8, #9)
  - [x] 3.1 Export `loadConfig(paths)` — reads and parses `~/.config/ccstatusline/settings.json`
  - [x] 3.2 Accept `paths` parameter for testability (same pattern as installer modules), with default `{ ccstatuslineConfig: path.join(os.homedir(), '.config', 'ccstatusline', 'settings.json') }`
  - [x] 3.3 Return `{ config, bmadWidgets, currentLine, error }` object
  - [x] 3.4 Detect BMAD widgets by filtering for `id` matching `bmad-*` pattern
  - [x] 3.5 Determine which line (0, 1, 2) BMAD widgets currently reside on
  - [x] 3.6 Return `{ error: 'not-found' }` if config file doesn't exist
  - [x] 3.7 Return `{ error: 'invalid-json' }` if config file contains invalid JSON
  - [x] 3.8 Return `{ error: 'no-bmad-widgets' }` if config exists but has zero `bmad-*` widgets

- [x] Task 4: Create config writer module `src/tui/config-writer.js` (AC: #6)
  - [x] 4.1 Export `saveConfig(config, paths)` — writes updated config to ccstatusline settings
  - [x] 4.2 Follow the mandatory config mutation sequence: read current file, parse, backup (.bak), stringify(null, 2), write, reread, parse (validate)
  - [x] 4.3 On validation failure: restore from `.bak`, return error
  - [x] 4.4 Use `fs.readFileSync` / `fs.writeFileSync` only (sync-only fs rule)
  - [x] 4.5 Use `path.join()` for all path construction, accept injected `paths` parameter

- [x] Task 5: Create widget registry `src/tui/widget-registry.js` (AC: #2, #5)
  - [x] 5.1 Define the full list of BMAD widget IDs and their metadata (display name, reader command, default enabled state)
  - [x] 5.2 Import `AGENT_COLORS`, `WORKFLOW_COLORS` from `src/defaults.js` for color reference
  - [x] 5.3 Export function `getIndividualWidgets()` — returns list of all individual widget definitions
  - [x] 5.4 Export function `getCompositeWidgets()` — returns list of composite widget definitions (compact, full, minimal)
  - [x] 5.5 Export function `buildWidgetConfig(enabledWidgets, readerPath, options)` — generates the ccstatusline widget array from selected widgets, separator style, and composite mode

- [x] Task 6: Create main TUI app `src/tui/app.js` (AC: #1, #2, #3, #4, #5, #10, #11)
  - [x] 6.1 Export a default render function that calls `ink.render(<App />)`
  - [x] 6.2 Use `React.createElement` (not JSX) to avoid needing a build step — OR use `.js` extension with `createElement` calls throughout
  - [x] 6.3 App component: load config via `config-loader.js` on mount
  - [x] 6.4 If config load returns error → render error message with install suggestion, auto-exit after brief delay
  - [x] 6.5 Main screen layout with sections: Widget List, Target Line, Separator Style, Composite Mode
  - [x] 6.6 Widget List section: show all BMAD widgets with toggle on/off (checkbox-style)
  - [x] 6.7 Target Line section: selector for line 1, 2, or 3
  - [x] 6.8 Separator Style section: selector for Serre (3sp), Modere (6sp), Large (15sp), Custom
  - [x] 6.9 Composite Mode section: selector for Individual, Compact, Full, Minimal
  - [x] 6.10 Navigation: `Tab` cycles between sections, arrow keys within section, `Enter` to toggle/select
  - [x] 6.11 Save action: `s` key or dedicated Save option to write config via `config-writer.js`
  - [x] 6.12 Exit: `Escape` or `Ctrl+C` exits without saving pending changes (use `useApp().exit()`)

- [x] Task 7: Create tests (AC: #1, #6, #8, #9)
  - [x] 7.1 Create `test/tui-config-loader.test.js` — test config loading: valid config with BMAD widgets, valid config without BMAD widgets, missing config file, invalid JSON file
  - [x] 7.2 Create `test/tui-config-writer.test.js` — test config writing: normal write with backup+validate, validation failure triggers restore
  - [x] 7.3 Create `test/tui-widget-registry.test.js` — test widget registry: individual widgets list, composite widgets list, buildWidgetConfig output shape
  - [x] 7.4 Run `npm test` and verify all tests pass (new + existing, zero regressions)

- [x] Task 8: Verify end-to-end (AC: all)
  - [x] 8.1 Run `node bin/cli.js` — verify TUI launches (requires terminal)
  - [x] 8.2 Verify error path: rename/delete ccstatusline config, run TUI, confirm error message shown
  - [x] 8.3 Verify existing commands (`install`, `uninstall`, `clean`, `--help`) still work

## Dev Notes

### Architecture Compliance — Critical Rules

**Boundary 5 — TUI (Phase 3):**
- All TUI code lives in `src/tui/` directory
- React/Ink components, ESM-native
- Imports from `src/defaults.js` for config data and widget definitions
- No interaction with reader at runtime — TUI modifies ccstatusline config, not reader behavior
- TUI reads/writes `~/.config/ccstatusline/settings.json` directly

**Error handling philosophy:** TUI is a user-facing interactive component. Use clear error messages (not the `logSuccess`/`logSkipped`/`logError` format — that's for non-interactive installer commands). However, the config-writer module follows the same config mutation sequence as installer modules.

**Sync-only fs:** Use `fs.readFileSync`/`fs.writeFileSync` — never async, never promises, never callbacks. This applies even in React components (config load/save operations are blocking and fast).

**Path construction:** Always `path.join()`. TUI modules accept `paths` parameter for testability. Never call `os.homedir()` directly inside component/function bodies — resolve defaults at the module boundary.

**Config JSON mutation sequence (for config-writer):**
```
read → parse → backup(.bak) → modify in memory → stringify(null, 2) → write → reread → parse(validate)
```
On validation failure: restore from `.bak`, report error to user. This is mandatory for any modification to `~/.config/ccstatusline/settings.json`.

### ccstatusline Config Format — CRITICAL (Easy to Get Wrong)

**Version 3 format:**
```json
{
  "version": 3,
  "lines": [ [...line0...], [...line1...], [...line2...] ]
}
```

- `lines` is an **array of 3 arrays** (one per line), NOT an object with `.widgets`
- Each array element is a widget object
- Widget properties: `id`, `type`, `commandPath` (NOT `command`), `color`, `preserveColors`
- BMAD widget detection: filter by `id` starting with `bmad-` (lowercase, hyphen)
- Separator widgets: `{ "id": "sep-...", "type": "separator" }` — separators are part of the widget array, not separate config

**BMAD widget IDs (from defaults.js `getWidgetDefinitions`):**
Current default install creates: `bmad-compact`, `sep-bmad-1`, `bmad-timer`

**All possible individual widget IDs:**
| Widget ID | Reader Command | Description |
|-----------|---------------|-------------|
| `bmad-project` | `project` | Project name |
| `bmad-workflow` | `workflow` | Current workflow (colored) |
| `bmad-agent` | `agent` | Active agent(s) (colored) |
| `bmad-step` | `step` | Current step |
| `bmad-nextstep` | `nextstep` | Next step |
| `bmad-progress` | `progress` | Progress fraction (3/6) |
| `bmad-progressbar` | `progressbar` | Visual progress bar |
| `bmad-progressstep` | `progressstep` | Fused progress + step name |
| `bmad-story` | `story` | Story ID + title |
| `bmad-request` | `request` | Request summary |
| `bmad-document` | `document` | Document name |
| `bmad-timer` | `timer` | Session timer |

**Composite widget IDs:**
| Widget ID | Reader Command | Description |
|-----------|---------------|-------------|
| `bmad-compact` | `compact` | Project + workflow + story + progressstep |
| `bmad-full` | `full` | All fields |
| `bmad-minimal` | `minimal` | Workflow + progressstep |

### Separator Styles

| Style | Content | Notes |
|-------|---------|-------|
| Serre | 3 spaces (`   `) | Default from brainstorming |
| Modere | 6 spaces | Medium spacing |
| Large | 15 spaces | Wide spacing |
| Custom | User-defined text | Free text separator |

Separators in ccstatusline config are actual widget objects with `type: "separator"`. The TUI inserts/removes separator widgets between BMAD widgets according to the selected style. The separator `id` should follow pattern `sep-bmad-N`.

### Composite vs Individual Mode

When user switches to a composite mode:
- Remove all individual BMAD widgets from the target line
- Insert the selected composite widget (e.g., `bmad-compact`)
- Optionally keep `bmad-timer` alongside composite (user preference)

When user switches back to individual mode:
- Remove the composite widget
- Insert the selected individual widgets according to the default layout from brainstorming:
  `[Project] [Agent] [Workflow] [Story|Request] [ProgressStep]`

### JSX-Free React/Ink Pattern

To avoid a build/transpilation step, use `React.createElement` directly instead of JSX:

```js
import React from 'react';
import { Box, Text } from 'ink';

const App = () => {
  return React.createElement(Box, { flexDirection: 'column' },
    React.createElement(Text, { bold: true }, 'BMAD Statusline Configurator')
  );
};
```

This keeps Phase 2's "no build step" principle. Alternatively, if the team prefers JSX, a babel build step would be needed — but the architecture says "no build step Phase 2" and Phase 3 may require bundling "if using JSX." The `createElement` approach avoids this entirely.

### Dependencies to Install

```bash
npm install ink@6.8.0 react@^19.0.0 @inkjs/ui@2.0.0
```

**CRITICAL:** The package is `@inkjs/ui` (scoped), NOT `ink-ui` (which is an unrelated Vue.js toolkit).

- `ink@6.8.0` — ESM-only, requires Node >=20 (already met), requires React >=19
- `react@19.2.4` (latest stable) — CJS+ESM, fully compatible with Ink 6
- `@inkjs/ui@2.0.0` — ESM-only, provides Select, MultiSelect, TextInput, ConfirmInput, Spinner, StatusMessage, Badge, Alert, etc.

### Useful `@inkjs/ui` Components for This Story

| Component | Use |
|-----------|-----|
| `Select` | Target line selection, separator style, composite mode |
| `MultiSelect` | Widget toggle on/off (checkbox style) |
| `ConfirmInput` | Save confirmation |
| `StatusMessage` | Error/success messages |
| `Badge` | Widget status indicators |
| `Spinner` | Loading state while reading config |

### CLI Dispatch Change

Current `bin/cli.js` behavior: no-argument → print usage, exit 0.

Phase 3 change: no-argument → launch TUI.

```js
// Modified dispatch in bin/cli.js
if (!command || command === '--help' || command === '-h') {
  if (!command) {
    // Phase 3: launch TUI
    const { default: launchTui } = await import('../src/tui/app.js');
    await launchTui();
  } else {
    console.log(USAGE);
  }
  process.exit(0);
}
```

Keep `--help`/`-h` printing usage text. Only the bare no-argument case changes.

### File Structure for This Story

```
bmad-statusline/
  src/
    tui/
      app.js                # Main TUI app — renders root component, exports launch function
      config-loader.js      # Load and validate ccstatusline config
      config-writer.js      # Save config following mutation sequence
      widget-registry.js    # Widget metadata, build widget arrays
  test/
    tui-config-loader.test.js
    tui-config-writer.test.js
    tui-widget-registry.test.js
```

### Previous Epic Intelligence

**From Epic 1 (all 5 stories done):**

- Node.js version requirement is `>=20` (bumped from original 16 for `node --test` compatibility) — already compatible with Ink 6.8.0
- Test glob form `test/*.test.js` — new test files will be auto-discovered
- Tests use `node:test` + `node:assert` built-in, zero dev deps
- Each test creates temp dir via `fs.mkdtempSync`, cleans up in `after()` hooks
- `src/defaults.js` exports `getWidgetDefinitions(readerPath)`, `AGENT_COLORS`, `WORKFLOW_COLORS` — import these, don't duplicate
- `bin/cli.js` uses `await import()` for ESM dynamic dispatch — follow same pattern for TUI import
- Config mutation sequence established and battle-tested in `src/install.js` — reuse the same pattern in `config-writer.js`, do NOT import from install.js (keep boundary separation)
- Review findings from Epic 1: `os.homedir()` must not be called inside function bodies, `BMAD_CACHE_DIR` env var respected, try/catch on fs operations, `withFileTypes: true` for `readdirSync`

### Project Structure Notes

- New directory: `bmad-statusline/src/tui/` — aligns with architecture Boundary 5
- 4 new source files in `src/tui/`: `app.js`, `config-loader.js`, `config-writer.js`, `widget-registry.js`
- 3 new test files in `test/`: `tui-config-loader.test.js`, `tui-config-writer.test.js`, `tui-widget-registry.test.js`
- 1 modified file: `bin/cli.js` (dispatch change for no-argument)
- No new test fixtures needed if tests create temp dirs programmatically (preferred pattern from Epic 1)
- `package.json` modified (3 new dependencies added)
- No changes to `src/defaults.js`, `src/install.js`, `src/uninstall.js`, `src/clean.js`, or `src/reader/bmad-sl-reader.js`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1] — acceptance criteria, BDD format
- [Source: _bmad-output/planning-artifacts/architecture.md#Starter Template Evaluation] — Phase 3 deps: ink, react, ink-ui
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules] — 6 critical rules
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries] — Boundary 5 (TUI)
- [Source: _bmad-output/planning-artifacts/architecture.md#Core Architectural Decisions] — config management, CLI dispatch
- [Source: _bmad-output/project-context.md#ccstatusline Contract] — config format v3, widget properties, detection pattern
- [Source: _bmad-output/project-context.md#Critical Implementation Rules] — 7 rules
- [Source: _bmad-output/brainstorming/brainstorming-session-2026-03-28-001.md#TUI Configurator] — features, separator styles, color modes
- [Source: _bmad-output/brainstorming/brainstorming-session-2026-03-28-001.md#Default Layout] — default widget order, conditional display
- [Source: _bmad-output/brainstorming/brainstorming-session-2026-03-28-001.md#Widget List] — complete widget inventory (17 widgets)
- [Source: _bmad-output/implementation-artifacts/1-5-clean-command.md] — Epic 1 intelligence, Node >=20, testing patterns, review findings

### Review Findings

- [x] [Review][Patch] Option "Custom" ajoutée aux styles de séparateur avec TextInput — AC #4 exige Serre/Modere/Large/Custom, seuls les 3 premiers sont implémentés [app.js:88, widget-registry.js:SEPARATOR_STYLES]
- [x] [Review][Dismiss] `ConfirmInput` remplacé par `TextInput`, sauvegarde directe confirmée par l'utilisateur — pas de dialogue de confirmation avant sauvegarde [app.js:5, app.js:handleSave]
- [x] [Review][Patch] `process.exit(0)` tue le TUI immédiatement après lancement — `launchTui()` retourne maintenant `waitUntilExit()`, cli.js restructuré
- [x] [Review][Patch] `sepContent` calculé mais jamais injecté — ajout de `content` dans le widget separator
- [x] [Review][Patch] `paths` undefined — guard `getReaderPath` vide bloque la sauvegarde, defaults fonctionnent via param defaults
- [x] [Review][Patch] Test CLI no-argument — remplacé par test d'import du module TUI
- [x] [Review][Patch] `getReaderPath` retourne `''` — guard ajouté dans `handleSave`
- [x] [Review][Patch] `handleSave` crash si `config.lines` < `targetLine` — ajout de padding `while` loop
- [x] [Review][Patch] `w.id.startsWith()` crash sans `id` — ajout guard `w.id &&` dans les deux filtres
- [x] [Review][Patch] Backup path par concaténation — remplacé par `path.join(path.dirname, path.basename + '.bak')`
- [x] [Review][Patch] `setSaving` synchrone dead code — supprimé, guard `!saveResult` sur la touche `s`
- [x] [Review][Patch] Separator style reset à 'serre' — ajout `detectSeparatorStyle()` qui lit la config existante
- [x] [Review][Patch] `enabledWidgets` vide — guard ajouté, sauvegarde refusée si aucun widget en mode individual
- [x] [Review][Patch] Trailing newline manquant — ajout `+ '\n'` dans config-writer stringify
- [x] [Review][Defer] Dépendances lourdes (react, ink) en `dependencies` au lieu de `optionalDependencies` — deferred, choix d'architecture Phase 3
- [x] [Review][Defer] project-context.md mentionne `ink-ui` au lieu de `@inkjs/ui` — deferred, doc externe

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- 118 tests pass (95 existing + 23 new), zero regressions
- TUI launches correctly in TTY; expected Ink raw mode error in non-TTY context
- Existing CLI commands (install, uninstall, clean, --help) verified working

### Completion Notes List

- **Task 1:** Added ink@6.8.0, react@19.2.4, @inkjs/ui@2.0.0 as dependencies. All 95 existing tests pass.
- **Task 2:** Modified `bin/cli.js` dispatch — no-argument now dynamically imports `src/tui/app.js` and launches TUI. Updated USAGE text. `--help`/`-h` still prints usage. Existing commands unchanged.
- **Task 3:** Created `src/tui/config-loader.js` with `loadConfig(paths)` — reads ccstatusline config, detects BMAD widgets by `bmad-*` id pattern, determines current line, returns structured error codes for missing/invalid/no-widgets cases.
- **Task 4:** Created `src/tui/config-writer.js` with `saveConfig(config, paths)` — follows mandatory mutation sequence (read, parse, backup, write, reread, validate). Restores from .bak on failure. Sync-only fs.
- **Task 5:** Created `src/tui/widget-registry.js` — defines all 12 individual and 3 composite widgets with metadata. `buildWidgetConfig()` generates ccstatusline widget arrays with proper separators for both individual and composite modes.
- **Task 6:** Created `src/tui/app.js` — React/Ink TUI using `React.createElement` (no JSX, no build step). 4-section layout (Widgets, Target Line, Separator, Composite Mode). Tab navigation, `s` to save, Escape to exit. Error screen with install suggestion for missing/invalid config.
- **Task 7:** Created 3 test files with 23 tests covering config-loader (7 tests), config-writer (5 tests), widget-registry (11 tests). Updated existing CLI test for new no-argument behavior.
- **Task 8:** Verified TUI launch, error paths, and all existing commands.

### Change Log

- 2026-03-28: Story 2.1 implemented — TUI Configurator foundation with widget management, config loader/writer, widget registry, and comprehensive tests.

### File List

- `bmad-statusline/package.json` — modified (added ink, react, @inkjs/ui dependencies)
- `bmad-statusline/package-lock.json` — modified (lockfile for new dependencies)
- `bmad-statusline/bin/cli.js` — modified (no-argument dispatch to TUI, updated USAGE text)
- `bmad-statusline/src/tui/config-loader.js` — new (config loading and validation)
- `bmad-statusline/src/tui/config-writer.js` — new (config writing with mutation sequence)
- `bmad-statusline/src/tui/widget-registry.js` — new (widget metadata and config builder)
- `bmad-statusline/src/tui/app.js` — new (main TUI React/Ink application)
- `bmad-statusline/test/tui-config-loader.test.js` — new (7 tests)
- `bmad-statusline/test/tui-config-writer.test.js` — new (5 tests)
- `bmad-statusline/test/tui-widget-registry.test.js` — new (11 tests)
- `bmad-statusline/test/cli.test.js` — modified (updated no-argument test for TUI behavior)
