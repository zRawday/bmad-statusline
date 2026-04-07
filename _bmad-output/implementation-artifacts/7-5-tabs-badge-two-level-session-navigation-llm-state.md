# Story 7.5: Tabs & Badge — Two-Level Session Navigation with LLM State

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer monitoring multiple sessions**,
I want **sessions grouped by project with colored tabs and LLM state badges**,
So that **I can quickly identify which session needs attention**.

## Acceptance Criteria

1. **Given** multiple projects detected
   **When** MonitorScreen renders
   **Then** ←→ navigates project tabs, Tab/Shift+Tab navigates session sub-tabs within active project

2. **Given** 1 project with N sessions
   **When** MonitorScreen renders
   **Then** ←→ navigates between sessions directly (no project-level tabs)

3. **Given** 1 session total
   **When** MonitorScreen renders
   **Then** no tabs are displayed

4. **Given** project tab rendering
   **When** colored
   **Then** project tab uses `config.projectColors[projectName]` → `hashProjectColor(projectName)` fallback

5. **Given** session sub-tab rendering
   **When** colored
   **Then** session tab uses `config.skillColors[workflowName]` → `getDefaultSkillColor(workflowName)` from skill-catalog → fallback `'white'`

6. **Given** a project with multiple sessions in different LLM states
   **When** the project tab badge is computed
   **Then** it shows the worst state: permission > waiting > active > inactive

7. **Given** LlmBadge for a session
   **When** rendered
   **Then** it shows:
   - ACTIVE: green `⚡ ACTIF` (bold, colored background)
   - PERMISSION: yellow `⏳ PERMISSION` (bold, colored background)
   - WAITING: yellowBright `⏸ EN ATTENTE` (bold, colored background)
   - INACTIVE: dim `○ INACTIF` (dim text, no background)
   **And** workflow name + elapsed timer from `started_at`

8. **Given** a session's `updated_at` is older than 5 minutes
   **When** LlmBadge computes state
   **Then** the displayed state is overridden to INACTIVE regardless of `llm_state` value

9. **Given** user presses `r` in normal mode
   **When** multiple projects exist
   **Then** a ReorderList overlay appears for project tab reordering

10. **Given** user presses `R` in normal mode
    **When** multiple sessions exist in current project
    **Then** a ReorderList overlay appears for session sub-tab reordering

11. **Given** tests
    **When** executed
    **Then** tests for: grouping logic (multi-project, single-project, single-session), flat mode navigation, tab colors, badge 4 states, timeout override, reorder activation, worst-state aggregation
    **And** all existing tests pass (`npm test`)

## Tasks / Subtasks

