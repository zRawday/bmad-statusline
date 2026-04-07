# Story 5.5: Widget Order Screen with ReorderList

Status: done

## Story

As a **developer customizing widget display order**,
I want **to grab, move, and drop widgets in the sequence I prefer using a dual-mode keyboard interaction**,
So that **my statusline displays widgets in the exact order I want, with live preview showing the result of each move**.

## Acceptance Criteria

1. **Widget Order screen renders:** Given the Home screen, when the developer presses Enter on "Widget Order", then the Widget Order screen displays: breadcrumb `Home > Widget Order`, title "Reorder widgets (move selected widget)", numbered list of visible widgets in current order, shortcut bar (navigate state): `↑↓ Navigate  Enter Grab  Esc Back`.

2. **Grab widget (navigate → moving):** Given the Widget Order screen in navigate state, when the developer presses Enter on a widget, then the widget enters moving state: the grabbed widget shows a visual marker (`← moving`, bold or inverted), shortcut bar changes to: `↑↓ Move  Enter Drop  Esc Cancel`.

3. **Move widget during moving state:** Given the Widget Order screen in moving state, when the developer presses ↑ or ↓, then the grabbed widget moves up or down in the list, and the DualPreview updates on each position change to show the new order.

4. **Drop widget (moving → navigate):** Given the Widget Order screen in moving state, when the developer presses Enter, then the widget is dropped at its current position, the new order is persisted to config, and the screen returns to navigate state with updated shortcut bar.

5. **Cancel move:** Given the Widget Order screen in moving state, when the developer presses Escape, then the widget returns to its original position (before grab), the DualPreview reverts to the persisted order, and the screen returns to navigate state.

6. **Navigate back to Home:** Given the Widget Order screen in navigate state, when the developer presses Escape, then the screen returns to Home.

7. **ReorderList uses useInput:** Given the ReorderList component, when inspected, then it uses `useInput` hook with internal state toggle (navigate/moving), not @inkjs/ui Select (Select does not support grab/move semantics).

8. **Tests:** Given `test/tui-*.test.js`, when updated for this story, then tests cover: (a) renders visible widgets in numbered list, (b) Enter grabs widget and switches to moving state, (c) ↑↓ moves widget and updates preview, (d) Enter drops and persists, (e) Escape cancels and reverts position, (f) shortcut bar changes between states, (g) Escape in navigate state returns to Home.

## Tasks / Subtasks

