# Story 3.3: defaults.js pivot — hook config export

Status: done

## Story

As a **bmad-statusline maintainer**,
I want **defaults.js to export hook configuration instead of CLAUDE.md block and permission rules**,
So that **the install command can inject the hook config into `~/.claude/settings.json`**.

## Acceptance Criteria

1. **Given** `src/defaults.js` **When** inspected **Then** `generateClaudeMdBlock()`, `generateClaudeMdBlockPatched()`, and `getPermissionRules()` are removed entirely (functions + exports).

2. **Given** `getHookConfig(hookPath)` is called with a hook script path **When** it returns **Then** the result is a hook configuration object with two PostToolUse matchers (Skill + Read), each pointing to `node "{hookPath}"`.

3. **Given** the returned hook config **When** serialized to JSON **Then** it matches this exact structure:
   ```json
   {
     "hooks": {
       "PostToolUse": [
         { "matcher": "Skill", "hooks": [{ "type": "command", "command": "node \"{hookPath}\"" }] },
         { "matcher": "Read", "hooks": [{ "type": "command", "command": "node \"{hookPath}\"" }] }
       ]
     }
   }
   ```

4. **Given** `src/defaults.js` **When** inspected **Then** `getStatusLineConfig()`, `getWidgetDefinitions(readerPath)`, `AGENT_COLORS`, `WORKFLOW_COLORS`, and `WORKFLOW_PREFIX_COLORS` remain unchanged.

5. **Given** `test/defaults.test.js` **When** updated **Then** it tests `getHookConfig()` output structure and removes tests for the deleted exports (`generateClaudeMdBlock`, `generateClaudeMdBlockPatched`).

## Tasks / Subtasks

