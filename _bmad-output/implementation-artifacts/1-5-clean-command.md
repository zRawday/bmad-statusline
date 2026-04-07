# Story 1.5: Clean Command

Status: done

## Story

As a **developer experiencing stale statusline data**,
I want **to run `npx bmad-statusline clean` to purge the cache manually**,
So that **orphan status files from crashed sessions are removed without waiting for automatic cleanup**.

## Acceptance Criteria

1. **Given** `~/.cache/bmad-status/` contains status and alive files **When** `clean` is run **Then** all `status-*.json` and `.alive-*` files in the directory are deleted **And** the directory itself is preserved (not deleted) **And** logs `✓ ~/.cache/bmad-status/ — N file(s) purged`

2. **Given** `~/.cache/bmad-status/` exists but is empty **When** `clean` is run **Then** it logs `○ ~/.cache/bmad-status/ — already clean`

3. **Given** `~/.cache/bmad-status/` does not exist **When** `clean` is run **Then** it logs `○ ~/.cache/bmad-status/ — directory not found` and exits 0

4. **Given** the `clean()` function signature **When** called **Then** it accepts a `paths` parameter for testability **And** uses `logSuccess`/`logSkipped`/`logError` for all output

## Tasks / Subtasks

- [x] Task 1: Implement `src/clean.js` (AC: #1, #2, #3, #4)
  - [x] 1.1 Replace the current stub in `src/clean.js` with the full implementation
  - [x] 1.2 Export default function `clean(paths)` — accepts injected `paths` parameter, defaults to real paths via `os.homedir()` at the call boundary only
  - [x] 1.3 Define local `logSuccess`, `logSkipped`, `logError` helpers (same fixed format as other installer files)
  - [x] 1.4 Resolve cache directory path from `paths.cacheDir` (default: `path.join(os.homedir(), '.cache', 'bmad-status')`)
  - [x] 1.5 Check if cache directory exists — if not, log `○ skipped` and return
  - [x] 1.6 Read directory contents, filter for files matching `status-*.json` and `.alive-*` patterns
  - [x] 1.7 If no matching files found, log `○ already clean` and return
  - [x] 1.8 Delete each matching file with `fs.unlinkSync`, count successes
  - [x] 1.9 Log `✓` with count of purged files
- [x] Task 2: Update `bin/cli.js` dispatch (AC: #4)
  - [x] 2.1 Verify that `bin/cli.js` already calls `mod.default()` without arguments — clean will use default paths when no argument passed. **No changes expected** — CLI dispatch is already correct from Story 1.1
- [x] Task 3: Create test fixtures (AC: #1, #2, #3)
  - [x] 3.1 No new fixture files needed — tests create temp dirs and populate them programmatically
- [x] Task 4: Create `test/clean.test.js` (AC: #1, #2, #3, #4)
  - [x] 4.1 Test: cache dir with mixed files — creates temp dir with `status-abc.json`, `status-def.json`, `.alive-abc`, `.alive-def`, verifies all 4 deleted, directory preserved, output contains `✓` and `4 file(s) purged`
  - [x] 4.2 Test: cache dir with only status files — verifies only `status-*.json` files deleted
  - [x] 4.3 Test: cache dir with only alive files — verifies only `.alive-*` files deleted
  - [x] 4.4 Test: empty cache dir — verifies `○` output with `already clean`
  - [x] 4.5 Test: non-existent cache dir — verifies `○` output with `directory not found`
  - [x] 4.6 Test: cache dir with non-matching files (e.g., `readme.txt`) — verifies non-matching files are preserved, logs `already clean`
  - [x] 4.7 Test: path injection — verifies `paths` parameter is used instead of real home directory
- [x] Task 5: Run `npm test` and verify all tests pass (AC: all)
  - [x] 5.1 Run `npm test` from `bmad-statusline/` directory
  - [x] 5.2 Verify all existing tests (CLI, defaults) still pass — no regressions
  - [x] 5.3 Verify all new clean tests pass

## Dev Notes

### Architecture Compliance — Critical Rules

**Error handling philosophy:** Clean command is an **installer component** → **verbose always**. Use `logSuccess`/`logSkipped`/`logError` for all output. Never fail silently.

**Sync-only fs:** Use `fs.readFileSync`/`fs.writeFileSync`/`fs.readdirSync`/`fs.unlinkSync`/`fs.existsSync`/`fs.statSync` — never async, never promises, never callbacks.

**Path construction:** Always `path.join()`. The `clean()` function accepts a `paths` parameter for testability. Never call `os.homedir()` directly inside the function body — resolve defaults at the function boundary only:

```js
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const DEFAULT_PATHS = {
  cacheDir: path.join(os.homedir(), '.cache', 'bmad-status')
};

export default function clean(paths = DEFAULT_PATHS) {
  const cacheDir = paths.cacheDir;
  // ...
}
```

**Console output format:**

```js
function logSuccess(target, message) { console.log(`  ✓ ${target} — ${message}`); }
function logSkipped(target, message) { console.log(`  ○ ${target} — ${message}`); }
function logError(target, message)   { console.log(`  ✗ ${target} — ${message}`); }
```

### Implementation Details — What Clean Does

Clean is the simplest of the three commands. It has **one target** (the cache directory) and **one operation** (delete matching files).

**File matching patterns:**
- `status-*.json` — session status files written by BMAD agents (e.g., `status-123abc.json`)
- `.alive-*` — session heartbeat files touched by the reader (e.g., `.alive-456def`)

**What to preserve:**
- The cache directory itself — do NOT delete it (Install creates it, Clean only purges contents)
- Any files not matching the two patterns above (e.g., `readme.txt`, `.env`)

**Exit code:** Clean exits 0 in all scenarios (files purged, already clean, directory not found). Never exit 1 — missing cache is not an error.

**Not Clean's responsibility:** Clean does NOT create the cache directory if missing — that's Install's job (Target 4). If directory doesn't exist, log skip and return.

**No JSON mutation involved:** Clean only deletes files. The config mutation sequence (read → parse → backup → modify → write → reread → validate) does NOT apply here. This is plain file deletion.

**No backup needed:** Deleted cache files are transient data, not user configuration.

### File Pattern Matching

Use string matching, not regex — keep it simple:
- `filename.startsWith('status-') && filename.endsWith('.json')` for status files
- `filename.startsWith('.alive-')` for alive files

### Previous Story Intelligence

**From Story 1.1:**
- `bin/cli.js` already dispatches `clean` command via `await import('../src/clean.js')` then `mod.default()`
- `src/clean.js` currently exports a stub: `export default function clean() { console.log('Not yet implemented'); }`
- Node.js version requirement is `>=20` (bumped from 16 during review for `node --test` compatibility)
- Test script uses glob: `"test": "node --test test/*.test.js"` — new test file `test/clean.test.js` will be auto-discovered
- Tests use `node:test` + `node:assert` built-in modules, zero dev deps
- Each test creates temp dir via `fs.mkdtempSync`, cleans up in `after()` hooks

**Critical finding from Story 1.1 review:**
- `engines` bumped to `>=20` for `node --test` stability
- Test glob form `test/*.test.js` needed instead of `test/` directory form for Node v24 compat

### Dependency Context

Story 1.5 depends only on Story 1.1 (package scaffolding). It does NOT depend on Stories 1.2, 1.3, or 1.4. The clean command operates independently on the cache directory — it doesn't need install detection logic or reader color maps.

Clean is parallelizable with Stories 1.2 and 1.3 (per architecture story slicing guidance).

### Testing Pattern

Tests should follow the same pattern established in Story 1.1:

```js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Import the function directly (ESM)
import clean from '../src/clean.js';

describe('clean command', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-clean-test-'));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ... tests using { cacheDir: tmpDir } as paths parameter
});
```

**Capturing console output:** Use a test helper to intercept `console.log` calls:

```js
function captureOutput(fn) {
  const logs = [];
  const origLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try { fn(); } finally { console.log = origLog; }
  return logs.join('\n');
}
```

### Project Structure Notes

- Only file modified: `bmad-statusline/src/clean.js` (replace stub with implementation)
- New file: `bmad-statusline/test/clean.test.js`
- No new fixtures needed — tests create temp dirs programmatically
- No changes to `bin/cli.js` — dispatch already works
- No changes to `src/defaults.js` — clean doesn't use config templates
- Alignment with architecture: clean.js is Boundary 3 (Command module), exports a single function, receives `paths` parameter

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.5] — acceptance criteria, BDD format
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules] — error handling duality, sync fs, path construction, console output format
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries] — Boundary 3 (Command modules)
- [Source: _bmad-output/planning-artifacts/architecture.md#Core Architectural Decisions] — CLI dispatch pattern
- [Source: _bmad-output/project-context.md#Critical Implementation Rules] — 7 rules to follow
- [Source: _bmad-output/implementation-artifacts/1-1-package-scaffolding-spike-preserve-colors.md] — previous story intelligence, Node >=20, test glob form

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- CLI test `runs clean stub without error` updated to `runs clean command without error` — stub assertion removed since clean is now implemented

### Completion Notes List

- Replaced `src/clean.js` stub with full implementation: `clean(paths)` function with `DEFAULT_PATHS`, `logSuccess`/`logSkipped`/`logError` helpers, cache dir existence check, file pattern matching (`status-*.json`, `.alive-*`), deletion with count reporting
- Verified `bin/cli.js` dispatch already correct — calls `mod.default()` without arguments
- Created `test/clean.test.js` with 7 test cases covering all 3 ACs: mixed files purge, status-only, alive-only, empty dir, non-existent dir, non-matching files preserved, path injection
- Updated `test/cli.test.js` to remove stale stub assertion for clean command
- All 19 tests pass (7 new clean + 12 existing), zero regressions

### Change Log

- 2026-03-28: Implemented clean command — replaced stub, created 7 tests, updated CLI test (all 19 tests pass)

### File List

- `bmad-statusline/src/clean.js` — modified (stub replaced with full implementation)
- `bmad-statusline/test/clean.test.js` — new (7 test cases)
- `bmad-statusline/test/cli.test.js` — modified (updated clean stub test assertion)

### Review Findings

- [x] [Review][Decision→Patch] F1: `os.homedir()` called inside function body (line 15) — violates architectural constraint. **Resolved:** Added `homeDir` to DEFAULT_PATHS, used at function boundary. Technical decision: strict compliance maintained.
- [x] [Review][Decision→Patch] F2: `BMAD_CACHE_DIR` env var respected by reader but not by clean. **Resolved:** DEFAULT_PATHS now reads `process.env.BMAD_CACHE_DIR || default`. Technical decision: component consistency with reader.
- [x] [Review][Patch] F3: No try/catch on `unlinkSync`. **Fixed:** Each unlink wrapped in try/catch, failures logged via `logError`, partial purge reports actual deleted count.
- [x] [Review][Patch] F4: `readdirSync` may return directory entries. **Fixed:** Using `{ withFileTypes: true }` and `e.isFile()` filter. New test added for subdirectory edge case.
