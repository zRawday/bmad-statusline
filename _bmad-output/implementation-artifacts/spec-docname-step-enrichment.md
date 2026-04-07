---
title: 'Document Name widget + Step enrichment via frontmatter stepsCompleted'
type: 'feature'
created: '2026-04-03'
status: 'done'
baseline_commit: 'c79af19'
context: ['_bmad-output/project-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** No visibility on which planning document (PRD, architecture, brainstorming…) the LLM is actively working on. Additionally, skills using `stepsCompleted[]` frontmatter (instead of step files) provide no Step widget feedback.

**Approach:** Add a `bmad-docname` widget that displays the filename when Write/Edit targets a known output folder. Enrich the Step widget with a frontmatter fallback: parse `stepsCompleted[]` from written content when no step files exist.

## Boundaries & Constraints

**Always:**
- Resolve output folder paths from `_bmad/bmm/config.yaml` once on first event (same pattern as project detection, line 62-73 of hook). Cache in `earlyStatus`.
- `document_name` set only when current workflow is NOT in `STORY_WORKFLOWS`.
- Step enrichment only when `step.total` is null — step-file detection always wins.
- Parse `content` from payload (Write) or `new_string` (Edit) — no extra I/O.
- `bmad-docname` widget: hidden by default, positioned between `bmad-story` and `bmad-progressstep` in registry.

**Ask First:**
- Default color choice for `bmad-docname` if the proposed color clashes with existing widgets.

**Never:**
- Read files from disk to detect documents — use only the hook payload content.
- Touch CIS skills (no frontmatter, excluded from Step enrichment).
- Modify existing step-file detection logic.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Write in planning_artifacts | Write `prd-v2.md` in `_bmad-output/planning-artifacts/` | `status.document_name = 'prd-v2.md'` | N/A |
| Write in output_folder root | Write `brainstorming-session-2026-04-03-001.md` in `_bmad-output/` | `status.document_name = 'brainstorming-session-2026-04-03-001.md'` | N/A |
| Write outside output folders | Write in `src/hook/` | `document_name` unchanged | N/A |
| Write in story workflow | Workflow is `dev-story`, Write in impl artifacts | `document_name` unchanged (story widget handles it) | N/A |
| No config.yaml | `_bmad/bmm/config.yaml` missing | Output folders empty array, document detection skipped | Silent |
| Frontmatter stepsCompleted | Write with `stepsCompleted: [1, 2, 3]`, step.total is null | `step.current = 3`, `step.current_name = 'completed'` | N/A |
| Frontmatter but step files exist | step.total is 5 (step files found) | Frontmatter ignored — step-file data preserved | N/A |
| No frontmatter in content | Write without YAML frontmatter | Step fields unchanged | N/A |
| Edit with stepsCompleted | Edit `new_string` contains full frontmatter with `stepsCompleted: [1, 2]` | `step.current = 2`, `step.current_name = 'completed'` | N/A |
| Nested output subfolder | Write in `_bmad-output/planning-artifacts/sub/file.md` | `status.document_name = 'file.md'` (any depth) | N/A |

</frozen-after-approval>

## Code Map

- `src/hook/bmad-hook.js` -- Hook handlers: output folder resolution, document_name population, stepsCompleted parsing
- `src/reader/bmad-sl-reader.js` -- COMMANDS: add `docname` extractor
- `src/tui/widget-registry.js` -- Register `bmad-docname` between story and progressstep
- `test/hook.test.js` -- Unit tests for document detection and step enrichment edge cases

## Tasks & Acceptance

**Execution:**
- [x] `src/hook/bmad-hook.js` -- Add output folder resolution in the early-detection block (after project detection, ~line 73). Read config.yaml, extract `output_folder`, `planning_artifacts`, `implementation_artifacts`, `test_artifacts`, `design_artifacts` via regex. Resolve `{project-root}` to `cwd`. Cache as array on `earlyStatus._outputFolders`. Add `document_name: null` to blank status schema.
- [x] `src/hook/bmad-hook.js` -- In `handleWrite` and `handleEdit`: after setting `last_write`, check if `file_path` starts with any cached output folder AND workflow is not in `STORY_WORKFLOWS`. If match, set `status.document_name = path.basename(file_path)`.
- [x] `src/hook/bmad-hook.js` -- In `handleWrite` and `handleEdit`: after document_name logic, if `status.step.total === null`, attempt to parse `stepsCompleted` from content/new_string YAML frontmatter. If found, set `step.current = Math.max(...stepsCompleted)` and `step.current_name = 'completed'`.
- [x] `src/reader/bmad-sl-reader.js` -- Add `docname` command to COMMANDS: return `status.document_name || ''`.
- [x] `src/tui/widget-registry.js` -- Add `bmad-docname` entry (command: `docname`, defaultEnabled: false, defaultColor: `brightYellow`) between `bmad-story` and `bmad-progressstep`.
- [x] `test/hook.test.js` -- Test I/O matrix scenarios: write in output folder, write outside, story workflow exclusion, missing config.yaml, stepsCompleted parsing, step-file priority, no frontmatter, edit with stepsCompleted.

**Acceptance Criteria:**
- Given a Write/Edit in a known output folder with a non-story workflow, when the reader renders `docname`, then the exact filename with extension is displayed.
- Given a Write with `stepsCompleted: [1, 2, 3]` frontmatter and no step files detected, when the reader renders `progressstep`, then it shows `Step 3 completed`.
- Given step files already detected (step.total non-null), when a Write contains `stepsCompleted`, then existing step data is preserved unchanged.

## Design Notes

**Output folder resolution pattern** — mirrors project detection (line 62-73): read config.yaml once, regex-extract each key, resolve `{project-root}` → `cwd`, normalize paths, cache as array. Keys to extract with defaults:

```
output_folder         → {cwd}/_bmad-output
planning_artifacts    → {cwd}/_bmad-output/planning-artifacts
implementation_artifacts → {cwd}/_bmad-output/implementation-artifacts
test_artifacts        → {cwd}/_bmad-output/test-artifacts
design_artifacts      → {cwd}/design-artifacts
```

**Frontmatter parsing** — extract between first `---` pair, regex for `stepsCompleted:` then capture bracket array `[\d,\s]+`. No YAML parser needed — simple regex like `/stepsCompleted:\s*\[([^\]]+)\]/`.

## Verification

**Commands:**
- `npm test` -- expected: all existing + new tests pass

## Suggested Review Order

**Guard walk-up + output folder resolution**

- Walk-up loop replaces hardcoded `_bmad/` check — fixes cwd subdirectory bug
  [`bmad-hook.js:50`](../../bmad-statusline/src/hook/bmad-hook.js#L50)

- Output folder keys extracted from config.yaml with sensible defaults
  [`bmad-hook.js:78`](../../bmad-statusline/src/hook/bmad-hook.js#L78)

**Document name + step enrichment**

- Shared helper: folder matching (case-insensitive) + frontmatter parsing
  [`bmad-hook.js:461`](../../bmad-statusline/src/hook/bmad-hook.js#L461)

- handleWrite integration: detect before story/sprint-status logic
  [`bmad-hook.js:345`](../../bmad-statusline/src/hook/bmad-hook.js#L345)

- handleEdit integration: same pattern, uses new_string as content
  [`bmad-hook.js:424`](../../bmad-statusline/src/hook/bmad-hook.js#L424)

**Reader + widget registry**

- `formatProgressStep` fallback for frontmatter-only steps (no total)
  [`bmad-sl-reader.js:339`](../../bmad-statusline/src/reader/bmad-sl-reader.js#L339)

- `docname` command added to COMMANDS
  [`bmad-sl-reader.js:367`](../../bmad-statusline/src/reader/bmad-sl-reader.js#L367)

- `bmad-docname` widget between story and progressstep, hidden by default
  [`widget-registry.js:10`](../../bmad-statusline/src/tui/widget-registry.js#L10)

**Tests**

- 12 new tests: document detection, step enrichment, walk-up, defaults fallback
  [`hook.test.js:1471`](../../bmad-statusline/test/hook.test.js#L1471)