- [x] Task 1: Remove dead exports from `src/defaults.js` (AC: #1)
  - [x] Delete `generateClaudeMdBlock(slug)` function (lines 34-93)
  - [x] Delete `generateClaudeMdBlockPatched(slug)` function (lines 96-143)
  - [x] Delete `getPermissionRules()` function (lines 145-151)
- [x] Task 2: Add `getHookConfig(hookPath)` to `src/defaults.js` (AC: #2, #3)
  - [x] Implement function returning `{ hooks: { PostToolUse: [...] } }` structure
  - [x] Two matchers: `"Skill"` and `"Read"`, each with `type: "command"` and `command: 'node "{hookPath}"'`
  - [x] Add `export` keyword
- [x] Task 3: Verify unchanged exports remain intact (AC: #4)
  - [x] `getStatusLineConfig()` — untouched
  - [x] `getWidgetDefinitions(readerPath)` — untouched
  - [x] `AGENT_COLORS`, `WORKFLOW_COLORS`, `WORKFLOW_PREFIX_COLORS` — untouched
- [x] Task 4: Update `test/defaults.test.js` (AC: #5)
  - [x] Remove import of `generateClaudeMdBlock` from import line
  - [x] Add import of `getHookConfig` to import line
  - [x] Delete test `'generateClaudeMdBlock returns string with markers'`
  - [x] Delete test `'generateClaudeMdBlock uses glob fallback when slug is null'`
  - [x] Add test: `getHookConfig` returns object with `hooks.PostToolUse` array of length 2
  - [x] Add test: first matcher is `"Skill"` with correct command format
  - [x] Add test: second matcher is `"Read"` with correct command format
  - [x] Add test: command includes the provided `hookPath` argument
  - [x] Existing tests for `getStatusLineConfig`, `getWidgetDefinitions`, `AGENT_COLORS`, `WORKFLOW_COLORS` remain unchanged
- [x] Task 5: Run tests — `node --test test/defaults.test.js` must pass

## Dev Notes

### Files to Modify (2 files only)

| File | Action |
|------|--------|
| `bmad-statusline/src/defaults.js` | Remove 3 functions, add 1 function |
| `bmad-statusline/test/defaults.test.js` | Remove 2 tests, add new tests for `getHookConfig` |

### What to Remove from `src/defaults.js`

These three exports are dead after this story — they belong to the old LLM-write approach:

1. **`generateClaudeMdBlock(slug)`** (lines 34-93) — generated CLAUDE.md instruction block telling LLM to discover session ID and write status. Replaced by passive hook.
2. **`generateClaudeMdBlockPatched(slug)`** (lines 96-143) — alternative version with python init script. Also dead.
3. **`getPermissionRules()`** (lines 145-151) — returned Bash permission rules for `settings.local.json`. Hook needs no Bash permissions.

### What to Add to `src/defaults.js`

**`getHookConfig(hookPath)`** — returns the hook configuration object that `install.js` will merge into `~/.claude/settings.json`. Exact implementation:

```js
export function getHookConfig(hookPath) {
  return {
    hooks: {
      PostToolUse: [
        { matcher: 'Skill', hooks: [{ type: 'command', command: `node "${hookPath}"` }] },
        { matcher: 'Read', hooks: [{ type: 'command', command: `node "${hookPath}"` }] }
      ]
    }
  };
}
```

Place it after `getWidgetDefinitions()` and before the `AGENT_COLORS` constant (replacing the removed functions).

### What NOT to Touch

- `getStatusLineConfig()` — unchanged
- `getWidgetDefinitions(readerPath)` — unchanged
- `AGENT_COLORS` — kept for sync tests (reader has its own copy, defaults.js is the reference)
- `WORKFLOW_COLORS` — unchanged
- `WORKFLOW_PREFIX_COLORS` — unchanged

### Known Downstream Breakage (Expected)

After this story, the following files will have broken imports — **this is intentional and will be fixed in later stories:**

| File | Broken Import | Fixed In |
|------|--------------|----------|
| `src/install.js` (line 5) | `generateClaudeMdBlock`, `getPermissionRules` | Story 3.4 |
| `src/patch-init.js` | `defaults.js` imports | Story 3.7 (file deleted) |
| `test/patch-init.test.js` | `defaults.js` imports | Story 3.7 (file deleted) |

**Do NOT fix these files in this story.** Only modify `src/defaults.js` and `test/defaults.test.js`.

### Architecture Compliance

- **Module system:** ESM (`export function`, `import { ... } from`) — existing pattern, no change
- **Error handling:** defaults.js is a data module — no error handling needed (pure functions returning objects)
- **Synchronous I/O:** N/A — no I/O in defaults.js
- **Testing framework:** `node:test` + `node:assert/strict` — match existing test file pattern exactly
- **Test run command:** `node --test test/defaults.test.js`

### Test File Update Details

Current imports in `test/defaults.test.js`:
```js
import { getStatusLineConfig, getWidgetDefinitions, generateClaudeMdBlock, AGENT_COLORS, WORKFLOW_COLORS } from '../src/defaults.js';
```

New imports should be:
```js
import { getStatusLineConfig, getWidgetDefinitions, getHookConfig, AGENT_COLORS, WORKFLOW_COLORS } from '../src/defaults.js';
```

Tests to remove:
- `'generateClaudeMdBlock returns string with markers'` (line 34)
- `'generateClaudeMdBlock uses glob fallback when slug is null'` (line 44)

Tests to add (within existing `describe` block):
```js
it('getHookConfig returns two PostToolUse matchers', () => {
  const result = getHookConfig('/test/path/bmad-hook.js');
  assert.ok(result.hooks, 'should have hooks key');
  assert.ok(Array.isArray(result.hooks.PostToolUse), 'should have PostToolUse array');
  assert.equal(result.hooks.PostToolUse.length, 2, 'should have exactly 2 matchers');
});

it('getHookConfig matchers target Skill and Read with correct command', () => {
  const result = getHookConfig('/test/path/bmad-hook.js');
  const [skill, read] = result.hooks.PostToolUse;
  assert.equal(skill.matcher, 'Skill');
  assert.equal(read.matcher, 'Read');
  assert.equal(skill.hooks[0].type, 'command');
  assert.equal(read.hooks[0].type, 'command');
  assert.ok(skill.hooks[0].command.includes('/test/path/bmad-hook.js'), 'Skill command should use provided hookPath');
  assert.ok(read.hooks[0].command.includes('/test/path/bmad-hook.js'), 'Read command should use provided hookPath');
});
```

### Project Structure Notes

- All source code is under `bmad-statusline/` (npm package root)
- `src/defaults.js` is ESM, imported by install.js, patch-init.js, TUI modules, and its own test
- Reader (`src/reader/bmad-sl-reader.js`) has its **own copy** of color maps — does NOT import from defaults.js. The sync test compares both for drift.

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 3.3 acceptance criteria]
- [Source: _bmad-output/planning-artifacts/architecture.md — Install Target Changes, Hook Config Format]
- [Source: _bmad-output/project-context.md — Boundary 5: Defaults, Install Targets table]
- [Source: bmad-statusline/src/defaults.js — current implementation, lines 34-151 to remove]
- [Source: bmad-statusline/test/defaults.test.js — current test structure]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation, no issues encountered.

### Completion Notes List

- Removed 3 dead exports from `src/defaults.js`: `generateClaudeMdBlock()`, `generateClaudeMdBlockPatched()`, `getPermissionRules()` (118 lines removed)
- Added `getHookConfig(hookPath)` returning `{ hooks: { PostToolUse: [Skill, Read] } }` structure with `node "{hookPath}"` commands
- Updated `test/defaults.test.js`: replaced `generateClaudeMdBlock` import/tests with `getHookConfig` import/tests
- All 6 tests pass (0 fail, 0 skip)
- Unchanged exports verified intact: `getStatusLineConfig`, `getWidgetDefinitions`, `AGENT_COLORS`, `WORKFLOW_COLORS`, `WORKFLOW_PREFIX_COLORS`

### Change Log

- 2026-03-29: Story 3.3 implemented — defaults.js pivoted from CLAUDE.md block generation to hook config export

### Review Findings

- [x] [Review][Defer] Injection/malformation de commande via hookPath non-sanitisé [src/defaults.js:38] — deferred, pre-existing. Pattern identique à `getWidgetDefinitions(readerPath)`. Le hookPath est toujours construit par l'installer via `path.join()`, jamais issu d'un input utilisateur.

### File List

- `bmad-statusline/src/defaults.js` — modified (removed 3 functions, added `getHookConfig`)
- `bmad-statusline/test/defaults.test.js` — modified (replaced old tests with `getHookConfig` tests)
