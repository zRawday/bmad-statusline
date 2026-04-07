---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete']
inputDocuments:
  - '_bmad-output/project-context.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
documentCounts:
  briefs: 0
  research: 0
  brainstorming: 0
  projectDocs: 3
classification:
  projectType: 'cli-tool'
  domain: 'developer-experience'
  complexity: 'medium'
  projectContext: 'brownfield'
workflowType: 'prd'
status: 'complete'
completedAt: '2026-03-30'
project_name: 'bmad-statusline'
user_name: 'Fred'
date: '2026-03-30'
---

# Product Requirements Document - bmad-statusline TUI v2

**Author:** Fred
**Date:** 2026-03-30

---

## Executive Summary

bmad-statusline provides a passive workflow status line for Claude Code, displaying project, workflow, step progress, story, and timer information via ccstatusline. The current TUI configurator (Epic 5, v1) allows developers to configure individual widgets, colors, order, separator style, and target line through a modal/wizard interface built with React 19 + Ink 6.8.

**This PRD defines the TUI v2 refonte** — a significant redesign driven by a fundamental model change from single-line to multi-line widget management, a menu restructure, UX improvements, bug fixes, and dead code cleanup.

### What Makes This Special

The core insight: **ccstatusline should see opaque composite blocks (one per line), while bmad-statusline manages widget granularity internally.** This separation means users configure individual widgets (visibility, order, colors) in bmad-statusline's TUI, but ccstatusline only receives a single composite command per line — keeping its own configurator clean and allowing users to freely mix bmad widgets with native ccstatusline widgets.

The v2 TUI introduces multi-line support (up to 3 ccstatusline lines), a 3-line live preview matching ccstatusline's layout, per-line presets, and a friendlier visual identity with colors and emojis.

### Project Classification

- **Project Type:** CLI Tool / Terminal TUI
- **Domain:** Developer Experience / Tooling
- **Complexity:** Medium
- **Context:** Brownfield — Epic 1-5 delivered, TUI v1 functional but requiring redesign

---

## Success Criteria

### User Success

- Developer configures their preferred widget layout across 3 lines in under 60 seconds
- The 3-line preview accurately reflects what ccstatusline will display
- Color configuration is intuitive: workflow is the only widget with dynamic colors, all others have well-chosen fixed defaults
- All widgets can be toggled visible/hidden without blockers
- Presets allow fast switching between configurations per line

### Business Success

- ccstatusline integration is seamless: one composite widget per line, no visual pollution in ccstatusline's own configurator
- Dead code from legacy composite mode is eliminated (compact, full, minimal reader commands)
- The document cascade (PRD → UX → Architecture → Project Context → Epics) produces aligned artifacts for agent-driven development

### Technical Success

- Zero regressions on existing hook, reader, and installer functionality
- All TUI v1 tests updated or replaced for v2 structures
- Reset to original works without infinite render loops
- Story names are formatted for readability ("5-3 Auth Login" not "5-3-auth-login")

### Measurable Outcomes

- All 9 individual widgets can be toggled visible/hidden on any of the 3 lines
- 3 preset slots save/load correctly for any line
- All workflows in WORKFLOW_COLORS have distinct, visible colors (no white)
- No "Maximum update depth exceeded" errors

---

## Product Scope

### MVP — This PRD (Epic 6)

Everything described in this document is MVP scope. There is no phased rollout — the TUI v2 replaces v1 entirely.

### Post-MVP (Future)

- Custom widget creation (user-defined reader commands)
- Import/export presets to file
- TUI theming (color scheme presets for the TUI itself)

---

## User Journeys

### Journey 1: First Launch After Upgrade

Fred upgrades bmad-statusline and launches the TUI. The Home screen shows 6 options: Edit widget line 1/2/3, Reorder lines, Separator style, Reset to original. A 3-line preview at the top shows the current ccstatusline state — all widgets on line 1 with default colors. He enters "Edit widget line 1", sees his widgets listed with visibility status and colors. He hides Progress Bar and Next Step (widgets he never uses), changes Story's color from brightBlack to cyan, and the preview updates instantly. He presses Escape, sees the Home screen with the updated preview. Done in 30 seconds.

