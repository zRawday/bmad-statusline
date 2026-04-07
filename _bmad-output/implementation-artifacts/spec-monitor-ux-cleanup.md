---
title: 'Monitor UX Cleanup — badges, spacing, toggles, highlights, i18n'
type: 'feature'
created: '2026-04-05'
status: 'done'
baseline_commit: 'c7694dc'
context:
  - '_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The monitor page has accumulated UX debt: section spacers render no visible gap, LLM emoticon badges are inconsistent and their background blends with tabs on scroll, auto-scroll/bell add clutter without value, a dedicated toggle-state line wastes vertical space, sort/time shortcuts are irrelevant on the main page, the most recent operation in each section isn't distinguished, directory tree bars incorrectly inherit grey from directory names, and ~30 French strings remain untranslated.

**Approach:** Single cleanup pass across the monitor feature: fix spacers, replace emoticons with large colored circles + restore background separation, remove auto-scroll/bell entirely, merge remaining toggle state into the shortcut bar as inline checkboxes, hide sort/time from main page only, highlight the latest entry per section (bold + subtle color), split tree rendering for independent dir-name coloring, and translate all French strings to English.

## Boundaries & Constraints

**Always:** Keep sortMode/timeFormat state and logic intact — only hide their shortcuts from the main monitor shortcut bar (they remain in detail/chrono views). Preserve ShortcutBar backward-compatibility (checkbox is opt-in via new `checked` property).

**Ask First:** If any change would affect components outside `src/tui/monitor/` and `src/tui/components/ShortcutBar.js`.

**Never:** Change hook data structures, monitor-utils polling/parsing logic, or session data format. Never remove sortMode/timeFormat state variables or their wiring to MonitorDetailScreen.

</frozen-after-approval>

## Code Map

- `src/tui/monitor/MonitorScreen.js` -- main layout, states, key bindings, toggle line, shortcuts
- `src/tui/monitor/components/LlmBadge.js` -- emoticon badges, background color
- `src/tui/monitor/components/FileTreeSection.js` -- tree rendering, dir coloring, latest highlight
- `src/tui/monitor/components/BashSection.js` -- command section, latest highlight
- `src/tui/monitor/components/ScrollableViewport.js` -- French scroll indicators
- `src/tui/monitor/MonitorDetailScreen.js` -- detail/chrono page, French labels, sort/time shortcuts
- `src/tui/monitor/components/ExportPrompt.js` -- French export labels
- `src/tui/components/ShortcutBar.js` -- shared shortcut bar, needs checkbox support
- `src/tui/monitor/monitor-utils.js` -- renderTreeLines builds dir items (prefix + name bundled)

## Tasks & Acceptance

**Execution:**
- [x] `src/tui/components/ShortcutBar.js` -- add opt-in `checked` (boolean|undefined) on actions: when defined, prepend `[x] ` or `[ ] ` before the key
- [x] `src/tui/monitor/components/LlmBadge.js` -- replace all emoticons with `\u2B24` (large circle). Colors: active=green, permission=yellow, waiting=blueBright, inactive=grey. Add extra space after circle. Ensure backgroundColor on active/permission/waiting (not just active/permission). Translate labels: ACTIF→ACTIVE, PERMISSION stays, EN ATTENTE→WAITING, INACTIF→INACTIVE
- [x] `src/tui/monitor/monitor-utils.js` -- in `renderTreeLines`, split dir items into `{ treePrefix, dirName }` fields so FileTreeSection can color them independently
- [x] `src/tui/monitor/components/FileTreeSection.js` -- (1) render dir items: tree chars default color, dir name only dimColor. (2) After building items, mark the selectable item with latest `data.at` as `isLatest: true`. (3) Render latest items bold + subtle color (cyan). Translate section labels: FICHIERS MODIFIES→EDITED FILES, FICHIERS LUS→READ FILES
- [x] `src/tui/monitor/components/BashSection.js` -- mark latest command group (by `lastAt`) as `isLatest`. Render it bold + subtle color. Translate COMMANDES→COMMANDS
- [x] `src/tui/monitor/components/ScrollableViewport.js` -- translate: "X de plus" → "X more"
- [x] `src/tui/monitor/components/ExportPrompt.js` -- translate: leger→light, complet→full, annuler→cancel
- [x] `src/tui/monitor/MonitorDetailScreen.js` -- translate all French: retour→back, naviguer→navigate, ouvrir→open, DETAIL FICHIER EDITE→FILE DETAIL EDITED, DETAIL FICHIER LU→FILE DETAIL READ, DETAIL COMMANDE→COMMAND DETAIL, CHRONOLOGIE→CHRONOLOGY, fichier cree→file created, tri→sort, temps→time
- [x] `src/tui/monitor/MonitorScreen.js` -- (1) remove `autoScroll`/`bellEnabled` states + both useEffects (auto-scroll on poll, bell on transition). (2) Remove `prevLlmState` ref. (3) Remove 'a'/'b' key bindings in both normal and detail mode. (4) Delete toggle indicator line. (5) Adjust `footerRows` 3→2. (6) Split shortcuts: main page toggles = only `f` with `checked: showSubAgents`; detail mode toggles = `f`+`s`+`t` with checked states. (7) Fix spacer empty text `''` → `' '` for visible blank lines. (8) Translate all French to English. (9) Remove s/t key bindings from normal mode.

