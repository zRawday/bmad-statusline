# Story 4.4: Hook — Story intelligence with 3-level priority and locking

Status: done

## Story

As a **developer running story-aware workflows (dev-story, code-review, create-story)**,
I want **the hook to detect the active story through a 3-level priority system with locking, ensuring the most authoritative signal wins**,
So that **my statusline shows the correct story even when multiple story-related files are read during a workflow**.

## Acceptance Criteria

1. **STORY_PRIORITY constant:** Source defines `STORY_PRIORITY = { SPRINT_STATUS: 1, STORY_FILE: 2, CANDIDATE: 3 }` and `shouldUpdateStory(incomingPriority, currentPriority)` returning: `true` if incoming=1 (always); `true` if incoming=2 AND current is null or 3; `true` if incoming=3 AND current is null; `false` otherwise.
2. **Workflow gating constants:** Source defines `STORY_READ_WORKFLOWS = ['dev-story', 'code-review']` and `STORY_WRITE_WORKFLOWS = ['create-story']`. Existing `STORY_WORKFLOWS` preserved as the union list.
3. **Priority 2 — Read story file locks:** Active workflow is `dev-story`, no story set (`story_priority: null`) — Read event for a file matching `/(\d+-\d+-[\w-]+)\.md$/` sets `story` to the slug, `story_priority: 2`.
4. **Priority 2 — lock holds:** Story locked at priority 2 — Read event for a DIFFERENT story file does NOT update story.
5. **Non-story workflow ignored:** Active workflow is `create-architecture` (not in `STORY_READ_WORKFLOWS`) — Read event for a story file is ignored.
6. **create-story Read ignored:** Active workflow is `create-story` — Read event for a story file is ignored (not in `STORY_READ_WORKFLOWS`; create-story reads the previous story, not the one being created).
7. **Priority 3 — sprint-status candidate:** No story set (`story_priority: null`), active workflow in `STORY_WORKFLOWS` — Read event for `sprint-status*.yaml` with exactly one `in-progress` story in `tool_response.file.content` sets `story` to that key, `story_priority: 3`.
8. **Priority 3→2 upgrade:** Story set at priority 3 from sprint-status — subsequent Read of story file in `dev-story` workflow updates `story` and promotes `story_priority` to 2.
9. **Priority 1 overwrite of lock (prep for 4.5):** `shouldUpdateStory(1, 2)` returns `true`. Priority 1 signals come from Write/Edit handlers (story 4.5), but the function must support it now.
10. **Multi-candidate sprint-status ignored:** Read of sprint-status.yaml with multiple `in-progress` stories — no candidate set (priority 3 requires unique active story).
11. **Story file regex:** `/(\d+-\d+-[\w-]+)\.md$/` matches `1-3-user-auth.md` → slug `1-3-user-auth`, does NOT match `sprint-status.yaml`, `step-03-starter.md`, or `architecture.md`.
12. **Tests:** `test/hook.test.js` updated for: (a) shouldUpdateStory source inspection, (b) workflow gating for Read story, (c) priority 2 locking, (d) priority 3 candidate, (e) priority 1 overwrite check (source or seedStatus), (f) priority 3→2 upgrade, (g) create-story Read ignored, (h) non-story workflow ignored, (i) multi-candidate sprint-status ignored.

## Tasks / Subtasks

