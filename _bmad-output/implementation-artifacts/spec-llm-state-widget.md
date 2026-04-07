---
title: 'LLM State widget — colored circle + state label in status line'
type: 'feature'
created: '2026-04-05'
status: 'done'
baseline_commit: '47a18aa'
context: ['_bmad-output/project-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** There is no visual signal in the status line when the LLM needs user attention (permission prompt, waiting for input). Users must check the terminal or monitor to know.

**Approach:** Add a new `bmad-llmstate` widget that renders a filled circle `⬤` plus state label, reusing the same 4 states and colors as the monitor's LlmBadge. Color is always state-driven (locked dynamic), not user-configurable. Position first in edit-line menu.

## Boundaries & Constraints

**Always:**
- Reuse the same 4 states: `active`, `waiting`, `permission`, `inactive` with the same color mapping (green, blueBright, yellow, grey).
- Compute display state with the 5-minute inactive timeout, same as `computeDisplayState` in monitor-utils.
- Reader must remain zero-dependency CommonJS — inline the timeout logic, do not import from TUI.
- Bold ANSI (`\x1b[1m`) for `permission` and `waiting` labels only.
- Label casing: `PERMISSION`, `EN ATTENTE` (uppercase+bold), `Actif`, `Inactif` (title case, no bold).
- Two spaces between circle and label text.
- Circle and label share the same color.

**Ask First:**
- If the widget should be `defaultEnabled: true` on line 0 (currently assumed yes).

**Never:**
- Allow color mode cycling (← →) for this widget in EditLineScreen.
- Add a `fixedColor` option — color is always state-driven.
- Modify the hook — `llm_state` and `updated_at` are already written.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Permission | `llm_state: 'permission'`, fresh `updated_at` | `⬤  PERMISSION` in yellow, bold | N/A |
| Waiting | `llm_state: 'waiting'`, fresh `updated_at` | `⬤  EN ATTENTE` in blueBright, bold | N/A |
| Active | `llm_state: 'active'`, fresh `updated_at` | `⬤  Actif` in green, no bold | N/A |
| Inactive explicit | `llm_state: 'inactive'` | `⬤  Inactif` in grey, no bold | N/A |
| Stale session | `updated_at` > 5 min ago | `⬤  Inactif` in grey regardless of `llm_state` | N/A |
| Missing field | `llm_state` absent | `⬤  Inactif` in grey | N/A |
| No session | No status file found | Empty string (widget hidden) | Silent skip |

</frozen-after-approval>

## Code Map

- `bmad-statusline/src/tui/widget-registry.js` -- Add `bmad-llmstate` entry at position 0 in INDIVIDUAL_WIDGETS
- `bmad-statusline/src/reader/bmad-sl-reader.js` -- Add `llmstate` command with circle+label formatting and inline inactive timeout
- `bmad-statusline/src/tui/screens/EditLineScreen.js` -- Block ← → color cycling for `bmad-llmstate`
- `bmad-statusline/src/tui/preview-utils.js` -- Add sample value and color resolution for `bmad-llmstate`
- `bmad-statusline/src/tui/config-loader.js` -- `ensureWidgetOrder` already handles new widgets via registry scan

## Tasks & Acceptance

**Execution:**
- [x] `widget-registry.js` -- Add `bmad-llmstate` at index 0 with `command: 'llmstate'`, `defaultEnabled: true`, `defaultColor: null`, `defaultMode: 'dynamic'`, `hint: 'LLM needs attention signal'`. Change `createDefaultConfig` so lines 1 and 2 default to `widgets: ['bmad-llmstate']` with `colorModes: { 'bmad-llmstate': { mode: 'dynamic' } }` (remove fileread/filewrite defaults)
- [x] `bmad-sl-reader.js` -- Add `BOLD` constant (`\x1b[1m`), `INACTIVE_TIMEOUT_MS` (5*60*1000), `computeLlmDisplayState(s)` helper, and `llmstate` entry in COMMANDS that returns `⬤  LABEL` with state color and conditional bold
- [x] `EditLineScreen.js` -- Guard `getColorOptions` to return empty array for `bmad-llmstate`; skip ← → handler when options are empty
- [x] `preview-utils.js` -- Add `bmad-llmstate` sample value (`⬤  PERMISSION`); handle color resolution to return `'yellow'` for preview
- [x] `test/llmstate-widget.test.js` -- Unit test the reader `computeLlmDisplayState` logic and ANSI output for all 4 states + stale timeout

**Acceptance Criteria:**
- Given a session with `llm_state: 'permission'` and fresh `updated_at`, when the reader renders line 0, then `⬤  PERMISSION` appears in yellow bold ANSI.
- Given a stale session (>5 min), when the reader renders, then `⬤  Inactif` appears in grey regardless of stored `llm_state`.
- Given the TUI EditLineScreen, when user presses ← or → on `bmad-llmstate`, then nothing changes (color locked).
- Given a fresh install, when `createDefaultConfig` runs, then `bmad-llmstate` is first in `widgetOrder` and included in `widgets` for all 3 lines with `mode: 'dynamic'`. Lines 1 and 2 default to `bmad-llmstate` only (no fileread/filewrite).

## Design Notes

State-to-ANSI mapping in the reader (inline, not imported):
```js
const LLM_STATES = {
  permission: { color: COLOR_CODES.yellow,      label: 'PERMISSION', bold: true },
  waiting:    { color: COLOR_CODES.brightCyan,   label: 'EN ATTENTE', bold: true },
  active:     { color: COLOR_CODES.green,        label: 'Actif',      bold: false },
  inactive:   { color: COLOR_CODES.brightBlack,  label: 'Inactif',    bold: false },
};
```

The reader skips the fixed-color override path for this widget because it always returns pre-colored output (same pattern as `project` and `workflow` which return already-colorized text).

In EditLineScreen, the color column displays `(auto)` instead of a color name, signaling to the user it's not configurable.

## Verification

**Commands:**
- `node --test test/llmstate-widget.test.js` -- expected: all tests pass
- `node bmad-statusline/src/reader/bmad-sl-reader.js line 0` -- expected: widget renders with ANSI colors when a session exists

**Manual checks:**
- Open TUI → Edit Line 1 → `LLM State` is first in list, shows `(auto)` for color, ← → does nothing
- Trigger a permission prompt in Claude Code → status line shows yellow bold `⬤  PERMISSION`

## Suggested Review Order

**Widget definition & defaults**

- New widget at position 0, default enabled on all 3 lines
  [`widget-registry.js:6`](../../bmad-statusline/src/tui/widget-registry.js#L6)

- Lines 1/2 switched from fileread/filewrite to llmstate
  [`widget-registry.js:53`](../../bmad-statusline/src/tui/widget-registry.js#L53)

**Reader rendering (core logic)**

- State map, timeout, display state computation, ANSI formatting
  [`bmad-sl-reader.js:122`](../../bmad-statusline/src/reader/bmad-sl-reader.js#L122)

- COMMANDS entry point for llmstate extractor
  [`bmad-sl-reader.js:393`](../../bmad-statusline/src/reader/bmad-sl-reader.js#L393)

- Guard: skip fixed-color override for llmstate (review patch)
  [`bmad-sl-reader.js:328`](../../bmad-statusline/src/reader/bmad-sl-reader.js#L328)

**TUI integration**

- Color lock: empty options array blocks cycling
  [`EditLineScreen.js:36`](../../bmad-statusline/src/tui/screens/EditLineScreen.js#L36)

- Display `(auto)` label and early return on ← →
  [`EditLineScreen.js:176`](../../bmad-statusline/src/tui/screens/EditLineScreen.js#L176)

- Preview sample value and hardcoded yellow for preview
  [`preview-utils.js:8`](../../bmad-statusline/src/tui/preview-utils.js#L8)

**Tests & fixtures**

- 8 new reader subprocess tests covering all states + stale timeout
  [`llmstate-widget.test.js:1`](../../bmad-statusline/test/llmstate-widget.test.js#L1)

- Updated registry, edit-line, preview, config-loader, reader tests
  [`tui-widget-registry.test.js:11`](../../bmad-statusline/test/tui-widget-registry.test.js#L11)
