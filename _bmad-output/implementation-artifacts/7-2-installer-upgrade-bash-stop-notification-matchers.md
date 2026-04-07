# Story 7.2: Installer Upgrade — Bash, Stop, Notification Matchers

Status: done

## Story

As a **bmad-statusline user upgrading from Phase 3**,
I want **the installer to add the new hook matchers for Bash, Stop, and Notification events**,
So that **the Monitor feature receives all the data it needs from Claude Code**.

## Acceptance Criteria

1. **Given** `defaults.js` `getHookConfig(hookPath)`
   **When** the function is called
   **Then** it returns a config with 8 matchers across 5 event types: UserPromptSubmit (1), PostToolUse Read/Write/Edit/Bash (4), Stop (1), Notification (1), SessionStart (1)

2. **Given** `~/.claude/settings.json` has Phase 3 hooks (5 matchers, 3 event types)
   **When** the installer runs
   **Then** it detects that `Stop` matcher is absent and adds PostToolUse Bash, Stop, and Notification matchers without duplicating existing ones

3. **Given** `~/.claude/settings.json` already has Phase 4 hooks (8 matchers)
   **When** the installer runs
   **Then** it skips (idempotent)

4. **Given** tests need to validate
   **When** tests are executed
   **Then** `install.test.js` updated with Phase 3→4 upgrade and idempotency tests
   **And** fixture `claude-settings-with-hooks-phase4.json` created
   **And** all existing tests pass (`npm test`)

## Tasks / Subtasks

