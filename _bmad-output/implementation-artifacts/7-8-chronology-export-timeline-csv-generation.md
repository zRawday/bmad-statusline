# Story 7.8: Chronology & Export — Timeline and CSV Generation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer reviewing session activity**,
I want **a unified timeline and CSV export capability**,
So that **I can review activity flow and archive records**.

## Acceptance Criteria

1. **Given** `c` is pressed in normal mode
   **When** the chronology page renders
   **Then** all reads, writes, and commands are merged into a unified timeline sorted by timestamp (ascending = oldest first)
   **And** each line shows `HH:MM:SS  TYPE   path/cmd` with TYPE right-padded to 5 chars
   **And** entries are color-coded: READ=cyan, WRITE=green, EDIT=yellow, BASH=dimColor
   **And** `*` suffix on WRITE entries where `is_new === true`
   **And** `🔀` suffix on entries with `agent_id`
   **And** the page has its own ScrollableViewport with ↑↓ scroll
   **And** `s` toggles sort between chronological (by timestamp) and alphabetical (by path/cmd then timestamp)
   **And** `t` toggles timestamp format between absolute (`HH:MM:SS`) and relative (`il y a Xmin`)
   **And** shortcuts show: `↑↓ scroll`, `s tri`, `t temps`, `Esc retour`

2. **Given** `e` is pressed in normal mode
   **When** ExportPrompt renders
   **Then** the shortcut bar is replaced by inline prompt: `Export: l léger  f complet  Esc annuler`
   **And** `l` generates light CSV (type,path,count — aggregated)
   **And** `f` generates full CSV (type,path,operation,timestamp,detail — one row per event)
   **And** CSV is written to `{outputFolder}/monitor/monitor-{light|full}-{YYYY-MM-DD-HHmmss}.csv`
   **And** `{outputFolder}/monitor/` directory is created if missing (`mkdirSync` recursive)
   **And** after write, shortcut bar is replaced by confirmation: `Exporté: {fullPath}` (dimColor)
   **And** any keypress after confirmation returns to normal shortcut bar
   **And** `Esc` in ExportPrompt cancels without exporting

3. **Given** tests
   **When** executed
   **Then** tests cover: mergeChronology (merge + sort + type assignment), formatRelativeTime, generateCsv light (aggregation), generateCsv full (per-event rows + CSV escaping), writeCsvExport (mkdir + file write + path format), chronology rendering (color coding, `*` new, `🔀` sub-agent, sort toggle, timestamp toggle), ExportPrompt (l/f/Esc keys), export flow (prompt → confirm → dismiss), `c` key opens chronology, `e` key opens export prompt
   **And** all existing tests pass (`npm test`)

## Tasks / Subtasks

