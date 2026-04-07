---
title: 'Deferred Fixes — Config Validation & TUI State Bugs'
type: 'bugfix'
created: '2026-04-04'
status: 'done'
baseline_commit: '02e9fa8'
context: []
---

<frozen-after-approval>

## Intent

**Problem:** Accumulated config/TUI bugs from code reviews: `isValidV2` doesn't validate `colorModes` (crash at render), `editingLine` null guard missing (crash on mount race), `ensureWidgetOrder` never prunes stale widget IDs, `formatStoryName` produces double spaces on double-hyphen slugs, `resolveSeparator` ignores empty-string custom separator, `SelectWithPreview` doesn't fire `onHighlight` on mount (stale preview), separator constants duplicated across 3 files, `getPresetSlotData` duplicated across 2 files.

**Approach:** Fix each bug in-place. Add `colorModes` check to `isValidV2`. Add null guard to `EditLineScreen`. Prune stale IDs in `ensureWidgetOrder`. Fix `formatStoryName` to filter empty parts. Use `??` in `resolveSeparator`. Fire `onHighlight` on mount in `SelectWithPreview`. Export separator constants from `widget-registry.js` and DRY up preset slot helper.

## Boundaries & Constraints

**Always:** Maintain backward compat — invalid configs must fall through to migration/defaults, not crash. All fixes must be silent on error per Pattern 1/4.

**Ask First:** If exporting from `widget-registry.js` would create circular imports.

**Never:** Change the config.json schema version. Never remove widget IDs from user's `widgets` array (only from `widgetOrder`).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Config missing colorModes | `{ lines: [{ widgets: [...] }] }` | `isValidV2` returns false → migration path | N/A |
| editingLine null | Screen mounted before navigate sets line | Early return / no crash | N/A |
| Stale widgetOrder | widgetOrder contains `bmad-step` (removed) | Pruned on next load | N/A |
| Double-hyphen slug | `5-3-auth--login` | `5-3 Auth Login` (no double space) | N/A |
| Empty custom separator | `separator: 'custom', customSeparator: ''` | Empty string used (no fallback) | N/A |
| SelectWithPreview mount | defaultValue set, screen opens | `onHighlight` fires with defaultValue | N/A |

</frozen-after-approval>

## Code Map

- `src/tui/config-loader.js:60-81` — `ensureWidgetOrder()` (stale ID pruning)
- `src/tui/config-loader.js:83-90` — `isValidV2()` (missing colorModes check)
- `src/tui/screens/EditLineScreen.js:58` — `config.lines[editingLine]` (no null guard)
- `src/reader/bmad-sl-reader.js:315-321` — `formatStoryName()` (double-hyphen)
- `src/reader/bmad-sl-reader.js:260-263` — `resolveSeparator()` (empty string)
- `src/tui/components/SelectWithPreview.js:8-40` — No `onHighlight` on mount
- `src/tui/widget-registry.js` — Separator constants (not exported)
- `src/tui/preview-utils.js:20-24` — `SEPARATOR_MAP` duplicate
- `src/tui/screens/PresetSaveScreen.js:18-29` — `getPresetSlotData` duplicate
- `src/tui/screens/PresetLoadScreen.js:16-27` — `getPresetSlotData` duplicate

## Tasks & Acceptance

**Execution:**
- [x] `src/tui/config-loader.js` — (1) `isValidV2`: add `&& line.colorModes && typeof line.colorModes === 'object'` to validation. (2) `ensureWidgetOrder`: filter `widgetOrder` to only IDs present in `allIds`, preserving user order for valid IDs.
- [x] `src/tui/screens/EditLineScreen.js` — Add early return if `editingLine == null` or `config.lines[editingLine]` is undefined.
- [x] `src/reader/bmad-sl-reader.js` — (1) `formatStoryName`: filter empty parts after split (`split('-').filter(Boolean)`). (2) `resolveSeparator`: change `&& custom` to `&& custom != null` to allow empty string. Also fixed `readLineConfig` to use `??` for `customSeparator`.
- [x] `src/tui/components/SelectWithPreview.js` — Add `useEffect` on mount: call `onHighlight(options[defaultIndex].value)` when `onHighlight` is provided.
- [x] `src/tui/widget-registry.js` — Export `SEPARATOR_VALUES` map.
- [x] `src/tui/preview-utils.js` — Import separator map from widget-registry instead of local duplicate. Also extracted `getPresetSlotData` here.
- [x] `src/tui/screens/PresetSaveScreen.js` — Import shared `getPresetSlotData` from `preview-utils.js`.
- [x] `src/tui/screens/PresetLoadScreen.js` — Import shared `getPresetSlotData` from `preview-utils.js`.
- [x] `test/tui-select-preview.test.js` — Add test for `onHighlight` firing on mount. Updated existing tests for mount-fire behavior.
- [x] `test/reader.test.js` — Add test for double-hyphen slug and empty separator.

