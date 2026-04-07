# Story 3.5: Uninstall pivot — hook removal + backward compat

Status: done

## Story

As a **developer removing BMAD statusline**,
I want **`npx bmad-statusline uninstall` to remove hook config and hook script, plus clean up old CLAUDE.md markers and permission rules from previous installs**,
So that **my system is fully clean regardless of which version was installed**.

## Acceptance Criteria

1. **Given** `~/.claude/settings.json` contains PostToolUse entries with command matching `bmad-hook.js` **When** uninstall runs **Then** it removes only the matching entries from `hooks.PostToolUse`, preserving all other hooks. Creates `.bak` backup before writing. Validates post-write by rereading and parsing.

2. **Given** `~/.claude/settings.json` has no bmad-hook entries **When** uninstall runs **Then** it skips and logs `○ skipped`.

3. **Given** `~/.config/bmad-statusline/bmad-hook.js` exists **When** uninstall runs **Then** it is deleted by Target 3 (entire `~/.config/bmad-statusline/` directory deleted — unchanged behavior).

4. **Given** `.claude/CLAUDE.md` contains `<!-- bmad-statusline:start -->` markers from a previous install **When** uninstall runs **Then** it removes the markers and content between them, logs `✓`.

5. **Given** `.claude/CLAUDE.md` has no markers **When** uninstall runs **Then** it skips and logs `○ skipped`.

6. **Given** `.claude/settings.local.json` contains rules matching `BMAD_PROJ_DIR` **When** uninstall runs **Then** it removes the matching rules, logs `✓`.

7. **Given** `~/.claude/settings.json` has hook entries AND `.claude/CLAUDE.md` has old markers from a previous version **When** uninstall runs **Then** both are cleaned in a single pass — hook entries removed AND old markers removed.

8. **Given** uninstall has already been run **When** uninstall is run a second time **Then** all targets show `○ skipped`, exit 0.

9. **Given** `test/uninstall.test.js` **When** updated **Then** it tests hook config removal, backward compat for old markers and permission rules, and idempotency.

## Tasks / Subtasks

