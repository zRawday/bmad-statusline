# Story 1.2: Install Command

Status: done

## Story

As a **developer using BMAD workflows**,
I want **to run `npx bmad-statusline install` and have my entire BMAD statusline configured automatically**,
So that **I see real-time BMAD context in my terminal without any manual configuration**.

## Acceptance Criteria

1. **Target 1 — `~/.claude/settings.json` (statusLine config):**
   - **Given** `~/.claude/settings.json` exists without a `statusLine` key **When** install runs **Then** it adds the ccstatusline statusLine configuration to the JSON, creates a `.bak` backup before writing, and validates the written file by rereading and parsing
   - **Given** `~/.claude/settings.json` already contains a `statusLine` key **When** install runs **Then** it skips this target and logs `○ skipped`
   - **Given** `~/.claude/settings.json` does not exist **When** install runs **Then** it creates the file with `{ "statusLine": ... }` as content and creates `~/.claude/` directory if needed

2. **Target 2 — `~/.config/ccstatusline/settings.json` (BMAD widgets):**
   - **Given** `~/.config/ccstatusline/settings.json` exists without BMAD widgets **When** install runs **Then** it injects all BMAD `custom-command` widgets (with `preserveColors: true`) on the configured target line, preserves all existing user widgets on other lines, creates a `.bak` backup before writing, and validates post-write
   - **Given** ccstatusline config already contains widgets with `id` matching `bmad-*` **When** install runs **Then** it skips widget injection and logs `○ skipped`
   - **Given** `~/.config/ccstatusline/` directory does not exist **When** install runs **Then** it creates the full directory hierarchy before writing the config

3. **Target 3 — `~/.config/bmad-statusline/bmad-sl-reader.js` (reader deployment):**
   - **Given** reader file does not exist at `~/.config/bmad-statusline/` **When** install runs **Then** it copies `src/reader/bmad-sl-reader.js` to `~/.config/bmad-statusline/bmad-sl-reader.js`
   - **Given** reader file already exists at destination **When** install runs **Then** it **always overwrites** with the latest version and logs `✓ updated`

4. **Target 4 — `~/.cache/bmad-status/` (cache directory):**
   - **Given** cache directory does not exist **When** install runs **Then** it creates `~/.cache/bmad-status/`
   - **Given** cache directory already exists **When** install runs **Then** it skips and logs `○ skipped`

5. **Target 5 — `.claude/CLAUDE.md` (per-project instruction block):**
   - **Given** `.claude/CLAUDE.md` exists without `<!-- bmad-statusline:start -->` markers **When** install runs **Then** it appends the BMAD Status Tracking instruction block wrapped in markers, and the block contains a session_id discovery command with the resolved project slug (or glob fallback)
   - **Given** `.claude/CLAUDE.md` already contains markers **When** install runs **Then** it **replaces** the content between markers with the latest version
   - **Given** `.claude/CLAUDE.md` does not exist **When** install runs **Then** it creates `.claude/` directory if needed and creates the file with the instruction block

6. **Idempotency (FR8):**
   - **Given** install has already been run successfully **When** install is run a second time **Then** no widget duplication occurs, no CLAUDE.md block duplication, reader is overwritten, output shows appropriate `✓`/`○` per target
   - **Given** install is run 3 times consecutively **When** the resulting CLAUDE.md is inspected **Then** exactly 1 pair of markers exists **And** ccstatusline config contains exactly 1 set of `bmad-*` widgets

7. **Multi-project (FR9):**
   - **Given** global components are already installed from a previous project **When** install runs in a new project directory **Then** global targets are skipped (`○`), only CLAUDE.md is added/updated

8. **Path injection & testability:**
   - **Given** the `install()` function signature **When** called from tests with a custom `paths` parameter pointing to temp directories **Then** all file operations target the injected paths, not the real home directory

