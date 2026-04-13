# Story 10.1: Context Window Percentage Widget — Gradient Color Bar with Threshold Configuration

Status: ready-for-dev

## Story

As a Claude Code user monitoring my session via bmad-statusline,
I want a visual widget showing the percentage of context window consumed,
so that I can anticipate when the conversation will hit its context limit.

## Context

ccstatusline already provides a context window percentage widget. The Claude Code statusLine JSON payload includes a `context_window` object with `used_percentage`, `context_window_size`, and token counts. ccstatusline pipes this full JSON as stdin to custom-command widgets — meaning bmad-statusline's reader (`bmad-sl-reader.js`) already receives this data in stdin but doesn't use it today.

This story adds a new `bmad-contextpct` widget that:
1. Reads `context_window.used_percentage` directly from reader stdin (ccstatusline pass-through)
2. Renders in **full mode** (15-char progress bar + percentage) or **compact mode** (percentage only)
3. Applies a **dynamic gradient color** from brightGreen (0%) to red (100%) with configurable thresholds
4. Provides a **threshold configuration sub-screen** accessible via Enter in EditLineScreen

## Acceptance Criteria

### AC1: Widget Registration and Default Placement

**Given** the widget registry and default config
**When** the user first installs or upgrades bmad-statusline
**Then** `bmad-contextpct` appears in INDIVIDUAL_WIDGETS with `defaultEnabled: true`, `defaultMode: 'dynamic'`
**And** it is positioned last before `bmad-timer` in the `widgetOrder` array
**And** it is enabled by default on Line 3 (index 2) with colorModes `{ mode: 'dynamic', thresholdLow: 0, thresholdHigh: 100, displayMode: 'full' }`
**And** existing users' `config.json` gains the widget via `ensureWidgetOrder()` in config-loader.js (appears in `widgetOrder` but not auto-enabled on existing lines — only new installs get Line 3 default)

### AC2: Reader Extraction — Stdin Context Window Data

**Given** the reader receives ccstatusline's full JSON via stdin (confirmed: ccstatusline pipes `context.data` including `context_window` to custom-command widgets via `execSync({ input: jsonInput })`)
**When** the `contextpct` command runs in COMMANDS
**Then** it reads `stdin.context_window.used_percentage` as primary source
**And** falls back to computing `(current_usage / context_window_size) * 100` if `used_percentage` is absent but token fields exist
**And** returns empty string if no context window data is available (silent — Pattern 1)
**And** no hook modification is needed — data comes entirely from ccstatusline stdin pass-through

### AC3: Full Display Mode — Progress Bar with Gradient Coloring

**Given** `displayMode: 'full'` (default)
**When** the widget renders at X% context usage
**Then** it outputs a 15-character progress bar using `█` (filled) and `░` (empty) followed by a space and the percentage with one decimal (e.g., `42.3%`)
**And** the filled portion of the bar has **per-character gradient coloring** — each `█` is colored according to its position on the 0-100% scale, not the current percentage
**And** the `░` empty portion uses `brightBlack` color
**And** the percentage text takes the gradient color corresponding to the current percentage value

**Example at 60.0% with default thresholds (0–100):**
```
████████░░░░░░░ 60.0%
```
Bar chars 1-9 are filled (60% of 15 = 9), colored from brightGreen (position 0%) through yellow to brightRed (position ~60%). Chars 10-15 are `░` in brightBlack. The `60.0%` text is colored for 60% on the gradient.

### AC4: Compact Display Mode

**Given** `displayMode: 'compact'`
**When** the widget renders at X% context usage
**Then** it outputs only the percentage as `X.X%` (one decimal place)
**And** the entire text is colored with the gradient color corresponding to the current percentage

### AC5: Gradient Color Calculation with Thresholds