**Acceptance Criteria:**
- Given config with missing `colorModes`, when loaded, then `isValidV2` returns false and migration runs.
- Given `editingLine` is null, when EditLineScreen mounts, then no crash.
- Given stale `bmad-step` in widgetOrder, when config loads, then it is pruned.
- Given slug `5-3-auth--login`, when formatted, then output is `5-3 Auth Login` (single space).
- Given `customSeparator: ""`, when resolved, then empty string is returned.
- Given SelectWithPreview mounts, when `onHighlight` is provided, then it fires immediately with default value.

## Spec Change Log

## Verification

**Commands:**
- `node --test test/reader.test.js` — expected: all pass
- `node --test test/tui-select-preview.test.js` — expected: all pass
- `node --test test/tui-edit-line.test.js` — expected: all pass (no regression)

## Suggested Review Order

**Config validation & pruning**

- `isValidV2` now rejects configs missing `colorModes` — triggers migration path
  [`config-loader.js:86`](../../bmad-statusline/src/tui/config-loader.js#L86)

- Stale widget IDs pruned from `widgetOrder` before adding missing ones
  [`config-loader.js:66`](../../bmad-statusline/src/tui/config-loader.js#L66)

**Crash guards**

- Early return when `editingLine` is null or line missing — prevents mount race crash
  [`EditLineScreen.js:58`](../../bmad-statusline/src/tui/screens/EditLineScreen.js#L58)

**Reader bug fixes**

- `.filter(Boolean)` eliminates double spaces from double-hyphen slugs
  [`bmad-sl-reader.js:320`](../../bmad-statusline/src/reader/bmad-sl-reader.js#L320)

- `?? null` preserves empty string for `customSeparator` (was `|| null`)
  [`bmad-sl-reader.js:251`](../../bmad-statusline/src/reader/bmad-sl-reader.js#L251)

- `custom != null` allows empty-string custom separator through
  [`bmad-sl-reader.js:260`](../../bmad-statusline/src/reader/bmad-sl-reader.js#L260)

**Mount-fire fix**

- `useEffect` on mount fires `onHighlight` so preview isn't stale on open
  [`SelectWithPreview.js:12`](../../bmad-statusline/src/tui/components/SelectWithPreview.js#L12)

**DRY consolidation**

- Single source of truth for separator values
  [`widget-registry.js:17`](../../bmad-statusline/src/tui/widget-registry.js#L17)

- `SEPARATOR_MAP` re-exports; shared `getPresetSlotData` extracted here
  [`preview-utils.js:20`](../../bmad-statusline/src/tui/preview-utils.js#L20)

- PresetSave/Load now import shared helper
  [`PresetSaveScreen.js:8`](../../bmad-statusline/src/tui/screens/PresetSaveScreen.js#L8)
  [`PresetLoadScreen.js:7`](../../bmad-statusline/src/tui/screens/PresetLoadScreen.js#L7)

**Tests**

- Mount-fire tests and updated boundary expectations
  [`tui-select-preview.test.js:59`](../../bmad-statusline/test/tui-select-preview.test.js#L59)

- Double-hyphen slug and empty separator tests
  [`reader.test.js:189`](../../bmad-statusline/test/reader.test.js#L189)

- Fixture updated to remove stale widget IDs
  [`internal-config-multiline.json:7`](../../bmad-statusline/test/fixtures/internal-config-multiline.json#L7)
