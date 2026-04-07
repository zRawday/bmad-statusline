# Story 1.4: Uninstall Command

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer who wants to remove BMAD statusline**,
I want **to run `npx bmad-statusline uninstall` and have all BMAD artifacts cleanly removed**,
So that **my system is restored to its pre-install state without leftover config or files**.

## Acceptance Criteria

1. **Target 1 — `~/.claude/settings.json` (statusLine config):**
   - **Given** `~/.claude/settings.json` contains a `statusLine` key **When** uninstall runs **Then** it does **NOT** remove the statusLine config (ccstatusline is independent, user may want to keep it) **And** it logs `○ ~/.claude/settings.json — statusLine preserved (ccstatusline independent)`

2. **Target 2 — `~/.config/ccstatusline/settings.json` (BMAD widgets):**
   - **Given** ccstatusline config contains widgets with `id` matching `bmad-*` or `sep-bmad-*` **When** uninstall runs **Then** it removes only BMAD widgets (including separators), preserving all other user widgets **And** creates a `.bak` backup before writing **And** validates post-write by rereading and parsing
   - **Given** ccstatusline config contains no `bmad-*` or `sep-bmad-*` widgets **When** uninstall runs **Then** it skips and logs `○ skipped`
   - **Given** `~/.config/ccstatusline/settings.json` does not exist **When** uninstall runs **Then** it skips and logs `○ skipped`

3. **Target 3 — `~/.config/bmad-statusline/` (reader directory):**
   - **Given** the directory `~/.config/bmad-statusline/` exists **When** uninstall runs **Then** it deletes the entire directory and logs `✓`
   - **Given** the directory does not exist **When** uninstall runs **Then** it skips and logs `○ skipped`

4. **Target 4 — `~/.cache/bmad-status/` (cache directory):**
   - **Given** the directory `~/.cache/bmad-status/` exists **When** uninstall runs **Then** it deletes the entire directory and logs `✓`
   - **Given** the directory does not exist **When** uninstall runs **Then** it skips and logs `○ skipped`

5. **Target 5 — `.claude/CLAUDE.md` (per-project instruction block):**
   - **Given** `.claude/CLAUDE.md` contains `<!-- bmad-statusline:start -->` and `<!-- bmad-statusline:end -->` markers **When** uninstall runs **Then** it removes everything between markers (inclusive) and logs `✓` **And** all content before the start marker is preserved intact **And** all content after the end marker is preserved intact
   - **Given** `.claude/CLAUDE.md` does not contain markers **When** uninstall runs **Then** it skips and logs `○ skipped`
   - **Given** `.claude/CLAUDE.md` does not exist **When** uninstall runs **Then** it skips and logs `○ skipped`

6. **Idempotency:**
   - **Given** uninstall has already been run **When** uninstall is run a second time **Then** all targets show `○ skipped`, exit 0

7. **Path injection & console output:**
   - **Given** the `uninstall()` function signature **When** called **Then** it accepts a `paths` parameter for testability **And** uses `logSuccess`/`logSkipped`/`logError` for all output

## Tasks / Subtasks

