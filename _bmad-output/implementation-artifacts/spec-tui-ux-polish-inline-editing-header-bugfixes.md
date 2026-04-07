---
title: 'TUI UX polish — inline editing, home header, bugfixes'
type: 'feature'
created: '2026-04-01'
status: 'done'
baseline_commit: '232fa77'
context:
  - '_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The TUI editing workflow is disruptive: visibility toggle reorders the widget list (visible jump to top), grab opens a separate sub-menu with only visible widgets, color opens a full sub-screen. Additionally, bright ANSI colors render as white in TUI preview, custom separators have 3 extra spaces, and the home screen lacks context about the app.

**Approach:** (A) Add `widgetOrder` to config so each line has a stable full-list order; refactor EditLineScreen for in-place grab and left/right color cycling. (B) Fix Ink color name format (`brightRed` → `redBright`). (C) Investigate and fix custom separator spacing. (D) Add colorful home header, alternate screen buffer, and "Open ccstatusline" button.

## Boundaries & Constraints

**Always:**
- `widgetOrder` migration: derive from `[...existing widgets, ...remaining in default order]`
- `line.widgets` remains the reader's source of truth (visible widgets in display order, derived as subsequence of `widgetOrder`)
- Color name conversion only at Ink render boundary — internal storage keeps `brightRed` format
- Grab works on ALL widgets (visible and hidden) — user moves items freely in widgetOrder
- Color cycle `←→` disabled on hidden widgets
- Grab shows bold/visual feedback on the moving widget
- Pattern 1 error handling, Pattern 2 sync I/O

**Ask First:**
- If alternate screen buffer causes issues on Windows Git Bash
- If `widgetOrder` migration reveals edge cases

**Never:**
- Change reader `COLOR_CODES` map (ANSI escapes are correct)
- Change ccstatusline config schema
- Break existing preset save/load

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Bright color preview | `fixedColor: 'brightCyan'` | Ink receives `cyanBright` → correct color | Unmapped → `'white'` |
| Toggle visibility | `h` on any widget | Widget stays at same list position, ▰↔▱ toggles | N/A |
| Grab + move | `g` then `↑↓` on widget | Widget swaps in widgetOrder; if both visible, widgets array updated too | N/A |
| Color cycle visible | `←→` on ▰ widget | fixedColor cycles ANSI_COLORS, preview updates live | N/A |
| Color cycle hidden | `←→` on ▱ widget | No-op | N/A |
| Color cycle dynamic | `←→` on bmad-workflow | Cycles: dynamic → red → green → … → brightWhite → dynamic | N/A |
| Config without widgetOrder | Existing v2 config loaded | widgetOrder auto-generated per line | N/A |
| Open ccstatusline | Select button in home | TUI unmounts, `npx ccstatusline` spawns | Terminal shows npx errors if any |

</frozen-after-approval>

## Code Map

- `src/tui/screens/EditLineScreen.js` — Refactor: stable widgetOrder list, inline grab, ←→ color cycle
- `src/tui/screens/HomeScreen.js` — Colorful header, "Open ccstatusline" button
- `src/tui/screens/ColorPickerScreen.js` — Delete (replaced by inline ←→)
- `src/tui/preview-utils.js` — Add `toInkColor()` mapping (`brightX` → `xBright`)
- `src/tui/components/ThreeLinePreview.js` — Apply `toInkColor()` on color prop
- `src/tui/config-loader.js` — Generate `widgetOrder` during load/migration
- `src/tui/app.js` — Alternate screen buffer on/off, wire ccstatusline launch, remove colorPicker from nav
- `src/tui/widget-registry.js` — Remove dead `SEPARATOR_STYLES`, update `createDefaultConfig` with widgetOrder
- `src/reader/bmad-sl-reader.js` — Investigate/fix custom separator 3-space bug
- `src/tui/screens/PresetLoadScreen.js` — Apply `toInkColor()`
- `src/tui/screens/PresetSaveScreen.js` — Apply `toInkColor()`

## Tasks & Acceptance

