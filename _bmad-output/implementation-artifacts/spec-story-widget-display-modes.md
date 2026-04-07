---
title: 'Story Widget Display Modes (Compact/Full)'
type: 'feature'
created: '2026-04-04'
status: 'done'
baseline_commit: '02e9fa8'
context: []
---

<frozen-after-approval>

## Intent

**Problem:** The story widget always displays the full format (e.g., "7-5 Auth Login"), consuming significant horizontal space on the status line. Users need a compact option showing only the story number ("7-5").

**Approach:** Add a `displayMode` property (`full` | `compact`) to the per-widget config inside `colorModes`. The reader checks this mode when rendering. The TUI EditLineScreen provides a toggle key (`m`) when the story widget is selected. Default is `full` for backward compatibility.

## Boundaries & Constraints

**Always:** Default to `full` when `displayMode` is absent (backward compat). Toggle is per-line — each line can independently be compact or full. Preview must reflect the active mode.

**Ask First:** If extending `displayMode` to other widgets beyond story.

**Never:** Change story detection logic in the hook. Never modify the status file format.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Compact mode | story: `7-5-auth-login`, displayMode: `compact` | `7-5` | N/A |
| Full mode (default) | story: `7-5-auth-login`, displayMode: `full` or absent | `7-5 Auth Login` | N/A |
| No story | story: null, any mode | `""` (empty) | N/A |
| Non-matching slug | story: `no-match`, compact | `no-match` (passthrough) | N/A |

</frozen-after-approval>

## Code Map

- `src/reader/bmad-sl-reader.js:313-321,365` — `formatStoryName()` and story extractor in COMMANDS
- `src/reader/bmad-sl-reader.js:265-310` — `handleLineCommand()` passes `lineConfig` to extractors
- `src/tui/screens/EditLineScreen.js:119-124` — Enter key handler for per-widget actions
- `src/tui/preview-utils.js:13` — Story sample value for preview

## Tasks & Acceptance

**Execution:**
- [x] `src/reader/bmad-sl-reader.js` — Modify story extractor signature to accept `lineConfig`; if `colorModes['bmad-story'].displayMode === 'compact'`, extract and return only the number prefix (`\d+-\d+`). Standalone path unchanged (always full).
- [x] `src/tui/screens/EditLineScreen.js` — Add `m` key handler: when cursor is on `bmad-story`, toggle `displayMode` between `full` and `compact` in the line's `colorModes` via `updateConfig`. Show current mode as dim hint `(compact)` or `(full)` next to widget name.
- [x] `src/tui/preview-utils.js` — Make story sample mode-aware: accept colorModes and return `'4-2'` for compact, `'4-2 Auth Login'` for full.
- [x] `test/reader.test.js` — Add test cases for compact mode story output.
- [x] `test/tui-edit-line.test.js` — Add test for `m` key toggle on story widget.

**Acceptance Criteria:**
- Given story widget in compact mode on line N, when `reader line N` renders, then only the story number is output.
- Given EditLineScreen with cursor on story widget, when user presses `m`, then displayMode toggles and preview updates immediately.
- Given no displayMode in config (legacy), when rendering, then full mode is used.

## Spec Change Log

## Verification

**Commands:**
- `node --test test/reader.test.js` — expected: all pass including compact mode tests
- `node --test test/tui-edit-line.test.js` — expected: all pass including toggle test

## Suggested Review Order

**Reader compact mode**

- Core logic: displayMode param gates compact vs full title extraction
  [`bmad-sl-reader.js:315`](../../bmad-statusline/src/reader/bmad-sl-reader.js#L315)

- Story extractor passes displayMode from lineConfig colorModes
  [`bmad-sl-reader.js:374`](../../bmad-statusline/src/reader/bmad-sl-reader.js#L374)

**TUI toggle & preview**

- `m` key handler toggles displayMode on bmad-story, bootstraps colorModes if absent
  [`EditLineScreen.js:159`](../../bmad-statusline/src/tui/screens/EditLineScreen.js#L159)

- Color cycling preserves displayMode when replacing colorModes entry
  [`EditLineScreen.js:179`](../../bmad-statusline/src/tui/screens/EditLineScreen.js#L179)

- Dim `(compact)`/`(full)` hint rendered next to story widget name
  [`EditLineScreen.js:217`](../../bmad-statusline/src/tui/screens/EditLineScreen.js#L217)

- Mode-aware sample value for preview: `4-2` vs `4-2 Auth Login`
  [`preview-utils.js:30`](../../bmad-statusline/src/tui/preview-utils.js#L30)

- ThreeLinePreview uses getSampleValue instead of static SAMPLE_VALUES
  [`ThreeLinePreview.js:16`](../../bmad-statusline/src/tui/components/ThreeLinePreview.js#L16)

**Tests**

- Reader: compact, full-default, standalone, edge cases (empty story, non-matching slug)
  [`reader.test.js:210`](../../bmad-statusline/test/reader.test.js#L210)

- TUI: m toggle, non-story no-op, hint display, Mode shortcut label
  [`tui-edit-line.test.js:162`](../../bmad-statusline/test/tui-edit-line.test.js#L162)