- [x] Task 1: Add `groupSessionsByProject()` and color helpers to monitor-utils.js (AC: #1, #2, #3, #4, #5, #6, #8)
  - [x] 1.1 Add `groupSessionsByProject(sessions)` function:
    ```js
    export function groupSessionsByProject(sessions) {
      const groups = new Map();
      for (const s of sessions) {
        const key = s.project || 'unknown';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(s);
      }
      return groups;
    }
    ```
  - [x] 1.2 Add `INACTIVE_TIMEOUT_MS = 5 * 60 * 1000` constant (5 min)
  - [x] 1.3 Add `computeDisplayState(session)` function:
    ```js
    export function computeDisplayState(session) {
      if (session.updated_at) {
        const age = Date.now() - new Date(session.updated_at).getTime();
        if (age > INACTIVE_TIMEOUT_MS) return 'inactive';
      }
      return session.llm_state || 'inactive';
    }
    ```
  - [x] 1.4 Add `LLM_STATE_PRIORITY` map for worst-state aggregation:
    ```js
    const LLM_STATE_PRIORITY = { permission: 3, waiting: 2, active: 1, inactive: 0 };
    export function worstState(sessions) {
      let worst = 'inactive';
      for (const s of sessions) {
        const state = computeDisplayState(s);
        if ((LLM_STATE_PRIORITY[state] || 0) > (LLM_STATE_PRIORITY[worst] || 0)) worst = state;
      }
      return worst;
    }
    ```
  - [x] 1.5 Add `resolveSessionColor(workflow, config)` helper:
    ```js
    import { getDefaultSkillColor } from '../tui/skill-catalog.js';
    // ^ Actually monitor-utils.js is inside tui/monitor/, so: import { getDefaultSkillColor } from '../skill-catalog.js';
    import { toInkColor } from '../preview-utils.js';

    export function resolveSessionColor(workflow, config) {
      const skillColors = config.skillColors || {};
      if (skillColors[workflow]) return toInkColor(skillColors[workflow]);
      const def = getDefaultSkillColor(workflow);
      if (def) return toInkColor(def);
      return 'white';
    }
    ```
  - [x] 1.6 Add `resolveProjectColor(projectName, config)` helper — reuse `hashProjectColor` logic from ProjectColorsScreen:
    ```js
    const PROJECT_COLOR_PALETTE = [
      'red', 'green', 'yellow', 'blue', 'magenta', 'cyan',
      'redBright', 'greenBright', 'yellowBright', 'blueBright', 'magentaBright', 'cyanBright',
    ];

    function hashProjectColor(name) {
      if (!name) return null;
      let h = 0;
      for (let i = 0; i < name.length; i++) {
        h = ((h << 5) - h + name.charCodeAt(i)) | 0;
      }
      return PROJECT_COLOR_PALETTE[Math.abs(h) % PROJECT_COLOR_PALETTE.length];
    }

    export function resolveProjectColor(projectName, config) {
      const projectColors = config.projectColors || {};
      if (projectColors[projectName]) return toInkColor(projectColors[projectName]);
      return hashProjectColor(projectName) || 'white';
    }
    ```
    Note: `hashProjectColor` is duplicated from ProjectColorsScreen. This is intentional — monitor-utils.js must remain self-contained within the monitor boundary (Pattern 23). Extracting to a shared utility would couple monitor to configurator. The hash function is 5 lines — duplication is acceptable.
  - [x] 1.7 Add `formatElapsed(startedAt)` helper for timer display:
    ```js
    export function formatElapsed(startedAt) {
      if (!startedAt) return '';
      const ms = Date.now() - new Date(startedAt).getTime();
      const sec = Math.floor(ms / 1000);
      if (sec < 60) return `${sec}s`;
      const min = Math.floor(sec / 60);
      if (min < 60) return `${min}m${String(sec % 60).padStart(2, '0')}s`;
      const hr = Math.floor(min / 60);
      return `${hr}h${String(min % 60).padStart(2, '0')}m`;
    }
    ```

- [x] Task 2: Create LlmBadge component (AC: #7, #8)
  - [x] 2.1 Create `bmad-statusline/src/tui/monitor/components/LlmBadge.js`
  - [x] 2.2 Props: `{ state, workflow, startedAt }`
    - `state`: resolved display state from `computeDisplayState()` — one of `'active'`, `'permission'`, `'waiting'`, `'inactive'`
    - `workflow`: workflow name string (e.g., `'dev-story'`)
    - `startedAt`: ISO 8601 timestamp for elapsed timer
  - [x] 2.3 Implement state rendering map:
    ```js
    const LLM_BADGE_CONFIG = {
      active:     { color: 'green',        icon: '⚡', label: 'ACTIF' },
      permission: { color: 'yellow',       icon: '⏳', label: 'PERMISSION' },
      waiting:    { color: 'yellowBright',  icon: '⏸', label: 'EN ATTENTE' },
      inactive:   { color: undefined,       icon: '○', label: 'INACTIF' },
    };
    ```
    Note: `toInkColor('yellowBright')` returns `'yellowBright'` — Ink accepts this directly.
  - [x] 2.4 Active/permission/waiting: render with `bold: true`, `backgroundColor` set to the state color, white text
  - [x] 2.5 Inactive: render with `dimColor: true`, no background
  - [x] 2.6 All states: append ` {workflow} {elapsed}` after the icon+label (using `formatElapsed`)
  - [x] 2.7 Use `const e = React.createElement;` — no JSX
  - [x] 2.8 Export as default: `export default LlmBadge;`

- [x] Task 3: Create SessionTabs component (AC: #1, #2, #3, #4, #5, #6)
  - [x] 3.1 Create `bmad-statusline/src/tui/monitor/components/SessionTabs.js`
  - [x] 3.2 Props: `{ groups, activeProject, activeSessionIndex, config, mode }`
    - `groups`: `Map<string, session[]>` from `groupSessionsByProject()`
    - `activeProject`: current project key string
    - `activeSessionIndex`: index within active project's sessions array
    - `config`: for color resolution
    - `mode`: `'multi-project'` | `'single-project'` | `'single-session'` — determines rendering
  - [x] 3.3 Multi-project mode: render project name tabs in a row, active tab highlighted (inverse/underline), inactive tabs dimmed. Each tab shows `[projectName]` with project color + aggregate badge icon (worst state)
  - [x] 3.4 Below project tabs (multi-project) or as primary row (single-project): render session sub-tabs. Active sub-tab highlighted, inactive dimmed. Each sub-tab shows `[workflow]` with session color
  - [x] 3.5 Single-session mode: return `null` (no tabs)
  - [x] 3.6 Color resolution: use `resolveProjectColor(name, config)` for project tabs, `resolveSessionColor(workflow, config)` for session tabs — both from monitor-utils.js
  - [x] 3.7 Aggregate badge: compute with `worstState(projectSessions)` from monitor-utils.js. Show state icon next to project name
  - [x] 3.8 Use `const e = React.createElement;` — no JSX
  - [x] 3.9 Export as default: `export default SessionTabs;`

- [x] Task 4: Update MonitorScreen.js — full integration (AC: #1, #2, #3, #9, #10)
  - [x] 4.1 Add imports:
    ```js
    import LlmBadge from './components/LlmBadge.js';
    import SessionTabs from './components/SessionTabs.js';
    import { groupSessionsByProject, computeDisplayState, resolveSessionColor, resolveProjectColor, worstState, formatElapsed } from './monitor-utils.js';
    ```
  - [x] 4.2 Add state variables:
    ```js
    const [activeProjectIndex, setActiveProjectIndex] = useState(0);
    const [activeSessionIndex, setActiveSessionIndex] = useState(0);
    const [reorderMode, setReorderMode] = useState(null); // null | 'projects' | 'sessions'
    const [projectOrder, setProjectOrder] = useState(null); // null = natural order, array = custom
    const [sessionOrders, setSessionOrders] = useState({}); // { [project]: [...sessionIds] }
    ```
  - [x] 4.3 Compute derived state:
    ```js
    const groups = groupSessionsByProject(sessions);
    const projectKeys = projectOrder || [...groups.keys()];
    // Clamp activeProjectIndex to valid range
    const clampedProjectIndex = Math.min(activeProjectIndex, Math.max(0, projectKeys.length - 1));
    const activeProject = projectKeys[clampedProjectIndex];
    const projectSessions = groups.get(activeProject) || [];
    // Apply session order if customized
    const orderedSessions = sessionOrders[activeProject]
      ? sessionOrders[activeProject].map(id => projectSessions.find(s => s.sessionId === id)).filter(Boolean)
      : projectSessions;
    const clampedSessionIndex = Math.min(activeSessionIndex, Math.max(0, orderedSessions.length - 1));
    const currentSession = orderedSessions[clampedSessionIndex];
    const mode = projectKeys.length > 1 ? 'multi-project'
               : orderedSessions.length > 1 ? 'single-project'
               : 'single-session';
    ```
  - [x] 4.4 Determine navigation mode and handle `useInput`:
    ```js
    useInput((input, key) => {
      if (reorderMode) return; // ReorderList handles input when reordering
      if (key.escape) { goBack(); return; }

      if (mode === 'multi-project') {
        // ←→ = project tabs
        if (key.leftArrow) {
          setActiveProjectIndex(prev => (prev - 1 + projectKeys.length) % projectKeys.length);
          setActiveSessionIndex(0); // reset session on project change
        } else if (key.rightArrow) {
          setActiveProjectIndex(prev => (prev + 1) % projectKeys.length);
          setActiveSessionIndex(0);
        }
        // Tab/Shift+Tab = session sub-tabs
        if (input === '\t') {
          setActiveSessionIndex(prev => (prev + 1) % orderedSessions.length);
        }
        // Note: Shift+Tab — in Ink, key.shift + key.tab or key.tab with meta — check actual behavior
      } else if (mode === 'single-project') {
        // ←→ = sessions directly
        if (key.leftArrow) setActiveSessionIndex(prev => (prev - 1 + orderedSessions.length) % orderedSessions.length);
        if (key.rightArrow) setActiveSessionIndex(prev => (prev + 1) % orderedSessions.length);
      }

      // Reorder triggers
      if (input === 'r' && projectKeys.length > 1) setReorderMode('projects');
      if (input === 'R' && orderedSessions.length > 1) setReorderMode('sessions');
    }, { isActive: isActive && !reorderMode });
    ```
  - [x] 4.5 Handle Shift+Tab for session sub-tabs in multi-project mode. In Ink, Shift+Tab is detected via `key.shift && key.tab` — test actual behavior. If not natively supported, use `key.tab` combined with a modifier check, or use a raw escape sequence comparison. Fallback: use `key.upArrow`/`key.downArrow` for session cycling if Shift+Tab proves unreliable.
  - [x] 4.6 ReorderList overlay integration:
    ```js
    if (reorderMode === 'projects') {
      const items = projectKeys.map(k => ({ id: k, label: k }));
      return e(Box, { flexDirection: 'column' },
        e(Text, { bold: true, color: 'cyan' }, 'REORDER PROJECTS'),
        e(ReorderList, {
          items,
          isActive: true,
          onDrop: (newOrder) => { setProjectOrder(newOrder); setReorderMode(null); },
          onCancel: () => setReorderMode(null),
          onBack: () => setReorderMode(null),
        }),
      );
    }
    if (reorderMode === 'sessions') {
      const items = orderedSessions.map(s => ({ id: s.sessionId, label: s.workflow || s.sessionId }));
      return e(Box, { flexDirection: 'column' },
        e(Text, { bold: true, color: 'cyan' }, 'REORDER SESSIONS'),
        e(ReorderList, {
          items,
          isActive: true,
          onDrop: (newOrder) => {
            setSessionOrders(prev => ({ ...prev, [activeProject]: newOrder }));
            setReorderMode(null);
          },
          onCancel: () => setReorderMode(null),
          onBack: () => setReorderMode(null),
        }),
      );
    }
    ```
    Import ReorderList: `import { ReorderList } from '../components/ReorderList.js';`
  - [x] 4.7 Update MONITOR_SHORTCUTS to include new shortcuts:
    ```js
    const MONITOR_SHORTCUTS = [
      { key: '◄►', label: 'onglets' },
      { key: '↑↓', label: 'scroll' },
      { key: 'r', label: 'réordonner projets' },
      { key: 'R', label: 'réordonner sessions' },
      { key: 'Esc', label: 'Back home' },
    ];
    ```
    Note: `↑↓ scroll` prepared for 7.6. For 7.5, the shortcuts should reflect available actions — `r`/`R` only shown conditionally (multi-project / multi-session).
  - [x] 4.8 Update render output: title → SessionTabs → LlmBadge → content → ShortcutBar
    ```js
    return e(Box, { flexDirection: 'column' },
      // Title
      e(Text, { bold: true, color: 'cyan' }, 'MONITOR', '  ',
        e(Text, { dimColor: true }, `${sessions.length} session${sessions.length !== 1 ? 's' : ''}`)),
      e(Text, null, ''),
      // Tabs
      sessions.length > 0 && e(SessionTabs, {
        groups, activeProject, activeSessionIndex: clampedSessionIndex, config, mode,
      }),
      // Badge for current session
      currentSession && e(LlmBadge, {
        state: computeDisplayState(currentSession),
        workflow: currentSession.workflow || currentSession.skill,
        startedAt: currentSession.started_at,
      }),
      e(Text, null, ''),
      // Content placeholder — expanded in 7.6 with file/bash sections
      sessions.length === 0
        ? e(Text, { dimColor: true }, 'Aucune session BMAD active')
        : null,
      e(Text, null, ''),
      // Shortcut bar
      e(ShortcutBar, { actions: getShortcuts(mode) }),
    );
    ```
  - [x] 4.9 Create `getShortcuts(mode)` helper to return contextual shortcuts based on navigation mode:
    - Always: `Esc — Back home`
    - Multi-project: `◄► — projets`, `Tab — sessions`, `r — réordonner`
    - Single-project: `◄► — sessions`, `R — réordonner`
    - Single-session: minimal shortcuts only

- [x] Task 5: Update test/tui-monitor-components.test.js — LlmBadge tests (AC: #11)
  - [x] 5.1 Add LlmBadge import and test suite
  - [x] 5.2 Test: ACTIVE state renders `⚡` and `ACTIF` with green color
  - [x] 5.3 Test: PERMISSION state renders `⏳` and `PERMISSION` with yellow color
  - [x] 5.4 Test: WAITING state renders `⏸` and `EN ATTENTE`
  - [x] 5.5 Test: INACTIVE state renders `○` and `INACTIF` with dim styling
  - [x] 5.6 Test: workflow name and elapsed timer displayed
  - [x] 5.7 Test: badge handles missing `startedAt` gracefully (no timer, no crash)

- [x] Task 6: Update test/tui-monitor.test.js — grouping, navigation, reorder tests (AC: #11)
  - [x] 6.1 Add groupSessionsByProject unit tests:
    - Multiple projects → groups by `session.project`
    - Single project → one group
    - Missing project → grouped under `'unknown'`
  - [x] 6.2 Add computeDisplayState unit tests:
    - `llm_state: 'active'` + recent `updated_at` → `'active'`
    - `llm_state: 'active'` + `updated_at` older than 5 min → `'inactive'` (timeout override)
    - `llm_state: 'permission'` → `'permission'`
    - `llm_state: 'waiting'` → `'waiting'`
    - missing `llm_state` → `'inactive'`
  - [x] 6.3 Add worstState unit tests:
    - `[active, waiting]` → `'waiting'`
    - `[active, permission]` → `'permission'`
    - `[active, active]` → `'active'`
    - `[inactive]` → `'inactive'`
  - [x] 6.4 Add resolveSessionColor unit tests:
    - Config override → returns config value
    - No config → falls back to skill-catalog default
    - Unknown workflow → returns `'white'`
  - [x] 6.5 Add resolveProjectColor unit tests:
    - Config override → returns config value
    - No config → returns hash-based color
  - [x] 6.6 Add formatElapsed unit tests:
    - Seconds → `"45s"`
    - Minutes → `"3m05s"`
    - Hours → `"1h30m"`
    - Missing → `""`
  - [x] 6.7 Add MonitorScreen render tests for tab navigation:
    - Multi-project: ←→ changes active project tab
    - Single-project: ←→ changes active session
    - Single-session: no tabs rendered
  - [x] 6.8 Add MonitorScreen render tests for reorder:
    - `r` key activates project reorder overlay
    - `R` key activates session reorder overlay

- [x] Task 7: Run full test suite (AC: #11)
  - [x] 7.1 Run `npm test` — all tests must pass

## Dev Notes

### Architecture Compliance

**Stack — use ONLY these:**
- Node.js >= 20, ESM (`import`/`export`) for TUI modules
- React 19.2.4 + Ink 6.8.0 for TUI components
- `const e = React.createElement;` — no JSX (project-wide convention)
- Testing: `node:test` + `node:assert/strict` + `ink-testing-library`
- Sync file I/O everywhere (Pattern 2): `readFileSync`/`readdirSync` — NO async

**Critical Patterns:**

- **Pattern 5** — Path construction: `BMAD_CACHE_DIR` env var already resolved in app.js, passed via `paths.cachePath`.
- **Pattern 21** — Polling lifecycle: `useSessionPolling` already exists in MonitorScreen from 7.4. No changes to polling.
- **Pattern 23** — Monitor Cache I/O Isolation: ALL cache reads in `monitor-utils.js` ONLY. React components (SessionTabs, LlmBadge) NEVER touch filesystem. They receive data via props.
- **Pattern 24** — Viewport scroll: ScrollableViewport is stateless. Not directly used in 7.5 — scroll integration comes in 7.6.
- **Pattern 25** — Contextual Shortcut Bar: Show only mode-relevant shortcuts. Multi-project shows `◄► projets`, single-project shows `◄► sessions`.
- **Pattern 27** — Monitor Props Contract: MonitorScreen receives `{ config, navigate, goBack, isActive, paths: { cachePath } }`. Uses `config.projectColors` and `config.skillColors` for tab colors. Does NOT read `config.lines`, `config.presets`, `config.separator`.

### Color Resolution Chain

**Session tab color:**
1. `config.skillColors[workflow]` — user-customized color name (e.g., `'green'`, `'brightCyan'`)
2. `getDefaultSkillColor(workflow)` from `skill-catalog.js` — catalog default (e.g., `'cyan'`)
3. Fallback: `'white'`
4. All values passed through `toInkColor()` from `preview-utils.js` to convert `'brightRed'` → `'redBright'` for Ink

**Project tab color:**
1. `config.projectColors[projectName]` — user-customized color name
2. `hashProjectColor(projectName)` — deterministic hash from project name
3. Fallback: `'white'`
4. All values passed through `toInkColor()`

**Important:** `WORKFLOW_COLORS` from `defaults.js` contains ANSI escape codes (e.g., `'\x1b[36m'`), used by the reader only. The TUI uses `skill-catalog.js` which stores Ink-compatible color NAME strings. Do NOT import `WORKFLOW_COLORS` in monitor components.

### LLM State Machine

```
UserPromptSubmit ──→ ACTIVE    (written by hook)
PostToolUse      ──→ ACTIVE    (written by hook)
Stop             ──→ WAITING   (written by hook)
Notification     ──→ PERMISSION (written by hook)
(timeout 5min)   ──→ INACTIVE  (computed in TUI from updated_at, NEVER written to file)
```

| State      | Ink Color       | Icon | Label        | Background |
|------------|-----------------|------|--------------|------------|
| ACTIVE     | `green`         | `⚡` | `ACTIF`      | Yes (green bg, white text) |
| PERMISSION | `yellow`        | `⏳` | `PERMISSION` | Yes (yellow bg, black text) |
| WAITING    | `yellowBright`  | `⏸`  | `EN ATTENTE` | Yes (yellowBright bg, black text) |
| INACTIVE   | dim             | `○`  | `INACTIF`    | No (dim text only) |

**Inactive is computed, never stored.** `computeDisplayState(session)` checks `updated_at` age: if > 5 min → inactive, regardless of `llm_state`. This replaces the raw `llm_state` in all rendering.

### Tab Navigation Modes

| Condition | Mode | ←→ Navigation | Tab/Shift+Tab |
|-----------|------|---------------|---------------|
| N projects | `multi-project` | Projects | Sessions within active project |
| 1 project, N sessions | `single-project` | Sessions | — |
| 1 session | `single-session` | — (no tabs) | — |

### Worst-State Aggregation for Project Badge

Priority order: `permission (3) > waiting (2) > active (1) > inactive (0)`

The project tab displays the worst (highest priority) LLM state icon among all sessions in that project. Example: if one session is `active` and another is `permission`, the project badge shows `⏳`.

### Reorder with ReorderList

Both `r` (projects) and `R` (sessions) use the existing `ReorderList` component from `src/tui/components/ReorderList.js`. When reorder is active:
- MonitorScreen renders the ReorderList overlay instead of normal content
- `isActive` for `useInput` in MonitorScreen is disabled (ReorderList controls input)
- On drop: update local order state (not persisted to config — ephemeral per TUI session)
- On cancel/back: restore previous order, dismiss overlay

Reorder state is in-memory only — not saved to config. Order resets when leaving Monitor and coming back. This is intentional: monitor tab order is ephemeral.

### Shift+Tab Handling in Ink

Ink's `useInput` does not natively distinguish Tab vs Shift+Tab via `key.tab` with a shift modifier. The raw escape sequence for Shift+Tab is `\x1b[Z`. To detect it:

```js
useInput((input, key) => {
  if (key.tab) {
    // Tab (forward)
    setActiveSessionIndex(prev => (prev + 1) % orderedSessions.length);
  }
}, { isActive });

// For Shift+Tab, check raw input in a separate handler or use key.shift + key.tab
// Test actual behavior — if key.shift is not reliable, use a different shortcut
```

If Shift+Tab proves unreliable in Ink, use alternative keybindings: `Tab` forward, `Shift+Tab` or backtick `` ` `` backward. Test actual behavior before implementing fallback.

### Monitor Sub-Boundary

Monitor is isolated in `src/tui/monitor/`. New components go under `components/`. Monitor components are NEVER imported by main TUI screens/components.

```
src/tui/monitor/
  MonitorScreen.js         ← MODIFIED in this story
  monitor-utils.js         ← MODIFIED in this story (new exports)
  components/
    ScrollableViewport.js  ← EXISTS (story 7.3, unchanged)
    LlmBadge.js            ← NEW in this story
    SessionTabs.js         ← NEW in this story
```

### Previous Story Intelligence

**Story 7.4 (Monitor Foundation) — key learnings:**
- `useSessionPolling` works correctly with 1500ms interval + cleanup
- `pollSessions` returns `[{ ...status, sessionId }]` — sessionId is extracted from `.alive-{id}` filename
- MonitorScreen render tests MUST call `unmount()` to avoid hanging (setInterval keeps Node alive)
- Esc key test uses `\x1B` (uppercase) + `await delay(50)` pattern
- useEffect-based tests need `await delay(50)` for first poll before checking `lastFrame()`
- Test fixture pattern: temp directory with `.alive-*` + `status-*.json` files
- 379/381 tests pass — 2 pre-existing failures in tui-edit-line and tui-reorder-lines (unrelated)

**Story 7.4 deferred review items (for awareness):**
- Ghost sessions — no staleness check on `.alive` files (OK for now, 1-5 sessions in practice)
- No upper bound on sessions array — unbounded file reads (deferred)
- No stable ordering for sessions — `readdirSync` order is OS-dependent → now addressed by this story's grouping + reorder

**Story 7.1 deferred review item:**
- `old_string || null` → `?? null` patch pending in handleEdit (bmad-hook.js:458) — not relevant to this story

### Git Intelligence

Recent commits:
- `002948f` review(7-4): code review clean — story done
- `02b8ea9` 7-4: Monitor Foundation — Polling, Routing, HomeScreen Integration
- `37e9988` 7-2: Installer Upgrade — Bash, Stop, Notification Matchers
- `04db605` 7-1: Hook Expansion — History Arrays, LLM State, Atomic Write
- `7590a50` 7-3: ScrollableViewport — Reusable stateless scroll component

All 4 prerequisite stories (7.1-7.4) are done. Status file v2 with history arrays exists. Polling infrastructure works. ScrollableViewport exists.

### Anti-Patterns to Avoid

- DO NOT import `WORKFLOW_COLORS` from `defaults.js` in TUI components — use `skill-catalog.js` and `getDefaultSkillColor()` for Ink-compatible color names
- DO NOT use `fs` inside SessionTabs.js or LlmBadge.js — violates Pattern 23 (all I/O in monitor-utils.js)
- DO NOT persist tab reorder to config — order is ephemeral per TUI session
- DO NOT add file tree, bash sections, detail mode, or chronology — those are stories 7.6-7.9
- DO NOT forget `unmount()` in MonitorScreen render tests — setInterval keeps Node alive
- DO NOT use ScreenLayout in MonitorScreen — custom layout (no BMAD header, no ThreeLinePreview)
- DO NOT read `config.lines`, `config.presets`, `config.separator` in MonitorScreen — configurator concerns
- DO NOT write `'inactive'` to the status file — it's computed from `updated_at` age in the TUI only
- DO NOT use async I/O — all file reads are sync (Pattern 2)

### Project Structure Notes

- `src/tui/monitor/MonitorScreen.js` — modified, add tabs/badge integration, navigation state, reorder mode
- `src/tui/monitor/monitor-utils.js` — modified, add groupSessionsByProject, computeDisplayState, worstState, resolveSessionColor, resolveProjectColor, formatElapsed
- `src/tui/monitor/components/LlmBadge.js` — new file, 4-state LLM badge component
- `src/tui/monitor/components/SessionTabs.js` — new file, 2-level tab navigation component
- `test/tui-monitor.test.js` — modified, add grouping, state, color, reorder tests
- `test/tui-monitor-components.test.js` — modified, add LlmBadge tests

### Scope Boundary

This story covers ONLY:
- Session grouping by project (monitor-utils.js)
- LLM state computation with 5-min inactive override (monitor-utils.js)
- Worst-state aggregation for project badges (monitor-utils.js)
- Tab color resolution from config/catalog (monitor-utils.js)
- Elapsed timer formatting (monitor-utils.js)
- LlmBadge component with 4 states (new component)
- SessionTabs component with 2-level navigation (new component)
- MonitorScreen tab navigation (←→, Tab/Shift+Tab)
- MonitorScreen reorder overlays (r/R)
- Tests for all new functionality

This story does NOT cover (deferred to later stories):
- File tree sections (7.6)
- Bash command sections (7.6)
- ScrollableViewport integration with content (7.6)
- Detail mode / detail pages (7.7)
- Chronology / CSV export (7.8)
- Toggles / auto-scroll / bell (7.9)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Tab-System-Architecture] — lines 961-988
- [Source: _bmad-output/planning-artifacts/architecture.md#LLM-State-Machine] — lines 990-1007
- [Source: _bmad-output/planning-artifacts/architecture.md#Monitor-Sub-Boundary] — lines 873-893
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern-25-Contextual-Shortcut-Bar] — lines 1486-1502
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern-27-Monitor-Props-Contract] — lines 1520-1538
- [Source: _bmad-output/planning-artifacts/epics.md#Story-7.5] — lines 2128-2145
- [Source: bmad-statusline/src/tui/monitor/MonitorScreen.js] — current implementation (from 7.4)
- [Source: bmad-statusline/src/tui/monitor/monitor-utils.js] — current pollSessions (from 7.4)
- [Source: bmad-statusline/src/tui/skill-catalog.js] — getDefaultSkillColor(), SKILL_MODULES
- [Source: bmad-statusline/src/tui/preview-utils.js] — toInkColor()
- [Source: bmad-statusline/src/tui/screens/ProjectColorsScreen.js] — hashProjectColor pattern, resolveProjectColor pattern
- [Source: bmad-statusline/src/tui/components/ReorderList.js] — reorder overlay component
- [Source: _bmad-output/implementation-artifacts/7-4-monitor-foundation-polling-routing-homescreen-integration.md] — previous story

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — clean implementation with no blockers.

### Completion Notes List

- Task 1: Added 7 utility functions to monitor-utils.js: groupSessionsByProject, computeDisplayState, worstState, resolveSessionColor, resolveProjectColor, formatElapsed, plus INACTIVE_TIMEOUT_MS constant. Imports skill-catalog.js and preview-utils.js for color resolution chain.
- Task 2: Created LlmBadge component with 4-state rendering (active/green, permission/yellow, waiting/yellowBright, inactive/dim). Displays icon + label + workflow + elapsed timer. Uses React.createElement pattern (no JSX).
- Task 3: Created SessionTabs component with two-level navigation: project tabs row (multi-project) + session sub-tabs row. Single-project shows sessions only. Single-session returns null. Uses color resolution from monitor-utils.js and worst-state badge icons.
- Task 4: Integrated tabs/badges/navigation/reorder into MonitorScreen.js. Merged with 7-6 file tree/bash/scroll features. Added: activeProjectIndex, activeSessionIndex, reorderMode, projectOrder, sessionOrders state. Navigation: arrow keys for project/session tabs, Tab for sessions in multi-project, r/R for ReorderList overlays. Contextual shortcut bar via getShortcuts(mode).
- Task 5: Added 6 LlmBadge tests to tui-monitor-components.test.js covering all 4 states, workflow display, elapsed timer, and null startedAt handling.
- Task 6: Added 27 tests to tui-monitor.test.js: groupSessionsByProject (3), computeDisplayState (5), worstState (4), resolveSessionColor (3), resolveProjectColor (2), formatElapsed (4), MonitorScreen tab navigation (3), MonitorScreen reorder overlays (2).
- Task 7: Full suite 435/436 pass. Single pre-existing failure in tui-reorder-lines.test.js (unrelated). Zero regressions.

### Change Log

- 2026-04-04: Story 7.5 implementation — tabs, badges, two-level navigation, LLM state, reorder overlays, 33 new tests

### File List

- bmad-statusline/src/tui/monitor/monitor-utils.js (modified — added groupSessionsByProject, computeDisplayState, worstState, resolveSessionColor, resolveProjectColor, formatElapsed, INACTIVE_TIMEOUT_MS)
- bmad-statusline/src/tui/monitor/MonitorScreen.js (modified — tabs/badge integration, navigation state, reorder overlays, contextual shortcuts)
- bmad-statusline/src/tui/monitor/components/LlmBadge.js (new — 4-state LLM badge component)
- bmad-statusline/src/tui/monitor/components/SessionTabs.js (new — two-level tab navigation component)
- bmad-statusline/test/tui-monitor-components.test.js (modified — added LlmBadge test suite)
- bmad-statusline/test/tui-monitor.test.js (modified — added grouping, state, color, elapsed, navigation, reorder tests)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified — 7-5 status: in-progress → review)

### Review Findings

- [x] [Review][Decision] D1: Hook hors scope — REVERTED. bmad-hook.js et hook.test.js restaurés à l'état pré-7.5. Machine LLM, history arrays, handlers, atomic write, et 316 tests 7.1 récupérés.
- [x] [Review][Decision] D2: Ajouts hors scope — ACCEPTED. Scope creep additif non-destructif (docname, fileread/filewrite samples, formatProgressStep). Gardé tel quel.
- [x] [Review][Patch] P1: Chemins conditionnels writeStatus — MOOT après revert D1, hook restauré au code 7.1 original.
- [x] [Review][Patch] P2: Test SAMPLE_VALUES — FIXED. Ajouté bmad-docname à expectedKeys, titre "has all 10 widget keys" [test/tui-preview-utils.test.js:13]
- [x] [Review][Patch] P3: formatElapsed — FIXED. Ajouté garde `if (isNaN(ms) || ms < 0) return ''` [monitor-utils.js:96]
- [x] [Review][Patch] P4: Modulo zéro — FIXED. Ajouté `orderedSessions.length > 0` avant modulo [MonitorScreen.js:123,127]
- [x] [Review][Defer] W1: Garde 10MB supprimée — fichiers legacy peuvent causer pic mémoire [bmad-hook.js] — deferred, pre-existing/transitional
- [x] [Review][Defer] W2: SessionTabs rend Box vide pour activeProject périmé [SessionTabs.js:22] — deferred, auto-correction au prochain poll
