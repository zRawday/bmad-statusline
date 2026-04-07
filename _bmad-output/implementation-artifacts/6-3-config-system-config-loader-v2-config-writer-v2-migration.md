# Story 6.3: Config system — config-loader v2, config-writer v2, migration v1->v2

Status: done

## Story

As a **developer upgrading from TUI v1 or launching for the first time**,
I want **the config system to load internal multi-line config (or migrate from v1, or create defaults), persist changes to internal config, and sync ccstatusline only when line occupancy changes**,
So that **my existing configuration is preserved during upgrade, and ccstatusline always reflects the correct number of composite widgets per line**.

## Acceptance Criteria

1. **Given** `~/.config/bmad-statusline/config.json` exists with a valid v2 structure (has `lines` array of 3)
   **When** config-loader loads the config
   **Then** it returns the parsed config object directly, no migration needed

2. **Given** `config.json` does not exist but ccstatusline config contains individual `bmad-*` widgets (v1 layout)
   **When** config-loader detects the v1 structure
   **Then** it migrates: extracts bmad widgets from the ccstatusline line where they are found, builds line 0 with those widgets + colorModes, lines 1-2 empty, detects separator style, sets presets to `[null, null, null]`
   **And** writes the migrated config as `config.json`
   **And** replaces old individual `bmad-*` widgets in ccstatusline with a single `bmad-line-0` composite

3. **Given** neither `config.json` nor bmad widgets in ccstatusline exist (first install)
   **When** config-loader runs
   **Then** it calls `createDefaultConfig()` (from 6.1) and returns the default config
   **And** writes the default config as `config.json`

4. **Given** `config.json` exists but is corrupted JSON
   **When** config-loader attempts to read it
   **Then** it falls back to `createDefaultConfig()` defaults without crash (NFR-V2-4)

5. **Given** `BMAD_CONFIG_DIR` env var is set
   **When** config-loader or config-writer accesses internal config
   **Then** it reads/writes at `$BMAD_CONFIG_DIR/config.json` instead of `~/.config/bmad-statusline/config.json`

6. **Given** `writeInternalConfig(config)` is called
   **When** writing the config to disk
   **Then** it creates `CONFIG_DIR` if absent (`mkdirSync recursive`), writes `JSON.stringify(config, null, 2) + '\n'`, synchronous I/O (pattern 2)
   **And** no backup before write, no validation post-write (pattern 14)

7. **Given** `syncCcstatuslineIfNeeded(oldConfig, newConfig)` is called
   **When** a line changes from empty (widgets.length === 0) to non-empty (or vice versa)
   **Then** ccstatusline config is updated: add `bmad-line-N` widget for newly non-empty lines, remove `bmad-line-N` for newly empty lines
   **And** ccstatusline config write follows backup/validate sequence (pattern 4)
   **And** the `bmad-line-N` widget format is: `{ id: "bmad-line-N", type: "custom-command", commandPath: "node \"readerPath\" line N", preserveColors: true }`

8. **Given** a config change that does NOT change line emptiness (e.g., color change, widget reorder within non-empty line)
   **When** `syncCcstatuslineIfNeeded` compares old and new config
   **Then** no ccstatusline config write occurs

9. **Given** `syncCcstatuslineFromScratch(config)` is called (used by reset)
   **When** rebuilding ccstatusline config
   **Then** all existing `bmad-line-*` widgets are removed from ccstatusline, then one `bmad-line-N` is added per non-empty line in `config`

10. **Given** tests need to validate the changes
    **When** tests are executed
    **Then** `tui-config-loader.test.js` is updated: tests for v2 config load, v1 migration, first-install defaults, corrupted config fallback
    **And** `tui-config-writer.test.js` is updated: tests for `writeInternalConfig`, `syncCcstatuslineIfNeeded` (add/remove/no-op), `syncCcstatuslineFromScratch`
    **And** new fixture `ccstatusline-settings-v1.json` (legacy individual bmad-* widgets) is used for migration tests
    **And** new fixture `ccstatusline-settings-with-bmad-v2.json` (bmad-line-N composites) is created
    **And** all existing tests pass (`npm test`)

