---
project_name: 'bmad-statusline'
user_name: 'Fred'
date: '2026-03-31'
sections_completed: ['technology_stack', 'critical_rules_patterns_0_13', 'tui_v2_patterns_14_20', 'hook_architecture', 'status_file_contract', 'internal_config_schema', 'reader_multiline', 'dead_code_removal', 'architectural_boundaries', 'tui_state_model', 'bug_fix_architecture', 'testing_conventions', 'code_conventions', 'installer_deployment']
status: 'complete'
completedAt: '2026-03-31'
existing_patterns_found: 21
rule_count: 67
optimized_for_llm: true
source_documents:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
  - '_bmad-output/planning-artifacts/architecture.md (Rev.3)'
  - '_bmad-output/planning-artifacts/epics.md'
epic_status: 'Epics 1-5 delivered, Epic 6 planned (TUI v2)'
---

# Project Context for AI Agents

_Critical rules and patterns that AI agents must follow when implementing code in bmad-statusline. Architecture is hook-based (passive extraction via Claude Code hooks). This document reflects the **prescribed state** for TUI v2 (Epic 6) from Architecture Rev.3, PRD v2, and UX Design Spec v2. Hook/reader/installer rules from Epics 1-4 remain valid and are preserved._

**Convention:** Sections marked **[CURRENT]** describe what exists in code today. Sections marked **[PRESCRIBED]** describe what Architecture Rev.3 prescribes for Epic 6 implementation.

---

## Technology Stack & Versions

- **Runtime:** Node.js >= 20
- **Language:** JavaScript (no TypeScript)
- **Package module system:** ESM (`"type": "module"` in package.json, `import`/`export`)
- **Reader module system:** Standalone CommonJS (`require`) — deployed artifact, never imported by package code. CJS marker: `src/reader/package.json`
- **Hook module system:** Standalone CommonJS (`require`) — deployed artifact, same pattern as reader. CJS marker: `src/hook/package.json`
- **Runtime dependencies:** Zero (Node.js stdlib only — reader, hook, installer)
- **TUI dependencies:** `ink` (v6.8.0), `react` (v19.2.4), `@inkjs/ui` (v2.0.0) — scoped to `src/tui/` only
- **Testing:** `node:test` + `node:assert/strict` (built-in, zero dev deps), `ink-testing-library` (v4.0.0) for TUI component tests
- **Build:** No build step (plain JS, no transpilation)
- **npm scripts:** `"test": "node --test test/*.test.js"`
- **Compatibility:** ccstatusline >= 2.2 (custom-command widget support, preserveColors)
- **Platform:** Cross-platform — Windows (Git Bash), macOS, Linux

---

## Critical Implementation Rules [CURRENT]

_Patterns 0-13 from Architecture Rev.3 — preserved from Rev.2 (hook/reader/installer). These are load-bearing rules that apply to all Epics._

### Pattern 0 — Hook Entry Point Structure

The hook script follows this exact structure: Requires -> Constants -> Stdin parsing (try/catch -> silent exit) -> Guard (`_bmad/` check) -> Alive touch -> Dispatch on `hook_event_name` -> Handlers -> Story priority helper -> Status file helpers -> Main entry. **Rule:** Constants -> helpers -> handlers -> main.

### Pattern 1 — Error Handling Triad

Four components with **different** error handling philosophies. Check which component you are in before writing any error-related code.

| Component | Philosophy | Pattern |
|-----------|-----------|---------|
| Reader (`src/reader/`) | **Silent always** | Return empty string on any error. Never `console.log`, never `console.error`, never throw. |
| Hook (`src/hook/`) | **Silent always** | No output ever. Never `console.log`, never `console.error`, never throw. Exit silently on any error. Must never interfere with Claude Code. |
| Installer (`src/install.js`, etc.) | **Verbose always** | Log every action with `logSuccess`/`logSkipped`/`logError` helpers. |
| TUI (`src/tui/`) | **StatusMessage on error** | Display via Ink StatusMessage, persist until keypress. Never console.log. Never crash to terminal on recoverable error. |

### Pattern 2 — Synchronous File I/O Everywhere

**Never** use `fs.promises`, `fs.readFile` (callback), or `async/await` for file operations. Always `fs.readFileSync` / `fs.writeFileSync`. Applies to hook, reader, installer, AND TUI config reads/writes.

**This is load-bearing, not a style choice.** Synchronous I/O prevents race conditions between sequential hook invocations.

### Pattern 3 — ANSI Color Wrapping

All ANSI coloring in the reader via `colorize()` helper. Never inline escape codes. In the TUI, use Ink's `<Text color={...}>` props — never ANSI escapes in React components.

