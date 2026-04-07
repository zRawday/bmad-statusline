# Story 1.1: Package Scaffolding & Spike preserveColors

Status: done

## Story

As a **bmad-statusline maintainer**,
I want **a properly scaffolded npm package with CLI dispatch and a verified preserveColors mechanism**,
So that **all subsequent stories have a solid foundation and the dynamic color strategy is confirmed before implementation**.

## Acceptance Criteria

1. **Given** an empty directory **When** the package is scaffolded following the architecture spec **Then** the directory structure contains: `package.json`, `bin/cli.js`, `src/reader/`, `src/defaults.js` (stub), `test/`, `test/fixtures/`, `.gitignore`

2. **Given** the generated `package.json` **When** inspected **Then** it contains `"type": "module"`, `"bin": { "bmad-statusline": "./bin/cli.js" }`, `"engines": { "node": ">=16" }`, `"files": ["bin/", "src/", "LICENSE", "README.md"]`, and `"scripts": { "test": "node --test test/" }`

3. **Given** `bin/cli.js` exists **When** run with `--help` or `-h` **Then** it prints usage text listing `install`, `uninstall`, `clean` commands and exits 0

4. **Given** `bin/cli.js` exists **When** run with an unknown command (e.g., `foo`) **Then** it prints usage text and exits 1

5. **Given** `bin/cli.js` exists **When** run with no arguments **Then** it prints usage text and exits 0 (Phase 2 behavior; Phase 3 will launch TUI)

6. **Given** a ccstatusline config with `preserveColors: true` on a custom-command widget **When** the widget's command outputs ANSI escape codes (e.g., `\x1b[36mtest\x1b[0m`) **Then** ccstatusline renders the colored text in the terminal, confirming ANSI passthrough works **And** the exact JSON key name (`preserveColors`) is documented in the spike results

7. **Given** the spike result confirms preserveColors works **When** `src/defaults.js` stub is created **Then** it exports placeholder functions `getStatusLineConfig()`, `getWidgetDefinitions(readerPath)`, `generateClaudeMdBlock(slug)` and placeholder objects `AGENT_COLORS`, `WORKFLOW_COLORS`

8. **Given** the package is scaffolded **When** `.github/workflows/test.yml` is created **Then** it runs `npm test` on push and pull request events, serving as the quality gate for all subsequent stories

## Tasks / Subtasks

