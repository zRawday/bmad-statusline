---
title: 'Merge Story and Document widgets into one Current Item widget; Monitor labels a session by its active skill'
type: 'feature'
created: '2026-10-13'
status: 'ready-for-dev'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Story widget (`bmad-story`) and the Document widget (`bmad-docname`) never show a value at the same time (the hook sets a story only in story workflows, a document or AutoBlend job only outside them), yet they take two slots to configure. Separately, the Monitor lists a session whose skill was launched by the model (active skill, nothing typed) under a bare session id with no skill color.

**Approach:** Replace both widgets with one "Current Item" widget (`bmad-currentitem`) that shows the story in create-story / dev-story / code-review, otherwise the AutoBlend job or document name. Convert every saved configuration (lines, order, colors, presets) to the new widget with nothing lost. In the Monitor, fall back to the active skill as the session name when no skill was typed.

## Boundaries & Constraints

**Always:**
- A saved config renders the same content in the same position after conversion; the story color and the document/job color both survive (the merged widget keeps one color per kind), and so does the story display mode.
- A default install looks identical before and after (story magenta, document/job brightYellow).
- Conversion is idempotent and one rule serves every consumer (reader, TUI loader).
- The deployed reader must render a not-yet-converted `config.json` correctly: it converts in memory and never writes the file.
- The typed skill stays the Monitor name whenever one exists (Initial Skill and Active Skill are distinct by design).
- LF line endings in every touched file.

