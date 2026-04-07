# Story 1.3: Reader Color Maps & Composite Widgets

Status: done

## Story

As a **developer running BMAD workflows**,
I want **my statusline to display color-coded agent names and workflow categories, plus compact composite views**,
So that **I can identify at a glance who is active and what type of work is in progress across multiple terminals**.

## Acceptance Criteria

1. **Given** the reader is called with command `agent` **When** the status file contains `"agent": ["Amelia"]` **Then** the output is `\x1b[36mAmelia\x1b[0m` (cyan, per architecture color map)

2. **Given** the reader is called with command `agent` **When** the status file contains `"agent": ["Amelia", "Bob"]` **Then** the output is `\x1b[36mAmelia\x1b[0m, \x1b[32mBob\x1b[0m` (each agent individually colored)

3. **Given** the reader is called with command `workflow` **When** the status file contains `"workflow": "dev-story"` **Then** the output is `\x1b[36mdev-story\x1b[0m` (cyan, Dev category)

4. **Given** the reader is called with command `agent` **When** the status file contains an unknown agent name (e.g., `"agent": ["NewAgent"]`) **Then** the output is `NewAgent` (plain text, no ANSI, no error)

5. **Given** the reader is called with command `workflow` **When** the status file contains an unknown workflow name **Then** the output is the workflow name in plain text (no ANSI, no error)

6. **Given** the reader source code **When** inspected **Then** all ANSI coloring uses a single `colorize(text, ansiCode)` helper function **And** no inline escape code sequences exist outside the helper **And** the helper returns plain text when `ansiCode` is falsy

7. **Given** the reader source code **When** inspected **Then** `AGENT_COLORS` (16 agents) and `WORKFLOW_COLORS` (10 categories) are defined at top of file, after constants, before helpers — per architecture layout

8. **Given** the reader is called with commands `project`, `step`, `nextstep`, `progress`, `progressbar`, `progressstep`, `story`, `request`, `document`, `timer` **When** the status file contains valid data **Then** outputs are plain text (no ANSI codes)

9. **Given** the reader is called with command `compact` **When** the status file contains project, workflow, story, and progressstep data **Then** the output assembles colored segments with uncolored separator ` · ` (e.g., `Toulou · \x1b[36mdev-story\x1b[0m · 2-1 · 3/6 implementation`)

10. **Given** the reader is called with command `full` **When** the status file contains all fields **Then** the output includes project, workflow (colored), story/request, progress, and next step — separated by ` · `

11. **Given** the reader is called with command `minimal` **When** the status file contains workflow and step data **Then** the output includes workflow (colored) and progressstep only — separated by ` · `

12. **Given** a composite command is called **When** any segment field is null or empty **Then** that segment is omitted and separators adjust (no double separators, no trailing separator)

13. **Given** a composite command is called **When** the status file exists with valid JSON but ALL fields are null **Then** the output is an empty string (not orphan separators, not whitespace)

14. **Given** the reader is called for any command **When** it processes a valid session_id **Then** it touches `.alive-{session_id}` in the cache directory

15. **Given** `.alive-*` files exist in the cache directory **When** the reader runs cleanup **Then** any `.alive-*` file older than 5 minutes triggers deletion of both the `.alive-*` file and corresponding `status-*.json`

16. **Given** the `BMAD_CACHE_DIR` environment variable is set **When** the reader is executed **Then** it uses the env var path instead of the default `~/.cache/bmad-status/`

17. **Given** the reader encounters any error (missing file, bad JSON, unknown command) **When** the error occurs **Then** it returns an empty string, never writes to stderr, never throws

18. **Given** `AGENT_COLORS` keys in `src/reader/bmad-sl-reader.js` and `src/defaults.js` **When** a sync test compares both sets by reading source files and extracting keys via regex **Then** the agent lists match exactly (no drift between reader and defaults)

19. **Given** `WORKFLOW_COLORS` keys in `src/reader/bmad-sl-reader.js` and `src/defaults.js` **When** a sync test compares both sets by reading source files and extracting keys via regex **Then** the workflow category lists match exactly (no drift between reader and defaults)

## Tasks / Subtasks

