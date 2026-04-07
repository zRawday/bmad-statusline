# Story 6.6: Installer & Uninstaller — Per-line deployment, internal config creation, upgrade path v1->v2

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer installing or upgrading bmad-statusline**,
I want **the installer to deploy one composite `bmad-line-N` widget per configured non-empty line, create the internal config with defaults on first install, and automatically upgrade from v1 individual widgets to v2 composites**,
So that **ccstatusline displays my configured lines correctly after install/upgrade, and uninstall cleanly removes all bmad artifacts**.

## Acceptance Criteria

1. **Given** the developer runs `npx bmad-statusline install` on a fresh system (no prior bmad-statusline)
   **When** the installer runs target 2 (ccstatusline widgets)
   **Then** `getWidgetDefinitions(readerPath)` returns `[{ id: "bmad-line-0", type: "custom-command", commandPath: "node \"readerPath\" line 0", preserveColors: true }]`
   **And** `bmad-line-0` is injected into ccstatusline line 0

2. **Given** fresh install
   **When** the installer runs the internal config target (NEW)
   **Then** if `~/.config/bmad-statusline/config.json` does not exist, it creates it with `createDefaultConfig()` defaults
   **And** if it already exists, it is skipped (idempotent)
   **And** `logSuccess("internal config", "created default configuration")` or `logSkipped("internal config", "already exists")`

3. **Given** the developer runs install on a system with v1 individual `bmad-*` widgets in ccstatusline
   **When** the installer detects old widgets (ids matching `bmad-*` with `type: "custom-command"` but NOT `bmad-line-*`)
   **Then** all old individual `bmad-*` widgets are removed from ccstatusline
   **And** a single `bmad-line-0` composite is injected on the line where the old widgets were found
   **And** internal config is created via migration logic (from 6.3) if `config.json` does not exist
   **And** `logSuccess("ccstatusline", "upgraded v1 widgets to v2 composite")`

4. **Given** the developer runs install on a system already at v2 (has `bmad-line-0` in ccstatusline)
   **When** the installer checks for existing composites
   **Then** it skips widget injection (idempotent — `bmad-line-0` already present)
   **And** `logSkipped("ccstatusline", "bmad-line-0 already present")`

5. **Given** the installer deploys the reader and hook
   **When** the deploy targets run
   **Then** `bmad-sl-reader.js` and `bmad-hook.js` are always overwritten to `~/.config/bmad-statusline/` (existing behavior, unchanged)

6. **Given** the ccstatusline config write during install
   **When** the installer modifies ccstatusline settings.json
   **Then** it follows pattern 4: read -> parse -> backup(.bak) -> modify -> stringify(null, 2) -> write -> reread -> validate
   **And** on validation failure: restore from `.bak`, `logError`, exit 1

7. **Given** the developer runs `npx bmad-statusline uninstall`
   **When** the uninstaller processes ccstatusline widgets
   **Then** it removes all widgets with `id` matching `bmad-line-*` (v2 composites)
   **And** it removes all widgets with `id` matching `bmad-*` that are NOT `bmad-line-*` (v1 backward compat)
   **And** `logSuccess("ccstatusline", "removed bmad widgets")`

8. **Given** the uninstaller processes internal config
   **When** `~/.config/bmad-statusline/` is deleted (existing behavior — removes reader + hook)
   **Then** `config.json` is also deleted as part of the directory deletion (no separate target needed — same directory)

9. **Given** the uninstaller processes backward compat
   **When** checking for Phase 1 artifacts (CLAUDE.md block, settings.local.json permissions) and Phase 2 artifacts (PostToolUse Skill matcher)
   **Then** all backward compat detection and removal from Epic 3/5 is preserved unchanged

10. **Given** `defaults.js` `getWidgetDefinitions(readerPath)`
    **When** the function is called
    **Then** it returns the v2 format: single `bmad-line-0` composite (not individual widgets, not `bmad-compact`)
    **And** no `color` property on the widget — `preserveColors: true` means reader ANSI output is used

11. **Given** tests need to validate the changes
    **When** tests are executed
    **Then** `install.test.js` is updated: test for `bmad-line-0` injection, test for v1->v2 upgrade (detect old widgets, replace with composite), test for idempotency (skip if present), test for internal config creation
    **And** `uninstall.test.js` is updated: test for `bmad-line-*` removal, test for `bmad-*` backward compat removal, test that directory deletion covers config.json
    **And** `defaults.test.js` is updated: test that `getWidgetDefinitions` returns `bmad-line-0` format
    **And** all existing tests pass (`npm test`)

