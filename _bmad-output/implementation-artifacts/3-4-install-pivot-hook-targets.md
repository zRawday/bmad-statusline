# Story 3.4: Install pivot — hook targets

Status: done

## Story

As a **developer setting up BMAD statusline**,
I want **`npx bmad-statusline install` to inject the hook config and deploy the hook script instead of writing CLAUDE.md instructions and permission rules**,
So that **status tracking works passively via hook without any per-project LLM instructions**.

## Acceptance Criteria

1. **Given** `~/.claude/settings.json` exists without hook entries for `bmad-hook.js` **When** install runs **Then** it merges the two PostToolUse matchers (Skill + Read) into `hooks.PostToolUse`, preserving any existing hooks. Creates `.bak` backup before writing. Validates post-write by rereading and parsing.

2. **Given** `~/.claude/settings.json` has no `hooks` key, or `hooks` has no `PostToolUse` key **When** install runs **Then** it creates the missing structure (`hooks.PostToolUse` array) before injecting matchers.

3. **Given** `~/.claude/settings.json` already contains hook entries with command matching `bmad-hook.js` **When** install runs **Then** it skips hook injection and logs `○ skipped`.

4. **Given** `~/.config/bmad-statusline/bmad-hook.js` does not exist **When** install runs **Then** it copies `src/hook/bmad-hook.js` to `~/.config/bmad-statusline/bmad-hook.js`.

5. **Given** hook script already exists at destination **When** install runs **Then** it always overwrites with the latest version and logs `✓ updated`.

6. **Given** install runs **When** processing targets **Then** there is no CLAUDE.md block injection target and no `settings.local.json` permission rules injection target (both removed).

7. **Given** install has already been run successfully **When** install is run a second time **Then** hook config shows `○ skipped`, hook script shows `✓ updated` (always deploy latest), no duplication of matchers in `hooks.PostToolUse`.

8. **Given** install runs **When** processing targets 1-4 (statusLine config, ccstatusline widgets, reader deployment, cache dir) **Then** these targets behave identically to the pre-pivot install.

9. **Given** `test/install.test.js` **When** updated **Then** it tests hook config injection, idempotency, and uses fixture `claude-settings-with-hooks.json`. Removes tests for CLAUDE.md block and permission rules injection (none exist, so no removal needed).

## Tasks / Subtasks

