---
title: 'Global layout presets'
type: 'feature'
created: '2026-04-03'
status: 'done'
baseline_commit: '7435248'
context: ['_bmad-output/project-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Presets currently save a single line's widget config (widgets + colors), triggered from the Edit Line screen via `s`/`l` shortcuts. Users expect a preset to capture their entire status bar layout at once and manage presets from the home screen rather than a sub-menu.

**Approach:** Refactor presets to store global layout (all 3 lines' widgets/widgetOrder + separator) without colors. Move save/load entry points from EditLineScreen to HomeScreen as a new separated menu group. Rewrite both preset screens to operate on the full layout.

## Boundaries & Constraints

**Always:**
- Preset stores `lines[*].widgets`, `lines[*].widgetOrder`, `separator`, `customSeparator` — never colorModes, skillColors, or projectColors
- Loading a preset preserves all current color settings intact
- 3 preset slots (unchanged count)
- Follow pattern 15 (updateConfig + structuredClone) and pattern 17 (previewOverride on load)
- PresetLoadScreen uses try-before-you-buy preview on cursor move (full 3-line preview)

**Ask First:** If existing per-line presets are found in config.json (old format without `lines` array), should we discard them silently or attempt migration?

**Never:**
- Don't change any other screen's behavior or navigation
- Don't add preset import/export or increase slot count
- Don't modify config-loader migration logic

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Save to empty slot | User picks empty slot, enters name | Preset captures 3 lines + separator, no colors | N/A |
| Save to occupied slot | User picks occupied slot, confirms | Overwrite with current layout + new/kept name | N/A |
| Load preset | User selects filled slot, presses Enter | All 3 lines widgets/widgetOrder + separator applied, colors unchanged | N/A |
| Load from empty slot | User presses Enter on empty slot | No-op | N/A |
| Old-format preset in config | Preset has `widgets`/`colorModes` but no `lines` | Treat as null (empty slot) | N/A |

</frozen-after-approval>

## Code Map

- `src/tui/screens/HomeScreen.js` — Add save/load preset menu group
- `src/tui/screens/EditLineScreen.js` — Remove `s`/`l` shortcuts
- `src/tui/screens/PresetSaveScreen.js` — Rewrite: save full layout without colors
- `src/tui/screens/PresetLoadScreen.js` — Rewrite: load full layout, preserve colors, 3-line preview
- `src/tui/app.js` — Preset screens no longer need `editingLine` context

## Tasks & Acceptance

**Execution:**
- [x] `src/tui/screens/HomeScreen.js` — Add separator + `💾 Save preset` + `📂 Load preset` entries between Reset and ccstatusline. Wire Enter to `navigate('presetSave')` / `navigate('presetLoad')`.
- [x] `src/tui/screens/EditLineScreen.js` — Remove `s`/`l` key handlers (lines 172-175) and their entries from `NAVIGATE_SHORTCUTS`.
- [x] `src/tui/screens/PresetSaveScreen.js` — Rewrite save: capture `lines[*].widgets`, `lines[*].widgetOrder`, `separator`, `customSeparator`. No colorModes. Remove `editingLine` dependency. Slot display shows compact per-line widget summary.
- [x] `src/tui/screens/PresetLoadScreen.js` — Rewrite load: apply preset widgets/widgetOrder/separator to all 3 lines, preserve all colorModes/skillColors/projectColors. Preview merges preset layout with current colors. Remove `editingLine` dependency.
- [x] `src/tui/app.js` — Ensure presetSave/presetLoad routes no longer depend on `editingLine` being set.

**Acceptance Criteria:**
- Given home screen, when user selects Save/Load preset, then the corresponding preset screen opens
- Given EditLineScreen, when user presses `s` or `l`, then nothing happens
- Given PresetSaveScreen after saving, then preset contains all 3 lines' widgets+widgetOrder + separator but no color data
- Given PresetLoadScreen, when user highlights a preset, then ThreeLinePreview shows preset layout with current colors
- Given PresetLoadScreen on confirm, then layout updates but colorModes/skillColors/projectColors remain unchanged
- Given old-format preset in config, when preset screen opens, then slot shows as empty

## Verification

**Commands:**
- `npm test` — expected: all existing tests pass (preset-related tests will need updating)

**Manual checks:**
- Launch TUI → home screen shows Save/Load preset in a new group
- Save preset → captures all 3 lines + separator, no colors
- Load preset → layout changes, colors preserved
- Edit Line → no `s`/`l` shortcuts visible or functional

## Suggested Review Order

**Preset schema & save logic**

- New global preset structure: 3 lines' widgets/widgetOrder + separator, no colors
  [`PresetSaveScreen.js:77`](../../bmad-statusline/src/tui/screens/PresetSaveScreen.js#L77)

- Slot rendering shows compact per-line widget summary (L1/L2/L3)
  [`PresetSaveScreen.js:31`](../../bmad-statusline/src/tui/screens/PresetSaveScreen.js#L31)

**Preset load & preview**

- Full layout merge: applies all 3 lines + separator, preserves all colors
  [`PresetLoadScreen.js:85`](../../bmad-statusline/src/tui/screens/PresetLoadScreen.js#L85)

- Try-before-you-buy preview with structuredClone, including initial mount preview
  [`PresetLoadScreen.js:50`](../../bmad-statusline/src/tui/screens/PresetLoadScreen.js#L50)

- Old-format preset guard (`!preset.lines`) treats legacy presets as empty
  [`PresetLoadScreen.js:52`](../../bmad-statusline/src/tui/screens/PresetLoadScreen.js#L52)

**UI entry point changes**

- Home screen: new preset group with Save/Load between Reset and ccstatusline
  [`HomeScreen.js:18`](../../bmad-statusline/src/tui/screens/HomeScreen.js#L18)

- EditLineScreen: s/l shortcuts removed
  [`EditLineScreen.js:22`](../../bmad-statusline/src/tui/screens/EditLineScreen.js#L22)

**Tests**

- Preset tests updated: new format helper, global load assertions, color preservation
  [`tui-preset.test.js:14`](../../bmad-statusline/test/tui-preset.test.js#L14)
