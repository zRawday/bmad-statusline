# Story 2.3: bmad_init.py patch for auto fields

Status: review

## Story

As a **developer who wants less manual status updates from BMAD agents**,
I want **bmad_init.py to automatically populate workflow, project, and step.total fields in the status file**,
So that **agents only need to update dynamic fields (request, story, step.current, agent changes) reducing missed updates**.

## Acceptance Criteria

1. **AC1 — Auto-populated fields on workflow start**
   Given the bmad_init.py patch is applied
   When a BMAD workflow starts and the agent calls the new `statusline-init` subcommand
   Then `workflow` (skill name), `project` (from config.yaml `project_name`), and `step.total` (from workflow step count) are auto-populated in the status JSON file

2. **AC2 — Patch is optional**
   Given the patch is optional
   When `npx bmad-statusline install` runs
   Then it does NOT apply the patch by default

3. **AC3 — Apply patch via CLI**
   Given the user wants to apply the patch
   When they run `npx bmad-statusline patch-init`
   Then the patch is applied to `bmad_init.py` in both BMAD installation locations
   And a `.bak` backup is created before each modification

4. **AC4 — Revert patch via CLI**
   Given the user wants to remove the patch
   When they run `npx bmad-statusline patch-init --revert`
   Then the patch is reverted from `bmad_init.py`, restoring original behavior from `.bak`

5. **AC5 — Backward compatibility**
   Given bmad_init.py is NOT patched
   When a BMAD workflow starts
   Then the agent fills all fields manually via CLAUDE.md instruction (existing Phase 2 behavior)

6. **AC6 — Idempotent patch application**
   Given the patch has already been applied
   When `npx bmad-statusline patch-init` is run again
   Then it detects the existing patch markers and logs `○ skipped`

7. **AC7 — Revert without patch**
   Given the patch has NOT been applied
   When `npx bmad-statusline patch-init --revert` is run
   Then it logs `○ skipped` (nothing to revert)

## Tasks / Subtasks