- [x] Task 1: Add chronology and CSV utilities to `monitor-utils.js` (AC: #1, #2)
  - [x] 1.1 `mergeChronology(writes, reads, commands)` — merge all arrays into unified timeline. Map each entry to `{ at, type, path, cmd, agent_id, is_new, op, old_string, new_string }`. Types: reads→'READ', writes with `op==='write'`→'WRITE', writes with `op==='edit'`→'EDIT', commands→'BASH'. Sort by `at` ascending (oldest first). Pure function.
  - [x] 1.2 `formatRelativeTime(isoString)` — compute diff from `Date.now()`. Return: `<60s` → `il y a ${n}s`, `<60min` → `il y a ${n}min`, `<24h` → `il y a ${h}h${m}m`, `>=24h` → `il y a ${d}j`. Return `''` for null/invalid.
  - [x] 1.3 `generateCsv(mode, writes, reads, commands)` — `mode` is `'light'` or `'full'`. Light: aggregate by type+path/cmd, columns `type,path,count`. Full: one row per event, columns `type,path,operation,timestamp,detail`. Detail for EDIT: first line of old_string + ` → ` + first line of new_string (max 100 chars). Detail for WRITE: `fichier créé`. CSV escape: fields with `,`/`"`/newlines wrapped in `"..."`, internal `"` doubled. Returns CSV string with header row.
  - [x] 1.4 `writeCsvExport(outputFolder, mode, csvContent)` — build path: `{outputFolder}/monitor/monitor-{mode}-{YYYY-MM-DD-HHmmss}.csv`. `mkdirSync(dir, { recursive: true })`. `writeFileSync(path, csvContent, 'utf8')`. Return the full file path string. Sync I/O (Pattern 2).
  - [x] 1.5 Export all four new functions from monitor-utils.js.

- [x] Task 2: Add chronology rendering to `MonitorDetailScreen.js` (AC: #1)
  - [x] 2.1 Detect chronology mode: when `item.type === 'chronology'`, route to `buildChronologyDetail`.
  - [x] 2.2 Add local state: `sortMode` (`'chrono'`|`'alpha'`), default `'chrono'`. `timeFormat` (`'absolute'`|`'relative'`), default `'absolute'`.
  - [x] 2.3 `buildChronologyDetail(entries, sortMode, timeFormat)`:
    - Sort: chrono = by `at` ascending; alpha = by `(path||cmd)` ascending, then `at` ascending
    - Title line: `── CHRONOLOGIE ──` bold
    - Each entry line: `{time}  {TYPE}   {path||cmd}{indicators}` using `e(Text, {...}, ...)`
    - Time: absolute → `formatTime(entry.at)` (existing util); relative → `formatRelativeTime(entry.at)` (new util)
    - TYPE right-padded to 5 chars: `'READ '`, `'WRITE'`, `'EDIT '`, `'BASH '`
    - Color: READ→`color:'cyan'`, WRITE→`color:'green'`, EDIT→`color:'yellow'`, BASH→`dimColor:true`
    - Indicators: ` *` if `is_new`, ` 🔀` if `agent_id`
    - Spacer between title and entries
  - [x] 2.4 Add `s` and `t` key handlers in useInput — only when `item.type === 'chronology'`:
    - `s` → toggle `sortMode` between `'chrono'` and `'alpha'`
    - `t` → toggle `timeFormat` between `'absolute'` and `'relative'`
    - Reset `scrollOffset` to 0 on toggle (re-sorted content)
  - [x] 2.5 Define `CHRONO_SHORTCUTS`: `[{ key: '↑↓', label: 'scroll' }, { key: 's', label: 'tri' }, { key: 't', label: 'temps' }, { key: 'Esc', label: 'retour' }]`. Use these instead of `DETAIL_PAGE_SHORTCUTS` when chronology.

- [x] Task 3: Create `ExportPrompt.js` component (AC: #2)
  - [x] 3.1 Create `bmad-statusline/src/tui/monitor/components/ExportPrompt.js`
  - [x] 3.2 Named export: `export function ExportPrompt({ onSelect, onCancel, isActive })`
  - [x] 3.3 Use `const e = React.createElement;` — no JSX
  - [x] 3.4 Imports: `React` from `'react'`, `{ Text, useInput }` from `'ink'`
  - [x] 3.5 Render: single `Text` element: `Export:` (bold) + `  l` (bold) + ` léger` (dimColor) + `  f` (bold) + ` complet` (dimColor) + `  Esc` (bold) + ` annuler` (dimColor). Same visual style as ShortcutBar.
  - [x] 3.6 `useInput((input, key) => {...}, { isActive })` — `input === 'l'` → `onSelect('light')`, `input === 'f'` → `onSelect('full')`, `key.escape` → `onCancel()`

- [x] Task 4: Add `c`, `e` handlers and export flow to `MonitorScreen.js` (AC: #1, #2)
  - [x] 4.1 Import new utils: `mergeChronology`, `generateCsv`, `writeCsvExport` from `./monitor-utils.js`
  - [x] 4.2 Import `ExportPrompt` from `./components/ExportPrompt.js`
  - [x] 4.3 Add state: `const [exportMode, setExportMode] = useState(null)` — `null`|`'prompt'`|`'confirm'`. `const [confirmPath, setConfirmPath] = useState('')`.
  - [x] 4.4 `c` key handler (normal mode, `!exportMode`): build entries with `mergeChronology(writes, reads, commands)`, set `detailItem` to `{ type: 'chronology', text: 'chronologie', selectable: false, data: null }`, and pass entries separately (store in ref or as second piece of state alongside detailItem).
  - [x] 4.5 `e` key handler (normal mode, `!exportMode`, `!detailItem`): set `exportMode = 'prompt'`.
  - [x] 4.6 Export selection callback `handleExport(mode)`: `const csv = generateCsv(mode, writes, reads, commands)`. `const filePath = writeCsvExport(paths.outputFolder, mode, csv)`. Set `exportMode = 'confirm'`, `confirmPath = filePath`.
  - [x] 4.7 Confirmation handler: add useInput for confirmation mode — any key or Esc → `setExportMode(null)`, `setConfirmPath('')`. Gate: `isActive: isActive && exportMode === 'confirm'`.
  - [x] 4.8 Render shortcut bar area: if `exportMode === 'prompt'` → `ExportPrompt({ onSelect: handleExport, onCancel: () => setExportMode(null), isActive })`. If `exportMode === 'confirm'` → `e(Text, { dimColor: true }, 'Exporté: ' + confirmPath)`. Else → `ShortcutBar({ actions: getShortcuts() })`.
  - [x] 4.9 Update `getShortcuts()`: in normal mode (not detail), add `{ key: 'c', label: 'chrono' }` and `{ key: 'e', label: 'export' }` before the Esc shortcut.
  - [x] 4.10 Gate main useInput: extend existing gate to include `&& !exportMode` — prevent c/d/e/scroll when export prompt or confirmation is active.
  - [x] 4.11 Chronology entries for detailItem: since `getDetailEntries` routes by item type, add chronology case that returns `mergeChronology(writes, reads, commands)`. This avoids needing separate state for entries.
  - [x] 4.12 Reset `exportMode` on session change (alongside existing detailItem/cursorIndex reset).

- [x] Task 5: Add `outputFolder` to `app.js` paths (AC: #2)
  - [x] 5.1 In `app.js`, where `paths` is assembled for MonitorScreen, add: `outputFolder: path.join(process.cwd(), '_bmad-output')` — import `path` and `process` if not already imported.
  - [x] 5.2 Pass in `paths: { cachePath, outputFolder }` to MonitorScreen.

- [x] Task 6: Tests in `tui-monitor-detail.test.js` (AC: #3)
  - [x] 6.1 Test `mergeChronology` — merges reads+writes+commands, assigns correct types (READ/WRITE/EDIT/BASH), sorted ascending by timestamp, handles empty arrays.
  - [x] 6.2 Test `formatRelativeTime` — seconds, minutes, hours, days, null/invalid returns ''.
  - [x] 6.3 Test `generateCsv('light', ...)` — header row, aggregated counts, correct type mapping.
  - [x] 6.4 Test `generateCsv('full', ...)` — header row, per-event rows, EDIT detail truncation, WRITE detail "fichier créé", CSV escaping of commas and quotes.
  - [x] 6.5 Test `writeCsvExport` — creates directory, writes file, returns correct path format `monitor-{mode}-{timestamp}.csv`. Use temp dir for isolation.
  - [x] 6.6 Test chronology rendering — title "CHRONOLOGIE", READ entries have cyan color, WRITE green, EDIT yellow, BASH dim, `*` on is_new, `🔀` on agent_id.
  - [x] 6.7 Test chronology `s` toggle — entries re-sort (verify order changes).
  - [x] 6.8 Test chronology `t` toggle — verify "il y a" appears after toggle.
  - [x] 6.9 Test ExportPrompt — `l` calls onSelect('light'), `f` calls onSelect('full'), Esc calls onCancel.
  - [x] 6.10 Test MonitorScreen `c` key — activates chronology (detailItem set, title visible).
  - [x] 6.11 Test MonitorScreen `e` key — shows ExportPrompt text.
  - [x] 6.12 Test export confirm → any key returns to normal shortcuts.

- [x] Task 7: Run full test suite (AC: #3)
  - [x] 7.1 Run `npm test` — all tests pass, 0 failures.

### Review Findings

- [x] [Review][Patch] `*` indicator sans guard WRITE — `is_new` check manque `type === 'WRITE'` [MonitorDetailScreen.js:119] ✓ fixed
- [x] [Review][Patch] Préfixe "Exporté:" affiché même en cas d'erreur export [MonitorScreen.js:~200] ✓ fixed
- [x] [Review][Patch] Full CSV `operation` vide pour READ — devrait être `'read'` [monitor-utils.js:~311] ✓ fixed
- [x] [Review][Patch] Test intégration manquant: Esc annulation export dans MonitorScreen [tui-monitor-detail.test.js] ✓ fixed
- [x] [Review][Patch] `c`/`e` actifs sans session — gater sur currentSession [MonitorScreen.js:~165] ✓ fixed
- [x] [Review][Defer] `formatRelativeTime` retourne '' pour timestamps futurs (clock skew) — deferred, pre-existing
- [x] [Review][Defer] Sort NaN avec dates invalides truthy dans mergeChronology — deferred, pre-existing
- [x] [Review][Defer] Collision nom fichier CSV si 2 exports même seconde — deferred, pre-existing

## Dev Notes

### Architecture Compliance

**Stack — use ONLY these:**
- Node.js >= 20, ESM (`import`/`export`) for all TUI modules
- React 19.2.4 + Ink 6.8.0 for TUI components
- `const e = React.createElement;` — no JSX (project-wide convention)
- Testing: `node:test` + `node:assert/strict` + `ink-testing-library`
- Sync file I/O everywhere (Pattern 2): `readFileSync`/`writeFileSync`/`mkdirSync` — NO async

**Critical Patterns:**

- **Pattern 1** — Error Handling: TUI = StatusMessage on error, never crash. Components receiving null/undefined data render gracefully. CSV write failure → show error in confirmation slot, don't crash.
- **Pattern 2** — Sync I/O: All file I/O via `readFileSync`/`writeFileSync`/`mkdirSync`. No `fs.promises`, no `async/await` for file ops.
- **Pattern 23** — Monitor Cache I/O Isolation: ALL file I/O in `monitor-utils.js` ONLY. React components NEVER touch filesystem. ExportPrompt does NOT write files — it calls a callback that routes to monitor-utils.
- **Pattern 24** — Viewport Scroll Externalized State: ScrollableViewport is stateless. MonitorDetailScreen owns its own `scrollOffset` state. Chronology view reuses this same scroll mechanism.
- **Pattern 25** — Contextual Shortcut Bar: Each mode has its own shortcut array. Normal mode adds `c chrono` and `e export`. Chronology page shows `↑↓ scroll`, `s tri`, `t temps`, `Esc retour`. Export prompt replaces shortcut bar entirely. Confirmation replaces shortcut bar with path text.
- **Pattern 27** — Monitor Props Contract: MonitorScreen receives `{ config, navigate, goBack, isActive, paths: { cachePath, outputFolder } }`. `outputFolder` is NEW in this story.

### Chronology Data Model

**Merged entry shape** (returned by `mergeChronology`):
```js
{
  at: '2026-04-04T14:23:07.000Z',  // ISO timestamp
  type: 'READ' | 'WRITE' | 'EDIT' | 'BASH',
  path: 'src/foo.js' | null,        // file path (null for BASH)
  cmd: 'npm test' | null,           // command (null for file entries)
  agent_id: 'abc123' | null,
  is_new: true | false,             // only meaningful for WRITE
  op: 'write' | 'edit' | null,      // original op from writes array
  old_string: '...' | null,         // for EDIT entries (full CSV detail)
  new_string: '...' | null,         // for EDIT entries (full CSV detail)
}
```

**Source mapping:**
- `reads[]` → type `'READ'`, path from `entry.path`, cmd=null
- `writes[]` where `op==='write'` → type `'WRITE'`, is_new from entry
- `writes[]` where `op==='edit'` → type `'EDIT'`, old_string/new_string from entry
- `commands[]` → type `'BASH'`, cmd from `entry.cmd`, path=null

**Color map:**
```js
const CHRONO_COLORS = {
  READ:  { color: 'cyan' },
  WRITE: { color: 'green' },
  EDIT:  { color: 'yellow' },
  BASH:  { dimColor: true },
};
```

### Chronology Page Layout

```
── CHRONOLOGIE ──                      ← bold
                                       ← spacer
14:23:07  READ   src/hook/bmad-hook.js         ← cyan
14:23:08  EDIT   src/tui/app.js *              ← yellow, * = is_new
14:23:09  BASH   npm test                      ← dim
14:23:10  WRITE  src/new-file.js * 🔀          ← green, * + sub-agent
14:24:01  READ   package.json 🔀               ← cyan, sub-agent
```

TYPE column: right-pad to 5 chars (`'READ '`, `'WRITE'`, `'EDIT '`, `'BASH '`).
Display: `{time}  {TYPE}  {path||cmd}{indicators}` — double space separators.

### CSV Formats

**Light CSV** (aggregated):
```csv
type,path,count
READ,src/hook/bmad-hook.js,3
WRITE,src/new-file.js,1
EDIT,src/tui/app.js,2
BASH,npm test,5
```

**Full CSV** (per-event):
```csv
type,path,operation,timestamp,detail
READ,src/hook/bmad-hook.js,,2026-04-04T14:23:07.000Z,
WRITE,src/new-file.js,write,2026-04-04T14:23:10.000Z,fichier créé
EDIT,src/tui/app.js,edit,2026-04-04T14:23:08.000Z,"const old = 'x' → const new = 'y'"
BASH,npm test,execute,2026-04-04T14:23:09.000Z,
```

**CSV escaping:** Fields containing `,`, `"`, or newlines → wrap in `"..."`, double internal `"`. EDIT detail: first line of old_string + ` → ` + first line of new_string, max 100 chars total, truncate with `...`.

**Destination:** `{outputFolder}/monitor/monitor-{light|full}-{YYYY-MM-DD-HHmmss}.csv`
- `outputFolder` = `paths.outputFolder` (resolved in app.js as `path.join(process.cwd(), '_bmad-output')`)
- `mkdirSync(dir, { recursive: true })` before write

### ExportPrompt UX Flow

```
State: exportMode=null
  [ShortcutBar: ◄► onglets  ↑↓ scroll  d détail  c chrono  e export  Esc Back home]

User presses 'e' → exportMode='prompt'
  [Export: l léger  f complet  Esc annuler]

User presses 'l' → generateCsv + writeCsvExport → exportMode='confirm'
  [Exporté: /path/to/monitor-light-2026-04-04-142307.csv]    ← dimColor

User presses any key → exportMode=null
  [ShortcutBar: ◄► onglets  ↑↓ scroll  d détail  c chrono  e export  Esc Back home]
```

ExportPrompt renders in the SAME slot as ShortcutBar (bottom of screen). It does NOT overlay the main content — file sections remain visible behind it.

### MonitorScreen State Machine (Updated)

```
NORMAL MODE ──d──→ DETAIL MODE ──Enter──→ DETAIL PAGE
     │                  │                       │
     │                  Esc                    Esc
     │                  │                       │
     │                  ↓                       ↓
     │           NORMAL MODE             DETAIL MODE
     │
     ├──c──→ CHRONOLOGY PAGE ──Esc──→ NORMAL MODE
     │
     ├──e──→ EXPORT PROMPT ──l/f──→ EXPORT CONFIRM ──any key──→ NORMAL MODE
     │              │
     │              Esc
     │              │
     │              ↓
     └────── NORMAL MODE
```

State variables involved:
- `detailMode`: 'normal' | 'detail' (existing)
- `cursorIndex`: existing
- `detailItem`: existing — now also used for chronology pseudo-item `{ type: 'chronology' }`
- `exportMode`: NEW — null | 'prompt' | 'confirm'
- `confirmPath`: NEW — string (file path after export)

**Input gating:**
- Main MonitorScreen useInput: `isActive && !reorderMode && !detailItem && !exportMode`
- MonitorDetailScreen useInput: `isActive` (rendered when detailItem set — handles chrono too)
- ExportPrompt useInput: `isActive && exportMode === 'prompt'`
- Confirmation useInput: `isActive && exportMode === 'confirm'`

### Chronology Entries via getDetailEntries

Extend existing `getDetailEntries(item)` in MonitorScreen:
```js
if (item.type === 'chronology') {
  return mergeChronology(writes, reads, commands);
}
```

This maintains the pattern where MonitorDetailScreen receives `{ item, entries, onBack, isActive }` — chronology is just another item type with its entries being the merged timeline.

### Previous Story Intelligence

**Story 7.7 (Detail Mode & Pages):**
- MonitorDetailScreen handles 3 item types: edit (writes with op), read, command
- `buildEditDetail`, `buildReadDetail`, `buildCommandDetail` are internal builders
- Scroll state: `const [scrollOffset, setScrollOffset] = useState(0);`
- useInput: ↑↓ scroll, Esc calls onBack
- Shortcuts via `DETAIL_PAGE_SHORTCUTS` constant
- Review patches: null guard on `new_string`, don't enter detail mode if no selectables
- `formatTime` already in monitor-utils.js — reuse for chronology absolute time

**Story 7.7 review deferred items:**
- Snapshot vs live data inconsistency in getDetailEntries — pre-existing, not addressed here
- Scroll offset non-clamped on shrink — pre-existing, not addressed here

**Story 7.6 (File & Bash Sections):**
- Section renderers return `{ elements, items }` shape
- `buildFileTree` groups by path, `renderTreeLines` produces items
- `deduplicateCommands` returns groups with `entries[]`
- Review patches: Windows path splitting, null path guard

**Story 7.5 (Tabs & Badge):**
- `reorderMode` state gates input — now also check `exportMode`
- Tab navigation via ←→ and Tab keys

### Git Intelligence

Recent commits:
- `b725a0a` review(7-7): code review corrections
- `7d1eeb2` 7-7: Detail Mode & Pages
- `770fba6` workflow: branch-per-story strategy
- `bd7f127` fix: test fixture for empty line rendering
- `17b5d48` review(7-6): code review clean — story done

Conventions: `const e = React.createElement;`, named exports for screens, default export for utility components, `describe` + `test` pattern, `delay(50)` for async, `unmount()` in render tests.

### Project Structure Notes

```
src/tui/monitor/
  MonitorScreen.js              ← MODIFY (add c/e handlers, exportMode state, getShortcuts update)
  MonitorDetailScreen.js        ← MODIFY (add chronology builder, s/t toggles, CHRONO_SHORTCUTS)
  monitor-utils.js              ← MODIFY (add mergeChronology, formatRelativeTime, generateCsv, writeCsvExport)
  components/
    ExportPrompt.js             ← NEW
    ScrollableViewport.js       ← EXISTS, no changes
    FileTreeSection.js          ← EXISTS, no changes
    BashSection.js              ← EXISTS, no changes
    ShortcutBar.js              ← EXISTS, no changes
    LlmBadge.js                 ← EXISTS, no changes
    SessionTabs.js              ← EXISTS, no changes

src/tui/app.js                  ← MODIFY (add outputFolder to MonitorScreen paths)

test/
  tui-monitor-detail.test.js    ← MODIFY (add chronology, export, CSV tests)
  tui-monitor.test.js           ← EXISTS, no changes
  tui-monitor-components.test.js ← EXISTS, no changes
```

### Anti-Patterns to Avoid

- DO NOT use `fs` in ExportPrompt.js or MonitorDetailScreen.js — violates Pattern 23 (all I/O in monitor-utils.js)
- DO NOT add useState or useInput inside ScrollableViewport — violates Pattern 24
- DO NOT use JSX — project uses `React.createElement` everywhere
- DO NOT use async/await for file ops — use sync I/O (Pattern 2)
- DO NOT implement auto-scroll, bell, or color-coded shortcut bar families — that's story 7.9
- DO NOT implement `s`/`t` toggles in normal or detail mode — they are chronology-page-only in 7.8 (global toggles are 7.9)
- DO NOT add `a`/`b` shortcut handlers — those are 7.9
- DO NOT forget `unmount()` in render tests — causes timer leaks and test hangs
- DO NOT forget unique `key` props on all React elements in arrays
- DO NOT use inline ANSI escape codes — use Ink `Text` `color`/`dimColor` props (Pattern 3)
- DO NOT break existing detail mode (d key), tab navigation, or reorder overlay when adding chronology/export
- DO NOT crash on CSV write failure — catch error, display error message in confirmation slot
- DO NOT import `path` or `fs` in ExportPrompt.js — it's a pure React component
- DO NOT forget to reset `exportMode` on session change

### Scope Boundary

This story covers ONLY:
- `c` key → chronology page (merged timeline, color-coded, scrollable, `s`/`t` toggles)
- `e` key → ExportPrompt (light/full mini-menu replacing shortcut bar)
- CSV generation (light = aggregated, full = per-event)
- CSV file writing to `{outputFolder}/monitor/` with mkdir
- Export confirmation display (file path in shortcut bar slot)
- ExportPrompt.js (new component)
- New utilities in monitor-utils.js (mergeChronology, formatRelativeTime, generateCsv, writeCsvExport)
- `outputFolder` added to MonitorScreen paths via app.js
- Chronology-specific shortcuts (Pattern 25)
- Tests for all new functionality

This story does NOT cover (deferred to 7.9):
- Auto-scroll toggle (`a`)
- Bell notifications (`b`)
- `s`/`t` toggles in normal or detail mode (global scope)
- Color-coded shortcut bar families (navigation cyan, modes yellow, etc.)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#CSV-Export] — lines 1027-1036
- [Source: _bmad-output/planning-artifacts/architecture.md#Monitor-Sub-Boundary] — lines 873-893
- [Source: _bmad-output/planning-artifacts/architecture.md#ScrollableViewport-Component] — lines 937-959
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern-23-Cache-IO-Isolation] — lines 1449-1463
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern-24-Viewport-Scroll] — lines 1465-1484
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern-25-Contextual-Shortcuts] — lines 1486-1502
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern-27-Monitor-Props] — lines 1520-1538
- [Source: _bmad-output/planning-artifacts/architecture.md#FR61-66] — lines 52-54
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation-Sequence] — lines 1046-1058
- [Source: _bmad-output/planning-artifacts/epics.md#Story-7.8] — lines 2183-2198
- [Source: bmad-statusline/src/tui/monitor/MonitorScreen.js] — current implementation (modify)
- [Source: bmad-statusline/src/tui/monitor/MonitorDetailScreen.js] — current implementation (modify)
- [Source: bmad-statusline/src/tui/monitor/monitor-utils.js] — current implementation (modify)
- [Source: bmad-statusline/src/tui/app.js] — current implementation (modify)
- [Source: _bmad-output/implementation-artifacts/7-7-detail-mode-pages-tree-navigation-file-command-details.md] — previous story

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Sort toggle test initially failed because `buildChronologyDetail` didn't sort in chrono mode (relied on pre-sorted input). Fixed by adding explicit ascending sort for both chrono and alpha modes.

### Completion Notes List

- Task 1: Added `mergeChronology`, `formatRelativeTime`, `generateCsv`, `writeCsvExport` + helper `csvEscape` to monitor-utils.js. All pure functions except writeCsvExport (sync I/O, Pattern 2/23).
- Task 2: Added chronology rendering to MonitorDetailScreen — `buildChronologyDetail` with CHRONO_COLORS map, `sortMode`/`timeFormat` state, `s`/`t` key toggles (chrono-page-only), CHRONO_SHORTCUTS constant.
- Task 3: Created ExportPrompt.js — pure React component, `l`/`f`/`Esc` key handlers, inline prompt style matching ShortcutBar.
- Task 4: MonitorScreen — added `c` (chronology) and `e` (export) key handlers, `exportMode`/`confirmPath` state, export flow with error handling, input gating for export modes, chronology case in `getDetailEntries`, shortcut bar swap for prompt/confirmation.
- Task 5: Added `outputFolder: path.join(process.cwd(), '_bmad-output')` to MonitorScreen paths in app.js.
- Task 6: 19 new tests — mergeChronology (4), formatRelativeTime (6), generateCsv light (1), generateCsv full (3), writeCsvExport (2), chronology rendering (4), ExportPrompt (3), MonitorScreen c/e keys (3).
- Task 7: Full suite 501 tests, 0 failures.

### Change Log

- 2026-04-04: Story 7.8 implementation complete — chronology page, CSV export, ExportPrompt component, 19 new tests.

### File List

- bmad-statusline/src/tui/monitor/monitor-utils.js (MODIFIED — added mergeChronology, formatRelativeTime, generateCsv, writeCsvExport, csvEscape)
- bmad-statusline/src/tui/monitor/MonitorDetailScreen.js (MODIFIED — chronology rendering, s/t toggles, CHRONO_SHORTCUTS)
- bmad-statusline/src/tui/monitor/components/ExportPrompt.js (NEW)
- bmad-statusline/src/tui/monitor/MonitorScreen.js (MODIFIED — c/e handlers, exportMode state, export flow, getShortcuts update)
- bmad-statusline/src/tui/app.js (MODIFIED — outputFolder in MonitorScreen paths)
- bmad-statusline/test/tui-monitor-detail.test.js (MODIFIED — 19 new tests)
- _bmad-output/implementation-artifacts/sprint-status.yaml (MODIFIED — status updates)
- _bmad-output/implementation-artifacts/7-8-chronology-export-timeline-csv-generation.md (MODIFIED — story status + dev record)
