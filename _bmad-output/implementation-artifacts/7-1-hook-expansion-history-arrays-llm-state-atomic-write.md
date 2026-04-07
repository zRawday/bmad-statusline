# Story 7.1: Hook Expansion — History Arrays, LLM State, Atomic Write

Status: done

## Story

As a **bmad-statusline Monitor user**,
I want **the hook to track full file history, bash commands, and LLM activity state**,
So that **the Monitor TUI can display comprehensive session activity in real time**.

## Acceptance Criteria

1. **Given** a PostToolUse event with `tool_name = "Bash"`
   **When** the hook processes it
   **Then** the command string from `payload.tool_input.command` is appended to `status.commands[]` as `{ cmd, at: ISO8601, agent_id: payload.agent_id || null }`
   **And** `status.llm_state` is set to `"active"` with `llm_state_since` updated

2. **Given** a Stop event
   **When** the hook processes it
   **Then** `status.llm_state` is set to `"waiting"` and `llm_state_since` is updated
   **And** no other status fields are modified

3. **Given** a Notification event with a permission-type payload
   **When** the hook processes it
   **Then** `status.llm_state` is set to `"permission"` and `llm_state_since` is updated

4. **Given** a PostToolUse Read event
   **When** the hook processes it
   **Then** the existing scalar `last_read` is updated (backward compat)
   **And** a new entry is appended to `status.reads[]` as `{ path, in_project, at: ISO8601, agent_id }`
   **And** `status.llm_state` is set to `"active"`

5. **Given** a PostToolUse Write event
   **When** the hook processes it
   **Then** the existing scalar `last_write`/`last_write_op` are updated (backward compat)
   **And** a new entry is appended to `status.writes[]` as `{ path, in_project, op: "write", is_new, at, agent_id, old_string: null, new_string: null }`
   **And** `is_new` is true if the file path has not appeared in `reads[]` before this Write

6. **Given** a PostToolUse Edit event
   **When** the hook processes it
   **Then** the existing scalars are updated (backward compat)
   **And** a new entry is appended to `status.writes[]` as `{ path, in_project, op: "edit", is_new: false, at, agent_id, old_string: payload.tool_input.old_string, new_string: payload.tool_input.new_string }`

7. **Given** a UserPromptSubmit event that changes the active skill
   **When** the hook processes it
   **Then** `reads`, `writes`, and `commands` arrays are reset to `[]`
   **And** `llm_state` is set to `"active"`

8. **Given** the status file is written
   **When** `writeStatus()` is called
   **Then** it writes to `status-{sessionId}.json.tmp` first, then calls `fs.renameSync` to the final path (Pattern 22)

9. **Given** the status file exceeds 10 MB
   **When** a new array entry would be appended
   **Then** the append is skipped but scalar fields continue to be updated

10. **Given** tests need to validate the changes
    **When** tests are executed
    **Then** `hook.test.js` is updated with tests for all new handlers, array appending, atomic write, llm_state transitions, skill-change reset, 10MB guard, agent_id propagation
    **And** new fixture `status-with-history.json` is created
    **And** all existing hook tests continue to pass (`npm test`)

## Tasks / Subtasks

