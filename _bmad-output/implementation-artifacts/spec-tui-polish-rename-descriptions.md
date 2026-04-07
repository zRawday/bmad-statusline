---
title: 'TUI polish — rename Workflow to Initial Skill, widget hints, spacing'
type: 'feature'
created: '2026-04-02'
status: 'done'
baseline_commit: 'c46eccd'
context: ['_bmad-output/project-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The "Workflow" widget name doesn't clearly convey it shows the skill the user prompted. The Edit Line screen lacks per-widget descriptions, forcing users to guess what each widget tracks. Screen content sits too close to the screen title.

**Approach:** Rename "Workflow" to "Initial Skill" across all user-facing surfaces (TUI, tests, README). Add inline hint text on each widget row in Edit Line. Remove bottom-of-screen warnings (info migrates to hints). Add vertical spacing after screen titles. Fix timer preview format.

## Boundaries & Constraints

**Always:**
- Keep internal identifiers unchanged (`bmad-workflow`, `status.workflow`, `WORKFLOW_COLORS`, `command: 'workflow'`)
- Widget hints are dimColor, positioned after the color name (or after status for hidden widgets)
- Add `hint` field to widget registry as source of truth for descriptions

**Ask First:** Changes to README wording beyond the widget rename.

**Never:** Touch hook, reader, or config-loader logic. Rename internal variable/field names.

</frozen-after-approval>

## Code Map

- `src/tui/widget-registry.js` -- Widget metadata: `name` and new `hint` field
- `src/tui/screens/EditLineScreen.js` -- Widget list rendering, warning removal
- `src/tui/components/ScreenLayout.js` -- Screen title spacing
- `src/tui/preview-utils.js` -- Timer sample value
- `test/tui-preset.test.js` -- Assertion on widget name
- `README.md` -- User-facing description

## Tasks & Acceptance

**Execution:**
- [x] `src/tui/widget-registry.js` -- Rename `name: 'Workflow'` → `'Initial Skill'`; add `hint` field to each widget in `INDIVIDUAL_WIDGETS`: Project = "Name from BMAD config.yaml", Initial Skill = "Skill invoked by user prompt", Story = "create-story, dev-story, code-review only", Step = "Skills with BMAD /step format only", Next Step = "Skills with BMAD /step format only", Timer = "Updates only while LLM is active"
- [x] `src/tui/screens/EditLineScreen.js` -- Append dimColor hint text after each widget row using `widget.hint`; remove the 3 trailing lines (spacer + 2 warnings, lines 205-207)
- [x] `src/tui/components/ScreenLayout.js` -- Add `e(Text, null, ' ')` between `screenName` element and `children`
- [x] `src/tui/preview-utils.js` -- Change `'bmad-timer'` sample value from `'12:34'` to `'12m34s'`
- [x] `test/tui-preset.test.js:131` -- Update assertion from `'Workflow'` to `'Initial Skill'`
- [x] `README.md` -- Update line 3 and line 47 references: "workflow" → "initial skill" / "active skill" where describing what the tool tracks

**Acceptance Criteria:**
- Given the TUI Edit Line screen, when rendered, then each widget row shows its hint in dim text after the visibility/color info
- Given the TUI Edit Line screen, when rendered, then no ⚠ warning lines appear at the bottom
- Given any TUI screen with a title, when rendered, then there is a blank line between the title and the content
- Given the TUI, when "Workflow" widget is referenced by name, then it reads "Initial Skill"
- Given the preview, when timer widget is shown, then sample value is "12m34s"

## Verification

**Commands:**
- `node --test test/tui-preset.test.js` -- expected: all tests pass with renamed widget
- `node --test test/*.test.js` -- expected: full suite green

## Suggested Review Order

**Widget metadata & rename**

- Source of truth: `hint` field added, `name` renamed to 'Initial Skill'
  [`widget-registry.js:5`](../../bmad-statusline/src/tui/widget-registry.js#L5)

**Edit Line hints & warning removal**

- Hint rendered inline after color/status; 3 warning lines removed
  [`EditLineScreen.js:203`](../../bmad-statusline/src/tui/screens/EditLineScreen.js#L203)

**Screen spacing**

- Blank line inserted between screen title and children
  [`ScreenLayout.js:28`](../../bmad-statusline/src/tui/components/ScreenLayout.js#L28)

**Preview & README**

- Timer sample updated to duration format
  [`preview-utils.js:13`](../../bmad-statusline/src/tui/preview-utils.js#L13)

- README wording aligned with new terminology
  [`README.md:3`](../../bmad-statusline/README.md#L3)

**Tests**

- Preset test assertion updated for rename
  [`tui-preset.test.js:131`](../../bmad-statusline/test/tui-preset.test.js#L131)

- Timer sample assertion updated
  [`tui-components.test.js:144`](../../bmad-statusline/test/tui-components.test.js#L144)
