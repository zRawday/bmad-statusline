# Story 10.3: Widget registry entry (13th widget) + configurator preview integration

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer configuring the status line in the TUI**,
I want **`bmad-weeklyusage` registered as the 13th widget and previewed correctly in the configurator**,
so that **I can add it to a line via Edit Line and see a representative zone-colored sample in the live preview**.

## Context

This is the **TUI-registry/preview story of Epic 10** (Weekly Usage). It is **parallelizable with 10.2** (both depend only on 10.1, which landed the shared zone math). It is **purely additive** — it registers the new widget in the TUI's static registry and teaches the configurator's preview how to sample/color it. **No runtime behavior of the reader, hook, or installer is touched here.**

Three small, surgical changes plus their tests:

1. **`INDIVIDUAL_WIDGETS` registry entry** (`src/tui/widget-registry.js`) — append a 13th entry `bmad-weeklyusage` (`defaultEnabled: false`, `defaultMode: 'dynamic'`, `defaultColor: null`). The registry is the single source of truth for the Edit Line screen and config defaults.
2. **Preview sample + color** (`src/tui/preview-utils.js`) — add `SAMPLE_VALUES['bmad-weeklyusage'] = 'Weekly usage : SWEET SPOT'` and a `resolvePreviewColor` branch returning the representative zone color `'blue'` (the SWEET SPOT sample color) **regardless of mode**, mirroring the existing self-coloring branches (`bmad-llmstate`, `bmad-contextpct`).
3. **Tests** — update the two directly-affected test files (`test/tui-widget-registry.test.js`, `test/tui-preview-utils.test.js`) so the full suite stays green with the new 13th, dynamic-mode widget, and add the four 10.3 assertions (registry entry fields, default-line exclusion, `ensureWidgetOrder` legacy append, sample/color).

**Why no `config-loader.js` change is needed:** `ensureWidgetOrder()` (`src/tui/config-loader.js:43`) already iterates `getIndividualWidgets()` and appends any registry ID missing from a line's `widgetOrder`. The moment the registry gains `bmad-weeklyusage`, legacy configs automatically get it appended on load — **no code change, only a test asserting it**.

**Why no `createDefaultConfig` change is needed:** it filters by `defaultEnabled`. With `defaultEnabled: false`, the new widget is automatically excluded from every default line's `widgets`. It DOES appear in each line's `widgetOrder` (which is `[...allIds]`), exactly as intended — that is what makes it selectable in Edit Line without being shown by default.

**The configurator self-coloring crux:** like `bmad-llmstate` and `bmad-contextpct`, this widget computes its own color (a zone color), so the generic preview color path must be short-circuited with a fixed representative color. We use `'blue'` because the sample text is the SWEET SPOT zone, whose color is `blue` (per `WEEKLY_USAGE_ZONES` in `shared-constants.cjs`, story 10.1).

## Acceptance Criteria

### AC1: 13th `INDIVIDUAL_WIDGETS` entry with exact fields
**Given** `INDIVIDUAL_WIDGETS` in `src/tui/widget-registry.js`
**When** inspected
**Then** it contains a 13th entry `{ id: 'bmad-weeklyusage', command: 'weeklyusage', name: 'Weekly Usage', hint: 'Claude plan weekly consumption vs week elapsed (subscribers)', defaultEnabled: false, defaultColor: null, defaultMode: 'dynamic' }`, and `getIndividualWidgets().length === 13`.

### AC2: not on any default line
**Given** `createDefaultConfig()`
**When** a fresh default config is created
**Then** `bmad-weeklyusage` is NOT in any line's `widgets` array (`defaultEnabled: false`) — the existing 3-line default layout (line 0 visible widgets, line 1 `bmad-llmstate`, line 2 `bmad-contextpct`) is unchanged. It DOES appear in each line's `widgetOrder` (length now 13, since `widgetOrder` is `[...allIds]`).