- [x] Task 1: Implement `src/uninstall.js` core infrastructure (AC: #7)
  - [x] 1.1 Replace stub with full module: imports (`fs`, `os`, `path`), default paths object, `logSuccess`/`logSkipped`/`logError` helpers
  - [x] 1.2 Define `defaultPaths` object with all paths needed by 5 targets (see Dev Notes for exact structure)
  - [x] 1.3 Export `uninstall(paths = defaultPaths)` — same signature pattern as install.js and clean.js

- [x] Task 2: Implement JSON mutation helpers (AC: #2)
  - [x] 2.1 `readJsonFile(filePath)` — `JSON.parse(fs.readFileSync(filePath, 'utf8'))`
  - [x] 2.2 `backupFile(filePath)` — `fs.copyFileSync(filePath, filePath + '.bak')`
  - [x] 2.3 `writeJsonSafe(filePath, obj)` — stringify(null, 2) + write + reread + parse(validate). On validation failure: restore from `.bak`, logError, return false

- [x] Task 3: Implement Target 1 — statusLine preservation (AC: #1)
  - [x] 3.1 Log `○ ~/.claude/settings.json — statusLine preserved (ccstatusline independent)` unconditionally — NO modification, NO file check needed
  - [x] 3.2 This target always succeeds (no error path)

- [x] Task 4: Implement Target 2 — ccstatusline BMAD widget removal (AC: #2)
  - [x] 4.1 Check if ccstatusline settings file exists — if not, logSkipped and return
  - [x] 4.2 Read and parse the config JSON
  - [x] 4.3 Check if any BMAD widgets exist on any line using predicate: `w.id && (w.id.startsWith('bmad-') || w.id.startsWith('sep-bmad-'))`
  - [x] 4.4 If no BMAD widgets found, logSkipped and return
  - [x] 4.5 Backup the file before modification
  - [x] 4.6 Filter each `config.lines[i]` to remove widgets matching the BMAD predicate, preserving all other widgets
  - [x] 4.7 Write filtered config via `writeJsonSafe`, validate post-write
  - [x] 4.8 On error: restore from `.bak`, logError, return false

- [x] Task 5: Implement Target 3 — reader directory removal (AC: #3)
  - [x] 5.1 Check if `paths.readerDir` exists — if not, logSkipped and return
  - [x] 5.2 Delete entire directory via `fs.rmSync(paths.readerDir, { recursive: true, force: true })`
  - [x] 5.3 logSuccess with deletion confirmation

- [x] Task 6: Implement Target 4 — cache directory removal (AC: #4)
  - [x] 6.1 Check if `paths.cacheDir` exists — if not, logSkipped and return
  - [x] 6.2 Delete entire directory via `fs.rmSync(paths.cacheDir, { recursive: true, force: true })`
  - [x] 6.3 logSuccess with deletion confirmation

- [x] Task 7: Implement Target 5 — CLAUDE.md marker block removal (AC: #5)
  - [x] 7.1 Check if `paths.claudeMd` exists — if not, logSkipped and return
  - [x] 7.2 Read file content as text
  - [x] 7.3 Find `<!-- bmad-statusline:start -->` and `<!-- bmad-statusline:end -->` markers
  - [x] 7.4 If both markers not found (or only one), logSkipped and return
  - [x] 7.5 Remove everything from start marker to end of end marker (inclusive)
  - [x] 7.6 Clean up resulting double blank lines (optional, for tidy output)
  - [x] 7.7 Write modified content back to file
  - [x] 7.8 logSuccess with removal confirmation

- [x] Task 8: Wire up main function with error collection (AC: #6, #7)
  - [x] 8.1 Call all 5 target functions, collect return values
  - [x] 8.2 If any target returned `false`, `process.exit(1)`
  - [x] 8.3 Success path exits 0 (implicit)

- [x] Task 9: Create `test/uninstall.test.js` (AC: #1-#7)
  - [x] 9.1 Test utilities: `captureOutput(fn)`, `createPaths(baseDir)`, `setup()`/`teardown()`, `copyFixture()` — follow same pattern as `test/install.test.js`
  - [x] 9.2 Test Target 1: always logs `○` with preserved message (no file needed)
  - [x] 9.3 Test Target 2: removes BMAD widgets when present (use `ccstatusline-settings-with-bmad.json` fixture), verifies only bmad-*/sep-bmad-* widgets removed
  - [x] 9.4 Test Target 2: skips when no BMAD widgets (use `ccstatusline-settings-empty.json` fixture)
  - [x] 9.5 Test Target 2: skips when config file doesn't exist
  - [x] 9.6 Test Target 2: preserves user widgets on other lines (create fixture with bmad widgets on line 1 + user widgets on line 0)
  - [x] 9.7 Test Target 2: creates `.bak` before modification
  - [x] 9.8 Test Target 3: deletes reader directory when exists
  - [x] 9.9 Test Target 3: skips when directory doesn't exist
  - [x] 9.10 Test Target 4: deletes cache directory when exists
  - [x] 9.11 Test Target 4: skips when directory doesn't exist
  - [x] 9.12 Test Target 5: removes marker block from CLAUDE.md, preserves content before and after (use `claude-md-with-block.md` fixture)
  - [x] 9.13 Test Target 5: skips when no markers (use `claude-md-without-block.md` fixture)
  - [x] 9.14 Test Target 5: skips when file doesn't exist
  - [x] 9.15 Test idempotency: run uninstall twice — second run all `○` skipped
  - [x] 9.16 Test path injection: verify paths parameter used instead of real home

- [x] Task 10: Update CLI test (AC: #7)
  - [x] 10.1 Check `test/cli.test.js` for stale `'Not yet implemented'` assertion on uninstall — update or remove it
  - [x] 10.2 Replace with module load check (same pattern as install) to avoid side effects

- [x] Task 11: Run `npm test` and verify all tests pass
  - [x] 11.1 Run `npm test` from `bmad-statusline/` directory
  - [x] 11.2 Verify all existing tests still pass (zero regressions)
  - [x] 11.3 Verify all new uninstall tests pass

## Dev Notes

### Architecture Compliance — Mandatory Patterns

**Error handling:** This story is entirely in the **installer** boundary → **verbose always**. Log every action with `logSuccess`/`logSkipped`/`logError`. Never fail silently.

**File I/O:** Synchronous only. `fs.readFileSync`, `fs.writeFileSync`, `fs.existsSync`, `fs.rmSync`, `fs.copyFileSync`, `fs.mkdirSync`. Never async, never promises, never callbacks.

**Path construction:** Always `path.join()`. Never string concatenation. All paths flow through the injected `paths` parameter. Resolve `os.homedir()` once in the default paths object at module level.

**JSON mutation (Target 2 only) — exact sequence:**
```
read → parse → backup(.bak) → modify in memory → stringify(null, 2) → write → reread → parse(validate)
```
On validation failure: restore from `.bak`, logError, return false. Wrap in try/catch.

**Console output format:**
```js
function logSuccess(target, message) { console.log(`  ✓ ${target} — ${message}`); }
function logSkipped(target, message) { console.log(`  ○ ${target} — ${message}`); }
function logError(target, message)   { console.log(`  ✗ ${target} — ${message}`); }
```

### CRITICAL: Widget Detection — Must Catch Separators

The install command injects 3 widgets via `getWidgetDefinitions()`:
- `bmad-agent` (id starts with `bmad-`)
- `sep-bmad-1` (id starts with `sep-bmad-`, NOT `bmad-`)
- `bmad-compact` (id starts with `bmad-`)

The install detection only checks `w.id.startsWith('bmad-')` (sufficient for "are BMAD widgets present?"). But for **uninstall removal**, the filter must catch ALL three — including the separator:

```js
const isBmadWidget = (w) => w.id && (w.id.startsWith('bmad-') || w.id.startsWith('sep-bmad-'));
```

If you only filter by `bmad-*`, the separator `sep-bmad-1` will be orphaned in the config.

### CRITICAL: Target 1 — Do NOT Remove statusLine

Per architecture decision, `~/.claude/settings.json`'s `statusLine` key is NOT removed on uninstall. ccstatusline is an independent tool — the user may want to keep it running even without BMAD. Always log the skip message unconditionally. No file read, no file modification.

### Target 2 — ccstatusline Widget Removal Pattern

```js
function uninstallTarget2(paths) {
  const target = '~/.config/ccstatusline/settings.json';
  try {
    if (!fs.existsSync(paths.ccstatuslineSettings)) {
      logSkipped(target, 'file not found');
      return;
    }

    const config = readJsonFile(paths.ccstatuslineSettings);
    if (!Array.isArray(config.lines)) {
      logSkipped(target, 'no lines array found');
      return;
    }

    const isBmad = (w) => w.id && (w.id.startsWith('bmad-') || w.id.startsWith('sep-bmad-'));
    const hasBmad = config.lines.flat().some(isBmad);
    if (!hasBmad) {
      logSkipped(target, 'no BMAD widgets found');
      return;
    }

    backupFile(paths.ccstatuslineSettings);
    config.lines = config.lines.map(line => line.filter(w => !isBmad(w)));
    writeJsonSafe(paths.ccstatuslineSettings, config);
    logSuccess(target, 'BMAD widgets removed');
  } catch (err) {
    try {
      const bakPath = paths.ccstatuslineSettings + '.bak';
      if (fs.existsSync(bakPath)) fs.copyFileSync(bakPath, paths.ccstatuslineSettings);
    } catch {}
    logError(target, err.message);
    return false;
  }
}
```

### Target 5 — CLAUDE.md Marker Removal Pattern

```js
const START_MARKER = '<!-- bmad-statusline:start -->';
const END_MARKER = '<!-- bmad-statusline:end -->';

// Find both markers
const startIdx = content.indexOf(START_MARKER);
const endIdx = content.indexOf(END_MARKER);
if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) {
  logSkipped(target, 'no markers found');
  return;
}

// Remove from start marker to end of end marker (inclusive)
const before = content.substring(0, startIdx);
const after = content.substring(endIdx + END_MARKER.length);
// Trim trailing newline from before and leading newline from after to prevent double blank lines
const result = before.trimEnd() + (after.trim() ? '\n\n' + after.trimStart() : '\n');
```

**Edge case:** If the block is the only content in CLAUDE.md, the result should not be empty whitespace — it should be just `\n` or the remaining content.

### Uninstall Function Signature & Default Paths

```js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const home = os.homedir();
const defaultPaths = {
  claudeSettings: path.join(home, '.claude', 'settings.json'),
  ccstatuslineSettings: path.join(home, '.config', 'ccstatusline', 'settings.json'),
  readerDir: path.join(home, '.config', 'bmad-statusline'),
  cacheDir: path.join(home, '.cache', 'bmad-status'),
  claudeMd: path.join(process.cwd(), '.claude', 'CLAUDE.md'),
  homeDir: home,
};

export default function uninstall(paths = defaultPaths) { ... }
```

Note: Uninstall does NOT need `claudeDir`, `claudeProjects`, `ccstatuslineDir`, `readerDest`, `claudeMdDir`, or `projectDir` — it doesn't create directories or resolve slugs. Keep the paths object lean.

### Existing Test Fixtures to Reuse

All needed fixtures already exist in `test/fixtures/`:

| Fixture | Usage in Uninstall Tests |
|---------|--------------------------|
| `ccstatusline-settings-with-bmad.json` | Target 2: config with BMAD widgets to remove |
| `ccstatusline-settings-empty.json` | Target 2: config without BMAD widgets (skip) |
| `claude-md-with-block.md` | Target 5: CLAUDE.md with markers to remove |
| `claude-md-without-block.md` | Target 5: CLAUDE.md without markers (skip) |

**New fixture needed:** `ccstatusline-settings-mixed.json` — config with BMAD widgets on line 1 AND user widgets on line 0 (to verify user widgets are preserved). Alternatively, create this inline in the test.

### Testing Pattern — Follow install.test.js

```js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import uninstall from '../src/uninstall.js';

function captureOutput(fn) {
  const logs = [];
  const origLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try { fn(); } finally { console.log = origLog; }
  return logs.join('\n');
}

function createPaths(baseDir) {
  return {
    claudeSettings: path.join(baseDir, '.claude', 'settings.json'),
    ccstatuslineSettings: path.join(baseDir, '.config', 'ccstatusline', 'settings.json'),
    readerDir: path.join(baseDir, '.config', 'bmad-statusline'),
    cacheDir: path.join(baseDir, '.cache', 'bmad-status'),
    claudeMd: path.join(baseDir, '.claude', 'CLAUDE.md'),
    homeDir: baseDir,
  };
}

function setup() {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-uninstall-test-'));
  return { baseDir, paths: createPaths(baseDir) };
}

function teardown(baseDir) {
  fs.rmSync(baseDir, { recursive: true, force: true });
}
```

### CLI Test Update

`test/cli.test.js` currently has a test `'runs uninstall stub without error'` that expects the stub output `'Not yet implemented'`. This must be updated:

- Replace with: `'runs uninstall command without error'` — verify uninstall module can be imported without error (same pattern as install test)
- Do NOT run `uninstall()` from CLI test — it would attempt to modify real filesystem

### Previous Story Intelligence

**From Story 1.2 (install — direct dependency):**
- Install uses `readJsonFile`, `backupFile`, `writeJsonSafe` helpers — uninstall must implement equivalent helpers locally (do NOT import from install.js — each command module is self-contained per Boundary 3)
- Widget detection in install: `w.id && w.id.startsWith('bmad-')` — uninstall must use broader predicate to also catch `sep-bmad-*` separators
- Marker logic in install handles orphaned markers — uninstall can simply skip if both markers aren't present
- Error collection pattern: `results.some(r => r === false)` → `process.exit(1)`
- Review found: `process.exit(1)` per-target was problematic — collect errors and exit once at end (already fixed in install, follow same pattern)
- Review found: `config.lines` may not be an array — add `Array.isArray` guard

**From Story 1.5 (clean — completed, sibling pattern):**
- Clean implements `DEFAULT_PATHS` with `homeDir` property — follow same pattern
- Clean respects `BMAD_CACHE_DIR` env var — uninstall's `defaultPaths.cacheDir` should also read from env var for consistency: `cacheDir: process.env.BMAD_CACHE_DIR || path.join(home, '.cache', 'bmad-status')`
- Clean uses `{ withFileTypes: true }` for directory listing — not needed here since uninstall deletes entire directories
- Clean wraps each `unlinkSync` in try/catch — uninstall uses `rmSync({ recursive: true, force: true })` which is already error-tolerant
- Review found: `os.homedir()` should not be called inside function body — resolve at module level in defaultPaths

**From Story 1.3 (reader — no direct dependency):**
- Reader files in `src/reader/` are untouched by uninstall
- No code from reader is imported or reused

**Critical learning from all previous stories:**
- Node.js >=20 required (`node --test` compatibility)
- Test script uses glob: `"test": "node --test test/*.test.js"` — new `test/uninstall.test.js` will be auto-discovered
- Each command module defines its own logging helpers locally (no shared utility extracted yet)
- Each command module is self-contained: own imports, own defaultPaths, own helpers

### Git Intelligence

Recent commit patterns:
```
2483c86 fix(1-2-install-command): code review corrections
3f1d974 1-2-install-command: Install Command
667ea2e fix(1-5-clean-command): code review corrections
03afa90 1-3-reader-color-maps-composite-widgets: Reader Color Maps & Composite Widgets
```

**Patterns:**
- Feature commits: `{story_key}: {Short Description}`
- Fix commits: `fix({story_key}): {description}`
- All stories produce corresponding test files
- Code review produces a separate fix commit

### Project Structure Notes

**Files modified by this story:**
```
bmad-statusline/
  src/
    uninstall.js            # REPLACE: stub → full uninstall logic
  test/
    uninstall.test.js       # NEW: comprehensive uninstall tests
    cli.test.js             # MODIFY: update stale uninstall stub assertion
```

**Files NOT touched:**
- `bin/cli.js` — dispatch already handles `uninstall` command correctly
- `src/install.js` — not modified (patterns replicated locally, not imported)
- `src/defaults.js` — not needed by uninstall (no templates to generate)
- `src/clean.js` — not modified
- `src/reader/bmad-sl-reader.js` — not modified
- `package.json` — no changes needed

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Core Architectural Decisions] — uninstall operations table, config management, statusLine preservation rationale
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules] — 6 mandatory patterns (error duality, sync fs, JSON mutation, path construction, console output)
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries] — Boundary 3 (command modules export single function, receive paths parameter)
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.4] — full acceptance criteria with BDD format
- [Source: _bmad-output/project-context.md#ccstatusline Contract] — widget detection (id field, bmad-* pattern), config v3 format
- [Source: _bmad-output/project-context.md#Critical Implementation Rules] — 7 rules to follow
- [Source: _bmad-output/implementation-artifacts/1-2-install-command.md] — install logic patterns, widget detection, marker handling, review findings
- [Source: _bmad-output/implementation-artifacts/1-5-clean-command.md] — clean command patterns, env var handling, review findings
- [Source: bmad-statusline/src/install.js] — actual detection code (lines 119-125 for widget check, lines 187-211 for marker handling)
- [Source: bmad-statusline/test/fixtures/ccstatusline-settings-with-bmad.json] — fixture with bmad-agent + sep-bmad-1 + bmad-compact widgets

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

No debug issues encountered.

### Completion Notes List

- Replaced `src/uninstall.js` stub with full uninstall implementation (5 targets + error collection)
- Target 1: unconditionally logs statusLine preserved (no file modification per architecture decision)
- Target 2: removes all `bmad-*` and `sep-bmad-*` widgets from ccstatusline config with backup/validate cycle
- Target 3: deletes `~/.config/bmad-statusline/` directory recursively
- Target 4: deletes `~/.cache/bmad-status/` directory recursively (respects `BMAD_CACHE_DIR` env var)
- Target 5: removes `<!-- bmad-statusline:start -->` to `<!-- bmad-statusline:end -->` block from CLAUDE.md
- All targets follow self-contained command module pattern (own helpers, own imports, injected paths)
- JSON mutation follows exact read→parse→backup→modify→stringify→write→reread→validate sequence
- Created comprehensive test suite (16 tests) covering all ACs, idempotency, and path injection
- Updated CLI test to replace stale stub assertion with module load check
- All 95 tests pass (0 failures, 0 regressions)

### Change Log

- 2026-03-28: Implemented uninstall command — full 5-target removal with tests

### File List

- `bmad-statusline/src/uninstall.js` — REPLACED: stub → full uninstall logic (5 targets, JSON helpers, error collection)
- `bmad-statusline/test/uninstall.test.js` — NEW: 16 tests covering all ACs
- `bmad-statusline/test/cli.test.js` — MODIFIED: replaced stale uninstall stub assertion with module load check

### Review Findings

- [x] [Review][Defer] `process.exit(1)` in exported function makes error paths untestable and kills host process [src/uninstall.js:150] — deferred, pre-existing pattern (install.js, clean.js all use same approach per spec)
- [x] [Review][Defer] Backup restore catch block swallows errors silently — rollback failure masked [src/uninstall.js:70-73] — deferred, pre-existing pattern from install.js
- [x] [Review][Defer] `defaultPaths.claudeMd` evaluated at module load via `process.cwd()` — fragile if cwd changes between import and call [src/uninstall.js:11] — deferred, pre-existing pattern (install.js, clean.js)
- [x] [Review][Defer] `defaultPaths.cacheDir` reads `BMAD_CACHE_DIR` env var at module load time [src/uninstall.js:10] — deferred, pre-existing pattern from clean.js
- [x] [Review][Defer] No test for `.bak` restore on `writeJsonSafe` validation failure [test/uninstall.test.js] — deferred, complex to test without mocking infrastructure