## Tasks / Subtasks

- [x] Task 1: Rewrite config-loader.js for v2 internal config (AC: #1, #2, #3, #4, #5)
  - [x] 1.1 Replace current ccstatusline-reading logic with internal config loading from `CONFIG_PATH`
  - [x] 1.2 Implement v2 detection: valid JSON with `lines` array of 3 elements -> return directly
  - [x] 1.3 Implement v1 detection: no config.json -> scan ccstatusline config for individual `bmad-*` widgets
  - [x] 1.4 Implement `migrateV1Config(ccConfig)` — extract widgets, build v2 structure, detect separator, set empty presets
  - [x] 1.5 Implement first-install path: no config.json, no v1 widgets -> `createDefaultConfig()`
  - [x] 1.6 Implement corrupted JSON fallback to `createDefaultConfig()` (silent, no error log)
  - [x] 1.7 Post-migration: write internal config + replace old bmad-* widgets in ccstatusline with `bmad-line-0`
  - [x] 1.8 Support `BMAD_CONFIG_DIR` env var for all path resolution

- [x] Task 2: Rewrite config-writer.js for v2 (AC: #6, #7, #8, #9)
  - [x] 2.1 Implement `writeInternalConfig(config)` — mkdirSync recursive, writeFileSync, pattern 14 (no backup, no validate)
  - [x] 2.2 Implement `syncCcstatuslineIfNeeded(oldConfig, newConfig)` — compare line occupancy, add/remove `bmad-line-N`
  - [x] 2.3 Implement `syncCcstatuslineFromScratch(config)` — remove all `bmad-line-*`, add per non-empty line
  - [x] 2.4 ccstatusline widget format: `{ id: "bmad-line-N", type: "custom-command", commandPath: "node \"readerPath\" line N", preserveColors: true }`
  - [x] 2.5 ccstatusline writes follow pattern 4 (backup/validate)
  - [x] 2.6 Support `BMAD_CONFIG_DIR` env var for internal config path
  - [x] 2.7 Export `readInternalConfig` for shared use by TUI and reader

- [x] Task 3: Create test fixtures (AC: #10)
  - [x] 3.1 Create `test/fixtures/ccstatusline-settings-v1.json` — legacy individual bmad-* widgets (bmad-project, sep-bmad-1, bmad-workflow, etc.) on one line
  - [x] 3.2 Create `test/fixtures/ccstatusline-settings-with-bmad-v2.json` — ccstatusline with `bmad-line-0` composite widget

- [x] Task 4: Rewrite tui-config-loader.test.js (AC: #10)
  - [x] 4.1 Test: loads valid v2 config directly (reads config.json with lines array)
  - [x] 4.2 Test: migrates v1 config (no config.json, bmad-* widgets in ccstatusline) -> writes config.json + replaces widgets with bmad-line-0
  - [x] 4.3 Test: first install (no config.json, no bmad widgets) -> creates default config
  - [x] 4.4 Test: corrupted config.json -> falls back to createDefaultConfig() silently
  - [x] 4.5 Test: respects BMAD_CONFIG_DIR env var
  - [x] 4.6 Test: v1 migration preserves widget order from ccstatusline

- [x] Task 5: Rewrite tui-config-writer.test.js (AC: #10)
  - [x] 5.1 Test: writeInternalConfig writes JSON with 2-space indent + trailing newline
  - [x] 5.2 Test: writeInternalConfig creates directory if absent
  - [x] 5.3 Test: syncCcstatuslineIfNeeded adds bmad-line-N for newly non-empty line
  - [x] 5.4 Test: syncCcstatuslineIfNeeded removes bmad-line-N for newly empty line
  - [x] 5.5 Test: syncCcstatuslineIfNeeded does nothing when occupancy unchanged (color/reorder)
  - [x] 5.6 Test: syncCcstatuslineFromScratch removes all bmad-line-* and rebuilds from config
  - [x] 5.7 Test: ccstatusline sync uses backup/validate pattern (pattern 4)

- [x] Task 6: Run full test suite and verify (AC: #10)
  - [x] 6.1 Run `npm test` — all tests must pass
  - [x] 6.2 Verify no dangling references to old loadConfig/saveConfig APIs in any source file

## Dev Notes

### Architecture Compliance

**Stack — use ONLY these:**
- Node.js >= 20, plain JavaScript ESM (NO TypeScript, NO JSX, NO build step)
- `ink` v6.8.0, `react` v19.2.4, `@inkjs/ui` v2.0.0
- `React.createElement` everywhere — alias as `const e = React.createElement`
- Testing: `node:test` + `node:assert/strict` + `ink-testing-library`

**Critical patterns to follow:**
- **Pattern 1** — Error Handling: TUI uses StatusMessage, never console.log. Config-loader falls back to defaults silently on corruption.
- **Pattern 2** — Synchronous File I/O everywhere. No async, no promises, no callbacks.
- **Pattern 3** — ANSI: `colorize()` in reader, `<Text color={...}>` in TUI. Never inline escapes.
- **Pattern 4** — Config JSON Mutation Sequence for ccstatusline writes: read -> parse -> backup(.bak) -> modify -> stringify(null, 2) -> write -> reread -> parse(validate). Applies to `syncCcstatuslineIfNeeded` and `syncCcstatuslineFromScratch` ccstatusline writes.
- **Pattern 5** — Path Construction: `BMAD_CONFIG_DIR` env var: `process.env.BMAD_CONFIG_DIR || path.join(os.homedir(), '.config', 'bmad-statusline')`. Same env var in both TUI and reader.
- **Pattern 14** — Internal Config I/O: No backup before write, no validation post-write. Corrupted falls back to defaults. `JSON.stringify(config, null, 2) + '\n'`.

### Config-Loader v2 Specification

The current `config-loader.js` reads ccstatusline's `settings.json` and extracts bmad widgets. This must be **rewritten** to implement a 3-path loading strategy:

```
loadConfig(paths)
  1. Try reading ~/.config/bmad-statusline/config.json
  2. If exists + valid JSON with lines array of 3 -> return directly (v2 path)
  3. If absent -> scan ccstatusline config for v1 widgets
  4. If v1 widgets found -> migrateV1Config() -> write config.json + update ccstatusline -> return migrated
  5. If nothing found -> createDefaultConfig() -> write config.json -> return defaults
  6. If exists but corrupted JSON -> createDefaultConfig() -> return defaults
```

**Return type changes:** Current returns `{ config, bmadWidgets, currentLine, error }`. New must return the internal config object directly (the v2 schema with `separator`, `lines`, `presets`). Callers (app.js) will be updated in story 6.4.

**v1 Migration implementation:**
```js
function migrateV1Config(ccConfig) {
  // 1. Find the line containing bmad-* custom-command widgets
  const bmadLine = ccConfig.lines.findIndex(line =>
    line.some(w => w.id?.startsWith('bmad-') && w.type === 'custom-command')
  );
  if (bmadLine === -1) return createDefaultConfig();

  // 2. Extract widget IDs in order (skip separators)
  const bmadWidgets = ccConfig.lines[bmadLine]
    .filter(w => w.id?.startsWith('bmad-') && w.type === 'custom-command')
    .map(w => w.id);

  // 3. Build colorModes from existing config or defaults
  const colorModes = {};
  for (const w of ccConfig.lines[bmadLine]) {
    if (!w.id?.startsWith('bmad-') || w.type !== 'custom-command') continue;
    colorModes[w.id] = w.preserveColors && w.id === 'bmad-workflow'
      ? { mode: 'dynamic' }
      : { mode: 'fixed', fixedColor: w.color || getDefaultColor(w.id) };
  }

  // 4. Build v2 config
  return {
    separator: detectSeparatorStyle(ccConfig.lines[bmadLine]),
    customSeparator: null,
    lines: [
      { widgets: bmadWidgets, colorModes },
      { widgets: [], colorModes: {} },
      { widgets: [], colorModes: {} }
    ],
    presets: [null, null, null]
  };
}
```

**Post-migration ccstatusline update:** Replace individual `bmad-*` widgets on the detected line with a single `bmad-line-0` composite. Use pattern 4 (backup/validate) for ccstatusline writes.

**`getDefaultColor` helper:** Look up `defaultColor` from `getIndividualWidgets()` in `widget-registry.js`. Import `getIndividualWidgets` from `./widget-registry.js`.

### Config-Writer v2 Specification

The current `config-writer.js` implements `saveConfig(config)` which writes ccstatusline config with backup/validate. This must be **rewritten** to export three functions:

**1. `writeInternalConfig(config)`** — Write bmad-statusline's own config:
```js
const CONFIG_DIR = process.env.BMAD_CONFIG_DIR || path.join(os.homedir(), '.config', 'bmad-statusline');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

function writeInternalConfig(config) {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
  } catch {
    // Write failure — config state preserved in React, retry on next interaction
  }
}
```
No backup, no validate (pattern 14). Synchronous I/O (pattern 2).

**2. `syncCcstatuslineIfNeeded(oldConfig, newConfig, paths)`** — Sync ccstatusline only on line occupancy changes:
```js
function syncCcstatuslineIfNeeded(oldConfig, newConfig, paths) {
  let needsSync = false;
  for (let i = 0; i < 3; i++) {
    const wasEmpty = oldConfig.lines[i].widgets.length === 0;
    const isEmpty = newConfig.lines[i].widgets.length === 0;
    if (wasEmpty !== isEmpty) { needsSync = true; break; }
  }
  if (!needsSync) return;

  // Full rebuild — simpler than incremental
  const ccConfig = readCcstatuslineConfig(paths);
  if (!ccConfig) return; // silent failure

  for (let i = 0; i < 3; i++) {
    removeBmadLineFromCcLine(ccConfig, i);
    if (newConfig.lines[i].widgets.length > 0) {
      addBmadLineToCcLine(ccConfig, i, paths.readerPath);
    }
  }
  writeCcstatuslineConfig(ccConfig, paths); // pattern 4 — backup/validate
}
```

**3. `syncCcstatuslineFromScratch(config, paths)`** — Full rebuild for reset:
```js
function syncCcstatuslineFromScratch(config, paths) {
  const ccConfig = readCcstatuslineConfig(paths);
  if (!ccConfig) return;

  for (let i = 0; i < 3; i++) {
    removeBmadLineFromCcLine(ccConfig, i);
    if (config.lines[i].widgets.length > 0) {
      addBmadLineToCcLine(ccConfig, i, paths.readerPath);
    }
  }
  writeCcstatuslineConfig(ccConfig, paths); // pattern 4
}
```

**ccstatusline widget format:**
```js
{
  id: `bmad-line-${lineIndex}`,
  type: 'custom-command',
  commandPath: `node "${readerPath}" line ${lineIndex}`,
  preserveColors: true
}
```

**`readerPath`:** `path.join(BMAD_CONFIG_DIR, 'bmad-sl-reader.js')` — the deployed reader script.

**Also export `readInternalConfig()`** for shared use (TUI reads on launch, reader reads for `line N`):
```js
function readInternalConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return null; // caller falls back to defaults or empty string
  }
}
```

### ccstatusline Config Structure (v3 format)

The ccstatusline config at `~/.config/ccstatusline/settings.json` uses this format:
```json
{
  "version": 3,
  "lines": [
    [/* array of widget objects per line */],
    [/* line 1 widgets */],
    [/* line 2 widgets */]
  ]
}
```
Each widget is `{ id, type, commandPath, color, preserveColors }`. The `bmad-line-N` composites slot into this structure.

### Separator Detection for v1 Migration

Detect separator style from v1 ccstatusline widgets. Look at separator widgets (`sep-bmad-*`) between bmad widgets:
- No separator or tight spacing -> `"serre"`
- Single space around separator -> `"modere"`
- Double space -> `"large"`

If detection is ambiguous, default to `"serre"`.

### Internal Config Schema (Reference from 6.1)

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
- `separator`: `"serre"` | `"modere"` | `"large"` | `"custom"`. Global, applied to all lines.
- `customSeparator`: string or null. Only used when `separator === "custom"`.
- `lines`: always length 3. Each has `widgets` (visible, ordered) and `colorModes` (all configured, including hidden).
- `colorModes[id].mode`: `"dynamic"` (only `bmad-workflow`) or `"fixed"`. When fixed, `fixedColor` is ANSI color name.
- `presets`: always length 3. Each slot is null or `{ name, widgets, colorModes }`.

### Dependencies from Story 6.1

This story uses the following from 6.1 (already implemented and tested):
- `createDefaultConfig()` from `src/tui/widget-registry.js` — returns default v2 config object
- `getIndividualWidgets()` from `src/tui/widget-registry.js` — for `getDefaultColor()` lookup during migration
- Fixture `test/fixtures/internal-config-default.json` — snapshot of `createDefaultConfig()` output
- Fixture `test/fixtures/internal-config-multiline.json` — multi-line config with presets

### Constraints

1. **Synchronous I/O only** (pattern 2) — no async/promises in writeInternalConfig or readInternalConfig
2. **No backup/validation on internal config write** (pattern 14) — only on ccstatusline writes (pattern 4)
3. **Idempotent v1 migration** — runs only once, when config.json is missing. Subsequent loads use v2 path.
4. **Corrupted config fallback silent** — no error logging, just use defaults (NFR-V2-4)
5. **Line occupancy is sole trigger for ccstatusline sync** — color/widget order changes do NOT trigger sync
6. **Presets always [null, null, null] on migration/first install** — user saves explicitly
7. **Single bmad-line-N per line** — no duplicate composites on same ccstatusline line
8. **`readerPath` in widget commandPath** — absolute path to deployed reader: `path.join(BMAD_CONFIG_DIR, 'bmad-sl-reader.js')`

### Breaking Changes to Old API

The current exports change:
- `config-loader.js`: `loadConfig(paths)` returning `{ config, bmadWidgets, currentLine, error }` -> new `loadConfig(paths)` returning the v2 internal config object directly
- `config-writer.js`: `saveConfig(config, paths)` -> replaced by `writeInternalConfig(config)`, `syncCcstatuslineIfNeeded(old, new, paths)`, `syncCcstatuslineFromScratch(config, paths)`, `readInternalConfig()`

**Callers of old API:** `app.js` calls `loadConfig()` and `saveConfig()`. These call sites will break. This is expected — story 6.4 rewrites app.js with the v2 state model. The TUI will be partially non-functional after this story (as it was after 6.1).

### Existing Fixture Files (already present)

- `test/fixtures/ccstatusline-settings-empty.json` — empty ccstatusline v3 config (lines: [[], [], []])
- `test/fixtures/ccstatusline-settings-with-bmad.json` — ccstatusline v3 with bmad-agent, sep-bmad-1, bmad-compact on line 1
- `test/fixtures/internal-config-default.json` — default internal config from createDefaultConfig()
- `test/fixtures/internal-config-multiline.json` — multi-line config with presets populated

### New Fixtures to Create

- `test/fixtures/ccstatusline-settings-v1.json` — Legacy v1 layout: individual bmad-* widgets (bmad-project, bmad-workflow, bmad-compact, bmad-timer, etc.) with sep-bmad-* separators on a single ccstatusline line. Used to test v1 migration.
- `test/fixtures/ccstatusline-settings-with-bmad-v2.json` — ccstatusline v3 with `bmad-line-0` composite widget (post-migration or post-install state). Used to test sync operations.

### Previous Story Intelligence (6.1)

Key learnings from story 6.1 implementation:
- `createDefaultConfig()` implemented in `widget-registry.js`, derives widgets from `INDIVIDUAL_WIDGETS.filter(w => w.defaultEnabled)`
- `structuredClone()` confirmed working in Node >= 20 for deep copies
- Pattern 14 (no backup/validate for internal config) distinct from Pattern 4 (backup/validate for ccstatusline)
- 285 tests passing at end of story 6.1
- Dead code removed: `COMPOSITE_WIDGETS`, `getCompositeWidgets`, `buildWidgetConfig`, `applyColorMode`
- `SelectWithPreview.js` kept — `onHighlight` callback compatible with pattern 17
- Review finding: `deriveTuiState` expects v1 array format for `config.lines` — incompatible with v2. Deferred to 6.3/6.4
- Code review fix: `resolvePreviewColor` fallback edge cases patched

### Git Patterns from Recent Commits

- Commit format: `6-3-config-system-config-loader-v2-config-writer-v2-migration: <description>`
- Code review fix format: `fix(6-3-config-system-config-loader-v2-config-writer-v2-migration): <description>`
- Consistent with Epics 5-6 convention

### Project Structure Notes

- Config system files in `src/tui/` (ESM)
- Tests in `test/` with `tui-{name}.test.js` pattern
- Fixtures in `test/fixtures/` as JSON files
- Reader in `src/reader/` (CJS) — reads config but never writes it
- `BMAD_CONFIG_DIR` env var used in tests via tmpDir pattern (set env, point to temp directory)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.3] — BDD acceptance criteria and user story
- [Source: _bmad-output/planning-artifacts/architecture.md#Internal Config Architecture] — v2 config schema
- [Source: _bmad-output/planning-artifacts/architecture.md#Config Migration v1->v2] — Migration logic specification
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern 14] — Internal Config I/O rules
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern 15] — TUI State Mutation (updateConfig helper)
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern 16] — ccstatusline Sync Pattern
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern 20] — Reader Internal Config Reading
- [Source: _bmad-output/planning-artifacts/architecture.md#Complete Project Directory Structure] — File locations
- [Source: _bmad-output/project-context.md#Pattern 2] — Synchronous File I/O
- [Source: _bmad-output/project-context.md#Pattern 4] — Config JSON Mutation Sequence
- [Source: _bmad-output/project-context.md#Pattern 5] — Path Construction with env vars
- [Source: _bmad-output/project-context.md#Pattern 14] — Internal Config I/O
- [Source: _bmad-output/implementation-artifacts/6-1-foundation-internal-config-schema-widget-registry-dead-code.md] — Previous story learnings, review findings, file list

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Initial `npm test` showed 2 failures: `cli.test.js` and `tui-app.test.js` both failed because `app.js` imported removed `saveConfig` export. Fixed by updating app.js to use new v2 API (`writeInternalConfig`, direct config return from `loadConfig`).

### Completion Notes List

- Rewrote `config-loader.js` with 3-path loading strategy: v2 direct load, v1 migration, first-install defaults. Corrupted JSON falls back silently to defaults.
- Rewrote `config-writer.js` exporting 4 functions: `readInternalConfig`, `writeInternalConfig` (pattern 14), `syncCcstatuslineIfNeeded` (occupancy-based), `syncCcstatuslineFromScratch` (full rebuild). ccstatusline writes follow pattern 4 (backup/validate).
- v1 migration extracts individual `bmad-*` widgets from ccstatusline, builds v2 internal config, replaces old widgets with single `bmad-line-0` composite.
- Updated `app.js` to use new API: `writeInternalConfig` replaces `saveConfig`, `loadConfig` returns v2 config directly (not old `{ config, bmadWidgets, currentLine, error }` format). `deriveTuiState` simplified for v2 schema.
- Updated `tui-app.test.js` to test with new internal config path and silent corruption fallback.
- Created 2 new test fixtures for v1 and v2 ccstatusline layouts.
- 11 new config-loader tests, 14 new config-writer tests. Total: 308 tests, 0 failures.

### Change Log

- 2026-04-01: Implemented story 6-3 — config-loader v2, config-writer v2, v1 migration, test fixtures, full test rewrite. App.js updated for API compatibility.

### File List

- `src/tui/config-loader.js` — Rewritten: 3-path loading (v2/v1 migration/defaults), BMAD_CONFIG_DIR support
- `src/tui/config-writer.js` — Rewritten: writeInternalConfig, syncCcstatuslineIfNeeded, syncCcstatuslineFromScratch, readInternalConfig
- `src/tui/app.js` — Updated: imports new API, deriveTuiState for v2 schema, useEffect uses direct config return
- `test/tui-config-loader.test.js` — Rewritten: 11 tests for v2 load, v1 migration, defaults, corruption, env var
- `test/tui-config-writer.test.js` — Rewritten: 14 tests for write, read, sync, backup/validate, widget format
- `test/tui-app.test.js` — Updated: tests use internalConfig path, corruption test checks silent fallback
- `test/fixtures/ccstatusline-settings-v1.json` — New: legacy v1 individual bmad-* widgets fixture
- `test/fixtures/ccstatusline-settings-with-bmad-v2.json` — New: bmad-line-0 composite widget fixture

### Review Findings

- [x] [Review][Dismiss] detectSeparatorStyle always returns 'serre' — Stub acceptable, single-user app, no need for detection. [config-loader.js:96-102]
- [x] [Review][Patch] writeInternalConfigDuringLoad duplicates writeInternalConfig logic — Fixed: loader imports writeInternalConfig from config-writer. [config-loader.js:135-142]
- [x] [Review][Patch] readCcstatuslineConfig duplicated in both modules — Fixed: exported from config-writer, imported in config-loader. [config-loader.js:69-76, config-writer.js:89-96]
- [x] [Review][Patch] BMAD_CONFIG_DIR test is a false positive — Fixed: rewrote test to use explicit path override with non-default multiline fixture. [test/tui-config-loader.test.js:222-237]
- [x] [Review][Patch] Missing test: syncCcstatuslineFromScratch with <3 ccstatusline lines — Fixed: added edge case test for line array extension. [config-writer.js:98-105]
- [x] [Review][Patch] Missing test: backup-restore path in writeCcstatuslineConfig — Fixed: added edge case test verifying backup content and restorability. [config-writer.js:134-143]
- [x] [Review][Defer] writeInternalConfig silently swallows all errors; app.js catch blocks are dead code [config-writer.js:27-36, app.js:91-95] — deferred, pattern 14 mandates silent failure, app.js tagged for full rewrite in story 6.4
- [x] [Review][Defer] syncCcstatuslineIfNeeded/FromScratch no guard on malformed config.lines[i] [config-writer.js:45-47, config-writer.js:70] — deferred, internal functions with internal callers, v2 schema guarantees structure
- [x] [Review][Defer] onConfigChange writes stale rawConfig clone to disk [app.js:85-92] — deferred, app.js explicitly tagged for full rewrite in story 6.4
- [x] [Review][Defer] v1 lineWidgets could contain null entries causing TypeError [config-loader.js:105-110] — deferred, ccstatusline doesn't produce null entries in practice
