# Story 4.5: Hook — Write & Edit handlers for story confirmation

Status: done

## Story

As a **developer running story-aware workflows (create-story, dev-story, code-review)**,
I want **the hook to detect story confirmation signals from Write and Edit events on sprint-status and story files**,
So that **the statusline reflects the definitive story assignment when sprint-status is updated or a new story file is created**.

## Acceptance Criteria

1. **Write sprint-status → priority 1:** PostToolUse Write on file matching `/sprint-status[^/]*\.yaml$/`, active workflow in `STORY_WORKFLOWS` → parse `tool_input.content` YAML, find first story key with transitional status (not `backlog`, not `done`) → set `story` and `story_priority: 1` via `shouldUpdateStory`.
2. **Write sprint-status with multiple transitional stories:** Multiple stories with non-terminal statuses → hook sets `story` to the **first** transitional story found (priority 1 still applies).
3. **Write sprint-status in non-story workflow → ignored:** Active workflow NOT in `STORY_WORKFLOWS` (e.g., sprint-planning) → hook ignores the event.
4. **Edit sprint-status → priority 1:** PostToolUse Edit on file matching `/sprint-status[^/]*\.yaml$/`, active workflow in `STORY_WORKFLOWS` → extract story key from `tool_input.new_string` via `/(\d+-\d+-[\w-]+)/`. If absent, fallback to `tool_input.old_string`. If neither contains a story key, skip silently. Set `story_priority: 1`.
5. **Write story file in create-story → priority 2:** Active workflow is `create-story`, PostToolUse Write for file matching `STORY_FILE_REGEX` → set `story` from filename slug, `story_priority: 2` (first Write locks) via `shouldUpdateStory`.
6. **Write story file priority 2 lock holds:** Story locked at priority 2 from a prior Write → subsequent Write for a different story file does NOT update story.
7. **Write story file in dev-story → ignored:** Active workflow is `dev-story` (NOT in `STORY_WRITE_WORKFLOWS`) → Write event for story file is ignored.
8. **cwd scoping for Write:** Write event for file outside `payload.cwd` → ignored.
9. **cwd scoping for Edit:** Edit event for file outside `payload.cwd` → ignored.
10. **Write non-matching file → ignored:** Write event for a file that is neither sprint-status nor story file → ignored silently.
11. **Edit non-sprint-status file → ignored:** Edit event for a non-sprint-status file → ignored silently.
12. **Tests:** `test/hook.test.js` updated with: (a) Write sprint-status → priority 1 story set, (b) Edit sprint-status → priority 1 story set, (c) Write story file in create-story → priority 2, (d) Write story file in dev-story → ignored, (e) priority 2 lock on second Write, (f) cwd scoping for Write and Edit, (g) non-matching files ignored, (h) Edit new_string preferred over old_string, (i) Edit fallback to old_string, (j) Edit skip when neither has story key, (k) Write sprint-status without content → no crash, (l) handleWrite and handleEdit functions exist in source.

## Tasks / Subtasks