- [x] Task 1: Add story intelligence constants and function (AC: #1, #2)
  - [x] 1.1 Add `STORY_PRIORITY = { SPRINT_STATUS: 1, STORY_FILE: 2, CANDIDATE: 3 }` to constants section
  - [x] 1.2 Add `STORY_READ_WORKFLOWS = ['dev-story', 'code-review']` to constants section
  - [x] 1.3 Add `STORY_WRITE_WORKFLOWS = ['create-story']` to constants section (used by story 4.5)
  - [x] 1.4 Keep existing `STORY_WORKFLOWS = ['create-story', 'dev-story', 'code-review']` unchanged
  - [x] 1.5 Add `shouldUpdateStory(incomingPriority, currentPriority)` function after constants, before handlers
- [x] Task 2: Evolve handleRead story detection to priority system (AC: #3, #4, #5, #6, #11)
  - [x] 2.1 Replace story regex `/\/stories\/(.+)\.md$/` with `/(\d+-\d+-[\w-]+)\.md$/`
  - [x] 2.2 Replace workflow check `STORY_WORKFLOWS.includes(activeWorkflow)` with `STORY_READ_WORKFLOWS.includes(activeWorkflow)` for story file Reads
  - [x] 2.3 Add `shouldUpdateStory(STORY_PRIORITY.STORY_FILE, status.story_priority)` guard before setting story
  - [x] 2.4 Set `status.story_priority = STORY_PRIORITY.STORY_FILE` (2) when story is set from a Read
- [x] Task 3: Add sprint-status Read candidate detection (AC: #7, #10)
  - [x] 3.1 Add sprint-status path check in handleRead: `normPath.match(/sprint-status[^/]*\.yaml$/)`
  - [x] 3.2 Gate by `STORY_WORKFLOWS.includes(activeWorkflow)` (sprint-status signals use the full STORY_WORKFLOWS list)
  - [x] 3.3 Extract content from `payload.tool_response.file.content` — bail if absent
  - [x] 3.4 Parse YAML via regex: scan lines for `^\s+(\d+-\d+-[\w-]+):\s*in-progress` to find active stories
  - [x] 3.5 If exactly 1 active story AND `shouldUpdateStory(STORY_PRIORITY.CANDIDATE, status.story_priority)` → set candidate
  - [x] 3.6 If 0 or 2+ active stories → skip (no candidate)
- [x] Task 4: Update tests (AC: #12)
  - [x] 4.1 Add test fixture: sprint-status YAML content with single in-progress story
  - [x] 4.2 Add test fixture: sprint-status YAML content with multiple in-progress stories
  - [x] 4.3 Add test fixture: additional story files in stories dir (e.g., `1-4-dashboard.md`)
  - [x] 4.4 Add test: shouldUpdateStory source inspection (function exists, truth table logic present)
  - [x] 4.5 Add test: STORY_READ_WORKFLOWS and STORY_WRITE_WORKFLOWS constants exist in source
  - [x] 4.6 Add test: Read story file in dev-story → priority 2, story set
  - [x] 4.7 Add test: Read second story file in dev-story with priority 2 → story unchanged (lock)
  - [x] 4.8 Add test: Read story file in create-story → story NOT set
  - [x] 4.9 Add test: Read story file in create-architecture → story NOT set
  - [x] 4.10 Add test: Read sprint-status with 1 in-progress story, no current story → priority 3 candidate set
  - [x] 4.11 Add test: Read sprint-status with 2 in-progress stories → no candidate
  - [x] 4.12 Add test: Priority 3→2 upgrade (seed priority 3, then Read story file → priority 2)
  - [x] 4.13 Add test: Priority 1 overwrite check (verify shouldUpdateStory source handles incoming=1)
  - [x] 4.14 Add test: story file regex does NOT match step files (`step-03-starter.md`), sprint-status, or plain `.md` files (`architecture.md`)
  - [x] 4.15 Update existing story detection tests to align with new regex and priority system

### Review Findings

- [x] [Review][Defer] Sprint-status in-progress regex not end-anchored — `in-progress-blocked` would match as `in-progress` [`src/hook/bmad-hook.js:223`] — deferred, theoretical (controlled vocabulary)
- [x] [Review][Defer] Same-skill re-invocation does not reset locked story — second `/bmad-dev-story` in same session keeps old story locked [`src/hook/bmad-hook.js:121-126`] — deferred, pre-existing design
- [x] [Review][Defer] extractStep regex track collision — files without track prefix in `steps-c/` dir would be miscounted [`src/hook/bmad-hook.js:18,173`] — deferred, story 4-3 scope

**Process note:** Source changes for story 4-4 (constants, `shouldUpdateStory`, handleRead evolution) were committed in the 4-3 commit (`aa4032d`), not in the 4-4 commit (`4841948`) which only contains tests and story file.

## Dev Notes

### Error Handling: SILENT ALWAYS

The hook is in the **silent** component of the error handling triad. **Never** `console.log`, `console.error`, or throw. Every failure path must exit silently (`process.exit(0)` or `return`).

### Synchronous I/O Only

All file operations MUST use `fs.readFileSync` / `fs.writeFileSync`. Never `fs.promises` or async/await.

### File To Modify

**Single file:** `src/hook/bmad-hook.js` (+ tests)

No reader changes. No installer changes.

### cwd Scoping — Already In Place

The cwd scoping guard (`normPath.startsWith(normCwd + '/')`) is already the FIRST check in handleRead (line 124). All new story detection code goes AFTER this guard. No changes needed to cwd scoping — just ensure new sprint-status and story file checks are placed below line 124, not above it.

### Backward Compatibility — Missing `story_priority`

Old status files (from Phase 2/3) won't have `story_priority`. When read, it will be `undefined`. The `shouldUpdateStory` function handles this gracefully: `!currentPriority` is `true` for both `null` and `undefined`, so a missing field behaves identically to an unset field.

### Current Story Detection (what you're evolving)

Current code in handleRead (lines 180-189):
```js
// Story detection — gated by workflow
const storyMatch = normPath.match(/\/stories\/(.+)\.md$/);
if (storyMatch) {
  if (STORY_WORKFLOWS.includes(activeWorkflow)) {
    status.session_id = sessionId;
    status.story = storyMatch[1];
    writeStatus(sessionId, status);
  }
  return;
}
```

Problems with current approach:
- Simple workflow gating (all 3 workflows treated identically) — no distinction between Read workflows and Write workflows
- No priority system — last Read wins, can overwrite correct story
- Story regex requires `/stories/` directory — but actual story files live in `implementation-artifacts/` directly (e.g., `4-2-hook-dispatch-userpromptsubmit-multi-module-cwd-sessionstart.md`)
- No sprint-status candidate detection

### Target Story Detection (after this story)

```js
// Constants section additions:
const STORY_PRIORITY = { SPRINT_STATUS: 1, STORY_FILE: 2, CANDIDATE: 3 };
const STORY_READ_WORKFLOWS = ['dev-story', 'code-review'];
const STORY_WRITE_WORKFLOWS = ['create-story'];
// STORY_WORKFLOWS remains: ['create-story', 'dev-story', 'code-review']

// New function (after constants, before handlers):
function shouldUpdateStory(incomingPriority, currentPriority) {
  if (incomingPriority === 1) return true;
  if (incomingPriority === 2 && (!currentPriority || currentPriority === 3)) return true;
  if (incomingPriority === 3 && !currentPriority) return true;
  return false;
}
```

Story detection in handleRead becomes:
```js
// Sprint-status Read → candidate (priority 3)
if (normPath.match(/sprint-status[^/]*\.yaml$/)) {
  if (STORY_WORKFLOWS.includes(activeWorkflow)) {
    const content = payload.tool_response && payload.tool_response.file
      && payload.tool_response.file.content;
    if (content) {
      const activeStories = [];
      const lines = content.split('\n');
      for (const line of lines) {
        const m = line.match(/^\s+(\d+-\d+-[\w-]+):\s*in-progress/);
        if (m) activeStories.push(m[1]);
      }
      if (activeStories.length === 1 && shouldUpdateStory(STORY_PRIORITY.CANDIDATE, status.story_priority)) {
        status.session_id = sessionId;
        status.story = activeStories[0];
        status.story_priority = STORY_PRIORITY.CANDIDATE;
        writeStatus(sessionId, status);
      }
    }
  }
  return;
}

// Story file Read → priority 2 (lock)
const STORY_FILE_REGEX = /(\d+-\d+-[\w-]+)\.md$/;
const storyMatch = normPath.match(STORY_FILE_REGEX);
if (storyMatch) {
  if (STORY_READ_WORKFLOWS.includes(activeWorkflow)
      && shouldUpdateStory(STORY_PRIORITY.STORY_FILE, status.story_priority)) {
    status.session_id = sessionId;
    status.story = storyMatch[1];
    status.story_priority = STORY_PRIORITY.STORY_FILE;
    writeStatus(sessionId, status);
  }
  return;
}
```

**Ordering matters:** Sprint-status check BEFORE story file check, because `sprint-status.yaml` does NOT match the story file regex (no `\d+-\d+-` prefix), but explicitly checking sprint-status first keeps intent clear and avoids future regex collisions.

### STORY_FILE_REGEX Placement

Define as a constant (like SKILL_REGEX) or inline in handleRead. Constant is preferred for testability via source inspection:
```js
const STORY_FILE_REGEX = /(\d+-\d+-[\w-]+)\.md$/;
```

### Sprint-Status YAML Parsing — Zero Dependencies

No YAML parser available. Use line-by-line regex:
```js
const m = line.match(/^\s+(\d+-\d+-[\w-]+):\s*in-progress/);
```

This matches indented lines like `  4-2-hook-dispatch-userpromptsubmit-multi-module-cwd-sessionstart: in-progress`. The `^\s+` prefix ensures we're in the `development_status:` block (all entries are indented, comments start with `#`). The status must be exactly `in-progress` (not `in-progress-ish` — the regex anchor handles this).

**Expected sprint-status.yaml structure** (see `_bmad-output/implementation-artifacts/sprint-status.yaml`):
```yaml
development_status:
  # Epic 4: ...
  epic-4: in-progress
  4-1-spike-payload: done
  4-3-multi-track-step: in-progress    # ← matches regex
  4-4-story-intelligence: backlog       # ← does NOT match (not in-progress)
```
All story keys are 2-space indented under `development_status:`. Epic keys (`epic-N`) and comments (`# ...`) do not match the `\d+-\d+-[\w-]+` pattern.

**"Active" defined as:** `in-progress` only. Not `ready-for-dev`, `review`, or `backlog`. Rationale: `in-progress` is the most unambiguous signal that a story is being worked on. A `ready-for-dev` story is queued, not active. A `review` story is done but being reviewed.

### Handling `tool_response.file.content` for Sprint-Status

The Read payload includes file content in `tool_response.file.content`. This is only present when the Read was successful. Guard:
```js
const content = payload.tool_response && payload.tool_response.file && payload.tool_response.file.content;
if (!content) return;
```

### Step File Regex Collision Prevention

The new `STORY_FILE_REGEX` `/(\d+-\d+-[\w-]+)\.md$/` does NOT match step files:
- `step-03-starter.md` — no `\d+-\d+-` prefix (starts with `step-`)
- `sprint-status.yaml` — not `.md` extension
- `architecture.md` — no `\d+-\d+-` prefix

It DOES match:
- `1-3-user-auth.md` → slug `1-3-user-auth`
- `4-2-hook-dispatch-userpromptsubmit-multi-module-cwd-sessionstart.md` → slug `4-2-hook-dispatch-...`

### Existing Tests That Need Update

Current story detection tests (lines 432-487 of test/hook.test.js) use:
1. A `stories/` subdirectory with `3-1-hook-script.md`
2. Simple workflow gating without priority

These tests need adaptation:
- Story file path no longer requires `/stories/` — update or keep both patterns
- Story detection now sets `story_priority: 2` — assert on it
- `create-story` workflow should NOT trigger story detection on Read (moved to `STORY_WRITE_WORKFLOWS`, which handles Write events in 4.5)
- Add priority-based tests

**Fixture update:** Add a second story file to the temp dir for locking tests. Place it in the existing `stories/` test subdirectory (e.g., `stories/1-4-dashboard.md`). The new regex matches by filename pattern, not by directory — but using `stories/` keeps test fixtures organized and passes cwd scoping.

### Test Pattern: Sprint-Status Content in Read Payload

To test sprint-status candidate detection, construct a Read payload with `tool_response.file.content` containing YAML:
```js
function makeReadPayload(sessionId, filePath, content) {
  // existing helper already supports content parameter
  // content goes in tool_response.file.content
}
```

Sprint-status YAML fixture for single candidate:
```yaml
development_status:
  epic-4: in-progress
  4-1-spike-payload: done
  4-2-hook-dispatch: done
  4-3-multi-track-step: in-progress
  4-4-story-intelligence: backlog
```
→ One `in-progress` story: `4-3-multi-track-step`

Sprint-status YAML fixture for multi-candidate (no candidate set):
```yaml
development_status:
  4-3-multi-track-step: in-progress
  4-4-story-intelligence: in-progress
```
→ Two `in-progress` stories: no candidate

### Previous Story Intelligence (from 4-2)

Key learnings from story 4-2:
- **Proactive project detection** was added — reads `config.yaml` before dispatch, falls back to cwd basename. This happens BEFORE handleRead, so the story detection code doesn't need to worry about config.yaml.
- **cwd scoping** uses `normPath.startsWith(normCwd + '/')` — ensure sprint-status path also passes this check (it will, since sprint-status is inside the project).
- **Story 4-2 review findings:** `steps-[a-z]` regex too restrictive (deferred to 4.3), cwd trailing slash edge case (pre-existing). Neither affects this story.
- **Test pattern:** Tests use `child_process.execSync` with synthetic JSON on stdin. The `execHook()` helper and `seedStatus()` helper are reusable for priority tests.
- **Backward compat:** Old status files without `story_priority` → treat as `null` (which is already the behavior — undefined and null both work with `!currentPriority` check in shouldUpdateStory).

### What This Story Does NOT Do

- Does NOT implement Write/Edit handlers (story 4.5) — Write/Edit story file detection and sprint-status delta detection are 4.5
- Does NOT change step detection regex (story 4.3 — multi-track)
- Does NOT modify installer/defaults/uninstaller (stories 4.6/4.7)
- Does NOT modify reader (no reader changes in Epic 4)
- Does NOT modify clean command (story 4.8)
- Does NOT trigger priority 1 signals — that requires Write/Edit handlers from story 4.5. This story only defines the `shouldUpdateStory` function that supports priority 1.

### Project Structure Notes

- `src/hook/bmad-hook.js` — CommonJS, zero deps, deployed standalone
- `src/hook/package.json` — CJS marker `{ "type": "commonjs" }` (do not modify)
- `test/hook.test.js` — uses `node:test` + `node:assert/strict`, ESM
- `test/fixtures/status-sample.json` — may need story_priority sample update
- Constants → helpers → handlers → main (file organization rule from architecture)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md — Story Intelligence (3-level priority), Pattern 12 (Story Priority Resolution), Workflow gating, STORY_READ_WORKFLOWS, STORY_WRITE_WORKFLOWS]
- [Source: _bmad-output/planning-artifacts/epics.md — Story 4.4 acceptance criteria, FR4]
- [Source: _bmad-output/project-context.md — Error Handling Triad, Sync I/O, Path Normalization, Hook Entry Point Structure, Story Gating (current)]
- [Source: _bmad-output/implementation-artifacts/4-2-hook-dispatch-userpromptsubmit-multi-module-cwd-sessionstart.md — Previous story dev notes, review findings, test patterns, backward compat notes]
- [Source: bmad-statusline/src/hook/bmad-hook.js — Current implementation (248 lines), handleRead story detection at lines 180-189]
- [Source: bmad-statusline/test/hook.test.js — Existing story detection tests at lines 432-487, test helpers at lines 69-139]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — all tests passed on first run (212/212).

### Completion Notes List

- Added 4 new constants: `STORY_PRIORITY`, `STORY_READ_WORKFLOWS`, `STORY_WRITE_WORKFLOWS`, `STORY_FILE_REGEX`
- Added `shouldUpdateStory(incomingPriority, currentPriority)` function implementing 3-level priority resolution
- Evolved `handleRead` story detection: old `/stories/` directory-based regex replaced with filename-pattern regex `/(\d+-\d+-[\w-]+)\.md$/`
- Story file Reads now gated by `STORY_READ_WORKFLOWS` (dev-story, code-review) instead of full `STORY_WORKFLOWS`
- Priority 2 locking: once a story file is read, subsequent story file reads do not overwrite
- Added sprint-status candidate detection (priority 3): parses YAML content for single in-progress story
- Sprint-status uses full `STORY_WORKFLOWS` list (including create-story)
- Multi-candidate sprint-status correctly ignored (0 or 2+ in-progress = no candidate)
- Replaced 4 old story detection tests with 16 new story intelligence tests covering all ACs
- All 212 tests pass with no regressions

### Change Log

- 2026-03-30: Story 4.4 implemented — 3-level story priority system with locking

### File List

- bmad-statusline/src/hook/bmad-hook.js (modified)
- bmad-statusline/test/hook.test.js (modified)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified)
- _bmad-output/implementation-artifacts/4-4-hook-story-intelligence-priority-locking.md (modified)
