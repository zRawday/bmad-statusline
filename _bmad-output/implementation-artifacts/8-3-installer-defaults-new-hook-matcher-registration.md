# Story 8.3: Installer & defaults — New hook matcher registration

Status: done

## Story

As a **developer installing or upgrading bmad-statusline**,
I want **the 7 new hook matchers registered automatically**,
so that **PermissionRequest, StopFailure, SubagentStart/Stop, SessionEnd, PostToolUseFailure, and PermissionDenied events are captured**.

## Acceptance Criteria

1. **AC1 — getHookConfig returns 16 matchers / 13 event types.**
   `defaults.js` `getHookConfig(hookPath)` returns the complete Rev.5 hook config: UserPromptSubmit (1), PreToolUse (1), PostToolUse (4), PermissionRequest (1), PermissionDenied (1), PostToolUseFailure (1), Stop (1), StopFailure (1), Notification (1), SubagentStart (1), SubagentStop (1), SessionStart (1), SessionEnd (1). New matchers all use empty string `''`.

2. **AC2 — Fresh install writes all 16 matchers.**
   When `install.js` runs hook injection on a clean system (no existing hooks), all 16 matchers are written to `~/.claude/settings.json`.

3. **AC3 — Rev.4→Rev.5 upgrade adds missing matchers, preserves existing.**
   Given an existing Rev.4 install (current 12 matchers / 6 event types), install detects 7 missing Rev.5 event types and adds them. Existing matchers (including non-BMAD third-party hooks) are preserved unchanged.

4. **AC4 — Upgrade is idempotent.**
   Running install again after a Rev.5 upgrade is a no-op — no duplicates, no changes logged.

5. **AC5 — All tests pass.**
   Tests for `getHookConfig()` returning 16 matchers, fresh install writing all matchers, Rev.4→Rev.5 upgrade detecting and adding missing matchers, idempotency. All existing tests pass (`npm test`).

## Tasks / Subtasks

- [x] Task 1: Update `getHookConfig()` in `defaults.js` (AC: 1)
  - [x] Add 7 new event type entries: PermissionRequest, PermissionDenied, PostToolUseFailure, StopFailure, SubagentStart, SubagentStop, SessionEnd — each with `{ matcher: '', hooks: [{ type: 'command', command: cmd }] }`
  - [x] Reconcile existing matchers with architecture (see Dev Notes — current code vs architecture discrepancies)
  - [x] Verify total: 16 matchers across 13 event types
- [x] Task 2: Verify `installTarget5()` merge logic handles Rev.5 (AC: 2, 3, 4)
  - [x] The existing granular merge logic iterates `desired.hooks` and adds missing `(event, matcher)` pairs — verify it correctly handles 7 entirely new event types
  - [x] Verify existing Rev.4 matchers are preserved during upgrade (no removal, no modification)
  - [x] Verify non-BMAD third-party hooks in same event types are untouched
  - [x] Verify idempotency: second run detects all matchers present, logs skip
- [x] Task 3: Update tests (AC: 5)
  - [x] Update `defaults.test.js`: matcher count assertions (12→16, 6→13 event types), new event type presence and matcher values
  - [x] Update `install.test.js`: fresh install test (16 matchers), new Rev.4→Rev.5 upgrade test, update idempotency test with new counts
  - [x] Create or update fixture `claude-settings-with-hooks-phase4.json` for Rev.4→Rev.5 upgrade scenario (if existing fixture already represents Rev.4, reuse it)
  - [x] Verify all existing tests still pass (`npm test`)

## Dev Notes

### Critical: Current Code vs Architecture Discrepancies

The architecture prescribes 9 matchers / 6 event types for Rev.4, but `defaults.js` currently generates **12 matchers / 6 event types**:

| Event Type | Architecture (Rev.4) | Current Code | Target (Rev.5) |
|---|---|---|---|
| UserPromptSubmit | 1 (`(?:bmad\|gds\|wds)-`) | 1 (`''` wildcard) | 1 — see note below |
| PreToolUse | 1 (`''` wildcard) | 4 (`Read`, `Write`, `Edit`, `Bash`) | 1 (`''` wildcard) |
| PostToolUse | 4 (Read, Write, Edit, Bash) | 4 (Read, Write, Edit, Bash) | 4 (unchanged) |
| Stop | 1 (`''`) | 1 (`''`) | 1 (unchanged) |
| Notification | 1 (`''`) | 1 (`''`) | 1 (unchanged) |
| SessionStart | 1 (`resume`) | 1 (`resume`) | 1 (unchanged) |
| **7 new events** | — | — | 7 (`''` each) |
| **Total** | 9 / 6 | 12 / 6 | **16 / 13** |