### Pattern 4 — Config JSON Mutation Sequence (Installer + TUI ccstatusline sync)

```
read -> parse -> backup(.bak) -> modify in memory -> stringify(null, 2) -> write -> reread -> parse(validate)
```

Applies ONLY to ccstatusline config writes from installer and TUI ccstatusline sync. Does NOT apply to internal config writes (pattern 14).

### Pattern 5 — Path Construction

- **Installer:** `path.join()` everywhere, all paths through injected `paths` parameter. Never call `os.homedir()` directly inside a function.
- **Reader + Hook:** Respect `BMAD_CACHE_DIR` env var: `process.env.BMAD_CACHE_DIR || path.join(os.homedir(), '.cache', 'bmad-status')`
- **Reader + TUI:** Respect `BMAD_CONFIG_DIR` env var: `process.env.BMAD_CONFIG_DIR || path.join(os.homedir(), '.config', 'bmad-statusline')`
- **Internal config path:** `path.join(BMAD_CONFIG_DIR, 'config.json')` — same env var in reader and TUI.

### Pattern 6 — Console Output Format (Installer Only)

```js
function logSuccess(target, message) { console.log(`  ✓ ${target} — ${message}`); }
function logSkipped(target, message) { console.log(`  ○ ${target} — ${message}`); }
function logError(target, message)   { console.log(`  ✗ ${target} — ${message}`); }
```

Format: 2 spaces + marker + space + target + em dash + description. Helpers defined locally in each command file.

### Pattern 7 — Hook Stdin Parsing

Dispatch on `hook_event_name` first, then `tool_name`. All stdin parsing wrapped in try/catch — any failure -> silent exit (exit code 0).

### Pattern 8 — Hook Status File I/O (Cache Pattern)

```
read existing (or create defaults) -> merge new fields -> stringify(null, 2) -> write
```

No backup, no validation post-write. Read-before-write mandatory. Create cache dir if absent. `updated_at` set on every write. Session ID validation via `isSafeId()` (regex: `/^[a-zA-Z0-9_-]+$/`).

### Pattern 9 — Hook Path Matching

All patterns on normalized paths (forward slashes). Always validate step/story path belongs to active **skill** before updating status.

```js
function normalize(p) { return p.replace(/\\/g, '/'); }
const skillDir = normalize(path.join(cwd, '.claude', 'skills', activeSkill));
if (!normalize(filePath).startsWith(skillDir)) return;
```

### Pattern 10 — Skill Name Normalization

```js
const SKILL_REGEX = /((?:bmad|gds|wds)-[\w-]+)/;
const workflowName = skillName.slice(skillName.indexOf('-') + 1);
```

`skillName` for path construction. `workflowName` for display + color lookup. Dynamic slicer — never hardcode `slice(5)`.

### Pattern 11 — cwd Scoping

```js
function isInProject(filePath, cwd) {
  return normalize(filePath).startsWith(normalize(cwd));
}
```

First check in Read/Write/Edit handlers, before any pattern matching.

### Pattern 12 — Story Priority Resolution

```js
function shouldUpdateStory(incomingPriority, currentPriority) {
  if (incomingPriority === 1) return true;
  if (incomingPriority === 2 && (!currentPriority || currentPriority === 3)) return true;
  if (incomingPriority === 3 && !currentPriority) return true;
  return false;
}
```

Never set story directly without priority check. Workflow gating via `STORY_WORKFLOWS`.

### Pattern 13 — Step Multi-Track Detection

```js
const STEP_REGEX = /\/steps(-[a-z])?\/step-(?:[a-z]-)?(\d+)-(.+)\.md$/;
```

Total per track directory. Recalculate if track changes.

---

## TUI v2 Implementation Patterns [PRESCRIBED]

_Patterns 14-20 from Architecture Rev.3 — new for Epic 6. These govern all TUI v2 code._

### Pattern 14 — Internal Config I/O

**Write pattern (TUI side — lightweight, our own file):**

```js
const CONFIG_DIR = process.env.BMAD_CONFIG_DIR || path.join(os.homedir(), '.config', 'bmad-statusline');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

function writeInternalConfig(config) {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
  } catch {
    // Write failure — config state preserved in React, retry on next interaction
  }
}
```

**Read pattern (shared by TUI and reader):**

```js
function readInternalConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return null; // caller falls back to defaults or empty string
  }
}
```

**Rules:**
- No backup before write (unlike ccstatusline — pattern 4). This is bmad-statusline's own file.
- No validation post-write. If corrupted, next TUI launch falls back to defaults.
- `BMAD_CONFIG_DIR` env var must be used in both TUI and reader for testability.
- `JSON.stringify(config, null, 2) + '\n'` — 2-space indent, trailing newline.
- Synchronous I/O (pattern 2).

