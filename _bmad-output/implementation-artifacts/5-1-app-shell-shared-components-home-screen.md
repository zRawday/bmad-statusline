# Story 5.1: App Shell + Shared Components + Home Screen

Status: done

## Story

As a **developer using bmad-statusline**,
I want **a redesigned TUI with modal navigation, dual-pattern preview, and a Home screen with clear configuration options**,
So that **I can launch the configurator and understand all available actions at a glance, replacing the confusing 6-section dashboard**.

## Acceptance Criteria

1. **Home screen layout:** Given the developer runs `npx bmad-statusline` (no arguments), when the TUI launches with an existing config file, then the Home screen displays: breadcrumb showing `Home` (dim grey), title "bmad-statusline configurator" (bold), Select list with 6 options (Widgets, Presets, Widget Order, Target Line, Separator Style, Reset to original), dual preview lines ("Complete:" and "Steps:" with actual ANSI colors from config), shortcut bar `↑↓ Navigate  Enter Select  q Quit` (dim text, bold keys).

2. **Quit:** Given the Home screen is displayed, when the developer presses `q`, then the TUI exits cleanly to the terminal.

3. **Navigation to sub-screens:** Given the Home screen is displayed, when the developer presses Enter on any option (except Reset to original), then the screen transitions to the corresponding screen (placeholder for screens not yet built — display screen title with Escape to go back).

4. **Config snapshot:** Given the TUI launches, when a config snapshot is taken, then the full current config state is stored in memory for Reset to original (deep copy, not reference).

5. **First launch (no config):** Given no config file exists, when the TUI launches, then the Default preset is loaded automatically and the Home screen displays with default configuration.

6. **Corrupted config:** Given the config file is corrupted (invalid JSON), when the TUI launches, then the Default preset is loaded and a StatusMessage with variant="error" explains the fallback, and the StatusMessage persists until the developer presses any key.

7. **Write failure:** Given a config write fails (I/O error), when the error occurs, then a StatusMessage "Could not save configuration. Press any key." is displayed, React state retains the new value (no data loss), and the next write operation silently retries.

8. **ScreenLayout component:** Given the ScreenLayout component, when rendered on any screen, then it enforces the vertical structure: breadcrumb -> empty line -> title -> empty line -> content area -> empty line -> Preview Complete -> Preview Steps -> empty line -> shortcut bar.

9. **DualPreview component:** Given the DualPreview component with current config, when rendered, then it displays "Complete:" (story workflow pattern with all visible widgets) and "Steps:" (step-only pattern) with actual ANSI colors and configured separator.

10. **New app.js architecture:** Given the new app.js, when inspected, then it replaces the old 693-line dashboard with a screen router managing navigation state (current screen + navigation stack for Escape back-tracking), and config-loader.js and config-writer.js are reused.

11. **Tests:** Given `test/tui-*.test.js`, when updated for this story, then tests cover: (a) ScreenLayout renders all structural elements, (b) Breadcrumb renders path with dim style, (c) DualPreview renders both pattern lines with correct widgets, (d) ShortcutBar renders actions with correct styles, (e) Home screen renders 6 options, (f) q quits, (g) first launch loads Default, (h) corrupted config shows StatusMessage fallback.

## Tasks / Subtasks

