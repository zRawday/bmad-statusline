---
title: 'Auto-heal ccstatusline npx cache on session start'
type: 'bugfix'
created: '2026-06-03'
status: 'ready-for-dev'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** On Windows, `npx -y ccstatusline@latest` (the Claude Code `statusLine.command`) periodically reuses a corrupted npx cache entry that lost its Windows shims (`ccstatusline.cmd` / `.ps1`), so the status line renders nothing while the monitor keeps working. The only repair today is running `bmad-statusline doctor` by hand, so the blank status line keeps recurring.

**Approach:** Make the already-deployed hook self-heal at session start. Before its `_bmad` guard, when `hook_event_name` is `SessionStart`, detect structurally-broken ccstatusline npx cache entries and purge them so the next `npx` call regenerates them cleanly. Widen the `SessionStart` hook matcher from `resume` to `` so fresh sessions also trigger it, and upgrade existing installs.

## Boundaries & Constraints

**Always:**
- Keep the hook CJS, zero-dependency, synchronous, and SILENT — never write to stdout/stderr, never throw; wrap all repair work in try/catch.
- Run the repair BEFORE the `_bmad` guard so it works in any project (the status line is global).
- Purge ONLY structurally-broken ccstatusline entries (missing the platform shim). Leave healthy entries untouched — no per-session reinstall churn.
- Identify ccstatusline entries exactly like `doctor.js`: `package.json` `_npx.packages` contains `ccstatusline` or `ccstatusline@*` (NOT `ccstatusline-*`).
- Honor `BMAD_NPX_CACHE_DIR` (the same env var `doctor.js` uses) for the cache location; otherwise default per platform (win32: `~/AppData/Local/npm-cache/_npx`, else `~/.npm/_npx`).

**Ask First:**
- Any change to `statusLine.command` itself or adding a render-time wrapper — out of scope; the hook approach was chosen deliberately.

**Never:**
- Do NOT pre-warm/regenerate by spawning `npx` from the hook — a second concurrent npm/npx op is exactly what corrupts the cache. Purge only; let the next render's single `npx` regenerate.
- Do NOT run the slow functional check (`spawn npx`) in the hook.
- Do NOT touch the reader, ccstatusline settings, or `config.json`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Broken entry | SessionStart; `_npx/<h>` is ccstatusline, win32, `.bin/ccstatusline.cmd` missing | folder purged | try/catch, silent |
| Healthy entry | SessionStart; ccstatusline entry has the platform shim | left intact | — |
| Non-ccstatusline | SessionStart; `_npx/<h>` is another package | left intact | — |
| No cache dir | SessionStart; `_npx` absent | no-op | swallow ENOENT |
| Other events | Read / Write / Stop / etc. | repair block skipped entirely | — |
| Non-BMAD cwd | SessionStart with no `_bmad` upward | repair still runs, then guard exits 0 | — |

</frozen-after-approval>

## Code Map

- `src/hook/bmad-hook.js` -- add SessionStart repair block before the `_bmad` guard (after the early SessionEnd block, ~line 81); plus inline CJS helpers for npx-cache dir + broken-entry detection.
- `src/defaults.js` -- `getHookConfig`: SessionStart matcher `'resume'` → `''` (line 64).
- `src/install.js` -- `installTarget5`: upgrade an existing bmad SessionStart entry matcher `'resume'` → `''` before the add-missing merge (mirror the PostToolUse stale-Skill cleanup, lines 178-187).
- `src/doctor.js` -- reference only for the npx-dir + entry-match logic; do NOT import it (hook stays zero-dep).
- `test/hook.test.js` -- new SessionStart auto-heal cases (spawn hook with `BMAD_NPX_CACHE_DIR`).
- `test/defaults.test.js`, `test/install.test.js`, `test/uninstall.test.js` -- update/extend matcher expectations.

## Tasks & Acceptance

**Execution:**
- [ ] `src/hook/bmad-hook.js` -- add `if (payload.hook_event_name === 'SessionStart') { … purge broken ccstatusline npx entries … }` before the `_bmad` guard, with inline `npxCacheDir()` (env + platform) and `isBrokenCcstatuslineEntry(dir)` (platform shim check); all silent/try-catch -- heals the documented failure at the natural moment.
- [ ] `src/defaults.js` -- change SessionStart matcher to `''` -- fire on fresh sessions, not only resume.
- [ ] `src/install.js` -- in `installTarget5`, rewrite an existing bmad SessionStart `'resume'` matcher to `''` before the add-missing merge -- upgrade existing installs without creating a duplicate entry.
- [ ] `test/hook.test.js` -- add cases: broken purged, healthy kept, non-ccstatusline kept, no-cache-dir no-op, repair runs without `_bmad` -- lock the behavior.
- [ ] `test/defaults.test.js` / `test/install.test.js` / `test/uninstall.test.js` -- assert matcher `''`, that re-install upgrades `'resume'`→`''` with no duplicate, and that uninstall still removes the widened entry.

**Acceptance Criteria:**
- Given a corrupted ccstatusline npx entry (missing the platform shim), when a SessionStart hook fires, then that entry's folder is deleted and other cache entries remain.
- Given a healthy ccstatusline entry, when SessionStart fires repeatedly, then it is never deleted (no reinstall churn).
- Given an existing install with SessionStart matcher `'resume'`, when `npx bmad-statusline install` runs, then the matcher becomes `''` with exactly one bmad SessionStart entry, and `uninstall` still removes it.
- Given any non-SessionStart event, when the hook runs, then no cache scanning occurs and existing behavior is unchanged.
- Given `npm test`, when the suite runs, then all tests pass.

## Verification

**Commands:**
- `npm test` -- expected: full suite passes, including the new hook auto-heal cases.
- Simulate: plant a broken entry in a temp `_npx`, pipe a SessionStart payload to `node src/hook/bmad-hook.js` with `BMAD_NPX_CACHE_DIR` set -- expected: the broken folder is gone, healthy/other folders remain.

**Manual checks:**
- After `npx bmad-statusline install`, inspect `~/.claude/settings.json` → `hooks.SessionStart` has exactly one bmad entry with `matcher: ""`.