### Journey 2: Multi-Line Configuration

Fred wants workflow info on line 1 and project/timer on line 2. He enters "Edit widget line 1", hides Project and Timer, keeps Workflow + Progress+Step + Story visible. He goes back, enters "Edit widget line 2", shows only Project and Timer. The 3-line preview shows the split layout. He likes it. He saves line 1 config as a preset ("dev-focus"), then saves line 2 as another preset ("context-bar").

### Journey 3: Preset Swap

Fred is switching to a presentation workflow. He enters "Edit widget line 1", presses the load key, sees 3 preset slots with mini-previews. He loads "minimal-pres" which shows only Workflow. The line 1 preview updates instantly. After the presentation, he loads "dev-focus" back.

### Journey 4: Reorder Lines

Fred realizes he wants line 2's content on line 1 and vice versa. From Home he selects "Reorder lines". He sees the 3 lines, grabs line 1 with Enter, moves it to line 2's position. The contents swap (not overwrite). Preview confirms the change.

### Journey Requirements Summary

| Capability | Journey |
|-----------|---------|
| Per-line widget management (show/hide/color/order) | 1, 2 |
| 3-line live preview always visible | 1, 2, 3, 4 |
| Preset save/load per line (shared pool) | 2, 3 |
| Line content swapping | 4 |
| Instant persistence, no save button | All |
| Friendly defaults (colors, visibility) | 1 |

---

## CLI Tool Specific Requirements

### Technical Architecture Considerations

- **Runtime:** Node.js >= 20, plain JavaScript ESM, no TypeScript, no build step
- **TUI Stack:** React 19 + Ink 6.8 + @inkjs/ui 2.0
- **Module systems:** TUI is ESM; reader and hook remain standalone CommonJS
- **Testing:** node:test + node:assert (built-in, zero dev deps) + ink-testing-library
- **Dependencies:** Zero runtime deps for reader/hook/installer; ink/react/@inkjs scoped to TUI only

### ccstatusline Integration Model

Each ccstatusline line receives **at most one bmad composite widget**. The composite is a single `custom-command` widget whose `commandPath` calls the reader with a dynamically-built command that outputs only the visible widgets for that line, in the configured order, with the configured separator and colors.

Example ccstatusline config after TUI v2 configuration:
```json
{
  "lines": [
    [
      { "id": "bmad-line-0", "type": "custom-command", "commandPath": "node \"reader.js\" line 0", "preserveColors": true },
      { "id": "1", "type": "block-timer", "color": "cyan" }
    ],
    [
      { "id": "bmad-line-1", "type": "custom-command", "commandPath": "node \"reader.js\" line 1", "preserveColors": true }
    ],
    []
  ]
}
```

The reader's `line N` command reads the TUI's internal config to determine which widgets are visible on that line, their order, separator style, and colors, then outputs the composed string.

### Internal Config Model (bmad-statusline side)

The TUI stores its own configuration separately from ccstatusline. This config drives the reader's output per line:

```json
{
  "lines": [
    {
      "widgets": ["bmad-project", "bmad-workflow", "bmad-progressstep", "bmad-story"],
      "order": ["bmad-project", "bmad-workflow", "bmad-progressstep", "bmad-story"],
      "colorModes": {
        "bmad-workflow": { "mode": "dynamic" },
        "bmad-project": { "mode": "fixed", "fixedColor": "cyan" },
        "bmad-progressstep": { "mode": "fixed", "fixedColor": "yellow" },
        "bmad-story": { "mode": "fixed", "fixedColor": "green" }
      },
      "separator": "serre"
    },
    {
      "widgets": ["bmad-timer"],
      "order": ["bmad-timer"],
      "colorModes": { "bmad-timer": { "mode": "fixed", "fixedColor": "brightBlack" } },
      "separator": "serre"
    },
    { "widgets": [], "order": [], "colorModes": {}, "separator": "serre" }
  ],
  "presets": [null, null, null]
}
```

