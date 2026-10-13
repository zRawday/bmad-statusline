---
title: 'AutoBlend module support: skill recognition and current job in the Document widget'
type: 'feature'
created: '2026-10-13'
status: 'done'
baseline_commit: '9711a139f0c761dbf78ac1b0e15cdb3195e243cd'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/project-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** AutoBlend skills (`bmad-autoblend-*`) have no color and no catalog entry, and a skill the model launches itself through the Skill tool (a natural-language request such as "conduis le job zouzou", or a conductor routing to a specialist) never reaches the hook, so the Active Skill widget stays empty in most AutoBlend sessions. The job being conducted is displayed nowhere.

**Approach:** Make the hook record Skill tool calls as the **active** skill (the initial skill stays the typed command only — two widgets, two detections, by design), register AutoBlend in the color map and the TUI skill catalog with one distinct color per skill, and write the current job id into `document_name` (the Document widget) while an AutoBlend job skill is running.

## Boundaries & Constraints

**Always:** The hook stays CommonJS, zero-dependency, synchronous, silent, with one `writeStatus` per event. A job id is displayed only when `<project>/jobs/<id>/job.json` exists. Every non-Skill `PreToolUse` behaves exactly as today. Files stay LF.

**Never:** Let a Skill tool call set or reset the initial skill (`skill`, `workflow`, `started_at`, histories): Initial Skill = typed command, Active Skill = invoked skill. Merge the Document and Story widgets (deferred). Change widget ids, defaults, the saved config schema, the installer or the hook matchers (`PreToolUse` matcher `''` already delivers Skill calls). Parse `_bmad/config.toml`. Show a job outside job mode. Let a subagent's Skill call change skill fields. Change the Read-based active-skill detection.

## I/O & Edge-Case Matrix

