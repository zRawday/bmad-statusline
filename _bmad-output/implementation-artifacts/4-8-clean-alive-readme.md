# Story 4.8: Clean — alive-based cleanup + README update

Status: done

## Story

As a **developer managing bmad-statusline cache**,
I want **`npx bmad-statusline clean` to use alive-based expiry instead of deleting all files, and the README to document the current 5-signal hook architecture**,
So that **active sessions are preserved during cleanup and new users understand the full system capabilities**.

## Acceptance Criteria

1. **Expired pair deletion:** Given a `status-{sid}.json` and `.alive-{sid}` pair where the alive file mtime exceeds `ALIVE_MAX_AGE_MS` (7 days), clean deletes both files and reports them as purged.
2. **Orphaned status deletion:** Given a `status-{sid}.json` with no corresponding `.alive-{sid}` file, clean deletes the status file (session never resumed or alive was already cleaned).
3. **Orphaned alive deletion:** Given an `.alive-{sid}` with no corresponding `status-{sid}.json`, clean deletes the alive file.
4. **Active pair preserved:** Given a `status-{sid}.json` and `.alive-{sid}` pair where the alive file mtime is within `ALIVE_MAX_AGE_MS`, clean leaves both files untouched.
5. **Empty cache directory:** Given a cache directory with no status or alive files (only non-matching files or truly empty), clean reports `already clean`.
6. **Non-existent cache:** Given no cache directory, clean reports `directory not found`.
7. **Mixed state cleanup:** Given a cache with a mix of expired pairs, orphaned status, orphaned alive, and active pairs, clean deletes only eligible files and preserves active pairs. Reports count of deleted files.
8. **Non-matching file preservation:** Given non-matching files in the cache directory (e.g., `readme.txt`), they are never touched.
9. **README 5-signal architecture:** README.md documents: 5-signal hook (UserPromptSubmit, Read, Write, Edit, SessionStart), multi-module support (bmad/gds/wds), story intelligence (3-level priority), 5-matcher config across 3 event types, alive-based expiry with 7-day retention.
10. **Tests updated:** `test/clean.test.js` covers: expired pair, orphaned status, orphaned alive, active pair preserved, mixed state, empty directory, non-existent directory, non-matching file preservation.

## Tasks / Subtasks