**UserPromptSubmit matcher decision:** Current code uses `''` (wildcard — fires on ALL user prompts). Architecture prescribes `(?:bmad|gds|wds)-` (regex — fires only on skill prompts). The empty matcher was introduced for immediate waiting→active transition on any prompt (see commit `672fb60`). With Rev.5's `PreToolUse` wildcard and new event types providing state updates, the regex may be sufficient. **Decide based on architecture prescription** — the epic counts 16 matchers which matches architecture's regex approach.

**PreToolUse matcher decision:** Current code has 4 tool-specific matchers (Read, Write, Edit, Bash). Architecture prescribes 1 wildcard `''` matcher. The wildcard fires on ALL tool types (broader coverage). The target Rev.5 config uses the wildcard. **Change to single wildcard matcher.**

### Architecture-Prescribed Rev.5 Hook Config

Complete target config from architecture (lines 470-498, 988-1024):

```js
{
  UserPromptSubmit: [
    { matcher: '(?:bmad|gds|wds)-', hooks: [{ type: 'command', command: cmd }] }
  ],
  PreToolUse: [
    { matcher: '', hooks: [{ type: 'command', command: cmd }] }
  ],
  PostToolUse: [
    { matcher: 'Read',  hooks: [{ type: 'command', command: cmd }] },
    { matcher: 'Write', hooks: [{ type: 'command', command: cmd }] },
    { matcher: 'Edit',  hooks: [{ type: 'command', command: cmd }] },
    { matcher: 'Bash',  hooks: [{ type: 'command', command: cmd }] }
  ],
  PermissionRequest: [
    { matcher: '', hooks: [{ type: 'command', command: cmd }] }
  ],
  PermissionDenied: [
    { matcher: '', hooks: [{ type: 'command', command: cmd }] }
  ],
  PostToolUseFailure: [
    { matcher: '', hooks: [{ type: 'command', command: cmd }] }
  ],
  Stop: [
    { matcher: '', hooks: [{ type: 'command', command: cmd }] }
  ],
  StopFailure: [
    { matcher: '', hooks: [{ type: 'command', command: cmd }] }
  ],
  Notification: [
    { matcher: '', hooks: [{ type: 'command', command: cmd }] }
  ],
  SubagentStart: [
    { matcher: '', hooks: [{ type: 'command', command: cmd }] }
  ],
  SubagentStop: [
    { matcher: '', hooks: [{ type: 'command', command: cmd }] }
  ],
  SessionStart: [
    { matcher: 'resume', hooks: [{ type: 'command', command: cmd }] }
  ],
  SessionEnd: [
    { matcher: '', hooks: [{ type: 'command', command: cmd }] }
  ]
}
```

### Upgrade Logic — Why It Works for Rev.5

`installTarget5()` in `install.js` (lines 161-221) uses **granular per-event-type merge**:

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

For Rev.4→Rev.5 upgrade:
- **7 new event types** (PermissionRequest, etc.) — `config.hooks[event]` will be undefined, gets initialized to `[]`, then the matcher is added. Works automatically.
- **Existing matchers** (PostToolUse Read/Write/Edit/Bash, Stop, Notification, SessionStart) — already present, `alreadyExists` returns true, skipped. Works automatically.
- **PreToolUse change** (4 specific → 1 wildcard) — The new wildcard `''` matcher doesn't match any existing `Read`/`Write`/`Edit`/`Bash` matchers, so it's ADDED (existing 4 preserved). Result: 5 PreToolUse entries. Functionally correct (wildcard covers all tools; specific matchers are redundant but harmless).
- **UserPromptSubmit change** ('' → regex) — If changing to regex, the regex matcher doesn't match existing '' matcher, so both entries coexist. The '' wildcard fires on all prompts (superset of regex). Functionally correct but redundant.

**Key insight: the merge logic is additive-only. It NEVER removes existing matchers.** Upgraded configs may have more matchers than fresh installs (redundant but functional). This is the intended behavior per AC3: "existing matchers are preserved unchanged."

### Files to Touch

| File | Action |
|---|---|
| `bmad-statusline/src/defaults.js` | Update `getHookConfig()` — add 7 event types, reconcile PreToolUse/UserPromptSubmit |
| `bmad-statusline/src/install.js` | Verify merge logic (likely no code changes needed — existing logic handles new event types) |
| `bmad-statusline/test/defaults.test.js` | Update matcher count assertions, add new event type tests |
| `bmad-statusline/test/install.test.js` | Add Rev.4→Rev.5 upgrade test, update fresh install & idempotency assertions |
| `bmad-statusline/test/fixtures/` | Create `claude-settings-with-hooks-phase5.json` if needed for Rev.5 idempotency |

### Existing Code Details

**defaults.js** (`bmad-statusline/src/defaults.js`, lines 25-56):
- `getHookConfig(hookPath)` builds `cmd = node ${JSON.stringify(hookPath)}` (safe path quoting)
- Returns `{ hooks: { ... } }` object
- Currently exports: `getHookConfig`, `getDefaultWidgets`, `AGENT_COLORS`, `WORKFLOW_COLORS`