- [x] Task 1: Add `patch-init` command to CLI dispatch (AC: #2, #3, #4)
  - [x] 1.1 Update `bin/cli.js` — add `patch-init` to switch statement, parse `--revert` flag from `process.argv[3]`
  - [x] 1.2 Update USAGE text to include `patch-init` command description

- [x] Task 2: Create `src/patch-init.js` command module (AC: #3, #4, #6, #7)
  - [x] 2.1 Implement `patchInit(paths)` default export accepting `paths` parameter and `revert` boolean
  - [x] 2.2 Implement `findBmadInitPy(projectRoot)` — locate both copies: `_bmad/core/bmad-init/scripts/bmad_init.py` AND `.claude/skills/bmad-init/scripts/bmad_init.py`
  - [x] 2.3 Implement **apply** path: for each bmad_init.py found, read → detect markers `# bmad-statusline:start` / `# bmad-statusline:end` → if markers absent, backup(.bak) → inject patch code block before `if __name__` → validate file still parses (run `python -c "import ast; ast.parse(open('file').read())"`)
  - [x] 2.4 Implement **revert** path: for each bmad_init.py found, detect markers → if markers present, restore from `.bak` (if exists) OR remove marked block → validate
  - [x] 2.5 Use `logSuccess`/`logSkipped`/`logError` for all output, path.join() for all paths
  - [x] 2.6 Handle edge cases: bmad_init.py not found (user hasn't installed BMAD), .bak missing on revert (remove marked block instead)

- [x] Task 3: Define the Python patch code block (AC: #1)
  - [x] 3.1 Write the `statusline-init` subcommand Python code that will be injected into bmad_init.py
  - [x] 3.2 The injected code adds a `cmd_statusline_init(args)` function that:
    - Accepts `--session-id` (required), `--workflow` (required), `--workflow-path` (optional, for step.total counting)
    - Reads `project_name` from module config (auto-derive via existing `load_module_config`)
    - Counts `.md` step files matching `step-*.md` or numbered patterns in `--workflow-path` (if provided) → `step.total`
    - Writes/updates `~/.cache/bmad-status/status-{session_id}.json` with `session_id`, `project`, `workflow`, `step.total`, `started_at`, `updated_at`
    - Preserves existing agent-managed fields if status file already exists (merge, don't overwrite)
    - Respects `BMAD_CACHE_DIR` env var for testability
  - [x] 3.3 The injected code also registers the `statusline-init` subparser in `main()` (within the marked block)
  - [x] 3.4 Wrap all injected code between `# bmad-statusline:start` and `# bmad-statusline:end` markers

- [x] Task 4: Update CLAUDE.md block for patched mode (AC: #1, #5)
  - [x] 4.1 In `src/defaults.js`, add `generateClaudeMdBlockPatched(slug)` export that generates the simplified agent instructions when the patch is active
  - [x] 4.2 The patched block instructs agents to call `python bmad_init.py statusline-init --session-id $BMAD_SESSION_ID --workflow <name> --workflow-path <path>` at workflow start instead of writing the full status JSON manually
  - [x] 4.3 The patched block still instructs agents to manually update: `request`, `story`, `document`, `agent`, `step.current`, `step.current_name`, `step.next`, `step.next_name`, `step.completed`
  - [x] 4.4 After patching bmad_init.py, also update the CLAUDE.md block (detect existing markers, replace with patched version). On revert, restore the standard CLAUDE.md block.

- [x] Task 5: Write tests (AC: all)
  - [x] 5.1 Create `test/patch-init.test.js` using `node:test` + `node:assert`
  - [x] 5.2 Test: apply patch to fixture bmad_init.py → markers present, Python parses successfully
  - [x] 5.3 Test: apply patch idempotently → second apply skips
  - [x] 5.4 Test: revert patch → .bak restored, markers absent
  - [x] 5.5 Test: revert when not patched → skips
  - [x] 5.6 Test: bmad_init.py not found → appropriate error
  - [x] 5.7 Create `test/fixtures/bmad-init-original.py` — minimal fixture mimicking the real bmad_init.py structure (with `if __name__` block)
  - [x] 5.8 Test the injected `statusline-init` command works: call `python patched-fixture.py statusline-init --session-id test --workflow dev-story` in temp dir → verify status JSON created with correct fields
  - [x] 5.9 Test: CLAUDE.md updated to patched version on apply, restored to standard on revert

## Dev Notes

### Architecture Compliance

**This story is independent from Stories 2.1 and 2.2** (TUI stories). No dependency on React/Ink. No TUI interaction. Pure CLI command + Python patch.

**Architectural Boundaries:**
- `src/patch-init.js` is a **Boundary 3 command module** — exports a single function, receives `paths` parameter
- The Python patch code lives **inside bmad_init.py** (Boundary 1 equivalent for Python) — it must be self-contained
- `src/defaults.js` gains one new export (`generateClaudeMdBlockPatched`) — **Boundary 4 shared data**

**Pattern Compliance (mandatory):**
- Synchronous fs only: `fs.readFileSync` / `fs.writeFileSync` — no async, no promises
- Path construction: `path.join()` everywhere, never string concatenation
- Path injection: `patchInit(paths)` accepts paths parameter. Default paths: `paths.projectRoot` (cwd), `paths.claudeMd` (`.claude/CLAUDE.md`)
- Console output: `logSuccess(target, message)` / `logSkipped(target, message)` / `logError(target, message)` defined locally in `src/patch-init.js`
- Error handling: Installer = verbose (log every action). If Python validation fails after write, restore from .bak, log error, exit 1

**Config mutation sequence for CLAUDE.md update:**
Since CLAUDE.md is a markdown file (not JSON), use the existing marker-based detection/replacement pattern, NOT the JSON mutation sequence. But DO backup before write.

### Critical Implementation Details

**bmad_init.py locations (BOTH must be patched):**
1. `{projectRoot}/_bmad/core/bmad-init/scripts/bmad_init.py` — module source
2. `{projectRoot}/.claude/skills/bmad-init/scripts/bmad_init.py` — active skill copy

These are mirror copies. Patch both. If only one exists, patch that one. Log which files were patched.

**Python patch injection point:**
Insert the marked block **before** the `if __name__ == '__main__':` line. The patch adds:
1. A `cmd_statusline_init(args)` function
2. A `statusline-init` subparser registration in `main()` — this requires modifying the `main()` function

**Alternative approach (simpler):** Instead of modifying `main()`, inject the statusline-init as a standalone block that hooks into the existing `commands` dict. The marked block can wrap the function AND the dict update:

```python
# bmad-statusline:start
def cmd_statusline_init(args):
    """Auto-populate BMAD statusline fields."""
    import json as _json
    from datetime import datetime as _dt, timezone as _tz
    from pathlib import Path as _Path

    project_root = find_project_root(llm_provided=args.project_root)
    # ... read project_name from config, count steps, write status JSON

# This dict entry is added by the patch — checked in main()
_STATUSLINE_INIT_PATCH = {
    'handler': cmd_statusline_init,
    'args': ['--session-id', '--workflow', '--workflow-path', '--project-root', '--module']
}
# bmad-statusline:end
```

Then modify `main()` to check for `_STATUSLINE_INIT_PATCH` — but this gets complex. **Recommended approach:** Inject the function AND also inject a small modification into `main()` that adds the subparser. Use two separate marked blocks:
- One for the function (before `main()`)
- One inside `main()` for the subparser registration (between the `write` subparser and `args = parser.parse_args()`)

**However**, modifying the middle of `main()` is fragile. **Simplest robust approach:**

The patch adds the function PLUS modifies the `commands` dict and subparsers registration by appending **after** the existing `commands = {...}` line. Find the line `commands = {` and the corresponding closing `}`, then inject after it:

```python
    # bmad-statusline:start
    sl_parser = subparsers.add_parser('statusline-init', help='Auto-populate BMAD statusline')
    sl_parser.add_argument('--session-id', required=True)
    sl_parser.add_argument('--workflow', required=True)
    sl_parser.add_argument('--workflow-path')
    sl_parser.add_argument('--project-root')
    sl_parser.add_argument('--module', default='bmm')
    commands['statusline-init'] = cmd_statusline_init
    # bmad-statusline:end
```

This approach:
- Adds the function before `main()`
- Injects the subparser + dict update inside `main()` after the existing commands dict
- Uses two marker pairs (function block + registration block)
- Minimal modification to existing code structure

**Dev agent: choose the approach that minimizes diff and risk of breaking existing functionality.**

### Python Patch — statusline-init Logic

The injected `cmd_statusline_init` function must:

1. Find project root via existing `find_project_root()`
2. Load module config via existing `load_module_config(module_code, project_root)` — default module `bmm`
3. Extract `project_name` from config
4. If `--workflow-path` provided, count step files: `len(list(Path(workflow_path).glob('step-*.md')))` or count `<step>` XML tags in `workflow.md` — use a simple heuristic
5. Determine cache dir: `BMAD_CACHE_DIR` env var or `~/.cache/bmad-status/`
6. Build status JSON:
   ```json
   {
     "session_id": "<from --session-id>",
     "project": "<from config project_name>",
     "workflow": "<from --workflow>",
     "agent": [],
     "request": null,
     "story": null,
     "document": null,
     "step": { "current": null, "current_name": null, "next": null, "next_name": null, "completed": 0, "total": <counted> },
     "started_at": "<ISO 8601 now>",
     "updated_at": "<ISO 8601 now>"
   }
   ```
7. If status file already exists, **merge**: preserve existing `agent`, `request`, `story`, `document`, `step.current/completed` values — only overwrite auto fields
8. Write to `{cache_dir}/status-{session_id}.json` with `json.dump(indent=2)`
9. Print JSON result to stdout: `{"status": "ok", "file": "<path>", "project": "<name>", "step_total": N}`
10. On any error, print error JSON to stderr and exit 1

### Step Counting Heuristic

Workflow step files vary in format. The `step.total` count should use this priority:
1. If `--workflow-path` points to a directory containing `workflow.md`, count `<step` tags via regex
2. If `--workflow-path` points to a directory with `step-*.md` files, count those
3. If neither found, set `step.total` to 0 (agent fills manually)

### bin/cli.js Changes

```javascript
// In the switch statement, add:
case 'patch-init': {
  const revert = process.argv.includes('--revert');
  const mod = await import('../src/patch-init.js');
  await mod.default({ revert });
  break;
}
```

Update USAGE string to include:
```
  patch-init  Patch bmad_init.py for auto status fields (--revert to undo)
```

### File Structure After Implementation

```
bmad-statusline/
  bin/cli.js                    # Updated: add patch-init dispatch
  src/
    patch-init.js               # NEW: patch/revert logic
    defaults.js                 # Updated: add generateClaudeMdBlockPatched()
  test/
    patch-init.test.js          # NEW: patch/revert tests
    fixtures/
      bmad-init-original.py     # NEW: minimal fixture for testing
```

### Project Structure Notes

- `src/patch-init.js` follows the same flat structure as `src/install.js`, `src/uninstall.js`, `src/clean.js`
- No new dependencies needed — Python validation via `child_process.execSync`
- The Python fixture for tests should be minimal but include the same structure as real `bmad_init.py`: imports, functions, `main()` with subparsers, `commands` dict, `if __name__`

### Testing Strategy

- Use `child_process.execSync` to validate patched Python parses: `python -c "import ast; ast.parse(open('file').read())"`
- Use temp dirs with fixture copies (same pattern as other test files)
- Test the actual `statusline-init` subcommand by running the patched fixture with `child_process.execSync`
- For CLAUDE.md update tests, reuse existing fixture pattern from `test/fixtures/claude-md-with-block.md`

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 2.3 acceptance criteria]
- [Source: _bmad-output/planning-artifacts/architecture.md — Deferred decisions, FR12]
- [Source: _bmad-output/planning-artifacts/implementation-readiness-report-2026-03-28.md — MAJ-1 resolved: patch mechanism is CLI command]
- [Source: _bmad-output/brainstorming/brainstorming-session-2026-03-28-001.md — Auto-field data source table]
- [Source: _bmad/core/bmad-init/scripts/bmad_init.py — Patch target, 594 lines, structure analysis]
- [Source: bmad-statusline/bin/cli.js — CLI dispatch pattern]
- [Source: bmad-statusline/src/defaults.js — CLAUDE.md block generation, existing exports]
- [Source: bmad-statusline/src/install.js — Pattern reference for path injection, logSuccess/logSkipped/logError]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Fixture `bmad-init-original.py` needed `import yaml` made conditional (pyyaml not installed globally) — used fallback `_simple_yaml_parse()` for key:value configs

### Completion Notes List

- Task 1: Added `patch-init` command to `bin/cli.js` switch statement with `--revert` flag parsing and USAGE text update
- Task 2: Created `src/patch-init.js` — Boundary 3 command module with `patchInit({ revert, paths })` default export, `findBmadInitPy()`, `applyPythonPatch()`, `revertPythonPatch()`, `updateClaudeMd()`, `validatePython()` (pipes content via stdin to avoid path issues)
- Task 3: Defined Python `cmd_statusline_init(args)` function block + subparser registration + commands dict entry as three separate marked blocks injected at anchor lines (`if __name__`, `args = parser.parse_args()`, `handler = commands.get(args.command)`)
- Task 4: Added `generateClaudeMdBlockPatched(slug)` export to `src/defaults.js` — simplified block with session ID discovery + `statusline-init` CLI command + manual update rules
- Task 5: Created `test/patch-init.test.js` (16 tests) + `test/fixtures/bmad-init-original.py` — covers apply, idempotent, revert, revert-when-not-patched, not-found, statusline-init execution, step counting, merge, CLAUDE.md update/revert, single-file patch

### File List

- `bmad-statusline/bin/cli.js` — modified (added patch-init case + USAGE line)
- `bmad-statusline/src/patch-init.js` — new (patch/revert command module)
- `bmad-statusline/src/defaults.js` — modified (added generateClaudeMdBlockPatched export)
- `bmad-statusline/test/patch-init.test.js` — new (16 tests)
- `bmad-statusline/test/fixtures/bmad-init-original.py` — new (minimal fixture)

### Change Log

- 2026-03-28: Implemented story 2.3 — bmad_init.py patch for auto status fields. All 5 tasks complete. 134/134 tests pass (16 new + 118 existing).