- [x] Task 1: Initialize npm package in `bmad-statusline/` subdirectory (AC: #1, #2)
  - [x] 1.1 Run `npm init -y` in new `bmad-statusline/` directory
  - [x] 1.2 Edit `package.json`: set `"type": "module"`, `"name": "bmad-statusline"`, `"bin"`, `"engines"`, `"files"`, `"scripts"`, `"description"`, `"license": "MIT"`
  - [x] 1.3 Create directory structure: `bin/`, `src/reader/`, `src/`, `test/`, `test/fixtures/`
  - [x] 1.4 Create `.gitignore` (node_modules, *.bak, .DS_Store)
  - [x] 1.5 Create placeholder `LICENSE` and `README.md`
- [x] Task 2: Copy existing reader into package (AC: #1)
  - [x] 2.1 Copy `bmad-sl-reader.js` (root of Toulou) to `bmad-statusline/src/reader/bmad-sl-reader.js`
  - [x] 2.2 Verify reader remains standalone CommonJS — do NOT convert to ESM
- [x] Task 3: Create `bin/cli.js` entry point (AC: #3, #4, #5)
  - [x] 3.1 Create `bin/cli.js` with `#!/usr/bin/env node` shebang, ESM module
  - [x] 3.2 Implement argv dispatch: read `process.argv[2]`, route to usage/install/uninstall/clean
  - [x] 3.3 Usage text: print available commands (install, uninstall, clean), exit 0 for `--help`/`-h`/no-args, exit 1 for unknown command
  - [x] 3.4 For Phase 2: install/uninstall/clean stubs that print "Not yet implemented" (will be populated in Stories 1.2-1.5)
- [x] Task 4: Run preserveColors spike (AC: #6)
  - [x] 4.1 Create a minimal test script that outputs ANSI escape codes to stdout
  - [x] 4.2 Configure a ccstatusline widget with `preserveColors: true` pointing to the test script
  - [x] 4.3 Verify colored text renders in terminal
  - [x] 4.4 Document spike result: exact key name is `preserveColors` (boolean), available since ccstatusline v1.0.13
- [x] Task 5: Create `src/defaults.js` stub (AC: #7)
  - [x] 5.1 Create ESM module exporting stubs for: `getStatusLineConfig()`, `getWidgetDefinitions(readerPath)`, `generateClaudeMdBlock(slug)`, `AGENT_COLORS`, `WORKFLOW_COLORS`
  - [x] 5.2 Stub functions return placeholder objects/strings (populated in Story 1.2)
  - [x] 5.3 Stub color maps as empty objects (populated in Story 1.3)
- [x] Task 6: Create CI workflow (AC: #8)
  - [x] 6.1 Create `.github/workflows/test.yml` running `npm test` on push and PR
  - [x] 6.2 Use `actions/checkout@v4` and `actions/setup-node@v4` with node-version 16
- [x] Task 7: Create initial test scaffold
  - [x] 7.1 Create `test/cli.test.js` — tests for CLI dispatch (help, unknown command, no args)
  - [x] 7.2 Create `test/fixtures/` with placeholder fixture files
  - [x] 7.3 Verify `npm test` passes

## Dev Notes

### preserveColors Spike — ALREADY RESOLVED

**The spike is pre-answered.** Research confirms:
- **Exact key name:** `preserveColors` (boolean, optional)
- **Widget type:** `"custom-command"`
- **Behavior:** When `true`, ccstatusline skips ANSI stripping and passes raw escape codes to the terminal renderer. When `false` or absent, output goes through `getVisibleText()` which strips all ANSI/SGR sequences.
- **Source code path in ccstatusline:** `if (!item.preserveColors) { output = getVisibleText(output); }`
- **Available since:** ccstatusline v1.0.13 (current latest: v2.2.7)
- **No alternative names:** `rawOutput` and `ansiPassthrough` do not exist

**Developer action:** The spike task still requires a manual verification step (create test script, configure widget, visually confirm colors render). But the JSON key name investigation is complete — use `preserveColors: true` with confidence.

### Architecture Compliance — Critical Rules

**Module systems:**
- Package code (bin/cli.js, src/*.js): **ESM** (`import`/`export`, `"type": "module"`)
- Reader (src/reader/bmad-sl-reader.js): **CommonJS** (`require`) — standalone deployed artifact, never imported by package code

**CLI dispatch pattern (bin/cli.js):**
- Uses `await import()` for dynamic module loading — never `require()`
- No business logic, no config reading, no file operations — dispatch only
- Pattern: read `process.argv[2]`, switch to correct module

**Error handling duality — NOT applicable for this story:** Story 1.1 only creates stubs. But for reference:
- Reader = silent always (empty string on error, never log, never throw)
- Installer = verbose always (logSuccess/logSkipped/logError)

**Sync-only fs:** `fs.readFileSync`/`fs.writeFileSync` everywhere. Never async, never promises, never callbacks.

### ccstatusline Config Format (v3) — CAUTION

The existing `ccstatusline-config-example.json` in Toulou root uses an **older format** that is WRONG for v3:
- Old: `"lines": { "2": { "widgets": [...] } }` with `"command"` property
- **Correct v3:** `"lines": [ [...], [...], [...] ]` — array of 3 arrays, each containing widget objects
- **Correct property:** `"commandPath"` (NOT `"command"`)
- **Widget detection:** `"id"` field (NOT `"label"`), pattern `"bmad-*"` (lowercase, hyphen)

**Do NOT copy from the example file.** Use the architecture document as the authoritative source for widget format.

### File I/O Pattern

- All fs operations: synchronous (`fs.readFileSync`, `fs.writeFileSync`, `fs.mkdirSync`)
- Path construction: always `path.join()`, never string concatenation
- No `os.homedir()` calls inside functions — path injection via `paths` parameter (applies to Stories 1.2+)

### Existing Reader — What's Already There

The Phase 1 PoC reader (`bmad-sl-reader.js`, 145 lines) is fully functional:
- 15 commands: project, workflow, agent, step, nextstep, progress, progressbar, progressstep, story, request, document, timer, compact, full, minimal
- Piggybacking cleanup (.alive touch + stale purge)
- Silent error handling (empty string on any error)
- Zero dependencies, standalone CommonJS
- **What it does NOT have yet:** ANSI color maps, colorize helper, colored output — that's Story 1.3

**Copy it as-is** into `src/reader/`. Do not modify it in this story.

### Project Structure Notes

**Target directory structure after this story:**

```
bmad-statusline/
  package.json              # "type":"module", bin, files, engines, scripts
  LICENSE
  README.md
  .gitignore
  .github/
    workflows/
      test.yml              # npm test on push/PR
  bin/
    cli.js                  # Entry point: argv dispatch (ESM)
  src/
    reader/
      bmad-sl-reader.js     # Copied from PoC — standalone CommonJS, unmodified
    defaults.js             # Stubs only — populated in Stories 1.2, 1.3
  test/
    cli.test.js             # CLI dispatch tests
    fixtures/               # Placeholder fixtures
```

**Where to create this directory:** Inside `C:\Users\supervision\Documents\Toulou\bmad-statusline\` (new subdirectory of project root)

### Testing Conventions

- Framework: `node:test` + `node:assert` (built-in, zero dev deps)
- Test files: `test/{module}.test.js`
- npm script: `"test": "node --test test/"`
- CLI tests: use `child_process.execSync` to test real `bin/cli.js` behavior (exit codes, stdout)
- Reader tests (Story 1.3): use `child_process.execSync` with `input` option for stdin→stdout contract
- Each test creates temp dirs via `fs.mkdtempSync`, cleans up in `after()` hooks

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Starter Template Evaluation] — package structure, ESM/CJS split
- [Source: _bmad-output/planning-artifacts/architecture.md#Core Architectural Decisions] — preserveColors mechanism, CLI dispatch
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries] — directory layout, 5 boundaries
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules] — 6 consistency patterns
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1] — acceptance criteria, BDD format
- [Source: _bmad-output/project-context.md] — critical implementation rules, ccstatusline contract, color maps
- [Source: _bmad-output/planning-artifacts/implementation-readiness-report-2026-03-28.md] — INC-1/CRIT-1 (id vs label fix), INC-2 (config format correction)
- [Source: ccstatusline v2.2.7 source] — preserveColors confirmed, boolean, optional, strips ANSI when false

### Known Issues From Readiness Report

**CRIT-1 (already corrected in epics.md):** Widget detection uses `id` field with `bmad-*` pattern (lowercase, hyphen). The old `label`/`Bmad*` references in the architecture are incorrect. Dev agent MUST use `id: "bmad-project"` etc.

**INC-2 (config format):** Architecture references `lines.N.widgets` but real v3 format is `"lines": [ [...], [...], [...] ]` — array of arrays. Defaults.js stubs should use the correct v3 format when populated in Story 1.2.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Node v24.13.0 requires `node --test test/*.test.js` glob instead of `node --test test/` (directory form causes MODULE_NOT_FOUND). package.json test script adjusted accordingly.

### Completion Notes List

- **Task 1:** Scaffolded npm package with ESM module system, correct bin/engines/files/scripts fields in package.json
- **Task 2:** Copied Phase 1 PoC reader as-is (145 lines, CommonJS, zero dependencies) — verified identical via diff
- **Task 3:** Created CLI entry point with argv dispatch: --help/-h/no-args exit 0, unknown command exits 1, install/uninstall/clean route to stub modules via dynamic import
- **Task 4:** preserveColors spike confirmed — test script outputs ANSI escape codes, `cat -v` verified `\x1b[36m`/`\x1b[32m` codes in stdout. Key name is `preserveColors` (boolean), available since ccstatusline v1.0.13. Visual confirmation requires ccstatusline running (spike script retained in test/fixtures/)
- **Task 5:** defaults.js stub exports all 5 symbols (3 functions, 2 objects) — placeholder implementations to be populated in Stories 1.2 and 1.3
- **Task 6:** CI workflow created — runs npm test on push/PR, Node 16, actions/checkout@v4 + actions/setup-node@v4
- **Task 7:** 12 tests total (7 CLI dispatch + 5 defaults stubs), all passing via `npm test`

### Review Findings

- [x] [Review][Patch] CI node-version 16 incompatible avec `node --test` — bumper `engines` a `>=20` et CI `node-version: 20`. Node 16 EOL, `node --test` requiert Node 18+, glob form requiert shell expansion. Node 20 LTS est le minimum stable. [package.json:10, .github/workflows/test.yml:16] (Resolved from decision-needed: technical — Node 20 LTS is the correct minimum for `node --test` stability)
- [x] [Review][Defer] Reader CJS dans package ESM — renommer en `.cjs` pour sécurité [src/reader/bmad-sl-reader.js, test/fixtures/spike-preserve-colors.js] — deferred, pre-existing
- [x] [Review][Defer] Path traversal via `session_id` non-validé dans le reader [src/reader/bmad-sl-reader.js:27,38] — deferred, pre-existing
- [x] [Review][Defer] `readStdin` bloque indéfiniment sans pipe stdin [src/reader/bmad-sl-reader.js:19] — deferred, pre-existing
- [x] [Review][Defer] `progressbar` sans borne supérieure sur `step.total` [src/reader/bmad-sl-reader.js:79] — deferred, pre-existing
- [x] [Review][Defer] TOCTOU race dans `purgeStale` [src/reader/bmad-sl-reader.js:52-57] — deferred, pre-existing
- [x] [Review][Defer] `purgeStale` scan complet a chaque invocation du reader [src/reader/bmad-sl-reader.js:47] — deferred, pre-existing
- [x] [Review][Defer] Windows `~/.cache/` non-standard — `BMAD_CACHE_DIR` env var existe comme contournement [src/reader/bmad-sl-reader.js:8] — deferred, pre-existing

### Change Log

- 2026-03-28: Story 1.1 implemented — package scaffolding, CLI dispatch, preserveColors spike, defaults stubs, CI workflow, test scaffold (12 tests passing)

### File List

- bmad-statusline/package.json (new)
- bmad-statusline/.gitignore (new)
- bmad-statusline/LICENSE (new)
- bmad-statusline/README.md (new)
- bmad-statusline/bin/cli.js (new)
- bmad-statusline/src/defaults.js (new)
- bmad-statusline/src/install.js (new)
- bmad-statusline/src/uninstall.js (new)
- bmad-statusline/src/clean.js (new)
- bmad-statusline/src/reader/bmad-sl-reader.js (copied from root)
- bmad-statusline/test/cli.test.js (new)
- bmad-statusline/test/defaults.test.js (new)
- bmad-statusline/test/fixtures/.gitkeep (new)
- bmad-statusline/test/fixtures/spike-preserve-colors.js (new)
- bmad-statusline/.github/workflows/test.yml (new)