## Tasks / Subtasks

- [x] Task 1: Update `getWidgetDefinitions()` in defaults.js (AC: #1, #10)
  - [x] 1.1 Replace return value: remove `bmad-compact` + `sep-bmad-1` + `bmad-timer` (3 v1 widgets), replace with single `bmad-line-0` composite: `{ id: 'bmad-line-0', type: 'custom-command', commandPath: \`node "\${readerPath}" line 0\`, preserveColors: true }`. No `color` property.
  - [x] 1.2 Verify no other file imports `bmad-compact` or `sep-bmad-1` IDs — clean removal.

- [x] Task 2: Add new install target for internal config creation (AC: #2)
  - [x] 2.1 Create `installTarget7(paths)` (or renumber as appropriate) — new target for `~/.config/bmad-statusline/config.json`
  - [x] 2.2 Import `createDefaultConfig` from `../tui/widget-registry.js` (already exported from 6.1)
  - [x] 2.3 Logic: if `config.json` exists at `paths.readerDir + '/config.json'` -> `logSkipped("internal config", "already exists")`. Else -> write `createDefaultConfig()` as `JSON.stringify(config, null, 2) + '\n'` -> `logSuccess("internal config", "created default configuration")`.
  - [x] 2.4 Use pattern 14 for internal config write (no backup, no validate) — same as config-writer.js.
  - [x] 2.5 Add target to the `install()` main function's results array.

- [x] Task 3: Update installTarget2 for v2 per-line deployment (AC: #1, #3, #4, #6)
  - [x] 3.1 Change v2 detection: check for `bmad-line-*` IDs specifically (not just any `bmad-*`). `const hasV2 = allWidgets.some(w => w.id?.startsWith('bmad-line-'));`. If v2 present -> `logSkipped(target, 'bmad-line-0 already present')` + return.
  - [x] 3.2 Add v1 detection + upgrade: `const hasV1 = allWidgets.some(w => w.id?.startsWith('bmad-') && w.type === 'custom-command' && !w.id.startsWith('bmad-line-'));`. If v1 detected -> remove all `bmad-*` and `sep-bmad-*` from all lines -> inject `bmad-line-0` on line 0 -> `logSuccess(target, 'upgraded v1 widgets to v2 composite')`.
  - [x] 3.3 Fresh install path (no v1, no v2): inject `bmad-line-0` on line 0 (NOT line 1 as current code does). Change `targetLine` from `1` to `0`.
  - [x] 3.4 Use `getWidgetDefinitions(paths.readerDest)` — now returns single v2 widget array. Inject on target line.

- [x] Task 4: Update uninstallTarget2 for v2 completeness (AC: #7)
  - [x] 4.1 Current `isBmad` filter already matches both `bmad-*` and `sep-bmad-*` — verify it catches `bmad-line-0`, `bmad-line-1`, `bmad-line-2` (it does since `bmad-line-*` starts with `bmad-`). No code change needed if filter works. Add explicit comment for clarity.
  - [x] 4.2 Verify `config.json` deletion is covered by `uninstallTarget3` (directory deletion of `~/.config/bmad-statusline/`). It is — `fs.rmSync(paths.readerDir, { recursive: true })` deletes the whole dir including `config.json`. No separate target needed.

- [x] Task 5: Update test fixtures (AC: #11)
  - [x] 5.1 Update `ccstatusline-settings-with-bmad.json`: change from v1 widgets (`bmad-agent`, `sep-bmad-1`, `bmad-compact`) to v2 format (`bmad-line-0` on line 0). Match the structure of `ccstatusline-settings-with-bmad-v2.json`.
  - [x] 5.2 Verify `ccstatusline-settings-v1.json` fixture exists and has individual `bmad-project`, `bmad-workflow` etc. on a line (it does — used for migration tests).

- [x] Task 6: Update defaults.test.js (AC: #11)
  - [x] 6.1 Update `getWidgetDefinitions` test: assert returns array of length 1 (not 3). Assert the single widget has `id: 'bmad-line-0'`, `type: 'custom-command'`, `commandPath` includes `line 0` and reader path, `preserveColors: true`, no `color` property.

- [x] Task 7: Update install.test.js (AC: #11)
  - [x] 7.1 Update Target 2 "injects widgets when absent" test: assert exactly 1 bmad widget on line 0 (not line 1), ID = `bmad-line-0`, no `color` property, `preserveColors: true`.
  - [x] 7.2 Update Target 2 "skips when BMAD widgets already present" test: use updated `ccstatusline-settings-with-bmad.json` fixture (now has `bmad-line-0`). Assert skip behavior unchanged.
  - [x] 7.3 Add Target 2 "upgrades v1 widgets to v2 composite" test: use `ccstatusline-settings-v1.json` fixture (has individual `bmad-*` widgets). Run install. Assert old widgets removed, `bmad-line-0` injected on line 0, output includes "upgraded".
  - [x] 7.4 Update Target 2 "preserves existing user widgets" test: verify user widgets on other lines remain after v2 injection on line 0.
  - [x] 7.5 Add internal config target test: run install on fresh system (no config.json). Assert `config.json` created in `paths.readerDir` with valid v2 structure (3 lines, presets array). Assert log includes "created default configuration".
  - [x] 7.6 Add internal config idempotency test: pre-create `config.json` in `paths.readerDir`. Run install. Assert file unchanged. Assert log includes "already exists".

- [x] Task 8: Update uninstall.test.js (AC: #11)
  - [x] 8.1 Add test for v2 widget removal: create ccstatusline fixture with `bmad-line-0`, `bmad-line-1`. Run uninstall. Assert no `bmad-line-*` remain.
  - [x] 8.2 Add test for mixed v1+v2 removal: create ccstatusline fixture with both `bmad-compact` (v1) and `bmad-line-0` (v2). Run uninstall. Assert all bmad widgets removed.
  - [x] 8.3 Add test for config.json deletion: create `config.json` in `paths.readerDir`. Run uninstall. Assert file deleted (covered by directory deletion).

- [x] Task 9: Run full test suite (AC: #11)
  - [x] 9.1 Run `npm test` — all tests must pass (325+ before, expect same or more after additions)

## Dev Notes

### Architecture Compliance

**Stack — use ONLY these:**
- Node.js >= 20, plain JavaScript ESM (NO TypeScript, NO JSX, NO build step)
- Testing: `node:test` + `node:assert/strict`
- Zero runtime deps for installer (Node.js stdlib only)

**Critical patterns to follow:**

- **Pattern 1** — Error Handling: Installer = **verbose always**. Log every action with `logSuccess`/`logSkipped`/`logError`. Never silent. Unlike TUI (StatusMessage) or reader (silent).
- **Pattern 2** — Synchronous File I/O everywhere. `readFileSync`/`writeFileSync`. No async.
- **Pattern 4** — Config JSON Mutation (ccstatusline writes only): `read -> parse -> backup(.bak) -> modify -> stringify(null, 2) -> write -> reread -> parse(validate)`. On failure: restore from `.bak`. **Applies to installTarget2 (ccstatusline) only, NOT to internal config writes.**
- **Pattern 5** — Path Resolution: All paths through injected `paths` parameter in installer (testability). `path.join()` everywhere.
- **Pattern 6** — Console Output Format:
  ```js
  function logSuccess(target, message) { console.log(`  ✓ ${target} — ${message}`); }
  function logSkipped(target, message) { console.log(`  ○ ${target} — ${message}`); }
  function logError(target, message)   { console.log(`  ✗ ${target} — ${message}`); }
  ```
- **Pattern 14** — Internal Config I/O: No backup before write, no validation post-write. Corrupted falls back to defaults on next read. Used for `config.json` writes (NOT ccstatusline). Simple: `mkdirSync(recursive) -> writeFileSync(stringify(null,2) + '\n')`.

### Current install.js Target Structure (6 targets)

| Target | File | What it does |
|--------|------|-------------|
| 1 | `~/.claude/settings.json` | statusLine config — **NO CHANGE** |
| 2 | `~/.config/ccstatusline/settings.json` | BMAD widgets — **CHANGE: v2 per-line + v1 upgrade** |
| 3 | `~/.config/bmad-statusline/bmad-sl-reader.js` | Deploy reader — **NO CHANGE** |
| 4 | `~/.cache/bmad-status/` | Create cache dir — **NO CHANGE** |
| 5 | `~/.claude/settings.json` hooks | Hook config — **NO CHANGE** |
| 6 | `~/.config/bmad-statusline/bmad-hook.js` | Deploy hook — **NO CHANGE** |
| **7 (NEW)** | `~/.config/bmad-statusline/config.json` | **Create internal config with defaults** |

### Current uninstall.js Target Structure (7 targets)

| Target | What it does | Change needed |
|--------|-------------|---------------|
| 1 | Skip statusLine preservation | NO CHANGE |
| 2 | Remove ccstatusline BMAD widgets | VERIFY — already handles `bmad-*` and `sep-bmad-*`, covers `bmad-line-*` |
| 3 | Delete `~/.config/bmad-statusline/` | NO CHANGE — directory deletion covers `config.json` |
| 4 | Delete `~/.cache/bmad-status/` | NO CHANGE |
| 5 | Remove hook matchers | NO CHANGE |
| 6 | CLAUDE.md backward compat | NO CHANGE |
| 7 | settings.local.json backward compat | NO CHANGE |

### getWidgetDefinitions — Before vs After

**Current (v1) — `defaults.js:11-32`:**
```js
return [
  { id: 'bmad-compact', type: 'custom-command', commandPath: `node "${readerPath}" compact`, color: 'white', preserveColors: true },
  { id: 'sep-bmad-1', type: 'separator' },
  { id: 'bmad-timer', type: 'custom-command', commandPath: `node "${readerPath}" timer`, color: 'brightBlack', preserveColors: true }
];
```

**Required (v2):**
```js
return [{
  id: 'bmad-line-0',
  type: 'custom-command',
  commandPath: `node "${readerPath}" line 0`,
  preserveColors: true
}];
```

Key differences: 3 widgets -> 1 widget. No `color` property. `commandPath` uses `line 0` command. No separators (reader handles separators internally).

### installTarget2 — Current vs Required Logic

**Current flow (install.js:78-125):**
1. Ensure ccstatusline dir exists
2. Read or create ccstatusline config
3. Check if ANY `bmad-*` widget exists -> skip if yes
4. Inject v1 widgets on line **1** (targetLine = 1)

**Required flow:**
1. Ensure ccstatusline dir exists
2. Read or create ccstatusline config
3. Check for v2 composites (`bmad-line-*`) -> skip if found (idempotent)
4. Check for v1 individual widgets (`bmad-*` excluding `bmad-line-*`) -> if found: remove all old `bmad-*`/`sep-bmad-*`, inject v2 `bmad-line-0` on line 0, log "upgraded"
5. Fresh install (no v1, no v2) -> inject v2 `bmad-line-0` on line **0** (changed from line 1)

### uninstallTarget2 — Already Handles v2

The current `isBmad` filter at `uninstall.js:58`:
```js
const isBmad = (w) => w.id && (w.id.startsWith('bmad-') || w.id.startsWith('sep-bmad-'));
```
This already matches `bmad-line-0`, `bmad-line-1`, `bmad-line-2` since they start with `bmad-`. No functional change needed — just verify and add a comment.

### Internal Config Creation — New Target

Import `createDefaultConfig` from widget-registry.js (already exported from story 6.1). The function returns:
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

The new target checks if `config.json` exists at `path.join(paths.readerDir, 'config.json')`. If not, creates it with `createDefaultConfig()`.

### Test Fixture Changes

**`ccstatusline-settings-with-bmad.json`** — MUST be updated to reflect v2 format. Currently has `bmad-agent` + `sep-bmad-1` + `bmad-compact` (v1 widgets). Change to `bmad-line-0` on line 0:
```json
{
  "version": 3,
  "lines": [
    [{ "id": "bmad-line-0", "type": "custom-command", "commandPath": "node \"/path/to/reader.js\" line 0", "preserveColors": true }],
    [],
    []
  ]
}
```

Note: `ccstatusline-settings-with-bmad-v2.json` already has this exact format — created in story 6.3.

**`ccstatusline-settings-v1.json`** — Already exists with individual `bmad-project`, `bmad-workflow`, etc. Used for v1->v2 upgrade tests.

### Test Pattern Reference

Tests use:
- `setup()` → creates temp dir + paths object via `createPaths(baseDir)`
- `teardown(baseDir)` → removes temp dir
- `captureOutput(fn)` → captures `console.log` calls during fn execution
- `copyFixture(name, dest)` → copies fixture to test temp dir
- All tests are in `describe/it` blocks from `node:test`
- Assertions via `node:assert/strict`

The `paths` object has: `claudeSettings`, `claudeDir`, `ccstatuslineSettings`, `ccstatuslineDir`, `readerDest`, `readerDir`, `hookDest`, `cacheDir`. The internal config path for tests will be `path.join(paths.readerDir, 'config.json')`.

### Dependencies from Stories 6.1-6.3

Already implemented and available:
- `createDefaultConfig()` from `src/tui/widget-registry.js` — returns default v2 internal config object
- `loadConfig(paths)` from `config-loader.js` — handles migration logic (path 2: v1->v2)
- `writeInternalConfig(config, paths)` from `config-writer.js` — pattern 14 writer
- `syncCcstatuslineFromScratch(config, paths)` from `config-writer.js` — full ccstatusline rebuild
- `readCcstatuslineConfig(configPath)` exported from `config-writer.js` — reads ccstatusline config

### Files to Modify

| File | Action | Scope |
|------|--------|-------|
| `src/defaults.js` | MODIFY | `getWidgetDefinitions()` — replace v1 return with v2 single composite |
| `src/install.js` | MODIFY | `installTarget2` rewrite for v2 + v1 upgrade. Add `installTarget7` for internal config |
| `test/defaults.test.js` | MODIFY | Update `getWidgetDefinitions` assertions for v2 format |
| `test/install.test.js` | MODIFY | Update Target 2 tests + add v1 upgrade test + add internal config tests |
| `test/uninstall.test.js` | MODIFY | Add v2 removal test + mixed v1/v2 removal test + config.json deletion test |
| `test/fixtures/ccstatusline-settings-with-bmad.json` | MODIFY | Update to v2 format |

### Files NOT to Touch

- `src/uninstall.js` — already handles v2 widgets correctly via `bmad-*` prefix filter. No code change needed.
- `src/tui/config-loader.js` — migration logic unchanged (6.3).
- `src/tui/config-writer.js` — sync logic unchanged (6.3).
- `src/tui/widget-registry.js` — `createDefaultConfig` unchanged (6.1).
- All TUI screen files, component files, reader, hook — untouched.
- `src/tui/preview-utils.js` — unchanged.

### Constraints

1. **Line 0 injection** — v2 fresh install injects on ccstatusline line 0 (not line 1 as v1 did). Line 0 is the top status bar line.
2. **No `color` property** — v2 composite uses `preserveColors: true`, ANSI colors come from the reader.
3. **Internal config = pattern 14** — no backup, no validate. ccstatusline config = pattern 4 — backup + validate.
4. **Idempotent** — running install twice must not duplicate widgets or overwrite internal config.
5. **v1 upgrade is automatic** — detect old widgets, replace, create internal config if missing.
6. **uninstall.js has no code changes** — the existing `isBmad` filter already covers `bmad-line-*`. Only tests need additions for coverage.
7. **import path for createDefaultConfig** — installer is ESM at `src/install.js`, widget-registry is ESM at `src/tui/widget-registry.js`. Import: `import { createDefaultConfig } from './tui/widget-registry.js';`

### Previous Story Intelligence (6.4)

Key learnings from 6.4 implementation:
- 325 tests passing at end of 6.4.
- v2 state model fully operational: `config` + `snapshot` + `updateConfig(mutator)` + `resetToOriginal()`.
- `syncCcstatuslineIfNeeded` and `syncCcstatuslineFromScratch` called from TUI without issues — confirms these functions work correctly with v2 config.
- ThreeLinePreview, EditLineScreen, HomeScreen all working with v2 internal config.
- `structuredClone()` confirmed working throughout.
- Commit format: `6-6-installer-uninstaller-per-line-deployment-config-creation-upgrade-v1-v2: <description>`.

### Git Patterns from Recent Commits

- Commit format: `{story-key}: <description>`
- Code review fix format: `fix({story-key}): <description>`
- Recent: `6654b81 6-4-tui-v2-core-app-shell-state-model-shared-components-home-edit-line: TUI v2 core — app shell, state model, shared components, Home + Edit Line`

### Project Structure Notes

- Source files: `bmad-statusline/src/` (ESM modules)
- TUI files: `bmad-statusline/src/tui/` (Ink/React, ESM)
- Tests: `bmad-statusline/test/*.test.js`
- Fixtures: `bmad-statusline/test/fixtures/*.json`
- Current test count: 325 tests, 0 failures
- npm test command: `node --test test/*.test.js`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.6] — BDD acceptance criteria and user story
- [Source: _bmad-output/planning-artifacts/architecture.md#Installer Per-Line Deployment] — getWidgetDefinitions v2 format, install sequence, upgrade path
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern 4] — Config JSON Mutation Sequence (ccstatusline only)
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern 5] — Path Resolution
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern 6] — Console Output Format (logSuccess/logSkipped/logError)
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern 14] — Internal Config I/O (no backup, no validate)
- [Source: _bmad-output/planning-artifacts/architecture.md#Dead Code Removal] — bmad-compact replaced by bmad-line-0
- [Source: _bmad-output/planning-artifacts/epics.md#FR-V2-20-22,30-31] — Functional requirements for installer/uninstaller
- [Source: _bmad-output/planning-artifacts/epics.md#NFR-V2-10] — Zero external runtime deps for installer
- [Source: _bmad-output/project-context.md#Pattern 1-6] — Error handling, sync I/O, ANSI, config mutation, paths, console format
- [Source: _bmad-output/implementation-artifacts/6-4-tui-v2-core-app-shell-state-model-shared-components-home-edit-line.md] — Previous story learnings, test count baseline

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Syntax error in uninstall.test.js: new tests were added after the closing `});` of the describe block instead of inside it. Fixed by moving tests inside the block.

### Completion Notes List

- Task 1: Replaced `getWidgetDefinitions()` return value from 3 v1 widgets (`bmad-compact`, `sep-bmad-1`, `bmad-timer`) to single v2 composite (`bmad-line-0`). No `color` property. Verified no other files reference old widget IDs.
- Task 2: Added `installTarget7(paths)` for internal config creation using `createDefaultConfig()` from widget-registry.js. Pattern 14 (no backup, no validate). Idempotent — skips if config.json already exists.
- Task 3: Rewrote `installTarget2` with 3-way detection: v2 present (skip), v1 present (upgrade — remove old widgets, inject bmad-line-0 on line 0), fresh (inject bmad-line-0 on line 0). Changed target line from 1 to 0.
- Task 4: Verified `uninstallTarget2` isBmad filter already handles bmad-line-* via `bmad-` prefix. Added clarity comment. Verified config.json deletion covered by directory deletion in target 3.
- Task 5: Updated `ccstatusline-settings-with-bmad.json` fixture to v2 format (bmad-line-0 on line 0). Verified v1 fixture exists for upgrade tests.
- Task 6: Updated defaults.test.js to assert single bmad-line-0 widget, no color property, preserveColors true.
- Task 7: Rewrote install Target 2 tests for v2 format. Added v1->v2 upgrade test. Added Target 7 internal config tests (creation + idempotency). Updated user widget preservation test for line 0 injection.
- Task 8: Added 3 uninstall tests: v2 bmad-line-* removal, mixed v1+v2 removal, config.json deletion via directory deletion.
- Task 9: Full test suite passes — 332 tests, 0 failures (up from 325).

### Change Log

- 2026-04-01: Implemented story 6.6 — installer v2 per-line deployment, internal config creation, v1->v2 upgrade path, uninstall verification, 7 new tests added (325->332)

### Review Findings

- [x] [Review][Dismiss] V1 upgrade injecte sur line 0 — cohérent avec v2 design (TUI permet config par ligne). AC#3 wording imprécis, Task 3.2 fait foi. [install.js:116-119]
- [x] [Review][Patch] Dead code `while (config.lines.length < 1)` — guard impossible à déclencher, v1 path garantit que config.lines a au moins 1 élément [install.js:118] — FIXED
- [x] [Review][Patch] Message skip hardcodé `bmad-line-0 already present` mais la détection matche tout `bmad-line-*` — trompeur si seul bmad-line-1 existe [install.js:98] — FIXED
- [x] [Review][Defer] Séparateurs `sep-bmad-*` orphelins non détectés par fresh install path — pré-existant, ni ancien ni nouveau code ne les détecte [install.js:110]
- [x] [Review][Defer] Pas de test pour v1 upgrade préservant user widgets sur la même ligne — dépend de la résolution du finding #1
- [x] [Review][Defer] Pas de test pour échec validation `writeJsonSafe` + restore `.bak` — pré-existant, non introduit par ce changement

### File List

- `src/defaults.js` — MODIFIED: getWidgetDefinitions returns single bmad-line-0 v2 composite
- `src/install.js` — MODIFIED: installTarget2 rewritten for v2 per-line + v1 upgrade; installTarget7 added for internal config creation
- `src/uninstall.js` — MODIFIED: added clarity comment on isBmad filter (no functional change)
- `test/defaults.test.js` — MODIFIED: updated getWidgetDefinitions test for v2 format
- `test/install.test.js` — MODIFIED: updated Target 2 tests for v2, added v1 upgrade test, added Target 7 internal config tests
- `test/uninstall.test.js` — MODIFIED: added v2 removal, mixed v1+v2 removal, config.json deletion tests
- `test/fixtures/ccstatusline-settings-with-bmad.json` — MODIFIED: updated to v2 format (bmad-line-0 on line 0)