- [x] Task 1: Add `BMAD_CACHE_DIR` env var support to reader (AC: #16)
  - [x] 1.1 Change line 8 of `bmad-sl-reader.js`: `const CACHE_DIR = process.env.BMAD_CACHE_DIR || path.join(os.homedir(), '.cache', 'bmad-status');`
  - [x] 1.2 Verify all existing functionality still works (silent error handling, cleanup, extractors)

- [x] Task 2: Add color maps to reader (AC: #1, #3, #7)
  - [x] 2.1 Add `AGENT_COLORS` map (16 agents) after `ALIVE_MAX_AGE_MS`, before helpers section — see exact map in Dev Notes
  - [x] 2.2 Add `WORKFLOW_COLORS` map (all individual workflow names) after `AGENT_COLORS` — see exact map in Dev Notes
  - [x] 2.3 Add `WORKFLOW_PREFIX_COLORS` array for prefix-based fallback matching (`testarch-`, `qa-generate-`, `wds-`) — see Dev Notes

- [x] Task 3: Add colorize helper to reader (AC: #6)
  - [x] 3.1 Add `RESET` constant and `colorize(text, ansiCode)` function in the Helpers section
  - [x] 3.2 `colorize` returns `text || ''` when `ansiCode` is falsy, returns `${ansiCode}${text}${RESET}` otherwise
  - [x] 3.3 Verify no inline ANSI escape codes exist anywhere else in the file

- [x] Task 4: Add workflow color lookup helper (AC: #3, #5)
  - [x] 4.1 Add `getWorkflowColor(workflow)` helper that: (1) exact match in WORKFLOW_COLORS, (2) prefix match in WORKFLOW_PREFIX_COLORS, (3) returns null if no match
  - [x] 4.2 Unknown workflows return null -> colorize returns plain text

- [x] Task 5: Modify `workflow` extractor (AC: #3, #5)
  - [x] 5.1 Change from `(s) => s.workflow || ''` to lookup in WORKFLOW_COLORS via `getWorkflowColor()`, apply `colorize()`
  - [x] 5.2 Unknown workflows output plain text (no ANSI, no error)

- [x] Task 6: Modify `agent` extractor (AC: #1, #2, #4)
  - [x] 6.1 Change to individually color each agent in the array: map each name through AGENT_COLORS, apply `colorize()`, join with `, `
  - [x] 6.2 Unknown agents output plain text per agent (no ANSI, no error)
  - [x] 6.3 Single agent: `\x1b[36mAmelia\x1b[0m` — multi agent: `\x1b[36mAmelia\x1b[0m, \x1b[32mBob\x1b[0m`

- [x] Task 7: Modify composite extractors (AC: #9, #10, #11, #12, #13)
  - [x] 7.1 Create helper functions that return colored workflow and agent segments for use in composites
  - [x] 7.2 `compact`: `[project, coloredWorkflow, storyOrRequest, progressstep].filter(Boolean).join(' · ')`
  - [x] 7.3 `full`: `[project, coloredWorkflow, storyOrRequest, progress, nextStep].filter(Boolean).join(' · ')`
  - [x] 7.4 `minimal`: `[coloredWorkflow, progressstep].filter(Boolean).join(' · ')`
  - [x] 7.5 Verify empty/null fields are omitted (no double separators, no trailing separators)
  - [x] 7.6 Verify all-null fields produce empty string (not orphan separators)

- [x] Task 8: Verify existing behavior preserved (AC: #8, #14, #15, #17)
  - [x] 8.1 Confirm `project`, `step`, `nextstep`, `progress`, `progressbar`, `progressstep`, `story`, `request`, `document`, `timer` — all return plain text (no ANSI codes)
  - [x] 8.2 Confirm `touchAlive()` and `purgeStale()` functions are pre-existing and unchanged — do NOT reimplement, only verify they work with `BMAD_CACHE_DIR`
  - [x] 8.3 Confirm silent error handling is preserved — all error paths still return empty string via `process.stdout.write('')`

- [x] Task 9: Populate color maps in `src/defaults.js` (AC: #18, #19)
  - [x] 9.1 Populate `AGENT_COLORS` with same 16 agent keys and ANSI codes as reader
  - [x] 9.2 Populate `WORKFLOW_COLORS` with same workflow keys and ANSI codes as reader (including prefix entries)
  - [x] 9.3 Add `WORKFLOW_PREFIX_COLORS` array to defaults.js matching the reader's prefix array
  - [x] 9.4 Keep stub functions (`getStatusLineConfig`, `getWidgetDefinitions`, `generateClaudeMdBlock`) untouched — they are populated in Story 1.2

- [x] Task 10: Create reader tests (AC: #1-#17)
  - [x] 10.1 Create `test/reader.test.js` using `child_process.execSync` for real stdin->stdout contract testing
  - [x] 10.2 Tests use `BMAD_CACHE_DIR` env var pointing to temp directory (via `fs.mkdtempSync`)
  - [x] 10.3 Write status file to temp cache dir, then exec reader with command and stdin JSON
  - [x] 10.4 Test agent coloring: single agent colored, multi-agent each colored, unknown agent plain text
  - [x] 10.5 Test workflow coloring: known workflow colored, prefix-matched workflow colored, unknown workflow plain text
  - [x] 10.6 Test plain text extractors: `project`, `step`, `nextstep`, `progress`, `progressbar`, `progressstep`, `story`, `request`, `document`, `timer` — verify no ANSI codes in output
  - [x] 10.7 Test composite extractors: `compact`, `full`, `minimal` — verify colored segments, uncolored separators
  - [x] 10.8 Test composite edge cases: null fields omitted, all-null produces empty string
  - [x] 10.9 Test .alive cleanup: stale file older than 5 min triggers deletion
  - [x] 10.10 Test error handling: missing file, bad JSON, unknown command — all return empty string
  - [x] 10.11 Clean up temp dirs in `after()` hooks

- [x] Task 11: Create color maps sync test (AC: #18, #19)
  - [x] 11.1 Add sync test in `test/reader.test.js` (or separate `test/color-sync.test.js`)
  - [x] 11.2 Read `src/reader/bmad-sl-reader.js` and `src/defaults.js` as text files
  - [x] 11.3 Extract `AGENT_COLORS` keys from both files via regex
  - [x] 11.4 Extract `WORKFLOW_COLORS` keys from both files via regex
  - [x] 11.5 Assert both key sets match exactly — fail if any drift detected

- [x] Task 12: Verify all tests pass
  - [x] 12.1 Run `npm test` — all existing tests (CLI, defaults) plus new reader tests must pass
  - [x] 12.2 Verify zero test failures

## Dev Notes

### CRITICAL: Reader is Standalone CommonJS

The reader (`src/reader/bmad-sl-reader.js`) is a **standalone CommonJS** script. It is NOT part of the ESM package module system. It uses `require()`, not `import`. It is deployed to `~/.config/bmad-statusline/` at install time and executed directly by ccstatusline via `node`.

**Do NOT:**
- Convert reader to ESM
- Add `import` statements to reader
- Import from `defaults.js` or any other package module
- Add any external dependencies

The reader must remain self-contained with zero dependencies.

### Error Handling: SILENT ALWAYS in Reader

The reader uses the **silent** error handling philosophy. On ANY error:
- Return empty string via `process.stdout.write('')`
- Never `console.log`, never `console.error`, never `throw`
- This includes unknown commands, missing files, bad JSON, unknown agent/workflow names

### Exact AGENT_COLORS Map (16 Agents)

```js
const AGENT_COLORS = {
  'Amelia': '\x1b[36m',       // cyan — dev
  'Bob': '\x1b[32m',          // green — scrum master
  'John': '\x1b[33m',         // yellow — PM
  'Quinn': '\x1b[31m',        // red — QA
  'Winston': '\x1b[35m',      // magenta — architect
  'Mary': '\x1b[34m',         // blue — analyst
  'Sally': '\x1b[95m',        // brightMagenta — UX
  'Paige': '\x1b[37m',        // white — tech writer
  'Barry': '\x1b[96m',        // brightCyan — quick flow
  'Carson': '\x1b[93m',       // brightYellow — brainstorming
  'Murat': '\x1b[91m',        // brightRed — test architect
  'Maya': '\x1b[92m',         // brightGreen — design thinking
  'Victor': '\x1b[94m',       // brightBlue — innovation
  'Sophia': '\x1b[95m',       // brightMagenta — storyteller
  'Dr. Quinn': '\x1b[97m',    // brightWhite — problem solver
  'Caravaggio': '\x1b[33m',   // yellow — presentation
};
```

### Exact WORKFLOW_COLORS Map (Individual Workflows -> Category ANSI)

The architecture specifies "10 categories" but the reader needs direct workflow-name lookup. Map every known workflow name to its category color. For wildcard categories (`testarch-*`, `qa-generate-*`, `wds-*`), use prefix fallback.

```js
const WORKFLOW_COLORS = {
  // Dev (cyan)
  'dev-story': '\x1b[36m',
  'quick-dev': '\x1b[36m',
  // Review (brightRed)
  'code-review': '\x1b[91m',
  // Planning (green)
  'sprint-planning': '\x1b[32m',
  'sprint-status': '\x1b[32m',
  'create-story': '\x1b[32m',
  'create-epics': '\x1b[32m',
  // Product (yellow)
  'create-prd': '\x1b[33m',
  'edit-prd': '\x1b[33m',
  'validate-prd': '\x1b[33m',
  // Architecture (magenta)
  'create-architecture': '\x1b[35m',
  'create-ux-design': '\x1b[35m',
  // Research (blue)
  'domain-research': '\x1b[34m',
  'technical-research': '\x1b[34m',
  'market-research': '\x1b[34m',
  // Creative (brightYellow)
  'brainstorming': '\x1b[93m',
  'party-mode': '\x1b[93m',
  'retrospective': '\x1b[93m',
  // Documentation (white)
  'document-project': '\x1b[37m',
  'generate-project-context': '\x1b[37m',
};

// Prefix fallback for wildcard categories
const WORKFLOW_PREFIX_COLORS = [
  { prefix: 'testarch-', color: '\x1b[31m' },       // Quality (red)
  { prefix: 'qa-generate-', color: '\x1b[31m' },     // Quality (red)
  { prefix: 'wds-', color: '\x1b[94m' },             // WDS (brightBlue)
];
```

### Workflow Color Lookup Logic

```js
function getWorkflowColor(workflow) {
  if (!workflow) return null;
  if (WORKFLOW_COLORS[workflow]) return WORKFLOW_COLORS[workflow];
  for (const { prefix, color } of WORKFLOW_PREFIX_COLORS) {
    if (workflow.startsWith(prefix)) return color;
  }
  return null;
}
```

The dev agent MUST implement this exact three-tier lookup: exact match -> prefix match -> null (plain text).

### Colorize Helper — Exact Implementation

```js
const RESET = '\x1b[0m';

function colorize(text, ansiCode) {
  if (!text || !ansiCode) return text || '';
  return `${ansiCode}${text}${RESET}`;
}
```

Place `RESET` after the color maps. Place `colorize` as the first helper function, before `ensureCacheDir`.

### Reader File Layout After Modification

The reader file must maintain this layout order:

```
#!/usr/bin/env node
'use strict';
const fs/path/os requires
const CACHE_DIR (with BMAD_CACHE_DIR env var support)
const ALIVE_MAX_AGE_MS
// --- Color maps ---
const AGENT_COLORS = { ... };
const WORKFLOW_COLORS = { ... };
const WORKFLOW_PREFIX_COLORS = [ ... ];
// --- Helpers ---
const RESET = '\x1b[0m';
function colorize(text, ansiCode) { ... }
function getWorkflowColor(workflow) { ... }
function ensureCacheDir() { ... }
function readStdin() { ... }
function readStatusFile(sessionId) { ... }
// --- Piggybacking cleanup ---
function touchAlive(sessionId) { ... }
function purgeStale() { ... }
// --- Field extractors ---
function formatTimer(startedAt) { ... }
function formatProgressBar(step) { ... }
function formatProgressStep(step) { ... }
function getStoryOrRequest(status) { ... }
// --- Colored extractors ---
function coloredWorkflow(s) { ... }
function coloredAgent(s) { ... }
const COMMANDS = { ... };
// --- Main ---
function main() { ... }
main();
```

### Modified COMMANDS Object

```js
const COMMANDS = {
  project:      (s) => s.project || '',
  workflow:     (s) => colorize(s.workflow || '', getWorkflowColor(s.workflow)),
  agent:        (s) => {
    if (!Array.isArray(s.agent)) return colorize(s.agent || '', AGENT_COLORS[s.agent]);
    return s.agent.filter(Boolean).map(a => colorize(a, AGENT_COLORS[a])).join(', ');
  },
  step:         (s) => (s.step && s.step.current_name) || '',
  nextstep:     (s) => (s.step && s.step.next_name) || '',
  progress:     (s) => (s.step && s.step.total) ? `${s.step.completed || 0}/${s.step.total}` : '',
  progressbar:  (s) => formatProgressBar(s.step),
  progressstep: (s) => formatProgressStep(s.step),
  story:        (s) => s.story || '',
  request:      (s) => s.request || '',
  document:     (s) => s.document || '',
  timer:        (s) => formatTimer(s.started_at),
  compact:      (s) => [
    s.project,
    colorize(s.workflow || '', getWorkflowColor(s.workflow)),
    getStoryOrRequest(s),
    formatProgressStep(s.step)
  ].filter(Boolean).join(' \u00b7 '),
  full:         (s) => [
    s.project,
    colorize(s.workflow || '', getWorkflowColor(s.workflow)),
    getStoryOrRequest(s),
    COMMANDS.progress(s),
    s.step && s.step.next_name ? `-> ${s.step.next_name}` : ''
  ].filter(Boolean).join(' \u00b7 '),
  minimal:      (s) => [
    colorize(s.workflow || '', getWorkflowColor(s.workflow)),
    formatProgressStep(s.step)
  ].filter(Boolean).join(' \u00b7 '),
};
```

**IMPORTANT:** `colorize()` returns `text || ''` when `ansiCode` is falsy, so unknown workflows pass through as plain text. But `colorize('', null)` returns `''` which is falsy and gets filtered by `.filter(Boolean)`. This is the correct behavior for composites — empty segments are omitted.

**EDGE CASE:** `colorize('dev-story', '\x1b[36m')` returns `'\x1b[36mdev-story\x1b[0m'` which is truthy and kept by filter. `colorize('', null)` returns `''` which is filtered out. `colorize('unknown-wf', null)` returns `'unknown-wf'` which is truthy and kept as plain text. All correct.

### BMAD_CACHE_DIR Change (Line 8)

Change from:
```js
const CACHE_DIR = path.join(os.homedir(), '.cache', 'bmad-status');
```
To:
```js
const CACHE_DIR = process.env.BMAD_CACHE_DIR || path.join(os.homedir(), '.cache', 'bmad-status');
```

This is the ONLY change needed for testability. Tests set `BMAD_CACHE_DIR` to a temp directory.

### Testing Strategy

**Reader tests use `child_process.execSync`** — NOT direct import. The reader is CommonJS, the test is ESM. More importantly, testing the real stdin->stdout contract is the architecture requirement.

**Test pattern:**
```js
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

const READER_PATH = path.resolve('src/reader/bmad-sl-reader.js');

describe('reader color output', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-test-'));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeStatus(sessionId, statusObj) {
    fs.writeFileSync(
      path.join(tmpDir, `status-${sessionId}.json`),
      JSON.stringify(statusObj)
    );
  }

  function execReader(command, sessionId) {
    return execSync(`node "${READER_PATH}" ${command}`, {
      input: JSON.stringify({ session_id: sessionId }),
      encoding: 'utf8',
      env: { ...process.env, BMAD_CACHE_DIR: tmpDir },
    });
  }

  it('colors known agent', () => {
    writeStatus('t1', { agent: ['Amelia'] });
    const result = execReader('agent', 't1');
    assert.equal(result, '\x1b[36mAmelia\x1b[0m');
  });
  // ... etc
});
```

**IMPORTANT:** Pass `env: { ...process.env, BMAD_CACHE_DIR: tmpDir }` to execSync so the reader uses the temp directory.

### Color Maps Sync Test Pattern

```js
describe('color maps sync', () => {
  it('AGENT_COLORS keys match between reader and defaults', () => {
    const readerSrc = fs.readFileSync(READER_PATH, 'utf8');
    const defaultsSrc = fs.readFileSync(path.resolve('src/defaults.js'), 'utf8');

    const extractKeys = (src, mapName) => {
      const regex = new RegExp(`'([^']+)'\\s*:\\s*'\\\\x1b`, 'g');
      // Find the map block
      const mapStart = src.indexOf(`const ${mapName}`);
      const mapEnd = src.indexOf('};', mapStart);
      const mapBlock = src.slice(mapStart, mapEnd);
      const keys = [];
      let match;
      while ((match = regex.exec(mapBlock)) !== null) {
        keys.push(match[1]);
      }
      return keys.sort();
    };

    const readerKeys = extractKeys(readerSrc, 'AGENT_COLORS');
    const defaultsKeys = extractKeys(defaultsSrc, 'AGENT_COLORS');
    assert.deepStrictEqual(readerKeys, defaultsKeys);
  });
  // Similar test for WORKFLOW_COLORS
});
```

### Parallelism Note — Story 1.2 and 1.3 Are Independent

Story 1.3 modifies:
- `src/reader/bmad-sl-reader.js` (add colors, colorize, BMAD_CACHE_DIR)
- `src/defaults.js` (populate AGENT_COLORS, WORKFLOW_COLORS, add WORKFLOW_PREFIX_COLORS)
- `test/reader.test.js` (new)

Story 1.2 modifies:
- `src/install.js` (populate from stub)
- `src/defaults.js` (populate getStatusLineConfig, getWidgetDefinitions, generateClaudeMdBlock only)
- `test/install.test.js` (new)

**Conflict zone:** `src/defaults.js` — but different exports. Story 1.3 MUST NOT touch the 3 function stubs. Story 1.2 MUST NOT touch the color map objects. If both are implemented in parallel, a merge may be needed.

### defaults.js Current Stub State (from Story 1.1)

```js
// defaults.js — Config templates and color maps
// Stubs only — populated in Stories 1.2 (config templates) and 1.3 (color maps)

export function getStatusLineConfig() { return {}; }        // Story 1.2 — DO NOT TOUCH
export function getWidgetDefinitions(readerPath) { return []; }  // Story 1.2 — DO NOT TOUCH
export function generateClaudeMdBlock(slug) { return ''; }   // Story 1.2 — DO NOT TOUCH

export const AGENT_COLORS = {};        // Populate in this story (Task 9)
export const WORKFLOW_COLORS = {};     // Populate in this story (Task 9)
// Add: export const WORKFLOW_PREFIX_COLORS = [...]; in this story (Task 9)
```

### Previous Story Intelligence (from Story 1.1)

**Key learnings:**
- Node v24 requires `node --test test/*.test.js` glob form (not `node --test test/` directory form) — already fixed in package.json
- Reader was copied as-is from PoC — 145 lines, fully functional extractors, zero colors
- `preserveColors` spike confirmed: key name is `preserveColors` (boolean), works since ccstatusline v1.0.13
- CLI dispatch tests use `execSync` with `encoding: 'utf8'` — same pattern for reader tests
- Test fixtures dir exists at `test/fixtures/` with `.gitkeep` and spike script

**Review findings from 1.1 (deferred, pre-existing):**
- Reader CJS in ESM package — `.cjs` rename deferred (do NOT rename in this story)
- Path traversal via `session_id` — deferred (do NOT add validation)
- `readStdin` blocks without pipe stdin — deferred
- `progressbar` no upper bound on `step.total` — deferred
- TOCTOU race in `purgeStale` — deferred
- `purgeStale` full scan every invocation — deferred
- Windows `~/.cache/` non-standard — `BMAD_CACHE_DIR` env var exists as workaround (implement in this story)

### Project Structure Notes

**Files modified in this story:**
```
bmad-statusline/
  src/
    reader/
      bmad-sl-reader.js     # ADD: color maps, colorize, BMAD_CACHE_DIR, modify extractors
    defaults.js             # POPULATE: AGENT_COLORS, WORKFLOW_COLORS (keep function stubs)
  test/
    reader.test.js          # NEW: reader tests (color, composites, edge cases, sync)
    fixtures/
      status-sample.json    # NEW: sample status file for reader tests (optional, tests can create inline)
```

**Files NOT touched in this story:**
- `bin/cli.js` — dispatch only, no changes needed
- `src/install.js` — Story 1.2 scope
- `src/uninstall.js` — Story 1.4 scope
- `src/clean.js` — Story 1.5 scope
- `test/cli.test.js` — existing, no changes
- `test/defaults.test.js` — existing, may need minor update if defaults stubs test checks color map emptiness
- `package.json` — no changes needed

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Dynamic Colors] — preserveColors, color maps, composite coloring
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules#3. ANSI Color Wrapping] — colorize helper, color scope table
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules#5. Path Construction] — BMAD_CACHE_DIR env var
- [Source: _bmad-output/planning-artifacts/architecture.md#Test Organization & Conventions] — execSync pattern, sync test
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3] — full acceptance criteria
- [Source: _bmad-output/project-context.md#Color Maps Reference] — agent/workflow color tables
- [Source: _bmad-output/project-context.md#Critical Implementation Rules] — error handling duality, sync fs, colorize
- [Source: _bmad-output/implementation-artifacts/1-1-package-scaffolding-spike-preserve-colors.md] — previous story learnings, review findings

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Reader CJS in ESM package: added `src/reader/package.json` with `{"type": "commonjs"}` to allow Node.js to correctly treat the reader as CJS within the ESM package — standard Node.js pattern, not the `.cjs` rename that was deferred.

### Completion Notes List

- Task 1: Changed `CACHE_DIR` to read `BMAD_CACHE_DIR` env var with fallback to default path
- Tasks 2-3: Added `AGENT_COLORS` (16 agents), `WORKFLOW_COLORS` (20 workflows), `WORKFLOW_PREFIX_COLORS` (3 prefix patterns), `RESET` constant, `colorize()` helper, `getWorkflowColor()` three-tier lookup
- Tasks 4-6: Modified `workflow` extractor to use colorize + getWorkflowColor, `agent` extractor to individually color each agent in array, composite extractors (`compact`, `full`, `minimal`) to use colored workflow segments with uncolored ` · ` separators
- Task 7-8: Verified all 10 plain text extractors produce no ANSI, touchAlive/purgeStale unchanged, silent error handling preserved
- Task 9: Populated `AGENT_COLORS`, `WORKFLOW_COLORS`, `WORKFLOW_PREFIX_COLORS` in `src/defaults.js` with identical maps
- Tasks 10-11: Created `test/reader.test.js` with 35 reader tests (color, plain text, composites, edge cases, alive, cleanup, error handling) + 3 sync tests verifying color map key parity between reader and defaults
- Task 12: All 57 tests pass (0 failures)

### File List

- `src/reader/bmad-sl-reader.js` — modified: added color maps, colorize helper, getWorkflowColor, BMAD_CACHE_DIR, modified extractors
- `src/reader/package.json` — new: `{"type": "commonjs"}` for CJS in ESM package
- `src/defaults.js` — modified: populated AGENT_COLORS, WORKFLOW_COLORS, added WORKFLOW_PREFIX_COLORS
- `test/reader.test.js` — new: 38 tests (reader color output + color maps sync)

### Review Findings

- [x] [Review][Defer] Path traversal via session_id in readStatusFile/touchAlive [src/reader/bmad-sl-reader.js:102,112] — deferred, pre-existing (story 1.1 review)
- [x] [Review][Defer] readStdin blocks indefinitely when no pipe stdin [src/reader/bmad-sl-reader.js:92] — deferred, pre-existing (story 1.1 review)
- [x] [Review][Defer] TOCTOU race/symlink in purgeStale [src/reader/bmad-sl-reader.js:120-134] — deferred, pre-existing (story 1.1 review)
- [x] [Review][Defer] formatProgressBar crashes on Infinity step.total [src/reader/bmad-sl-reader.js:151] — deferred, pre-existing (story 1.1 review)
- [x] [Review][Defer] formatProgressBar loses segments with fractional completed [src/reader/bmad-sl-reader.js:152] — deferred, pre-existing (formatProgressBar not modified by story 1-3)
- [x] [Review][Defer] Non-string status field could crash process.stdout.write [src/reader/bmad-sl-reader.js:232] — deferred, pre-existing (main() not modified by story 1-3)

## Change Log

- 2026-03-28: Implemented Story 1.3 — Reader color maps, colorize helper, composite widgets, BMAD_CACHE_DIR env var, 38 new tests, color maps sync validation
