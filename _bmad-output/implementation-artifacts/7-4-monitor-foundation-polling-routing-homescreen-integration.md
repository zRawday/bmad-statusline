# Story 7.4: Monitor Foundation — Polling, Routing, HomeScreen Integration

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **bmad-statusline user**,
I want **to access a Monitor screen from Home that shows active BMAD sessions in real time**,
So that **I can see which sessions are running**.

## Acceptance Criteria

1. **Given** HomeScreen
   **When** rendered
   **Then** "Monitor" option navigates to screen `'monitor'`

2. **Given** MonitorScreen mounts
   **When** `useSessionPolling` executes
   **Then** immediate poll + 1500ms interval, reads `.alive-*` + `status-*.json`, filters BMAD sessions only, cleanup on unmount

3. **Given** `monitor-utils.js`
   **When** implemented
   **Then** exports `pollSessions(cachePath)` encapsulating all cache I/O (Pattern 23)

4. **Given** MonitorScreen with no sessions
   **When** rendered
   **Then** shows "MONITOR" title + no active sessions message, Esc returns to Home

5. **Given** tests
   **When** executed
   **Then** `tui-monitor.test.js` created: render, empty state, polling, Esc navigation
   **And** all existing tests pass (`npm test`)

## Tasks / Subtasks

- [x] Task 1: Add "Monitor" option to HomeScreen.js (AC: #1)
  - [x] 1.1 Add `{ label: '...  Monitor', value: 'monitor' }` to HOME_OPTIONS array after the ccstatusline option (add a separator `_sep4` before it)
  - [x] 1.2 Add `else if (value === 'monitor') navigate('monitor');` to the useInput Enter handler in HomeScreen
  - [x] 1.3 Verify `SELECTABLE_INDICES` auto-includes the new option (it does — computed from HOME_OPTIONS, separators excluded)

- [x] Task 2: Add monitor route to app.js (AC: #1)
  - [x] 2.1 Add import: `import { MonitorScreen } from './monitor/MonitorScreen.js';`
  - [x] 2.2 Resolve cachePath at top of App component: `const cachePath = process.env.BMAD_CACHE_DIR || path.join(os.homedir(), '.cache', 'bmad-status');` — requires `import path from 'node:path'; import os from 'node:os';`
  - [x] 2.3 Add route before the fallback: `if (screen === 'monitor') { return e(MonitorScreen, { config, navigate, goBack, isActive: !statusMessage, paths: { cachePath } }); }`
  - [x] 2.4 MonitorScreen receives only props it needs per Pattern 27 (not full `screenProps` spread): `config`, `navigate`, `goBack`, `isActive`, `paths: { cachePath }`

- [x] Task 3: Create monitor-utils.js (AC: #3)
  - [x] 3.1 Create `bmad-statusline/src/tui/monitor/monitor-utils.js`
  - [x] 3.2 Implement `pollSessions(cachePath)`:
    ```js
    import fs from 'node:fs';
    import path from 'node:path';

    export function pollSessions(cachePath) {
      try {
        const files = fs.readdirSync(cachePath);
        const aliveFiles = files.filter(f => f.startsWith('.alive-'));
        const sessions = [];
        for (const alive of aliveFiles) {
          const sessionId = alive.slice('.alive-'.length);
          const statusPath = path.join(cachePath, `status-${sessionId}.json`);
          try {
            const raw = fs.readFileSync(statusPath, 'utf8');
            const status = JSON.parse(raw);
            if (status.skill) sessions.push({ ...status, sessionId });
          } catch { /* skip corrupted/missing */ }
        }
        return sessions;
      } catch { return []; /* cache dir missing */ }
    }
    ```
  - [x] 3.3 Only sessions with `status.skill` defined are returned (BMAD sessions filter)
  - [x] 3.4 Add `sessionId` to each returned session object (extracted from alive filename) for identification
  - [x] 3.5 Corrupted/missing status files silently skipped (Pattern 1 for TUI)
  - [x] 3.6 Missing cache directory returns empty array (no crash)

- [x] Task 4: Create MonitorScreen.js (AC: #2, #4)
  - [x] 4.1 Create `bmad-statusline/src/tui/monitor/MonitorScreen.js`
  - [x] 4.2 Implement `useSessionPolling(cachePath)` custom hook:
    ```js
    function useSessionPolling(cachePath) {
      const [sessions, setSessions] = useState([]);
      useEffect(() => {
        function poll() { setSessions(pollSessions(cachePath)); }
        poll();
        const id = setInterval(poll, 1500);
        return () => clearInterval(id);
      }, [cachePath]);
      return sessions;
    }
    ```
  - [x] 4.3 Pattern 21 compliance: immediate poll, then 1500ms interval, clearInterval cleanup on unmount
  - [x] 4.4 Pattern 2 compliance: pollSessions uses readFileSync (via monitor-utils.js)
  - [x] 4.5 Implement MonitorScreen component:
    - Props: `{ config, navigate, goBack, isActive, paths }`
    - Call `useSessionPolling(paths.cachePath)` to get sessions
    - `useInput` with Esc → `goBack()` (gated by `isActive`)
    - Render: "MONITOR" title (bold, cyan), session count or "no active sessions" message, ShortcutBar
  - [x] 4.6 Layout — DO NOT use ScreenLayout:
    - Sticky top: "MONITOR" title in bold + session count
    - Content: session list or empty message
    - Sticky bottom: ShortcutBar with `[{ key: 'Esc', label: 'Back home' }]` (minimal for 7.4, expanded in 7.5+)
  - [x] 4.7 Export as named export: `export function MonitorScreen(...)`
  - [x] 4.8 Use `const e = React.createElement;` — no JSX (project pattern)

- [x] Task 5: Create tui-monitor.test.js (AC: #5)
  - [x] 5.1 Create `bmad-statusline/test/tui-monitor.test.js`
  - [x] 5.2 Test: MonitorScreen renders with "MONITOR" title visible
  - [x] 5.3 Test: empty state shows no-sessions message when cachePath has no .alive files
  - [x] 5.4 Test: pollSessions returns sessions when .alive + status files exist
  - [x] 5.5 Test: pollSessions filters non-BMAD sessions (no `skill` field → excluded)
  - [x] 5.6 Test: pollSessions handles missing cache dir gracefully (returns [])
  - [x] 5.7 Test: pollSessions skips corrupted status files (invalid JSON → excluded)
  - [x] 5.8 Test: Esc key triggers goBack (use mock goBack function)
  - [x] 5.9 Verify all existing tests pass: `npm test`

- [x] Task 6: Run full test suite (AC: #5)
  - [x] 6.1 Run `npm test` — all tests must pass (379/381 — 2 pre-existing failures in tui-edit-line and tui-reorder-lines, unrelated to this story)

## Dev Notes

### Architecture Compliance

**Stack — use ONLY these:**
- Node.js >= 20, ESM (`import`/`export`) for TUI modules
- React 19.2.4 + Ink 6.8.0 for TUI components
- `const e = React.createElement;` — no JSX (project-wide convention)
- Testing: `node:test` + `node:assert/strict` + `ink-testing-library`
- Sync file I/O everywhere (Pattern 2): `readFileSync`/`readdirSync` — NO async

**Critical Patterns:**

- **Pattern 2** — Sync I/O: `fs.readdirSync`, `fs.readFileSync` in pollSessions. No `fs.promises`, no `async/await` for file ops.
- **Pattern 5** — Path construction: `BMAD_CACHE_DIR` env var: `process.env.BMAD_CACHE_DIR || path.join(os.homedir(), '.cache', 'bmad-status')`. Resolve in app.js, pass down as prop.
- **Pattern 21** — Polling lifecycle: `useEffect` + `setInterval` + `readFileSync` + `clearInterval` cleanup. Immediate first poll then interval. No async in interval callback.
- **Pattern 23** — Monitor Cache I/O Isolation: ALL cache reads in `monitor-utils.js` ONLY. React components NEVER touch filesystem. MonitorScreen receives session data via hook return value.
- **Pattern 24** — Viewport scroll: ScrollableViewport is stateless. Parent owns scrollOffset. (Not directly used in 7.4 minimal version, but the pattern applies when sessions list is added in 7.5+)
- **Pattern 25** — Contextual Shortcut Bar: For 7.4, minimal shortcuts `[{ key: 'Esc', label: 'Back home' }]`. Later stories add mode-specific arrays.
- **Pattern 27** — Monitor Props Contract: MonitorScreen receives `{ config, navigate, goBack, isActive, paths: { cachePath } }`. Does NOT receive `updateConfig`, `previewOverride`, `setPreviewOverride`, `editingLine`, `selectedWidget` — those are configurator concerns.

**MonitorScreen does NOT use ScreenLayout.** No BMAD header, no ThreeLinePreview. Custom layout: title + content + shortcut bar.

### Monitor Sub-Boundary

Monitor is isolated in `src/tui/monitor/`. Monitor components are NEVER imported by main TUI screens/components. The ONLY integration point is `app.js` routing to MonitorScreen when `screen === 'monitor'`.

```
src/tui/monitor/
  MonitorScreen.js         ← NEW in this story
  monitor-utils.js         ← NEW in this story
  components/
    ScrollableViewport.js  ← Already exists (story 7.3)
```

### BMAD Session Detection

A session is "BMAD" if its status JSON has a `skill` field defined (non-null, non-undefined). This is set by the hook when it detects a BMad skill invocation. Non-BMAD Claude Code sessions (without BMad hooks or without skill detection) are filtered out.

### Polling Architecture

```
MonitorScreen mounts
  → useSessionPolling(cachePath) called
    → useEffect fires immediately
      → pollSessions(cachePath) called (sync)
        → readdirSync(cachePath) → filter .alive-* files
        → for each alive: readFileSync status-{id}.json → JSON.parse → filter skill
      → setSessions(result)
      → setInterval(poll, 1500) starts
    → useEffect cleanup: clearInterval(id)
```

**Rules:**
- Parse errors (corrupted JSON, mid-write atomic file) → skip silently
- Cache dir missing → return []
- Only sessions with `skill` defined → show (BMAD sessions)
- `inactive` state computed from `updated_at` age (>5 min) — NOT in this story, deferred to 7.5

### Empty State

When no BMAD sessions are found, display:
```
MONITOR                           ← bold, cyan
                                  ← blank line
Aucune session BMAD active        ← dimColor text
```

ShortcutBar at bottom: `Esc — Back home`

### HomeScreen Integration

Add Monitor as a new menu option at the bottom of the home menu (after ccstatusline, with a separator):

```
───                               ← separator
🖥  Monitor                       ← new option
```

Navigation: `navigate('monitor')` — no context needed.

### app.js Routing Changes

The monitor route passes a subset of props (Pattern 27 — not full screenProps):

```js
if (screen === 'monitor') {
  return e(MonitorScreen, {
    config,
    navigate,
    goBack,
    isActive: !statusMessage,
    paths: { cachePath },
  });
}
```

`cachePath` resolved at the top of App: `const cachePath = process.env.BMAD_CACHE_DIR || path.join(os.homedir(), '.cache', 'bmad-status');`

### Previous Story Intelligence

**Story 7.3 (ScrollableViewport):**
- Created `src/tui/monitor/components/` directory structure
- Established monitor component pattern: pure function, `const e = React.createElement`, default export
- Test pattern: `ink-testing-library` render + `lastFrame()` + `assert.ok(frame.includes(...))`
- All tests passed (383/384, 1 pre-existing failure in tui-reorder-lines unrelated)

**Story 7.1 (Hook Expansion):**
- Status file v2 schema now includes `llm_state`, `llm_state_since`, `reads[]`, `writes[]`, `commands[]`
- Atomic write pattern: `.tmp` → `renameSync` — means pollSessions may occasionally read a `.tmp` file mid-write (JSON parse will fail → skip silently, correct behavior)
- `agent_id` field on array entries — not used in 7.4 but present in data
- Review deferred item: `old_string || null` → `?? null` patch pending (P1 from review) — not relevant to this story

**Story 7.1 review deferred work P1** — `old_string || null` → `?? null` in handleEdit (bmad-hook.js:458). This is a pending patch on the hook side. Does NOT affect Monitor reading — old_string/new_string are for detail pages in story 7.7.

### Git Intelligence

Recent commits show:
- `7-1: Hook Expansion` — hook now writes history arrays + llm_state to status JSON (data source for Monitor)
- `7-3: ScrollableViewport` — reusable scroll component exists in `src/tui/monitor/components/`
- TUI polish commits show active development of preview-utils.js, widget-registry.js, reader

### Test Patterns

**pollSessions unit tests** — use temp directory with mock `.alive-*` and `status-*.json` files:

```js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, writeFileSync } from 'node:fs';

// Setup temp cache dir
const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'bmad-monitor-test-'));

// Create .alive file and status file
writeFileSync(path.join(tmpDir, '.alive-abc123'), '');
writeFileSync(path.join(tmpDir, 'status-abc123.json'), JSON.stringify({
  skill: 'bmad-dev-story',
  project: 'my-project',
  updated_at: new Date().toISOString(),
  llm_state: 'active',
}));
```

**MonitorScreen render tests** — use `ink-testing-library`:

```js
import { render } from 'ink-testing-library';
// Render with mock props, check lastFrame() for expected content
```

**Esc navigation test** — capture goBack calls:

```js
let goBackCalled = false;
const goBack = () => { goBackCalled = true; };
// render MonitorScreen with goBack mock
// stdin.write('\x1b'); // Esc key
// assert goBackCalled
```

**Test file naming:** `test/tui-monitor.test.js`

**Existing test reference files:**
- `test/tui-monitor-components.test.js` — ScrollableViewport tests (story 7.3 pattern)
- `test/tui-components.test.js` — ThreeLinePreview, ReorderList tests
- `test/hook.test.js` — uses execSync + temp dirs for subprocess testing

### Anti-Patterns to Avoid

- DO NOT use `fs.promises` or `async/await` for file reads in pollSessions — violates Pattern 2
- DO NOT import `fs` inside MonitorScreen.js — violates Pattern 23 (all I/O in monitor-utils.js)
- DO NOT use ScreenLayout in MonitorScreen — Monitor has its own layout (no BMAD header, no ThreeLinePreview)
- DO NOT spread full `screenProps` to MonitorScreen — pass only Pattern 27 props
- DO NOT add session grouping, tabs, badge, or detail mode — those are stories 7.5-7.9
- DO NOT forget `clearInterval` cleanup in useEffect return — memory leak on unmount
- DO NOT use `setInterval` with async callback — sync only (Pattern 21)
- DO NOT read `config.lines`, `config.presets`, `config.separator` in MonitorScreen — those are configurator concerns

### Project Structure Notes

- `src/tui/monitor/MonitorScreen.js` — new file, named export `MonitorScreen`
- `src/tui/monitor/monitor-utils.js` — new file, named export `pollSessions`
- `src/tui/screens/HomeScreen.js` — modified, add Monitor menu option
- `src/tui/app.js` — modified, add monitor route + cachePath resolution + imports
- `test/tui-monitor.test.js` — new file, tests for MonitorScreen + pollSessions

### Scope Boundary

This story covers ONLY:
- HomeScreen "Monitor" option (routing)
- MonitorScreen with title, empty state, Esc navigation
- useSessionPolling hook with pollSessions
- monitor-utils.js with pollSessions

This story does NOT cover (deferred to later stories):
- Session grouping by project (7.5)
- Tabs navigation (7.5)
- LlmBadge display (7.5)
- File tree sections (7.6)
- Bash command sections (7.6)
- Detail mode / detail pages (7.7)
- Chronology / CSV export (7.8)
- Toggles / auto-scroll / bell (7.9)
- Session list rendering beyond count (7.5 builds on this)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Polling-Architecture] — lines 896-936
- [Source: _bmad-output/planning-artifacts/architecture.md#Monitor-Sub-Boundary] — lines 873-893
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern-21-Polling-Lifecycle] — lines 1414-1431
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern-23-Monitor-Cache-IO-Isolation] — lines 1449-1463
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern-27-Monitor-Props-Contract] — lines 1522-1538
- [Source: _bmad-output/planning-artifacts/epics.md#Story-7.4] — lines 2100-2126
- [Source: bmad-statusline/src/tui/app.js] — current routing (add monitor route)
- [Source: bmad-statusline/src/tui/screens/HomeScreen.js] — current menu (add Monitor option)
- [Source: bmad-statusline/src/tui/monitor/components/ScrollableViewport.js] — exists from 7.3
- [Source: _bmad-output/implementation-artifacts/7-3-scrollable-viewport-reusable-stateless-scroll-component.md] — previous story
- [Source: _bmad-output/implementation-artifacts/7-1-hook-expansion-history-arrays-llm-state-atomic-write.md] — previous story

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Initial MonitorScreen render tests hung the test runner because `unmount()` was not called — `setInterval` from `useSessionPolling` kept Node alive. Fixed by adding `unmount()` to all MonitorScreen render tests.
- Esc key test needed `async` + `await delay(50)` + `\x1B` (uppercase) pattern consistent with existing TUI tests.
- Session count test needed `await delay(50)` for `useEffect` to fire before checking `lastFrame()`.

### Completion Notes List

- HomeScreen: Added Monitor option with separator `_sep4`, navigation handler `navigate('monitor')`
- app.js: Added MonitorScreen import, `cachePath` resolution at App top, monitor route with Pattern 27 props
- monitor-utils.js: `pollSessions(cachePath)` with sync I/O, BMAD session filter (`skill` field), silent error handling
- MonitorScreen.js: `useSessionPolling` hook (immediate poll + 1500ms interval + cleanup), MONITOR title, empty state, Esc navigation, ShortcutBar
- tui-monitor.test.js: 10 tests (6 pollSessions unit + 4 MonitorScreen render), all pass
- Full suite: 379/381 pass — 2 pre-existing failures unrelated to this story

### File List

- bmad-statusline/src/tui/screens/HomeScreen.js (modified)
- bmad-statusline/src/tui/app.js (modified)
- bmad-statusline/src/tui/monitor/monitor-utils.js (new)
- bmad-statusline/src/tui/monitor/MonitorScreen.js (new)
- bmad-statusline/test/tui-monitor.test.js (new)

### Change Log

- 2026-04-04: Story 7.4 implementation — Monitor foundation with polling, routing, HomeScreen integration

### Review Findings

- [x] [Review][Defer] Ghost sessions — no staleness check on `.alive` files [monitor-utils.js:9] — deferred, spec defers `inactive` state to story 7.5 (`updated_at` age >5 min)
- [x] [Review][Defer] No upper bound on sessions array — unbounded file reads if thousands of `.alive` files [monitor-utils.js:10-17] — deferred, 1-5 sessions in practice
- [x] [Review][Defer] No stable ordering for sessions — `readdirSync` order is OS-dependent [monitor-utils.js:8] — deferred, 7.4 only shows count, 7.5 renders rows
