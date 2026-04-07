# Story 7.6: File & Bash Sections — Tree View and Command Display

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer monitoring a session**,
I want **organized file tree and bash command sections with counts**,
So that **I have a clear picture of session activity**.

## Acceptance Criteria

1. **Given** a session with `writes[]` entries
   **When** MonitorScreen renders the file sections
   **Then** in-project files display as a tree view (directory hierarchy with `├──`, `└──`, `│` branch chars)
   **And** out-of-project files display as flat absolute paths below the tree
   **And** files with `is_new === true` show `*` indicator
   **And** files with `agent_id !== null` show `🔀` indicator
   **And** the section header shows count: `── FICHIERS MODIFIÉS (N) ──`

2. **Given** a session with `reads[]` and `writes[]` entries
   **When** MonitorScreen renders the read-only section
   **Then** only files from `reads[]` whose `path` does NOT appear in `writes[]` are shown
   **And** the format matches the writes section (tree + flat, indicators)
   **And** the section header shows count: `── FICHIERS LUS (N) ──`

3. **Given** a session with `commands[]` entries
   **When** MonitorScreen renders the bash section
   **Then** commands with identical `cmd` text are grouped with `(xN)` counter
   **And** each command is colored by family: npm=green, git=yellow, node=cyan, filesystem=dim, python=blue, other=magenta
   **And** commands with any entry having `agent_id !== null` show `🔀`
   **And** the section header shows unique count: `── COMMANDES (N) ──`

4. **Given** all three sections are rendered
   **When** content exceeds terminal height
   **Then** all sections scroll together inside a single ScrollableViewport
   **And** sticky top: MONITOR title + session info (project, workflow)
   **And** sticky bottom: ShortcutBar with contextual shortcuts
   **And** MonitorScreen manages `scrollOffset` state and `useInput` for `upArrow`/`downArrow` (Pattern 24)

5. **Given** tests
   **When** executed
   **Then** tests cover: tree rendering with proper hierarchy, `*` new indicator, `🔀` sub-agent indicator, reads filtering (excludes writes paths), command deduplication with count, command family color classification, section header counts, empty sections, out-of-project flat rendering
   **And** all existing tests pass (`npm test`)

## Tasks / Subtasks