**Never:**
- No change to the hook or to the status-file schema (`story`, `document_name`, `active_skill` stay as they are).
- No version bump, no publish.
- Do not run the real CLI/TUI/installer against the home directory during work or tests — always `BMAD_CONFIG_DIR` / `BMAD_CACHE_DIR` temp dirs (a run would convert the developer's real config).
- Do not normalize `test/tui-app.test.js` line endings (deferred on purpose).

## I/O & Edge-Case Matrix

`S` = `bmad-story`, `D` = `bmad-docname`, `N` = `bmad-currentitem`.

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Both visible | line `widgets: [a, S, D, b]`, `S: {fixed, red, displayMode: compact}`, `D: {fixed, blue}` | `widgets: [a, N, b]`; `N: {mode: fixed, fixedColor: red, documentColor: blue, displayMode: compact}`; `S`/`D` keys gone | N/A |
| Only one visible | `widgets` holds only `S` (or only `D`) | `N` visible at that position; the missing color falls back to its default (magenta / brightYellow), or to the hidden widget's saved colorMode when one exists | N/A |
| Neither visible | only colorModes and widgetOrder mention them | `N` hidden; colors carried over | N/A |
| Order | `widgetOrder: [D, x, S]` | `[N, x]` — first of the two wins the slot | N/A |
| Presets | preset line `widgets` / `widgetOrder` contain `S` / `D` | same replacement rule | `null` slot or malformed preset skipped, never throws |
| Already converted | config already uses `N` | unchanged, reports "no change" | N/A |
| TUI load of old config | valid `config.json` with old ids | converted, original copied to `config.json.bak`, converted file written at once | backup/write failure is silent; in-memory config still converted |
| Reader, old config on disk | line lists `S` and/or `D` | renders the merged widget once; file untouched | N/A |
| Story workflow | `workflow: dev-story`, `story: 4-2-auth-login` | `4-2 Auth Login` in story color (`4-2` when compact) | no story yet → widget omitted, even if a stale `document_name` exists |
| Other workflow / job mode | `document_name: prd.md` or job id `zouzou` | value verbatim in document color | empty → widget omitted |
| Monitor, model-launched skill | `workflow: null, skill: null, active_skill: autoblend-builder` | tab and badge read `autoblend-builder`, tab uses that skill's color | no skill at all → 8-char session id as today |
| Monitor, typed skill | `workflow: dev-story, active_skill: code-review` | name stays `dev-story` | N/A |

</frozen-after-approval>

## Code Map

- `src/reader/shared-constants.cjs` -- shared CJS module, deployed with the reader and bridged to ESM by `src/defaults.js`. Home for the new shared pieces: widget id constant, default document color, `resolveCurrentItem(status)` → `{ kind: 'story' | 'document', value }` or null (rule = the one in `MonitorScreen.js:434-438`), and `migrateLegacyWidgets(config)` (mutates lines + presets, returns whether anything changed). `STORY_WORKFLOWS`, `formatStoryName` already here.
- `src/defaults.js:93-112` -- ESM bridge; re-export the new symbols.
- `src/reader/bmad-sl-reader.js` -- `COMMANDS` (382-383: `story`, `docname` → replace with `currentitem`); `readConfig` 261 (convert in memory here); `handleLineCommand` 317-342 applies `fixedColor` generically — the merged widget needs `documentColor` when the item is a document/job. Standalone mode has no colorModes: plain text.
- `src/tui/widget-registry.js:10-11, 33-60` -- registry entries and `createDefaultConfig`; the merged entry takes Story's slot (12 widgets). Default colorMode must carry `documentColor`.
- `src/tui/config-loader.js:26-28` -- valid-v2 path; convert before `ensureWidgetOrder` (which would otherwise prune the old ids from `widgetOrder` and append the new one last, losing the position). Today a valid config is never written on load.
- `src/tui/screens/EditLineScreen.js` -- `bmad-story` special cases at 158, 167, 204, 228 (mode toggle `m`); color cycle 187-194 rebuilds the colorMode and keeps only `displayMode` (would drop `documentColor`); `h` show path 146-150 creates a default colorMode.
- `src/tui/preview-utils.js:14-15, 34` -- sample values and compact sample.
- `src/tui/monitor/monitor-utils.js:154-159` -- `sessionLabel`; `SessionTabs.js:31-34` derives label and color from it (no change needed there).
- `src/tui/monitor/MonitorScreen.js:432-438` -- badge `workflow` and `contextLabel`.
- `README.md:20, 63, 105` and `_bmad-output/project-context.md` (~630-690: config example, widget table, default layout) -- widget count and list.
- Tests naming the old ids: `test/reader.test.js` (150-152, 193-317), `test/tui-widget-registry.test.js` (count 13 at 15-17, 137-138, 160, 185, 218; ids at 61-62, 110, 121-123, 194-195), `test/tui-preview-utils.test.js` (14-27), `test/tui-edit-line.test.js` (181, 210), `test/tui-preset.test.js` (14, 214-215), `test/tui-config-writer.test.js` (189, 313), `test/tui-widget-order.test.js` (17), `test/tui-monitor.test.js` (403-416), fixtures `test/fixtures/internal-config-default.json`, `internal-config-multiline.json`.
- Do not touch: `src/hook/bmad-hook.js`, `src/install.js`, `src/deploy.js`, `PresetLoadScreen.js` / `PresetSaveScreen.js` (presets hold only `widgets` + `widgetOrder`, converted by the loader).

## Tasks & Acceptance

**Execution:**
- [ ] `src/reader/shared-constants.cjs`, `src/defaults.js` -- add the id constant, default document color, `resolveCurrentItem`, `migrateLegacyWidgets`; bridge them -- one rule for reader, loader and Monitor.
- [ ] `src/reader/bmad-sl-reader.js` -- `currentitem` command replacing `story` and `docname`; in-memory conversion of the config read; per-kind color in the line path -- merged rendering, old configs keep working.
- [ ] `src/tui/widget-registry.js` -- single `Current Item` entry (hint: `Story, AutoBlend job, or document`), default colorMode with `documentColor` -- registry is the source of every id list.
- [ ] `src/tui/config-loader.js` -- convert on load before `ensureWidgetOrder`; when changed, back up the original to `config.json.bak` then write -- persisted conversion with a way back.
- [ ] `src/tui/screens/EditLineScreen.js`, `src/tui/preview-utils.js` -- move the mode toggle to the merged widget; color cycle and every default-colorMode site keep `documentColor`; new key `d` cycles the document/job color (visible widget only, shown in the shortcut bar for that row); the row shows both color names, each in its own color; preview samples for the new id -- both colors stay editable.
- [ ] `src/tui/monitor/monitor-utils.js`, `src/tui/monitor/MonitorScreen.js` -- `sessionLabel`: workflow, then skill, then `active_skill`, then short id; badge name follows the same order (without the id); `contextLabel` through `resolveCurrentItem` -- active-skill naming, one item rule.
- [ ] `test/` -- update the tests and fixtures listed in the Code Map to the new id and count (keep one legacy-shaped fixture or inline config for conversion tests); add unit tests for every matrix row: conversion (lines, presets, idempotence, malformed input), loader persistence + backup, reader rendering and color per kind, reader with an unconverted config, `d` key and color-cycle preservation, `sessionLabel` and its color.
- [ ] `README.md`, `_bmad-output/project-context.md` -- 12 widgets, merged widget described (story / AutoBlend job / document, one color each, `m` and `d` keys), Monitor naming by active skill -- docs match behavior.

**Acceptance Criteria:**
- Given a config saved by v1.8.0 with any combination of the two widgets on any line or preset, when the TUI loads it, then each line and preset shows the merged widget where the first of the two stood, with both colors and the story mode preserved, and `config.json.bak` holds the pre-conversion file.
- Given a fresh install, when the status line renders in a story workflow and then in a document workflow, then the output is byte-identical to v1.8.0's default layout output for the same status.
- Given the merged widget selected in Edit Line, when the user cycles the story color with ←/→, then the document color and display mode are unchanged, and `d` changes only the document color.
- Given no old id remains in `src/`, when searching for `bmad-story` or `bmad-docname`, then the only hits are in the conversion function and its tests.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Design Notes

Colors are kept per kind rather than collapsed to one: the request demands a lossless color conversion, a default install stays visually identical, and the color tells story from document at a glance. Stored shape, extending the existing colorMode object:

```json
"bmad-currentitem": { "mode": "fixed", "fixedColor": "magenta", "documentColor": "brightYellow", "displayMode": "compact" }
```

The job shares the document color, as it did in the Document widget. Conversion is per line: a user who had Story and Document on two different lines gets the merged widget on both (accepted; hiding one is a keystroke). The reader converts in memory because the deployed reader is refreshed by entry points (`install`, `doctor`, TUI self-heal) that do not all rewrite `config.json`; the loader is the only writer. A config converted by this version is not understood by an older reader (the widget disappears) — `config.json.bak` is the way back.

## Verification

**Commands:**
- `npm test` -- expected: all suites pass, 0 failures.
- `git grep -n "bmad-story\|bmad-docname" -- src` -- expected: hits only in `src/reader/shared-constants.cjs` (conversion).
- `git ls-files --eol src test README.md | grep -v "i/lf" | grep -v "tui-app.test.js"` -- expected: no output for touched files.
