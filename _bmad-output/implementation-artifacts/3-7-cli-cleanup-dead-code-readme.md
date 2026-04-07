# Story 3.7: CLI cleanup + dead code + README

Status: done

## Story

As a **bmad-statusline maintainer**,
I want **all dead code from the old LLM-write approach removed and the README updated**,
So that **the codebase is clean and the documentation reflects the hook-based architecture**.

## Acceptance Criteria

1. **Given** `bin/cli.js` **When** inspected **Then** the `patch-init` route and its `--revert` flag handling are removed, and the USAGE text no longer lists `patch-init`
2. **Given** the following files exist **When** this story is completed **Then** they are deleted: `src/patch-init.js`, `test/patch-init.test.js`, `test/fixtures/bmad-init-original.py`
3. **Given** `test/cli.test.js` **When** updated **Then** tests for the `patch-init` route are removed (note: currently none exist — verify and confirm)
4. **Given** `README.md` **When** updated **Then** it describes the hook-based approach (passive PostToolUse extraction) instead of the LLM-write approach, install/uninstall documentation reflects the new hook targets, and `patch-init` command is removed from CLI documentation
5. **Given** all remaining source files **When** inspected **Then** no file imports from `src/patch-init.js` or references `generateClaudeMdBlock`/`generateClaudeMdBlockPatched`/`getPermissionRules`

## Tasks / Subtasks

