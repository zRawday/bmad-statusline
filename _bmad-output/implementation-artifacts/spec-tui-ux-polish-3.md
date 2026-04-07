---
title: 'TUI UX polish 3 — widget simplification, global header, screen labels'
type: 'feature'
created: '2026-04-02'
status: 'done'
baseline_commit: '76d3187'
context: ['_bmad-output/project-context.md']
---

<frozen-after-approval>

## Intent

**Problem:** 5 step-related widgets are redundant (Progress+Step supersedes Step, Progress, Progress Bar). Header only visible on Home. Breadcrumb wastes space. No visual cue for current screen. Warning text has formatting issues.

**Approach:** Remove 3 redundant widgets. Rename Progress+Step to "Step". Move Header to ScreenLayout (global). Replace breadcrumb with bold colored screen name below preview. Fix warnings, add timer caveat. Rainbow "visible" for dynamic workflow color. Reorder defaults: Story after Workflow.

## Boundaries & Constraints

**Always:** Keep widget IDs stable for ccstatusline compat (bmad-progressstep command stays `progressstep`). Keep hook step detection intact. Follow Pattern 1 (silent reader), Pattern 3 (Ink colors in TUI).

**Ask First:** If removing widgets causes unexpected config-loader issues.

**Never:** Change hook logic. Break ccstatusline sync. Add dependencies.

</frozen-after-approval>

## Code Map

- `src/tui/widget-registry.js` -- Widget definitions, default config, widget order
- `src/tui/preview-utils.js` -- SAMPLE_VALUES, color resolution
- `src/tui/components/ScreenLayout.js` -- Layout wrapper (header, preview, shortcuts)
- `src/tui/components/Breadcrumb.js` -- To delete
- `src/tui/screens/HomeScreen.js` -- Header source, home menu
- `src/tui/screens/EditLineScreen.js` -- Widget list, warnings, dynamic color
- `src/tui/screens/SeparatorStyleScreen.js` -- Separator selector
- `src/tui/screens/ReorderLinesScreen.js` -- Line reorder
- `src/tui/screens/PresetSaveScreen.js` -- Preset save
- `src/tui/screens/PresetLoadScreen.js` -- Preset load
- `src/reader/bmad-sl-reader.js` -- Reader commands, format functions
- `src/hook/bmad-hook.js` -- Comment cleanup only

## Tasks & Acceptance

**Execution:**
- [x] `src/tui/widget-registry.js` -- Remove bmad-step, bmad-progress, bmad-progressbar. Rename bmad-progressstep display name to "Step". Move bmad-story to position after bmad-workflow.
- [x] `src/tui/preview-utils.js` -- Remove deleted widget SAMPLE_VALUES. Set bmad-progressstep to `'Step 2/7 Discover'`, bmad-nextstep to `'Design'`.
- [x] `src/tui/components/ScreenLayout.js` -- Remove Breadcrumb import/render. Move Header from HomeScreen here. Add `screenName`/`screenColor` props rendered bold+colored below preview (with blank line gap). Remove `hidePreview` prop.
- [x] `src/tui/components/Breadcrumb.js` -- Delete file.
- [x] `src/tui/screens/HomeScreen.js` -- Remove Header definition. Remove hidePreview, manual ThreeLinePreview. Pass `screenName="Home"`, `screenColor="cyan"`.
- [x] `src/tui/screens/EditLineScreen.js` -- Remove STEP_WIDGETS dead code. Fix warning: `⚠ Step, Next Step only work with multi-step workflows` (space after emoji). Add: `⚠ Timer only refreshes while the LLM is active (Claude Code limitation)`. Rainbow "visible" for dynamic workflow: each letter of "visible" in a different color from ANSI palette.
- [x] `src/tui/screens/{SeparatorStyleScreen,ReorderLinesScreen,PresetSaveScreen,PresetLoadScreen}.js` -- Replace breadcrumb with screenName/screenColor. Colors: Separator=yellow, Reorder=magenta, Save Preset=blue, Load Preset=brightCyan. EditLine=green.
- [x] `src/reader/bmad-sl-reader.js` -- Delete formatProgressBar. Remove step/progress/progressbar commands. In formatProgressStep: "Steps"→"Step", "Tasks"→"Step".
- [x] `src/hook/bmad-hook.js` -- Remove "+ task checkbox tracking" from line 227 comment.
- [x] `test/tui-app.test.js` -- Update for removed widgets, renamed Step widget.

**Acceptance Criteria:**
- Given any screen, when rendered, then Header is visible at top and no breadcrumb is shown.
- Given any screen, when rendered, then bold colored screen name appears below preview box (with blank line gap).
- Given widget registry, when listing, then 6 widgets exist: Project, Workflow, Story, Step, Next Step, Timer.
- Given default config, when created, then Story follows Workflow in widgetOrder.
- Given workflow widget with dynamic color in EditLine, when rendered, then "visible" shows rainbow letters.
- Given EditLine, when warnings shown, then emoji has space, Step/Next Step warning and Timer limitation warning are present.
- Given reader, when progressstep command runs, then output format is "Step N/M name".

## Verification

**Commands:**
- `npm test` -- expected: all tests pass

## Suggested Review Order

**Widget simplification (data layer)**

- 3 widgets removed, Story reordered after Workflow, Progress+Step renamed to "Step"
  [`widget-registry.js:5`](../../bmad-statusline/src/tui/widget-registry.js#L5)

- Sample values updated: progressstep→"Step 2/7 Discover", nextstep→"Design"
  [`preview-utils.js:7`](../../bmad-statusline/src/tui/preview-utils.js#L7)

- Reader: step/progress/progressbar commands removed, format "Steps"→"Step"
  [`bmad-sl-reader.js:249`](../../bmad-statusline/src/reader/bmad-sl-reader.js#L249)

**Global header & screen labels (UI layer)**

- Header moved here, screenName/screenColor replaces breadcrumb
  [`ScreenLayout.js:10`](../../bmad-statusline/src/tui/components/ScreenLayout.js#L10)

- HomeScreen simplified: no more Header, hidePreview, manual preview
  [`HomeScreen.js:58`](../../bmad-statusline/src/tui/screens/HomeScreen.js#L58)

**EditLine enhancements**

- Rainbow "visible" for dynamic workflow, fixed warnings, dead code removed
  [`EditLineScreen.js:46`](../../bmad-statusline/src/tui/screens/EditLineScreen.js#L46)

- Warning texts with spacing fix and timer caveat
  [`EditLineScreen.js:206`](../../bmad-statusline/src/tui/screens/EditLineScreen.js#L206)

**Sub-screen breadcrumb→screenName migration**

- All 4 sub-screens: breadcrumb replaced with screenName/screenColor
  [`SeparatorStyleScreen.js:85`](../../bmad-statusline/src/tui/screens/SeparatorStyleScreen.js#L85)

**Cleanup**

- Hook comment cleaned ("task checkbox tracking" removed)
  [`bmad-hook.js:227`](../../bmad-statusline/src/hook/bmad-hook.js#L227)

**Tests**

- Fixture config updated to 6 widgets
  [`internal-config-default.json:1`](../../bmad-statusline/test/fixtures/internal-config-default.json#L1)

- Widget registry tests: 9→6 count, new default order
  [`tui-widget-registry.test.js:11`](../../bmad-statusline/test/tui-widget-registry.test.js#L11)

- Reader tests: removed commands deleted, format updated
  [`reader.test.js:107`](../../bmad-statusline/test/reader.test.js#L107)

- TUI screen tests: breadcrumb→screen name assertions
  [`tui-components.test.js:78`](../../bmad-statusline/test/tui-components.test.js#L78)