### AC3: `ensureWidgetOrder()` appends it to a legacy config
**Given** an existing user config loaded after upgrade whose `widgetOrder` predates this widget (omits `bmad-weeklyusage`)
**When** `ensureWidgetOrder()` runs on load (`src/tui/config-loader.js`)
**Then** `bmad-weeklyusage` is appended to every line's `widgetOrder` (exactly as `bmad-contextpct` was appended pre-v1.2), so existing users see it in the Edit Line screen without losing their layout. **No code change to `config-loader.js` is required** — its existing `for (const id of allIds)` append loop already covers any new registry ID. This AC is satisfied by a test that loads a legacy config and asserts the append.

### AC4: no per-widget config screen — colorMode is `{ mode: 'dynamic' }`
**Given** `bmad-weeklyusage` has no per-widget config screen (the 4 zones are fixed by spec — nothing to configure)
**When** a user selects it in Edit Line
**Then** its `colorMode` is simply `{ mode: 'dynamic' }` — there is no threshold/displayMode sub-screen (unlike `bmad-contextpct`). This is an emergent property of the registry entry (`defaultMode: 'dynamic'`, `defaultColor: null`) — **no new screen, no routing, no Edit Line change is added in this story.** (The Edit Line screen and color-mode flow already handle a plain `dynamic` widget generically.)

### AC5: `SAMPLE_VALUES` sample text
**Given** `SAMPLE_VALUES` in `src/tui/preview-utils.js`
**When** inspected
**Then** it maps `'bmad-weeklyusage'` → `'Weekly usage : SWEET SPOT'` (a string).

### AC6: `resolvePreviewColor` returns the representative zone color regardless of mode
**Given** `resolvePreviewColor(widgetId, colorModes)` in `src/tui/preview-utils.js`
**When** `widgetId === 'bmad-weeklyusage'`
**Then** it returns `'blue'` (the SWEET SPOT sample's zone color) **regardless of `colorModes`** — mirroring the `bmad-contextpct`/`bmad-llmstate` self-coloring branches. The branch is `if (widgetId === 'bmad-weeklyusage') return 'blue';`, placed alongside the other self-coloring branches (before the generic `const mode = colorModes[widgetId]` logic, so it is safe even when `colorModes` is `{}` or `undefined` for this id).

### AC7: tests updated — suite stays green with the 13th dynamic widget
**Given** `test/tui-widget-registry.test.js` and `test/tui-preview-utils.test.js`
**When** updated for this story
**Then** they assert:
- (a) `getIndividualWidgets().length === 13` and the new entry's exact fields (id, command, name, hint, `defaultEnabled: false`, `defaultColor: null`, `defaultMode: 'dynamic'`);
- (b) `createDefaultConfig()` does not include `bmad-weeklyusage` on any line's `widgets`;
- (c) `ensureWidgetOrder()` appends `bmad-weeklyusage` to a legacy config that omits it (load a config whose `widgetOrder` lacks it → assert it is appended to every line);
- (d) `SAMPLE_VALUES['bmad-weeklyusage'] === 'Weekly usage : SWEET SPOT'` and `resolvePreviewColor('bmad-weeklyusage', …)` returns `'blue'` for both a `{ mode: 'dynamic' }` and a `{ mode: 'fixed', fixedColor: 'red' }` colorModes (proving "regardless of mode").

**And** every pre-existing assertion in those two files that hardcodes the old count of 12 (or the dynamic-widget set) is updated to reflect 13 widgets / 6 dynamic widgets, so `npm test` (full suite) passes with **zero failures**. Specifically (see Dev Notes "Existing-assertion surgery" for exact edits): the `length === 12` count assertions → 13; the `widgetOrder.length === 12` assertions → 13; the `expected` defaultColor map gains `'bmad-weeklyusage': null`; the dynamic-widgets test (`length === 5` + sorted-id list) → 6 with `bmad-weeklyusage` added; the `SAMPLE_VALUES` key-count and key-list assertions → 13 with the new key.

## Tasks / Subtasks

- [x] **Task 1 — Append the 13th registry entry** (AC: 1, 2, 4)
  - [x] 1.1 In `src/tui/widget-registry.js`, append to `INDIVIDUAL_WIDGETS` (after the `bmad-timer` entry, as the final/13th element) the entry verbatim from the reference (Dev Notes). Keep the file's existing column-aligned object style (match the surrounding rows' formatting; exact whitespace alignment is cosmetic — correctness is the field values).
  - [x] 1.2 Do **not** modify `createDefaultConfig()` — `defaultEnabled: false` keeps it off default lines automatically, and `widgetOrder: [...allIds]` includes it automatically. Confirm by reading: no other change to `widget-registry.js` is needed.