- [x] Task 1: Rewrite `src/clean.js` with alive-based expiry logic (AC: #1-#8)
  - [x] 1.1 Define `ALIVE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000` constant
  - [x] 1.2 Scan cache dir, build maps: `statusFiles` (sid -> entry), `aliveFiles` (sid -> entry)
  - [x] 1.3 Process expired pairs: alive exists AND `Date.now() - fs.statSync(alivePath).mtimeMs > ALIVE_MAX_AGE_MS` -> delete both
  - [x] 1.4 Process orphaned status: status exists with no corresponding alive -> delete status
  - [x] 1.5 Process orphaned alive: alive exists with no corresponding status -> delete alive
  - [x] 1.6 Active pairs: alive exists AND mtime within threshold -> skip both
  - [x] 1.7 Report count of deleted files or `already clean`
- [x] Task 2: Rewrite `test/clean.test.js` for alive-based scenarios (AC: #10)
  - [x] 2.1 Test expired pair deletion (set mtime to past via `fs.utimesSync`)
  - [x] 2.2 Test orphaned status deletion (no alive file)
  - [x] 2.3 Test orphaned alive deletion (no status file)
  - [x] 2.4 Test active pair preservation (recent alive mtime)
  - [x] 2.5 Test mixed state (all 4 categories in one directory)
  - [x] 2.6 Test empty cache directory
  - [x] 2.7 Test non-existent cache directory
  - [x] 2.8 Test non-matching file preservation
- [x] Task 3: Update `README.md` with 5-signal architecture documentation (AC: #9)
  - [x] 3.1 Replace 2-signal "How It Works" with 5-signal architecture description
  - [x] 3.2 Document multi-module support (bmad/gds/wds)
  - [x] 3.3 Document story intelligence (3-level priority)
  - [x] 3.4 Document alive-based session tracking and 7-day retention
  - [x] 3.5 Update installation section to reflect 3 event types
  - [x] 3.6 Update architecture diagram

## Dev Notes

### Scope

Two files change functionally (`clean.js`, `clean.test.js`), one is documentation-only (`README.md`). The clean command shifts from "delete everything" to "intelligent alive-based expiry."

### Error Handling: VERBOSE (Installer)

`clean.js` uses the verbose philosophy from the Error Handling Triad. Log every action with `logSuccess`/`logSkipped`/`logError`. This is the **opposite** of hook and reader which are silent always.

### ALIVE_MAX_AGE_MS — Two Different Constants, Two Purposes

| Location | Value | Purpose |
|----------|-------|---------|
| `src/hook/bmad-hook.js:17` | `7 * 24 * 60 * 60 * 1000` (7 days) | Session expiry threshold for clean command |
| `src/reader/bmad-sl-reader.js:9` | `5 * 60 * 1000` (5 minutes) | Reader staleness for health indicator dimming |

**For `clean.js`: Use the 7-day value.** Define it locally in clean.js — same constant value as hook but independent (clean is an installer-family module, not part of the hook runtime).

```js
const ALIVE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
```

### Session ID Extraction from Filenames

Status files follow pattern `status-{sid}.json`, alive files follow `.alive-{sid}`. Extract session IDs to build correlation maps:

```js
// status-abc123.json -> sid "abc123"
const statusMatch = name.match(/^status-(.+)\.json$/);
// .alive-abc123 -> sid "abc123"
const aliveMatch = name.match(/^\.alive-(.+)$/);
```

### Alive mtime Check Pattern

Architecture prescribes `fs.statSync(alivePath).mtimeMs`:

```js
const aliveStat = fs.statSync(alivePath);
const isExpired = (Date.now() - aliveStat.mtimeMs) > ALIVE_MAX_AGE_MS;
```

### Deletion Decision Matrix

| Status exists | Alive exists | Alive expired | Action |
|:---:|:---:|:---:|---|
| Yes | Yes | Yes | Delete both (expired session) |
| Yes | Yes | No | **Preserve both** (active session) |
| Yes | No | n/a | Delete status (orphaned — no alive) |
| No | Yes | n/a | Delete alive (orphaned — no status) |

### Setting File mtime in Tests

Use `fs.utimesSync` to set file modification time to the past for expired alive tests:

```js
const pastMs = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days ago
const pastSec = pastMs / 1000;
fs.utimesSync(alivePath, pastSec, pastSec);
```

### Current clean.js — What Changes

The current implementation at `bmad-statusline/src/clean.js` (43 lines) deletes ALL `status-*.json` and `.alive-*` files unconditionally. The rewrite replaces the bulk-delete loop with the session-correlation logic described above. The module signature (`export default function clean(paths)`) and logging helpers (`logSuccess`/`logSkipped`/`logError`) stay the same.

### Current clean.test.js — What Changes

All 8 existing tests must be rewritten. The current tests assume unconditional deletion. New tests must use `fs.utimesSync` to control alive file mtime and verify selective deletion based on the decision matrix.

### README.md — What Changes

The current README describes a 2-signal architecture (Skill + Read PostToolUse events). Replace with:

- **5-signal hook** covering UserPromptSubmit, Read, Write, Edit, SessionStart
- **Multi-module support** for `bmad-*`, `gds-*`, `wds-*` skill families
- **Story intelligence** with 3-level priority system (SPRINT_STATUS > STORY_FILE > CANDIDATE)
- **5-matcher config** across 3 event types (UserPromptSubmit: 1, PostToolUse: 3, SessionStart: 1)
- **Alive-based session tracking** with 7-day retention and `clean` command expiry behavior
- Update installation section: hook config now spans 3 event type keys
- Update architecture diagram to show 5 signals and alive mechanism

### Files To Modify

| File | Action |
|------|--------|
| `bmad-statusline/src/clean.js` | Rewrite — alive-based expiry with session correlation |
| `bmad-statusline/test/clean.test.js` | Rewrite — new test suite for alive-based scenarios |
| `bmad-statusline/README.md` | Rewrite — document 5-signal hook architecture |

### What This Story Does NOT Do

- Does NOT modify `src/hook/bmad-hook.js` — stories 4.2-4.5
- Does NOT modify `src/reader/bmad-sl-reader.js` — reader's 5-minute purgeStale is independent
- Does NOT modify `src/install.js` — story 4.6
- Does NOT modify `src/uninstall.js` — story 4.7
- Does NOT modify `src/defaults.js` — story 4.6
- Does NOT modify TUI code
- Does NOT add new CLI commands or flags

### Synchronous File I/O

All file operations MUST use `fs.readFileSync` / `fs.writeFileSync` / `fs.statSync` / `fs.unlinkSync` / `fs.readdirSync`. Never async. Correctness guarantee.

### Test Patterns

Tests use `node:test` + `node:assert/strict`. Temp dirs via `fs.mkdtempSync`, output capture via `captureOutput()` helper (same pattern as existing clean.test.js). Paths injection via `{ cacheDir, homeDir }` parameter.

### Project Structure Notes

- `bmad-statusline/src/clean.js` — ESM module, exports a single default function. Receives `paths` parameter for testability.
- `bmad-statusline/test/clean.test.js` — ESM, `node:test` + `node:assert/strict`, temp dir pattern, output capture.
- `bmad-statusline/README.md` — Project documentation. Markdown only.
- Run tests: `npm test` (runs `node --test test/*.test.js`, currently 230 tests passing)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md — Session Resume & Alive Tracking, Clean Command, ALIVE_MAX_AGE_MS constant, Project Directory Structure]
- [Source: _bmad-output/planning-artifacts/epics.md — Story 4.8 acceptance criteria]
- [Source: _bmad-output/project-context.md — Error Handling Triad, Synchronous I/O, Hook Architecture]
- [Source: _bmad-output/implementation-artifacts/4-7-uninstaller-3-generation-backward-compat.md — Previous story: test patterns, file modification patterns]
- [Source: bmad-statusline/src/clean.js — Current unconditional bulk-delete implementation]
- [Source: bmad-statusline/test/clean.test.js — Current 8 tests (all to be rewritten)]
- [Source: bmad-statusline/src/hook/bmad-hook.js:17 — ALIVE_MAX_AGE_MS = 7 days constant, touchAlive() function at line 341]
- [Source: bmad-statusline/src/reader/bmad-sl-reader.js:9 — ALIVE_MAX_AGE_MS = 5 minutes (reader purge, different purpose)]
- [Source: bmad-statusline/README.md — Current 2-signal architecture docs to be replaced]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Task 1: Rewrote `clean.js` from unconditional bulk-delete to alive-based session-correlation expiry. Builds sid maps from `status-{sid}.json` and `.alive-{sid}` filenames, checks alive mtime against 7-day `ALIVE_MAX_AGE_MS`, applies decision matrix (expired pair → delete both, orphaned → delete, active → preserve). Reports purge count or `already clean`.
- Task 2: Rewrote all 8 tests for alive-based scenarios. Uses `fs.utimesSync` to control alive mtime for expired pair tests. Covers: expired pair deletion, orphaned status, orphaned alive, active pair preservation, mixed state (all 4 categories), empty dir, non-existent dir, non-matching file preservation.
- Task 3: Replaced 2-signal README with comprehensive 5-signal architecture documentation. Covers: 5-signal table (UserPromptSubmit/Read/Write/Edit/SessionStart), multi-module support (bmad/gds/wds), story intelligence 3-level priority, alive-based session tracking with 7-day retention, updated installation section with 5-matcher/3-event-type config, updated architecture diagram showing all 5 signals and alive mechanism.

### Change Log

- 2026-03-30: Implemented story 4-8 — alive-based clean + 5-signal README

### Review Findings

- [x] [Review][Decision] "already clean" message ambigu quand seules des sessions actives existent — dismissed, comportement conservé par choix utilisateur
- [x] [Review][Patch] `fs.statSync` non protégé — TOCTOU crash si alive file supprimé entre readdirSync et statSync [clean.js:63] — fixed, try/catch ajouté
- [x] [Review][Defer] Pas de test pour la race condition statSync — difficile à tester sans mock FS [clean.test.js]
- [x] [Review][Defer] Pas de test à la frontière exacte de 7 jours (strict `>` vs `>=`) [clean.test.js]
- [x] [Review][Defer] `displayDir` replace peut échouer sur Windows avec slash mixtes — cosmétique [clean.js:19]
- [x] [Review][Defer] Relation complémentaire reader (5 min purgeStale) vs clean (7 jours) non documentée dans README [README.md]
- [x] [Review][Defer] Log résumé unique au lieu de log verbose par fichier — AC satisfait, dev notes mentionnent verbose philosophy [clean.js:102]

### File List

- bmad-statusline/src/clean.js (modified — alive-based expiry rewrite)
- bmad-statusline/test/clean.test.js (modified — 8 tests rewritten for alive-based scenarios)
- bmad-statusline/README.md (modified — 5-signal architecture documentation)