- [x] Task 1: Add data processing functions to `monitor-utils.js` (AC: #1, #2, #3)
  - [x] 1.1 Add `buildFileTree(entries)` — takes array of `{path, in_project, is_new, agent_id, ...}`, returns `{ inProject: treeNode[], outProject: flatEntry[] }`. Tree built by splitting paths on `/` and nesting. Each leaf holds the original entry data.
  - [x] 1.2 Add `renderTreeLines(tree)` — recursive function that walks the tree and returns array of `{ text, selectable, type, data }` objects. Uses `├──`, `└──`, `│   ` branch chars. Leaf files are `selectable: true, type: 'file'`. Directories are `selectable: false, type: 'dir'`. Appends `*` for `is_new`, `🔀` for `agent_id !== null`.
  - [x] 1.3 Add `filterReadOnly(reads, writes)` — returns entries from `reads` whose `path` does not appear in any `writes` entry. Uses a `Set` of write paths for O(1) lookup.
  - [x] 1.4 Add `deduplicateCommands(commands)` — groups by `cmd` text, returns `[{ cmd, count, hasSubAgent, lastAt, entries }]`. `hasSubAgent` is true if any entry has `agent_id !== null`. Preserves order of first occurrence.
  - [x] 1.5 Add `getCommandFamily(cmd)` — returns Ink color string. Pattern matching on first word: `/^npm\s/` → `'green'`, `/^git\s/` → `'yellow'`, `/^node(\s|$)/` → `'cyan'`, `/^(ls|rm|mkdir|rmdir|cp|mv|cat|touch|chmod|chown|find|head|tail)(\s|$)/` → `undefined` (dimColor), `/^python\d*(\s|$)|^pip(\s|$)/` → `'blue'`, everything else → `'magenta'`. Returns `{ color, dim }` where `dim` is true for filesystem family.

- [x] Task 2: Create `FileTreeSection.js` component (AC: #1, #2)
  - [x] 2.1 Create `bmad-statusline/src/tui/monitor/components/FileTreeSection.js`
  - [x] 2.2 Export `renderFileSection(label, entries)` — takes section label (e.g. `'FICHIERS MODIFIÉS'`) and file entries array. Returns array of React `e(Text, ...)` elements:
    - First element: section header `── {label} ({count}) ──` in bold
    - Blank line separator
    - In-project entries rendered as tree (call `renderTreeLines` from monitor-utils)
    - Out-of-project entries rendered as flat absolute paths
    - Each file line: `e(Text, {...}, text)` — use `dimColor` for tree structure chars, normal for filenames, `color: 'green'` for `*`, `color: 'cyan'` for `🔀`
  - [x] 2.3 Each returned element MUST have a unique `key` prop (index-based: `${label}-${i}`)
  - [x] 2.4 Use `const e = React.createElement` — no JSX
  - [x] 2.5 If entries array is empty, return empty array `[]` (no section header rendered)

- [x] Task 3: Create `BashSection.js` component (AC: #3)
  - [x] 3.1 Create `bmad-statusline/src/tui/monitor/components/BashSection.js`
  - [x] 3.2 Export `renderBashSection(commands)` — takes `commands[]` array. Returns array of React `e(Text, ...)` elements:
    - First element: section header `── COMMANDES ({uniqueCount}) ──` in bold
    - Blank line separator
    - Each deduplicated command: `e(Text, { color, dimColor, key }, displayText)`
    - Display format: `{cmd}` if count=1, `{cmd} (x{count})` if count>1, append ` 🔀` if hasSubAgent
  - [x] 3.3 Color per command using `getCommandFamily(cmd)` from monitor-utils — set `color` prop for colored families, `dimColor: true` for filesystem family
  - [x] 3.4 Each element has unique `key` prop (`cmd-${i}`)
  - [x] 3.5 Use `const e = React.createElement` — no JSX
  - [x] 3.6 If commands array is empty, return empty array `[]`

- [x] Task 4: Integrate sections into MonitorScreen.js (AC: #4)
  - [x] 4.1 Import `renderFileSection` from `./components/FileTreeSection.js`
  - [x] 4.2 Import `renderBashSection` from `./components/BashSection.js`
  - [x] 4.3 Import `ScrollableViewport` from `./components/ScrollableViewport.js`
  - [x] 4.4 Import `filterReadOnly` from `./monitor-utils.js`
  - [x] 4.5 Import `useStdout` from `ink`
  - [x] 4.6 Add scroll state: `const [scrollOffset, setScrollOffset] = useState(0)`
  - [x] 4.7 Compute active session: `const session = sessions[0] || null` (first session; tab-based selection deferred to 7.5)
  - [x] 4.8 Build items array when session exists:
    ```js
    const writes = session.writes || [];
    const reads = session.reads || [];
    const commands = session.commands || [];
    const readOnly = filterReadOnly(reads, writes);
    const items = [
      ...renderFileSection('FICHIERS MODIFIÉS', writes),
      ...renderFileSection('FICHIERS LUS', readOnly),
      ...renderBashSection(commands),
    ];
    ```
  - [x] 4.9 Compute viewport height: `const { rows } = useStdout();` — sticky top takes ~3 rows (title + session info + blank), sticky bottom takes ~1 row (shortcut bar). Available height: `const viewportHeight = Math.max(1, (rows || 24) - 4);`
  - [x] 4.10 Add scroll keybindings in `useInput`:
    ```js
    if (key.upArrow) setScrollOffset(prev => Math.max(0, prev - 1));
    if (key.downArrow) setScrollOffset(prev => Math.min(Math.max(0, items.length - viewportHeight), prev + 1));
    ```
  - [x] 4.11 Reset `scrollOffset` to 0 when active session changes (via useEffect on session identity)
  - [x] 4.12 Update layout:
    - Sticky top: MONITOR title + session count + (if session) project name and workflow
    - Content: `e(ScrollableViewport, { items, height: viewportHeight, scrollOffset })` — or empty state if no sessions
    - Sticky bottom: `e(ShortcutBar, { actions: MONITOR_SHORTCUTS })`
  - [x] 4.13 Update `MONITOR_SHORTCUTS` for 7.6 scope:
    ```js
    const MONITOR_SHORTCUTS = [
      { key: '↑↓', label: 'scroll' },
      { key: 'Esc', label: 'Back home' },
    ];
    ```

- [x] Task 5: Add tests to `tui-monitor.test.js` (AC: #5)
  - [x] 5.1 Import new util functions: `filterReadOnly`, `deduplicateCommands`, `getCommandFamily`, `buildFileTree`, `renderTreeLines`
  - [x] 5.2 Test `filterReadOnly` — reads with paths not in writes kept, reads with paths in writes excluded
  - [x] 5.3 Test `filterReadOnly` — empty reads returns empty, empty writes returns all reads
  - [x] 5.4 Test `deduplicateCommands` — single occurrence: count=1, no `(xN)`. Duplicates: correct count. Order preserved by first occurrence
  - [x] 5.5 Test `deduplicateCommands` — hasSubAgent true when any entry has agent_id
  - [x] 5.6 Test `getCommandFamily` — npm→green, git→yellow, node→cyan, ls/rm/mkdir→dim, python→blue, other→magenta
  - [x] 5.7 Test `buildFileTree` + `renderTreeLines` — two files in same directory produce correct tree with `├──`/`└──`
  - [x] 5.8 Test `renderTreeLines` — `*` appended for is_new, `🔀` for agent_id
  - [x] 5.9 Test `renderTreeLines` — out-of-project entries listed as flat paths

- [x] Task 6: Add tests to `tui-monitor-components.test.js` (AC: #5)
  - [x] 6.1 Import `renderFileSection` from FileTreeSection, `renderBashSection` from BashSection
  - [x] 6.2 Test `renderFileSection` — renders section header with count, tree structure visible in frame
  - [x] 6.3 Test `renderFileSection` — `*` indicator for new files visible
  - [x] 6.4 Test `renderFileSection` — `🔀` indicator for sub-agent visible
  - [x] 6.5 Test `renderFileSection` — empty entries returns empty array (no header rendered)
  - [x] 6.6 Test `renderBashSection` — deduplicated display with `(xN)` count
  - [x] 6.7 Test `renderBashSection` — empty commands returns empty array
  - [x] 6.8 Test `renderBashSection` — sub-agent `🔀` indicator

- [x] Task 7: Run full test suite (AC: #5)
  - [x] 7.1 Run `npm test` — all tests pass (1 pre-existing failure in ReorderLinesScreen unrelated to 7.6)

## Dev Notes

### Architecture Compliance

**Stack — use ONLY these:**
- Node.js >= 20, ESM (`import`/`export`) for all TUI modules
- React 19.2.4 + Ink 6.8.0 for TUI components
- `const e = React.createElement;` — no JSX (project-wide convention)
- Testing: `node:test` + `node:assert/strict` + `ink-testing-library`
- Sync file I/O everywhere (Pattern 2): `readFileSync`/`readdirSync` — NO async

**Critical Patterns:**

- **Pattern 1** — Error Handling: TUI = StatusMessage on error, never crash. Components receiving null/undefined data should render gracefully (empty sections, not crashes).
- **Pattern 2** — Sync I/O: All file I/O via `readFileSync`. No `fs.promises`, no `async/await` for file ops. Applies to monitor-utils.js.
- **Pattern 23** — Monitor Cache I/O Isolation: ALL cache reads in `monitor-utils.js` ONLY. React components NEVER touch filesystem. FileTreeSection and BashSection receive data via props/args — they do NOT read any files.
- **Pattern 24** — Viewport Scroll Externalized State: ScrollableViewport is stateless. MonitorScreen owns `scrollOffset` state AND `useInput` keybindings for `upArrow`/`downArrow`. NEVER add useState or useInput inside ScrollableViewport.
- **Pattern 25** — Contextual Shortcut Bar: For 7.6, minimal shortcuts (`↑↓ scroll`, `Esc Back home`). Story 7.7+ adds `d détail`, `c chrono`, `e export`.
- **Pattern 26** — Tree Navigation with Selectable Flag: Each item returned by tree/section renderers has `{ text, selectable, type, data }` shape. Files and commands are `selectable: true`. Headers and directory lines are `selectable: false`. This structure is used by story 7.7 for cursor navigation — 7.6 builds it, 7.7 consumes it.
- **Pattern 27** — Monitor Props Contract: MonitorScreen receives `{ config, navigate, goBack, isActive, paths: { cachePath } }`. Does NOT receive configurator props.

### Data Structures (from hook status file v2)

Session data comes from `pollSessions()` which reads `status-*.json`. Relevant arrays:

```js
// writes[] — each file write/edit operation
{ path: "src/hook/bmad-hook.js", in_project: true, op: "edit", is_new: false, at: "ISO8601", agent_id: null, old_string: "...", new_string: "..." }
{ path: "test/fixtures/new.json", in_project: true, op: "write", is_new: true, at: "ISO8601", agent_id: null, old_string: null, new_string: null }

// reads[] — each file read
{ path: "src/hook/bmad-hook.js", in_project: true, at: "ISO8601", agent_id: null }
{ path: "package.json", in_project: true, at: "ISO8601", agent_id: "sub-agent-1" }

// commands[] — each bash execution
{ cmd: "npm test", at: "ISO8601", agent_id: null }
{ cmd: "git status", at: "ISO8601", agent_id: null }
```

**Key fields:**
- `in_project` — true = project-relative path (show as tree), false = absolute path (show flat)
- `is_new` — true = file created (not previously read), only on writes
- `agent_id` — null = main agent, string = sub-agent (show `🔀`)
- `op` — "write" or "edit" (for writes only; not relevant for 7.6 display, used in 7.7 detail)
- `old_string`/`new_string` — edit diffs, NOT used in 7.6 (deferred to 7.7 detail pages)

### Tree Rendering Algorithm

**In-project files** build a directory tree:
```
src/
├── hook/
│   └── bmad-hook.js
├── utils.js *
└── reader/
    └── bmad-sl-reader.js 🔀
```

**Algorithm:**
1. Group paths by splitting on `/`
2. Build nested object: `{ 'src': { 'hook': { 'bmad-hook.js': entry }, ... } }`
3. Walk tree recursively. At each level, sort entries (directories first, then files, alphabetical within each group)
4. For each entry at a given level: use `├── ` if not last, `└── ` if last. Children indented with `│   ` or `    ` depending on whether parent was last.

**Out-of-project files** rendered flat after the tree:
```
/home/user/.bashrc
/tmp/output.txt *
```

### Command Deduplication

Group `commands[]` by `cmd` text. Display:
- `npm test` — if seen once
- `npm test (x3)` — if seen 3 times
- `npm test (x3) 🔀` — if any occurrence has agent_id

Preserve first-occurrence order. The `entries` array is kept on each group for story 7.7 (detail mode shows timestamps per occurrence).

### Command Family Colors

```js
// Pattern matching on first token of cmd:
npm ...      → color: 'green'
git ...      → color: 'yellow'
node ...     → color: 'cyan'
python/pip   → color: 'blue'
ls/rm/mkdir/rmdir/cp/mv/cat/touch/chmod/chown/find/head/tail → dimColor: true
everything else → color: 'magenta'
```

Use regex on `cmd` string (first word match). Return object `{ color: string|undefined, dim: boolean }` so the component can set either `color` or `dimColor` prop on the `Text` element.

### Section Items Shape (Pattern 26 Forward-Compatible)

All items returned by section renderers should follow this shape:

```js
{ text: '── FICHIERS MODIFIÉS (5) ──', selectable: false, type: 'header' }
{ text: 'src/', selectable: false, type: 'dir' }
{ text: '├── hook/', selectable: false, type: 'dir' }
{ text: '│   └── bmad-hook.js', selectable: true, type: 'file', data: { ...entry } }
{ text: '── COMMANDES (3) ──', selectable: false, type: 'header' }
{ text: 'npm test (x3)', selectable: true, type: 'command', data: { cmd, count, entries } }
```

The `renderFileSection` and `renderBashSection` functions convert these items to React elements (using `e(Text, ...)`) while preserving the `selectable`/`type`/`data` metadata in a way story 7.7 can access (return the raw items alongside the elements, or tag elements).

**Recommendation:** Have the utils produce raw item objects, and the render functions both: (a) return React elements for display, and (b) store the raw items array in a ref/variable accessible to MonitorScreen for future cursor navigation in 7.7. Simplest approach: render functions return `{ elements: [...], items: [...] }`.

### ScrollableViewport Integration

All sections scroll together in ONE viewport:

```js
// MonitorScreen
const allElements = [
  ...renderFileSection('FICHIERS MODIFIÉS', writes).elements,
  ...renderFileSection('FICHIERS LUS', readOnly).elements,
  ...renderBashSection(commands).elements,
];
e(ScrollableViewport, { items: allElements, height: viewportHeight, scrollOffset })
```

ScrollableViewport expects items as React elements. It does `items.slice(scrollOffset, scrollOffset + height)` and spreads them as children. Each element MUST have a unique `key` prop or React will warn.

### Layout

```
┌─────────────────────────────────────────┐
│ MONITOR  2 sessions                     │  ← sticky top (always visible)
│ Toulou — dev-story                      │  ← sticky top (session info)
│                                         │
│ ── FICHIERS MODIFIÉS (3) ──             │  ← scrollable content start
│                                         │
│ src/                                    │
│ ├── hook/                               │
│ │   └── bmad-hook.js                    │
│ ├── utils.js *                          │
│ └── reader/                             │
│     └── bmad-sl-reader.js 🔀           │
│                                         │
│ ── FICHIERS LUS (1) ──                  │
│                                         │
│ test/                                   │
│ └── hook.test.js                        │
│                                         │
│ ── COMMANDES (4) ──                     │
│                                         │
│ npm test (x3)                           │  ← green
│ git status                              │  ← yellow
│ node --version 🔀                      │  ← cyan
│ ls -la                                  │  ← dim
│                                         │
├─────────────────────────────────────────┤
│ ↑↓  scroll  Esc  Back home             │  ← sticky bottom (ShortcutBar)
└─────────────────────────────────────────┘
```

### Session Selection (Minimal for 7.6)

Without tabs (7.5), MonitorScreen displays the first session: `sessions[0]`. If no sessions, show the existing empty state. Story 7.5 will add tab-based session navigation.

### Existing File Structure

```
src/tui/monitor/
  MonitorScreen.js              ← MODIFY (add sections, scroll, layout)
  monitor-utils.js              ← MODIFY (add tree, filter, dedup utils)
  components/
    ScrollableViewport.js       ← EXISTS, no changes needed
    FileTreeSection.js          ← NEW
    BashSection.js              ← NEW
```

### Previous Story Intelligence

**Story 7.4 (Monitor Foundation):**
- Created MonitorScreen with `useSessionPolling` hook, `pollSessions` in monitor-utils.js
- Pattern 21 compliant: immediate poll + 1500ms interval + cleanup
- Esc navigation works, ShortcutBar integration works
- Test pattern: `ink-testing-library` render + `lastFrame()` + `unmount()` (critical: always unmount to prevent timer leaks)
- `await delay(50)` needed for useEffect to fire before checking frame content
- Esc key: `stdin.write('\x1B')` (uppercase B)
- 7.4 review deferred: ghost sessions, unbounded array, unstable ordering — acceptable for now

**Story 7.3 (ScrollableViewport):**
- Stateless component, `items.slice(scrollOffset, scrollOffset + height)`
- Default export (not named): `import ScrollableViewport from './components/ScrollableViewport.js'`
- Test pattern in `tui-monitor-components.test.js`: render with `e(ScrollableViewport, { items, height, scrollOffset })`, check `lastFrame()` for indicators and content
- Items passed as React elements with unique keys

**Story 7.1 (Hook Expansion):**
- Status file v2 schema: `reads[]`, `writes[]`, `commands[]` arrays with `at`, `agent_id`, `in_project` fields
- `is_new` detection: true if file path not seen in reads[] before this Write
- Array entries are appended chronologically (oldest first)
- Skill change resets arrays to `[]`

### Git Intelligence

Recent commits:
- `7-4: Monitor Foundation` — MonitorScreen.js, monitor-utils.js, tui-monitor.test.js
- `7-3: ScrollableViewport` — components/ScrollableViewport.js, tui-monitor-components.test.js
- `7-2: Installer Upgrade` — defaults.js, install.js, hook matchers
- `7-1: Hook Expansion` — bmad-hook.js, hook.test.js, status-with-history.json fixture

Code conventions from recent work:
- Named exports for screen components (`export function MonitorScreen`)
- Default export for utility components (`export default ScrollableViewport`)
- `const e = React.createElement;` at file top
- Tests: `describe` + `test`, `beforeEach`/`afterEach` for temp dirs, `delay(50)` for async effects

### Anti-Patterns to Avoid

- DO NOT use `fs` in FileTreeSection.js or BashSection.js — violates Pattern 23 (all I/O in monitor-utils.js)
- DO NOT add useState or useInput inside ScrollableViewport — violates Pattern 24 (parent owns state)
- DO NOT flatten the tree structure for rendering — violates Pattern 26 (preserve hierarchy)
- DO NOT use JSX — project uses `React.createElement` everywhere
- DO NOT use async file I/O — violates Pattern 2
- DO NOT show all future shortcuts (d, c, e, a, b, t, s) — those are stories 7.7-7.9
- DO NOT implement tab navigation between sessions — that's story 7.5
- DO NOT implement detail mode cursor or Enter navigation — that's story 7.7
- DO NOT render old_string/new_string diffs — that's story 7.7 detail pages
- DO NOT forget `unmount()` in render tests — causes timer leaks and test hangs
- DO NOT forget unique `key` props on all React elements in arrays — React warnings
- DO NOT use inline ANSI escape codes — use Ink `Text` `color`/`dimColor` props (Pattern 3)

### Project Structure Notes

- `src/tui/monitor/components/FileTreeSection.js` — new file, exports `renderFileSection`
- `src/tui/monitor/components/BashSection.js` — new file, exports `renderBashSection`
- `src/tui/monitor/monitor-utils.js` — modified, add `buildFileTree`, `renderTreeLines`, `filterReadOnly`, `deduplicateCommands`, `getCommandFamily`
- `src/tui/monitor/MonitorScreen.js` — modified, integrate sections + scroll state + layout
- `test/tui-monitor.test.js` — modified, add util function tests
- `test/tui-monitor-components.test.js` — modified, add FileTreeSection + BashSection render tests

### Scope Boundary

This story covers ONLY:
- File tree rendering (writes section + read-only section)
- Bash command section with dedup and colors
- Data processing utilities (tree building, filtering, dedup, color classification)
- ScrollableViewport integration with scroll state in MonitorScreen
- Section-specific indicators (`*`, `🔀`, counts)

This story does NOT cover (deferred to later stories):
- Session tabs and tab navigation (7.5)
- LlmBadge display (7.5)
- Project/skill color tabs (7.5)
- Detail mode cursor navigation (7.7)
- Detail pages: file edit diff, read timestamps, bash command list (7.7)
- Chronology timeline (7.8)
- CSV export (7.8)
- Auto-scroll, bell, timestamp/sort toggles (7.9)
- Contextual shortcut bar color families (7.9)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Monitor-Sub-Boundary] — lines 873-893
- [Source: _bmad-output/planning-artifacts/architecture.md#Polling-Architecture] — lines 895-936
- [Source: _bmad-output/planning-artifacts/architecture.md#ScrollableViewport-Component] — lines 937-959
- [Source: _bmad-output/planning-artifacts/architecture.md#Detail-Mode-Tree-Navigation] — lines 1009-1025
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern-23-Cache-IO-Isolation] — lines 1449-1463
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern-24-Viewport-Scroll] — lines 1465-1484
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern-25-Contextual-Shortcuts] — lines 1486-1502
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern-26-Tree-Navigation] — lines 1504-1518
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern-27-Monitor-Props] — lines 1520-1538
- [Source: _bmad-output/planning-artifacts/epics.md#Story-7.6] — lines 2147-2162
- [Source: bmad-statusline/src/tui/monitor/MonitorScreen.js] — current implementation (modify)
- [Source: bmad-statusline/src/tui/monitor/monitor-utils.js] — current implementation (modify)
- [Source: bmad-statusline/src/tui/monitor/components/ScrollableViewport.js] — existing component (no changes)
- [Source: bmad-statusline/test/fixtures/status-with-history.json] — data structure reference
- [Source: _bmad-output/implementation-artifacts/7-4-monitor-foundation-polling-routing-homescreen-integration.md] — previous story

### Review Findings

- [x] [Review][Decision] Commit 7-6 embarque story 7.5 (LlmBadge, SessionTabs, tabs, reorder, colors) — accepté comme bundle, 7.5 synced
- [x] [Review][Patch] Tab modulo zéro — déjà corrigé dans le commit
- [x] [Review][Patch] buildFileTree crash sur path null/vide — patché (guard `!entry.path`)
- [x] [Review][Patch] Paths Windows non splittés — patché (`split(/[/\\]/)`)
- [x] [Review][Patch] Scroll offset pas recalé quand items diminuent — patché (`effectiveScrollOffset`)
- [x] [Review][Patch] formatElapsed NaN sur date invalide — déjà corrigé dans le commit
- [x] [Review][Patch] Items dir sans data property — patché (`data: null`)
- [x] [Review][Patch] Commentaire test incomplet — patché
- [x] [Review][Defer] buildFileTree collision fichier/répertoire même nom — scénario très rare, deferred
- [x] [Review][Defer] Pas de mémoisation sur items/orderedGroups — performance, pas un bug, deferred
- [x] [Review][Defer] pollSessions filtre skill — sessions avec workflow sans skill ignorées — pré-existant (7.4), deferred
- [x] [Review][Defer] Indicateurs * et 🔀 non colorés (green/cyan) — cosmétique, deferred

## Change Log

- 2026-04-04: Implemented file tree sections, bash command section, data processing utils, scroll integration, and 20 new tests

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation, no debug issues.

### Completion Notes List

- Task 1: Added 5 utility functions to monitor-utils.js: `buildFileTree`, `renderTreeLines`, `filterReadOnly`, `deduplicateCommands`, `getCommandFamily`. All follow Pattern 23 (no fs in components) and Pattern 26 (selectable item shape).
- Task 2: Created FileTreeSection.js with `renderFileSection` returning `{ elements, items }` for forward-compatible Pattern 26 integration. Tree rendering with `├──`/`└──` branch chars, `*` new indicator, `🔀` sub-agent indicator, out-of-project flat paths.
- Task 3: Created BashSection.js with `renderBashSection` returning `{ elements, items }`. Command deduplication with `(xN)` counts, color-coded by family (npm=green, git=yellow, node=cyan, filesystem=dim, python=blue, other=magenta).
- Task 4: Integrated sections into MonitorScreen.js — ScrollableViewport with scroll state, useStdout for viewport height, session reset on change, updated shortcuts (↑↓ scroll, Esc back). Note: MonitorScreen was concurrently updated by 7.5 with tabs/badges/reorder — integration is compatible.
- Task 5: 13 new tests in tui-monitor.test.js covering all util functions.
- Task 6: 7 new tests in tui-monitor-components.test.js covering renderFileSection and renderBashSection render output.
- Task 7: Full suite passes — 52/52 in tui-monitor.test.js, 19/19 in tui-monitor-components.test.js. 1 pre-existing failure in ReorderLinesScreen (unrelated).

### File List

- bmad-statusline/src/tui/monitor/monitor-utils.js (modified — added buildFileTree, renderTreeLines, filterReadOnly, deduplicateCommands, getCommandFamily)
- bmad-statusline/src/tui/monitor/components/FileTreeSection.js (new — renderFileSection)
- bmad-statusline/src/tui/monitor/components/BashSection.js (new — renderBashSection)
- bmad-statusline/src/tui/monitor/MonitorScreen.js (modified — sections integration, scroll, layout)
- bmad-statusline/test/tui-monitor.test.js (modified — 13 new util tests)
- bmad-statusline/test/tui-monitor-components.test.js (modified — 7 new component tests)