**Given** thresholdLow and thresholdHigh values from colorModes config
**When** computing the gradient color for a position P%
**Then** the 6-step gradient palette is: `brightGreen → green → yellow → brightYellow → brightRed → red`
**And** if P ≤ thresholdLow: color = `brightGreen` (fixed)
**And** if P ≥ thresholdHigh: color = `red` (fixed)
**And** if thresholdLow < P < thresholdHigh: interpolate P linearly across the 6 palette entries within the threshold range
**And** default thresholds are `thresholdLow: 0, thresholdHigh: 100` (full gradient across entire range)

### AC6: Display Mode Toggle via 'm' Key

**Given** the cursor is on `bmad-contextpct` in EditLineScreen
**When** the user presses `m`
**Then** the displayMode toggles between `'full'` and `'compact'`
**And** the widget name in the list shows `Context % (full)` or `Context % (compact)`
**And** the preview updates accordingly
**And** the `m` shortcut appears in the shortcuts bar (same pattern as bmad-story)

### AC7: Threshold Configuration Sub-Screen via Enter Key

**Given** the cursor is on `bmad-contextpct` in EditLineScreen
**When** the user presses Enter
**Then** the app navigates to a new `contextPctConfig` screen
**And** the screen displays:
```
  ▸ Seuil bas ........ [  0%]  ←→
    Seuil haut ....... [100%]  ←→

      0% ███████████████ 100%

  ←→ ±5%   ↑↓ Select   Esc Back
```
**And** `↑↓` selects which threshold to edit (cursor indicator `▸`)
**And** `←→` adjusts the selected threshold by ±5% increments
**And** thresholdLow is clamped to [0, thresholdHigh - 5]
**And** thresholdHigh is clamped to [thresholdLow + 5, 100]
**And** the preview bar is always 15 `█` characters (100% filled, no progression concept)
**And** the preview bar's per-character coloring reflects the current thresholds in real-time
**And** `0%` label on the left and `100%` label on the right frame the bar
**And** Esc returns to EditLineScreen
**And** changes are persisted via `updateConfig()` (immediate, debounced write)

### AC8: Preview Integration

**Given** the TUI preview system (preview-utils.js, ThreeLinePreview)
**When** `bmad-contextpct` is visible on a line
**Then** `SAMPLE_VALUES['bmad-contextpct']` returns an appropriate sample (e.g., `'████████░░░░░░░ 53.2%'` for full mode, `'53.2%'` for compact)
**And** `getSampleValue()` returns compact sample when displayMode is compact
**And** `resolvePreviewColor()` returns `'green'` for dynamic mode (same convention as workflow/project)

### AC9: Color Override Bypass in Reader

**Given** the reader's handleLineCommand applies fixed color override for most widgets (lines 250-262)
**When** the widget is `bmad-contextpct`
**Then** the normal color override is **skipped** (same exclusion pattern as `bmad-llmstate`)
**And** all coloring is handled internally by the COMMANDS.contextpct extractor

### AC10: Tests

**Given** the new widget code
**When** the test suite runs
**Then** reader tests verify: gradient color computation, full/compact formatting, threshold edge cases, missing data returns empty string
**And** TUI widget-registry tests verify: new widget in registry, default config includes it on Line 3
**And** TUI edit-line tests verify: `m` key toggles displayMode, Enter navigates to contextPctConfig
**And** all existing tests pass (zero regressions)

## Tasks / Subtasks

- [ ] Task 1: Widget Registry + Default Config (AC: 1)
  - [ ] 1.1 In `src/tui/widget-registry.js` line 15 (before bmad-timer): add `{ id: 'bmad-contextpct', command: 'contextpct', name: 'Context %', hint: 'Context window usage', defaultEnabled: true, defaultColor: null, defaultMode: 'dynamic' }`
  - [ ] 1.2 In `createDefaultConfig()` (line 31+): add `bmad-contextpct` to Line 3 widgets, positioned before `bmad-timer` — colorModes entry: `{ mode: 'dynamic', thresholdLow: 0, thresholdHigh: 100, displayMode: 'full' }`
  - [ ] 1.3 Verify `ensureWidgetOrder()` in config-loader.js automatically picks up the new ID (it iterates `getIndividualWidgets()` — no change needed, just verify)