**install.js** (`bmad-statusline/src/install.js`, lines 161-221):
- `installTarget5(config, paths)` handles hook injection
- Phase 2 legacy cleanup: removes stale `Skill` matcher from PostToolUse
- Granular merge: iterates desired config, adds missing `(event, matcher)` pairs
- Uses `logSuccess`/`logSkipped` for feedback (Pattern 6)
- BMAD ownership check: `command.includes('bmad-hook.js')`

### Testing Standards

- Test runner: Vitest (`npm test`)
- Pattern: describe → it blocks, assert-style
- Fixture files in `bmad-statusline/test/fixtures/`
- Existing fixture `claude-settings-with-hooks-phase4.json` represents Rev.4 state (12 matchers / 6 event types)
- Installer tests use injected `paths` parameter for isolation
- Idempotency tests: run install 3 times, verify no duplication

### Patterns to Follow

- **Pattern 4** — Config JSON Mutation: read → parse → backup → modify → stringify → write → reread → validate
- **Pattern 5** — Path Construction: `path.join()` everywhere, injected `paths` parameter
- **Pattern 6** — Console Output: `logSuccess(target, message)`, `logSkipped(target, message)`
- **Error Handling** — Installer is verbose (Pattern 1): log every action

### Anti-Patterns to Avoid

- Do NOT modify `install.js` merge logic unless absolutely necessary — the existing additive merge handles new event types automatically
- Do NOT remove existing matchers during upgrade — AC3 requires preservation
- Do NOT use `node "${hookPath}"` template literal — use `JSON.stringify()` for safe quoting (existing pattern)
- Do NOT add async/promise code — Pattern 2 mandates synchronous fs everywhere

### Project Structure Notes

- `bmad-statusline/src/defaults.js` — ESM module (`export function`)
- `bmad-statusline/src/install.js` — ESM module with injected dependencies
- `bmad-statusline/test/` — Vitest test files with `.test.js` extension
- `bmad-statusline/test/fixtures/` — JSON fixtures for installer tests

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Hook Expansion (Updated Rev.5), lines 928-1024]
- [Source: _bmad-output/planning-artifacts/architecture.md#LLM State Machine (Updated Rev.5), lines 1143-1174]
- [Source: _bmad-output/planning-artifacts/architecture.md#Installer Upgrade Path (Phase 3 → Phase 4), lines 1205-1209]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.3, lines 2328-2353]
- [Source: _bmad-output/project-context.md#Hook Architecture, lines 452-566]
- [Source: _bmad-output/project-context.md#Hook Config (9 matchers, 6 event types), lines 470-498]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#7-2 hookPath injection, line 87]

### Git Intelligence

Recent commits show Monitor bug fixes (scroll, layout). Last installer-related work: commit `d37e852` (PreToolUse hook clears permission state). Story 8.3 is independent of 8.1/8.2 (can run in parallel — installer only touches defaults.js + install.js, not hook dispatch).

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- Baseline tests on master had 6 failures (UserPromptSubmit matcher discrepancy: code had `''`, tests expected regex)

### Completion Notes List
- Task 1: Updated `getHookConfig()` — UserPromptSubmit→regex `(?:bmad|gds|wds)[:-]`, PreToolUse→single wildcard `''`, added 7 new event types. Total: 16 matchers / 13 event types.
- Task 2: Verified `installTarget5()` merge logic — no code changes needed. Additive-only merge handles new event types automatically. Rev.4→Rev.5 upgrade preserves existing matchers (4 PreToolUse specific + 1 wildcard = 5 on upgrade, expected behavior per AC3).
- Task 3: Updated `defaults.test.js` (6 tests pass), `install.test.js` (29 tests pass). Created `claude-settings-with-hooks-phase5.json` fixture. Added Rev.4→Rev.5 upgrade test and Rev.5 idempotency test.

### Change Log
- 2026-04-07: Story 8.3 implementation — Rev.5 hook config with 16 matchers / 13 event types

### File List
- bmad-statusline/src/defaults.js (modified)
- bmad-statusline/test/defaults.test.js (modified)
- bmad-statusline/test/install.test.js (modified)
- bmad-statusline/test/fixtures/claude-settings-with-hooks-phase5.json (new)

### Review Findings
- [x] [Review][Patch] Stop/Notification/SessionStart missing type+command validation in defaults.test.js [defaults.test.js:96-100]
- [x] [Review][Patch] Phase 3→Rev.5 upgrade test missing total matcher count assertion [install.test.js:445-474]
- [x] [Review][Defer] Stale UserPromptSubmit wildcard '' on real Rev.4 users not cleaned up during upgrade [install.js:177-203] — deferred, pre-existing (AC3 mandates "existing matchers preserved unchanged")
- [x] [Review][Defer] Phase4 fixture UserPromptSubmit uses regex but old defaults.js deployed wildcard '' — test gap [fixtures/claude-settings-with-hooks-phase4.json] — deferred, pre-existing