- [x] **Task 2 — Preview sample + color** (AC: 5, 6)
  - [x] 2.1 In `src/tui/preview-utils.js`, add `'bmad-weeklyusage': 'Weekly usage : SWEET SPOT',` to the `SAMPLE_VALUES` object.
  - [x] 2.2 In `resolvePreviewColor()`, add `if (widgetId === 'bmad-weeklyusage') return 'blue';` next to the existing `bmad-llmstate` / `bmad-contextpct` early-return branches (before the generic `const mode = colorModes[widgetId];` block). Do **not** add a `getSampleValue()` special case (the widget has no `displayMode` variants — it falls through to `SAMPLE_VALUES` correctly).
- [x] **Task 3 — Verify `ensureWidgetOrder` requires no code change** (AC: 3)
  - [x] 3.1 Read `src/tui/config-loader.js:43-65` and confirm the `for (const id of allIds) { if (!line.widgetOrder.includes(id)) line.widgetOrder.push(id); }` loop already appends any new registry ID. Make **no** edit to `config-loader.js`. (The behavior is covered by the new test in Task 4.3.)
- [x] **Task 4 — Update `test/tui-widget-registry.test.js`** (AC: 7 a,b,c + existing-assertion surgery)
  - [x] 4.1 Update count assertions: the `getIndividualWidgets returns all 12…` test title + `assert.equal(widgets.length, 12)` → 13; the two `assert.equal(config.lines[N].widgetOrder.length, 12)` (lines ~128-129) → 13.
  - [x] 4.2 Update the new-widget metadata coverage: add `'bmad-weeklyusage': null` to the `expected` defaultColor map; add `|| w.id === 'bmad-weeklyusage'` to the dynamic-mode `if` condition in the defaultMode test; in the dynamic-widgets test change `dynamicWidgets.length` `5` → `6` and add `'bmad-weeklyusage'` to the sorted-id `deepStrictEqual` array (sorted position: after `bmad-project`, before `bmad-workflow`), and update that test's title to include the new widget.
  - [x] 4.3 Add a focused new entry-fields test asserting the 13th entry's exact fields (AC1), a `createDefaultConfig()` no-default-line test (AC2 — assert no line's `widgets` includes `bmad-weeklyusage`), and an `ensureWidgetOrder` legacy-append test (AC3 — import `loadConfig` from `config-loader.js`, write a legacy config via `BMAD_CONFIG_DIR`/a `paths.internalConfig` temp file whose lines' `widgetOrder` omit `bmad-weeklyusage`, load it, assert every line's `widgetOrder` now includes `bmad-weeklyusage` appended at the end). See Dev Notes "ensureWidgetOrder test recipe".
- [x] **Task 5 — Update `test/tui-preview-utils.test.js`** (AC: 7 d + existing-assertion surgery)
  - [x] 5.1 Add `'bmad-weeklyusage'` to the `expectedKeys` array; update the `has all 12 widget keys` title → 13 and the `has exactly 12 keys` → `assert.equal(Object.keys(SAMPLE_VALUES).length, 13)` + title.
  - [x] 5.2 Add a test asserting `SAMPLE_VALUES['bmad-weeklyusage'] === 'Weekly usage : SWEET SPOT'`.
  - [x] 5.3 Add a `resolvePreviewColor` test asserting `'blue'` for `bmad-weeklyusage` with both `{ 'bmad-weeklyusage': { mode: 'dynamic' } }` and `{ 'bmad-weeklyusage': { mode: 'fixed', fixedColor: 'red' } }` (regardless-of-mode).