- [ ] Task 2: Gradient Color Utility in shared-constants.cjs (AC: 5)
  - [ ] 2.1 In `src/reader/shared-constants.cjs`: add `CONTEXT_GRADIENT_PALETTE` array: `['brightGreen', 'green', 'yellow', 'brightYellow', 'brightRed', 'red']`
  - [ ] 2.2 Add `function getGradientColor(percentage, thresholdLow, thresholdHigh)` that returns a color name from the palette based on linear interpolation within the threshold range. Returns `'brightGreen'` if percentage ≤ thresholdLow, `'red'` if ≥ thresholdHigh
  - [ ] 2.3 Export both from `module.exports`
  - [ ] 2.4 Bridge to ESM in `src/defaults.js` via the existing `_sc = _require('./reader/shared-constants.cjs')` pattern

- [ ] Task 3: Reader COMMANDS.contextpct Extractor (AC: 2, 3, 4, 5, 9)
  - [ ] 3.1 In `src/reader/bmad-sl-reader.js` COMMANDS object (line ~307): add `contextpct` extractor. Signature: `(s, lc, stdin)` — **note: stdin must be passed through** (see Task 3.6)
  - [ ] 3.2 Extract percentage: `stdin?.context_window?.used_percentage` ?? fallback computation ?? `null`. If null, return `''`
  - [ ] 3.3 Read config: `lc.colorModes?.['bmad-contextpct']` for thresholdLow (default 0), thresholdHigh (default 100), displayMode (default 'full')
  - [ ] 3.4 **Full mode**: Build 15-char bar. For each position i (0-14), compute its percentage on the 0-100 scale (`i * 100 / 14`). If filled (position < current percentage), colorize `█` with `getGradientColor(positionPct, low, high)`. If empty, colorize `░` with brightBlack. Append space + percentage text colored with `getGradientColor(currentPct, low, high)`. Format percentage as `X.X%` with `toFixed(1)`
  - [ ] 3.5 **Compact mode**: return `colorize(percentage.toFixed(1) + '%', COLOR_CODES[getGradientColor(currentPct, low, high)])`
  - [ ] 3.6 **Modify handleLineCommand** to pass `stdin` as third argument to extractors: change `extractor(status, lineConfig)` to `extractor(status, lineConfig, stdin)` at line ~249. Existing extractors ignore the third arg (safe)
  - [ ] 3.7 **Modify color override exclusion** at line ~251: change `widgetId !== 'bmad-llmstate'` to `widgetId !== 'bmad-llmstate' && widgetId !== 'bmad-contextpct'`

- [ ] Task 4: TUI — Display Mode Toggle 'm' Key (AC: 6)
  - [ ] 4.1 In `src/tui/screens/EditLineScreen.js` line ~155: extend the `m` key handler condition from `widget.id !== 'bmad-story'` to also accept `'bmad-contextpct'`. Toggle `cm.displayMode` between `'compact'` and `'full'` (same logic)
  - [ ] 4.2 Line ~218: extend `storyMode` display hint to also trigger for `bmad-contextpct` (show `Context % (full)` or `Context % (compact)`)
  - [ ] 4.3 Line ~193: extend the STORY_MODE_SHORTCUT condition to also match `bmad-contextpct`

