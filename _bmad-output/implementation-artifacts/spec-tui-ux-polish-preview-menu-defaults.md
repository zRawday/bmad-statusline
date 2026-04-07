---
title: 'TUI UX polish round 2 — preview, menu, defaults, EditLine tweaks'
type: 'feature'
created: '2026-04-01'
status: 'done'
baseline_commit: '83f2bc7'
context:
  - '_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The TUI home screen is cluttered (feature bullets, preview placement), menu lacks visual grouping, separator screen doesn't auto-return, grab mode uses Enter instead of toggle, preview lacks line labels and visual distinction, and some defaults are suboptimal (separator, project color).

**Approach:** Targeted edits across HomeScreen, ThreeLinePreview, ScreenLayout, EditLineScreen, SeparatorStyleScreen, and widget-registry to improve UX flow, visual hierarchy, and defaults.

## Boundaries & Constraints

**Always:**
- Pattern 15: all config mutations via `updateConfig(mutator)`.
- Pattern 17: `setPreviewOverride(null)` on every `goBack()`.
- Pattern 3: Ink `<Text color={...}>` only — no ANSI escapes in React.
- Separator auto-return only for 3 preset styles, NOT for `custom` (which needs text input).
- Preview background hex must contrast with all 15 ANSI widget colors.

**Ask First:** If Ink `backgroundColor` with hex doesn't render on target terminal.

**Never:** Don't restructure ScreenLayout for non-home screens. Don't change config.json schema. Don't touch hook/reader code.

</frozen-after-approval>

## Code Map

- `bmad-statusline/src/tui/screens/HomeScreen.js` — header, menu, layout
- `bmad-statusline/src/tui/components/ThreeLinePreview.js` — preview rendering, line labels, background
- `bmad-statusline/src/tui/components/ScreenLayout.js` — preview placement (home vs other screens)
- `bmad-statusline/src/tui/screens/EditLineScreen.js` — grab toggle, step legend
- `bmad-statusline/src/tui/screens/SeparatorStyleScreen.js` — auto-return, goBack prop
- `bmad-statusline/src/tui/widget-registry.js` — default separator, default project color
- `bmad-statusline/src/tui/preview-utils.js` — no changes expected

## Tasks & Acceptance

**Execution:**
- [x] `HomeScreen.js` — Remove 3 green feature bullets from Header. Change tagline to `"Custom BMAD widgets for ccstatusline"`. Add `"Works with BMAD 6.2.2+"` line below tagline in dimmed text. Move ThreeLinePreview inside HomeScreen children (between header and menu) with left-padded "Preview" label. Add separator blank lines in HOME_OPTIONS: after editLine3, after reset.
- [x] `ScreenLayout.js` — Accept optional `hidePreview` prop; when true, skip ThreeLinePreview rendering (used by HomeScreen only).
- [x] `ThreeLinePreview.js` — Add "Line 1"/"Line 2"/"Line 3" labels (dimmed) before each line content. Show `"(empty)"` dimmed for lines with no widgets. Wrap entire preview zone (label + box) in a Box with warm dark grey `backgroundColor` hex (target: `#3b3532` — warm grey with beige tint, dark enough for all ANSI colors).
- [x] `SeparatorStyleScreen.js` — Call `goBack()` after `updateConfig` in `handleSelect` for non-custom styles. Accept `goBack` prop (already received).
- [x] `EditLineScreen.js` — In grab mode, handle `input === 'g'` as drop (same as Enter). Update GRAB_SHORTCUTS: replace `Enter`/`Drop` with `g`/`Drop`, keep `Enter` as silent alias. Add dimmed legend below widget list: `"Note: Step, Next Step, Progress, Progress Bar, Progress+Step only work with multi-step workflows"`.
- [x] `widget-registry.js` — Change `bmad-project` defaultColor from `'cyan'` to `'yellow'`. Change `createDefaultConfig()` separator from `'serre'` to `'modere'`.

**Acceptance Criteria:**
- Given home screen, when displayed, then no feature bullets visible, header shows "Custom BMAD widgets for ccstatusline" + "Works with BMAD 6.2.2+", preview appears below header with padded label, menu has visual gaps after line 3 and after reset.
- Given separator screen, when selecting tight/moderate/wide, then config updates and screen returns to home automatically. Selecting custom stays on screen for text input.
- Given EditLine in grab mode, when pressing 'g', then widget drops at current position (same as Enter).
- Given preview, when any line is empty, then "Line N (empty)" shown dimmed. All lines labeled. Background is warm dark grey.
- Given new install, when createDefaultConfig runs, then separator is 'modere' and project color is 'yellow'.

## Design Notes

**Preview background color:** `#3b3532` is a warm dark grey with beige undertone. Verified contrast considerations:
- Darkest widget color is `brightBlack`/`gray` (~`#808080`) — still 3:1+ against `#3b3532`.
- Brightest colors (brightWhite, brightYellow, brightCyan) have excellent contrast.
- The warm tint avoids the "cold terminal" feel while staying neutral enough for all hues.
- If the hex doesn't render (legacy terminal), Ink falls back to no background — acceptable degradation.

**Menu spacing:** The @inkjs/ui `Select` component renders flat options. Inject visual separator items (non-selectable) or use a custom list. Simplest: insert `{ label: ' ', value: '_sep1' }` spacer items and filter them in `onChange`.

## Verification

**Commands:**
- `cd bmad-statusline && node --test test/*.test.js` — expected: all tests pass (no regressions)

**Manual checks:**
- Launch TUI (`node bin/cli.js`): verify home layout, preview background, menu spacing, separator auto-return, grab toggle with 'g', line labels in preview, step legend in EditLine.

## Suggested Review Order

**Home screen restructure (points 1, 2, 7, 8, 11)**

- Header simplified: bullets removed, BMAD tagline + version added
  [`HomeScreen.js:29`](../../bmad-statusline/src/tui/screens/HomeScreen.js#L29)

- Menu with visual separator items, hidePreview, manual ThreeLinePreview placement
  [`HomeScreen.js:11`](../../bmad-statusline/src/tui/screens/HomeScreen.js#L11)

- ScreenLayout gains hidePreview prop for home-only override
  [`ScreenLayout.js:11`](../../bmad-statusline/src/tui/components/ScreenLayout.js#L11)

**Preview enhancements (points 5, 6)**

- Line labels, (empty) indicator, warm grey background `#3b3532`
  [`ThreeLinePreview.js:9`](../../bmad-statusline/src/tui/components/ThreeLinePreview.js#L9)

**Separator auto-return (point 3)**

- goBack() after non-custom select + custom submit
  [`SeparatorStyleScreen.js:45`](../../bmad-statusline/src/tui/screens/SeparatorStyleScreen.js#L45)

**EditLine tweaks (points 4, 9)**

- Grab toggle with 'g', step widget legend
  [`EditLineScreen.js:28`](../../bmad-statusline/src/tui/screens/EditLineScreen.js#L28)

**Default changes (points 3, 10)**

- Project color cyan→yellow, separator serre→modere
  [`widget-registry.js:6`](../../bmad-statusline/src/tui/widget-registry.js#L6)

**Tests**

- Updated fixture, menu navigation offsets, new default assertions
  [`internal-config-default.json:2`](../../bmad-statusline/test/fixtures/internal-config-default.json#L2)
  [`tui-app.test.js:130`](../../bmad-statusline/test/tui-app.test.js#L130)
  [`tui-widget-registry.test.js:53`](../../bmad-statusline/test/tui-widget-registry.test.js#L53)
  [`reader.test.js:262`](../../bmad-statusline/test/reader.test.js#L262)