**Execution:**
- [x] `src/tui/preview-utils.js` — Add `toInkColor(name)`: if name starts with `bright`, convert to Chalk format (e.g. `brightRed` → `redBright`); pass-through otherwise
- [x] `src/tui/components/ThreeLinePreview.js`, `PresetLoadScreen.js`, `PresetSaveScreen.js` — Wrap all `color` props passed to `<Text>` with `toInkColor()`
- [x] `src/tui/widget-registry.js` — Remove dead `SEPARATOR_STYLES`. Add `widgetOrder` (all 9 IDs) to `createDefaultConfig` for each line
- [x] `src/tui/config-loader.js` — On load, if any line lacks `widgetOrder`, generate it: `[...line.widgets, ...allIds.filter(id => !line.widgets.includes(id))]`
- [x] `src/tui/screens/EditLineScreen.js` — Display all 9 widgets in `widgetOrder` order. Toggle `h` adds/removes from `widgets` without moving. Grab `g`: bold indicator, `↑↓` swaps in widgetOrder (+ sync widgets order), `Enter` drop, `Esc` revert. `←→` cycles color on visible widgets only (include dynamic for bmad-workflow). Remove ReorderList import and grabMode sub-screen
- [x] `src/tui/screens/HomeScreen.js` — Add header box: app name (cyan bold), "Custom widgets for ccstatusline" description, feature bullet list (green). Add "Open ccstatusline" menu item at bottom
- [x] `src/tui/app.js` — Write `\x1b[?1049h` before render, `\x1b[?1049l` on exit. Add `launchCcstatusline` handler: unmount Ink, `child_process.execSync('npx ccstatusline', {stdio:'inherit'})`. Remove `colorPicker` from navigation map
- [x] `src/reader/bmad-sl-reader.js` — Trace custom separator pipeline end-to-end; fix source of 3-space padding (likely in extractor output or segment assembly)
- [x] `src/tui/screens/ColorPickerScreen.js` — Delete file

**Acceptance Criteria:**
- Given EditLineScreen, when pressing `h`, then widget stays at same list position and icon toggles
- Given EditLineScreen, when pressing `g` then `↑↓`, then widget moves in-place with bold indicator; Enter confirms, Esc reverts
- Given EditLineScreen with visible widget, when pressing `←`/`→`, then color cycles with live preview
- Given EditLineScreen with hidden widget, when pressing `←`/`→` or `g`, then `←→` is no-op, `g` grabs normally
- Given bright color in config, when displayed in any TUI preview, then correct bright color renders (not white)
- Given custom separator, when reader renders line, then no extra spaces between widgets and separator
- Given TUI launch, then terminal enters alternate screen; on exit, original content restored
- Given HomeScreen, then colorful header with app name, description, and feature list is visible
- Given "Open ccstatusline" selected, then TUI exits and `npx ccstatusline` launches
- Given config without widgetOrder, when loaded, then widgetOrder is auto-generated

## Verification

**Commands:**
- `node --test test/*.test.js` — expected: all existing tests pass

**Manual checks:**
- Bright colors render correctly in preview (not white)
- Custom separator has no extra spacing in reader output
- Alternate screen buffer works on Windows Git Bash
- Header displays correctly with colors

## Suggested Review Order

**Data model & migration**

- New `widgetOrder` field in default config — all 9 IDs per line
  [`widget-registry.js:37`](../../bmad-statusline/src/tui/widget-registry.js#L37)

- Migration: auto-generate widgetOrder from existing widgets + remaining defaults
  [`config-loader.js:60`](../../bmad-statusline/src/tui/config-loader.js#L60)

**Bright color bugfix**

- `toInkColor()` maps `brightRed` → `redBright`, special-cases `brightBlack` → `gray`
  [`preview-utils.js:25`](../../bmad-statusline/src/tui/preview-utils.js#L25)

- Applied to ThreeLinePreview color prop
  [`ThreeLinePreview.js:19`](../../bmad-statusline/src/tui/components/ThreeLinePreview.js#L19)

**EditLine UX overhaul**

- Full rewrite: widgetOrder list, inline grab (bold+↕), ←→ color cycle, h toggle in-place
  [`EditLineScreen.js:1`](../../bmad-statusline/src/tui/screens/EditLineScreen.js#L1)

- ANSI_COLORS list includes brightBlack; getColorOptions adds dynamic for workflow
  [`EditLineScreen.js:11`](../../bmad-statusline/src/tui/screens/EditLineScreen.js#L11)

**Home screen**

- Colorful Header component + "Open ccstatusline" menu item
  [`HomeScreen.js:33`](../../bmad-statusline/src/tui/screens/HomeScreen.js#L33)

**App shell**

- Alternate screen buffer with crash-safe restore, ccstatusline launch, colorPicker nav removed
  [`app.js:136`](../../bmad-statusline/src/tui/app.js#L136)

**Separator bugfix**

- Removed SEPARATOR_CONTENT (3-space default that polluted TextInput)
  [`SeparatorStyleScreen.js:29`](../../bmad-statusline/src/tui/screens/SeparatorStyleScreen.js#L29)

**Tests & fixtures**

- Fixtures updated with widgetOrder, ColorPickerScreen test deleted, EditLine tests adapted
  [`internal-config-default.json:1`](../../bmad-statusline/test/fixtures/internal-config-default.json#L1)