- [x] **Task 6 — Verify** (AC: 7)
  - [x] 6.1 Run the full suite: `node --test --test-concurrency=4 --test-timeout=30000 test/*.test.js`. All green, zero failures. Pay special attention that nothing in `test/defaults.test.js` or `test/install.test.js` regressed (their `12 event types` assertions are about **hook event types**, not widgets — they must remain `12` and must NOT be touched).

## Dev Notes

### Reference snippets — copy VERBATIM
Source: Architecture Rev.7 — `_bmad-output/planning-artifacts/architecture.md:2375-2454`. These are the locked spec bodies; do not improvise field names or values.

**Registry entry** (append as the final/13th element of `INDIVIDUAL_WIDGETS` in `src/tui/widget-registry.js`):
```js
{ id: 'bmad-weeklyusage', command: 'weeklyusage', name: 'Weekly Usage', hint: 'Claude plan weekly consumption vs week elapsed (subscribers)', defaultEnabled: false, defaultColor: null, defaultMode: 'dynamic' },
```
(Align the columns to match the surrounding rows if you like — cosmetic only. The field set and values are what the ACs assert.)

**`SAMPLE_VALUES` addition** (`src/tui/preview-utils.js`, inside the `SAMPLE_VALUES` object):
```js
'bmad-weeklyusage': 'Weekly usage : SWEET SPOT',
```

**`resolvePreviewColor` branch** (`src/tui/preview-utils.js`, alongside the `bmad-llmstate` / `bmad-contextpct` early returns — i.e. before `const mode = colorModes[widgetId];`):
```js
if (widgetId === 'bmad-weeklyusage') return 'blue';
```

### Why `'blue'` (not a computed color) in the configurator
The configurator preview is a **static sample**, not live data — there is no `rate_limits` stdin in the TUI. The sample text is fixed to the SWEET SPOT zone, whose color is `blue` (`WEEKLY_USAGE_ZONES.sweet.color === 'blue'` in `shared-constants.cjs`, story 10.1). So the preview color is a hardcoded representative `'blue'`, returned regardless of `colorModes` — the same self-coloring shape used by `bmad-llmstate` (returns a fixed object) and `bmad-contextpct` (returns its own color). The runtime widget still computes the true zone color live in the reader (story 10.2); the configurator just shows a representative swatch.

### Existing-assertion surgery (exact list — keep `npm test` green)
Adding a **13th, `defaultMode: 'dynamic'`** widget breaks several hardcoded assertions. You MUST update all of these in this story (the suite cannot be left red):

`test/tui-widget-registry.test.js`:
- `it('getIndividualWidgets returns all 12 individual widgets', …)` → title + `assert.equal(widgets.length, 12)` → **13**.
- `widget defaultColor values match specification`: add `'bmad-weeklyusage': null,` to the `expected` map.
- `widget defaultMode values match specification`: add `|| w.id === 'bmad-weeklyusage'` to the `if (w.id === 'bmad-llmstate' || …)` dynamic list.
- `dynamic defaultMode widgets are …`: `assert.equal(dynamicWidgets.length, 5)` → **6**; `deepStrictEqual(ids, [...])` → add `'bmad-weeklyusage'` in sorted order (`['bmad-activeskill', 'bmad-contextpct', 'bmad-llmstate', 'bmad-project', 'bmad-weeklyusage', 'bmad-workflow']`); update the title.
- `line 1 has llmstate, line 2 has contextpct by default`: both `assert.equal(config.lines[N].widgetOrder.length, 12)` → **13**.

`test/tui-preview-utils.test.js`:
- `has all 12 widget keys`: add `'bmad-weeklyusage'` to `expectedKeys`; update title → 13.
- `has exactly 12 keys`: `assert.equal(Object.keys(SAMPLE_VALUES).length, 12)` → **13**; update title.

