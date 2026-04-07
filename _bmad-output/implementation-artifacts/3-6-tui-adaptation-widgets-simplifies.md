# Story 3.6: TUI adaptation — widgets simplifies

Status: done

## Story

As a **developer using the TUI configurator**,
I want **the TUI to reflect the simplified widget set (no agent/request/document) and the new status schema**,
So that **the configurator only shows widgets that actually produce output**.

## Acceptance Criteria

1. **Given** `INDIVIDUAL_WIDGETS` in widget-registry.js **When** inspected **Then** `bmad-agent`, `bmad-request`, and `bmad-document` entries are removed (9 widgets remain, not 12)

2. **Given** `coloredExtractors` in `buildWidgetConfig()` **When** inspected **Then** only `'workflow'` remains (agent removed): `const coloredExtractors = ['workflow'];`

3. **Given** `COMPOSITE_WIDGETS` descriptions **When** inspected **Then** `full` description is updated to `'Project + workflow + progressstep + story + timer'` (no agent)

4. **Given** `PREVIEW_DATA` in app.js **When** inspected **Then** `agent`, `request`, and `document` fields are removed **And** `step` uses the new schema: `{ current: 3, current_name: 'color modes', total: 6 }` (no `completed`, `current` is a number not string)

5. **Given** `renderWidgetText()` **When** inspected **Then** cases for `agent`, `request`, and `document` are removed

6. **Given** `renderComposite('full')` **When** called **Then** it renders `project · workflow · progressstep · story · timer` (no agent segment)

7. **Given** `getAgentInkColor()` and `renderAgentSegment()` **When** inspected **Then** both functions are removed

8. **Given** the `AGENT_COLORS` import from `../defaults.js` **When** inspected **Then** the import is removed from app.js

9. **Given** `getAgentColors()` export in widget-registry.js **When** inspected **Then** it is removed along with its `AGENT_COLORS` import from defaults.js

10. **Given** all `statusData.step.completed` references in app.js **When** updated **Then** they use `statusData.step.current - 1` for progress display

11. **Given** `test/tui-widget-registry.test.js` **When** updated **Then** references to `bmad-agent` widget assertions are removed and `coloredExtractors` test reflects workflow-only

## Tasks / Subtasks