- [x] Task 1: Remove `patch-init` route from `bin/cli.js` (AC: #1)
  - [x] 1.1 Remove `patch-init` line from USAGE string (line ~12)
  - [x] 1.2 Remove the `case 'patch-init':` block from the switch statement (lines ~33-38)
- [x] Task 2: Delete dead files (AC: #2)
  - [x] 2.1 Delete `src/patch-init.js`
  - [x] 2.2 Delete `test/patch-init.test.js`
  - [x] 2.3 Delete `test/fixtures/bmad-init-original.py`
- [x] Task 3: Verify `test/cli.test.js` (AC: #3)
  - [x] 3.1 Confirm no patch-init test references remain (currently clean — no action expected)
- [x] Task 4: Update `README.md` (AC: #4)
  - [x] 4.1 Rewrite to describe hook-based passive extraction architecture
  - [x] 4.2 Document install/uninstall with hook targets
  - [x] 4.3 Remove any `patch-init` CLI references
  - [x] 4.4 Document available CLI commands: `install`, `uninstall`, `clean`, TUI (no-arg)
- [x] Task 5: Verify no remaining dead references (AC: #5)
  - [x] 5.1 Grep all `src/` and `test/` for `patch-init` imports — zero matches confirmed
  - [x] 5.2 Grep all `src/` and `test/` for `generateClaudeMdBlock`, `generateClaudeMdBlockPatched`, `getPermissionRules` — found residual in `src/install.js` (stories 3.3/3.4 incomplete)
  - [x] 5.3 Removed residual references: dead import, `installTarget5` (CLAUDE.md), `installTarget6` (settings.local.json), `resolveSlug`, orphaned path entries from `src/install.js`. Also removed dead tests from `test/install.test.js` (Target 5: CLAUDE.md, slug resolution, multi-project sections)
- [x] Task 6: Run test suite and verify pass (all ACs)
  - [x] 6.1 Run `node --test test/*.test.js` — 150 tests pass, 0 failures
  - [x] 6.2 Verify no tests reference deleted modules — confirmed

## Dev Notes

### Architecture Context

This is the **final cleanup story** of Epic 3 (hook pivot). By this point, stories 3.1-3.6 should have completed the functional pivot:
- 3.1: Hook script created
- 3.2: Reader simplified (agent/request/document removed)
- 3.3: `defaults.js` pivot — `generateClaudeMdBlock()`, `generateClaudeMdBlockPatched()`, `getPermissionRules()` removed, `getHookConfig()` added
- 3.4: Install pivot — hook targets replace CLAUDE.md/permissions targets
- 3.5: Uninstall pivot — hook removal + backward compat
- 3.6: TUI adaptation — dead widgets removed

Story 3.7 removes the **last remnant** of the old approach: the `patch-init` CLI route and its associated files, plus updates documentation.

### Critical Constraints

- **Error handling triad:** Not directly relevant here (no runtime code added), but README content must accurately describe the hook=silent, reader=silent, installer=verbose triad
- **ESM module system:** `bin/cli.js` uses ESM (`await import()`). Removing the `patch-init` case is a straightforward switch-case deletion
- **Zero runtime deps:** Verify `package.json` doesn't change — `src/patch-init.js` is not a dependency, just a module
- **Test framework:** `node:test` + `node:assert` — run `node --test test/*.test.js`

### File Changes Summary

| File | Action | Details |
|------|--------|---------|
| `bin/cli.js` | EDIT | Remove `patch-init` from USAGE string and switch-case |
| `src/patch-init.js` | DELETE | 348-line dead module |
| `test/patch-init.test.js` | DELETE | 463-line dead test file |
| `test/fixtures/bmad-init-original.py` | DELETE | Dead test fixture |
| `test/cli.test.js` | VERIFY | Currently has no patch-init tests — confirm clean |
| `README.md` | REWRITE | Describe hook-based architecture |

### `bin/cli.js` — Exact Changes

Current USAGE string includes:
```
  patch-init   Patch bmad_init.py for auto status fields (--revert to undo)
```
Remove this line entirely.

Current switch-case includes:
```javascript
    case 'patch-init': {
      const revert = process.argv.includes('--revert');
      const mod = await import('../src/patch-init.js');
      mod.default({ revert });
      break;
    }
```
Remove this entire case block.

After edit, the switch should only have: `install`, `uninstall`, `clean`, and `default`.

USAGE text after edit should be:
```
bmad-statusline — BMAD workflow status line for ccstatusline

Usage: bmad-statusline [command]

Commands:
  (no command) Launch TUI configurator
  install      Install status line widgets and reader
  uninstall    Remove status line widgets and reader
  clean        Clean cache files

Options:
  -h, --help   Show this help text
```

### `README.md` — Content Guidance

The README should cover:
1. **What it is:** BMAD workflow status line for ccstatusline — passive PostToolUse hook extraction
2. **How it works:** Hook (PostToolUse Skill+Read) detects workflows/steps/stories automatically. Reader formats status for ccstatusline. Zero LLM friction.
3. **Install/uninstall:** `npx bmad-statusline install` / `uninstall` — deploys hook + reader to `~/.config/bmad-statusline/`, injects hook config into `~/.claude/settings.json`, adds widgets to ccstatusline
4. **CLI commands:** `install`, `uninstall`, `clean`, TUI (no argument)
5. **Architecture summary:** Hook (writer) → status file → Reader (consumer), both deployed standalone
6. **Requirements:** Node.js >= 20, ccstatusline

Do NOT include `patch-init` in any CLI documentation.

### Dead Reference Verification

After stories 3.3 and 3.4, the following should already be gone:
- `src/defaults.js`: No `generateClaudeMdBlock`, `generateClaudeMdBlockPatched`, `getPermissionRules` exports
- `src/install.js`: No imports of those functions
- `test/defaults.test.js`: No tests for those functions

Story 3.7 must **verify** this is the case. If any remain (incomplete prior stories), remove them.

### What NOT to Do

- Do NOT modify `src/install.js`, `src/uninstall.js`, `src/defaults.js`, or `src/reader/` — those were changed in stories 3.2-3.5
- Do NOT modify `src/tui/` — that was story 3.6
- Do NOT add new functionality — this is strictly cleanup
- Do NOT modify `package.json` — no dependency changes needed

### Project Structure Notes

- All source code is in `bmad-statusline/` subdirectory of the project root
- Paths relative to package root: `bin/cli.js`, `src/patch-init.js`, `test/patch-init.test.js`, `test/fixtures/bmad-init-original.py`
- The `files` field in `package.json` includes `bin/` and `src/` — removing `src/patch-init.js` automatically excludes it from published package

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.7] — acceptance criteria and FR coverage
- [Source: _bmad-output/planning-artifacts/architecture.md#Architectural Boundaries] — Boundary 3 (CLI entry point): routes are `install`, `uninstall`, `clean`, `--help`, no-arg→TUI. `patch-init` route removed.
- [Source: _bmad-output/planning-artifacts/architecture.md#Structural Changes for Pivot] — confirms removal of `src/patch-init.js`
- [Source: _bmad-output/project-context.md#Architectural Boundaries] — Boundary 3 confirms `patch-init` route removed
- [Source: _bmad-output/planning-artifacts/epics.md#FR Coverage Map] — Story 3.7 covers cleanup (no specific FRs, post-pivot housekeeping)
- [Source: _bmad-output/planning-artifacts/epics.md#Requirements Inventory] — Files to remove: `src/patch-init.js`, `test/patch-init.test.js`, `test/fixtures/bmad-init-original.py`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean execution, no halts or retries.

### Completion Notes List

- Task 1: Removed `patch-init` from USAGE string and switch-case in `bin/cli.js`. CLI now only routes: install, uninstall, clean, --help, no-arg→TUI.
- Task 2: Deleted 3 dead files: `src/patch-init.js` (348 lines), `test/patch-init.test.js` (463 lines), `test/fixtures/bmad-init-original.py`.
- Task 3: Verified `test/cli.test.js` — no patch-init references found (already clean).
- Task 4: Rewrote `README.md` — describes hook-based PostToolUse architecture, install/uninstall with hook targets, CLI commands (install, uninstall, clean, TUI). No mention of patch-init.
- Task 5: Found residual `generateClaudeMdBlock` and `getPermissionRules` references in `src/install.js` (stories 3.3/3.4 incomplete). Removed: dead import, `installTarget5` (CLAUDE.md block injection), `installTarget6` (settings.local.json rules), `resolveSlug` helper, orphaned defaultPaths entries. Also removed corresponding dead tests from `test/install.test.js` (Target 5, slug resolution, multi-project sections). Cleaned idempotency test to remove CLAUDE.md assertions.
- Task 6: Full test suite passes — 150 tests, 0 failures, 0 regressions.

### Review Findings

- [x] [Review][Patch] `claudeProjects` orphelin dans `install.js` defaultPaths — dead code, jamais lu après suppression de `installTarget5` [`src/install.js:14`, `test/install.test.js:24`] — fixed
- [x] [Review][Defer] `uninstallTarget5` CLAUDE.md cleanup asymétrique avec install — intentionnellement gardé pour migration legacy, story 3-5 (backlog) gère le pivot uninstall [`src/uninstall.js:109-138`] — deferred, pre-existing
- [x] [Review][Defer] `homeDir` orphelin dans `uninstall.js` defaultPaths — dead code pré-existant, hors scope story 3-7 [`src/uninstall.js:12`] — deferred, pre-existing

### Change Log

- 2026-03-29: Story 3.7 implementation — CLI cleanup, dead code removal, README rewrite, residual dead reference cleanup in install.js/install.test.js

### File List

- `bin/cli.js` — EDITED: removed patch-init from USAGE and switch-case
- `src/patch-init.js` — DELETED
- `test/patch-init.test.js` — DELETED
- `test/fixtures/bmad-init-original.py` — DELETED
- `README.md` — REWRITTEN: hook-based architecture documentation
- `src/install.js` — EDITED: removed dead imports (generateClaudeMdBlock, getPermissionRules), removed installTarget5/6, resolveSlug, orphaned paths
- `test/install.test.js` — EDITED: removed dead test sections (Target 5, slug resolution, multi-project), cleaned idempotency test, removed orphaned createPaths entries