**Acceptance Criteria:**
- Given the monitor page with multiple sections, when displayed, then visible blank lines separate each section
- Given any LLM state, when the badge renders, then it shows ⬤ with correct color, extra space, and visible backgroundColor for active/permission/waiting
- Given the main monitor page, when viewing shortcuts, then 'a','b','s','t' are absent; 'f' shows with [x]/[ ] checkbox
- Given detail/chrono view, when viewing shortcuts, then 'f','s','t' show with checkboxes reflecting current state
- Given a file section, when rendered, then the entry with the most recent timestamp is bold + colored
- Given a command section, when rendered, then the command group with latest execution is bold + colored
- Given a directory in the tree, when rendered, then tree bars (├── │ └──) are default white; only the dir name is grey
- Given any monitor screen text, when displayed, then all strings are in English

## Spec Change Log


## Suggested Review Order

**Shortcut bar checkbox**

- Opt-in `checked` property renders `[x] ` / `[ ] ` prefix before key
  [`ShortcutBar.js:13`](../../bmad-statusline/src/tui/components/ShortcutBar.js#L13)

**LLM badge overhaul**

- Large circle `⬤`, 4 state colors, backgroundColor on active/permission/waiting
  [`LlmBadge.js:9`](../../bmad-statusline/src/tui/monitor/components/LlmBadge.js#L9)

**Main layout — removals, spacing, shortcuts, i18n**

- Entry point: removed auto-scroll/bell states, toggle line, rewired getShortcuts with checkbox state
  [`MonitorScreen.js:29`](../../bmad-statusline/src/tui/monitor/MonitorScreen.js#L29)

- Spacer text `' '` for visible section gaps
  [`MonitorScreen.js:138`](../../bmad-statusline/src/tui/monitor/MonitorScreen.js#L138)

- footerRows 3→2, all French labels translated
  [`MonitorScreen.js:154`](../../bmad-statusline/src/tui/monitor/MonitorScreen.js#L154)

**Tree rendering — split dir coloring**

- Dir items emit `treePrefix` + `dirName` for independent styling
  [`monitor-utils.js:187`](../../bmad-statusline/src/tui/monitor/monitor-utils.js#L187)

- Render: tree chars default color, dir name dimColor only
  [`FileTreeSection.js:52`](../../bmad-statusline/src/tui/monitor/components/FileTreeSection.js#L52)

**Latest entry highlighting**

- Files: mark most recent by `data.at`, render bold+cyan
  [`FileTreeSection.js:33`](../../bmad-statusline/src/tui/monitor/components/FileTreeSection.js#L33)

- Commands: mark latest by `lastAt`, render bold+cyan
  [`BashSection.js:20`](../../bmad-statusline/src/tui/monitor/components/BashSection.js#L20)

**i18n — remaining components**

- Detail screen titles and labels FR→EN
  [`MonitorDetailScreen.js:13`](../../bmad-statusline/src/tui/monitor/MonitorDetailScreen.js#L13)

- `formatRelativeTime` — `il y a` → `ago`, `maintenant` → `now`
  [`monitor-utils.js:295`](../../bmad-statusline/src/tui/monitor/monitor-utils.js#L295)

- Scroll indicators, export prompt FR→EN
  [`ScrollableViewport.js:16`](../../bmad-statusline/src/tui/monitor/components/ScrollableViewport.js#L16)
  [`ExportPrompt.js:19`](../../bmad-statusline/src/tui/monitor/components/ExportPrompt.js#L19)