- [x] Task 1: Remove dead widgets from INDIVIDUAL_WIDGETS (AC: #1)
  - [x] 1.1 Delete `{ id: 'bmad-agent', command: 'agent', name: 'Agent', defaultEnabled: true }` entry
  - [x] 1.2 Delete `{ id: 'bmad-request', command: 'request', name: 'Request', defaultEnabled: false }` entry
  - [x] 1.3 Delete `{ id: 'bmad-document', command: 'document', name: 'Document', defaultEnabled: false }` entry

- [x] Task 2: Simplify coloredExtractors (AC: #2)
  - [x] 2.1 Change `const coloredExtractors = ['workflow', 'agent'];` to `const coloredExtractors = ['workflow'];` in `buildWidgetConfig()`

- [x] Task 3: Update COMPOSITE_WIDGETS description (AC: #3)
  - [x] 3.1 Change `full` description from `'All fields'` to `'Project + workflow + progressstep + story + timer'`

- [x] Task 4: Remove getAgentColors() and AGENT_COLORS import from widget-registry.js (AC: #9)
  - [x] 4.1 Remove `import { AGENT_COLORS } from '../defaults.js';` (line 3)
  - [x] 4.2 Remove `getAgentColors()` function (lines 46-48) and its export

- [x] Task 5: Update PREVIEW_DATA in app.js (AC: #4)
  - [x] 5.1 Remove `agent: ['Amelia'],` field
  - [x] 5.2 Remove `request: null,` field
  - [x] 5.3 Remove `document: null,` field
  - [x] 5.4 Change `step: { current: '3', current_name: 'color modes', completed: 3, total: 6 }` to `step: { current: 3, current_name: 'color modes', total: 6 }` (number not string, no completed)

- [x] Task 6: Remove agent/request/document cases from renderWidgetText() (AC: #5)
  - [x] 6.1 Remove case handling for `'agent'` widget type
  - [x] 6.2 Remove case handling for `'request'` widget type
  - [x] 6.3 Remove case handling for `'document'` widget type

- [x] Task 7: Remove agent functions and import from app.js (AC: #7, #8)
  - [x] 7.1 Remove `import { AGENT_COLORS } from '../defaults.js';` (line 12)
  - [x] 7.2 Remove `getAgentInkColor()` function (lines 265-268)
  - [x] 7.3 Remove `renderAgentSegment()` function (lines 328-341)

- [x] Task 8: Remove agent segment from renderComposite() (AC: #6)
  - [x] 8.1 In renderComposite(), remove the agent segment from 'full' composite rendering
  - [x] 8.2 Ensure 'compact' and 'minimal' composites also have no agent segment references

- [x] Task 9: Pivot step.completed references to step.current - 1 (AC: #10)
  - [x] 9.1 Find all `statusData.step.completed` references in app.js
  - [x] 9.2 Replace with `(statusData.step.current || 0) - 1` or equivalent safe expression
  - [x] 9.3 Verify safe fallback when step.current is 0 or missing (use `Math.max(0, ...)`)

- [x] Task 10: Update test/tui-widget-registry.test.js (AC: #11)
  - [x] 10.1 Update individual widget count assertion from 12 to 9
  - [x] 10.2 Remove `bmad-agent` from buildWidgetConfig test arrays
  - [x] 10.3 Remove assertion `bmad-agent.color === 'white'` (colored extractor test)
  - [x] 10.4 Update coloredExtractors assertion: only `'workflow'` gets white default color
  - [x] 10.5 Remove any imports or references to getAgentColors if tested

- [x] Task 11: Run tests — `node --test test/tui-widget-registry.test.js` must pass

## Dev Notes

### Error Handling Philosophy: TUI Components

The TUI is a CLI configurator (installer boundary). However, rendering preview data is internal — avoid throwing on missing fields, use safe fallbacks like `Math.max(0, (step.current || 0) - 1)`.

### Files to Modify (3 files only)

| File | Action |
|------|--------|
| `bmad-statusline/src/tui/widget-registry.js` | Remove 3 dead widgets, simplify coloredExtractors, remove getAgentColors + AGENT_COLORS import, update composite description |
| `bmad-statusline/src/tui/app.js` | Remove PREVIEW_DATA dead fields, remove getAgentInkColor + renderAgentSegment, remove AGENT_COLORS import, remove agent/request/document from renderWidgetText, update composites, pivot step.completed refs |
| `bmad-statusline/test/tui-widget-registry.test.js` | Update widget count 12→9, remove bmad-agent assertions, update coloredExtractors test |

### Files NOT to Modify

- `src/defaults.js` — `AGENT_COLORS` remains there (shared data for sync tests, story 3.3 already handled defaults changes)
- `src/reader/bmad-sl-reader.js` — story 3.2 already completed reader simplification
- `src/hook/bmad-hook.js` — story 3.1 scope
- `src/install.js` / `src/uninstall.js` — stories 3.4 / 3.5 scope
- `test/fixtures/status-sample.json` — already updated by story 3.2 (uses new schema)

### widget-registry.js Current Structure

```
Line 1-3:   Imports (AGENT_COLORS from ../defaults.js)        → REMOVE AGENT_COLORS import
Line 5-18:  INDIVIDUAL_WIDGETS array (12 entries)              → REMOVE 3 entries (agent, request, document)
Line 20-24: COMPOSITE_WIDGETS array (3 entries)                → UPDATE full description
Line 26-44: getIndividualWidgets, getCompositeWidgets exports  → KEEP
Line 46-48: getAgentColors() export                            → REMOVE
Line 50-52: getWorkflowColors() export                         → KEEP
Line 54-123: buildWidgetConfig()                               → UPDATE coloredExtractors
```

### app.js Key Structures to Modify

**PREVIEW_DATA (lines 38-47) — Remove dead fields, fix step schema:**
```js
// CURRENT:
const PREVIEW_DATA = {
  project: 'Toulou',
  workflow: 'dev-story',
  agent: ['Amelia'],              // ← REMOVE
  story: '2.2 TUI Colors',
  request: null,                  // ← REMOVE
  document: null,                 // ← REMOVE
  step: { current: '3', current_name: 'color modes', completed: 3, total: 6 },  // ← FIX
  started_at: new Date(Date.now() - 5 * 60 * 1000).toISOString()
};

// TARGET:
const PREVIEW_DATA = {
  project: 'Toulou',
  workflow: 'dev-story',
  story: '2.2 TUI Colors',
  step: { current: 3, current_name: 'color modes', total: 6 },
  started_at: new Date(Date.now() - 5 * 60 * 1000).toISOString()
};
```

**getAgentInkColor() (lines 265-268) — DELETE entirely:**
```js
function getAgentInkColor(agentName) {
  const ansiColor = AGENT_COLORS[agentName];
  return ansiColor ? ANSI_TO_INK[ansiColor] : undefined;
}
```

**renderAgentSegment() (lines 328-341) — DELETE entirely:**
This function renders agents with per-agent coloring in dynamic mode. No longer needed.

**renderComposite() (lines 343-386) — REMOVE agent segment:**
The function uses `addSegment` helper. Remove any `addSegment` call for agent-related widgets.

**renderWidgetText() (lines 297-315) — REMOVE agent/request/document cases:**
Remove the switch/if branches that handle these widget IDs.

**step.completed references — PIVOT to current - 1:**
Lines that reference `statusData.step.completed` (in progress rendering at ~lines 306-308, 367, 377) must change to `Math.max(0, (statusData.step.current || 0) - 1)`.

### ANSI_TO_INK Mapping (Keep)

The `ANSI_TO_INK` mapping in app.js converts ANSI codes to Ink color names. It's still used by workflow coloring. Only remove the agent-specific usage path (getAgentInkColor), not the mapping itself.

### AGENT_COLORS Import Removal (Both Files)

Two separate files import `AGENT_COLORS` from `../defaults.js`:
1. `src/tui/widget-registry.js` line 3 — remove
2. `src/tui/app.js` line 12 — remove

Verify no other usage of `AGENT_COLORS` remains in either file after removing the functions that consume it.

### Progress Calculation Pivot (Critical)

**Same pattern as Story 3.2 reader pivot.** The reader already uses `(step.current - 1)` for progress. The TUI must match:

```js
// WRONG: statusData.step.completed
// RIGHT: Math.max(0, (statusData.step.current || 0) - 1)
```

Use `Math.max(0, ...)` to guard against `step.current: 0` or `step.current: undefined` producing negative values.

### Test Widget Count Update

The test at line 12-21 asserts `getIndividualWidgets` returns 12 widgets. After removing 3:
```js
// CURRENT: assert.strictEqual(widgets.length, 12);
// TARGET:  assert.strictEqual(widgets.length, 9);
```

### Test coloredExtractors Assertion

The test at line 188-201 uses a widget list including `bmad-agent` and asserts its color is `'white'` (colored extractor default). After removal:
- Remove `'bmad-agent'` from the test widget list
- Remove the assertion `assert.strictEqual(widgets['bmad-agent'].color, 'white')`
- Keep the assertion that `'bmad-workflow'` gets white (still a colored extractor)

### Previous Story Intelligence (Story 3.2)

Story 3.2 completed the reader-side simplification. Key learnings:
- `SEP` constant is `\x1b[90m\u00b7\x1b[0m` (dim dot separator, uncolored)
- Reader composites now: compact = project·workflow·progressstep·story, full = +timer, minimal = workflow·progressstep
- `getStoryOrRequest()` was ultimately removed as dead code during review
- Test fixture `status-sample.json` already uses new schema
- Progress pivot: `Math.max(0, (step.current || 0) - 1)` pattern established

### Previous Story Intelligence (Story 3.4)

Story 3.4 (in-progress) established the hook config injection pattern. Key insight: the `paths` injection pattern is consistent across the codebase — tests inject paths, prod uses defaults. Same testability principle applies if any TUI tests need path injection.

### Dependency Verification

Per epics: "3.6 depends on 3.2 and 3.3"
- Story 3.2 (reader simplification): **done** — reader already simplified, fixture updated
- Story 3.3 (defaults.js pivot): **done** — `getHookConfig` added, old exports removed, `AGENT_COLORS` kept in defaults.js

Both dependencies satisfied. Story 3.6 can proceed.

### Architecture Compliance

- **Module system:** ESM (`import`/`export`) — TUI files are ESM (unlike reader/hook which are CJS)
- **Error handling:** TUI is installer-class (verbose for user-facing), but preview rendering should use safe fallbacks
- **Testing framework:** `node:test` + `node:assert` — match existing test file pattern
- **Test run command:** `node --test test/tui-widget-registry.test.js`
- **AGENT_COLORS in defaults.js:** Remains for sync tests — do NOT remove from defaults.js (that's a different scope)

### Known Downstream Impact

- No downstream stories depend on 3.6 (3.7 is independent, already done)
- After this story, the TUI configurator will only show 9 individual widgets and 3 composites
- The preview will display the new schema format

### Project Structure Notes

- TUI source: `bmad-statusline/src/tui/` (ESM, React/Ink components)
- TUI entry: `src/tui/app.js` — main component with preview rendering
- Widget registry: `src/tui/widget-registry.js` — widget definitions and config builder
- Tests: `bmad-statusline/test/tui-widget-registry.test.js`
- All paths relative to `bmad-statusline/` (npm package root)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.6 — acceptance criteria]
- [Source: _bmad-output/planning-artifacts/architecture.md — TUI Boundary 6, story slicing]
- [Source: _bmad-output/project-context.md#Reader Composites (Post-Pivot) — composite definitions]
- [Source: _bmad-output/project-context.md#Status File Schema — new schema without agent/request/document]
- [Source: _bmad-output/project-context.md#Architectural Boundaries — Boundary 6 TUI]
- [Source: _bmad-output/implementation-artifacts/3-2-reader-simplification-composites-et-extractors.md — reader pivot learnings, progress calculation pattern]
- [Source: _bmad-output/implementation-artifacts/3-4-install-pivot-hook-targets.md — paths injection pattern]
- [Source: bmad-statusline/src/tui/widget-registry.js — current widget definitions]
- [Source: bmad-statusline/src/tui/app.js — current preview data and render functions]
- [Source: bmad-statusline/test/tui-widget-registry.test.js — current test assertions]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation, no blockers.

### Completion Notes List

- Removed 3 dead widgets (bmad-agent, bmad-request, bmad-document) from INDIVIDUAL_WIDGETS — 9 remain
- Simplified coloredExtractors to workflow-only
- Updated full composite description to reflect actual segments
- Removed AGENT_COLORS import from both widget-registry.js and app.js
- Removed getAgentColors() export from widget-registry.js
- Removed getAgentInkColor() and renderAgentSegment() from app.js
- Removed agent segment from renderComposite full mode, cleaned agent branch from addSegment dynamic path
- Removed agent-specific preview logic (useState agent override, individual widget agent branch)
- Updated PREVIEW_DATA: removed agent/request/document fields, fixed step schema (number, no completed)
- Pivoted all step.completed references to Math.max(0, (statusData.step.current || 0) - 1) in renderWidgetText and renderComposite
- Updated test: widget count 12→9, removed bmad-agent from colored extractors test
- Full regression suite: 167/167 tests pass

### Review Findings

- [x] [Review][Defer] Compact segment order diverges from spec table — code does `project · workflow · story · progressstep`, spec says `project · workflow · progressstep · story`. Pre-existing, not introduced by this diff.
- [x] [Review][Defer] `full` composite description says `+ timer` but keepTimer guard suppresses individual timer in full mode (correct behavior, potentially misleading description). Pre-existing.

### Change Log

- 2026-03-29: Code review passed — 0 patches, 2 deferred (pre-existing), 15 dismissed
- 2026-03-29: Story 3.6 implementation complete — TUI widget simplification and step.completed pivot

### File List

- bmad-statusline/src/tui/widget-registry.js (modified)
- bmad-statusline/src/tui/app.js (modified)
- bmad-statusline/test/tui-widget-registry.test.js (modified)