- [x] Task 1: Create shared leaf components (AC: #8, #9)
  - [x] 1.1 Create `src/tui/components/Breadcrumb.js` — `<Text dimColor>{path.join(' > ')}</Text>`
  - [x] 1.2 Create `src/tui/components/ShortcutBar.js` — dim text, bold keys from `actions` array of `{key, label}`
  - [x] 1.3 Create `src/tui/components/DualPreview.js` — renders "Complete:" and "Steps:" lines from config (see Dev Notes)
- [x] Task 2: Create ScreenLayout component (AC: #8)
  - [x] 2.1 Create `src/tui/components/ScreenLayout.js` — composes Breadcrumb + title + children + DualPreview + ShortcutBar with prescribed spacing
- [x] Task 3: Create Home screen (AC: #1, #2, #3)
  - [x] 3.1 Create `src/tui/screens/HomeScreen.js` — Select with 6 options, `q` quit via `useInput`, "Reset to original" fires config restore directly
- [x] Task 4: Create placeholder screen (AC: #3)
  - [x] 4.1 Create `src/tui/screens/PlaceholderScreen.js` — displays screen title in ScreenLayout, Escape triggers onBack
- [x] Task 5: Rewrite app.js as screen router (AC: #4, #5, #6, #7, #10)
  - [x] 5.1 Screen router: state = `{ screen: 'home'|'widgets'|'presets'|'order'|'targetLine'|'separator', navStack: [] }`
  - [x] 5.2 Navigation: `navigate(screen)` pushes to navStack, `goBack()` pops, Home has empty stack
  - [x] 5.3 Config load + snapshot: load via config-loader, deep copy snapshot for Reset, handle not-found, invalid-json, and no-bmad-widgets errors
  - [x] 5.4 Config state management: React state for widgets, order, colors, separator, targetLine — passed to DualPreview
  - [x] 5.5 Write failure handling: try/catch around saveConfig, show StatusMessage on error, retain React state
  - [x] 5.6 First launch / error fallback: when `error` is `'not-found'`, `'invalid-json'`, or `'no-bmad-widgets'`, build default config via `buildWidgetConfig(getIndividualWidgets().map(w => w.id), readerPath)` (see Dev Notes)
  - [x] 5.7 Maintain `launchTui(paths)` default export wrapper for cli.js compatibility
- [x] Task 6: Install test dependency + write tests (AC: #11)
  - [x] 6.0 Run `npm install --save-dev ink-testing-library` if not already installed
  - [x] 6.1 Create `test/tui-app.test.js` — Home renders 6 options (a-e), q quits (f), first launch loads default (g), corrupted config fallback (h)
  - [x] 6.2 Create `test/tui-components.test.js` — Breadcrumb (a-b), ShortcutBar (c-d), DualPreview (e), ScreenLayout (f)

### Review Findings

- [x] [Review][Patch] `launchTui` ne retourne plus `waitUntilExit()` — régression contrat caller [app.js:158-161]
- [x] [Review][Patch] AC #7: Write failure — pas de StatusMessage, retour `saveConfig` ignoré, try/catch inefficace [app.js:118-126]
- [x] [Review][Patch] `preserveColors: undefined` traité comme `false` → force mode fixed au lieu de dynamic [app.js:19-24]
- [x] [Review][Patch] AC #11: Tests manquants — navigation sub-screen (AC #3) et reset to original (AC #4) [test/tui-app.test.js]
- [x] [Review][Defer] Config corrompue ne peut jamais être écrasée par `saveConfig` (limitation config-writer.js) — deferred, pre-existing

## Dev Notes

### Architecture: Complete Replacement of app.js

The current `src/tui/app.js` (693 lines) is a monolithic tab-based dashboard. **Delete and rewrite it entirely.** The new architecture is a screen router:

```
app.js (screen router + state management)
├── components/
│   ├── Breadcrumb.js
│   ├── ShortcutBar.js
│   ├── DualPreview.js
│   └── ScreenLayout.js
└── screens/
    ├── HomeScreen.js
    └── PlaceholderScreen.js  (temporary, replaced in stories 5.2-5.6)
```

### REUSE These Files Unchanged

| File | Purpose | API |
|------|---------|-----|
| `config-loader.js` | Load ccstatusline config | `loadConfig(paths)` -> `{ config, bmadWidgets, currentLine, error }` |
| `config-writer.js` | Persist config with backup | `saveConfig(config, paths)` -> `{ success, error }` |
| `widget-registry.js` | Widget definitions + config builder | `getIndividualWidgets()`, `buildWidgetConfig()`, `CCSTATUSLINE_COLORS` |

### NO JSX — Use React.createElement

The project has **zero build tooling** (no Babel, no transpilation). The current app.js uses `const e = React.createElement` throughout. **Continue this pattern.** All code samples in this story use JSX for readability, but the dev agent MUST translate to `React.createElement` calls:

```js
// JSX (for documentation only):  <Text bold>title</Text>
// Actual code:                    e(Text, { bold: true }, 'title')
```

### launchTui Export Contract (DO NOT BREAK)

`bin/cli.js` imports and calls the default export: `const { default: launchTui } = await import('../src/tui/app.js'); await launchTui(paths);`

The rewritten app.js **must** maintain this contract:

```js
export default function launchTui(paths) {
  const { render } = await import('ink'); // or static import
  render(e(App, { paths }));
}
```

### @inkjs/ui Select API (v2.0)

The Select component is **uncontrolled**. Key props:

```js
// React.createElement pattern:
e(Select, {
  options: [{ label: 'Widgets', value: 'widgets' }, ...],
  onChange: (value) => navigate(value),  // fires on Enter
  visibleOptionCount: 6
})
```

- `options`: `Array<{ label: string, value: string }>`
- `onChange(value: string)`: fires when user presses Enter on an option
- `visibleOptionCount`: number of visible items (default 5)
- `defaultValue`: pre-select an option
- `isDisabled`: ignore input when true
- **No `onHighlight` callback exists** — try-before-you-buy preview (needed in stories 5.3-5.6) will require `useInput`-based custom select. Not needed for Home screen.

### StatusMessage API (v2.0)

```js
import { StatusMessage } from '@inkjs/ui';

<StatusMessage variant="error">Config file corrupted. Loading defaults. Press any key.</StatusMessage>
```

Variants: `'info' | 'success' | 'error' | 'warning'`

### DualPreview Implementation

Renders two hardcoded sample patterns showing how the statusline looks with current config:

**Complete pattern** (story workflows — all visible widgets):
`myproject ┃ dev-story ┃ 4.2 - Auth Login ┃ Tasks 2/5 ┃ 12:34`

**Steps pattern** (step-only workflows — no story widget):
`myproject ┃ brainstorming ┃ Steps 3/7 Discover ┃ 12:34`

Sample data map (hardcoded strings for preview):

| Widget ID | Complete value | Steps value |
|-----------|---------------|-------------|
| project | `myproject` | `myproject` |
| workflow | `dev-story` | `brainstorming` |
| step | (not shown standalone) | (not shown standalone) |
| nextstep | (not shown standalone) | (not shown standalone) |
| progress | (not shown standalone) | (not shown standalone) |
| progressbar | (not shown standalone) | (not shown standalone) |
| progressstep | `Tasks 2/5` | `Steps 3/7 Discover` |
| story | `4.2 - Auth Login` | _(excluded)_ |
| timer | `12:34` | `12:34` |

For each visible widget (respecting user's visibility config and order):
1. Look up sample value from map above (widgets with bmad- prefix: `bmad-project`, `bmad-workflow`, etc.)
2. Apply ANSI color: if `colorMode === 'fixed'`, use `fixedColor`; if `'dynamic'`, use a default color per widget
3. Join with visual separator (see below)
4. Render as `e(Text, null, 'Complete:  ')` + colored widget segments

**Separator rendering — IMPORTANT DISTINCTION:**
The ccstatusline config uses **space-based** separators (from widget-registry `SEPARATOR_STYLES`: `serre`=3sp, `modere`=6sp, `large`=15sp). But the DualPreview renders a **visual** representation using box-drawing characters for clarity. The DualPreview uses its own visual separator map:
- `serre` (tight): `'┃'`
- `modere` (moderate): `' ┃ '`
- `large` (wide): `'  ┃  '`
- `custom`: render the actual custom separator string

**Props:** `tuiState` object (see Internal Config State Model below)

### Internal Config State Model (TUI State)

The raw ccstatusline config (`loadConfig().config`) is a complex nested structure (`lines` array of widget arrays). The TUI needs an intermediate state model for its screens and DualPreview. Derive this at load time from `loadConfig()` return fields:

```js
// From loadConfig() result:
// result.config      — raw ccstatusline settings.json
// result.bmadWidgets — array of BMAD widget objects from config
// result.currentLine — index of line containing BMAD widgets

// Derive TUI state:
const tuiState = {
  visibleWidgets: result.bmadWidgets.map(w => w.id),  // ['bmad-project', 'bmad-workflow', ...]
  widgetOrder: result.bmadWidgets.map(w => w.id),      // ordered as found in config
  colorModes: {},    // { 'bmad-timer': { mode: 'fixed', fixedColor: 'red' }, ... }
  separator: 'modere',  // detected from config spacing
  targetLine: result.currentLine,  // 0, 1, or 2
  rawConfig: result.config,        // preserved for saveConfig()
};
```

Color mode detection: inspect each widget's `color` and `preserveColors` properties. If `preserveColors: true`, mode is `'dynamic'`. If a fixed color string is set, mode is `'fixed'` with that color.

### Building Default Config (No Existing Config)

When `loadConfig()` returns an error (`'not-found'`, `'invalid-json'`, or `'no-bmad-widgets'`), build a default config using the widget-registry API:

```js
import { getIndividualWidgets, buildWidgetConfig } from './widget-registry.js';

const readerPath = path.join(os.homedir(), '.config', 'bmad-statusline', 'bmad-sl-reader.js');
const allWidgets = getIndividualWidgets();
const defaultEnabled = allWidgets.map(w => w.id);  // all 9 widgets enabled by default
const defaultConfig = buildWidgetConfig(defaultEnabled, readerPath);
// Then derive tuiState from defaultConfig
```

**Do NOT call `buildDefaultConfig()`** — that function does not exist. Use `buildWidgetConfig()` with all widget IDs.

### Screen Router Pattern

```js
function App({ paths }) {
  const { exit } = useApp();  // Ink's clean exit — NOT process.exit()
  const [screen, setScreen] = useState('home');
  const [navStack, setNavStack] = useState([]);
  const [tuiState, setTuiState] = useState(null);
  const [snapshot, setSnapshot] = useState(null);  // deep copy at launch
  const [statusMessage, setStatusMessage] = useState(null);

  // Load config on mount
  useEffect(() => {
    const result = loadConfig(paths);
    if (result.error === 'not-found' || result.error === 'no-bmad-widgets') {
      // First launch or empty config: build default
      const state = buildDefaultTuiState(paths);
      setTuiState(state);
      setSnapshot(structuredClone(state));
    } else if (result.error === 'invalid-json') {
      const state = buildDefaultTuiState(paths);
      setTuiState(state);
      setSnapshot(structuredClone(state));
      setStatusMessage({ variant: 'error', text: 'Config file corrupted. Loading defaults. Press any key.' });
    } else {
      const state = deriveTuiState(result);
      setTuiState(state);
      setSnapshot(structuredClone(state));
    }
  }, []);

  const navigate = (screenName) => {
    setNavStack(prev => [...prev, screen]);
    setScreen(screenName);
  };

  const goBack = () => {
    if (navStack.length > 0) {
      setScreen(navStack[navStack.length - 1]);
      setNavStack(prev => prev.slice(0, -1));
    }
  };

  // Reset to original = restore snapshot
  const resetToOriginal = () => {
    const restored = structuredClone(snapshot);
    setTuiState(restored);
    // persist to file via saveConfig
  };

  // Render current screen
  // ...
}
```

### Deep Copy for Snapshot

Use `structuredClone()` (Node.js >= 17, project requires >= 20). True deep copy prevents reference sharing between snapshot and working config.

### Error Display Flow

When `statusMessage` is set:
1. Show `<StatusMessage variant={statusMessage.variant}>{statusMessage.text}</StatusMessage>` overlay
2. Use `useInput` to listen for any keypress
3. On keypress: `setStatusMessage(null)`, resume normal screen

### Home Screen Options

```js
const HOME_OPTIONS = [
  { label: 'Widgets              Configure individual widgets', value: 'widgets' },
  { label: 'Presets              Default + 3 custom presets', value: 'presets' },
  { label: 'Widget Order         Reorder widget sequence', value: 'order' },
  { label: 'Target Line          Choose status bar line (0, 1, 2)', value: 'targetLine' },
  { label: 'Separator Style      tight / moderate / wide / custom', value: 'separator' },
  { label: 'Reset to original    Restore launch configuration', value: 'reset' },
];
```

When `onChange` fires with `'reset'`, call `resetToOriginal()` directly instead of navigating. All other values call `navigate(value)`.

**Note:** "Presets" replaces the old "Composite Mode" from the current TUI. The UX redesign consolidates composite modes into presets (Default + 3 custom slots). The old composite mode selector is removed entirely.

### Quit Handling

On Home screen, `useInput` listens for `q`. Use Ink's `useApp().exit()` for clean teardown — **NOT `process.exit()`** which can leave the terminal in a dirty state:
```js
const { exit } = useApp();
useInput((input, key) => {
  if (input === 'q') {
    exit();  // Ink cleanup restores terminal state
  }
}, { isActive: screen === 'home' && !statusMessage });
```

### Vertical Layout (ScreenLayout)

Every screen wrapped by ScreenLayout. Structure with Ink `<Box flexDirection="column">`:

```
<Box flexDirection="column">
  <Breadcrumb path={breadcrumb} />        {/* dim grey */}
  <Text> </Text>                          {/* empty separator line */}
  <Text bold>{title}</Text>               {/* bold title */}
  <Text> </Text>                          {/* empty separator line */}
  {children}                              {/* content area — fills space */}
  <Text> </Text>                          {/* empty separator line */}
  <DualPreview config={config} />         {/* 2 lines */}
  <Text> </Text>                          {/* empty separator line */}
  <ShortcutBar actions={shortcuts} />     {/* dim + bold keys */}
</Box>
```

### Testing Strategy

Tests use `node:test` + `node:assert/strict`. For React/Ink component testing, use `ink-testing-library`.

**FIRST: Install test dependency** — `ink-testing-library` is NOT currently in devDependencies:
```sh
cd bmad-statusline && npm install --save-dev ink-testing-library
```

**Test example** (using React.createElement, not JSX):
```js
import React from 'react';
import { render } from 'ink-testing-library';
import { Breadcrumb } from '../src/tui/components/Breadcrumb.js';
const e = React.createElement;

const { lastFrame } = render(e(Breadcrumb, { path: ['Home', 'Widgets'] }));
assert.ok(lastFrame().includes('Home > Widgets'));
```

**Test files:**
- `test/tui-components.test.js` — Breadcrumb (a-b), ShortcutBar (c-d), DualPreview (e), ScreenLayout (f)
- `test/tui-app.test.js` — Home renders 6 options (e), q quits (f), first launch default (g), corrupted config fallback (h)

### Existing TUI Test Files (Do NOT Modify)

| File | Tests | Status |
|------|-------|--------|
| `test/tui-config-loader.test.js` | config-loader.js | Keep unchanged |
| `test/tui-config-writer.test.js` | config-writer.js | Keep unchanged |
| `test/tui-widget-registry.test.js` | widget-registry.js | Keep unchanged |

### What This Story Does NOT Do

- Does NOT build the Widgets List screen (Story 5.2)
- Does NOT build Color Mode/Color Picker screens (Story 5.3)
- Does NOT build Target Line, Separator, or Reset logic beyond Home Select dispatch (Story 5.4)
- Does NOT build Widget Order / ReorderList (Story 5.5)
- Does NOT build Presets / ConfirmDialog (Story 5.6)
- Does NOT modify config-loader.js, config-writer.js, or widget-registry.js
- Does NOT modify any hook, reader, or installer code

### Project Structure Notes

- All new TUI files are ESM (`import`/`export`)
- Create `src/tui/components/` and `src/tui/screens/` directories
- `src/tui/app.js` is the entry point — rewritten, not patched
- Run tests: `npm test` from `bmad-statusline/` (runs `node --test test/*.test.js`)
- Currently 230+ tests passing — new tests must not break existing ones

### Previous Story Intelligence

From Story 4.8 (last completed story):
- Test patterns: `node:test` + `node:assert/strict`, temp dirs via `fs.mkdtempSync`
- All file I/O is synchronous (`fs.readFileSync`, `fs.writeFileSync`)
- Code review found TOCTOU race conditions — be defensive with try/catch around file ops
- Project uses verbose logging for installer-family code (not applicable to TUI)

### Git Intelligence

Recent commits show consistent patterns:
- Commit format: `{story-key}: {description}` (e.g., `4-8-clean-alive-readme: Clean — alive-based cleanup + README update`)
- Code review corrections follow: `fix({story-key}): code review corrections`
- The codebase is well-tested with 230+ tests — maintain this standard

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.1 — Acceptance criteria, BDD scenarios]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Screen mockups, component strategy, interaction patterns, visual design, DualPreview spec]
- [Source: _bmad-output/planning-artifacts/architecture.md — Project directory structure (line 780+), TUI boundary 6, widget definitions, tech stack]
- [Source: _bmad-output/project-context.md — Technology stack (Node.js >=20, ESM, zero deps), testing conventions (node:test)]
- [Source: _bmad-output/implementation-artifacts/4-8-clean-alive-readme.md — Previous story: test patterns, review findings]
- [Source: bmad-statusline/src/tui/config-loader.js — loadConfig() API: returns { config, bmadWidgets, currentLine, error }]
- [Source: bmad-statusline/src/tui/config-writer.js — saveConfig() API: returns { success, error }, creates backup, validates]
- [Source: bmad-statusline/src/tui/widget-registry.js — getIndividualWidgets() (9 widgets), buildWidgetConfig(), CCSTATUSLINE_COLORS (16 colors)]
- [Source: @inkjs/ui docs — Select: uncontrolled, onChange(value), no onHighlight; StatusMessage: variant prop]
- [Source: ink docs — useInput(callback, { isActive }), Box flexDirection, Text bold/dimColor]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Task 1: Created 3 leaf components (Breadcrumb, ShortcutBar, DualPreview) using React.createElement pattern, no JSX
- Task 2: Created ScreenLayout composing all leaf components with prescribed vertical spacing
- Task 3: Created HomeScreen with 6 Select options, q quit via useInput, Reset dispatch via onChange
- Task 4: Created PlaceholderScreen with Escape back navigation for all unbuilt screens
- Task 5: Rewrote app.js from 693-line monolithic dashboard to ~130-line screen router. Implements deriveTuiState() for existing configs and buildDefaultTuiState() for first launch/error fallback. Uses structuredClone for snapshot. StatusMessage overlay with any-key dismiss. Maintains launchTui default export contract.
- Task 6: Installed ink-testing-library. Created 14 new tests (9 component + 5 app) covering all AC #11 sub-items. Full suite: 245 tests, 0 failures.

### Change Log

- 2026-03-30: Story 5.1 implementation complete — TUI redesign app shell, shared components, Home screen

### File List

New files:
- bmad-statusline/src/tui/components/Breadcrumb.js
- bmad-statusline/src/tui/components/ShortcutBar.js
- bmad-statusline/src/tui/components/DualPreview.js
- bmad-statusline/src/tui/components/ScreenLayout.js
- bmad-statusline/src/tui/screens/HomeScreen.js
- bmad-statusline/src/tui/screens/PlaceholderScreen.js
- bmad-statusline/test/tui-app.test.js
- bmad-statusline/test/tui-components.test.js

Modified files:
- bmad-statusline/src/tui/app.js (complete rewrite)
- bmad-statusline/package.json (added ink-testing-library devDependency)