### Preset Model

- **3 shared preset slots**, accessible from any line editor
- Each preset stores a **single line's config**: widgets, order, colorModes, separator
- **Save:** snapshots the current line being edited into a chosen slot
- **Load:** replaces the current line being edited with the preset's content
- Presets persist to disk across TUI sessions

---

## Bug Fixes (From TUI v1)

### BF1: Hidden-by-default widgets cannot be shown

Widgets with `defaultEnabled: false` (Step, Next Step, Progress, Progress Bar) are stuck in hidden state. The toggle logic in `handleToggleVisibility` fails when the widget is not in the initial `widgetOrder`. Root cause to investigate in `WidgetsListScreen` and `app.js` toggle handler.

### BF2: Reset to original causes infinite render loop

`resetToOriginal()` triggers "Maximum update depth exceeded". Likely caused by `setTuiState` inside a render path or effect with missing/changing dependencies. Root cause to investigate in `app.js` effect hooks and state management.

### BF3: Preview shows no colors

`DualPreview` renders without ANSI colors in the terminal. The Ink `Text` component may not be applying `color` props correctly, or the color values are not being passed through from `tuiState.colorModes`.

---

## Reader Changes

### RC1: Story name formatting

The reader currently outputs story names as raw slugs from the filename (e.g., `5-3-auth-login`). The reader must format story names for readability: keep the numeric prefix, replace remaining dashes with spaces, capitalize each word.

- Input: `5-3-auth-login` → Output: `5-3 Auth Login`
- Input: `4-2-user-registration-flow` → Output: `4-2 User Registration Flow`

### RC2: New `line N` reader command

The reader must support a `line 0`, `line 1`, `line 2` command that reads the internal bmad-statusline config and outputs the composed widget string for that line, respecting widget visibility, order, separator, and colors.

### RC3: Remove legacy composite commands

Remove the `compact`, `full`, and `minimal` commands from the reader. These are dead code replaced by the dynamic `line N` command.

### RC4: All workflows must have visible colors

Every workflow in `WORKFLOW_COLORS` must have a distinct, visible ANSI color. Current issues:
- `document-project` and `generate-project-context` are white (invisible on light backgrounds)
- Too many green workflows clustered in "Planning" category

Color assignment rules:
- Closely-used workflows must have distinct colors (e.g., `create-story`, `dev-story`, `code-review` must be clearly different)
- Repetition is acceptable but should be spaced apart (different categories)
- No white — use brightWhite or another visible color instead

---

## Menu Structure & Navigation

### Home Screen

```
  Preview
  ┌──────────────────────────────────────────────┐
  │  Line 1: project · dev-story · Tasks 2/5 · 4-2 Auth Login  │
  │  Line 2: 12:34                                               │
  │  Line 3:                                                     │
  └──────────────────────────────────────────────┘

  Edit widget line 1
  Edit widget line 2
  Edit widget line 3
  Reorder lines
  Separator style
  Reset to original

  ↑↓ Navigate  Enter Select  q Quit
```

### Edit Widget Line Screen

Entered from Home by selecting "Edit widget line N". Shows widgets for that specific line.

```
  Preview
  ┌──────────────────────────────────────────────┐
  │  Line 1: project · dev-story · Tasks 2/5     │
  │  Line 2: 12:34                                │
  │  Line 3:                                      │
  └──────────────────────────────────────────────┘

  Home > Edit Line 1

  > Project        ■ visible   cyan
    Workflow       ■ visible   dynamic
    Progress+Step  ■ visible   yellow
    Story          ■ visible   green
    Timer          □ hidden    brightBlack

  ↑↓ Navigate  h Hide/Show  g Grab to reorder  c Color  s Save preset  l Load preset  Esc Back
```