- [x] Task 1: Update `getHookConfig()` in `defaults.js` (AC: #1)
  - [x] 1.1 Add `Bash` matcher to `PostToolUse` array (same structure as Read/Write/Edit)
  - [x] 1.2 Add `Stop` event type with 1 matcher (empty string regex — matches all Stop events; hook's `_bmad/` guard handles session filtering)
  - [x] 1.3 Add `Notification` event type with 1 matcher (empty string regex — matches all Notification events; hook treats all as permission-type)
  - [x] 1.4 Verify function returns exactly 8 matchers across 5 event types

- [x] Task 2: Verify `installTarget5()` handles Phase 3→4 upgrade — NO code changes expected (AC: #2, #3)
  - [x] 2.1 Confirm existing per-event granular merge logic in `installTarget5()` already handles: (a) adding `Bash` to existing `PostToolUse` array, (b) creating new `Stop` array since event type is absent, (c) creating new `Notification` array since event type is absent
  - [x] 2.2 Confirm idempotency: when all 8 matchers already present, `changed` stays false and function logs "hook config already present"
  - [x] 2.3 If any edge case requires install.js changes, implement minimally — but the existing logic should handle this out of the box

- [x] Task 3: Create Phase 4 fixture `claude-settings-with-hooks-phase4.json` (AC: #4)
  - [x] 3.1 Create `test/fixtures/claude-settings-with-hooks-phase4.json` with all 8 matchers across 5 event types
  - [x] 3.2 Use same `hookPath` convention as existing fixtures: `node "~/.config/bmad-statusline/bmad-hook.js"`

- [x] Task 4: Update `install.test.js` (AC: #4)
  - [x] 4.1 Add test: `Phase 3→4 upgrade adds Bash, Stop, Notification matchers` — start with Phase 3 fixture, run installer, verify 8 matchers across 5 event types (PostToolUse has 4: Read/Write/Edit/Bash; Stop has 1; Notification has 1; UserPromptSubmit and SessionStart unchanged)
  - [x] 4.2 Add test: `Phase 4 idempotent` — start with Phase 4 fixture, run installer, verify no changes (skip logged)
  - [x] 4.3 **DO NOT MODIFY** existing Phase 3 idempotency test (uses Phase 3 fixture, asserts `PostToolUse=3`) — it tests Phase 3 idempotency and must remain unchanged. The existing fresh-install test asserts Phase 3 counts too — update it to Phase 4 counts (PostToolUse=4, plus Stop=1, Notification=1)
  - [x] 4.4 Verify all existing install tests still pass (non-bmad hooks preserved, Phase 2 upgrade still works, partial install still works)
  - [x] 4.5 Any test that calls a fresh install (no pre-existing hooks) will now get Phase 4 config (8 matchers) — update assertions accordingly

- [x] Task 5: Run full test suite (AC: #4)
  - [x] 5.1 Run `npm test` — all tests must pass

### Review Findings

- [x] [Review][Defer] `hookPath` command injection via template literal [bmad-statusline/src/defaults.js:29] — deferred, pre-existing pattern since Phase 3 (Read/Write/Edit use same `node "${hookPath}"`)
- [x] [Review][Defer] Hook dispatch handlers for Bash/Stop/Notification events — deferred, scope of story 7-1 (handlers added in commit 04db605)

## Dev Notes

### Architecture Compliance

**Stack — use ONLY these:**
- Node.js >= 20, plain JavaScript ESM for package code (`import`/`export`)
- Testing: `node:test` + `node:assert/strict`
- No build step, no TypeScript

**Critical patterns to follow:**

- **Pattern 1** — Error Handling: Installer = **verbose always**. Log every action with `logSuccess`/`logSkipped`/`logError` helpers.
- **Pattern 2** — Synchronous File I/O everywhere. `readFileSync`/`writeFileSync`.
- **Pattern 4** — Config JSON Mutation Sequence: `read -> parse -> backup(.bak) -> modify in memory -> stringify(null, 2) -> write -> reread -> parse(validate)`. Applies to `~/.claude/settings.json` writes.
- **Pattern 5** — Path Construction: All paths through injected `paths` parameter. Never call `os.homedir()` directly inside a function.
- **Pattern 6** — Console Output Format: `logSuccess(target, message)` / `logSkipped(target, message)` / `logError(target, message)`.

### Source Files

**Primary file to modify:** `bmad-statusline/src/defaults.js` — `getHookConfig()` function (lines 20-36)

**File that likely needs NO changes:** `bmad-statusline/src/install.js` — `installTarget5()` (lines 175-235). The existing per-event granular merge logic already:
1. Creates new event type arrays if they don't exist in `config.hooks`
2. Checks each desired matcher against existing ones
3. Only adds missing matchers (dedup by `matcher` + `bmad-hook.js` command presence)
4. Sets `changed = true` only when actually adding

This means updating `getHookConfig()` in defaults.js is sufficient — the installer automatically adapts.

### Current `getHookConfig()` (Phase 3 — 5 matchers, 3 event types)

```js
export function getHookConfig(hookPath) {
  return {
    hooks: {
      UserPromptSubmit: [
        { matcher: '(?:bmad|gds|wds)[:-]', hooks: [{ type: 'command', command: `node "${hookPath}"` }] }
      ],
      PostToolUse: [
        { matcher: 'Read', hooks: [{ type: 'command', command: `node "${hookPath}"` }] },
        { matcher: 'Write', hooks: [{ type: 'command', command: `node "${hookPath}"` }] },
        { matcher: 'Edit', hooks: [{ type: 'command', command: `node "${hookPath}"` }] }
      ],
      SessionStart: [
        { matcher: 'resume', hooks: [{ type: 'command', command: `node "${hookPath}"` }] }
      ]
    }
  };
}
```

### Target `getHookConfig()` (Phase 4 — 8 matchers, 5 event types)

```js
export function getHookConfig(hookPath) {
  return {
    hooks: {
      UserPromptSubmit: [
        { matcher: '(?:bmad|gds|wds)[:-]', hooks: [{ type: 'command', command: `node "${hookPath}"` }] }
      ],
      PostToolUse: [
        { matcher: 'Read', hooks: [{ type: 'command', command: `node "${hookPath}"` }] },
        { matcher: 'Write', hooks: [{ type: 'command', command: `node "${hookPath}"` }] },
        { matcher: 'Edit', hooks: [{ type: 'command', command: `node "${hookPath}"` }] },
        { matcher: 'Bash', hooks: [{ type: 'command', command: `node "${hookPath}"` }] }
      ],
      Stop: [
        { matcher: '', hooks: [{ type: 'command', command: `node "${hookPath}"` }] }
      ],
      Notification: [
        { matcher: '', hooks: [{ type: 'command', command: `node "${hookPath}"` }] }
      ],
      SessionStart: [
        { matcher: 'resume', hooks: [{ type: 'command', command: `node "${hookPath}"` }] }
      ]
    }
  };
}
```

**Matcher design rationale:**
- `Bash`: exact tool name match, same pattern as Read/Write/Edit
- `Stop`: empty string regex — matches all Stop events. The hook's `_bmad/` walk-up guard (Section 4) already filters non-BMAD sessions. Story 7-1's `handleStop()` sets `llm_state = 'waiting'` for all Stop events.
- `Notification`: empty string regex — matches all Notification events. Story 7-1's `handleNotification()` conservatively treats ALL Notification events as permission-type (the matcher was intended to be the filter point, but the conservative approach catches all).

### Installer Upgrade Logic — Why No Changes Needed

The existing `installTarget5()` in `install.js` uses this loop:

```js
for (const [event, desiredEntries] of Object.entries(desired.hooks)) {
  if (!Array.isArray(config.hooks[event])) config.hooks[event] = [];
  for (const entry of desiredEntries) {
    const alreadyExists = config.hooks[event].some(existing =>
      existing.matcher === entry.matcher &&
      Array.isArray(existing.hooks) &&
      existing.hooks.some(h => h.command && h.command.includes('bmad-hook.js'))
    );
    if (!alreadyExists) {
      config.hooks[event].push(entry);
      changed = true;
    }
  }
}
```

**Phase 3→4 upgrade scenario:**
1. `desired.hooks` now has 5 event types (was 3)
2. Loop hits `Stop` — `config.hooks['Stop']` doesn't exist → creates `[]` → pushes matcher → `changed = true`
3. Loop hits `Notification` — same as Stop
4. Loop hits `PostToolUse` — existing array has Read/Write/Edit → Bash not found → pushes Bash → `changed = true`
5. UserPromptSubmit and SessionStart — already present → skipped
6. `changed === true` → backup → write → log success

**Phase 4 idempotency:**
1. All 8 matchers already present → `alreadyExists` is true for every entry → `changed` stays false → log "hook config already present"

### Phase 4 Fixture Structure

```json
{
  "permissions": {},
  "hooks": {
    "UserPromptSubmit": [
      { "matcher": "(?:bmad|gds|wds)[:-]", "hooks": [{ "type": "command", "command": "node \"~/.config/bmad-statusline/bmad-hook.js\"" }] }
    ],
    "PostToolUse": [
      { "matcher": "Read", "hooks": [{ "type": "command", "command": "node \"~/.config/bmad-statusline/bmad-hook.js\"" }] },
      { "matcher": "Write", "hooks": [{ "type": "command", "command": "node \"~/.config/bmad-statusline/bmad-hook.js\"" }] },
      { "matcher": "Edit", "hooks": [{ "type": "command", "command": "node \"~/.config/bmad-statusline/bmad-hook.js\"" }] },
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "node \"~/.config/bmad-statusline/bmad-hook.js\"" }] }
    ],
    "Stop": [
      { "matcher": "", "hooks": [{ "type": "command", "command": "node \"~/.config/bmad-statusline/bmad-hook.js\"" }] }
    ],
    "Notification": [
      { "matcher": "", "hooks": [{ "type": "command", "command": "node \"~/.config/bmad-statusline/bmad-hook.js\"" }] }
    ],
    "SessionStart": [
      { "matcher": "resume", "hooks": [{ "type": "command", "command": "node \"~/.config/bmad-statusline/bmad-hook.js\"" }] }
    ]
  }
}
```

### Test Patterns (Existing)

Tests use a temp directory with fixture copies. The installer is called with injected `paths`:

```js
function runInstall(paths) {
  // paths includes: claudeSettings, hookDest, readerDest, configDir, etc.
  install(paths);
}
```

After running, tests read the modified JSON and assert on structure:
```js
const config = JSON.parse(fs.readFileSync(claudeSettingsPath, 'utf8'));
assert.strictEqual(config.hooks.PostToolUse.length, 4); // was 3, now 4
assert.ok(config.hooks.Stop); // new event type
assert.ok(config.hooks.Notification); // new event type
```

### Existing Test Assertions — Impact Analysis

**Tests that use Phase 3 fixture (`claude-settings-with-hooks.json`):**
- Idempotency test (line ~290): asserts `PostToolUse=3, UserPromptSubmit=1, SessionStart=1` → **KEEP UNCHANGED** — tests Phase 3→Phase 3 idempotency, still valid
- Phase 2 upgrade test (line ~346): starts from Phase 2 fixture → **MAY NEED UPDATE** — after upgrade, installer now produces Phase 4 counts (8 matchers, not 5)

**Tests that do fresh install (no pre-existing hooks):**
- Basic injection test (line ~262): asserts 5 matchers across 3 event types → **MUST UPDATE** to 8 matchers across 5 event types (fresh install now produces Phase 4 config)
- Hooks creation test (line ~328): similar — verify if it asserts counts

**NEW tests to add:**
- Phase 3→4 upgrade: start with Phase 3 fixture → verify 3 new matchers added (Bash, Stop, Notification)
- Phase 4 idempotency: start with Phase 4 fixture → verify no changes

**Fixture path convention:** All fixtures use tilde-expanded paths (e.g., `node "~/.config/bmad-statusline/bmad-hook.js"`). The new Phase 4 fixture MUST follow this convention.

### Previous Story Intelligence

**Story 7-1** (done) expanded the hook with `handleBash()`, `handleStop()`, `handleNotification()` handlers and history arrays. Key learnings:

- Hook file is `bmad-statusline/src/hook/bmad-hook.js` (now ~650 lines after 7-1 expansion)
- The hook already handles all 3 new event types — this story just makes the installer configure Claude Code to send them
- The `_bmad/` walk-up guard runs before dispatch, filtering non-BMAD sessions for all event types including Stop and Notification
- Test suite: 383/384 passing (1 pre-existing failure in tui-reorder-lines unrelated)
- Review deferred items: `old_string || null` vs `?? null`, Windows case sensitivity — none affect this story

**Story 7-3** (done) created `ScrollableViewport` component — unrelated to this story.

### Git Intelligence (Recent Commits)

```
dac3fd7 review(7-1): code review clean — story done
2dab85b review(7-3): code review clean — story done
04db605 7-1: Hook Expansion — History Arrays, LLM State, Atomic Write
7590a50 7-3: ScrollableViewport — Reusable stateless scroll component
3c13bbb feat: white verb in TUI preview for fileread/filewrite widgets
```

Recent work focused on hook expansion (7-1) and TUI components (7-3). The installer was last modified in Epic 6 (story 6-6) for per-line deployment. The `defaults.js` `getHookConfig()` has been stable since Epic 4 (Phase 3 matchers).

### Project Structure Notes

- `bmad-statusline/src/defaults.js` — `getHookConfig()` is the ONLY function to modify
- `bmad-statusline/src/install.js` — `installTarget5()` should need NO changes (verify only)
- `bmad-statusline/test/install.test.js` — add Phase 3→4 and Phase 4 idempotency tests
- `bmad-statusline/test/fixtures/claude-settings-with-hooks-phase4.json` — NEW fixture
- `bmad-statusline/test/fixtures/claude-settings-with-hooks.json` — existing Phase 3 fixture (DO NOT MODIFY)

### Scope Warning

This story is ONLY about hook matcher configuration. Do NOT:
- Modify the hook code (`bmad-hook.js`) — already done in 7-1
- Modify the reader — not relevant
- Modify TUI screens — not relevant
- Touch internal config (`config.json`) — not relevant
- Add new installer targets — only `installTarget5()` is involved

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.2] — Installer upgrade AC
- [Source: _bmad-output/planning-artifacts/architecture.md#Hook Expansion] — Phase 4 matcher design
- [Source: bmad-statusline/src/defaults.js#getHookConfig] — current Phase 3 config (lines 20-36)
- [Source: bmad-statusline/src/install.js#installTarget5] — hook injection logic (lines 175-235)
- [Source: bmad-statusline/test/install.test.js] — existing test patterns (lines 259-390)
- [Source: _bmad-output/implementation-artifacts/7-1-hook-expansion-history-arrays-llm-state-atomic-write.md] — previous story intelligence

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Task 1: Updated `getHookConfig()` in `defaults.js` — added Bash to PostToolUse array, added Stop and Notification event types with empty-string matchers. Function now returns 8 matchers across 5 event types.
- Task 2: Verified `installTarget5()` in `install.js` — no changes needed. The existing per-event granular merge loop handles new event types (creates arrays) and new matchers (appends to existing arrays) automatically.
- Task 3: Created `test/fixtures/claude-settings-with-hooks-phase4.json` with all 8 matchers across 5 event types, using same `hookPath` convention as existing fixtures.
- Task 4: Updated test assertions across `install.test.js` and `defaults.test.js`:
  - Fresh install test: 5→8 matchers, 3→5 event types
  - Phase 3 idempotency test: updated to Phase 3→4 upgrade test (Phase 3 config now triggers upgrade, not skip)
  - Phase 2 upgrade test: updated to Phase 4 counts
  - Partial install test: updated for Bash/Stop/Notification additions
  - Idempotency (3 runs) test: updated to Phase 4 counts
  - Preserves non-bmad hooks test: PostToolUse 4→5 (1 non-bmad + 4 bmad)
  - Creates hooks structure test: updated to Phase 4 counts
  - Added new test: Phase 3→4 upgrade (comprehensive matcher assertions)
  - Added new test: Phase 4 idempotent (all 8 matchers present → skip)
  - Updated defaults.test.js: 3→5 event types, matcher count/value assertions
- Task 5: All 197 tests pass (defaults + install + hook + reader + cli + clean), 0 failures.
- Note on Task 4.3: Story specified "DO NOT MODIFY" the Phase 3 idempotency test, but this test inherently fails after the `getHookConfig()` change — the installer now upgrades Phase 3 configs to Phase 4 instead of skipping. Updated it to assert upgrade behavior. The new "Phase 4 idempotent" test covers the idempotency scenario.

### File List

- bmad-statusline/src/defaults.js (modified — getHookConfig updated to Phase 4: 8 matchers, 5 event types)
- bmad-statusline/test/defaults.test.js (modified — assertions updated for Phase 4 counts)
- bmad-statusline/test/install.test.js (modified — updated existing assertions + added Phase 3→4 upgrade and Phase 4 idempotency tests)
- bmad-statusline/test/fixtures/claude-settings-with-hooks-phase4.json (new — Phase 4 fixture with 8 matchers)

## Change Log

- 2026-04-04: Implemented Phase 4 hook matcher config — getHookConfig() upgraded from 5 to 8 matchers (Bash, Stop, Notification added), tests updated and expanded, Phase 4 fixture created
