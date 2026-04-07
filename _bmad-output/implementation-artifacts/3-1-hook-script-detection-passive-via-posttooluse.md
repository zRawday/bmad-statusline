# Story 3.1: Hook Script — Detection Passive via PostToolUse

Status: done

## Story

As a **developer using BMAD workflows**,
I want **a PostToolUse hook that passively detects workflow, step, and story changes from Claude Code events**,
So that **my BMAD status is tracked automatically with zero LLM friction**.

## Acceptance Criteria

1. **Skill event — trackable workflow detection:** Given a Skill event with `tool_input.skill = "bmad-create-architecture"`, when `{cwd}/.claude/skills/bmad-create-architecture/steps/` exists and no active workflow is set, then status sets `workflow: "create-architecture"`, `step.total` to count of `step-*.md` files, `started_at` to now.

2. **Skill event — same workflow preserves started_at:** Given active workflow is already `create-architecture`, when the hook receives a new Skill event for `bmad-create-architecture`, then `started_at` is preserved (not reset).

3. **Skill event — non-trackable skill ignored:** Given a Skill event with `tool_input.skill = "bmad-help"`, when `{cwd}/.claude/skills/bmad-help/steps/` does NOT exist, then the hook ignores the event entirely and preserves current status.

4. **Read event — step detection:** Given active workflow `create-architecture`, when Read event for `{cwd}/.claude/skills/bmad-create-architecture/steps/step-03-starter.md`, then status sets `step.current: 3`, `step.current_name: "starter"`, derives `step.next: 4`, `step.next_name` from next file in steps listing.

5. **Read event — last step (next = null):** Given active workflow with 8 steps, when Read event for last step (`step-08-*.md`), then status sets `step.current: 8`, `step.next: null`, `step.next_name: null`.

6. **Read event — wrong workflow step ignored:** Given active workflow `create-architecture`, when Read event for a step file in a DIFFERENT skill's steps directory, then the hook ignores the event.

7. **Read event — story detection (gated):** Given active workflow `dev-story`, when Read event for a stories file, then status sets `story` to slug from filename.

8. **Read event — story ignored in non-story workflow:** Given active workflow `create-architecture` (not in story-tracking list), when Read event for a stories file, then the hook ignores the event.

9. **Read event — project from config.yaml:** Given Read event for `_bmad/bmm/config.yaml`, when content contains `project_name: 'Toulou'`, then status sets `project: "Toulou"` with zero additional I/O.

10. **Guard — non-BMAD project:** Given any event, when `{cwd}/_bmad/` does not exist, then silent exit (no output, no status write).

11. **Guard — non-BMAD Read path:** Given a Read event for any non-BMAD path, when path doesn't match any detection pattern, then silent exit.

12. **Status file creation:** Given no status file for current session, when first BMAD event fires, then creates `~/.cache/bmad-status/status-{session_id}.json` with defaults and `mkdirSync(CACHE_DIR, { recursive: true })`.

13. **Status file merge:** Given existing status file, when new event fires, then reads existing, merges only changed fields, writes back, sets `updated_at` to current ISO 8601.

14. **Malformed stdin:** Given stdin contains malformed JSON, when hook attempts parse, then exits silently with exit code 0, no stdout/stderr output.

15. **Path normalization:** Given `tool_input.file_path` uses forward slashes and `cwd` uses backslashes, when hook processes paths, then all normalized to forward slashes before pattern matching.

16. **BMAD_CACHE_DIR override:** Given env var `BMAD_CACHE_DIR` is set, when hook writes status, then uses env var path instead of default.

17. **Entry point structure:** Given hook source code, when inspected, then follows: Requires > Constants > Stdin parsing > Guard > Dispatch > Handlers > Status helpers > Main.

## Tasks / Subtasks