- [x] Task 1: Add `getHookConfig` import to `src/install.js` (AC: #1, #2)
  - [x] Add `getHookConfig` to the import from `./defaults.js`
  - [x] Add `hookSource` constant pointing to `src/hook/bmad-hook.js` (same pattern as `readerSource`)
  - [x] Add `hookDest` to `defaultPaths`: `path.join(home, '.config', 'bmad-statusline', 'bmad-hook.js')`

- [x] Task 2: Implement `installTarget5(paths)` — hook config injection (AC: #1, #2, #3)
  - [x] Target label: `~/.claude/settings.json hooks`
  - [x] Read `paths.claudeSettings` if it exists (it should — target 1 created it)
  - [x] Follow config JSON mutation sequence: read → parse → backup → modify → write → reread → validate
  - [x] Create `hooks.PostToolUse` structure if missing (`config.hooks = config.hooks || {}; config.hooks.PostToolUse = config.hooks.PostToolUse || [];`)
  - [x] Idempotency check: scan `hooks.PostToolUse` for entries where any hook's `command` includes `bmad-hook.js` — if found, `logSkipped` and return
  - [x] Get hook config from `getHookConfig(paths.hookDest)` and push its two matchers into `hooks.PostToolUse`
  - [x] `backupFile` before write, `writeJsonSafe` to write+validate
  - [x] `logSuccess` on completion
  - [x] Wrap in try/catch, restore from `.bak` on error, `logError`

- [x] Task 3: Implement `installTarget6(paths)` — hook script deployment (AC: #4, #5)
  - [x] Target label: `~/.config/bmad-statusline/bmad-hook.js`
  - [x] `fs.mkdirSync(paths.readerDir, { recursive: true })` — reuse same dir as reader
  - [x] Copy `hookSource` to `paths.hookDest`
  - [x] Always overwrite (same pattern as reader target 3)
  - [x] Log `✓ updated` if existed, `✓ installed` if new
  - [x] Wrap in try/catch, `logError` on failure

- [x] Task 4: Wire targets 5 and 6 into `install()` main function (AC: #7, #8)
  - [x] Add `installTarget5(paths)` and `installTarget6(paths)` to the results array
  - [x] Order: targets 1, 2, 3, 4, 5, 6 (hook config after cache dir, hook deploy after config)

- [x] Task 5: Update `test/install.test.js` (AC: #9)
  - [x] Add `hookDest` to the `createPaths` helper: `path.join(baseDir, 'config', 'bmad-statusline', 'bmad-hook.js')`
  - [x] Add `describe('Target 5: hook config injection')` test group:
    - [x] Test: injects two PostToolUse matchers when hooks absent
    - [x] Test: skips when bmad-hook entries already present (use fixture `claude-settings-with-hooks.json`)
    - [x] Test: preserves existing non-bmad hooks in PostToolUse
    - [x] Test: creates hooks structure when only statusLine exists
  - [x] Add `describe('Target 6: hook script deployment')` test group:
    - [x] Test: copies hook script when absent
    - [x] Test: overwrites when present and logs updated
  - [x] Update idempotency test: verify no hook matcher duplication after 3 runs
  - [x] Update backup test: verify `.bak` for hook config injection

- [x] Task 6: Run tests — `node --test test/install.test.js` must pass

## Dev Notes

### Files to Modify (2 files only)

| File | Action |
|------|--------|
| `bmad-statusline/src/install.js` | Add import, add 2 new targets, add hookDest to defaultPaths |
| `bmad-statusline/test/install.test.js` | Add hookDest to test paths, add test groups for targets 5-6, update idempotency/backup tests |

### Current Install.js Structure

The file has a clean pattern: `installTarget1` through `installTarget4`, each following the same structure:
- Target label string
- Try/catch wrapper
- `logSuccess`/`logSkipped`/`logError` per outcome
- Return `false` on error (checked by main)

New targets 5 and 6 follow this exact pattern.

### Target 5 Implementation — Hook Config Injection

**Key logic: merging into existing `hooks.PostToolUse`**

```js
function installTarget5(paths) {
  const target = '~/.claude/settings.json hooks';
  try {
    // settings.json should exist (target 1 created it)
    if (!fs.existsSync(paths.claudeSettings)) {
      logSkipped(target, 'settings.json not found');
      return;
    }

    const config = readJsonFile(paths.claudeSettings);

    // Idempotency: check for existing bmad-hook entries
    const postToolUse = config.hooks && config.hooks.PostToolUse;
    if (Array.isArray(postToolUse)) {
      const hasBmadHook = postToolUse.some(entry =>
        Array.isArray(entry.hooks) && entry.hooks.some(h => h.command && h.command.includes('bmad-hook.js'))
      );
      if (hasBmadHook) {
        logSkipped(target, 'hook config already present');
        return;
      }
    }

    backupFile(paths.claudeSettings);

    // Create structure if missing
    config.hooks = config.hooks || {};
    config.hooks.PostToolUse = config.hooks.PostToolUse || [];

    // Get hook config and merge matchers
    const hookConfig = getHookConfig(paths.hookDest);
    config.hooks.PostToolUse.push(...hookConfig.hooks.PostToolUse);

    writeJsonSafe(paths.claudeSettings, config);
    logSuccess(target, 'hook config injected');
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

**Critical detail:** `paths.claudeSettings` is the SAME file as target 1. Target 1 creates it if absent and adds `statusLine`. Target 5 adds `hooks` to the same file. Both share the same backup/write/validate helpers. The backup from target 5 will overwrite target 1's backup — this is fine because target 1 already validated its write.

### Target 6 Implementation — Hook Script Deployment

Same pattern as `installTarget3` (reader deployment):

```js
function installTarget6(paths) {
  const target = '~/.config/bmad-statusline/bmad-hook.js';
  try {
    fs.mkdirSync(paths.readerDir, { recursive: true });
    const existed = fs.existsSync(paths.hookDest);
    fs.copyFileSync(hookSource, paths.hookDest);
    logSuccess(target, existed ? 'updated' : 'installed');
  } catch (err) {
    logError(target, err.message);
    return false;
  }
}
```

### defaultPaths Addition

Add to the `defaultPaths` object:
```js
hookDest: path.join(home, '.config', 'bmad-statusline', 'bmad-hook.js'),
```

**Note:** `readerDir` already points to `~/.config/bmad-statusline/`, so `installTarget6` reuses it for `mkdirSync`. No new directory path needed.

### hookSource Constant

Add after the `readerSource` constant:
```js
const hookSource = path.join(__dirname, 'hook', 'bmad-hook.js');
```

### What NOT to Touch

- Targets 1-4 — unchanged behavior
- `readJsonFile`, `backupFile`, `writeJsonSafe` helpers — unchanged
- `logSuccess`, `logSkipped`, `logError` helpers — unchanged
- Any other files (defaults.js already has `getHookConfig` from Story 3.3)

### Known Downstream Impact

- `src/uninstall.js` will need matching hook removal — that's Story 3.5
- No other files affected by this change

### Test Implementation Details

**Test fixture already exists:** `test/fixtures/claude-settings-with-hooks.json` — contains settings.json with both Skill and Read PostToolUse matchers for bmad-hook.js.

**Test `createPaths` helper** needs `hookDest` added:
```js
hookDest: path.join(baseDir, 'config', 'bmad-statusline', 'bmad-hook.js'),
```

**Test for preserving non-bmad hooks:** Create a settings.json with an existing PostToolUse entry (e.g., a different hook for a different tool), run install, verify the non-bmad entry is preserved alongside the new bmad entries.

**Idempotency update:** After 3 runs, count PostToolUse entries containing `bmad-hook.js` — should be exactly 2 (Skill + Read).

### Architecture Compliance

- **Module system:** ESM (`import`/`export`) — existing pattern
- **Error handling:** Installer = verbose (`logSuccess`/`logSkipped`/`logError`)
- **Config JSON mutation:** read → parse → backup → modify → stringify → write → reread → validate
- **Synchronous I/O:** `readFileSync`/`writeFileSync` everywhere
- **Path construction:** `path.join()` only, paths injected via `paths` parameter
- **Testing framework:** `node:test` + `node:assert/strict` — match existing test file pattern
- **Test run command:** `node --test test/install.test.js`

### Previous Story Intelligence (Story 3.3)

Story 3.3 added `getHookConfig(hookPath)` to `src/defaults.js`. It returns:
```js
{
  hooks: {
    PostToolUse: [
      { matcher: 'Skill', hooks: [{ type: 'command', command: `node "${hookPath}"` }] },
      { matcher: 'Read', hooks: [{ type: 'command', command: `node "${hookPath}"` }] }
    ]
  }
}
```

The `hookPath` argument should be the deployed path: `paths.hookDest` (which resolves to `~/.config/bmad-statusline/bmad-hook.js`).

**Review finding from 3.3 (deferred):** hookPath not sanitized — acceptable because it's always constructed via `path.join()` by the installer, never from user input.

### Project Structure Notes

- All source code is under `bmad-statusline/` (npm package root)
- `src/install.js` is ESM, imports from `./defaults.js`
- Hook source at `src/hook/bmad-hook.js` (CommonJS standalone, deployed artifact)
- Test fixtures at `test/fixtures/` — `claude-settings-with-hooks.json` already created by Story 3.1
- `paths` injection pattern: all file system paths flow through the `paths` parameter for testability

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 3.4 acceptance criteria]
- [Source: _bmad-output/planning-artifacts/architecture.md — Install Target Changes table, lines 325-341]
- [Source: _bmad-output/planning-artifacts/architecture.md — Config JSON Mutation Sequence, pattern 4]
- [Source: _bmad-output/planning-artifacts/architecture.md — Dual-signal hook architecture, lines 100-165]
- [Source: _bmad-output/project-context.md — Install Targets table, Boundary 4-5]
- [Source: bmad-statusline/src/install.js — current implementation (targets 1-4)]
- [Source: bmad-statusline/src/defaults.js — getHookConfig() export added by Story 3.3]
- [Source: bmad-statusline/src/hook/bmad-hook.js — hook script to deploy (Story 3.1)]
- [Source: bmad-statusline/test/install.test.js — current test structure]
- [Source: bmad-statusline/test/fixtures/claude-settings-with-hooks.json — pre-existing fixture]
- [Source: _bmad-output/implementation-artifacts/3-3-defaults-js-pivot-hook-config-export.md — previous story learnings]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- ✅ Task 1: Added `getHookConfig` import, `hookSource` constant, and `hookDest` to `defaultPaths`
- ✅ Task 2: Implemented `installTarget5` — hook config injection with idempotency (scan for `bmad-hook.js` in PostToolUse commands), backup/restore on error, and `writeJsonSafe` validation
- ✅ Task 3: Implemented `installTarget6` — hook script deployment, always overwrites (same pattern as reader target 3)
- ✅ Task 4: Wired targets 5 and 6 into `install()` results array (order: 1-6)
- ✅ Task 5: Added `hookDest` to test `createPaths`, added 4 Target 5 tests (inject, skip, preserve non-bmad, create structure), 2 Target 6 tests (copy, overwrite), updated idempotency test for hook matchers after 3 runs. Updated existing Target 1 "skips" test to accommodate target 5 modifying same file.
- ✅ Task 6: All 20 install tests pass. Full suite 156/156 pass — zero regressions.

### Review Findings

- [x] [Review][Patch] Type guards manquants: `hooks` non-objet ou `PostToolUse` non-tableau provoquent crash dans `installTarget5` [src/install.js:179-181] — fixé, suit le précédent de Target 2 (coercion `config.lines`)
- [x] [Review][Defer] Ordre d'exécution: Target 5 (config hook) avant Target 6 (deploy hook) — deferred, pre-existing pattern (targets 2/3 identiques)
- [x] [Review][Defer] Slot `.bak` unique partagé entre targets 1 et 5 — deferred, pre-existing pattern
- [x] [Review][Defer] Pas de test pour le rollback/restore dans catch de `installTarget5` — deferred, pre-existing (targets 1-2 identiques)
- [x] [Review][Defer] Pas de test pour le path `settings.json not found` de Target 5 — deferred, minor coverage gap

### Change Log

- 2026-03-29: Implemented install targets 5 (hook config injection) and 6 (hook script deployment) with full test coverage

### File List

- `bmad-statusline/src/install.js` — modified: added `getHookConfig` import, `hookSource` constant, `hookDest` path, `installTarget5`, `installTarget6`, wired into `install()`
- `bmad-statusline/test/install.test.js` — modified: added `hookDest` to `createPaths`, added Target 5 (4 tests) and Target 6 (2 tests) groups, updated idempotency test for hook matchers, updated Target 1 skip test for compatibility