- [x] Task 1: Add `settingsLocal` to `defaultPaths` in uninstall.js (AC: #6)
  - [x] Add `settingsLocal: path.join(process.cwd(), '.claude', 'settings.local.json')` to defaultPaths

- [x] Task 2: Rename existing `uninstallTarget5` to `uninstallTarget6` — CLAUDE.md backward compat (AC: #4, #5)
  - [x] Rename function only — zero logic changes, identical code
  - [x] Update target label comment to mention "backward compat"

- [x] Task 3: Implement new `uninstallTarget5(paths)` — hook config removal from settings.json (AC: #1, #2)
  - [x] Target label: `~/.claude/settings.json hooks`
  - [x] Read `paths.claudeSettings` if it exists
  - [x] Follow config JSON mutation sequence: read → parse → backup → modify → write → reread → validate
  - [x] Check `hooks.PostToolUse` array for entries where any sub-hook command includes `bmad-hook.js`
  - [x] If no matching entries found: `logSkipped` and return
  - [x] Filter out matching entries, preserve non-bmad hooks
  - [x] If `hooks.PostToolUse` is empty after filtering: delete the entire `PostToolUse` key
  - [x] If `hooks` object is empty after that: delete the entire `hooks` key
  - [x] `backupFile` before write, `writeJsonSafe` to write+validate
  - [x] `logSuccess` on completion
  - [x] Wrap in try/catch, restore from `.bak` on error, `logError`, return false

- [x] Task 4: Implement `uninstallTarget7(paths)` — settings.local.json backward compat (AC: #6)
  - [x] Target label: `.claude/settings.local.json`
  - [x] Check if `paths.settingsLocal` exists — skip if absent
  - [x] Read and parse the JSON file
  - [x] Check `permissions.allow` array for rules containing `BMAD_PROJ_DIR`
  - [x] If no matching rules: `logSkipped` and return
  - [x] Filter out matching rules from `permissions.allow`
  - [x] If `permissions.allow` is empty after filtering: delete `allow` key
  - [x] If `permissions` is empty after that: delete `permissions` key
  - [x] If entire object is empty: delete the file, `logSuccess`, return
  - [x] Otherwise: write back with `writeJsonSafe`
  - [x] `logSuccess` on completion
  - [x] Wrap in try/catch, `logError`, return false

- [x] Task 5: Wire all targets into `uninstall()` main function (AC: #7, #8)
  - [x] Update results array: targets 1, 2, 3, 4, 5 (hook config), 6 (CLAUDE.md), 7 (settings.local.json)
  - [x] Order: existing 1-4 unchanged, new 5 (hook config), old 5→6 (CLAUDE.md), new 7 (settings.local.json)

- [x] Task 6: Update `test/uninstall.test.js` (AC: #9)
  - [x] Add `settingsLocal` to `createPaths` helper: `path.join(baseDir, 'project', '.claude', 'settings.local.json')`
  - [x] Add `describe('Target 5: hook config removal')` test group:
    - [x] Test: removes bmad-hook PostToolUse entries when present (use fixture `claude-settings-with-hooks.json`)
    - [x] Test: preserves non-bmad hooks in PostToolUse
    - [x] Test: skips when no hook entries present (use fixture `claude-settings-with-statusline.json`)
    - [x] Test: skips when settings.json does not exist
    - [x] Test: creates `.bak` before modification
    - [x] Test: cleans up empty hooks/PostToolUse keys after removal
  - [x] Rename existing "Target 5" test describe to "Target 6: CLAUDE.md marker removal (backward compat)"
  - [x] Add `describe('Target 7: settings.local.json backward compat')` test group:
    - [x] Test: removes BMAD_PROJ_DIR rules when present (use new fixture)
    - [x] Test: skips when no matching rules
    - [x] Test: skips when file does not exist
    - [x] Test: deletes file when empty after rule removal
  - [x] Update idempotency test: add hook config + settings.local.json to setup, verify all 7 targets skipped on second run
  - [x] Update path injection test if needed

- [x] Task 7: Create test fixture `settings-local-with-bmad.json` in `test/fixtures/`
  - [x] Content: `{ "permissions": { "allow": ["Bash(BMAD_PROJ_DIR=*)"] } }`

- [x] Task 8: Run tests — `node --test test/uninstall.test.js` must pass

## Dev Notes

### Files to Modify (2 files + 1 new fixture)

| File | Action |
|------|--------|
| `bmad-statusline/src/uninstall.js` | Add settingsLocal path, add target 5 (hook config), rename old 5→6, add target 7 (settings.local.json), wire into main |
| `bmad-statusline/test/uninstall.test.js` | Add settingsLocal to paths, add test groups for targets 5+7, rename target 5→6 tests, update idempotency |
| `bmad-statusline/test/fixtures/settings-local-with-bmad.json` | NEW — fixture for backward compat test |

### Current Uninstall.js Structure (154 lines)

Clean pattern: `uninstallTarget1` through `uninstallTarget5`, each following the same structure:
- Target label string
- Try/catch wrapper
- `logSuccess`/`logSkipped`/`logError` per outcome
- Return `false` on error (checked by main)
- Existing JSON helpers: `readJsonFile`, `backupFile`, `writeJsonSafe` — reuse for new targets

### Target 5 Implementation — Hook Config Removal (reverse of install Target 5)

```js
function uninstallTarget5(paths) {
  const target = '~/.claude/settings.json hooks';
  try {
    if (!fs.existsSync(paths.claudeSettings)) {
      logSkipped(target, 'file not found');
      return;
    }

    const config = readJsonFile(paths.claudeSettings);

    // Check for bmad-hook entries
    const postToolUse = config.hooks && config.hooks.PostToolUse;
    if (!Array.isArray(postToolUse)) {
      logSkipped(target, 'no hook config found');
      return;
    }

    const isBmadHook = (entry) =>
      Array.isArray(entry.hooks) && entry.hooks.some(h => h.command && h.command.includes('bmad-hook.js'));

    if (!postToolUse.some(isBmadHook)) {
      logSkipped(target, 'no bmad-hook entries found');
      return;
    }

    backupFile(paths.claudeSettings);

    config.hooks.PostToolUse = postToolUse.filter(entry => !isBmadHook(entry));

    // Clean up empty structures
    if (config.hooks.PostToolUse.length === 0) delete config.hooks.PostToolUse;
    if (Object.keys(config.hooks).length === 0) delete config.hooks;

    writeJsonSafe(paths.claudeSettings, config);
    logSuccess(target, 'hook config removed');
  } catch (err) {
    try {
      const bakPath = paths.claudeSettings + '.bak';
      if (fs.existsSync(bakPath)) fs.copyFileSync(bakPath, paths.claudeSettings);
    } catch {}
    logError(target, err.message);
    return false;
  }
}
```

**Critical detail:** `paths.claudeSettings` is `~/.claude/settings.json` (GLOBAL, not project-level). This is the same file that Target 1 skips for statusLine. Target 5 modifies only the `hooks` key.

**Idempotency detection:** Same pattern as install — scan `hooks.PostToolUse` for entries with command containing `bmad-hook.js`. The `isBmadHook` filter is identical logic to install's check.

**Cleanup of empty structures:** After filtering, if `PostToolUse` array is empty, delete the key. If `hooks` object is then empty, delete it too. This leaves `settings.json` clean.

### Target 6 — CLAUDE.md Backward Compat (unchanged logic, renumbered from 5)

Identical code to current `uninstallTarget5`. Only rename the function to `uninstallTarget6`. This handles removing `<!-- bmad-statusline:start -->` / `<!-- bmad-statusline:end -->` markers from projects that had the old LLM-write approach installed.

### Target 7 Implementation — settings.local.json Backward Compat

```js
function uninstallTarget7(paths) {
  const target = '.claude/settings.local.json';
  try {
    if (!fs.existsSync(paths.settingsLocal)) {
      logSkipped(target, 'file not found');
      return;
    }

    const config = readJsonFile(paths.settingsLocal);
    const allow = config.permissions && config.permissions.allow;

    if (!Array.isArray(allow) || !allow.some(r => r.includes('BMAD_PROJ_DIR'))) {
      logSkipped(target, 'no BMAD permission rules found');
      return;
    }

    config.permissions.allow = allow.filter(r => !r.includes('BMAD_PROJ_DIR'));

    // Clean up empty structures
    if (config.permissions.allow.length === 0) delete config.permissions.allow;
    if (Object.keys(config.permissions).length === 0) delete config.permissions;

    // Delete file if completely empty
    if (Object.keys(config).length === 0) {
      fs.unlinkSync(paths.settingsLocal);
      logSuccess(target, 'BMAD permission rules removed (file deleted — empty)');
      return;
    }

    writeJsonSafe(paths.settingsLocal, config);
    logSuccess(target, 'BMAD permission rules removed');
  } catch (err) {
    logError(target, err.message);
    return false;
  }
}
```

**Key difference from Target 5:** No `.bak` backup needed — this is a project-level file (`.claude/settings.local.json`), not a critical global config. The file might only contain BMAD rules, in which case delete it entirely. No restore-from-backup logic.

**Detection:** Match rules containing the string `BMAD_PROJ_DIR`. This is the marker that identifies old bmad-statusline permission rules.

**Note:** `.claude/settings.local.json` is PROJECT-scoped (`process.cwd()`-relative), same as `.claude/CLAUDE.md`. Both are backward compat targets for cleaning up the old LLM-write approach.

### defaultPaths Addition

Add to the `defaultPaths` object:
```js
settingsLocal: path.join(process.cwd(), '.claude', 'settings.local.json'),
```

This follows the same pattern as `claudeMd: path.join(process.cwd(), '.claude', 'CLAUDE.md')` — project-scoped backward compat.

### What NOT to Touch

- Targets 1-4 — unchanged behavior
- `readJsonFile`, `backupFile`, `writeJsonSafe` helpers — unchanged
- `logSuccess`, `logSkipped`, `logError` helpers — unchanged
- Any other source files (`install.js`, `defaults.js`, `reader.js`, etc.)

### Hook File Deletion — Already Handled

The hook script (`bmad-hook.js`) lives in `~/.config/bmad-statusline/` alongside the reader. Target 3 already deletes this entire directory with `fs.rmSync(paths.readerDir, { recursive: true, force: true })`. No additional target needed for hook file deletion.

### Test Fixture: settings-local-with-bmad.json

```json
{
  "permissions": {
    "allow": [
      "Bash(BMAD_PROJ_DIR=*)"
    ]
  }
}
```

This simulates a project that had the old LLM-write approach installed (permission rules for the Bash command that wrote status files).

### Test createPaths Helper Update

Add to `createPaths`:
```js
settingsLocal: path.join(baseDir, 'project', '.claude', 'settings.local.json'),
```

This is parallel to the existing `claudeMd: path.join(baseDir, 'project', '.claude', 'CLAUDE.md')` — both project-scoped backward compat paths under the same `project/.claude/` directory.

### Idempotency Test Update

The idempotency test must set up ALL 7 targets:
1. (no setup needed — always skips)
2. ccstatusline with BMAD widgets
3. reader directory with files
4. cache directory with files
5. **NEW:** `claude-settings-with-hooks.json` fixture for hook config
6. CLAUDE.md with markers
7. **NEW:** `settings-local-with-bmad.json` fixture for permission rules

First run removes everything. Second run: all 7 targets log `○ skipped`.

### Hook Config Removal — Preserving Non-BMAD Hooks

Critical test: If `hooks.PostToolUse` contains BOTH bmad-hook entries AND other entries (e.g., a different tool's hook), removal must only filter out the bmad-hook entries and preserve the rest. Test with a settings.json like:
```json
{
  "hooks": {
    "PostToolUse": [
      { "matcher": "Skill", "hooks": [{ "type": "command", "command": "node other-hook.js" }] },
      { "matcher": "Skill", "hooks": [{ "type": "command", "command": "node \"~/.config/bmad-statusline/bmad-hook.js\"" }] },
      { "matcher": "Read", "hooks": [{ "type": "command", "command": "node \"~/.config/bmad-statusline/bmad-hook.js\"" }] }
    ]
  }
}
```
After uninstall: only the `other-hook.js` entry remains. `hooks.PostToolUse` is NOT deleted because it still has entries.

### Architecture Compliance

- **Module system:** ESM (`import`/`export`) — existing pattern
- **Error handling:** Installer = verbose (`logSuccess`/`logSkipped`/`logError`)
- **Config JSON mutation:** read → parse → backup → modify → stringify → write → reread → validate (for `claudeSettings`)
- **Synchronous I/O:** `readFileSync`/`writeFileSync` everywhere
- **Path construction:** `path.join()` only, paths injected via `paths` parameter
- **Testing framework:** `node:test` + `node:assert/strict` — match existing test file pattern
- **Test run command:** `node --test test/uninstall.test.js`

### Previous Story Intelligence (Story 3.4)

Story 3.4 implemented the install counterparts:
- `installTarget5(paths)` — hook config injection into `~/.claude/settings.json`
- `installTarget6(paths)` — hook script deployment

Key patterns from 3.4 to mirror in uninstall:
- **Idempotency check:** `postToolUse.some(entry => entry.hooks.some(h => h.command.includes('bmad-hook.js')))` — reuse exact same detection pattern
- **Structure creation:** Install creates `hooks.PostToolUse` if missing. Uninstall should clean up empty structures after removal.
- **Error recovery:** Install restores from `.bak` on failure. Uninstall target 5 should do the same for `claudeSettings`.

**Test fixture already exists:** `test/fixtures/claude-settings-with-hooks.json` — created by Story 3.1, used by Story 3.4, now reused by Story 3.5 for removal tests.

### Project Structure Notes

- All source code under `bmad-statusline/` (npm package root)
- `src/uninstall.js` is ESM, uses local JSON helpers (not shared with install.js — each file defines its own helpers)
- Test fixtures at `test/fixtures/` — `claude-settings-with-hooks.json` already exists
- `paths` injection pattern: all file system paths flow through the `paths` parameter for testability
- The `settingsLocal` path is project-scoped (like `claudeMd`), not global (like `claudeSettings`)

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 3.5 acceptance criteria]
- [Source: _bmad-output/planning-artifacts/architecture.md — Uninstall Changes table, lines 344-351]
- [Source: _bmad-output/planning-artifacts/architecture.md — Config JSON Mutation Sequence, pattern 4]
- [Source: _bmad-output/planning-artifacts/architecture.md — Error Handling Triad, pattern 1]
- [Source: _bmad-output/project-context.md — Uninstall table, Install Targets table]
- [Source: bmad-statusline/src/uninstall.js — current implementation (targets 1-5, 154 lines)]
- [Source: bmad-statusline/src/install.js — targets 5-6 for reverse engineering uninstall logic]
- [Source: bmad-statusline/src/defaults.js — getHookConfig() structure for detection pattern]
- [Source: bmad-statusline/test/uninstall.test.js — current test structure (261 lines)]
- [Source: bmad-statusline/test/fixtures/claude-settings-with-hooks.json — pre-existing hook config fixture]
- [Source: bmad-statusline/.claude/settings.local.json — real example of old permission rules format]
- [Source: _bmad-output/implementation-artifacts/3-4-install-pivot-hook-targets.md — previous story context]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation, all tests passed first run.

### Completion Notes List

- Added `settingsLocal` path to `defaultPaths` (project-scoped, parallel to `claudeMd`)
- Renamed `uninstallTarget5` → `uninstallTarget6` with updated target label "(backward compat)"
- Implemented `uninstallTarget5` — hook config removal from `~/.claude/settings.json` with backup/restore, empty structure cleanup, and idempotency detection via `bmad-hook.js` command matching
- Implemented `uninstallTarget7` — `settings.local.json` backward compat, removes `BMAD_PROJ_DIR` permission rules, deletes file if empty after removal
- Wired all 7 targets into `uninstall()` main function in correct order
- Added 6 tests for Target 5 (hook config removal): removal, preserve non-bmad, skip no hooks, skip no file, .bak creation, empty cleanup
- Added 5 tests for Target 7 (settings.local.json): removal+delete, skip no match, skip no file, delete when empty, preserve other config
- Updated idempotency test to cover all 7 targets
- Created `settings-local-with-bmad.json` fixture
- 26 tests total, 0 failures

### Change Log

- 2026-03-29: Implemented uninstall targets 5 (hook config removal), 6 (renamed from 5, CLAUDE.md backward compat), 7 (settings.local.json backward compat). Added settingsLocal to defaultPaths. Full test coverage added. 26/26 tests pass.

### File List

- `bmad-statusline/src/uninstall.js` — modified (added settingsLocal path, new target 5, renamed target 5→6, new target 7, wired 7 targets)
- `bmad-statusline/test/uninstall.test.js` — modified (added settingsLocal to createPaths, added Target 5+7 test groups, renamed Target 5→6 tests, updated idempotency)
- `bmad-statusline/test/fixtures/settings-local-with-bmad.json` — NEW (fixture for backward compat test)

### Review Findings

- [x] [Review][Defer] Silent inner catch dans error recovery Target 5 — pre-existing pattern (identical to Target 2), not introduced by this diff
- [x] [Review][Defer] Double CLAUDE.md markers need 2 uninstall passes — pre-existing in old Target 5 logic, not introduced by this diff
- [x] [Review][Defer] `process.cwd()` for `settingsLocal` may target wrong project if run from different dir — pre-existing pattern (same as `claudeMd`), not introduced by this diff
