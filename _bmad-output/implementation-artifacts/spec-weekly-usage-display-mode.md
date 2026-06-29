---
title: 'Weekly usage widget — compact/extended display mode + label rename'
type: 'feature'
created: '2026-06-29'
status: 'done'
baseline_commit: 'ddda5aa'
context: ['_bmad-output/project-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The `bmad-weeklyusage` statusline widget always renders `Weekly usage : <STATUS>` — the " usage " wording is verbose, and there is no way to surface the actual usage percentage on the status line.

**Approach:** Drop " usage " from the label (`Weekly: <STATUS>`) and add a per-line `displayMode` toggle to the widget's colorMode, mirroring the existing `bmad-contextpct` pattern. `compact` (default — preserves current behavior minus the wording) shows `Weekly: <STATUS>`; `extended` prepends the percentage: `Weekly: 53.0% <STATUS>`.

## Boundaries & Constraints

**Always:**
- compact → `Weekly: <STATUS>`; extended → `Weekly: <usagePct.toFixed(1)>% <STATUS>` (one decimal, identical formatting to `contextpct`).
- Missing / undefined `displayMode` resolves to **compact** (the widget is on no default line and is added without a displayMode; this preserves current behavior for every existing config).
- Mode values are the literal strings `'compact'` / `'extended'` (this exact vocabulary is shown to the user in the Edit Line hint).
- The widget stays self-colored via the zone `u.color`; it remains in the reader's generic-fixed-color exclusion list — never wrap it in a fixed color.
- Synchronous I/O only; reader stays silent on error (Patterns 1, 2). Zero new dependencies.

**Ask First:**
- (Resolved at checkpoint) Also rename the read-only **Weekly Usage dashboard** status line in `WeeklyUsageScreen.js` for wording consistency — its own comment states the wording is "identical to the widget". Spec assumes **yes**.

**Never:**
- Do NOT add a dedicated config screen (weeklyusage has no thresholds, unlike contextpct) — reuse the existing `m`-key toggle in EditLineScreen.
- Do NOT change zone logic, zone colors, bands, or `computeWeeklyUsage`.
- Do NOT make the widget render outside a tracked session (Rev.7 intentional asymmetry).
- Do NOT add a registry-level / createDefaultConfig displayMode default (widget is on no default line).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output | Error Handling |
|----------|--------------|-----------------|----------------|
| Compact (default) | colorMode absent or `{displayMode:'compact'}`, usage 55% → TOO HIGH zone | `Weekly: TOO HIGH` (yellow) | N/A |
| Extended | `{displayMode:'extended'}`, usage 55% → TOO HIGH | `Weekly: 55.0% TOO HIGH` (yellow) | N/A |
| Empty usage | stdin has no `rate_limits.seven_day` | `''` (no segment) | silent |
| Invalid snapshot | `computeWeeklyUsage` returns null (missing fields) | `''` | silent |

</frozen-after-approval>

## Code Map

- `src/reader/bmad-sl-reader.js` — `weeklyusage` extractor (~L399-405): branch render on displayMode.
- `src/tui/screens/EditLineScreen.js` — `m`-key toggle (L156-169), "Mode" shortcut condition (L198), display-mode hint (L222-225): include `bmad-weeklyusage`, cycle compact↔extended.
- `src/tui/preview-utils.js` — `SAMPLE_VALUES` (L20) + `getSampleValue` (L33-41): compact default sample + extended sample.
- `src/tui/screens/WeeklyUsageScreen.js` — dashboard status line (L97) + empty-state label (L58) + comment (L96).
- `test/reader.test.js` — label assertions L939-961, L1078; new extended-mode test.
- `test/tui-preview-utils.test.js` — sample assertion L30; new extended `getSampleValue` test.
- `test/tui-weekly-usage.test.js` — dashboard label regexes L60, L74.
- `test/tui-edit-line.test.js` — new weeklyusage `m`-key toggle + hint coverage.

## Tasks & Acceptance

**Execution:**
- [x] `src/reader/bmad-sl-reader.js` -- in the `weeklyusage` extractor read `lc?.colorModes?.['bmad-weeklyusage']?.displayMode`; build `text = 'Weekly: ' + (displayMode === 'extended' ? u.usagePct.toFixed(1) + '% ' : '') + u.status`; keep `return colorize(text, COLOR_CODES[u.color])`. -- core render change.
- [x] `src/tui/screens/EditLineScreen.js` -- add `bmad-weeklyusage` to the `m`-key handler (init `{ mode:'dynamic', displayMode:'compact' }` when colorMode absent; toggle `compact↔extended`), to the "Mode" shortcut condition (L198), and to the display-mode hint condition (L222) with a `'compact'` fallback for weeklyusage. -- exposes the toggle in the TUI.
- [x] `src/tui/preview-utils.js` -- set `SAMPLE_VALUES['bmad-weeklyusage'] = 'Weekly: SWEET SPOT'`; in `getSampleValue` return `'Weekly: 53.0% SWEET SPOT'` when weeklyusage `displayMode === 'extended'`. -- preview reflects both modes.
- [x] `src/tui/screens/WeeklyUsageScreen.js` -- change `'Weekly usage : ' + u.status` → `'Weekly: ' + u.status` (L97) and `'Weekly usage : --'` → `'Weekly: --'` (L58); update the L96 comment wording. -- dashboard label consistency.
- [x] `test/reader.test.js` -- update L939-961 + L1078 expectations to `Weekly: <STATUS>`; add a test that an `extended` colorMode yields `Weekly: 55.0% TOO HIGH`. -- lock both modes.
- [x] `test/tui-preview-utils.test.js` -- update L30 expected to `'Weekly: SWEET SPOT'`; add an extended `getSampleValue` assertion. -- lock preview samples.
- [x] `test/tui-weekly-usage.test.js` -- update L60/L74 regexes to `Weekly:`. -- lock dashboard label.
- [x] `test/tui-edit-line.test.js` -- add coverage: `m` on a visible weeklyusage toggles displayMode compact↔extended, and the name renders `(compact)`/`(extended)`. -- lock the toggle.

**Acceptance Criteria:**
- Given a line with `bmad-weeklyusage` and no `displayMode`, when the reader renders, then output is `Weekly: <STATUS>` (no percentage), self-colored by zone.
- Given `displayMode: 'extended'` and usage 55% (TOO HIGH zone), when the reader renders, then output is `Weekly: 55.0% TOO HIGH`.
- Given the Edit Line screen with weeklyusage visible and selected, when the user presses `m`, then displayMode cycles `compact↔extended` and the row name shows `(compact)`/`(extended)`.
- Given the full suite, when `npm test` runs, then every test passes.

## Spec Change Log

## Verification

**Commands:**
- `npm test` -- expected: all test files pass (notably `reader`, `tui-weekly-usage`, `tui-preview-utils`, `tui-edit-line`, `tui-widget-registry`).
- `node src/reader/bmad-sl-reader.js weeklyusage` with stdin `{"session_id":"x","rate_limits":{"seven_day":{"used_percentage":55,"resets_at":<future-sec>}}}` -- expected (default/compact): `Weekly: TOO HIGH`.

## Suggested Review Order

**Widget render — the core change**

- Entry point: the reader extractor branches on `displayMode` (undefined/compact → no `%`, extended → `pct.toFixed(1)%`).
  [`bmad-sl-reader.js:405`](../../src/reader/bmad-sl-reader.js#L405)

**TUI configuration — how the user picks the mode**

- `m`-key toggle cycles compact↔extended and seeds the colorMode when absent.
  [`EditLineScreen.js:156`](../../src/tui/screens/EditLineScreen.js#L156)

- Row hint shows `(compact)`/`(extended)`; undefined resolves to compact, matching the reader.
  [`EditLineScreen.js:228`](../../src/tui/screens/EditLineScreen.js#L228)

**Preview & dashboard — wording consistency across surfaces**

- Preview sample gains the extended (`%`) variant; compact sample loses " usage ".
  [`preview-utils.js:40`](../../src/tui/preview-utils.js#L40)

- Dashboard status line adopts the compact wording (`%` stays on its own bar row).
  [`WeeklyUsageScreen.js:98`](../../src/tui/screens/WeeklyUsageScreen.js#L98)

**Tests — supporting**

- Reader compact + extended output locked per zone.
  [`reader.test.js:965`](../../test/reader.test.js#L965)

- `m`-key toggle and `(compact)` hint coverage.
  [`tui-edit-line.test.js:241`](../../test/tui-edit-line.test.js#L241)

- `getSampleValue` compact/extended samples.
  [`tui-preview-utils.test.js:35`](../../test/tui-preview-utils.test.js#L35)

- Dashboard label regex updated.
  [`tui-weekly-usage.test.js:60`](../../test/tui-weekly-usage.test.js#L60)