### Pattern 15 — TUI State Mutation

**Rule: Never mutate config directly. Always produce a new object.**

```js
// CORRECT — structuredClone + setConfig
function updateConfig(mutator) {
  setConfig(prev => {
    const next = structuredClone(prev);
    mutator(next);
    writeInternalConfig(next);
    syncCcstatuslineIfNeeded(prev, next);
    return next;
  });
}

// WRONG — direct mutation
config.lines[0].widgets.push(widgetId);
setConfig(config); // React won't detect the change — same reference
```

**Rules:**
- `structuredClone` for deep copy — never spread operator (shallow copy misses nested objects).
- Disk write inside the `setConfig` callback (or `updateConfig` helper) — never in a `useEffect`.
- No `useEffect` that reads `config` and writes `config` — this is the BF2 render loop root cause.

### Pattern 16 — ccstatusline Sync Pattern

**When to sync:** Only when a line's non-empty status changes (widgets array goes from length 0 to length > 0 or vice versa). NOT on every config change.

```js
function syncCcstatuslineIfNeeded(oldConfig, newConfig) {
  let needsSync = false;
  for (let i = 0; i < 3; i++) {
    const wasEmpty = oldConfig.lines[i].widgets.length === 0;
    const isEmpty = newConfig.lines[i].widgets.length === 0;
    if (wasEmpty !== isEmpty) { needsSync = true; break; }
  }
  if (!needsSync) return;
  // Full rebuild — backup/validate sequence (pattern 4) for ccstatusline writes
}
```

**ccstatusline widget format:**

```js
{ id: `bmad-line-${lineIndex}`, type: 'custom-command',
  commandPath: `node "${readerPath}" line ${lineIndex}`, preserveColors: true }
```

**Rules:**
- ccstatusline config writes follow pattern 4 (backup/validate). Internal config writes follow pattern 14 (no backup).
- On `resetToOriginal`, use `syncCcstatuslineFromScratch` — rebuild all 3 lines from scratch.
- `readerPath` = `path.join(BMAD_CONFIG_DIR, 'bmad-sl-reader.js')`.

### Pattern 17 — Preview Override (Try-Before-You-Buy)

Two-layer rendering — `config` (persisted truth) and `previewOverride` (transient).

```js
const effectiveConfig = previewOverride || config;

// On highlight (arrow): setPreviewOverride(configWithChange)
// On select (Enter): updateConfig(...) + setPreviewOverride(null)
// On cancel (Escape): setPreviewOverride(null)
// goBack() also clears previewOverride
```

**Rules:**
- `previewOverride` is NEVER written to disk — transient React state only.
- `setPreviewOverride(null)` in `goBack()` — always clear on navigation back.
- Screens with preview-on-highlight: Color Picker, Separator Style, Preset Load.
- Screens without: Home, Edit Line (changes are immediate via h/g shortcuts).

### Pattern 18 — Screen Props Contract

Every screen component receives a standard props interface:

```js
{
  config,              // current persisted config
  updateConfig,        // (mutator) => void — pattern 15
  previewOverride,     // config | null — pattern 17
  setPreviewOverride,  // (config | null) => void
  navigate,            // (screenName, context?) => void
  goBack,              // () => void
  editingLine,         // 0|1|2|null
  selectedWidget,      // widget ID | null
}
```

**Rules:**
- Screens never call `setConfig` directly — always through `updateConfig`.
- Screens never read ccstatusline config — only internal config via `config` prop.
- Screens never write to disk — `updateConfig` handles persistence.
- Sub-screens inherit `editingLine` from parent Edit Line context.

### Pattern 19 — Color Resolution in Preview

Centralized in a helper function — not duplicated per component:

```js
function resolvePreviewColor(widgetId, colorModes) {
  const mode = colorModes[widgetId];
  if (!mode) return getDefaultColor(widgetId);
  if (mode.mode === 'dynamic') return WORKFLOW_SAMPLE_COLOR;
  return mode.fixedColor;
}
```

**Used by:** ThreeLinePreview, EditLineScreen, PresetScreen.

**Rules:**
- `WORKFLOW_SAMPLE_COLOR` is a constant, not computed from WORKFLOW_COLORS.
- `getDefaultColor(widgetId)` reads from `INDIVIDUAL_WIDGETS[].defaultColor`.
- Lives in `src/tui/preview-utils.js` — shared TUI utility, never duplicated.

### Pattern 20 — Reader Internal Config Reading

Same `BMAD_CONFIG_DIR` env var as TUI (pattern 5). Reader-specific constraints:

```js
function readLineConfig(lineIndex) {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    if (!config.lines || !config.lines[lineIndex]) return null;
    return { widgets: config.lines[lineIndex].widgets || [],
             colorModes: config.lines[lineIndex].colorModes || {},
             separator: config.separator || 'serre',
             customSeparator: config.customSeparator || null };
  } catch { return null; }
}
```

**Rules:**
- Reader NEVER writes to config.json — read-only consumer.
- Reader separator map is its OWN CJS copy. Must stay in sync manually with TUI.
- Reader ALWAYS returns empty string on any error.

---

## Hook Architecture [CURRENT]

The hook is the **central component** — sole writer of status data. Unchanged in Rev.3.

### Signal Architecture (5 signals, 3 event types)

| Signal | Event | Purpose | Key Fields |
|--------|-------|---------|------------|
| **UserPromptSubmit** | `hook_event_name: "UserPromptSubmit"` | Sets active workflow | `prompt` |
| **PostToolUse Read** | `tool_name: "Read"` | Updates step, story candidate, project | `tool_input.file_path`, `tool_response.file.content` |
| **PostToolUse Write** | `tool_name: "Write"` | Story confirmation (sprint-status, story file) | `tool_input.file_path`, `tool_input.content` |
| **PostToolUse Edit** | `tool_name: "Edit"` | Story confirmation (sprint-status edit) | `tool_input.file_path`, `tool_input.new_string` |
| **SessionStart** | `hook_event_name: "SessionStart"` | Session persistence | Matcher `"resume"` only |