- [x] Task 1: Create `src/hook/` directory structure (AC: #17)
  - [x] Create `src/hook/package.json` with `{ "type": "commonjs" }` (CJS marker, same pattern as `src/reader/package.json`)
  - [x] Create `src/hook/bmad-hook.js` skeleton following prescribed entry point structure

- [x] Task 2: Implement stdin parsing + guards (AC: #10, #11, #14, #15)
  - [x] `fs.readFileSync(0, 'utf8')` + `JSON.parse` in try/catch — silent exit on failure
  - [x] Path normalize helper: `function normalize(p) { return p.replace(/\\/g, '/'); }`
  - [x] Guard: `fs.existsSync(path.join(cwd, '_bmad'))` — silent exit if absent
  - [x] Dispatch: branch on `payload.tool_name` (Skill / Read / else exit)

- [x] Task 3: Implement status file helpers (AC: #12, #13, #16)
  - [x] `CACHE_DIR` from `process.env.BMAD_CACHE_DIR || path.join(os.homedir(), '.cache', 'bmad-status')`
  - [x] `readStatus(sessionId)` — read existing or return defaults object
  - [x] `writeStatus(sessionId, status)` — set `updated_at`, `JSON.stringify(null, 2)`, write
  - [x] `mkdirSync(CACHE_DIR, { recursive: true })` on first write

- [x] Task 4: Implement handleSkill (AC: #1, #2, #3)
  - [x] Extract skill name from `payload.tool_input.skill`
  - [x] Strip `bmad-` prefix: `skill.startsWith('bmad-') ? skill.slice(5) : skill`
  - [x] Check trackable: `fs.existsSync(stepsDir)` where `stepsDir = path.join(cwd, '.claude', 'skills', skillName, 'steps')`
  - [x] If not trackable: silent exit (preserve current status)
  - [x] If trackable: count `step-*.md` files via `readdirSync + filter`
  - [x] If workflow changed: reset `started_at` to `new Date().toISOString()`
  - [x] If same workflow: preserve `started_at`
  - [x] Update status: `workflow`, `step.total`

- [x] Task 5: Implement handleRead (AC: #4, #5, #6, #7, #8, #9)
  - [x] Normalize `filePath` and `cwd` to forward slashes
  - [x] Step detection regex: `/\/steps\/step-(\d+)-(.+)\.md$/`
  - [x] False positive prevention: validate path starts with `{cwd}/.claude/skills/bmad-{activeWorkflow}/steps/`
  - [x] Derive next step: read steps listing, find next after current
  - [x] Story detection regex: `/\/stories\/(.+)\.md$/`
  - [x] Story gating: only update if workflow is `create-story`, `dev-story`, or `code-review`
  - [x] Config detection: path ends with `_bmad/bmm/config.yaml` — extract `project_name` from `tool_response.file.content` via regex (zero I/O)

- [x] Task 6: Create test suite `test/hook.test.js` (AC: #1-#17)
  - [x] Test fixture setup: temp dir with `_bmad/bmm/config.yaml`, `.claude/skills/bmad-{name}/steps/step-*.md`
  - [x] `BMAD_CACHE_DIR` env var pointing to temp dir
  - [x] Synthetic Skill payload JSON
  - [x] Synthetic Read payload JSON (with `tool_response.file.content`)
  - [x] Tests for each AC using `child_process.execSync` with stdin pipe
  - [x] Clean up temp dirs in `after()` hooks

- [x] Task 7: Create test fixture `test/fixtures/claude-settings-with-hooks.json` (for Story 3.4 prep)

## Dev Notes

### Architecture Compliance

**Module system:** CommonJS (standalone deployed artifact). Create `src/hook/package.json` with `{ "type": "commonjs" }` — same pattern as `src/reader/package.json`. The main package is ESM (`"type": "module"` in root package.json), but hook and reader are standalone CJS scripts deployed to `~/.config/bmad-statusline/`.

**Error handling:** SILENT ALWAYS. No `console.log`, no `console.error`, no throw. Any error = silent exit with code 0. Must never interfere with Claude Code.

**I/O:** Synchronous ONLY. `readFileSync`, `writeFileSync`, `existsSync`, `readdirSync`, `mkdirSync`. Never async/await, never promises, never callbacks. This is load-bearing correctness — synchronous execution guarantees sequential hook invocations see each other's writes.

**Zero dependencies:** Node.js stdlib only (`fs`, `path`, `os`). No npm packages.

### Prescribed Entry Point Structure (Pattern 0)

```
1. Requires (fs, path, os)
2. Constants (CACHE_DIR, normalize helper, STORY_WORKFLOWS)
3. Stdin parsing (readFileSync(0) + JSON.parse in try/catch → silent exit)
4. Guard: _bmad/ existence check → silent exit if absent
5. Dispatch: branch on tool_name (Skill → handleSkill, Read → handleRead, else → exit)
6. handleSkill: extract name → strip bmad- → trackable check → status update
7. handleRead: normalize path → regex match → gate by active workflow → status update
8. Status helpers: readStatus, writeStatus (read-before-write)
9. Main: call sequence
```

### Status File Schema (Hook Output Contract)

```json
{
  "session_id": "<string, from payload>",
  "project": "<string, from config.yaml>",
  "workflow": "<string, stripped skill name>",
  "story": "<string or null>",
  "step": {
    "current": 3,
    "current_name": "starter",
    "next": 4,
    "next_name": "decisions",
    "total": 8
  },
  "started_at": "<ISO 8601 string>",
  "updated_at": "<ISO 8601 string>"
}
```

**Type rules:** `step.current/next/total` are numbers. `story` is null when not set (not empty string). `workflow` is the stripped name (no `bmad-` prefix).

**Removed from old schema:** `agent`, `request`, `document`, `step.completed`. Compare with current `test/fixtures/status-sample.json` which still has the old format.

### Hook Payload Shapes (from spike validation)

**Skill signal:**
```json
{
  "session_id": "b0231f6f-...",
  "cwd": "C:\\Users\\...\\project-dir",
  "hook_event_name": "PostToolUse",
  "tool_name": "Skill",
  "tool_input": { "skill": "bmad-create-architecture" },
  "tool_use_id": "toolu_018SLm..."
}
```

**Read signal:**
```json
{
  "session_id": "b0231f6f-...",
  "cwd": "C:\\Users\\...\\project-dir",
  "hook_event_name": "PostToolUse",
  "tool_name": "Read",
  "tool_input": { "file_path": "C:/Users/.../file.md" },
  "tool_response": {
    "type": "text",
    "file": { "filePath": "...", "content": "...full content...", "numLines": 5, "startLine": 1, "totalLines": 104 }
  },
  "tool_use_id": "toolu_018SLm..."
}
```

**Key:** `cwd` uses backslashes on Windows, `file_path` uses forward slashes. Normalize both before matching.

### Discrimination Logic Truth Table

| Event | Condition | Action |
|-------|-----------|--------|
| Skill `bmad-{name}` | `steps/` dir exists | Set workflow, calc total, reset started_at if changed |
| Skill `bmad-{name}` | `steps/` dir absent | Ignore (utility skill) |
| Skill non-`bmad-*` | Always | Ignore |
| Read `steps/step-XX-*.md` | Path in active workflow's steps/ | Update step.current, derive next |
| Read `stories/*.md` | Workflow in [`create-story`, `dev-story`, `code-review`] | Update story |
| Read `config.yaml` | Path ends `_bmad/bmm/config.yaml` | Extract project from content |
| Read (other) | Always | Ignore |

### Skill Name Normalization

```js
const workflowName = skill.startsWith('bmad-') ? skill.slice(5) : skill;
```

Stored in status file as `workflow`. Must align with reader's `WORKFLOW_COLORS` keys (e.g., `'create-architecture'`).

### Story Gating Workflows

```js
const STORY_WORKFLOWS = ['create-story', 'dev-story', 'code-review'];
```

Only these 3 workflows track story changes. All others ignore story Read events.

### False Positive Prevention (Step Reads)

```js
const expectedPrefix = normalize(`${cwd}/.claude/skills/bmad-${activeWorkflow}/steps/`);
if (!normalize(filePath).startsWith(expectedPrefix)) return; // wrong workflow
```

A step file from a different skill must NOT update the active workflow's step.

### Step Total & Next Derivation

At Skill event: `readdirSync(stepsDir).filter(f => /^step-\d+-/.test(f))` to count and list steps.

At Read event: derive `next` by finding the step file with the number after `current` in the sorted listing from the status. Since the listing was counted at Skill time, re-read `stepsDir` at Read time to find next step name.

**Alternative approach (simpler):** At Skill event, store the full steps listing (sorted) in memory or derive next at Read time by reading the steps directory again. The `readdirSync` cost is negligible (~0.1ms for typical 6-10 files).

### Config.yaml Project Extraction

```js
const configMatch = normalize(filePath).endsWith('_bmad/bmm/config.yaml');
if (configMatch && payload.tool_response?.file?.content) {
  const m = payload.tool_response.file.content.match(/project_name:\s*['"]?([^'"\n]+)/);
  if (m) status.project = m[1].trim();
}
```

Zero I/O — content is in the payload. Only fires once (project doesn't change during session).

### Testing Strategy

**Pattern:** Same as reader tests — `child_process.execSync` with stdin pipe and temp directories.

```js
import { execSync } from 'node:child_process';

const hookPath = path.resolve('src/hook/bmad-hook.js');
const result = execSync(`node "${hookPath}"`, {
  input: JSON.stringify(payload),
  cwd: tmpDir,
  env: { ...process.env, BMAD_CACHE_DIR: tmpCacheDir },
  timeout: 5000
});
```

**Fixture directory structure per test:**
```
{tmpDir}/
  _bmad/
    bmm/
      config.yaml           # project_name: TestProject
  .claude/
    skills/
      bmad-create-architecture/
        steps/
          step-01-init.md
          step-02-analysis.md
          step-03-starter.md
      bmad-help/              # No steps/ dir — utility skill
```

**Assertions:** Read the status file from `tmpCacheDir` after execSync, parse JSON, assert fields.

### Files to Create

| File | Type | Notes |
|------|------|-------|
| `src/hook/package.json` | CJS marker | `{ "type": "commonjs" }` |
| `src/hook/bmad-hook.js` | Hook script | Main deliverable |
| `test/hook.test.js` | Test suite | All 17 ACs |
| `test/fixtures/claude-settings-with-hooks.json` | Fixture | Prep for Story 3.4 |

### Files NOT Modified

This story creates new files only. No modifications to existing source files. Stories 3.2-3.7 handle modifications to reader, defaults, install, uninstall, TUI, and CLI.

### Project Structure Notes

- `src/hook/` is a new directory alongside `src/reader/` — both are standalone CJS deployed artifacts
- `test/hook.test.js` follows existing naming: `test/{module}.test.js`
- Hook script deployed to `~/.config/bmad-statusline/bmad-hook.js` (same dir as reader)
- Status file at `~/.cache/bmad-status/status-{session_id}.json` (same dir reader already uses)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Core Architectural Decisions]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1]
- [Source: _bmad-output/project-context.md#Hook Architecture]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules]
- [Source: _bmad-output/project-context.md#Status File Schema]
- [Source: _bmad-output/project-context.md#Testing Conventions]
- [Source: bmad-statusline/src/reader/package.json (CJS marker pattern)]
- [Source: bmad-statusline/test/fixtures/status-sample.json (old schema for comparison)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation, all 27 tests passed on first run.

### Completion Notes List

- Implemented full PostToolUse hook script (`src/hook/bmad-hook.js`, 160 lines) following prescribed entry point structure: Requires → Constants → Stdin parsing → Guard → Dispatch → handleSkill → handleRead → Status helpers
- All I/O is synchronous (`readFileSync`, `writeFileSync`, `existsSync`, `readdirSync`, `mkdirSync`), zero async
- Zero dependencies — Node.js stdlib only (`fs`, `path`, `os`)
- Silent always — no `console.log`, no `console.error`, no throw; exit 0 on any error
- handleSkill: extracts skill name, strips `bmad-` prefix, checks trackable via `steps/` dir existence, counts step files, preserves `started_at` on same workflow
- handleRead: path normalization to forward slashes, step detection with false-positive prevention (validates active workflow prefix), story detection gated by `STORY_WORKFLOWS`, config.yaml project extraction from payload content (zero I/O)
- Test suite: 27 tests covering all 17 ACs plus edge cases (non-bmad skills, unknown tool_name, workflow change, story gating for all 3 workflows, type checks for numbers)
- Test fixture `claude-settings-with-hooks.json` created for Story 3.4 prep
- Full regression suite: 109/109 non-hook tests pass (install.test.js/patch-init.test.js failures are pre-existing from other in-progress stories)

### Change Log

- 2026-03-29: Story 3-1 implementation complete — hook script, test suite, fixture file

### Review Findings

- [x] [Review][Patch] Workflow switch doesn't clear stale step/story state — step.current/next/story carry over from previous workflow creating contradictory state [bmad-hook.js:68-83]
- [x] [Review][Patch] Step file sorting is lexicographic, not numeric — .sort() without comparator fails for non-zero-padded step numbers >= 10 [bmad-hook.js:67,140]
- [x] [Review][Patch] Step file filter doesn't require .md extension — /^step-\d+-/ matches backup files like .bak [bmad-hook.js:61,135]
- [x] [Review][Patch] Story regex matches paths outside project CWD — /\/stories\/(.+)\.md$/ should validate path is within CWD [bmad-hook.js:164]
- [x] [Review][Patch] Dead variable normCwd — const normCwd = normalize(cwd) declared but never used [bmad-hook.js:88]
- [x] [Review][Patch] Session ID used unsanitized in file path — sessionId from stdin used directly in path construction, add format validation [bmad-hook.js:184,210]

### File List

- `bmad-statusline/src/hook/package.json` (new) — CJS marker
- `bmad-statusline/src/hook/bmad-hook.js` (new) — PostToolUse hook script
- `bmad-statusline/test/hook.test.js` (new) — 27 tests for all 17 ACs
- `bmad-statusline/test/fixtures/claude-settings-with-hooks.json` (new) — Hook config fixture for Story 3.4