**Interactions:**
- `h` — toggle visibility of highlighted widget
- `g` — grab highlighted widget, arrow keys to move, Enter to drop, Esc to cancel
- `c` — open color picker for highlighted widget (sub-screen: list of colors + "Dynamic" at top if workflow widget)
- `s` — open preset save screen (select slot)
- `l` — open preset load screen (select slot)
- `Esc` — back to Home

### Color Picker Screen (sub-screen of Edit Line)

```
  Home > Edit Line 1 > Color: Workflow

  > Dynamic
    red
    green
    yellow
    blue
    magenta
    cyan
    white
    brightRed
    ...

  ↑↓ Navigate  Enter Select  Esc Back
```

- "Dynamic" option only shown for `bmad-workflow` (only widget with ANSI colors from reader)
- All other widgets show only the fixed color list
- Selection applies immediately, preview updates, returns to Edit Line screen

### Preset Screen (sub-screen of Edit Line, save or load mode)

```
  Home > Edit Line 1 > Load Preset

    1. dev-focus        project · workflow · progressstep
    2. minimal-pres     workflow
    3. (empty)

  ↑↓ Navigate  Enter Select  Esc Back
```

- 3 shared slots
- Each slot shows its name + a mini-preview of the stored line content
- In save mode: selecting a slot saves current line config there (prompt for name if empty, confirm overwrite if occupied)
- In load mode: selecting a slot replaces current line with preset content

### Reorder Lines Screen

```
  Preview
  ┌──────────────────────────────────────────────┐
  │  Line 1: project · dev-story · Tasks 2/5     │
  │  Line 2: 12:34                                │
  │  Line 3:                                      │
  └──────────────────────────────────────────────┘

  Home > Reorder Lines

  > Line 1: project · workflow · progressstep · story
    Line 2: timer
    Line 3: (empty)

  ↑↓ Navigate  Enter Grab  Esc Back
```

- Enter to grab a line, arrow keys to swap position with adjacent line, Enter to drop
- Swaps entire line contents (not overwrite)
- Preview updates live during reorder

### Separator Style Screen

Unchanged from v1 — same 4 options (serre, modere, large, custom). Applies globally to all lines.

---

## Installer Changes

### IC1: Deploy composite widgets per configured line

The installer must deploy one `bmad-line-N` composite widget per non-empty line in the internal config. Default install: one composite on line 1 with all default-enabled widgets.

### IC2: Update getWidgetDefinitions

`getWidgetDefinitions()` in `defaults.js` must generate the new composite widget format (`bmad-line-0` etc.) instead of the legacy `bmad-compact` + `bmad-timer`.

---

## Dead Code Removal

### DC1: Remove composite widget definitions

- Remove `COMPOSITE_WIDGETS` array from `widget-registry.js`
- Remove `getCompositeWidgets()` function from `widget-registry.js`
- Remove `compositeMode` parameter and branch from `buildWidgetConfig()`
- Remove composite commands (`compact`, `full`, `minimal`) from reader
- Remove legacy `bmad-compact` from `defaults.js`

---

## UI/UX Improvements

### UX1: 3-line preview always visible at top

Replace `DualPreview` (Complete/Steps) with a 3-line preview box matching ccstatusline's visual style:
- Boxed frame (border characters)
- Label: "Preview" above the box
- 3 lines inside, each showing the composed widget output for that ccstatusline line
- Colors rendered (fix current bug where no colors display)
- Always visible on every screen, positioned at the top (below breadcrumb)

### UX2: Friendly UI

- Add measured emojis to menu items and screen elements (not overloaded)
- Add ANSI colors to improve visual hierarchy
- Add vertical spacing between sections for breathing room
- Shortcut keys highlighted in the shortcut bar

### UX3: Default widget colors

Each widget (except workflow) must have a hardcoded default fixed color that produces a visually pleasant output from first install:

| Widget | Default Color | Rationale |
|--------|--------------|-----------|
| project | cyan | Neutral info, stands out |
| workflow | dynamic | Only widget with ANSI workflow colors |
| step | yellow | Progress indicator |
| nextstep | yellow | Progress indicator (same family) |
| progress | green | Completion signal |
| progressbar | green | Completion signal (same family) |
| progressstep | brightCyan | Combined info, distinct from pure progress |
| story | magenta | Content identifier, distinct |
| timer | brightBlack | Background info, subtle |