**DO NOT TOUCH** (false friends — coincidentally `12`, but unrelated to widgets):
- `test/defaults.test.js:49` `eventTypes.length === 12` — **hook event types** (UserPromptSubmit, PreToolUse, …), not widgets.
- `test/install.test.js:271` `eventTypes.length === 12` — same hook event types.

### `ensureWidgetOrder` test recipe (AC3 / Task 4.3)
`loadConfig(paths)` accepts `paths.internalConfig` (an explicit config-file path) — use that (or `BMAD_CONFIG_DIR`) to avoid touching the real `~/.config`. Steps:
1. Build a "legacy" v2 config object: valid 3-line shape (`isValidV2` requires `lines.length === 3`, each line with `widgets` array + `colorModes` object), where each line's `widgetOrder` is the **12-id** list (the pre-10.3 registry order, omitting `bmad-weeklyusage`).
2. Write it to a temp file (e.g. via `fs.writeFileSync(tmpConfigPath, JSON.stringify(legacy))`), then `loadConfig({ internalConfig: tmpConfigPath })`.
3. Assert each returned `line.widgetOrder` includes `'bmad-weeklyusage'` and that it is the **last** appended id (the `for (const id of allIds)` loop pushes missing ids in registry order; `bmad-weeklyusage` is last in the registry, so it lands last). Also assert no other ids were lost.
Look at how the existing TUI tests set up temp config dirs (`test/tui-config-loader*.test.js` if present, or the `BMAD_CONFIG_DIR` pattern used elsewhere) and reuse that harness rather than inventing a new one.

### Hard constraints (project patterns — see `_bmad-output/project-context.md`)
- **Boundary isolation (Boundary 6):** all changes are inside `src/tui/` (`widget-registry.js`, `preview-utils.js`) and `test/tui-*.test.js`. Do **not** touch the reader, hook, installer, `defaults.js`, `shared-constants.cjs`, or `app.js` in this story.
- **ESM modules:** `src/tui/` is ESM (`import`/`export`). `widget-registry.js` and `preview-utils.js` are ESM. Match existing style: 2-space indent, single quotes, semicolons, `camelCase` functions, `UPPER_SNAKE`/`PascalCase` consts.
- **Widget registry is the single source of truth (Pattern: registry-driven UI):** the Edit Line screen and `createDefaultConfig` both read from `INDIVIDUAL_WIDGETS`. Adding the entry is sufficient to make the widget appear and be selectable — never hardcode the widget anywhere else in the TUI.
- **Self-coloring widgets** (`bmad-llmstate`, `bmad-contextpct`, now `bmad-weeklyusage`): they own their color. In the reader (10.2, done) they are excluded from generic fixed-color wrapping; in the configurator preview (this story) `resolvePreviewColor` returns a fixed representative color for them. Keep the two surfaces consistent.
- **`resolvePreviewColor` (Pattern 19 — centralized color resolution):** all TUI preview color decisions go through this one helper. Add the branch here; never duplicate color logic in a screen component.
- **Tests:** `node:test` + `node:assert/strict`, `describe`/`it`(or `test`). Put assertions in the two named files — do **not** create a new test file (the new `test/tui-weekly-usage.test.js` is story 10.4's screen test, not this story's).