9. **Console output:**
   - **Given** install runs **When** each target is processed **Then** output uses `logSuccess`/`logSkipped`/`logError` format: `  ✓ target — message` / `  ○ target — message` / `  ✗ target — message`

10. **`src/defaults.js` population:**
    - **Given** Story 1.1 created `defaults.js` stubs **When** Story 1.2 is implemented **Then** `defaults.js` exports are fully populated: `getStatusLineConfig()` returns real ccstatusline JSON, `getWidgetDefinitions(readerPath)` returns all BMAD widget definitions, `generateClaudeMdBlock(slug)` returns the complete instruction block with markers

## Tasks / Subtasks

- [x] Task 1: Populate `src/defaults.js` with real config templates (AC: #10)
  - [x] 1.1 Implement `getStatusLineConfig()` — return the ccstatusline `statusLine` object for `~/.claude/settings.json`
  - [x] 1.2 Implement `getWidgetDefinitions(readerPath)` — return array of v3 BMAD widget objects for ccstatusline config, all with `preserveColors: true`, `type: "custom-command"`, IDs matching `bmad-*` pattern, `commandPath` pointing to deployed reader with appropriate subcommand
  - [x] 1.3 Implement `generateClaudeMdBlock(slug)` — return complete CLAUDE.md instruction block with `<!-- bmad-statusline:start/end -->` markers, session_id discovery commands (hardcoded slug when available, glob fallback when not), status file schema, update rules and timing guidance
- [x] Task 2: Implement `src/install.js` core infrastructure (AC: #8, #9)
  - [x] 2.1 Define default paths object resolving `os.homedir()` once at module level; export `install(paths = defaultPaths)` function signature
  - [x] 2.2 Implement `logSuccess(target, message)`, `logSkipped(target, message)`, `logError(target, message)` helpers locally
  - [x] 2.3 Implement JSON mutation helpers: `readJsonFile(filePath)`, `backupFile(filePath)`, `writeJsonSafe(filePath, obj)` following the mandatory sequence: read → parse → backup(.bak) → modify in memory → stringify(null, 2) → write → reread → parse(validate). On validation failure: restore from `.bak`, logError, exit 1
  - [x] 2.4 Implement `resolveSlug(paths)` — scan `paths.claudeProjects` for directory matching current working directory; return hardcoded slug or glob fallback string
- [x] Task 3: Implement 5 install targets in `src/install.js` (AC: #1-#5)
  - [x] 3.1 Target 1 — `~/.claude/settings.json`: check for `statusLine` key; if absent, add via `getStatusLineConfig()`; if present, skip. Create `~/.claude/` dir if missing
  - [x] 3.2 Target 2 — `~/.config/ccstatusline/settings.json`: check for any widget with `id` starting with `bmad-`; if absent, inject `getWidgetDefinitions(readerPath)` onto the configured target line (default: line index 1); if present, skip. Create directory hierarchy if missing. For new config files, create v3 skeleton `{ "version": 3, "lines": [[], [], []] }` before injecting
  - [x] 3.3 Target 3 — `~/.config/bmad-statusline/bmad-sl-reader.js`: always copy (overwrite). Source: package's own `src/reader/bmad-sl-reader.js` resolved via `import.meta.url`. Create directory if missing. Log `✓ updated` if existed, `✓ installed` if new
  - [x] 3.4 Target 4 — `~/.cache/bmad-status/`: `fs.mkdirSync({ recursive: true })`. Log skip if already exists, success if created
  - [x] 3.5 Target 5 — `.claude/CLAUDE.md`: resolve slug via Task 2.4. Generate block via `generateClaudeMdBlock(slug)`. If markers absent → append. If markers present → replace between markers (inclusive). If file missing → create file with block. Create `.claude/` dir if needed
- [x] Task 4: Create test fixtures in `test/fixtures/` (AC: #8)
  - [x] 4.1 `claude-settings-empty.json` — `{}`
  - [x] 4.2 `claude-settings-with-statusline.json` — `{ "statusLine": { ... } }` (already has config)
  - [x] 4.3 `ccstatusline-settings-empty.json` — `{ "version": 3, "lines": [[], [], []] }` (v3 format, no widgets)
  - [x] 4.4 `ccstatusline-settings-with-bmad.json` — v3 with BMAD widgets already injected
  - [x] 4.5 `claude-md-with-block.md` — markdown with `<!-- bmad-statusline:start -->...<!-- bmad-statusline:end -->` markers
  - [x] 4.6 `claude-md-without-block.md` — markdown without markers
  - [x] 4.7 `status-sample.json` — valid status file for reader tests (shared fixture)
- [x] Task 5: Create `test/install.test.js` (AC: #1-#9)
  - [x] 5.1 Test Target 1: creates statusLine when absent; skips when present; creates directory when missing
  - [x] 5.2 Test Target 2: injects widgets when absent; skips when present; creates directory; preserves existing user widgets
  - [x] 5.3 Test Target 3: copies reader when absent; overwrites when present
  - [x] 5.4 Test Target 4: creates cache dir when absent; skips when present
  - [x] 5.5 Test Target 5: appends block when no markers; replaces when markers exist; creates file+dir when missing
  - [x] 5.6 Test idempotency: run install twice → no duplication in any target
  - [x] 5.7 Test multi-project: pre-populate global targets → only CLAUDE.md changes
  - [x] 5.8 Test backup creation: verify `.bak` files exist after install for JSON targets
  - [x] 5.9 Test post-write validation: verify all written JSON files are valid
- [x] Task 6: Update existing tests for Story 1.2 compatibility
  - [x] 6.1 Update `test/defaults.test.js` — tests should validate real return values (non-empty object, non-empty array, string with markers) instead of just type checks
  - [x] 6.2 Update `test/cli.test.js` — the install stub test (`'Not yet implemented'`) must be updated; either replace with a minimal path-injected call or remove the stub assertion
  - [x] 6.3 Run `npm test` and verify all tests pass

## Dev Notes

### Architecture Compliance — Mandatory Patterns

**Error handling:** This story is entirely in the **installer** boundary. **Verbose always** — log every action with `logSuccess`/`logSkipped`/`logError`. Never return silently on error.

**File I/O:** Synchronous only. `fs.readFileSync`, `fs.writeFileSync`, `fs.mkdirSync`, `fs.copyFileSync`, `fs.existsSync`. Never async, never promises, never callbacks.

**Path construction:** Always `path.join()`. Never string concatenation. All paths flow through the injected `paths` parameter. Resolve `os.homedir()` once in the default paths object at module level.

**JSON mutation — every JSON file write MUST follow this exact sequence:**
```
read → parse → backup(.bak) → modify in memory → stringify(null, 2) → write → reread → parse(validate)
```
On validation failure: restore from `.bak`, logError, exit 1. Wrap per target in try/catch.

**Console output format:**
```js
function logSuccess(target, message) { console.log(`  ✓ ${target} — ${message}`); }
function logSkipped(target, message) { console.log(`  ○ ${target} — ${message}`); }
function logError(target, message)   { console.log(`  ✗ ${target} — ${message}`); }
```

### ccstatusline Config Format v3 — CRITICAL (Easy to Get Wrong)

**DO NOT reference `ccstatusline-config-example.json` in project root** — it uses the OLD format.

Correct v3 format:
```json
{
  "version": 3,
  "lines": [ [...], [...], [...] ]
}
```

- `lines` is an **array of 3 arrays** (not an object with `.widgets`)
- Each array element is a widget object
- Widget detection: `id` field (NOT `label`), pattern `bmad-*` (lowercase, hyphen)
- Widget command: property is `commandPath` (NOT `command`)
- Example widget:
  ```json
  {
    "id": "bmad-project",
    "type": "custom-command",
    "commandPath": "node /home/user/.config/bmad-statusline/bmad-sl-reader.js project",
    "color": "white",
    "preserveColors": true
  }
  ```
- Separator widget: `{ "id": "sep-bmad-1", "type": "separator" }`

### Widget Definitions — What `getWidgetDefinitions(readerPath)` Returns

The function receives `readerPath` (absolute path to deployed reader, e.g., `~/.config/bmad-statusline/bmad-sl-reader.js`) and returns an array of widget objects to inject on the target line. Each widget's `commandPath` must include `node {readerPath} {subcommand}`.

Recommended default widget set for initial install (compact composite + key individual widgets):
- Individual widgets: `bmad-agent`, `bmad-compact` (or `bmad-full`)
- Separators between groups

The exact widget selection should balance information density with line space. The architecture does not prescribe the exact default widget set — use judgment based on the composite widget options (compact, full, minimal) from the reader.

### Slug Resolution — CLAUDE.md Session Discovery

The installer must resolve the Claude Code project directory slug for accurate session_id discovery:

1. **Scan** `~/.claude/projects/` for a directory name matching the current working directory
2. **Windows format:** `C:\Users\supervision\Documents\Toulou` becomes `C--Users-supervision-Documents-Toulou` (colons → empty, backslashes → hyphens)
3. **Match logic:** Compare the end of the slug with `basename(process.cwd())` or reverse-engineer the full path from the slug
4. **Hardcoded slug** (when found): `BMAD_PROJ_DIR="$HOME/.claude/projects/{{resolved_slug}}"`
5. **Glob fallback** (when not found): `BMAD_PROJ_DIR=$(ls -dt "$HOME/.claude/projects/"*"$(basename "$PWD")" 2>/dev/null | head -1)`
6. **Auto-corrective:** Glob fallback is replaced by hardcoded slug on next `install` run after Claude Code creates the project directory (marker-based replacement handles this seamlessly)

### CLAUDE.md Instruction Block Content

`generateClaudeMdBlock(slug)` must produce a complete instruction block that tells BMAD agents how to write status files. Required sections:

1. **Session ID discovery** — shell commands using resolved slug or glob fallback
2. **Cache path** — `~/.cache/bmad-status/`
3. **Status file schema** — full JSON structure with all fields (see project-context.md Status File Format)
4. **Update rules** — when to create vs update the file, which fields to populate
5. **Timing guidance** — write at workflow start, update on field changes
6. **Wrapped in markers:** `<!-- bmad-statusline:start -->` / `<!-- bmad-statusline:end -->`

The `agent` field is always an array: `["Amelia"]` or `["Amelia", "Bob"]` in party mode. `story` and `request` are mutually exclusive in display. `story`/`document` are null when not applicable.

### Target 5 CLAUDE.md — Marker Logic

```
Append (no markers exist):
  existing_content + "\n" + block_with_markers

Replace (markers exist):
  content_before_start_marker + block_with_markers + content_after_end_marker

Create (file missing):
  block_with_markers
```

The replacement must be **inclusive** — remove the old start marker, old content, and old end marker, then insert the new block (which contains its own markers).

### Reader Source Path for Copy (Target 3)

The reader file to deploy is the package's own `src/reader/bmad-sl-reader.js`. Resolve the source path relative to `import.meta.url`:

```js
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readerSource = path.join(__dirname, 'reader', 'bmad-sl-reader.js');
```

This ensures the correct source whether running from a local clone or via `npx`.

### Install Function Signature

```js
export default function install(paths = defaultPaths) { ... }
```

Where `defaultPaths` is:
```js
const home = os.homedir();
const defaultPaths = {
  claudeSettings: path.join(home, '.claude', 'settings.json'),
  claudeDir: path.join(home, '.claude'),
  claudeProjects: path.join(home, '.claude', 'projects'),
  ccstatuslineSettings: path.join(home, '.config', 'ccstatusline', 'settings.json'),
  ccstatuslineDir: path.join(home, '.config', 'ccstatusline'),
  readerDest: path.join(home, '.config', 'bmad-statusline', 'bmad-sl-reader.js'),
  readerDir: path.join(home, '.config', 'bmad-statusline'),
  cacheDir: path.join(home, '.cache', 'bmad-status'),
  claudeMd: path.join(process.cwd(), '.claude', 'CLAUDE.md'),
  claudeMdDir: path.join(process.cwd(), '.claude'),
  projectDir: process.cwd(),
};
```

Tests inject custom paths pointing to `fs.mkdtempSync` temp directories.

### Project Structure Notes

Files modified/created by this story:
```
bmad-statusline/
  src/
    defaults.js             # POPULATED: real config templates (was stubs)
    install.js              # REPLACED: real install logic (was stub)
  test/
    install.test.js         # NEW: comprehensive install tests
    defaults.test.js        # UPDATED: tests for real implementations
    cli.test.js             # UPDATED: remove stub assertion
    fixtures/
      claude-settings-empty.json              # NEW
      claude-settings-with-statusline.json    # NEW
      ccstatusline-settings-empty.json        # NEW
      ccstatusline-settings-with-bmad.json    # NEW
      claude-md-with-block.md                 # NEW
      claude-md-without-block.md              # NEW
      status-sample.json                      # NEW
```

### Previous Story Intelligence

**From Story 1.1 implementation:**
- Node v24.13.0 requires `node --test test/*.test.js` glob pattern (not directory form) — already fixed in package.json `"test": "node --test test/*.test.js"`
- `engines` bumped to `>=20` (from `>=16`) because `node --test` requires Node 18+ and Node 20 LTS is stable minimum
- CLI dispatch (`bin/cli.js`) calls `mod.default()` — install.js must `export default function install(...)`
- defaults.test.js currently tests stubs with loose assertions (type checks only) — needs update for real values
- cli.test.js has a test expecting `'Not yet implemented'` from install — will fail once install.js is real

**From Story 1.1 review (deferred items affecting this story):**
- Reader CJS in ESM package — pre-existing, no action needed for install story
- Reader is copied as-is (no modifications to reader in this story)

**preserveColors spike result:**
- Exact key: `preserveColors` (boolean), available since ccstatusline v1.0.13
- When `true`, ccstatusline passes ANSI escape codes through to terminal
- All BMAD widgets should be created with `preserveColors: true`

### Testing Conventions

- Framework: `node:test` + `node:assert` (built-in, zero deps)
- Each test creates a temp dir via `fs.mkdtempSync`, populates from fixtures, passes `paths` to install function
- Clean up temp dirs in `after()` hooks
- Test the `install(paths)` function directly (not via CLI subprocess) for unit-level control
- CLI integration test can do a simple smoke test via `execSync`
- Verify idempotency by running install twice on same temp dir and asserting no duplication

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Core Architectural Decisions] — config management, install scope detection table, CLAUDE.md generation
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules] — 6 mandatory patterns (error duality, sync fs, colorize, JSON mutation, path construction, console output)
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries] — Boundary 3 (command modules) and Boundary 4 (defaults)
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2] — full acceptance criteria with BDD format
- [Source: _bmad-output/project-context.md#ccstatusline Contract] — v3 format, widget properties, detection pattern
- [Source: _bmad-output/project-context.md#Install Scope Detection] — 5-target detection table
- [Source: _bmad-output/project-context.md#Status File Format] — JSON schema for CLAUDE.md block content
- [Source: _bmad-output/implementation-artifacts/1-1-package-scaffolding-spike-preserve-colors.md] — previous story learnings, review findings, file list

### Review Findings

- [x] [Review][Patch] `process.exit(1)` per-target causes partial install — collect errors, exit once at end [src/install.js] ✓ fixed
- [x] [Review][Patch] CLI test runs `install` against real filesystem — replaced with module load check [test/cli.test.js] ✓ fixed
- [x] [Review][Patch] Slug encoding: leading hyphen on Unix — strip leading `-` from generated slug [src/install.js:57] ✓ fixed
- [x] [Review][Patch] Target 1 truthiness check → key-existence — `if ('statusLine' in config)` [src/install.js:80] ✓ fixed
- [x] [Review][Patch] Target 2: `config.lines` accessed without guard — added Array.isArray check [src/install.js:115] ✓ fixed
- [x] [Review][Patch] Orphaned single marker — warn and append, validate startIdx < endIdx [src/install.js:190-204] ✓ fixed
- [x] [Review][Patch] No validation `startIdx < endIdx` in marker replacement — merged with orphaned marker fix ✓ fixed
- [x] [Review][Patch] Missing test coverage for `resolveSlug` — 3 tests added [test/install.test.js] ✓ fixed
- [x] [Review][Defer] Slug basename fallback ambiguity with same-named projects [src/install.js:62-63] — deferred, design-level concern
- [x] [Review][Defer] Stale .bak could restore wrong state on repeated failures [src/install.js:94-96] — deferred, pre-existing pattern
- [x] [Review][Defer] No test for validation failure/.bak restore path — blocked by process.exit(1) [test/install.test.js] — deferred
- [x] [Review][Defer] Corrupted JSON gives generic SyntaxError without file path [src/install.js:109] — deferred, nice-to-have

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation, all 77 tests passing on first full run (only fix was a test assertion checking for literal "null" which appeared in `/dev/null` in the glob fallback).

### Completion Notes List

- Populated `src/defaults.js` with 3 real config template functions: `getStatusLineConfig()` (ccstatusline command config), `getWidgetDefinitions(readerPath)` (bmad-agent + separator + bmad-compact widget set), `generateClaudeMdBlock(slug)` (full instruction block with session discovery, schema, rules)
- Implemented `src/install.js` with: default paths object, 3 logging helpers, 3 JSON mutation helpers, `resolveSlug()` (path-to-slug encoding + basename fallback), and 5 install targets
- Target 1: claude settings.json statusLine config (add/skip/create)
- Target 2: ccstatusline settings.json widget injection on line index 1 (inject/skip/create v3 skeleton)
- Target 3: reader deployment via `import.meta.url` resolution (always overwrite)
- Target 4: cache directory creation (create/skip)
- Target 5: CLAUDE.md instruction block with marker-based replace logic (append/replace/create)
- Created 7 test fixtures covering all install scenarios
- Created comprehensive `test/install.test.js` with 19 tests covering all 5 targets, idempotency, multi-project, backup creation, and post-write validation
- Updated `test/defaults.test.js` with real value assertions (non-empty, structure, markers)
- Updated `test/cli.test.js` to remove stub assertion

### Change Log

- 2026-03-28: Story 1.2 implemented — full install command with 5 targets, idempotency, path injection for testability. 77/77 tests passing.
- 2026-03-28: Code review — 8 patches applied (process.exit collection, CLI test isolation, slug leading hyphen, key-existence check, config.lines guard, marker validation, resolveSlug tests). 4 deferred. 80/80 tests passing.

### File List

- `src/defaults.js` — MODIFIED: populated getStatusLineConfig(), getWidgetDefinitions(), generateClaudeMdBlock()
- `src/install.js` — REPLACED: full install logic (was stub)
- `test/install.test.js` — NEW: 19 tests for install command
- `test/defaults.test.js` — MODIFIED: real value assertions
- `test/cli.test.js` — MODIFIED: removed stub assertion
- `test/fixtures/claude-settings-empty.json` — NEW
- `test/fixtures/claude-settings-with-statusline.json` — NEW
- `test/fixtures/ccstatusline-settings-empty.json` — NEW
- `test/fixtures/ccstatusline-settings-with-bmad.json` — NEW
- `test/fixtures/claude-md-with-block.md` — NEW
- `test/fixtures/claude-md-without-block.md` — NEW
- `test/fixtures/status-sample.json` — NEW