---

## Functional Requirements

### Widget Configuration (Per Line)

- FR1: Developer can show/hide any of the 9 individual widgets on any line
- FR2: Developer can reorder widgets within a line via grab-and-move
- FR3: Developer can set a fixed ANSI color for any widget (except workflow)
- FR4: Developer can set workflow widget to dynamic color mode (workflow-specific ANSI colors)
- FR5: Developer can configure widgets independently on each of the 3 lines
- FR6: All widgets default to sensible fixed colors on first install (except workflow = dynamic)

### Preview

- FR7: A 3-line preview box is always visible at the top of every screen
- FR8: Preview reflects the current configuration with actual ANSI colors
- FR9: Preview updates within the same render cycle as any configuration change

### Presets

- FR10: Developer can save the current line's configuration to one of 3 shared preset slots
- FR11: Developer can load a preset into the current line being edited
- FR12: Preset slots show a mini-preview of their stored line content
- FR13: Presets persist across TUI sessions
- FR14: Loading a preset replaces only the current line, not all lines

### Navigation

- FR15: Home screen offers: Edit widget line 1/2/3, Reorder lines, Separator style, Reset to original
- FR16: Edit widget line screen provides: visibility toggle (h), grab reorder (g), color picker (c), save preset (s), load preset (l)
- FR17: Reorder lines screen allows swapping entire line contents between lines
- FR18: Escape always goes back one level
- FR19: Breadcrumb always shows current position

### ccstatusline Integration

- FR20: Each non-empty line injects exactly one composite widget into ccstatusline
- FR21: The composite widget calls the reader with a `line N` command
- FR22: Native ccstatusline widgets coexist on the same line without interference

### Reader

- FR23: Reader supports `line N` command that outputs composed widgets for line N
- FR24: Reader formats story names as "X-Y Title Case" (not raw slugs)
- FR25: All workflows in WORKFLOW_COLORS have visible, distinct colors
- FR26: Legacy composite commands (compact, full, minimal) are removed

### Bug Fixes

- FR27: All 9 widgets can be toggled visible/hidden regardless of initial defaultEnabled state
- FR28: Reset to original restores launch configuration without render loop errors
- FR29: Preview renders colors correctly in the terminal

### Installer

- FR30: Installer deploys one composite bmad widget per configured non-empty line
- FR31: Uninstaller removes all bmad-line-N widgets from ccstatusline config

---

## Non-Functional Requirements

### Performance

- NFR1: TUI launch time under 500ms (current baseline)
- NFR2: Preview update within the same render cycle as user input (no perceptible delay)
- NFR3: Reader `line N` command completes under 50ms (ccstatusline polls periodically)

### Reliability

- NFR4: Corrupted internal config falls back to defaults without crash
- NFR5: Missing preset slots default to empty without error
- NFR6: Reader returns empty string on any error (silent failure — existing rule)

### Compatibility

- NFR7: Cross-platform: Windows (Git Bash), macOS, Linux
- NFR8: Node.js >= 20
- NFR9: ccstatusline >= 2.2 (custom-command widget support)

### Maintainability

- NFR10: Zero external runtime dependencies for reader/hook/installer (existing rule)
- NFR11: TUI dependencies scoped to src/tui/ only (existing rule)
- NFR12: All state management centralized in app.js (existing pattern)

---

## Document Cascade

This PRD triggers the following downstream updates, in order:

1. **UX Design Specification** — Redesign for 3-line preview, new menu structure, per-line editing, preset sub-screens, color picker simplification
2. **Architecture** — Rev.3: multi-line model, internal config schema, reader `line N` command, composite deployment, dead code removal
3. **Project Context** — Regenerate to reflect prescribed rules for the new TUI structure
4. **Epics & Stories** — New epic(s) derived from this PRD + updated architecture