### Anti-patterns to avoid (would fail review)
- ❌ Setting `defaultEnabled: true` or adding `bmad-weeklyusage` to a default line — it must stay off by default (`createDefaultConfig` layout unchanged). Conservative brownfield default.
- ❌ Editing `config-loader.js` / `ensureWidgetOrder` — the append is already generic. Adding a special case for `bmad-weeklyusage` is redundant and would be flagged.
- ❌ Adding a per-widget config screen, threshold/displayMode sub-screen, or Edit Line routing for this widget — the 4 zones are fixed; `colorMode` is a plain `{ mode: 'dynamic' }`. (That's the deliberate contrast with `contextpct`, which DOES have a config screen.)
- ❌ Making `resolvePreviewColor` respect `colorModes` for this widget (e.g. returning a fixed user color) — it must always return `'blue'` (self-colored). The widget has no user-settable color.
- ❌ Touching the reader extractor, `persistUsageSnapshot`, the self-color exclusion guard, or anything in `bmad-sl-reader.js` — that's story 10.2 (done). This story is registry + preview only.
- ❌ Building the `WeeklyUsageScreen`, Home button, or `app.js` routing — that's story 10.4.
- ❌ Editing `_bmad-output/project-context.md`, README, the "12 widgets" prose, Boundary-2 wording, or the intentional-asymmetry doc — that's the story 10.5 reconciliation sweep. (This story only updates the two `tui-*` test files needed to keep the suite green; 10.5 sweeps the broader prose/doc references and re-verifies the 13 count everywhere.)
- ❌ "Fixing" the `12 event types` assertions in `defaults.test.js` / `install.test.js` — those count **hook event types**, not widgets. Leave them at 12.

### Scope boundary with story 10.5 (read this — it resolves the apparent overlap)
Story 10.5's AC1 says it sweeps "12 widgets" references "explicitly including `tui-widget-registry.test.js` expectations." That reads like overlap, but the resolution is clean and non-negotiable: **a story must never be committed with a red `npm test`** (the project's quality gate — story 10.2 verified 707/707 green). Adding the 13th widget here immediately breaks the count assertions in the two `tui-*` test files, so **this story (10.3) must update those two files** to keep the suite green. Story **10.5** then owns the broader sweep — `project-context.md` (the "12 widgets" heading + widget table + "all 12 widget IDs" prose + Boundary-2 wording + Pattern 29 reference + self-coloring-exclusion prose + intentional-asymmetry doc), any README count, and a final cross-repo re-verification that no "11/12 widgets" reference survives. After 10.3, the two `tui-*` test files already read "13"; 10.5's role there is re-verification, not first-time editing.

### Previous story intelligence (10.2 — done)
- 10.2 (reader extractor + snapshot + self-color exclusion) is **done** and committed; the full suite was 707/707 green after it. 10.3 builds on a stable reader contract and does not depend on the snapshot.
- 10.2 confirmed the zone color names are `green`/`blue`/`yellow`/`red` (from `WEEKLY_USAGE_ZONES`), and `'blue'` is the SWEET SPOT (`sweet`) zone color — that is why this story's preview color is `'blue'`.
- 10.2's review deferred a self-color `!==` chain refactor (`SELF_COLORED_WIDGETS = new Set([...])`) in the **reader** — that is a reader-side cleanup, explicitly NOT in this TUI-side story. Do not refactor the reader.
- Pattern continuity: 10.2 followed the "verbatim reference body" discipline (no speculative guards). Do the same here — register exactly the spec'd entry and the two preview hooks; nothing more.