"Job skill" = name starts with `autoblend-` and is not `autoblend-version`. "Job mode" = `active_skill || workflow` is a job skill AND `workflow` is null or itself a job skill. Job `zouzou` exists; `mesures` does not.

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Skill tool, no workflow | `PreToolUse`, `tool_name: 'Skill'`, `tool_input: {skill: 'bmad-autoblend-builder', args: 'conduis le job zouzou'}`, `workflow=null` | `active_skill='autoblend-builder'`; `skill`, `workflow`, `started_at` stay null; `document_name='zouzou'`; `llm_state='active'` | N/A |
| Skill tool, other workflow set | `workflow='autoblend-builder'`, Skill `bmad-autoblend-supports` | `workflow`/`skill` unchanged, `active_skill='autoblend-supports'` | N/A |
| Skill tool, same as workflow | Skill `bmad-autoblend-builder` again | `active_skill=null` | N/A |
| Typed command after a Skill call | `active_skill='autoblend-builder'`, prompt `/bmad-autoblend-modifier` | `workflow='autoblend-modifier'`, `active_skill=null` (today's reset) | N/A |
| Skill from a subagent | payload carries `agent_id` | only `llm_state='active'` | N/A |
| Foreign or malformed skill | `skill: 'update-config'`, missing, or non-string | only `llm_state='active'` | never throws |
| Namespaced skill | `skill: 'plugin:bmad-help'` | treated as `bmad-help` | N/A |
| Typed command with job | prompt `/bmad-autoblend-builder zouzou` | `document_name='zouzou'` | N/A |
| Bash in job mode | `workflow=null`, `active_skill='autoblend-builder'`, `python outils/ouvrir_une_porte.py --repertoire out/zouzou --job jobs/zouzou/job.json` | `document_name='zouzou'` | N/A |
| Bash, no real job | `out/rejeu-corpus.json`, `out/mesures/x.json`, `jobs/../x` | `document_name` unchanged | N/A |
| Bash, two jobs | command names `jobs/zouzou` then `jobs/dragon` (both exist) | last valid wins: `dragon` | N/A |
| Bash outside job mode | `workflow='build'` with `active_skill='autoblend-reglages'`; or current skill `autoblend-version`; command names `jobs/zouzou` | unchanged | N/A |
| File event in job mode | Read/Write/Edit of `out/zouzou/manifeste.json` | `document_name='zouzou'` | N/A |
| Output-folder write in job mode | Write `_bmad-output/x/registre.md` | `document_name` keeps the job | N/A |
| Colors | `autoblend-` + `builder` / `modifier` / `decrire` / `forme-couleurs` / `ligne` / `supports` / `reglages` / `livraison` / `montrer` / `version` | brightCyan / cyan / yellow / magenta / brightMagenta / blue / brightBlue / green / brightGreen / brightYellow; any other `autoblend-*` → brightGreen; `skillColors` override wins | N/A |

</frozen-after-approval>

## Code Map

- `src/hook/bmad-hook.js` -- `:24` SKILL_REGEX; `:212` PreToolUse dispatch (today `setLlmState('active')` for every tool); `:247-328` handleUserPrompt (typed skill start and reset block `:280-298`, unchanged in behavior); `:332` beginFileEvent (single entry for Read/Write/Edit, knows `inProject`); `:618` handleBash; `:642` setLlmState; `:668-672` detectDocumentAndStep with the story-workflow exclusion to extend.
- `src/reader/workflow-colors.cjs` -- `:6` WORKFLOW_COLORS (explicit per-skill codes), `:95` WORKFLOW_PREFIX_COLORS. Reader needs no change: `getWorkflowColor` (`bmad-sl-reader.js:61`) already resolves both, `activeskill` (`:373`) already shows `active_skill || workflow` when no initial skill is set, `docname` (`:383`) prints `document_name` verbatim.
- `src/tui/skill-catalog.js` -- SKILL_MODULES, consumed by `SkillColorsScreen.js` and `monitor-utils.js:119` resolveSessionColor.
- `src/tui/widget-registry.js:11` -- Document widget hint.
- `README.md:20-24` -- feature bullets.
- `test/hook.test.js` -- fixtures `:17-90`, `execHook :93`, `readStatusFile :106`, `seedStatus :112`, `makeUserPromptPayload :129`, `makeBashPayload :1917`; document tests `:1775-1900`; PreToolUse tests `:1988`. `test/reader.test.js:86-95,771`, `test/tui-monitor.test.js:500`.
- Verified payload shape (real transcripts): `tool_input: { skill: 'bmad-build', args: '…' }`, `args` optional.

## Tasks & Acceptance

**Execution:**
- [x] `src/hook/bmad-hook.js` -- add a Skill-tool handler on `PreToolUse` (strip any `ns:` prefix, require the SKILL_REGEX prefixes, ignore payloads with `agent_id`; set `active_skill` to the invoked name, or null when it equals `workflow`; never touch `skill`/`workflow`/`started_at`); add `isJobSkill`, `isJobMode(status)` and `detectJob(status, text)`; call `detectJob` on launch arguments (typed prompt remainder, Skill `args`), on the full Bash command, and on in-project file-event paths; skip document detection in job mode -- recognition and job display.
- [x] `src/reader/workflow-colors.cjs` -- add the ten explicit `autoblend-*` entries of the Colors row to WORKFLOW_COLORS and `{ prefix: 'autoblend-', color: '\x1b[92m' }` to WORKFLOW_PREFIX_COLORS -- distinct colors, future skills still colored.
- [x] `src/tui/skill-catalog.js` -- add module `{ id: 'autoblend', name: 'AutoBlend' }` listing the same ten skills with the same colors -- per-skill color editing in the TUI and monitor colors.
- [x] `src/tui/widget-registry.js` -- Document hint becomes `'Output-folder file, or AutoBlend job'`.
- [x] `README.md` -- name AutoBlend in the catalog bullet and the job in the Document widget.
- [x] `test/hook.test.js`, `test/reader.test.js`, `test/tui-monitor.test.js` -- one test per matrix row (add `jobs/zouzou/job.json`, `jobs/dragon/job.json` and a `bmad-autoblend-builder` skill dir to the fixtures); per-skill and prefix colors; catalog defaults equal to the color map.

**Acceptance Criteria:**
- Given the full suite, when `npm test` runs, then every pre-existing test passes unmodified and the new ones pass.
- Given the ten AutoBlend skills, when the catalog default and the reader color of each are compared, then they name the same color.

## Implementation Notes

- "Candidates at 10 per event" is applied to distinct path-token ids (the 11th new id stops the scan); the free-text bare-word scan has its own 30-word limit. Both share one existence cache, so a repeated token costs one stat.
- A trailing `.` is stripped from a candidate id before the existence check ("conduis le job zouzou." names `zouzou`; Windows ignores trailing dots in paths, so without this `zouzou.` would pass there only).
- Job mode is evaluated at the moment of each event; leaving job mode (e.g. a later Skill call to a non-job skill) does not clear a `document_name` already set — it just stops being updated.
- `detectJob` also runs on a Skill call's `args` (path tokens + bare words) whenever the call leaves the session in job mode.
- Not touched (outside the spec): `_bmad-output/project-context.md` still describes PreToolUse as "Always set llm_state=active".

## Spec Change Log

- 2026-10-13, before implementation completed, human renegotiation (not a review loop). Trigger: Fred rejected two planning decisions. Amended: (1) a Skill tool call no longer becomes the initial skill when none is set — it only ever sets `active_skill`; job gating moved from "initial workflow" to "job mode"; (2) one shared green replaced by one color per AutoBlend skill. Avoids: blurring the Initial Skill / Active Skill widgets, which are two deliberate detections. KEEP: job detection from Bash commands with the `jobs/<id>/job.json` existence check; no installer change.

## Review Triage Log

Pass 1 (2026-10-13). Layers: blind (B), edge-case (E), verification-gap (G gaps, O other findings). No intent_gap, no bad_spec; patches applied by the implementation subagent, then `npm test` 822/822.

- B1 Monitor hides sessions without a typed skill, Timer empty there -- medium -- real: `monitor-utils.js:59` `if (!session.skill) continue;`, `started_at` set by typed commands only; pre-existing, those sessions were already skill-less -- defer.
- B2 `includes('builder')` guard also catches `autoblend-builder` -- low -- real (Read-based detection off in a typed builder session); the Skill-tool path covers it and the frozen Never forbids touching that detection -- rejected.
- B3 two writers of `active_skill`, no interplay test -- low -- real -- patch: single `setActiveSkill` helper, tests for Skill and Read transitions.
- B4 `active_skill` never cleared, job mode hangs on it, retyping the same command does not recover -- medium -- real -- patch: a typed command always resets `active_skill`; the job is cleared on leaving job mode. No "skill finished" signal exists; residual accepted.
- B5 previous job kept when a launch names an unknown job; stale file name on entering job mode -- low -- second half real, patch (cleared on entering); first half rejected: a specialist launched without a job name must keep the job (G1).
- B6 active skill recorded before the call runs, no rollback; fixture unused -- low -- real; rollback needs extra state for a rare case, rejected; fixture now used by the slash-less test (O4).
- B7 Bash scanned on PostToolUse only -- medium -- real: nothing shown during a long build, failed commands never scanned -- patch: PreToolUse scan of `tool_input.command`.
- B8 subagent Bash/file events change the job while subagent Skill calls are ignored -- low -- real; delegated work names the same job, parallel subagents on different jobs unlikely -- rejected.
- B9 no priority between job signals -- low -- real, self-corrects at the next command naming the conducted job (real session: `out/zouzou` ×129 vs one stray mention) -- rejected.
- B10 case-insensitive match keeps the typed casing; bare-word false positives -- low -- real on Windows, cosmetic until the next command; fix is a rewrite of the lookup -- rejected.
- B11 id capture has no terminator (`zouzou~1`) -- low -- real, negligible -- rejected.
- B12 path-token boundary too narrow and too wide; no backslash test -- low -- narrow half real, patch (lookbehind, backslash test); wide half rejected: every id is validated against this project's `jobs/`, worktree paths are wanted.
- B13 prefix fallback color equals `autoblend-montrer`; Monitor shows white for an uncatalogued skill -- low -- real; twelve usable colors, any fallback collides; one catalog line when a skill is added -- rejected.
- B14 color table copied in four places -- low -- real duplication, the parity test guards the two sources -- rejected.
- B15 test gaps (30th word, args cap, precedence, sequences) -- low -- real -- patch for precedence, non-string command and transition sequences; exact 30th-word boundary not added.
- B16 AutoBlend layout hard-coded; `project-context.md` stale; README silent on default-off -- low -- layout is the module's own constraint (by design, rejected); `project-context.md` is agent context -- defer; README notes rejected.
- E1 subagent events flip the job -- low -- same as B8 -- rejected.
- E2 non-job Skill call turns job mode off for the session -- medium -- same root as B4, patched there; the proposed redefinition of job mode edits the frozen definition -- rejected.
- E3 Skill call entering or leaving job mode keeps `document_name` -- medium -- real (stale job outside job mode breaks the Never rule) -- patch.
- E4 denied or failed Skill call leaves the active skill -- low -- same as B6 -- rejected.
- E5 casing on case-insensitive filesystems -- low -- same as B10 -- rejected.
- E6 4000-char cut can split an id into a shorter valid one -- low -- real, direct fix -- patch.
- E7 nested or foreign `…/out/<id>` tokens -- low -- same as B12 wide half -- rejected.
- E8 token behind `>`, `;`, `|` never detected -- low -- real -- patch (lookbehind).
- E9 follow-up prompt naming a job not detected -- low -- real; corrected when the next command starts -- rejected.
- E10 job directory named like an ordinary word -- low -- unlikely -- rejected.
- E11 Monitor drops model-launched sessions -- medium -- same as B1 -- defer.
- E12 Monitor color for an uncatalogued skill -- low -- same as B13 -- rejected.
- E13 job never shown when a non-job skill was typed before a model-launched job skill -- false as a defect: this is the frozen job-mode definition (keeps dev sessions out) and was stated to the human.
- G1 Skill call without args must keep the job -- pre-verified -- patch (test).
- G2 job-skill workflow with non-job active skill not pinned -- pre-verified -- patch (test).
- G3 retyping the same command with another job not asserted -- pre-verified -- patch (test).
- G4 only the upper edge of the 4000-char window tested -- pre-verified -- patch (test).
- G5 path-token rules no test distinguishes -- pre-verified -- patch (tests).
- O1 Monitor hides model-launched sessions -- carried B1 -- defer.
- O2 `active_skill` never cleared in AutoBlend sessions -- carried B2/B4.
- O3 only Bash commands scanned (PowerShell never) -- medium -- real: no PostToolUse matcher for other shells -- patch (PreToolUse scan).
- O4 fixture skill dir exercised by no test -- low -- real -- patch (slash-less launch test).

## Design Notes

Job mode requires `workflow` to be null or a job skill: dev sessions (typed `build`) read AutoBlend skill files, which sets `active_skill` to an `autoblend-*` value, and run tools on `jobs/zouzou` as a fixture; without that clause a job would show in those sessions.

Real job sessions name the job almost only in Bash commands (`out/zouzou` ×129, zero Read/Write), hence command scanning:

```js
// path tokens anywhere in the text; accepted only if jobs/<id>/job.json exists; last accepted wins
const JOB_PATH_REGEX = /(?:^|[\s"'=(/\\])(?:jobs|out)[/\\]([A-Za-z0-9][\w.-]*)/g;
```

Launch arguments are free text ("conduis le job zouzou"): besides path tokens, test the first 30 bare words (`[A-Za-z0-9][\w.-]*`) against the same existence check, first hit wins. Cap scanned text at 4000 chars and candidates at 10 per event.

## Verification

**Commands:**
- `npm test` -- expected: all tests pass, 0 failures.
- `git ls-files --eol src/hook/bmad-hook.js src/reader/workflow-colors.cjs src/tui/skill-catalog.js src/tui/widget-registry.js README.md` -- expected: `w/lf` on every line.
