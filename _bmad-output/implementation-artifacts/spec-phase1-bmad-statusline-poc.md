---
title: 'Phase 1 PoC - bmad-statusline reader, CLAUDE.md instruction, ccstatusline config'
type: 'feature'
created: '2026-03-28'
status: 'done'
baseline_commit: 'NO_VCS'
context: ['_bmad-output/brainstorming/brainstorming-session-2026-03-28-001.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** No visibility on which BMAD workflow, agent, or step is active in a Claude Code terminal. Multi-terminal users can't tell sessions apart at a glance.

**Approach:** Create a Node.js reader script that extracts fields from per-session status files, a CLAUDE.md instruction block so BMAD agents write those status files, and an example ccstatusline config wiring custom-command widgets to the reader.

## Boundaries & Constraints

**Always:**
- Pure Node.js, zero external dependencies
- Return empty string on any error (missing file, bad JSON, missing field)
- Create `~/.cache/bmad-status/` if absent
- Piggybacking cleanup: touch `.alive-{session_id}`, purge stale `.alive-*` > 5 min + their `status-*.json`

**Ask First:**
- Any change to the status file JSON schema beyond what the brainstorming defines
- Adding fields or commands not listed in scope

**Never:**
- No TUI, no install/uninstall commands (Phase 2)
- No npm package structure or publishing
- No dynamic colors (Phase 2)
- No external dependencies

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path | stdin: `{"session_id":"abc123",...}`, argv[1]: `project` | stdout: `Toulou` | N/A |
| Array field | argv[1]: `agent` | stdout: `Amelia, Bob` (comma-joined) | N/A |
| Composite field | argv[1]: `compact` | stdout: `Toulou · dev-story · 2-1 · 3/6 implementation` | N/A |
| Timer field | argv[1]: `timer` | stdout: `12m` (diff from started_at) | N/A |
| Progress bar | argv[1]: `progressbar` | stdout: `▰▰▰▱▱▱` (filled/empty by completed/total) | N/A |
| Story|Request | argv[1]: `story` with story=null | stdout: `` (empty) | N/A |
| Missing status file | No `status-{session_id}.json` exists | stdout: `` (empty) | Silent, return empty |
| Corrupt JSON | Status file has invalid JSON | stdout: `` (empty) | Silent, return empty |
| Missing field | argv[1]: `story`, field is null | stdout: `` (empty) | Silent, return empty |
| No stdin JSON | stdin empty or invalid | stdout: `` (empty) | Silent, return empty |
| Unknown command | argv[1]: `foobar` | stdout: `` (empty) | Silent, return empty |
| Cleanup | `.alive-old` older than 5 min | Delete `status-old.json` + `.alive-old` | Ignore delete errors |

</frozen-after-approval>

## Code Map

- `bmad-sl-reader.js` -- Main reader script, entry point for ccstatusline custom-command widgets
- `.claude/CLAUDE.md` -- BMAD Status Tracking instruction block for agents
- `ccstatusline-config-example.json` -- Example ccstatusline settings for `~/.config/ccstatusline/settings.json`

## Tasks & Acceptance

**Execution:**
- [x] `bmad-sl-reader.js` -- Create Node.js script: parse stdin JSON, extract session_id, read status file, return requested field. Support all 15 commands (project, workflow, agent, step, nextstep, progress, progressbar, progressstep, story, request, document, timer, compact, full, minimal). Implement piggybacking cleanup (.alive touch + stale purge).
- [x] `.claude/CLAUDE.md` -- Create with BMAD Status Tracking instruction block: session_id discovery, status file schema, update rules, timing guidance.
- [x] `ccstatusline-config-example.json` -- Create example config with line 2 layout: [Project] [Agent] [Workflow] [Story] [Request] [ProgressStep], 6 custom-command widgets pointing to bmad-sl-reader (Story and Request are separate widgets — ccstatusline has no conditional display, the empty one is hidden).

**Acceptance Criteria:**
- Given a valid status file exists, when `echo '{"session_id":"abc"}' | node bmad-sl-reader.js project`, then stdout is the project value
- Given no status file exists, when any command is run, then stdout is empty string (no error)
- Given a corrupt status file, when any command is run, then stdout is empty string (no error)
- Given argv[1] is `compact`, when run with a valid status file, then stdout shows dot-separated composite
- Given stale `.alive-*` files exist (>5 min), when script runs, then stale files and their status files are deleted

## Design Notes

**Command dispatch:** Simple object map from command name to extractor function. Each extractor receives the parsed status object and returns a string.

**Composite widgets format:**
- `compact`: `{project} · {workflow} · {story|request} · {progressstep}`
- `full`: `{project} · {workflow} · {story|request} · {progress} · -> {nextstep}`
- `minimal`: `{workflow} · {progressstep}`

**Progress bar:** Uses `▰` (filled) and `▱` (empty) characters, length = step.total.

**Timer:** Diff `now - started_at` in minutes. Format: `<60` → `Xm`, `>=60` → `Xh Ym`.

## Verification

**Commands:**
- `echo '{"session_id":"test123"}' | node bmad-sl-reader.js project` -- expected: empty (no status file)
- `node -e "require('fs').mkdirSync(require('os').homedir()+'/.cache/bmad-status',{recursive:true}); require('fs').writeFileSync(require('os').homedir()+'/.cache/bmad-status/status-test123.json', JSON.stringify({session_id:'test123',project:'Toulou',workflow:'quick-dev',agent:['Amelia'],step:{current:'step-03',current_name:'implementation',completed:3,total:6},started_at:new Date().toISOString()}))" && echo '{"session_id":"test123"}' | node bmad-sl-reader.js project` -- expected: `Toulou`
- `echo '{"session_id":"test123"}' | node bmad-sl-reader.js agent` -- expected: `Amelia`
- `echo '{"session_id":"test123"}' | node bmad-sl-reader.js progressbar` -- expected: `▰▰▰▱▱▱`

**Manual checks:**
- CLAUDE.md contains session_id discovery command and status file schema
- ccstatusline-config-example.json contains 6 custom-command widgets on line 2

## Suggested Review Order

- Point d'entrée : dispatch des 15 commandes et flow principal stdin → status → stdout
  [`bmad-sl-reader.js:90`](../../bmad-sl-reader.js#L90)

- Extracteurs de champs simples et composites (compact/full/minimal)
  [`bmad-sl-reader.js:60`](../../bmad-sl-reader.js#L60)

- Piggybacking cleanup : touch alive + purge stale > 5 min
  [`bmad-sl-reader.js:37`](../../bmad-sl-reader.js#L37)

- Instructions agents : découverte session_id et schéma JSON du status file
  [`CLAUDE.md:1`](../../.claude/CLAUDE.md#L1)

- Config exemple : 6 widgets custom-command sur ligne 2
  [`ccstatusline-config-example.json:1`](../../ccstatusline-config-example.json#L1)
