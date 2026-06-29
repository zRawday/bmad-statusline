---
title: 'Weekly usage: extended by default on line 1 (middle)'
type: 'feature'
created: '2026-06-29'
status: 'done'
baseline_commit: '33e3149'
context: ['_bmad-output/project-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The `bmad-weeklyusage` widget ships on no default line, so new users never see their weekly consumption unless they manually add the widget.

**Approach:** In `createDefaultConfig`, add `bmad-weeklyusage` to **line 1 (the middle line)** in **extended** mode, alongside `bmad-llmstate`. Place it via the hardcoded line-1 object — the same mechanism `bmad-contextpct` uses for line 2 — and keep `defaultEnabled: false` so line-0 auto-population is unaffected.

## Boundaries & Constraints

**Always:**
- Line 1 default becomes `['bmad-llmstate', 'bmad-weeklyusage']` (llmstate stays first).
- weeklyusage line-1 colorMode = `{ mode: 'dynamic', displayMode: 'extended' }` (extended; self-colored by zone — `displayMode: 'extended'` triggers the `Weekly: <pct>.0% <STATUS>` render added previously).
- Keep `defaultEnabled: false` on the registry entry — it is the only thing keeping the widget off line 0; line-1 placement is explicit/hardcoded.
- Lines 0 and 2 default content unchanged. `widgetOrder` stays all 13 ids on every line.

**Ask First:**
- (Resolved at checkpoint) Update `_bmad-output/project-context.md` so its default-layout description and the weeklyusage widget-table note no longer say "appears on no default line". Spec assumes **yes** (minimal doc accuracy edit).

**Never:**
- Do NOT flip `defaultEnabled` to `true` (that would auto-add it to line 0 via the filter).
- Do NOT change line 0 or line 2 defaults.
- Do NOT alter the reader extractor / EditLineScreen toggle / preview — those shipped in the prior change.
- Do NOT migrate existing user configs — this only affects fresh `createDefaultConfig` output; `ensureWidgetOrder` already appends the id for legacy configs.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fresh install / reset to default | `createDefaultConfig()` | `lines[1].widgets === ['bmad-llmstate','bmad-weeklyusage']`; `lines[1].colorModes['bmad-weeklyusage'] === { mode:'dynamic', displayMode:'extended' }` | N/A |
| Existing saved config loaded | `loadConfig` of a user config | Unchanged except pre-existing `ensureWidgetOrder` appending the id if absent | N/A |
| Reader renders default line 1, subscriber data present | `reader line 1` | After the llmstate badge: `Weekly: <pct>.0% <STATUS>` (extended) | silent → '' on no data |

</frozen-after-approval>

## Code Map

- `src/tui/widget-registry.js` -- `createDefaultConfig` line-1 object (~L51): add weeklyusage + extended colorMode.
- `test/tui-widget-registry.test.js` -- golden 'line 1 has llmstate…' (L125-135) and AC2 'on no default line' (L169-176): reconcile to the new line-1 default.
- `_bmad-output/project-context.md` -- default-layout description + weeklyusage widget-table note (accuracy).

## Tasks & Acceptance

**Execution:**
- [x] `src/tui/widget-registry.js` -- in `createDefaultConfig`, set line 1 to `widgets: ['bmad-llmstate', 'bmad-weeklyusage']` and `colorModes: { 'bmad-llmstate': { mode: 'dynamic' }, 'bmad-weeklyusage': { mode: 'dynamic', displayMode: 'extended' } }`. Leave `defaultEnabled: false` and lines 0/2 untouched. -- the core default-layout change.
- [x] `test/tui-widget-registry.test.js` -- update the 'line 1 has llmstate, line 2 has contextpct' test to expect the new line-1 `widgets` + `colorModes`; update AC2 to assert weeklyusage is on line 1 ONLY (present in `lines[1].widgets`, absent from `lines[0]`/`lines[2]`, still in every `widgetOrder`). -- lock the new contract.
- [x] `_bmad-output/project-context.md` -- update the `createDefaultConfig` default-layout sentence and the weeklyusage row so "appears on no default line" → "default on line 1 (middle), extended mode". -- keep the living doc accurate. (Flagged — skip if user declines.)
- [x] Run `npm test` and reconcile any other default-config-dependent assertion that surfaces. -- safety net.

**Acceptance Criteria:**
- Given a fresh `createDefaultConfig()`, when inspected, then `lines[1].widgets` equals `['bmad-llmstate','bmad-weeklyusage']` and `lines[1].colorModes['bmad-weeklyusage']` equals `{ mode:'dynamic', displayMode:'extended' }`.
- Given lines 0 and 2 of that default config, when inspected, then their default widgets are unchanged from before.
- Given the default config rendered by the reader for line 1 with subscriber usage data, then the weekly segment is the extended form `Weekly: <pct>.0% <STATUS>`.
- Given the full suite, when `npm test` runs, then every test passes.

## Spec Change Log

## Verification

**Commands:**
- `npm test` -- expected: all pass (notably `tui-widget-registry`).
- `node -e "import('./src/tui/widget-registry.js').then(m=>console.log(JSON.stringify(m.createDefaultConfig().lines[1])))"` -- expected: line 1 lists `bmad-llmstate` then `bmad-weeklyusage` with `displayMode:'extended'`.

## Suggested Review Order

- Entry point: the one-line change — line 1 of the default config now carries `bmad-weeklyusage` in extended mode (llmstate first).
  [`widget-registry.js:51`](../../src/tui/widget-registry.js#L51)

- Golden default-layout assertion reconciled to the new line 1.
  [`tui-widget-registry.test.js:125`](../../test/tui-widget-registry.test.js#L125)

- AC2 flipped: weeklyusage is now a default widget on line 1 only (absent from lines 0/2).
  [`tui-widget-registry.test.js:172`](../../test/tui-widget-registry.test.js#L172)

- Golden fixture used by the first-install config-loader test, kept in sync.
  [`internal-config-default.json:18`](../../test/fixtures/internal-config-default.json#L18)

- Review-surfaced patch: the "empty line" preview test now forces a truly empty line (every default line is populated now).
  [`tui-components.test.js:114`](../../test/tui-components.test.js#L114)

- Living-doc accuracy: default-layout description + widget-table note updated.
  [`project-context.md:661`](../project-context.md#L661)