### Project Structure Notes
- Files modified: `src/tui/widget-registry.js` (one `INDIVIDUAL_WIDGETS` entry), `src/tui/preview-utils.js` (`SAMPLE_VALUES` entry + `resolvePreviewColor` branch), `test/tui-widget-registry.test.js` (count/metadata assertions + 3 new tests), `test/tui-preview-utils.test.js` (count/key assertions + 2 new tests). **No new source files** (the new TUI screen file is story 10.4). **No `config-loader.js` change.**
- Aligns with Boundary 6 (TUI isolated boundary, ESM) and the registry-as-single-source-of-truth contract. Purely additive — no existing component contract (config.json schema, status file, reader output) changes. Consistent with Epic 10's brownfield-additive framing.
- The `defaults.js` ESM bridge (10.1) and the reader extractor (10.2) are untouched — this story consumes neither; it only edits the static registry + preview helpers.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.3] — user story + the 5 BDD acceptance criteria (lines 2411-2445).
- [Source: _bmad-output/planning-artifacts/architecture.md#Rev.7 New Widget — bmad-weeklyusage (13th widget)] — registry entry verbatim, `defaultEnabled: false` rationale, `ensureWidgetOrder` append behavior, no-config-screen note (lines 2375-2388).
- [Source: _bmad-output/planning-artifacts/architecture.md#Rev.7 Preview Integration] — `SAMPLE_VALUES` addition + `resolvePreviewColor` branch verbatim (lines 2446-2454).
- [Source: _bmad-output/planning-artifacts/architecture.md#Widget count drift] — "12th" brief vs 13th registry; tests/prose move to 13 (line 2479).
- [Source: src/tui/widget-registry.js] — `INDIVIDUAL_WIDGETS` (currently 12 entries, lines 5-18); `createDefaultConfig` filters by `defaultEnabled` + `widgetOrder: [...allIds]` (lines 32-57); `getIndividualWidgets` returns copies (28-30).
- [Source: src/tui/preview-utils.js] — `SAMPLE_VALUES` (7-20); `getSampleValue` (no change needed, 32-40); `resolvePreviewColor` self-coloring branches for `bmad-llmstate`/`bmad-contextpct` (42-65).
- [Source: src/tui/config-loader.js] — `ensureWidgetOrder` generic append loop (43-65); `loadConfig(paths)` with `paths.internalConfig` (18-41); `isValidV2` 3-line requirement (67-75).
- [Source: test/tui-widget-registry.test.js] — count + defaultColor + defaultMode + dynamic-widgets + widgetOrder.length assertions to update (lines 11, 13, 52-65, 74-88, 128-129).
- [Source: test/tui-preview-utils.test.js] — `SAMPLE_VALUES` key-count + key-list assertions to update (lines 13-27); `resolvePreviewColor` test patterns (55-85).
- [Source: src/reader/shared-constants.cjs] — `WEEKLY_USAGE_ZONES` (`sweet → { status: 'SWEET SPOT', color: 'blue' }`), landed in story 10.1 — basis for the `'blue'` preview color.
- [Source: _bmad-output/implementation-artifacts/10-2-reader-weeklyusage-extractor-snapshot-persistence-self-color-exclusion.md] — 10.2 done; self-coloring widget set, zone color names, verbatim-reference discipline.
- [Source: _bmad-output/project-context.md] — Boundary 6 (TUI isolation), Pattern 19 (centralized `resolvePreviewColor`), registry-as-source-of-truth. (Read-only here — its widget-count/Boundary-2 prose is edited in story 10.5, not this story.)

### Dependency note for the SM/dev
Per epics.md Epic 10 dependencies: 10.1 (done) is the foundation. **10.2 (done) and 10.3 parallelize after 10.1.** 10.4 (TUI "Weekly usage" screen + Home button + app routing) depends on **this story** (widget registered + previewable) and on 10.1 (shared math via the `defaults.js` bridge) and consumes the `weekly-usage.json` snapshot that 10.2 persists. 10.5 (doc/test reconciliation — 13-widget sweep, Boundary-2 wording, intentional-asymmetry doc) is last. Keep this story confined to the TUI registry + preview so 10.4 inherits a stable, registered, previewable widget.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Opus 4.8, 1M context)

### Debug Log References

- Full suite (TDD RED) before source changes: the two `tui-*` test files failed exactly on the new/updated assertions (length 12→13, missing `bmad-weeklyusage` key/color) — confirming test correctness before implementation.
- Full suite (GREEN) after the registry + preview edits surfaced 4 *unanticipated* regressions in `config-loader v2` (`internal-config-default.json` / `internal-config-multiline.json` fixtures still encoded a 12-id `widgetOrder`). Fixed the fixtures; final run `712 tests / 712 pass / 0 fail`.

### Completion Notes List

- **Registry (AC1, AC2, AC4):** Appended the 13th `INDIVIDUAL_WIDGETS` entry `bmad-weeklyusage` verbatim from the architecture Rev.7 spec (`defaultEnabled: false`, `defaultColor: null`, `defaultMode: 'dynamic'`). `createDefaultConfig()` was left untouched — `defaultEnabled: false` keeps it off every default line's `widgets`, while `widgetOrder: [...allIds]` includes it automatically (now length 13). The plain `{ mode: 'dynamic' }` colorMode is an emergent property of the entry; no per-widget config screen / Edit Line routing was added (AC4).
- **Preview (AC5, AC6):** Added `SAMPLE_VALUES['bmad-weeklyusage'] = 'Weekly usage : SWEET SPOT'` and a self-coloring `resolvePreviewColor` branch `if (widgetId === 'bmad-weeklyusage') return 'blue';`, placed alongside the `bmad-llmstate` / `bmad-contextpct` early returns (before the generic `const mode` logic), so it returns `'blue'` regardless of `colorModes`. `'blue'` is the SWEET SPOT zone color (`WEEKLY_USAGE_ZONES.sweet.color`, story 10.1 — verified in `shared-constants.cjs`). No `getSampleValue()` special case was added.
- **config-loader (AC3):** No code change. Confirmed `ensureWidgetOrder()` (`src/tui/config-loader.js:51`) already appends any new registry ID via its `for (const id of allIds)` loop; behavior is covered by a new legacy-append test.
- **Tests (AC7):** Updated count/metadata assertions in the two `tui-*` test files (12→13, 5→6 dynamic widgets, added `bmad-weeklyusage` to the defaultColor map / dynamic-id list / `SAMPLE_VALUES` key list) and added 5 new tests (AC1 exact-fields, AC2 no-default-line, AC3 legacy-append via temp `internalConfig`, AC5 sample text, AC6 `'blue'` for both dynamic & fixed modes).
- **Necessary regression fix beyond the story's listed files:** adding the 13th registry ID also broke 4 `config-loader v2` tests whose fixtures hardcoded a 12-id `widgetOrder`. Appended `bmad-weeklyusage` to every `widgetOrder` in `test/fixtures/internal-config-default.json` (must equal `createDefaultConfig()`) and `test/fixtures/internal-config-multiline.json` (must equal the post-`ensureWidgetOrder` load). The story's Project-Structure note under-listed these fixtures; updating them is mandatory to honor the project's non-negotiable green-suite quality gate. `defaults.test.js` / `install.test.js` `12 event types` (hook event types) were left untouched, as instructed.

### File List

- `src/tui/widget-registry.js` — appended the 13th `INDIVIDUAL_WIDGETS` entry (`bmad-weeklyusage`).
- `src/tui/preview-utils.js` — added `SAMPLE_VALUES['bmad-weeklyusage']` + `resolvePreviewColor` self-coloring branch (`'blue'`).
- `test/tui-widget-registry.test.js` — count/metadata assertion updates + 3 new tests (AC1/AC2/AC3).
- `test/tui-preview-utils.test.js` — key-count/key-list updates + 2 new tests (AC5/AC6).
- `test/fixtures/internal-config-default.json` — appended `bmad-weeklyusage` to each line's `widgetOrder` (regression fix).
- `test/fixtures/internal-config-multiline.json` — appended `bmad-weeklyusage` to each line's `widgetOrder` (regression fix).

### Change Log

- 2026-06-10 — Story 10.3 implemented: registered `bmad-weeklyusage` as the 13th `INDIVIDUAL_WIDGETS` entry (`defaultEnabled: false`, `defaultMode: 'dynamic'`) and taught the configurator preview to sample/self-color it (`SAMPLE_VALUES` text + `resolvePreviewColor` returns `'blue'` regardless of mode). Purely additive TUI registry + preview; no reader/hook/installer/`config-loader.js` change. Updated the two `tui-*` test files (12→13 / 5→6 dynamic) and added 5 AC tests. Necessary fixture regression fix in `test/fixtures/internal-config-{default,multiline}.json` (12→13-id `widgetOrder`). Full suite green (712 pass / 0 fail).
</content>
</invoke>