- [ ] Task 5: TUI — ContextPctConfigScreen (AC: 7)
  - [ ] 5.1 Create `src/tui/screens/ContextPctConfigScreen.js` following SkillColorsScreen pattern
  - [ ] 5.2 Component: `ContextPctConfigScreen({ config, updateConfig, goBack, editingLine, isActive })`
  - [ ] 5.3 State: `cursorIndex` (0 = thresholdLow, 1 = thresholdHigh)
  - [ ] 5.4 Input handling: `↑↓` to select threshold, `←→` to adjust ±5, Esc to goBack
  - [ ] 5.5 Clamping: thresholdLow ∈ [0, thresholdHigh - 5], thresholdHigh ∈ [thresholdLow + 5, 100]
  - [ ] 5.6 Render layout using `ScreenLayout` component:
    - Two rows: `▸ Seuil bas ........ [ N%]` and `  Seuil haut ....... [ N%]` — cursor indicator on selected
    - Blank line
    - Preview bar: `0%` + space + 15 `█` chars each colored via `getGradientColor(i * 100/14, low, high)` using `toInkColor()` + space + `100%` — **use `<Text color={toInkColor(color)}>█</Text>` for each char**
    - Shortcuts: `←→ ±5%   ↑↓ Select   Esc Back`
  - [ ] 5.7 `updateConfig()` called on every `←→` press (immediate feedback, debounced write)

- [ ] Task 6: TUI — Navigation Wiring (AC: 7)
  - [ ] 6.1 In `src/tui/screens/EditLineScreen.js` Enter handler (line ~117): add `else if (widget && widget.id === 'bmad-contextpct') { navigate('contextPctConfig'); }`
  - [ ] 6.2 In `src/tui/app.js`: import `ContextPctConfigScreen`, add screen route `if (screen === 'contextPctConfig')` returning the component with `screenProps`

- [ ] Task 7: Preview Utils (AC: 8)
  - [ ] 7.1 In `src/tui/preview-utils.js` SAMPLE_VALUES: add `'bmad-contextpct': '████████░░░░░░░ 53.2%'`
  - [ ] 7.2 In `getSampleValue()`: add case — if `bmad-contextpct` and displayMode is `'compact'`, return `'53.2%'`
  - [ ] 7.3 In `resolvePreviewColor()`: contextpct with dynamic mode should return `'green'` (same as workflow sample)

- [ ] Task 8: Tests (AC: 10)
  - [ ] 8.1 `test/reader.test.js`: test `contextpct` command — full mode, compact mode, gradient colors at 0/50/100%, threshold behavior, missing context_window returns empty, decimal formatting
  - [ ] 8.2 `test/tui-widget-registry.test.js`: verify new widget in registry, createDefaultConfig includes it on Line 3 before timer
  - [ ] 8.3 `test/tui-edit-line.test.js`: verify `m` key toggles displayMode on contextpct, Enter navigates to contextPctConfig
  - [ ] 8.4 New `test/tui-context-pct-config.test.js`: test threshold adjustment ±5, clamping, preview bar rendering, Esc goes back
  - [ ] 8.5 Run full test suite: `npm test` — zero regressions

## Dev Notes

### Architecture Compliance

- **Pattern 1** (Error handling triad): Reader returns `''` on missing data, never throws. TUI uses StatusMessage on error. No hook modification needed
- **Pattern 2** (Synchronous I/O): All file reads/writes via `fs.readFileSync`/`fs.writeFileSync`
- **Pattern 3** (ANSI color wrapping): All reader coloring via `colorize()` helper, TUI via `<Text color={}>`. **New**: per-character colorize calls for the gradient bar
- **Pattern 14** (Internal config writes): No backup, no validate for config.json
- **Pattern 15** (updateConfig): `structuredClone → mutate → sync → debounced write`
- **Pattern 18** (Standard screen props): New screen receives `{ config, updateConfig, goBack, editingLine, isActive }`

### Critical Implementation Details

**Gradient function must be in shared-constants.cjs** (CJS) so the reader can `require()` it. Bridge to ESM via `defaults.js` for any TUI usage. The TUI ContextPctConfigScreen needs the same gradient logic for preview — import via defaults.js.

**Reader extractor signature change**: All existing extractors take `(status, lineConfig)`. Adding `stdin` as third arg is backward-compatible — existing extractors ignore extra args. Only `contextpct` uses it.

**Color override exclusion**: The `bmad-contextpct` widget must be excluded from the fixed-color override in `handleLineCommand` (line ~251), exactly like `bmad-llmstate`. The extractor handles all coloring internally.