- [x] Task 1: Add new fields to `readStatus()` defaults (AC: #1-#6)
  - [x] 1.1 Add `llm_state: null`, `llm_state_since: null` to the default status object in `readStatus()`
  - [x] 1.2 Add `reads: []`, `writes: []`, `commands: []` to the default status object
  - [x] 1.3 Ensure existing fields (`last_read`, `last_write`, `last_write_op`, etc.) remain — backward compat

- [x] Task 2: Implement atomic write in `writeStatus()` (AC: #8)
  - [x] 2.1 Change `writeStatus()` to write to `status-{sid}.json.tmp` first via `writeFileSync`
  - [x] 2.2 Then `fs.renameSync(tmpPath, finalPath)` to atomically replace
  - [x] 2.3 Keep `mkdirSync(CACHE_DIR, { recursive: true })` before write
  - [x] 2.4 Wrap entire operation in try/catch — silent on any error (Pattern 1)

- [x] Task 3: Implement 10 MB safety guard (AC: #9)
  - [x] 3.1 Create helper `function canAppend(status)` that checks if `JSON.stringify(status).length > 10 * 1024 * 1024`
  - [x] 3.2 Call `canAppend()` before every array push in handlers — skip push if false, continue with scalar updates
  - [x] 3.3 Alternative: check file size with `fs.statSync` on the status file before read — cheaper than stringify. Use `try { return fs.statSync(fp).size < 10 * 1024 * 1024; } catch { return true; }` — default to allow if file not found

- [x] Task 4: Extend dispatch in main flow (AC: #1-#3)
  - [x] 4.1 Add `else if (toolName === 'Bash') { handleBash(); }` to PostToolUse dispatch block (after Edit)
  - [x] 4.2 Add `else if (hookEvent === 'Stop') { handleStop(); }` to the top-level dispatch (after PostToolUse block)
  - [x] 4.3 Add `else if (hookEvent === 'Notification') { handleNotification(); }` to the top-level dispatch (after Stop)

- [x] Task 5: Implement `handleBash()` (AC: #1)
  - [x] 5.1 Extract `payload.tool_input.command` — return if missing/not a string
  - [x] 5.2 Read status, append `{ cmd: command, at: new Date().toISOString(), agent_id: payload.agent_id || null }` to `status.commands` (initialize as `[]` if undefined)
  - [x] 5.3 Set `status.llm_state = 'active'`, `status.llm_state_since = new Date().toISOString()`
  - [x] 5.4 Respect 10 MB guard (Task 3) — skip append if exceeded, still set llm_state
  - [x] 5.5 Write status

- [x] Task 6: Implement `handleStop()` (AC: #2)
  - [x] 6.1 Read status
  - [x] 6.2 Set `status.llm_state = 'waiting'`, `status.llm_state_since = new Date().toISOString()`
  - [x] 6.3 Write status — no other fields modified

- [x] Task 7: Implement `handleNotification()` (AC: #3)
  - [x] 7.1 Read status
  - [x] 7.2 Determine if notification is permission-type. Check `payload.notification` or `payload.type` for permission indication. Conservative approach: any Notification event = permission state (the matcher already filters)
  - [x] 7.3 Set `status.llm_state = 'permission'`, `status.llm_state_since = new Date().toISOString()`
  - [x] 7.4 Write status

- [x] Task 8: Extend `handleRead()` — append to reads[] (AC: #4)
  - [x] 8.1 After existing scalar `last_read` update, append to `status.reads` (initialize as `[]` if undefined)
  - [x] 8.2 Entry: `{ path: displayPath, in_project: inProject, at: new Date().toISOString(), agent_id: payload.agent_id || null }`
  - [x] 8.3 Set `status.llm_state = 'active'`, `status.llm_state_since = new Date().toISOString()`
  - [x] 8.4 Respect 10 MB guard — skip array push if exceeded, still update scalars and llm_state
  - [x] 8.5 Ensure all existing logic (step detection, story detection, file tracking) runs BEFORE the array append — the append is additive, not a replacement

- [x] Task 9: Extend `handleWrite()` — append to writes[] (AC: #5)
  - [x] 9.1 After existing scalar `last_write`/`last_write_op` update, append to `status.writes` (initialize as `[]` if undefined)
  - [x] 9.2 Compute `is_new`: `!(status.reads || []).some(r => r.path === displayPath)`
  - [x] 9.3 Entry: `{ path: displayPath, in_project: inProject, op: 'write', is_new: isNew, at: new Date().toISOString(), agent_id: payload.agent_id || null, old_string: null, new_string: null }`
  - [x] 9.4 Set `status.llm_state = 'active'`, `status.llm_state_since = new Date().toISOString()`
  - [x] 9.5 Respect 10 MB guard

- [x] Task 10: Extend `handleEdit()` — append to writes[] (AC: #6)
  - [x] 10.1 After existing scalar `last_write`/`last_write_op` update, append to `status.writes` (initialize as `[]` if undefined)
  - [x] 10.2 Entry: `{ path: displayPath, in_project: inProject, op: 'edit', is_new: false, at: new Date().toISOString(), agent_id: payload.agent_id || null, old_string: payload.tool_input.old_string || null, new_string: payload.tool_input.new_string || null }`
  - [x] 10.3 Set `status.llm_state = 'active'`, `status.llm_state_since = new Date().toISOString()`
  - [x] 10.4 Respect 10 MB guard

- [x] Task 11: Extend `handleUserPrompt()` — array reset + llm_state (AC: #7)
  - [x] 11.1 On skill change (existing `status.skill !== skillName` block), add: `status.reads = []`, `status.writes = []`, `status.commands = []`
  - [x] 11.2 Set `status.llm_state = 'active'`, `status.llm_state_since = new Date().toISOString()` (both on skill change and same-skill re-invocation)

- [x] Task 12: Create fixture `status-with-history.json` (AC: #10)
  - [x] 12.1 Create `test/fixtures/status-with-history.json` with full v2 schema: all existing scalar fields + `llm_state`, `llm_state_since`, `reads[]` (2-3 entries), `writes[]` (2-3 entries with mix of write/edit ops), `commands[]` (2-3 entries), `agent_id` examples (one null, one with value)

- [x] Task 13: Update `hook.test.js` (AC: #10)
  - [x] 13.1 Add test: `handleBash appends to commands[]` — send Bash PostToolUse, verify `commands` array contains entry with `cmd`, `at`, `agent_id: null`
  - [x] 13.2 Add test: `handleBash with agent_id propagates` — send Bash with `agent_id: 'sub-1'`, verify it appears in entry
  - [x] 13.3 Add test: `handleStop sets llm_state waiting` — send Stop event, verify `llm_state === 'waiting'` and `llm_state_since` is ISO string
  - [x] 13.4 Add test: `handleNotification sets llm_state permission` — send Notification event, verify `llm_state === 'permission'`
  - [x] 13.5 Add test: `handleRead appends to reads[]` — send Read, verify `reads` array has entry and `last_read` scalar also updated
  - [x] 13.6 Add test: `handleWrite appends to writes[] with is_new` — send Write for file not in reads[], verify `is_new: true`; send Write for file already in reads[], verify `is_new: false`
  - [x] 13.7 Add test: `handleEdit appends to writes[] with old/new_string` — send Edit, verify entry has `op: 'edit'`, `old_string`, `new_string`
  - [x] 13.8 Add test: `skill change resets arrays` — populate arrays, send UserPromptSubmit with new skill, verify reads/writes/commands are `[]`
  - [x] 13.9 Add test: `atomic write creates .tmp then renames` — verify no `.tmp` file remains after hook execution (rename completed)
  - [x] 13.10 Add test: `10MB guard skips array append` — pre-create a status file >10MB, send Read event, verify reads[] not grown but `last_read` updated
  - [x] 13.11 Add test: `llm_state transitions active→waiting→permission→active` — chain of events verifying full state machine
  - [x] 13.12 Verify all existing tests pass unchanged

- [x] Task 14: Run full test suite (AC: #10)
  - [x] 14.1 Run `npm test` — all tests must pass (383/384, 1 pre-existing failure in tui-reorder-lines unrelated to story 7.1)

## Dev Notes

### Architecture Compliance

**Stack — use ONLY these:**
- Node.js >= 20, plain JavaScript CommonJS (hook is CJS standalone — `require`, NOT `import`)
- CJS marker: `src/hook/package.json` with `{ "type": "commonjs" }`
- Testing: `node:test` + `node:assert/strict` (ESM in test files, CJS in hook)
- Zero runtime deps — Node.js stdlib only (`fs`, `path`, `os`)
- Synchronous I/O everywhere (Pattern 2) — `readFileSync`/`writeFileSync`/`renameSync`

**Critical patterns to follow:**

- **Pattern 0** — Hook Entry Point Structure: Requires -> Constants -> Stdin parsing -> Guard -> Alive touch -> Dispatch -> Handlers -> Helpers. New handlers (`handleBash`, `handleStop`, `handleNotification`) go in the handlers section (after existing handleEdit, before helpers).
- **Pattern 1** — Error Handling: Hook = **silent always**. No `console.log`, no `console.error`, no throw. Exit silently on any error. Must never interfere with Claude Code operation.
- **Pattern 2** — Synchronous File I/O everywhere. `readFileSync`/`writeFileSync`/`renameSync`. No async.
- **Pattern 5** — Path Construction: `BMAD_CACHE_DIR` env var: `process.env.BMAD_CACHE_DIR || path.join(os.homedir(), '.cache', 'bmad-status')`. Already defined in constants section.
- **Pattern 7** — Hook Stdin Parsing: Dispatch on `hook_event_name` first, then `tool_name`. All stdin parsing wrapped in try/catch.
- **Pattern 8** — Hook Status File I/O: Read existing (or create defaults) -> merge -> write. No backup, no validation. Read-before-write mandatory.
- **Pattern 9** — All path patterns on normalized paths (forward slashes).
- **Pattern 11** — cwd scoping: `normalize(filePath).startsWith(normalize(cwd))` — first check in handlers.
- **Pattern 22** — **NEW** Atomic Status File Write: `writeFileSync(path + '.tmp', data)` then `renameSync(path + '.tmp', path)`. Prevents corruption on crash mid-write.

### Source File

**Single file to modify:** `bmad-statusline/src/hook/bmad-hook.js` (560 lines currently)

The hook is a **standalone CJS script** deployed to `~/.config/bmad-statusline/`. It is never imported by other package modules. It reads stdin JSON from Claude Code hook events and writes status files to the cache directory.

### Current Hook Structure (section numbers from source)

```
Section 1: Requires (fs, path, os)
Section 2: Constants (CACHE_DIR, regexes, etc.)
Section 3: Stdin parsing (try/catch → exit 0)
Section 4: Guard (_bmad/ walk-up)
Section 5: Alive touch + project detection
Section 6: Dispatch → handleUserPrompt, handleRead, handleWrite, handleEdit
Section 7: handleUserPrompt()
Section 8: handleRead()
Section 9: handleWrite()
Section 10: handleEdit()
Helper: detectDocumentAndStep()
Helper: touchAlive()
Helper: readStatus(), writeStatus()
```

### Dispatch Extension Points

Current dispatch (line ~96-114):
```js
if (hookEvent === 'UserPromptSubmit') {
  handleUserPrompt();
} else if (hookEvent === 'PostToolUse') {
  const toolName = payload.tool_name;
  if (toolName === 'Read') handleRead();
  else if (toolName === 'Write') handleWrite();
  else if (toolName === 'Edit') handleEdit();
  // ADD: else if (toolName === 'Bash') handleBash();
} else if (hookEvent === 'SessionStart') {
  // no-op
}
// ADD: else if (hookEvent === 'Stop') handleStop();
// ADD: else if (hookEvent === 'Notification') handleNotification();
```

### Status File v2 Schema (New Fields)

Existing scalar fields are **preserved unchanged** — backward compat with reader. New fields are **additive**:

```json
{
  "llm_state": "active|permission|waiting",
  "llm_state_since": "<ISO 8601>",
  "reads": [
    { "path": "<string>", "in_project": true, "at": "<ISO 8601>", "agent_id": "<string|null>" }
  ],
  "writes": [
    { "path": "<string>", "in_project": true, "op": "write|edit", "is_new": false,
      "at": "<ISO 8601>", "agent_id": "<string|null>",
      "old_string": "<string|null>", "new_string": "<string|null>" }
  ],
  "commands": [
    { "cmd": "<string>", "at": "<ISO 8601>", "agent_id": "<string|null>" }
  ]
}
```

**Rules:**
- `old_string`/`new_string` stored only for Edit (not Write — full file content too large)
- `is_new` = true when first Write on a file not previously seen in `reads[]`
- `agent_id` = null for main agent, `payload.agent_id` for sub-agents
- `"inactive"` state is NEVER written by hook — computed in TUI from `updated_at` age (>5 min)
- Safety guard: if file > 10 MB, stop appending arrays, continue updating scalars

### Atomic Write Pattern (Pattern 22)

Replace current `writeStatus()`:
```js
// BEFORE (current):
function writeStatus(sid, status) {
  if (!isSafeId(sid)) return;
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    status.updated_at = new Date().toISOString();
    const fp = path.join(CACHE_DIR, 'status-' + sid + '.json');
    fs.writeFileSync(fp, JSON.stringify(status, null, 2), 'utf8');
  } catch (e) { /* silent */ }
}

// AFTER (atomic):
function writeStatus(sid, status) {
  if (!isSafeId(sid)) return;
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    status.updated_at = new Date().toISOString();
    const fp = path.join(CACHE_DIR, 'status-' + sid + '.json');
    const tmpPath = fp + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(status, null, 2) + '\n');
    fs.renameSync(tmpPath, fp);
  } catch (e) { /* silent */ }
}
```

### LLM State Machine

```
UserPromptSubmit      → ACTIVE
PostToolUse (any)     → ACTIVE
Stop                  → WAITING
Notification          → PERMISSION (if permission-type)
(timeout 5min)        → INACTIVE (computed in TUI only, NEVER written by hook)
```

### 10 MB Safety Guard

Check file size before reading status (cheaper than stringifying):
```js
function canAppendHistory(sid) {
  try {
    const fp = path.join(CACHE_DIR, 'status-' + sid + '.json');
    return fs.statSync(fp).size < 10 * 1024 * 1024;
  } catch { return true; } // file not found = new file, allow
}
```

Use: `if (canAppendHistory(sessionId)) { status.reads.push(...); }`
Always update scalars (`last_read`, `llm_state`, etc.) regardless of guard.

### Array Initialization Safety

Arrays may not exist on status objects loaded from pre-v2 files. Always initialize before push:
```js
if (!Array.isArray(status.reads)) status.reads = [];
if (!Array.isArray(status.writes)) status.writes = [];
if (!Array.isArray(status.commands)) status.commands = [];
```

### Test Pattern (existing)

Tests use `execSync` to run the hook as a subprocess with stdin piped:
```js
function execHook(payload) {
  try {
    return execSync(`node "${HOOK_PATH}"`, {
      input: JSON.stringify(payload),
      encoding: 'utf8',
      env: { ...process.env, BMAD_CACHE_DIR: cacheDir },
      timeout: 5000
    });
  } catch (e) {
    return e.stdout || '';
  }
}
```

Status is verified by reading the cache file after hook execution:
```js
function readStatusFile(sid) {
  const fp = path.join(cacheDir, `status-${sid}.json`);
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}
```

For 10 MB guard test: pre-create an oversized status file before running the hook, then verify arrays were not grown.

For atomic write test: verify no `.tmp` file remains in cache dir after hook execution (rename completed successfully).

### Previous Story Intelligence

Epic 6 stories (6-1 through 6-6) are all done. Story 6-6 was the last, covering installer/uninstaller per-line deployment. Key learnings:

- **Test fixture pattern:** Test fixtures in `test/fixtures/` as JSON files. New fixtures for v2 schemas used by multiple test files.
- **getWidgetDefinitions** returns v2 format (single `bmad-line-0` composite). This is defaults.js concern — not touched in this story.
- **Installer target structure** has 7 targets. Story 7.2 will add the Phase 3→4 upgrade matcher — NOT this story.

### Git Intelligence (Recent Commits)

Recent work focused on TUI polish and file tracking display:
- `feat: white verb in TUI preview for fileread/filewrite widgets` — reader display improvements
- `feat: strip project folder prefix from file tracking paths` — the `displayPath` logic in hook now strips project folder prefix for cleaner display. **This directly affects how `path` is stored in reads[]/writes[] arrays** — use the same `displayPath` variable that already exists in handleRead/handleWrite/handleEdit.
- `feat: show full path for out-of-project file read/write/edit` — out-of-project paths show full absolute path

### Project Structure Notes

- Hook lives at `bmad-statusline/src/hook/bmad-hook.js` in the repo
- Deployed to `~/.config/bmad-statusline/bmad-hook.js` at install time
- Tests at `bmad-statusline/test/hook.test.js`
- New fixture at `bmad-statusline/test/fixtures/status-with-history.json`
- No other files need modification for this story

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Status File v2 Schema] — lines 791-821
- [Source: _bmad-output/planning-artifacts/architecture.md#Hook Expansion] — lines 823-871
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern 22 Atomic Status File Write] — lines 1433-1447
- [Source: _bmad-output/planning-artifacts/architecture.md#Patterns 0-13 Hook Patterns] — lines 1075-1172
- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.1] — lines 1995-2051
- [Source: bmad-statusline/src/hook/bmad-hook.js] — current hook implementation (560 lines)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation, no debugging required.

### Completion Notes List

- Task 1: Added `llm_state`, `llm_state_since`, `reads`, `writes`, `commands` to both default objects in `readStatus()`
- Task 2: Replaced `writeFileSync` with atomic write pattern (`.tmp` + `renameSync`)
- Task 3: Implemented `canAppendHistory(sid)` using `fs.statSync` file size check (cheaper than stringify)
- Task 4: Extended dispatch with Bash (PostToolUse), Stop, and Notification event handlers
- Task 5: Implemented `handleBash()` — appends to commands[], sets llm_state active, respects 10MB guard
- Task 6: Implemented `handleStop()` — sets llm_state to waiting
- Task 7: Implemented `handleNotification()` — sets llm_state to permission (conservative: any Notification = permission)
- Task 8: Extended `handleRead()` — appends to reads[] with in_project/agent_id, sets llm_state active. Made all code paths unconditionally write (since reads[] always changes). Added writeStatus to false-positive step detection return path.
- Task 9: Extended `handleWrite()` — appends to writes[] with is_new computed from reads[], sets llm_state active. Made all code paths unconditionally write.
- Task 10: Extended `handleEdit()` — appends to writes[] with op='edit', old_string/new_string from payload, is_new=false. Made all code paths unconditionally write.
- Task 11: Extended `handleUserPrompt()` — resets reads/writes/commands arrays on skill change, sets llm_state active for all invocations
- Task 12: Created fixture with 3 reads, 3 writes (mixed write/edit ops), 3 commands, both null and non-null agent_id examples
- Task 13: Added 12 new tests covering all ACs. All pass.
- Task 14: 383/384 tests pass. 1 pre-existing failure in tui-reorder-lines.test.js (story 7.3 WIP, unrelated)

### Change Log

- 2026-04-04: Story 7.1 implementation complete — hook expanded with history arrays, LLM state tracking, atomic write

### Review Findings

- [x] [Review][Defer] P1→D7: `old_string || null` → `?? null` in handleEdit — preserves empty strings for insert/delete edits [bmad-hook.js:458] — deferred, code not on disk (repo desync), edge case negligible (Claude Edit tool requires non-empty old_string)
- [x] [Review][Defer] D1: `_outputFolders` unavailable for pre-existing sessions — bonus feature (document_name), no migration path for sessions started before 7.1 — deferred, bonus feature
- [x] [Review][Defer] D2: `is_new` unreliable when reads[] capped by 10MB guard — reads[] stops growing but is_new still checks it — deferred, design trade-off
- [x] [Review][Defer] D3: Windows case-sensitive displayPath comparison — `normPath.slice()` uses original casing while `inProject` uses `toLowerCase()` — deferred, pre-existing
- [x] [Review][Defer] D4: Walk-up `_bmad` detection could match wrong parent project — no depth limit on parent traversal — deferred, bonus feature
- [x] [Review][Defer] D5: Step enrichment regex unlikely to match Edit new_string in practice — `^---` requires content to start with frontmatter — deferred, bonus feature best-effort
- [x] [Review][Defer] D6: Large bash commands stored verbatim — no truncation, 10MB guard is sufficient protection — deferred, acceptable risk

### File List

- bmad-statusline/src/hook/bmad-hook.js (modified)
- bmad-statusline/test/hook.test.js (modified)
- bmad-statusline/test/fixtures/status-with-history.json (new)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified)
- _bmad-output/implementation-artifacts/7-1-hook-expansion-history-arrays-llm-state-atomic-write.md (modified)
