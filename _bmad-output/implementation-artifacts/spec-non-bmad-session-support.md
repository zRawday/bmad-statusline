---
title: 'Non-BMAD session support (widgets + monitor)'
type: 'feature'
created: '2026-08-09'
status: 'done'
baseline_commit: '5d46968'
context: ['_bmad-output/project-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Status line and monitor are dead outside a BMAD project. The hook exits at the `_bmad/` guard so no `status-{sid}.json` is written; the reader then returns `''`; the monitor drops any session whose `status.skill` is null. Session-agnostic widgets (project, LLM state, timer, context %, weekly usage, file read/write) and the entire monitor are unavailable in ordinary Claude Code sessions.

**Approach:** Track **every** session: the `_bmad/` walk-up becomes a *detection* (sets `bmadRoot` when found) instead of a *gate* (no longer exits when absent), and the monitor's `skill` filter is dropped. BMAD-specific fields stay null, so BMAD-specific widgets render empty exactly as they do mid-session today. The `UserPromptSubmit` matcher widens to `''` so LLM state is accurate outside BMAD too.

## Boundaries & Constraints

**Always:**
- BMAD sessions behave **exactly** as today: when `_bmad/` is found, `cwd` is still rewritten to `bmadRoot`, and project / `_outputFolders` / step / story / skill detection are unchanged.
- Non-BMAD session = `project` from `basename(payload.cwd)`; `skill`, `workflow`, `active_skill`, `story`, `step.*`, `document_name` stay `null`.
- Keep the `'_bmad'` literal in the hook **between** stdin parsing and `touchAlive(sessionId)` — `test/hook.test.js` "follows prescribed entry point structure" asserts that source ordering. Keep the 20-level depth limit and the `if (!cwd) process.exit(0)` bail.
- Hook stays silent-always, sync-I/O-only, zero-dependency CJS (Patterns 1, 2).
- Widening the `UserPromptSubmit` matcher must **rewrite the existing entry in place**, never append: `installTarget5`'s merge loop keys on matcher equality, so a new matcher would duplicate the hook on BMAD prompts.

**Ask First:**
- Any new retention/cleanup for status files. Accepted as-is: growth is bounded by the existing 10 MB / 500-entry caps, and `cleanOrphanedStatusFiles()` purges 7-day orphans on TUI launch.
- Any opt-out flag. Decided: none — tracking is unconditional.

**Never:**
- Do NOT touch `src/reader/bmad-sl-reader.js`. Its `if (!status) return ''` stays; the fix is upstream, which preserves the documented Rev.7 "intentional asymmetry" without a reader change.
- Do NOT invent display values for `workflow`/`story`/`step` outside BMAD — empty is correct.
- Do NOT change `_outputFolders` derivation (it will point at non-existent `_bmad-output/` dirs; harmless, `document_name` just never matches).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior |
|----------|--------------|---------------------------|
| BMAD project (regression) | `cwd` is a subdir of a dir holding `_bmad/` | Unchanged: `cwd` := `bmadRoot`, project from `_bmad/bmm/config.yaml` |
| Non-BMAD project | no `_bmad/` within 20 levels up | Status file written; `project` = `basename(cwd)`; skill/workflow/story/step null |
| Non-BMAD prompt | `UserPromptSubmit`, prompt `fix this bug` | `llm_state='active'` + `llm_state_since`; skill fields untouched |
| Timer start | first `UserPromptSubmit` of the session | `started_at` set at that prompt; before it, the timer widget renders empty |
| Monitor listing | status file `skill: null` + live `.alive-{sid}` | Session listed and navigable; tab label = first 8 chars of session id |
| Missing cwd | `payload.cwd` absent | Silent `process.exit(0)` (unchanged) |
| Upgrade | settings.json has bmad `UserPromptSubmit` matcher `(?:bmad\|gds\|wds)[:-]` | Rewritten in place to `''`; entry count unchanged |

</frozen-after-approval>

## Code Map

- `src/hook/bmad-hook.js` -- §4 guard (L109-121) → detection; `handleUserPrompt` (L225-269) gains the `started_at` anchor
- `src/defaults.js` -- `getHookConfig()` L30-32, `UserPromptSubmit` matcher
- `src/install.js` -- `installTarget5()`; the SessionStart `'resume' → ''` block (L196-205) is the precedent to mirror
- `src/tui/monitor/monitor-utils.js` -- `pollSessions()` L45 skill filter; new `sessionLabel()` export
- `src/tui/monitor/components/SessionTabs.js` -- L31 label fallback (currently a full session UUID)
- `test/hook.test.js` -- L2190 "walk-up exits silently when depth exceeds 20" must assert the opposite

## Tasks & Acceptance

**Execution:**
- [x] `src/hook/bmad-hook.js` -- §4: on walk-up failure (fs root or depth > 20) break with `foundBmad = false` and keep `cwd = payload.cwd`; assign `cwd = bmadRoot` only when found -- gate becomes detection, BMAD path resolution preserved
- [x] `src/hook/bmad-hook.js` -- `handleUserPrompt`: set `status.started_at = now` when absent, before the skill-detection block -- the timer must start at the session's first prompt; `formatTimer(null)` returns `''`, so it would otherwise stay blank in sessions that never run a BMAD skill
- [x] `src/defaults.js` -- `UserPromptSubmit` matcher → `''` -- LLM state must go `active` on any prompt, including tool-free replies
- [x] `src/install.js` -- in `installTarget5`, before the merge loop, rewrite any bmad-hook `UserPromptSubmit` entry whose matcher is `(?:bmad|gds|wds)[:-]` to `''` -- prevents a duplicate hook entry on upgrade
- [x] `src/tui/monitor/monitor-utils.js` -- drop `if (!status.skill) continue`; export `sessionLabel(session)` = `workflow || skill || sessionId.slice(0, 8)` -- lists non-BMAD sessions with a readable tab
- [x] `src/tui/monitor/components/SessionTabs.js` -- use `sessionLabel(s)` for `baseLabel` -- avoids a full-UUID tab
- [x] `test/hook.test.js` -- rewrite the depth-limit test to assert a status file **is** created (`project` = basename, skill null); add non-BMAD coverage for `UserPromptSubmit`, `Bash` history and `started_at`; keep a BMAD walk-up regression test
- [x] `test/defaults.test.js`, `test/install.test.js` -- assert matcher `''` and the in-place upgrade (legacy matcher rewritten, no duplicate)
- [x] `test/tui-monitor.test.js` -- assert a skill-less session is listed by `pollSessions`, and `sessionLabel` falls back to the 8-char id
- [x] `_bmad-output/project-context.md` -- update Pattern 0, the SessionStart/SessionEnd notes and the hook-config block to describe detection instead of a `_bmad/` gate -- it is the agent contract

**Acceptance Criteria:**
- Given a session with no `_bmad/` anywhere up-tree, when any tracked hook event fires, then `status-{sid}.json` exists with non-null `project` and null `skill`.
- Given that session, when the status line renders, then `bmad-project`, `bmad-llmstate`, `bmad-timer`, `bmad-contextpct`, `bmad-weeklyusage`, `bmad-fileread`, `bmad-filewrite` produce output while `bmad-workflow`, `bmad-activeskill`, `bmad-story`, `bmad-progressstep`, `bmad-nextstep`, `bmad-docname` render empty.
- Given the monitor is open, when a non-BMAD session is live, then it appears under its project tab with a working file tree, bash section and LLM badge.
- Given an existing installation, when `npx bmad-statusline install` is re-run, then settings.json holds exactly one bmad `UserPromptSubmit` entry, matcher `''`.
- Given the repository, when `npm test` runs, then every test passes.

## Spec Change Log

### 2026-08-09 — review round 1 (blind hunter + edge case hunter + acceptance auditor)

Human chose to amend in place rather than revert and re-derive.

**1. intent_gap — auto-allow blast radius (human decision required).** With the hook no longer exiting outside BMAD projects, `handlePermissionRequest` became reachable everywhere, so a user's global `config.autoAllow` would have auto-approved every tool in every directory. Not covered by the frozen Intent. **Human decision: remove the auto-allow feature entirely** — Claude Code now ships its own auto-permission system. Removed `isAutoAllowEnabled`, the allow-decision branch, `AutoAllowMenu.js`, the monitor `a` shortcut and indicator, and all their tests. The hook now only ever *observes* PermissionRequest. Known-bad state avoided: a silent, machine-wide widening of tool auto-approval on upgrade.

**2. Frozen "Always"/"Never" bullets and AC2 are factually inaccurate — code kept, docs corrected.** The frozen block claims `skill`, `workflow`, `story`, `step.*` and `document_name` "stay null" outside BMAD, and that `document_name` "never matches". False: every detector resolves against `cwd`, and outside BMAD `cwd === payload.cwd`. `skill`/`workflow`/`story` are prompt-derived; `step.*`/`active_skill` match `.claude/skills/{skill}/steps*/` under cwd; `document_name` matches the `_outputFolders` fallbacks (`design-artifacts/`, `_bmad-output/…`) under cwd. This is *absence of a match*, not suppression — and the populated behavior is correct (a bmad workflow run outside a BMAD project should still report step and document). No code change; `project-context.md` rewritten to state the real rule. The frozen bullets are left as written and superseded by this entry.

**3. patch — incomplete matcher migration.** The rewrite matched only `'(?:bmad|gds|wds)[:-]'`; an earlier release shipped `'(?:bmad|gds|wds)-'`, so those users would have gained a second entry and double-fired the hook (the concurrent-write race that wipes widget state). The SessionStart copy had the same hole plus no dedupe. Both now go through one shared `widenBmadMatchers(entries)` helper that widens any non-empty bmad matcher and drops the redundant entry when a wildcard already exists.

**4. patch — monitor robustness.** Removing the `!status.skill` filter also removed the implicit throw that rejected a status file containing `null`; added an explicit shape check. `started_at`-less sessions sorted to position 0 and could evict established sessions at the `MAX_SESSIONS` cut; they now sort last.

**5. patch — misc.** `basename` of a filesystem-root cwd is `''`, which left `project` falsy and rewrote the status file on every event; now falls back to `'root'`. Stale `_bmad guard` comments corrected. `project-context.md`: Pattern 0 was missing the §3b Early-SessionEnd block, the "every event uses the empty matcher" rule contradicted PostToolUse's four tool matchers, the UserPromptSubmit truth-table row omitted the `started_at` anchor, and four unbacked "v1.7" version claims were dropped (`package.json` is still `1.6.0`).

**KEEP on any re-derivation:** the walk-up must stay *in place* between stdin parsing and `touchAlive` (source-order test); `cwd = bmadRoot` only when found; the reader untouched; `started_at` anchored in `handleUserPrompt` (never at §5b bootstrap) so the skill-change branch still re-anchors it; one shared matcher-widening helper, never a per-event copy.

## Design Notes

§4 keeps its shape so the entry-point structure test and BMAD path semantics both survive:

```js
let bmadRoot = cwd, walkDepth = 0, foundBmad = true;
const MAX_WALK_DEPTH = 20;
while (!fs.existsSync(path.join(bmadRoot, '_bmad'))) {
  const parent = path.dirname(bmadRoot);
  if (parent === bmadRoot || ++walkDepth > MAX_WALK_DEPTH) { foundBmad = false; break; }
  bmadRoot = parent;
}
if (foundBmad) cwd = bmadRoot; // else keep payload.cwd — non-BMAD session
```

The timer anchor is `handleUserPrompt`, not §5b bootstrap: `started_at` is filled on the session's first prompt, and the existing skill-change branch (`status.skill !== skillName`) still overwrites it when a BMAD workflow starts. BMAD timing is therefore byte-for-byte unchanged — a `/bmad-dev-story` prompt resets `started_at` whether or not an earlier plain prompt set it first.

This makes the matcher widening load-bearing: with the old `(?:bmad|gds|wds)[:-]` matcher, `handleUserPrompt` never fires outside BMAD and `started_at` would stay null forever.

## Verification

**Commands:**
- `npm test` -- expected: all test files pass, no failures

**Manual checks:**
- After `npx bmad-statusline install`, open Claude Code in a directory with no `_bmad/` and submit a prompt: status line shows project + LLM state + timer + context %; the monitor lists the session.
- `~/.claude/settings.json`: exactly one bmad `UserPromptSubmit` entry, matcher `""`.

## Suggested Review Order

**The core inversion — gate becomes detection**

- Entry point: the walk-up now records whether `_bmad/` exists instead of exiting.
  [`bmad-hook.js:92`](../../src/hook/bmad-hook.js#L92)

- `cwd` is only rewritten to `bmadRoot` on a hit; otherwise `payload.cwd` stands.
  [`bmad-hook.js:107`](../../src/hook/bmad-hook.js#L107)

- Project falls back to the cwd basename, with a guard for a rootless cwd.
  [`bmad-hook.js:147`](../../src/hook/bmad-hook.js#L147)

**Timer anchor**

- `started_at` is set on the session's first prompt; the skill-change branch still re-anchors it.
  [`bmad-hook.js:228`](../../src/hook/bmad-hook.js#L228)

**Every prompt must reach the hook**

- Matcher widened to `''` — required for both `llm_state` and the timer anchor.
  [`defaults.js:31`](../../src/defaults.js#L31)

- Shared widening helper: rewrites in place, drops redundant duplicates, no per-event copies.
  [`install.js:170`](../../src/install.js#L170)

- Both SessionStart and UserPromptSubmit now upgrade through that one helper.
  [`install.js:226`](../../src/install.js#L226)

**Permission handling — auto-allow removed**

- The hook only observes PermissionRequest; it never emits an allow decision.
  [`bmad-hook.js:686`](../../src/hook/bmad-hook.js#L686)

**Monitor lists every session**

- Skill filter dropped; an explicit shape check replaces the guard it implicitly provided.
  [`monitor-utils.js:45`](../../src/tui/monitor/monitor-utils.js#L45)

- Unanchored sessions sort last so they cannot evict established ones at the cap.
  [`monitor-utils.js:53`](../../src/tui/monitor/monitor-utils.js#L53)

- Single source for tab labels, falling back to a short session id.
  [`monitor-utils.js:110`](../../src/tui/monitor/monitor-utils.js#L110)

- Tab rendering consumes that helper instead of re-deriving the label.
  [`SessionTabs.js:31`](../../src/tui/monitor/components/SessionTabs.js#L31)

**Supporting changes**

- Non-BMAD coverage: tracking past the depth limit, timer anchoring, bash history.
  [`hook.test.js:2189`](../../test/hook.test.js#L2189)

- Migration coverage: older matcher, duplicate collapse, foreign wildcard left alone.
  [`install.test.js:519`](../../test/install.test.js#L519)

- Agent contract updated: detection, matcher rule, auto-allow removal.
  [`project-context.md:54`](../project-context.md#L54)