**Progress bar math**: 15 chars, each represents a position. Position percentage = `i * 100 / 14` (0th char = 0%, 14th char = 100%). Filled count = `Math.round(percentage * 15 / 100)`, clamped to [0, 15].

**Gradient interpolation**: Within the threshold range, divide into 5 equal segments (6 colors, 5 transitions). Segment index = `Math.min(Math.floor(normalizedPosition * 5), 4)` where `normalizedPosition = (P - low) / (high - low)`. Map to palette index.

### Files to Modify

| File | Action | Key Lines |
|------|--------|-----------|
| `src/tui/widget-registry.js` | Add widget entry before timer | Line 15 (before bmad-timer entry) |
| `src/tui/widget-registry.js` | Update createDefaultConfig for Line 3 | Lines 31-55 |
| `src/reader/shared-constants.cjs` | Add gradient palette + getGradientColor() | After formatStoryName (line ~66) |
| `src/reader/bmad-sl-reader.js` | Add COMMANDS.contextpct extractor | Line ~307 in COMMANDS object |
| `src/reader/bmad-sl-reader.js` | Pass stdin to extractors | Line ~249 |
| `src/reader/bmad-sl-reader.js` | Exclude from color override | Line ~251 |
| `src/defaults.js` | Bridge gradient exports | Lines 79-84 |
| `src/tui/screens/EditLineScreen.js` | Extend 'm' key + Enter handler | Lines 117-123, 155-165, 193, 218 |
| `src/tui/screens/ContextPctConfigScreen.js` | **NEW** — Threshold config screen | — |
| `src/tui/app.js` | Import + route new screen | Lines 7-18, 113-161 |
| `src/tui/preview-utils.js` | Add sample values + getSampleValue case | Lines 7-19, 31-36 |
| `src/tui/config-loader.js` | Verify ensureWidgetOrder handles new ID | Lines 43-55 (no change expected) |
| `test/reader.test.js` | Add contextpct tests | New describe block |
| `test/tui-widget-registry.test.js` | Verify new widget | New test |
| `test/tui-edit-line.test.js` | Test 'm' and Enter | New tests |
| `test/tui-context-pct-config.test.js` | **NEW** — Config screen tests | — |

### Testing Conventions

- Framework: `node:test` + `node:assert/strict` (zero dev deps)
- TUI tests: `ink-testing-library` v4.0.0 — destructure `{ lastFrame, unmount, stdin }`, always call `unmount()` after assertions
- Test script: `node --test --test-concurrency=4 --test-timeout=30000 test/*.test.js`
- Pattern: `describe('contextpct widget', () => { it('...', () => { ... }) })`

### References

- [Source: src/tui/widget-registry.js — INDIVIDUAL_WIDGETS array, createDefaultConfig()]
- [Source: src/reader/bmad-sl-reader.js:224-270 — handleLineCommand, COMMANDS, color override]
- [Source: src/reader/shared-constants.cjs:59-66 — formatStoryName pattern for shared CJS utility]
- [Source: src/tui/screens/EditLineScreen.js:117-123 — Enter key handler for sub-screens]
- [Source: src/tui/screens/EditLineScreen.js:154-165 — 'm' key display mode toggle]
- [Source: src/tui/screens/SkillColorsScreen.js — Reference pattern for sub-screen with navigation]
- [Source: src/tui/app.js:49-58 — updateConfig pattern]
- [Source: src/tui/app.js:71-85 — navigate/goBack pattern]
- [Source: src/tui/preview-utils.js:31-36 — getSampleValue with displayMode check]
- [Source: ccstatusline getContextWindowMetrics() — Priority: used_percentage > token computation > transcript fallback]
- [Spike: ccstatusline dist/ccstatusline.js:57124-57127 — `execSync(commandPath, { input: JSON.stringify(context.data) })` confirms full JSON piped to custom-command stdin]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

### Change Log