- [x] Task 1: Create ReorderList component (AC: #1, #2, #3, #7)
  - [x] 1.1 Create `src/tui/components/ReorderList.js` — dual-mode list with `useInput`, navigate/moving states
  - [x] 1.2 Navigate mode: ↑↓ moves cursor, Enter fires `onGrab(index)`, renders numbered items with cursor indicator (`>`)
  - [x] 1.3 Moving mode: ↑↓ swaps item with neighbor, renders `← moving` marker on grabbed item, fires `onMove(tempOrder)` on each swap
  - [x] 1.4 Drop: Enter fires `onDrop(finalOrder)`, Cancel: Escape fires `onCancel()`

- [x] Task 2: Create WidgetOrderScreen (AC: #1, #2, #5, #6)
  - [x] 2.1 Create `src/tui/screens/WidgetOrderScreen.js` — composes ScreenLayout + ReorderList
  - [x] 2.2 Extract visible widgets from `tuiState.widgetOrder` filtered by `tuiState.visibleWidgets`
  - [x] 2.3 Dynamic shortcut bar: switches between navigate and moving shortcuts based on ReorderList mode
  - [x] 2.4 Escape in navigate state calls `onBack`

- [x] Task 3: Integrate into app.js screen router (AC: #3, #4, #5)
  - [x] 3.1 Import WidgetOrderScreen, add router case for `screen === 'order'`
  - [x] 3.2 Implement `handleOrderPreview(newOrder)` — updates `tuiState.widgetOrder` for DualPreview
  - [x] 3.3 Implement `handleOrderCommit(newOrder)` — updates `tuiState.widgetOrder`, rebuilds `rawConfig.lines[targetLine]` via `buildWidgetConfig`, calls `saveConfig`, shows StatusMessage on error
  - [x] 3.4 Implement `handleOrderCancel(originalOrder)` — reverts `tuiState.widgetOrder` to pre-grab order
  - [x] 3.5 Remove 'order' from PlaceholderScreen routing

- [x] Task 4: Write tests (AC: #8)
  - [x] 4.1 Create `test/tui-widget-order.test.js` — ReorderList renders numbered list (a), grab switches state (b), ↑↓ moves item (c), drop persists (d), cancel reverts (e), shortcut bar changes (f), Escape navigates back (g)

### Review Findings

- [x] [Review][Decision] Scope violation: commit bundles handler code from Stories 5.2, 5.3, 5.6 into the 5-5 commit — accepted, bugs in out-of-scope code deferred to respective story reviews
- [x] [Review][Patch] `handleOrderCommit` missing `customSeparator` in `buildWidgetConfig` call — already fixed by story 5-4 implementation
- [x] [Review][Patch] `WidgetOrderScreen` `isActive: true` ignores `statusMessage` overlay — fixed: changed to `!statusMessage` [app.js:~437]
- [x] [Review][Defer] `handleToggleVisibility` missing `try/catch` around `saveConfig` [app.js:~170] — deferred, Story 5.2 code
- [x] [Review][Defer] `handleLoadPreset`: crash on 'default' path (`rawConfig` may be null), replaces entire `tuiState` (drops extra fields), missing `customSeparator`, `targetLine` mismatch doesn't clean old line [app.js:~176] — deferred, Story 5.6 code
- [x] [Review][Defer] `readerPath` expression duplicated in 4 handlers [app.js] — deferred, cross-cutting refactor
- [x] [Review][Defer] Presets loaded from config not validated (malformed snapshot crashes `handleLoadPreset`) [app.js:~103] — deferred, Story 5.6 code

## Dev Notes

### Architecture: ReorderList Component

The ReorderList is a **custom component** because @inkjs/ui Select does not support grab/move/drop semantics. It uses `useInput` with an internal mode state machine:

```
State: navigate
  ↑↓ → move cursor (selectedIndex)
  Enter → switch to moving (grab item at selectedIndex)

State: moving
  ↑↓ → swap grabbed item with neighbor (update items array)
  Enter → drop (commit current order)
  Escape → cancel (revert to pre-grab order)
```

**UX mockup (from UX spec):**
```
    1. project
  > 2. workflow         ← moving
    3. progressstep
    4. story
    5. timer
```

- `>` indicates cursor position
- `← moving` (bold) marks the grabbed widget in moving state
- Numbers update as items swap positions

### ReorderList Props and Callbacks

```js
ReorderList({
  items,          // Array of { id, label } — visible widgets in current order
  isActive,       // Boolean — pass through from screen for useInput isActive
  onMove,         // (tempOrder: string[]) => void — called on each ↑↓ during moving
  onDrop,         // (newOrder: string[]) => void — called on Enter in moving state
  onCancel,       // () => void — called on Escape in moving state
  onBack,         // () => void — called on Escape in navigate state
})
```

Internal state:
```js
const [mode, setMode] = useState('navigate');      // 'navigate' | 'moving'
const [cursorIndex, setCursorIndex] = useState(0);  // current highlight position
const [localItems, setLocalItems] = useState(items); // working copy for swaps
const [grabSnapshot, setGrabSnapshot] = useState(null); // pre-grab order for cancel
```

**Mode tracking for shortcut bar:** Export the mode state or accept a `onModeChange(mode)` callback so WidgetOrderScreen can switch the shortcut bar dynamically.

### Widget Display Names

Strip `bmad-` prefix for display: `item.id.replace('bmad-', '')`. The UX mockup shows lowercase names (project, workflow, progressstep, story, timer).

### Visible Widget Filtering

The Widget Order screen shows only widgets in `tuiState.visibleWidgets`. Extract from `tuiState.widgetOrder` preserving order:

```js
const visibleInOrder = tuiState.widgetOrder.filter(id => tuiState.visibleWidgets.includes(id));
const items = visibleInOrder.map(id => ({ id, label: id.replace('bmad-', '') }));
```

### Config Persistence on Drop

When the user drops a widget (Enter in moving state), rebuild the rawConfig and save:

```js
// In app.js handleOrderCommit:
const readerPath = (paths && paths.readerPath) || path.join(os.homedir(), '.config', 'bmad-statusline', 'bmad-sl-reader.js');
const visibleInOrder = newOrder.filter(id => tuiState.visibleWidgets.includes(id));
const newLine = buildWidgetConfig(visibleInOrder, readerPath, {
  separatorStyle: tuiState.separator,
  colorModes: tuiState.colorModes,
});
const updatedConfig = structuredClone(tuiState.rawConfig);
updatedConfig.lines[tuiState.targetLine] = newLine;

setTuiState(prev => ({ ...prev, widgetOrder: newOrder, rawConfig: updatedConfig }));

const result = saveConfig(updatedConfig, paths);
if (!result.success) {
  setStatusMessage({ variant: 'error', text: 'Could not save configuration. Press any key.' });
}
```

### Preview Updates During Moving

During moving state, each ↑↓ swap calls `onMove(tempOrder)` which updates `tuiState.widgetOrder` in app.js (WITHOUT persisting). This makes DualPreview reflect the temporary order. On cancel, the original order is restored.

```js
// In app.js:
const handleOrderPreview = (tempOrder) => {
  setTuiState(prev => ({ ...prev, widgetOrder: tempOrder }));
};

const handleOrderCancel = () => {
  // Revert widgetOrder to before grab — use the persisted order from rawConfig
  // The WidgetOrderScreen can pass the pre-grab snapshot back
};
```

**Simpler approach:** WidgetOrderScreen stores the pre-grab order snapshot. On cancel, it calls `onMove(preGrabOrder)` to revert the preview, then returns to navigate mode.

### Screen Router Integration in app.js

```js
// In app.js screen router:
if (screen === 'order') {
  return e(WidgetOrderScreen, {
    tuiState,
    onMove: handleOrderPreview,    // temp preview during moving
    onDrop: handleOrderCommit,     // persist on drop
    onBack: goBack,
    isActive: true,
  });
}
```

### NO JSX Reminder

Use `const e = React.createElement` throughout. All code samples above use JSX for readability — translate to `e(Component, props, children)` calls.

### REUSE These Files Unchanged

| File | Purpose | API |
|------|---------|-----|
| `config-loader.js` | Load config | `loadConfig(paths)` |
| `config-writer.js` | Persist config | `saveConfig(config, paths)` -> `{ success, error }` |
| `widget-registry.js` | Widget defs + config builder | `getIndividualWidgets()`, `buildWidgetConfig(enabledWidgets, readerPath, options)` |
| `components/ScreenLayout.js` | Vertical layout wrapper | Props: `breadcrumb`, `title`, `shortcuts`, `tuiState`, `children` |
| `components/DualPreview.js` | Preview lines | Reads `tuiState.widgetOrder`, `tuiState.visibleWidgets`, `tuiState.colorModes`, `tuiState.separator` |
| `components/Breadcrumb.js` | Breadcrumb nav | Props: `path` (array of strings) |
| `components/ShortcutBar.js` | Keyboard shortcuts | Props: `actions` (array of `{key, label}`) |

### Dynamic ShortcutBar in WidgetOrderScreen

The shortcut bar content depends on ReorderList mode. WidgetOrderScreen needs to track the current mode:

```js
const NAVIGATE_SHORTCUTS = [
  { key: '↑↓', label: 'Navigate' },
  { key: 'Enter', label: 'Grab' },
  { key: 'Esc', label: 'Back' },
];

const MOVING_SHORTCUTS = [
  { key: '↑↓', label: 'Move' },
  { key: 'Enter', label: 'Drop' },
  { key: 'Esc', label: 'Cancel' },
];
```

Use a state variable `reorderMode` in WidgetOrderScreen, updated via `onModeChange` callback from ReorderList.

### Boundary Constraints

- **Items at boundaries:** When the grabbed widget is at position 0 and ↑ is pressed, do nothing (no wrap). Same for last position + ↓.
- **Single item:** If only 1 visible widget exists, Enter still grabs but ↑↓ do nothing. This is an edge case but should work gracefully.
- **Widget IDs in order arrays:** Always use full IDs (`bmad-project`, `bmad-workflow`), only strip for display.

### What This Story Does NOT Do

- Does NOT build Widgets List screen (Story 5.2)
- Does NOT build Widget Detail / Color Mode / Color Picker (Story 5.3)
- Does NOT build Target Line, Separator Style, or Reset screens (Story 5.4)
- Does NOT build Presets / ConfirmDialog (Story 5.6)
- Does NOT modify visibility (no show/hide — that's Story 5.2)
- Does NOT modify config-loader.js, config-writer.js, or widget-registry.js

### Project Structure Notes

- New files: `src/tui/components/ReorderList.js`, `src/tui/screens/WidgetOrderScreen.js`, `test/tui-widget-order.test.js`
- Modified files: `src/tui/app.js` (add WidgetOrderScreen import + router case + callbacks)
- All new TUI files are ESM (`import`/`export`)
- Run tests: `npm test` from `bmad-statusline/` (runs `node --test test/*.test.js`)
- Currently 245+ tests passing — new tests must not break existing ones

### Previous Story Intelligence

From Story 5.1 (most recent in Epic 5):
- **Pattern established:** All components use `const e = React.createElement`, no JSX
- **ScreenLayout contract:** Props are `breadcrumb` (string[]), `title` (string), `shortcuts` ({key, label}[]), `tuiState` (object), `children`
- **Screen integration pattern:** Screen component receives `tuiState`, callbacks, `isActive`; app.js routes via `screen` state variable
- **useInput pattern:** `useInput((input, key) => { ... }, { isActive })` — always respect `isActive` to prevent ghost input when screen is not active
- **DualPreview reads from tuiState:** Changing `tuiState.widgetOrder` automatically updates the preview (no manual refresh needed)
- **StatusMessage pattern:** `setStatusMessage({ variant: 'error', text: '...' })` in app.js, overlay dismisses on any keypress
- **PlaceholderScreen handles unmapped screens:** Only remove 'order' from placeholder routing, leave others for future stories
- **ink-testing-library already installed** — no new devDependencies needed
- **Test pattern:** `node:test` + `node:assert/strict`, import React + render from ink-testing-library, `const e = React.createElement`
- **Review findings from 5.1:** `launchTui` must return `waitUntilExit()`, `preserveColors: undefined` treated as dynamic (not fixed), StatusMessage with try/catch around saveConfig

### Git Intelligence

Recent commits show consistent patterns:
- Commit format: `{story-key}: {description}` (e.g., `5-1-app-shell-shared-components-home-screen: App shell + shared components + Home screen`)
- Code review corrections follow: `fix({story-key}): code review corrections`
- Story 5.1 created 8 new files + 2 test files, all following React.createElement pattern
- 245 tests passing after 5.1 — maintain this bar

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.5 — Acceptance criteria, BDD scenarios, lines 1298-1347]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Widget Order mockup (line 470), ReorderList component spec (line 745), dual-mode interaction pattern (line 541)]
- [Source: _bmad-output/planning-artifacts/architecture.md — TUI boundary 6, tech stack, widget definitions]
- [Source: _bmad-output/project-context.md — Technology stack (Node.js >=20, ESM, zero deps), testing conventions (node:test), error handling triad]
- [Source: _bmad-output/implementation-artifacts/5-1-app-shell-shared-components-home-screen.md — Previous story: app.js architecture, screen router pattern, component patterns, DualPreview spec, testing strategy, review findings]
- [Source: bmad-statusline/src/tui/app.js — Screen router, deriveTuiState, buildDefaultTuiState, navigate/goBack, saveConfig pattern]
- [Source: bmad-statusline/src/tui/widget-registry.js — 9 individual widgets (bmad-project through bmad-timer), buildWidgetConfig(enabledWidgets, readerPath, options)]
- [Source: bmad-statusline/src/tui/config-writer.js — saveConfig(config, paths) -> { success, error }]
- [Source: bmad-statusline/src/tui/components/DualPreview.js — Reads tuiState.widgetOrder, visibleWidgets, colorModes, separator]
- [Source: bmad-statusline/src/tui/components/ScreenLayout.js — Composes Breadcrumb + title + children + DualPreview + ShortcutBar]
- [Source: @inkjs/ui docs — Select: uncontrolled, no grab/move support; useInput(callback, { isActive })]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation, no blockers encountered.

### Completion Notes List

- Created ReorderList component with dual-mode state machine (navigate/moving), useInput-based keyboard handling, cursor navigation, grab/swap/drop/cancel, boundary constraints, and onModeChange callback for shortcut bar synchronization.
- Created WidgetOrderScreen composing ScreenLayout + ReorderList with dynamic shortcut bar (navigate vs moving), visible widget filtering from tuiState, pre-grab order snapshot via useRef for cancel revert.
- Integrated into app.js: added WidgetOrderScreen import, screen router case for 'order', handleOrderPreview (temp preview), handleOrderCommit (persist via buildWidgetConfig + saveConfig with try/catch), removed 'order' from PlaceholderScreen.
- 14 new tests covering all AC #8 scenarios: numbered list render, grab/moving state, move with onMove, drop with onDrop, cancel with revert, shortcut bar state changes, Escape back navigation, boundary constraints (top/bottom), visible widget filtering, full ID preservation.
- All 265 tests pass (251 existing + 14 new), zero regressions.

### Change Log

- 2026-03-30: Story 5.5 implementation — ReorderList component, WidgetOrderScreen, app.js integration, 14 tests

### File List

- `src/tui/components/ReorderList.js` (new) — dual-mode reorder list component
- `src/tui/screens/WidgetOrderScreen.js` (new) — Widget Order screen with ScreenLayout + ReorderList
- `src/tui/app.js` (modified) — added WidgetOrderScreen import, router case, handleOrderPreview/Commit handlers
- `src/tui/screens/PlaceholderScreen.js` (modified) — removed 'order' from SCREEN_TITLES
- `test/tui-widget-order.test.js` (new) — 14 tests for ReorderList + WidgetOrderScreen