### Hook Config (5 matchers, 3 event types)

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "matcher": "(?:bmad|gds|wds)-", "hooks": [{ "type": "command", "command": "node ~/.config/bmad-statusline/bmad-hook.js" }] }
    ],
    "PostToolUse": [
      { "matcher": "Read", "hooks": [{ "type": "command", "command": "node ~/.config/bmad-statusline/bmad-hook.js" }] },
      { "matcher": "Write", "hooks": [{ "type": "command", "command": "node ~/.config/bmad-statusline/bmad-hook.js" }] },
      { "matcher": "Edit", "hooks": [{ "type": "command", "command": "node ~/.config/bmad-statusline/bmad-hook.js" }] }
    ],
    "SessionStart": [
      { "matcher": "resume", "hooks": [{ "type": "command", "command": "node ~/.config/bmad-statusline/bmad-hook.js" }] }
    ]
  }
}
```

### Discrimination Logic (Complete Truth Table)

| Event | Condition | Action |
|-------|-----------|--------|
| **UserPromptSubmit** | Prompt matches regex AND `steps*/` exists | Set workflow active, store `skill` + `workflow`, reset `started_at` if changed |
| **UserPromptSubmit** | Prompt matches but no `steps*/` | Ignore (utility skill), preserve status |
| **UserPromptSubmit** | No match | Ignore |
| **Read** `steps*/step-*.md` | Path in `steps*/` of active skill, main step | Update `step.current`, `step.current_name`, derive `next`; calculate total if first Read |
| **Read** `stories/*.md` | Workflow in `STORY_READ_WORKFLOWS` AND story not locked <= priority 2 | Set story (priority 2, locks) |
| **Read** `sprint-status*.yaml` | Unique candidate AND no story set | Set story (priority 3, candidate only) |
| **Read** (other) | Always | Ignore |
| **Write** `sprint-status*.yaml` | Workflow in `STORY_WORKFLOWS`, parse YAML | Set story (priority 1, always overwrites) |
| **Write** `stories/*.md` | Workflow is `create-story`, story not locked <= priority 2 | Set story (priority 2, locks) |
| **Write** (other) | Always | Ignore |
| **Edit** `sprint-status*.yaml` | Workflow in `STORY_WORKFLOWS`, `new_string` contains story key | Set story (priority 1, always overwrites) |
| **Edit** (other) | Always | Ignore |
| **SessionStart** | Always (matcher ensures resume only) | Touch `.alive-{session_id}` |

All Read/Write/Edit gated by cwd scoping (pattern 11).

---

## Status File Schema [CURRENT] (Hook<->Reader Interface Contract)

The status file is the **only coupling** between the hook (writer) and reader (consumer). Both must agree on this exact schema.

Location: `~/.cache/bmad-status/status-{session_id}.json`

```json
{
  "session_id": "<string>",
  "project": "<string>",
  "skill": "<full skill name — hook-internal>",
  "workflow": "<stripped name for display>",
  "story": "<slug or null>",
  "story_priority": "<1|2|3|null — hook-internal>",
  "step": {
    "current": 3, "current_name": "starter",
    "next": 4, "next_name": "decisions",
    "total": 8, "track": "-c"
  },
  "started_at": "<ISO 8601>",
  "updated_at": "<ISO 8601>"
}
```

**Type rules:**
- `step.current`, `step.next`, `step.total` are **numbers** (not strings)
- `story` is **null** when no story is active (not empty string, not absent)
- `workflow` is the stripped name (`create-architecture`, not `bmad-create-architecture`)
- Reader-visible: `session_id`, `project`, `workflow`, `story`, `step.*`, `started_at`, `updated_at`
- Hook-internal: `skill`, `story_priority`, `step.track`

**Progress calculation:** Reader uses `(step.current - 1) / step.total` — reading step N means N-1 is completed.

---

## Internal Config Schema [PRESCRIBED] (TUI<->Reader Contract)

Location: `~/.config/bmad-statusline/config.json`
Written by: TUI (every interaction) and installer (default on first install)
Read by: Reader (for `line N` command) and TUI (on launch)

```json
{
  "separator": "serre",
  "customSeparator": null,
  "lines": [
    {
      "widgets": ["bmad-project", "bmad-workflow", "bmad-progressstep", "bmad-story", "bmad-timer"],
      "colorModes": {
        "bmad-project": { "mode": "fixed", "fixedColor": "cyan" },
        "bmad-workflow": { "mode": "dynamic" },
        "bmad-progressstep": { "mode": "fixed", "fixedColor": "brightCyan" },
        "bmad-story": { "mode": "fixed", "fixedColor": "magenta" },
        "bmad-timer": { "mode": "fixed", "fixedColor": "brightBlack" }
      }
    },
    { "widgets": [], "colorModes": {} },
    { "widgets": [], "colorModes": {} }
  ],
  "presets": [null, null, null]
}
```

**Schema rules:**
- `separator` is global (top-level). Values: `"serre"`, `"modere"`, `"large"`, `"custom"`.
- `customSeparator` is a string, only used when `separator === "custom"`. Null otherwise.
- `lines` is always length 3. Each line has `widgets` (ordered array of visible widget IDs) and `colorModes` (map of widget ID to color config).
- `widgets` array contains only **visible** widgets in **display order**. A widget not in any line's `widgets` is hidden everywhere. A widget CAN appear on multiple lines.
- `colorModes` contains entries for all widgets configured on this line (including hidden ones — preserves color across hide/show cycles).
- `colorModes[id].mode` is `"dynamic"` (only valid for `bmad-workflow`) or `"fixed"`. When `"fixed"`, `fixedColor` is an ANSI color name.
- `presets` is always length 3. Each slot is null (empty) or a preset object `{ name, widgets, colorModes }`.

**Default widget colors:**

| Widget | defaultMode | defaultColor |
|--------|------------|-------------|
| bmad-project | fixed | cyan |
| bmad-workflow | dynamic | — |
| bmad-step | fixed | yellow |
| bmad-nextstep | fixed | yellow |
| bmad-progress | fixed | green |
| bmad-progressbar | fixed | green |
| bmad-progressstep | fixed | brightCyan |
| bmad-story | fixed | magenta |
| bmad-timer | fixed | brightBlack |

Default visible widgets (line 0): project, workflow, progressstep, story, timer. Lines 1-2 empty.

---

## Reader Multi-Line Architecture [PRESCRIBED]

### `line N` Command

**Invocation:** `node bmad-sl-reader.js line 0` (argv[2] = `"line"`, argv[3] = `"0"|"1"|"2"`)

**Execution sequence:**
1. Parse stdin for `session_id` (existing pattern)
2. Read status file (existing pattern)
3. Read internal config `config.json` (NEW — pattern 20)
4. Extract line config: `internalConfig.lines[lineIndex]`
5. If line has no widgets or config missing -> return empty string
6. Resolve separator from config
7. For each widget ID in `line.widgets`: call existing individual extractor, apply color from `colorModes`
8. Join non-empty segments with separator
9. Output to stdout

**Color application in `line N`:**
- `mode: "dynamic"` -> leave extractor output as-is (only workflow produces ANSI)
- `mode: "fixed"` -> `colorize(value, fixedColor)` (strip any existing ANSI first)

**Story Name Formatting:**

```js
function formatStoryName(slug) {
  if (!slug) return '';
  const match = slug.match(/^(\d+-\d+)-(.+)$/);
  if (!match) return slug;
  const title = match[2].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return `${match[1]} ${title}`;
}
```

- Input: `5-3-auth-login` -> Output: `5-3 Auth Login`

**Separator map (reader-internal, CJS):**

```js
const SEPARATORS = { serre: '\u2503', modere: ' \u2503 ', large: '  \u2503  ' };
```

**Removed commands:** `compact`, `full`, `minimal` — deleted. Unknown commands fall through to empty output.

**Workflow colors:** No `white` in any workflow color. `document-project` and `generate-project-context` changed to visible colors. Closely-used workflows must have distinct colors.

---

## Dead Code Removal Scope [PRESCRIBED]

| Element | File | Action |
|---------|------|--------|
| `COMPOSITE_WIDGETS` array | `widget-registry.js` | **Delete** |
| `getCompositeWidgets()` | `widget-registry.js` | **Delete** |
| `buildWidgetConfig()` | `widget-registry.js` | **Delete** |
| `applyColorMode()` | `widget-registry.js` | **Delete** |
| `compact` handler | `bmad-sl-reader.js` | **Delete** |
| `full` handler | `bmad-sl-reader.js` | **Delete** |
| `minimal` handler | `bmad-sl-reader.js` | **Delete** |
| `bmad-compact` definition | `defaults.js` | **Replace** with `bmad-line-0` |
| `DualPreview` component | `components/DualPreview.js` | **Replace** with ThreeLinePreview |
| `WidgetDetailScreen` | `screens/WidgetDetailScreen.js` | **Delete** |
| `ColorModeScreen` | `screens/ColorModeScreen.js` | **Delete** |
| `TargetLineScreen` | `screens/TargetLineScreen.js` | **Delete** |
| `SelectWithPreview` | `components/SelectWithPreview.js` | **Evaluate** — keep if reusable |

**Preserved in widget-registry.js:** `INDIVIDUAL_WIDGETS` (enriched with `defaultColor`/`defaultMode`), `SEPARATOR_STYLES`, `getIndividualWidgets()`.

---

## Architectural Boundaries [CURRENT + PRESCRIBED]

### Boundary 1: Hook (runtime, standalone) — THE WRITER

- `src/hook/bmad-hook.js` — deployed to `~/.config/bmad-statusline/`
- CommonJS, zero dependencies, self-contained
- **UNCHANGED in Rev.3** — no TUI v2 changes affect the hook
- The **sole** writer of status data and `.alive` files

### Boundary 2: Reader (runtime, standalone) — THE CONSUMER

- `src/reader/bmad-sl-reader.js` — deployed to `~/.config/bmad-statusline/`
- CommonJS, zero dependencies, self-contained
- **MODIFIED in Rev.3** — adds `line N` command, reads internal config, removes legacy composites
- Contains its **own copies** of color maps AND separator maps (not imported)

### Boundary 3: Internal Config (runtime, shared file) — THE CONTRACT [NEW]

- `~/.config/bmad-statusline/config.json`
- **Written by:** TUI (every interaction) and installer (default on first install)
- **Read by:** Reader (for `line N` output) and TUI (on launch)
- This file is the coupling point between TUI and reader — both must agree on schema

### Boundary 4: CLI Entry Point (dispatch only)

- `bin/cli.js` — routes: `install`, `uninstall`, `clean`, `--help`, no-arg->TUI
- No business logic. **UNCHANGED.**

### Boundary 5: Command Modules (install-time)

- `src/install.js`, `src/uninstall.js`, `src/clean.js`
- Each receives `paths` parameter (injected, testable)
- **MODIFIED:** Install creates internal config + deploys bmad-line-0. Uninstall removes bmad-line-N + deletes internal config. Clean unchanged.

### Boundary 6: Defaults (shared data, install-time only)

- `src/defaults.js` — all config templates
- **MODIFIED:** `getWidgetDefinitions()` returns bmad-line-0 format

### Boundary 7: TUI (configurator, ESM)

- `src/tui/` — React/Ink components, ESM
- **MAJOR CHANGES in Rev.3** — multi-line state model, new screens, new components
- Writes to internal config (Boundary 3) and ccstatusline config
- Does NOT interact with hook or status files at runtime

---

## TUI Multi-Line State Model [PRESCRIBED]

### State Separation

```js
// === Config state (persisted to config.json) ===
const [config, setConfig] = useState(initialConfig);
// Shape: { separator, customSeparator, lines: [{widgets, colorModes}x3], presets: [x3] }

// === Snapshot for Reset (captured once at mount, never updated) ===
const [snapshot] = useState(() => structuredClone(initialConfig));

// === Preview override for try-before-you-buy (transient) ===
const [previewOverride, setPreviewOverride] = useState(null);

// === Navigation (React-only) ===
const [screen, setScreen] = useState('home');
const [navStack, setNavStack] = useState([]);
const [editingLine, setEditingLine] = useState(null);     // 0|1|2
const [selectedWidget, setSelectedWidget] = useState(null); // widget ID
```

### Navigation Model

**Screen tree (max depth 2):**

```
home
├── editLine(lineIndex: 0|1|2)
│   ├── colorPicker(widgetId)
│   ├── presetSave
│   └── presetLoad
├── reorderLines
└── separator
```

`resetToOriginal` is an action from Home, not a screen.

### Reset to Original

```js
function resetToOriginal() {
  const restored = structuredClone(snapshot);
  setConfig(restored);
  writeInternalConfig(restored);
  syncCcstatuslineFromScratch(restored);
  setPreviewOverride(null);
}
```

Atomic replacement. `snapshot` is immutable. No render loop possible.

---

## Bug Fix Architecture [PRESCRIBED]

### BF1: Hidden-by-default widgets cannot be shown

**Root cause (v1):** `widgetOrder` derived from ccstatusline config — widgets with `defaultEnabled: false` never appear.
**Fix (v2):** Edit Line always renders all 9 widgets from `INDIVIDUAL_WIDGETS`. Visibility = presence in `config.lines[N].widgets`. **Eliminated by design.**

### BF2: Reset to original causes infinite render loop

**Root cause (v1):** `setTuiState(snapshot)` triggers re-render -> effect hook calls `saveConfig()` -> `setTuiState()` again -> loop.
**Fix (v2):** No `useEffect` that reads config and writes config. Write is inside `setConfig` callback. `snapshot` via `useState` initializer — never changes. **Eliminated by architecture.**

### BF3: Preview shows no colors

**Root cause (v1):** Color values not mapped correctly to Ink `<Text>` props.
**Fix (v2):** ThreeLinePreview renders `<Text color={resolvedColor}>{value}</Text>` explicitly. `resolvePreviewColor()` (pattern 19) handles resolution. **Eliminated by rewrite.**

---

## Testing Conventions

**Framework:** `node:test` + `node:assert/strict` (built-in). `ink-testing-library` for TUI components.

**Test organization:**

```
test/
  reader.test.js              # Updated — add line N tests, story formatting, remove composite tests
  hook.test.js                # Unchanged from Rev.2
  install.test.js             # Updated — bmad-line-0 injection, upgrade from v1
  uninstall.test.js           # Updated — bmad-line-N removal
  clean.test.js               # Unchanged from Rev.2
  defaults.test.js            # Updated — new getWidgetDefinitions format
  cli.test.js                 # Unchanged
  tui-app.test.js             # Updated — multi-line state, config mutation, reset
  tui-config-loader.test.js   # Updated — internal config loading, v1 migration
  tui-config-writer.test.js   # Updated — internal config writing, ccstatusline sync
  tui-widget-registry.test.js # Updated — dead code removed, defaults added
  tui-preview-utils.test.js   # NEW — color resolution, sample values
  tui-components.test.js      # NEW — ThreeLinePreview, ReorderList rendering
  tui-screens.test.js         # NEW — EditLine, ColorPicker, Preset, ReorderLines
  fixtures/                   # JSON fixtures for all config states
```

**Test patterns:**
- Test file naming: `{module}.test.js` for src, `tui-{module}.test.js` for TUI
- Structure: `describe()` blocks with behavior-focused `it()` names
- TUI component tests: `ink-testing-library` render + `lastFrame()` assertions
- Async TUI tests: `await delay(50)` between stdin writes and assertions
- Helper: `captureOutput(fn)` for console.log capture in installer tests
- Environment isolation: `BMAD_CACHE_DIR` and `BMAD_CONFIG_DIR` env vars for testability
- Assertions: `assert.equal()`, `assert.deepEqual()`, `assert.ok()` — strict mode only

**TUI-specific test rules:**
- Test `updateConfig` mutation produces correct config shape
- Test ccstatusline sync triggers only on empty/non-empty transitions
- Test `previewOverride` clears on goBack
- Test `resetToOriginal` produces identical config to snapshot

---

## Code Conventions

**File naming:**
- kebab-case for utilities: `bmad-hook.js`, `config-loader.js`, `widget-registry.js`
- PascalCase for React components: `HomeScreen.js`, `Breadcrumb.js`, `ThreeLinePreview.js`
- Test suffix: `.test.js`

**Naming conventions:**
- `camelCase` for functions/variables: `loadConfig()`, `readStatus()`, `tuiState`
- `UPPER_SNAKE_CASE` for constants: `ALIVE_MAX_AGE_MS`, `STORY_WORKFLOWS`, `SKILL_REGEX`
- `PascalCase` for React components: `HomeScreen()`, `ThreeLinePreview()`
- `on*` prefix for callbacks: `onNavigate()`, `onReset()`, `onConfigChange()`

**Code style (no linter — manual adherence):**
- 2-space indentation
- Single quotes (except JSON)
- Semicolons always
- `const e = React.createElement;` — JSX-less React pattern
- Node.js built-in imports use `node:` prefix: `import fs from 'node:fs'`
- Relative imports use explicit `.js` extensions

**Comment style:**
- One-line file header: `// app.js — Screen router TUI configurator for BMAD statusline`
- Section markers in CJS: `// ─── 1. Requires ──────────`
- Inline comments explain "why", not "what"

---

## Installer Per-Line Deployment [PRESCRIBED]

### Install Targets (updated for v2)

| # | Target | Behavior |
|---|--------|----------|
| 1 | `~/.claude/settings.json` statusLine | Add config if absent, skip if present |
| 2 | `~/.config/ccstatusline/settings.json` widgets | Inject `bmad-line-0` (CHANGED — was individual widgets) |
| 3 | `~/.config/bmad-statusline/bmad-sl-reader.js` | **Always overwrite** (deploy latest) |
| 4 | `~/.cache/bmad-status/` | Create dir if absent |
| 5 | `~/.claude/settings.json` hooks | Merge 5 matchers across 3 event types if absent |
| 6 | `~/.config/bmad-statusline/bmad-hook.js` | **Always overwrite** (deploy latest) |
| 7 | `~/.config/bmad-statusline/config.json` | Create with defaults if absent (NEW) |

### Upgrade Path (v1 -> v2)

- Detect old individual `bmad-*` widgets in ccstatusline -> remove all
- Inject single `bmad-line-0`
- Create internal config via migration logic (structure detection, no version field)
- Hook config upgrade (already 5-matcher -> no-op)

### Uninstall (updated)

| Component | Detection | Action |
|-----------|-----------|--------|
| ccstatusline widgets | `id` matching `bmad-line-*` | Remove (NEW) |
| ccstatusline widgets | `id` matching `bmad-*` (individual) | **Backward compat** — remove old |
| Internal config | `config.json` exists | Delete (NEW) |
| All other targets | (unchanged from Rev.2) | (unchanged) |

### Config Migration v1->v2

Detection (no version field — structure-based):
1. If `config.json` exists with `lines` array -> v2, load directly
2. If absent -> scan ccstatusline for `bmad-*` widgets
3. If bmad widgets found -> v1, migrate (widgets to line 0, lines 1-2 empty)
4. If nothing found -> first install, create defaults

---

## Enforcement Guidelines

**All AI Agents MUST:**

**Preserved from Rev.2 (hook/reader/installer):**
- Check error handling philosophy before writing error-related code (pattern 1)
- Use `colorize()` for all ANSI output in reader — never inline escape codes (pattern 3)
- Follow the full config mutation sequence for ccstatusline JSON modifications (pattern 4)
- Use `path.join()` for all paths, `paths` parameter in installer (pattern 5)
- Use synchronous fs operations only (pattern 2)
- Normalize paths to forward slashes in hook before matching (pattern 9)
- Validate cwd scoping before any pattern matching in Read/Write/Edit (pattern 11)
- Validate step/story paths belong to active **skill** (pattern 9)
- Use dynamic slicer for skill name normalization — never hardcode `slice(5)` (pattern 10)
- Use `shouldUpdateStory()` for all story updates (pattern 12)
- Use multi-track step regex (pattern 13)

**New for TUI v2:**
- Use `updateConfig(mutator)` for all config changes — never `setConfig` directly (pattern 15)
- Use `structuredClone` for deep copies — never spread operator on nested objects (pattern 15)
- Never put config read+write in the same `useEffect` (BF2 prevention)
- Use `previewOverride` for try-before-you-buy — never modify `config` for temporary previews (pattern 17)
- Clear `previewOverride` on every `goBack()` call (pattern 17)
- Use `BMAD_CONFIG_DIR` env var for internal config path in both TUI and reader (patterns 14, 20)
- Use `resolvePreviewColor()` helper for all color resolution in TUI — never duplicate logic (pattern 19)
- Sync ccstatusline only on line empty/non-empty transitions — never on every config change (pattern 16)
- Use Ink `<Text color={...}>` in TUI components — never ANSI escape codes in React (pattern 3)
- Screens receive data via standard props contract — never read global state directly (pattern 18)

---

## Usage Guidelines

**For AI Agents:**
- Read this file before implementing any code in bmad-statusline
- Follow ALL patterns exactly as documented — they prevent known bugs and architectural violations
- When in doubt between patterns, the numbered pattern takes precedence
- Check the [CURRENT] vs [PRESCRIBED] markers to know what exists vs what must be built

**For Humans:**
- Keep this file lean and focused on agent needs
- Update when architecture decisions change
- Remove rules that become obvious from the codebase over time

Last Updated: 2026-03-31