- [x] Task 1: Add handleWrite function (AC: #1, #2, #3, #5, #6, #7, #8, #10)
  - [x] 1.1 Create `handleWrite()` function after `handleRead()`, following prescribed structure: cwd scope → normalize → sprint-status YAML parse / story file detection → status update
  - [x] 1.2 Extract `file_path` from `payload.tool_input.file_path` with type guard (same pattern as handleRead)
  - [x] 1.3 Apply cwd scoping: `normPath.startsWith(normCwd + '/')` — identical to handleRead
  - [x] 1.4 Read status file, check `activeWorkflow` — return early if absent
  - [x] 1.5 Sprint-status Write detection: `normPath.match(/sprint-status[^/]*\.yaml$/)` — same regex as handleRead
  - [x] 1.6 Sprint-status gate: `STORY_WORKFLOWS.includes(activeWorkflow)` — gated by story-aware workflows
  - [x] 1.7 Extract content from `payload.tool_input.content` — bail if absent
  - [x] 1.8 Parse YAML: line-by-line `^\s+(\d+-\d+-[\w-]+):\s*(\S+)` — match story key + status, skip if status is `backlog` or `done`, take FIRST transitional story
  - [x] 1.9 Apply `shouldUpdateStory(STORY_PRIORITY.SPRINT_STATUS, status.story_priority)` — priority 1 always overwrites
  - [x] 1.10 Story file Write detection: `normPath.match(STORY_FILE_REGEX)` — reuse existing constant
  - [x] 1.11 Story file gate: `STORY_WRITE_WORKFLOWS.includes(activeWorkflow)` — only `create-story`
  - [x] 1.12 Apply `shouldUpdateStory(STORY_PRIORITY.STORY_FILE, status.story_priority)` — priority 2 with lock
- [x] Task 2: Add handleEdit function (AC: #4, #9, #11)
  - [x] 2.1 Create `handleEdit()` function after `handleWrite()`
  - [x] 2.2 Extract `file_path` from `payload.tool_input.file_path` with type guard
  - [x] 2.3 Apply cwd scoping (identical to handleWrite)
  - [x] 2.4 Read status file, check `activeWorkflow` — return early if absent
  - [x] 2.5 Sprint-status Edit detection: same regex as handleWrite
  - [x] 2.6 Sprint-status gate: `STORY_WORKFLOWS.includes(activeWorkflow)`
  - [x] 2.7 Extract story key from `tool_input.new_string` via `/(\d+-\d+-[\w-]+)/` regex
  - [x] 2.8 Fallback: if `new_string` has no story key, try `tool_input.old_string`
  - [x] 2.9 If neither has a story key, return silently (no crash, no log)
  - [x] 2.10 Apply `shouldUpdateStory(STORY_PRIORITY.SPRINT_STATUS, status.story_priority)` — priority 1
- [x] Task 3: Update dispatch stub (AC: all)
  - [x] 3.1 Replace `// stub for story 4.5` with separate `handleWrite()` and `handleEdit()` calls
- [x] Task 4: Add test helpers and fixtures (AC: #12)
  - [x] 4.1 Add `makeWritePayload(sessionId, filePath, content)` helper — returns PostToolUse Write payload with `tool_input: { file_path, content }`
  - [x] 4.2 Add `makeEditPayload(sessionId, filePath, oldString, newString)` helper — returns PostToolUse Edit payload with `tool_input: { file_path, old_string, new_string }`
- [x] Task 5: Add Write/Edit tests (AC: #12)
  - [x] 5.1 Test: Write sprint-status with 1 transitional story → priority 1 story set
  - [x] 5.2 Test: Write sprint-status with 2 transitional stories → first one selected (priority 1)
  - [x] 5.3 Test: Edit sprint-status → priority 1 story set (story key from new_string)
  - [x] 5.4 Test: Edit sprint-status → fallback to old_string when new_string has no story key
  - [x] 5.5 Test: Edit sprint-status → skip when neither string has story key
  - [x] 5.6 Test: Write story file in create-story → priority 2
  - [x] 5.7 Test: Write story file in dev-story → ignored
  - [x] 5.8 Test: Priority 2 lock on second Write story file
  - [x] 5.9 Test: cwd scoping for Write (file outside cwd → ignored)
  - [x] 5.10 Test: cwd scoping for Edit (file outside cwd → ignored)
  - [x] 5.11 Test: Write non-matching file → ignored
  - [x] 5.12 Test: Edit non-sprint-status file → ignored
  - [x] 5.13 Test: Write sprint-status in non-story workflow (create-architecture) → ignored
  - [x] 5.14 Test: Write sprint-status without content → no crash
  - [x] 5.15 Test: handleWrite and handleEdit functions exist in source
  - [x] 5.16 Test: Priority 1 overwrites existing priority 2 lock (Write sprint-status after story locked)

## Dev Notes

### Error Handling: SILENT ALWAYS

The hook is in the **silent** component of the error handling triad. **Never** `console.log`, `console.error`, or throw. Every failure path must exit silently (`return`). This applies to handleWrite and handleEdit — any missing field, bad content, or parsing failure → return silently.

### Synchronous I/O Only

All file operations MUST use `fs.readFileSync` / `fs.writeFileSync`. Never `fs.promises` or async/await. (handleWrite/handleEdit don't read files from disk — they get content from the payload — but status file I/O is still sync.)

### File To Modify

**Single file:** `src/hook/bmad-hook.js` (+ tests in `test/hook.test.js`)

No reader changes. No installer changes. No defaults changes.

### Dispatch Stub Replacement

Current dispatch code at line 79-88 of `bmad-hook.js`:
```js
} else if (toolName === 'Write' || toolName === 'Edit') {
  // stub for story 4.5
}
```

Replace with:
```js
} else if (toolName === 'Write') {
  handleWrite();
} else if (toolName === 'Edit') {
  handleEdit();
}
```

### handleWrite — Prescribed Structure

```js
// ─── 9. handleWrite (story confirmation signal) ─────────────────────────────
function handleWrite() {
  const filePath = payload.tool_input && payload.tool_input.file_path;
  if (!filePath || typeof filePath !== 'string') return;

  const normPath = normalize(filePath);
  const normCwd = normalize(cwd);

  // cwd scoping: ignore writes outside project
  if (!normPath.startsWith(normCwd + '/')) return;

  const status = readStatus(sessionId);
  const activeWorkflow = status.workflow;
  if (!activeWorkflow) return;

  // Sprint-status Write → priority 1
  if (normPath.match(/sprint-status[^\/]*\.yaml$/)) {
    if (STORY_WORKFLOWS.includes(activeWorkflow)) {
      const content = payload.tool_input.content;
      if (content) {
        const lines = content.split('\n');
        for (const line of lines) {
          const m = line.match(/^\s+(\d+-\d+-[\w-]+):\s*(\S+)/);
          if (m && m[2] !== 'backlog' && m[2] !== 'done') {
            if (shouldUpdateStory(STORY_PRIORITY.SPRINT_STATUS, status.story_priority)) {
              status.session_id = sessionId;
              status.story = m[1];
              status.story_priority = STORY_PRIORITY.SPRINT_STATUS;
              writeStatus(sessionId, status);
            }
            break;
          }
        }
      }
    }
    return;
  }

  // Story file Write → priority 2 (lock)
  const storyMatch = normPath.match(STORY_FILE_REGEX);
  if (storyMatch) {
    if (STORY_WRITE_WORKFLOWS.includes(activeWorkflow)
        && shouldUpdateStory(STORY_PRIORITY.STORY_FILE, status.story_priority)) {
      status.session_id = sessionId;
      status.story = storyMatch[1];
      status.story_priority = STORY_PRIORITY.STORY_FILE;
      writeStatus(sessionId, status);
    }
    return;
  }
}
```

### handleEdit — Prescribed Structure

```js
// ─── 10. handleEdit (story confirmation signal) ─────────────────────────────
function handleEdit() {
  const filePath = payload.tool_input && payload.tool_input.file_path;
  if (!filePath || typeof filePath !== 'string') return;

  const normPath = normalize(filePath);
  const normCwd = normalize(cwd);

  // cwd scoping: ignore edits outside project
  if (!normPath.startsWith(normCwd + '/')) return;

  const status = readStatus(sessionId);
  const activeWorkflow = status.workflow;
  if (!activeWorkflow) return;

  // Sprint-status Edit → priority 1
  if (normPath.match(/sprint-status[^\/]*\.yaml$/)) {
    if (STORY_WORKFLOWS.includes(activeWorkflow)) {
      const newStr = payload.tool_input.new_string;
      const oldStr = payload.tool_input.old_string;
      const storyKeyRegex = /(\d+-\d+-[\w-]+)/;
      const newMatch = newStr && newStr.match(storyKeyRegex);
      const oldMatch = oldStr && oldStr.match(storyKeyRegex);
      const storyKey = (newMatch && newMatch[1]) || (oldMatch && oldMatch[1]);
      if (storyKey && shouldUpdateStory(STORY_PRIORITY.SPRINT_STATUS, status.story_priority)) {
        status.session_id = sessionId;
        status.story = storyKey;
        status.story_priority = STORY_PRIORITY.SPRINT_STATUS;
        writeStatus(sessionId, status);
      }
    }
    return;
  }
}
```

### Sprint-Status YAML Parsing — Write vs Read vs Edit

| Handler | Source field | What to match | Priority |
|---------|-------------|---------------|----------|
| Read | `tool_response.file.content` | `in-progress` only → unique candidate | 3 (candidate) |
| Write | `tool_input.content` | NOT `backlog` AND NOT `done` → first transitional | 1 (overwrites) |
| Edit | `tool_input.new_string` / `old_string` | Story key regex `/(\d+-\d+-[\w-]+)/` | 1 (overwrites) |

**Why Write uses "transitional status" matching instead of true delta detection:** PostToolUse fires AFTER the Write completes — the old file content is gone. Architecture acknowledges this as a "complex implementation detail" gap. The pragmatic approach: find the first story with a non-terminal status (`ready-for-dev`, `in-progress`, `review`). This works because during story workflows, the modified story transitions to a non-terminal state while other stories remain in `backlog` or `done`.

**Why Edit uses story key extraction (not status parsing):** Edit provides `old_string` and `new_string` — the diff itself. These strings contain the story key being modified. No YAML parsing needed.

**Read already handles `in-progress` only (priority 3):** This is intentional — Read is a weak candidate signal. Write/Edit are definitive confirmation signals (priority 1).

### Regex Reuse Summary

| Regex | Defined | Used by |
|-------|---------|---------|
| `STORY_FILE_REGEX` `/(\d+-\d+-[\w-]+)\.md$/` | Constants (line 15) | handleRead, handleWrite (story file) |
| Sprint-status path `/sprint-status[^/]*\.yaml$/` | Inline in handlers | handleRead, handleWrite, handleEdit |
| YAML story key `/^\s+(\d+-\d+-[\w-]+):\s*(\S+)/` | Inline in handleWrite | handleWrite only (captures key + status) |
| Story key in text `/(\d+-\d+-[\w-]+)/` | Inline in handleEdit | handleEdit only (from diff strings) |
| YAML in-progress `/^\s+(\d+-\d+-[\w-]+):\s*in-progress/` | Inline in handleRead | handleRead only (candidate detection) |

### Workflow Gating Constants — Already Exist

All constants needed are already in place (added in story 4.4):
- `STORY_WORKFLOWS = ['create-story', 'dev-story', 'code-review']` — gates sprint-status signals (Read, Write, Edit)
- `STORY_READ_WORKFLOWS = ['dev-story', 'code-review']` — gates Read story file signals
- `STORY_WRITE_WORKFLOWS = ['create-story']` — gates Write story file signals
- `STORY_PRIORITY = { SPRINT_STATUS: 1, STORY_FILE: 2, CANDIDATE: 3 }` — priority levels
- `STORY_FILE_REGEX = /(\d+-\d+-[\w-]+)\.md$/` — story filename pattern

### What This Story Does NOT Do

- Does NOT add SessionStart handler logic (already a no-op in dispatch, story 4.2)
- Does NOT modify step detection (story 4.3)
- Does NOT modify shouldUpdateStory or priority constants (story 4.4)
- Does NOT modify installer/defaults/uninstaller (stories 4.6/4.7)
- Does NOT modify reader (no reader changes in Epic 4)
- Does NOT change handleRead behavior — Read handler is untouched
- Does NOT modify handleUserPrompt — intent handler is untouched

### Test Pattern: Write and Edit Payloads

**Write payload structure** (from architecture):
```js
function makeWritePayload(sessionId, filePath, content) {
  return {
    session_id: sessionId,
    cwd: tmpDir,
    hook_event_name: 'PostToolUse',
    tool_name: 'Write',
    tool_input: { file_path: filePath, content: content },
    tool_use_id: 'toolu_test'
  };
}
```

**Edit payload structure** (from architecture):
```js
function makeEditPayload(sessionId, filePath, oldString, newString) {
  return {
    session_id: sessionId,
    cwd: tmpDir,
    hook_event_name: 'PostToolUse',
    tool_name: 'Edit',
    tool_input: { file_path: filePath, old_string: oldString, new_string: newString },
    tool_use_id: 'toolu_test'
  };
}
```

### Sprint-Status YAML Fixtures for Tests

**Single transitional story:**
```yaml
development_status:
  epic-4: in-progress
  4-1-spike-payload: done
  4-2-hook-dispatch: done
  4-5-hook-write-edit-handlers: ready-for-dev
  4-6-defaults-installer: backlog
```
Expected story: `4-5-hook-write-edit-handlers`

**Multiple transitional stories (first wins):**
```yaml
development_status:
  4-3-multi-track-step: review
  4-5-hook-write-edit-handlers: in-progress
  4-8-clean-alive-readme: backlog
```
Expected story: `4-3-multi-track-step` (first non-terminal)

**All terminal (no transitional story):**
```yaml
development_status:
  4-1-spike-payload: done
  4-2-hook-dispatch: done
```
Expected: no story set (all done/backlog)

### Edit Sprint-Status Fixtures for Tests

**new_string contains story key:**
- `old_string`: `  4-5-hook-write-edit-handlers: backlog`
- `new_string`: `  4-5-hook-write-edit-handlers: ready-for-dev`
- Expected story: `4-5-hook-write-edit-handlers` (from new_string)

**new_string has no story key, fallback to old_string:**
- `old_string`: `  4-5-hook-write-edit-handlers: backlog`
- `new_string`: `ready-for-dev`
- Expected story: `4-5-hook-write-edit-handlers` (from old_string)

**Neither has story key:**
- `old_string`: `backlog`
- `new_string`: `in-progress`
- Expected: no story set

### cwd Scoping Test Pattern

Use a file path outside `tmpDir` (e.g., `/outside/project/sprint-status.yaml`). Seed a status with an active story workflow. Assert story is unchanged after the Write/Edit event.

### Previous Story Intelligence (from 4-4)

Key learnings from story 4-4:
- **shouldUpdateStory** handles all priority resolution — always call it before setting story, never set story directly
- **Story priority is nullable** — `null` and `undefined` both work with `!currentPriority` check
- **STORY_FILE_REGEX** `/(\d+-\d+-[\w-]+)\.md$/` matches filenames, not directory paths — story files can be anywhere within cwd
- **Sprint-status regex** `/sprint-status[^/]*\.yaml$/` — the `[^/]*` allows for variants like `sprint-status-v2.yaml`
- **Process note from 4-4:** Some source changes for 4-4 landed in the 4-3 commit — check current source, not commit history
- **Review findings deferred:** Sprint-status `in-progress` regex not end-anchored (theoretical), same-skill re-invocation doesn't reset locked story (pre-existing design)

### Git Intelligence (recent commits)

```
a37aefe 4-7-uninstaller-3-generation-backward-compat
425e419 fix(4-4-hook-story-intelligence-priority-locking): code review corrections
4841948 4-4-hook-story-intelligence-priority-locking
e4464fa fix(4-6-defaults-installer-5-matcher-config): code review corrections
aa4032d 4-3-hook-multi-track-step-detection
```

Stories 4.3, 4.4, 4.6, 4.7 are implemented. Story 4.5 is the last hook logic change. After 4.5, the hook has all 5 signal handlers operational.

### Project Structure Notes

- `src/hook/bmad-hook.js` — CommonJS, zero deps, deployed standalone (~307 lines currently)
- `src/hook/package.json` — CJS marker `{ "type": "commonjs" }` (do not modify)
- `test/hook.test.js` — uses `node:test` + `node:assert/strict`, ESM (~1149 lines currently)
- Constants → helpers → handlers → main (file organization rule from architecture)
- New functions go AFTER handleRead, BEFORE touchAlive helper (following the handler → helper ordering)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md — Write/Edit handler structure (lines 529-536), Dispatch pattern (lines 604-613), Story extraction by event type (lines 395-403), Workflow gating (lines 693-702), Write/Edit payload format (lines 119-138), Runtime flow Write/Edit (lines 962-969)]
- [Source: _bmad-output/planning-artifacts/epics.md — Story 4.5 acceptance criteria (lines 391-445)]
- [Source: _bmad-output/project-context.md — Error Handling Triad, Sync I/O, Path Normalization, Hook Entry Point Structure, Status File Schema Evolution]
- [Source: _bmad-output/implementation-artifacts/4-4-hook-story-intelligence-priority-locking.md — Previous story dev notes, shouldUpdateStory function, STORY_PRIORITY constants, STORY_FILE_REGEX, workflow gating constants, test patterns]
- [Source: bmad-statusline/src/hook/bmad-hook.js — Current implementation (307 lines), dispatch stub at lines 83-85, handleRead at lines 136-249]
- [Source: bmad-statusline/test/hook.test.js — Existing test helpers at lines 90-160, story intelligence tests at lines 630-901]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Implemented `handleWrite()` following prescribed structure: cwd scoping, sprint-status YAML parsing (first transitional story), story file detection with STORY_WRITE_WORKFLOWS gate
- Implemented `handleEdit()` following prescribed structure: cwd scoping, sprint-status story key extraction from new_string with old_string fallback
- Replaced dispatch stub with separate `handleWrite()` and `handleEdit()` calls
- Added `makeWritePayload` and `makeEditPayload` test helpers
- Added 16 tests covering all AC #12 scenarios: Write/Edit sprint-status, story file Write, cwd scoping, workflow gating, priority overwrite, lock behavior, non-matching files, missing content
- All 230 tests pass (0 failures, 0 regressions)

### File List

- bmad-statusline/src/hook/bmad-hook.js (modified — added handleWrite, handleEdit, updated dispatch)
- bmad-statusline/test/hook.test.js (modified — added test helpers and 16 Write/Edit tests)

### Change Log

- 2026-03-30: Implemented Write & Edit handlers for story confirmation signals (handleWrite, handleEdit), updated dispatch, added 16 tests — all 230 tests pass

### Review Findings

- [x] [Review][Defer] `handleEdit` no status filtering on extracted story key — multi-key block edits may select wrong story (priority 1 overwrite with incorrect key). Architecture explicitly chose simple regex for Edit; design trade-off documented in dev notes. **Deferred:** code matches architecture spec; theoretical risk only.
- [x] [Review][Patch] `handleWrite` content check uses `if (content)` instead of `typeof content === 'string'` — inconsistent with hardened `handleRead` in same diff [bmad-hook.js:272] **Fixed**
- [x] [Review][Patch] `handleEdit` no type guard on `new_string`/`old_string` before `.match()` — non-string truthy values would crash [bmad-hook.js:323-324] **Fixed**
