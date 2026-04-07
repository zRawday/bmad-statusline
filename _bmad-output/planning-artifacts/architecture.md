---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
status: 'complete'
completedAt: '2026-04-04'
lastStep: 8
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
  - '_bmad-output/planning-artifacts/architecture.md (Rev.2, preserved for hook/reader/installer sections)'
  - '_bmad-output/project-context.md'
  - 'Conversation: Monitor feature specification (2026-04-04)'
revision: 5
revisionDate: '2026-04-07'
revisionScope: 'TUI Process Lifecycle — PID registry for multi-instance orphan prevention, signal handlers for graceful shutdown, TTY detection for terminal-close cleanup (Pattern 28)'
previousRevisions:
  - revision: 4
    date: '2026-04-04'
    scope: 'Monitor — real-time session supervision TUI, hook expansion (Bash/Stop/Notification), status file v2 (history arrays, LLM state), viewport scroll, detail/chronology pages, CSV export, tab system with project grouping'
  - revision: 3
    date: '2026-03-30'
    scope: 'TUI v2 redesign — multi-line model, internal config, reader line N command, legacy composite removal, per-line installer deployment, ThreeLinePreview, ScreenLayout restructure, bug fixes'
workflowType: 'architecture'
project_name: 'bmad-statusline'
user_name: 'Fred'
date: '2026-04-04'
---

# Architecture Decision Document

_Revision 4 — Preserves all Rev.2 hook decisions and Rev.3 TUI v2 decisions. Adds Monitor feature: real-time session supervision TUI, hook expansion (Bash/Stop/Notification matchers), status file v2 (history arrays, LLM state tracking), viewport scroll pattern, detail/chronology pages, CSV export, two-level tab system with project grouping._

## Project Context Analysis

### Evolution Summary

**From (Rev.2):** Five-signal hook expansion, multi-module support, step multi-track, story intelligence, cwd scoping, session resume. Reader unchanged (compact/full/minimal composites). TUI v1 (Epic 5) with single-line focus, deep navigation, dual preview.

**To (Rev.3):** All Rev.2 hook/installer/reader-core decisions preserved. TUI v2 redesign: multi-line model (3 ccstatusline lines), internal bmad-statusline config, reader `line N` command replacing legacy composites, per-line installer deployment, 6 new TUI components, 3 bug fixes, dead code removal.

**To (Rev.4):** All Rev.3 decisions preserved. Monitor feature adds a real-time session supervision screen to the TUI. This is a paradigm shift: the TUI evolves from a pure configurator (user modifies settings, exits) to a hybrid configurator + live dashboard (user can monitor active Claude Code sessions in real time). The hook expands from 5 matchers/3 event types to 8 matchers/5 event types. The status file schema evolves from flat scalars to arrays with full operation history. New architectural patterns: polling, viewport scroll, atomic file writes, CSV export.

**Motivation:** As users run multiple concurrent Claude Code sessions with BMAD workflows, they need visibility into what each session is doing — which files it's reading/writing, what commands it's running, and critically, whether it needs user attention (permission prompts, finished turns). The existing statusline widgets show last-file-only. The Monitor provides full session history with real-time updates.

### Rev.4 Requirements Overview

**New Functional Requirements (36 total, FR32-FR67):**

- **Monitor Access & Layout (FR32-33):** New "Monitor" button in HomeScreen, dedicated layout without header/preview, title "MONITOR"
- **Tab Navigation (FR34-38):** Two-level tabs (projects → sessions), single-project flat mode, project tabs colored from `projectColors`, session sub-tabs from `skillColors`/`WORKFLOW_COLORS`, LLM state badges on all tabs, reorder project tabs (`r`) and session sub-tabs (`R`)
- **LLM State Badge (FR39-40):** 4 states — ACTIF (green, on `UserPromptSubmit`/`PostToolUse`), PERMISSION (orange, on `Notification` permission), EN ATTENTE (yellow, on `Stop`), INACTIF (gray, >5min silence). Large colored badge with workflow name and timer
- **File Sections (FR41-48):** "Fichiers modifiés" with tree view (in-project) and flat absolute paths (out-of-project), `*` for created files (Write) vs no marker for edited (Edit). "Fichiers lus" same layout. Counts in section headers. Line-wrap for long paths (no truncation). Sub-agent indicator on operations from `agent_id`
- **Bash Commands (FR49-51):** Scrollable section (not sticky), deduplicated with execution counter (×N), simplified display, color-coded by command family (npm=green, git=yellow, node=cyan, filesystem=dim, other=magenta)
- **Scroll (FR52-54):** Viewport scroll with manual offset (↑↓). Sticky zones: top (title + tabs + badge), bottom (shortcut bar only). Scroll indicators ▲/▼ with hidden item count
- **Mode Détail (FR55-60):** Detail mode with cursor navigation through tree (preserving tree structure, not flattening). Enter opens detail page. Edit detail: file name, list of modifications with full diff (old_string/new_string lines, red for deleted, green for added), timestamps. Read detail: file name, list of read timestamps. Bash detail: full unsimplified command list with timestamps. Detail pages have their own scroll viewport
- **Chronologie (FR61-62):** Unified timeline page of all events interleaved chronologically. Color-coded by type (READ cyan, WRITE green, EDIT yellow, BASH dim, DELETE red, RENAME magenta, MOVE blue). Sub-agent indicator. Accessed via `c` key
- **Export CSV (FR63-66):** Light (summary: type, path, count) and Full (each event with timestamp). Destination: `{output_folder}/monitor/`. Export confirmation temporarily replaces shortcut bar
- **Shortcut Bar (FR67):** Color-coded by family — navigation (cyan), modes (yellow), actions (green), toggles (magenta), exit (dim). Contextual: only relevant shortcuts shown per active mode
- **Toggles (FR68-71):** Auto-scroll `a`, terminal bell `b` (toggleable on/off), timestamp format `t` (absolute/relative), sort `s` (alphabetical/chronological). Esc = Back home

**New Non-Functional Requirements (NFR13-NFR17):**

- **NFR13:** Polling overhead < 20ms per cycle (readFileSync + JSON.parse of all active session status files)
- **NFR14:** Status file max 10 MB safety guard — stop appending history arrays, continue updating scalar fields
- **NFR15:** Backward compatibility — reader continues to work unchanged with status file v2 (new fields are additive)
- **NFR16:** Hook latency — array append must not exceed 20ms even at 2 MB status file
- **NFR17:** Atomic status file writes — write to `.tmp` then `renameSync` to prevent corruption on crash

**Phase 2 (deferred, not in this revision):**

- **File deletion detection** — Parsing Bash commands for `rm`/`git rm` patterns (heuristic, ~60-70% coverage)
- **File rename detection** — Parsing Bash commands for `mv`/`git mv` same-directory patterns
- **File move detection** — Parsing Bash commands for `mv`/`git mv` cross-directory patterns
- Sections "Fichiers supprimés", "Fichiers renommés", "Fichiers déplacés" deferred until Phase 2

### Rev.4 Technical Constraints & Dependencies

**New hook events required (available in Claude Code, not yet configured):**

| Hook Event | Matcher | Purpose |
|------------|---------|---------|
| `PostToolUse` | `Bash` | Capture bash commands (`tool_input.command`) |
| `Stop` | (any) | Detect LLM turn completion → EN ATTENTE state |
| `Notification` | (any) | Detect permission prompts → PERMISSION state |

**Sub-agent tracking:** `PostToolUse` events fire for sub-agent tool calls with `agent_id` field set. Same `session_id` as parent. Sub-agents in worktree mode have different `cwd` — affects in-project detection.

**Ink/React constraints:**
- No native scroll in Ink — manual viewport slicing required
- `useStdout().rows` for terminal height calculation
- `useEffect` + `setInterval` for polling (with cleanup on unmount)

### Rev.4 Cross-Cutting Concerns

**New boundary: TUI↔Cache direct read** — The Monitor introduces a direct read path from TUI to cache status files. Previously TUI only read/wrote internal config (Boundary 3). Now TUI also reads `~/.cache/bmad-status/status-*.json` files. This is a new coupling that should be isolated in a dedicated sub-boundary (`src/tui/monitor/`).

**Status file schema backward compat** — New array fields (`reads[]`, `writes[]`, `commands[]`, `llm_state`, etc.) are additive. The reader only accesses existing scalar fields (`last_read`, `last_write`, etc.) which remain populated. No reader changes needed.

**Atomic writes** — Status file grows from ~1 KB to potentially 500 KB+. Write-then-rename pattern (`writeFileSync` to `.tmp`, `renameSync` to final path) prevents mid-write corruption. Applies to hook status file writes only (internal config stays small, no change needed).

**Polling + sync I/O** — `setInterval` + `readFileSync` is pattern-compliant (Pattern 2) but new for the TUI. Must handle: file not found (session ended), parse errors (corrupted), and stale sessions (alive file old).

**Shortcut complexity** — Monitor screen has ~15 keyboard shortcuts. Contextual display required: show only shortcuts relevant to current mode (normal, detail, chronology, export prompt). ShortcutBar component already supports dynamic arrays — pass different arrays per mode.

**Tab color resolution** — Project tab colors from `config.projectColors[projectName]`, session sub-tab colors from `config.skillColors[workflowName]` falling back to `WORKFLOW_COLORS[workflowName]`. Both already configurable in existing TUI screens (ProjectColorsScreen, SkillColorsScreen).

### Requirements Overview

**Functional Requirements (31 total, grouped by domain):**

- **Widget Configuration (FR1-6):** Per-line show/hide, reorder, fixed ANSI color for all widgets, dynamic color mode for workflow only, independent per-line management, sensible default colors
- **Preview (FR7-9):** 3-line boxed preview always visible, actual ANSI colors rendered, updates within same render cycle
- **Presets (FR10-14):** 3 shared slots, save/load per line, mini-preview per slot, persistent across sessions, load replaces current line only
- **Navigation (FR15-19):** Home with 6 options, Edit Line with h/g/c/s/l shortcuts, Reorder Lines with swap, Escape always back, breadcrumb
- **ccstatusline Integration (FR20-22):** One composite per non-empty line, reader `line N` command, native widget coexistence
- **Reader (FR23-26):** `line N` command, story name formatting ("5-3 Auth Login"), visible workflow colors, remove compact/full/minimal
- **Bug Fixes (FR27-29):** Hidden-by-default widgets togglable, reset without render loop, preview renders colors
- **Installer (FR30-31):** Deploy one bmad-line-N per configured non-empty line, uninstaller removes all

**Non-Functional Requirements (12 total):**

- **Performance:** TUI launch < 500ms, preview same-cycle, reader `line N` < 50ms
- **Reliability:** Corrupted config → fallback to defaults, empty presets → no error, reader silent failure
- **Compatibility:** Cross-platform (Windows/macOS/Linux), Node.js >= 20, ccstatusline >= 2.2
- **Maintainability:** Zero runtime deps for reader/hook/installer, TUI deps scoped to src/tui/, state centralized in app.js

### Scale & Complexity

- Primary domain: CLI Tool / Terminal TUI
- Complexity level: Medium (hook/reader stable from Rev.2, TUI is a self-contained redesign)
- Architectural components: 7 (CLI entry point, reader, hook, installer, ccstatusline config manager, TUI configurator, internal config system)

### Technical Constraints & Dependencies

**Preserved from Rev.2 (unchanged):**
- Hook contracts — 5 signals, multi-module regex, cwd scoping, story intelligence
- Status file schema (hook↔reader interface) — reader-visible fields unchanged
- Stdin contract for reader (session_id, cwd from ccstatusline)
- Windows path handling, no ccstatusline fork
- CJS standalone for reader and hook, ESM for package and TUI

**New for Rev.3:**
- **ccstatusline config format v3** — `lines` array of 3 arrays. Each line can contain at most one `bmad-line-N` custom-command widget alongside native ccstatusline widgets. Widget properties: `id`, `type: "custom-command"`, `commandPath: "node reader.js line N"`, `preserveColors: true`
- **Internal config model** — bmad-statusline stores its own config separately from ccstatusline. Schema: 3 lines, each with widgets[], order[], colorModes{}, separator. Plus 3 shared preset slots. This config drives the reader's `line N` output.
- **React 19 + Ink 6.8 + @inkjs/ui 2.0** — TUI stack unchanged but component architecture redesigned. 6 custom components required (all layout/composition, no interaction primitives).
- **Reader dual-mode** — Reader must support both individual widget commands (unchanged) AND new `line N` commands (reads internal config to compose output). Legacy composite commands (compact, full, minimal) removed.

### Cross-Cutting Concerns Identified

- **Internal config ↔ Reader ↔ ccstatusline triangle** — The internal config drives the reader's `line N` output, which ccstatusline displays. All three must agree on the config file location, schema, and widget IDs.
- **TUI state centralization** — All state in app.js (existing pattern). Bug fixes BF1/BF2 require careful state management to avoid render loops and hidden-widget dead-ends.
- **Immediate persistence** — Every TUI interaction writes to disk instantly. React state is source of truth; disk is persistence layer. Write failures must not lose in-memory state.
- **Preview rendering fidelity** — ThreeLinePreview must produce output visually identical to what ccstatusline will display. Same widgets, same order, same separator, same ANSI colors.
- **Dead code removal scope** — COMPOSITE_WIDGETS, getCompositeWidgets(), compositeMode parameter, compact/full/minimal commands. Must be removed cleanly without breaking individual widget commands or tests.
- **Config migration** — v1 config (single-line) must be loadable in v2 TUI (migrated to line 1, lines 2-3 empty). No config version field needed — structure detection is sufficient.
- **Installer idempotency update** — Must detect old bmad-compact widget and replace with bmad-line-0. Must handle both v1 and v2 config formats.

## Starter Template Evaluation

### Primary Technology Domain

CLI tooling / npm package — continued evolution of existing codebase. (Unchanged from Rev.2)

### Selected Approach: Evolve existing codebase

**Rationale:** The package is functional with working install/uninstall/clean commands, reader, hook, tests, and TUI v1. Rev.3 evolves the TUI layer (redesign), reader (add `line N`, remove composites), installer (per-line deployment), and adds an internal config system. No new runtime artifacts.

**Language & Runtime (unchanged):**
- Node.js / JavaScript, ESM for package, CJS standalone for reader and hook
- No TypeScript, zero runtime deps for reader/hook/installer
- `node:test` + `node:assert` for testing, `ink-testing-library` for TUI component tests
- No build step

**Structural Changes for TUI v2 Evolution:**

| File | Change |
|------|--------|
| `src/tui/app.js` | **MODIFIED** — multi-line state model, per-line editing, preset management, bug fixes (BF1 hidden widgets, BF2 reset loop) |
| `src/tui/components/ScreenLayout.js` | **NEW** — universal screen wrapper (Breadcrumb + ThreeLinePreview + content + ShortcutBar) |
| `src/tui/components/Breadcrumb.js` | **NEW** — dim navigation path display |
| `src/tui/components/ThreeLinePreview.js` | **NEW** — replaces DualPreview, 3-line boxed frame with ANSI colors |
| `src/tui/components/ShortcutBar.js` | **NEW** — contextual keyboard shortcut display |
| `src/tui/components/ReorderList.js` | **NEW** — dual-mode navigate/grab list for widget and line reorder |
| `src/tui/components/ConfirmDialog.js` | **NEW** — inline confirmation for preset overwrite |
| `src/tui/screens/HomeScreen.js` | **NEW or MODIFIED** — 6-option menu with 3-line preview |
| `src/tui/screens/EditLineScreen.js` | **NEW** — per-line widget list with h/g/c/s/l shortcuts |
| `src/tui/screens/ColorPickerScreen.js` | **NEW or MODIFIED** — simplified, Dynamic option for workflow only |
| `src/tui/screens/PresetScreen.js` | **NEW** — save/load sub-screen with 3 shared slots |
| `src/tui/screens/ReorderLinesScreen.js` | **NEW** — swap entire line contents |
| `src/tui/screens/SeparatorScreen.js` | **UNCHANGED** — same 4 options |
| `src/tui/config-loader.js` | **MODIFIED** — load internal multi-line config, v1→v2 migration |
| `src/tui/config-writer.js` | **MODIFIED** — write internal multi-line config + presets |
| `src/tui/widget-registry.js` | **MODIFIED** — remove COMPOSITE_WIDGETS, getCompositeWidgets(), compositeMode |
| `src/reader/bmad-sl-reader.js` | **MODIFIED** — add `line N` command, remove compact/full/minimal, story name formatting, workflow color fixes |
| `src/defaults.js` | **MODIFIED** — getWidgetDefinitions() generates bmad-line-N format, default widget colors |
| `src/install.js` | **MODIFIED** — deploy one bmad-line-N per non-empty line, detect/replace old bmad-compact |
| `src/uninstall.js` | **MODIFIED** — remove all bmad-line-N widgets from ccstatusline config |

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Internal config schema and file location (all TUI + reader depend on this)
- Reader `line N` command (ccstatusline integration depends on this)
- TUI multi-line state model (all screens depend on this)
- Installer per-line deployment (ccstatusline config depends on this)
- Dead code removal scope (must be done before new code to avoid conflicts)

**Important Decisions (Shape Architecture):**
- ThreeLinePreview rendering logic (preview fidelity)
- Config migration v1→v2 (upgrade path)
- Bug fix root causes (BF1/BF2/BF3)

**Deferred Decisions (Post-MVP):**
- Custom widget creation (user-defined reader commands)
- Import/export presets to file

### Preserved from Rev.2 — Hook Architecture

_All hook decisions from Architecture Rev.2 are preserved unchanged. This section reproduces the key contracts that AI agents need for implementation. No TUI v2 changes affect the hook._

#### Multi-Signal Hook Architecture

Hook captures five event types via single script (`bmad-hook.js`), dispatches on `hook_event_name` then `tool_name`:

- **UserPromptSubmit** — intent signal. Matcher does NOT filter; hook filters internally with regex. Sets workflow active if trackable.
- **PostToolUse Read** — data signal. Updates step, project, story candidate.
- **PostToolUse Write** — story confirmation via sprint-status YAML or story file creation.
- **PostToolUse Edit** — story confirmation via sprint-status status change.
- **SessionStart** — touches `.alive-{session_id}` for session persistence.

**Hook Config (5 matchers, 3 event types):**
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

#### Multi-Module Support

- **Regex:** `/((?:bmad|gds|wds)-[\w-]+)/`
- **Dynamic slicer:** `skillName.slice(skillName.indexOf('-') + 1)` — replaces hardcoded `slice(5)`
- **Status file:** Stores `skill` (full name for paths) and `workflow` (stripped name for display/colors)

#### Trackable Skill Detection

Detection via `steps*/` directory existence. When UserPromptSubmit fires:
1. Extract skill name via regex
2. Check if `{cwd}/.claude/skills/${skillName}/steps*/` exists
3. If exists → trackable: set active, update `started_at` if changed
4. If absent → utility: ignore, preserve current status

#### Discrimination Logic (Complete Truth Table)

| Event | Condition | Action |
|-------|-----------|--------|
| **UserPromptSubmit** | Prompt matches regex AND `steps*/` exists | Set workflow active, store `skill` + `workflow`, reset `started_at` if changed |
| **UserPromptSubmit** | Prompt matches but no `steps*/` | Ignore (utility skill), preserve status |
| **UserPromptSubmit** | No match | Ignore |
| **Read** `steps*/step-*.md` | Path in `steps*/` of active skill, main step | Update `step.current`, `step.current_name`, derive `next`; calculate total if first Read |
| **Read** `stories/*.md` | Workflow in `STORY_READ_WORKFLOWS` AND story not locked ≤ priority 2 | Set story (priority 2, locks) |
| **Read** `sprint-status*.yaml` | Unique candidate AND no story set | Set story (priority 3, candidate only) |
| **Read** (other) | Always | Ignore |
| **Write** `sprint-status*.yaml` | Workflow in `STORY_WORKFLOWS`, parse YAML | Set story (priority 1, always overwrites) |
| **Write** `stories/*.md` | Workflow is `create-story`, story not locked ≤ priority 2 | Set story (priority 2, locks) |
| **Write** (other) | Always | Ignore |
| **Edit** `sprint-status*.yaml` | Workflow in `STORY_WORKFLOWS`, `new_string` contains story key | Set story (priority 1, always overwrites) |
| **Edit** (other) | Always | Ignore |
| **SessionStart** | Always (matcher ensures resume only) | Touch `.alive-{session_id}` |

All Read/Write/Edit gated by cwd scoping: `filePath.startsWith(cwd)` after normalization.

#### Story Intelligence (3-Level Priority)

```js
const STORY_PRIORITY = { SPRINT_STATUS: 1, STORY_FILE: 2, CANDIDATE: 3 };

function shouldUpdateStory(incomingPriority, currentPriority) {
  if (incomingPriority === 1) return true;
  if (incomingPriority === 2 && (!currentPriority || currentPriority === 3)) return true;
  if (incomingPriority === 3 && !currentPriority) return true;
  return false;
}

const STORY_WORKFLOWS = ['dev-story', 'code-review', 'create-story'];
const STORY_READ_WORKFLOWS = ['dev-story', 'code-review'];
const STORY_WRITE_WORKFLOWS = ['create-story'];
```

#### Step Multi-Track

```js
const STEP_REGEX = /\/steps(-[a-z])?\/step-(?:[a-z]-)?(\d+)-(.+)\.md$/;
```
Supports `steps/`, `steps-c/`, `steps-v/`, `steps-e/`. Sub-steps (`step-01b-continue.md`) excluded by design.

Total calculated per track directory at first Read:
```js
const stepsDir = path.dirname(resolvedPath);
const files = fs.readdirSync(stepsDir);
const total = files.filter(f => /^step-(?:[a-z]-)?(\d+)-.+\.md$/.test(f)).length;
```

#### Path Normalization, cwd Scoping, Session Resume

- **Path normalization:** `path.replace(/\\/g, '/')` before all pattern matching
- **cwd scoping:** `normalize(filePath).startsWith(normalize(cwd))` — first check after extracting file_path, before any pattern matching. Applies to Read/Write/Edit only.
- **Session resume:** `.alive-{session_id}` touched on every hook invocation + SessionStart. `ALIVE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000` (7 days).

#### Status File Schema (Hook↔Reader Interface)

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

Reader-visible: `session_id`, `project`, `workflow`, `story`, `step.*` (current, current_name, next, next_name, total), `started_at`, `updated_at`. Hook-internal: `skill`, `story_priority`, `step.track`.

### Internal Config Architecture

- **File location:** `~/.config/bmad-statusline/config.json`
- **Written by:** TUI (on every user interaction) and installer (default config on first install)
- **Read by:** Reader (for `line N` command) and TUI (on launch)

**Schema:**
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
- `separator` is global (top-level), applied to all lines. Values: `"serre"`, `"modere"`, `"large"`, `"custom"`.
- `customSeparator` is a string, only used when `separator === "custom"`. Null otherwise.
- `lines` is always length 3. Each line has `widgets` (ordered array of visible widget IDs) and `colorModes` (map of widget ID to color config).
- `widgets` array contains only **visible** widgets in **display order**. A widget not in any line's `widgets` is hidden everywhere. A widget CAN appear on multiple lines.
- `colorModes` contains entries for all widgets that have been configured on this line (including currently hidden ones, to preserve color choice across hide/show cycles).
- `colorModes[id].mode` is `"dynamic"` (only valid for `bmad-workflow`) or `"fixed"` (all widgets). When `"fixed"`, `fixedColor` is an ANSI color name.
- `presets` is always length 3. Each slot is null (empty) or a preset object.

**Preset slot schema:**
```json
{
  "name": "dev-focus",
  "widgets": ["bmad-project", "bmad-workflow", "bmad-progressstep"],
  "colorModes": {
    "bmad-project": { "mode": "fixed", "fixedColor": "cyan" },
    "bmad-workflow": { "mode": "dynamic" },
    "bmad-progressstep": { "mode": "fixed", "fixedColor": "brightCyan" }
  }
}
```
Preset = snapshot of a single line's config. No separator (global). Loading a preset replaces the current line's `widgets` and `colorModes`.

**Default widget colors (from PRD UX3):**

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

**Default visible widgets (line 0):** project, workflow, progressstep, story, timer (`defaultEnabled: true` in INDIVIDUAL_WIDGETS). Lines 1-2 empty.

### Reader Multi-Line Architecture

_Replaces "Reader Composite Simplification" from Rev.2._

#### New `line N` Command

**Invocation:** `node bmad-sl-reader.js line 0` (argv[2] = `"line"`, argv[3] = `"0"|"1"|"2"`)

**Execution sequence:**
1. Parse stdin for `session_id` (existing pattern)
2. Read status file `~/.cache/bmad-status/status-{session_id}.json` (existing pattern)
3. Read internal config `~/.config/bmad-statusline/config.json` (NEW)
4. Extract line config: `internalConfig.lines[lineIndex]`
5. If line has no widgets or config missing → return empty string (silent failure)
6. Resolve separator: lookup `internalConfig.separator` in separator map
7. For each widget ID in `line.widgets`:
   a. Call the existing individual extractor function (e.g., `extractProject(status)`, `extractWorkflow(status)`)
   b. If extractor returns empty → skip this widget
   c. Apply color from `line.colorModes[widgetId]`:
      - `mode: "dynamic"` → leave extractor output as-is (only workflow produces ANSI)
      - `mode: "fixed"` → `colorize(value, fixedColor)` (strip any existing ANSI first)
8. Join non-empty segments with separator
9. Output to stdout

**Config missing fallback:** If `config.json` doesn't exist or can't be parsed, return empty string. Silent failure — existing rule.

**Separator map (reader-internal, CJS):**
```js
const SEPARATORS = {
  serre: '\u2503',        // ┃
  modere: ' \u2503 ',     // ┃ padded
  large: '  \u2503  ',    // ┃ wide
};
// custom: read from config.customSeparator
```

#### Story Name Formatting (RC1)

Applied in the `story` individual extractor, before any colorization:
```js
function formatStoryName(slug) {
  if (!slug) return '';
  const match = slug.match(/^(\d+-\d+)-(.+)$/);
  if (!match) return slug;
  const title = match[2].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return `${match[1]} ${title}`;
}
```
- Input: `5-3-auth-login` → Output: `5-3 Auth Login`
- Input: `4-2-user-registration-flow` → Output: `4-2 User Registration Flow`
- Non-matching slugs returned as-is.

#### Removed Commands

`compact`, `full`, `minimal` handlers deleted. If called, the reader falls through to empty output (existing default behavior for unknown commands).

#### Individual Commands (Unchanged)

`project`, `workflow`, `step`, `nextstep`, `progress`, `progressbar`, `progressstep`, `story`, `timer` — all unchanged. Still available for direct use by ccstatusline native widgets.

### TUI Multi-Line State Model

#### State Separation

```js
// === Config state (persisted to ~/.config/bmad-statusline/config.json) ===
const [config, setConfig] = useState(initialConfig);
// Shape: { separator, customSeparator, lines: [{widgets, colorModes}x3], presets: [x3] }

// === Snapshot for Reset (captured once at mount, never updated) ===
const [snapshot] = useState(() => structuredClone(initialConfig));

// === Preview override for try-before-you-buy (React-only, transient) ===
const [previewOverride, setPreviewOverride] = useState(null);
// When non-null, ThreeLinePreview renders previewOverride instead of config

// === Navigation (React-only) ===
const [screen, setScreen] = useState('home');
const [navStack, setNavStack] = useState([]);
const [editingLine, setEditingLine] = useState(null);     // 0|1|2
const [selectedWidget, setSelectedWidget] = useState(null); // widget ID for color picker
```

#### Config Mutation Pattern

```js
function updateConfig(mutator) {
  setConfig(prev => {
    const next = structuredClone(prev);
    mutator(next);
    writeInternalConfig(next);  // async-safe: fire-and-forget sync write
    syncCcstatuslineIfNeeded(prev, next);  // only if line empty/non-empty changed
    return next;
  });
}
```

**Rules:**
- Never mutate `config` directly — always `setConfig` with a new object via `structuredClone`
- `writeInternalConfig` writes `config.json` synchronously (Node.js `fs.writeFileSync`)
- `syncCcstatuslineIfNeeded` compares old and new line emptiness: if a line changed from empty to non-empty (or vice versa), update ccstatusline config (add/remove `bmad-line-N` widget)
- No effect hooks that both read and write config — prevents BF2 render loops

#### Reset to Original

```js
function resetToOriginal() {
  const restored = structuredClone(snapshot);
  setConfig(restored);
  writeInternalConfig(restored);
  syncCcstatuslineFromScratch(restored);  // rebuild all bmad-line-N widgets
  setPreviewOverride(null);
}
```
Atomic replacement. `snapshot` is immutable (captured via `useState` initializer, never updated). No render loop possible.

#### ccstatusline Sync Logic

```js
function syncCcstatuslineIfNeeded(oldConfig, newConfig) {
  for (let i = 0; i < 3; i++) {
    const wasEmpty = oldConfig.lines[i].widgets.length === 0;
    const isEmpty = newConfig.lines[i].widgets.length === 0;
    if (wasEmpty && !isEmpty) addBmadLineWidget(i);      // add bmad-line-N to ccstatusline
    else if (!wasEmpty && isEmpty) removeBmadLineWidget(i); // remove bmad-line-N from ccstatusline
  }
}
```
Most TUI interactions (color change, reorder, hide/show within non-empty line) do NOT touch ccstatusline. Only empty↔non-empty transitions do.

### ThreeLinePreview Rendering

- **Decision:** Composition logic duplicated in TUI component (not reader process calls)
- **Rationale:** Reader reads runtime status data; preview needs sample values. Reader is CJS; TUI is ESM. 3 process launches per render is excessive. DualPreview in v1 already duplicates composition — same pattern.

**Sample values:**
```js
const SAMPLE_VALUES = {
  'bmad-project': 'myproject',
  'bmad-workflow': 'dev-story',
  'bmad-step': 'Step 2 Discover',
  'bmad-nextstep': 'Next: Step 3',
  'bmad-progress': '40%',
  'bmad-progressbar': '████░░░░░░',
  'bmad-progressstep': 'Tasks 2/5',
  'bmad-story': '4-2 Auth Login',
  'bmad-timer': '12:34',
};
```

**Rendering per line:**
1. Get `config.lines[i].widgets` (or `previewOverride.lines[i].widgets` if override active)
2. For each widget ID, lookup in `SAMPLE_VALUES` — skip if no value
3. Wrap in `<Text color={resolvedColor}>` where color comes from `colorModes[id]`:
   - `dynamic` → use `WORKFLOW_SAMPLE_COLOR` constant (e.g., the color for 'dev-story')
   - `fixed` → use `fixedColor` directly as Ink color prop
4. Join segments with separator (resolved from `config.separator` via `SEPARATOR_STYLES`)
5. Render 3 lines inside `<Box borderStyle="round" borderColor="dim">`

**Preview-on-highlight (try-before-you-buy):**
- Color Picker: on arrow, `setPreviewOverride(configWithNewColor)`. On Enter, `updateConfig(...)` + `setPreviewOverride(null)`. On Escape, `setPreviewOverride(null)`.
- Separator Style: same pattern with separator change.
- Preset Load: same pattern with full line replacement.

### TUI Navigation Model

**NavStack pattern (preserved from v1):**
```js
function navigate(screenName, context = {}) {
  setNavStack(prev => [...prev, screen]);
  setScreen(screenName);
  if (context.editingLine !== undefined) setEditingLine(context.editingLine);
  if (context.selectedWidget !== undefined) setSelectedWidget(context.selectedWidget);
}

function goBack() {
  setPreviewOverride(null);  // always clear preview on back
  if (navStack.length > 0) {
    setScreen(navStack[navStack.length - 1]);
    setNavStack(prev => prev.slice(0, -1));
  }
}
```

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

`resetToOriginal` is an action from Home, not a screen — executes directly and stays on Home.

**Context flow:**
- Home → Edit Line: sets `editingLine`
- Edit Line → Color Picker: sets `selectedWidget`
- Edit Line → Preset Save/Load: reads `editingLine` (already set)
- All sub-screens → goBack: clears `previewOverride`, pops navStack

### Config Migration v1→v2

**Detection (no version field — structure-based):**
1. Try reading `~/.config/bmad-statusline/config.json`
2. If exists and valid JSON with `lines` array → v2 config, load directly
3. If absent → scan ccstatusline config (`~/.config/ccstatusline/settings.json`) for widgets with `id.startsWith('bmad-')`
4. If bmad widgets found → v1 config, migrate
5. If nothing found → first install, create default config

**v1 → v2 migration logic:**
```js
function migrateV1Config(ccConfig) {
  // 1. Find the line containing bmad-* widgets
  const bmadLine = ccConfig.lines.findIndex(line =>
    line.some(w => w.id?.startsWith('bmad-') && w.type === 'custom-command')
  );
  if (bmadLine === -1) return createDefaultConfig();

  // 2. Extract widget IDs in order (skip separators)
  const bmadWidgets = ccConfig.lines[bmadLine]
    .filter(w => w.id?.startsWith('bmad-') && w.type === 'custom-command')
    .map(w => w.id);

  // 3. Build colorModes from existing config
  const colorModes = {};
  for (const w of ccConfig.lines[bmadLine]) {
    if (!w.id?.startsWith('bmad-') || w.type !== 'custom-command') continue;
    colorModes[w.id] = w.preserveColors && w.id === 'bmad-workflow'
      ? { mode: 'dynamic' }
      : { mode: 'fixed', fixedColor: w.color || getDefaultColor(w.id) };
  }

  // 4. Build v2 config
  return {
    separator: detectSeparatorStyle(ccConfig.lines[bmadLine]),
    customSeparator: null,
    lines: [
      { widgets: bmadWidgets, colorModes },
      { widgets: [], colorModes: {} },
      { widgets: [], colorModes: {} }
    ],
    presets: migratePresets(ccConfig.presets)
  };
}
```

**Post-migration:** Replace old bmad-* individual widgets in ccstatusline with single `bmad-line-0`. Write both internal config and updated ccstatusline config.

### Bug Fix Architecture

#### BF1: Hidden-by-default widgets cannot be shown

**Root cause (v1):** `widgetOrder` in tuiState is derived from ccstatusline config, which only contains enabled widgets. Widgets with `defaultEnabled: false` (step, nextstep, progress, progressbar) are never in ccstatusline config → never in `widgetOrder` → toggle has no effect.

**Fix (v2):** Edit Line screen always renders all 9 widgets from `INDIVIDUAL_WIDGETS` constant. Visibility is determined solely by presence in `config.lines[N].widgets`. Toggle adds/removes from that array. The widget list source is the static registry, not the config. **Problem eliminated by design.**

#### BF2: Reset to original causes infinite render loop

**Root cause (v1):** `resetToOriginal()` calls `setTuiState(snapshot)`, which triggers re-render. An effect hook depends on `tuiState` and calls `saveConfig()`, which calls `setTuiState()` again → infinite loop.

**Fix (v2):** `setConfig(structuredClone(snapshot))` is an atomic state replacement. No effect hooks read `config` and write `config`. The write to disk is inside the `setConfig` callback (or in `updateConfig` helper), not in an effect. `snapshot` is captured once via `useState` initializer — never changes, never triggers re-renders. **Problem eliminated by architecture.**

#### BF3: Preview shows no colors

**Root cause (v1):** DualPreview constructs color strings but Ink's `<Text>` may not receive them as proper props, or the color values aren't being mapped correctly from `colorModes`.

**Fix (v2):** ThreeLinePreview explicitly renders each widget segment as `<Text color={resolvedColor}>{value}</Text>`. Color resolution:
- `dynamic`: hardcoded sample color constant
- `fixed`: `fixedColor` string passed directly to Ink's `color` prop

No ANSI escape codes in React. Ink handles ANSI output to terminal. **Problem eliminated by rewrite.**

### Installer Per-Line Deployment

**`getWidgetDefinitions(readerPath)` — v2 format:**
```js
function getWidgetDefinitions(readerPath) {
  return [{
    id: 'bmad-line-0',
    type: 'custom-command',
    commandPath: `node "${readerPath}" line 0`,
    preserveColors: true
  }];
}
```

No `color` property — `preserveColors: true` means the reader's ANSI output is used as-is.

**Installer responsibilities (updated):**
1. Deploy reader + hook to `~/.config/bmad-statusline/` (unchanged)
2. Create `~/.cache/bmad-status/` (unchanged)
3. Inject hook config into `~/.claude/settings.json` (unchanged — 5 matchers, 3 event types)
4. Create internal config `~/.config/bmad-statusline/config.json` with defaults (NEW — if absent)
5. Inject `bmad-line-0` widget into ccstatusline line 0 (CHANGED — was individual widgets)
6. Detect and remove old bmad-* individual widgets from ccstatusline (NEW — upgrade path)

**Upgrade path (v1 → v2):**
- Detect old individual `bmad-*` widgets in ccstatusline → remove all
- Inject single `bmad-line-0`
- Create internal config via migration logic (Decision: Config Migration)
- Hook config upgrade (Rev.2 → Rev.2 is no-op if already 5-matcher)

**Uninstall (updated):**

| Component | Detection | Action |
|-----------|-----------|--------|
| `~/.config/ccstatusline/settings.json` | `id` matching `bmad-line-*` | Remove bmad-line-N widgets (NEW) |
| `~/.config/ccstatusline/settings.json` | `id` matching `bmad-*` (individual) | **Backward compat** — remove old individual widgets |
| `~/.config/bmad-statusline/config.json` | File exists | Delete (NEW) |
| All other uninstall targets | (unchanged from Rev.2) | (unchanged) |

### Dead Code Removal Scope

| Element | File | Action |
|---------|------|--------|
| `COMPOSITE_WIDGETS` array | `widget-registry.js` | **Delete** |
| `getCompositeWidgets()` | `widget-registry.js` | **Delete** |
| `buildWidgetConfig()` | `widget-registry.js` | **Delete** — TUI no longer builds ccstatusline widget arrays |
| `applyColorMode()` | `widget-registry.js` | **Delete** — only used by buildWidgetConfig |
| `compositeMode` parameter | `widget-registry.js` | **Delete** (with buildWidgetConfig) |
| `compact` handler | `bmad-sl-reader.js` | **Delete** |
| `full` handler | `bmad-sl-reader.js` | **Delete** |
| `minimal` handler | `bmad-sl-reader.js` | **Delete** |
| `bmad-compact` definition | `defaults.js` | **Replace** with `bmad-line-0` |
| `DualPreview` component | `components/DualPreview.js` | **Replace** with ThreeLinePreview |
| `WidgetDetailScreen` | `screens/WidgetDetailScreen.js` | **Delete** — absorbed by Edit Line inline shortcuts |
| `ColorModeScreen` | `screens/ColorModeScreen.js` | **Delete** — dynamic/fixed is widget-determined |
| `TargetLineScreen` | `screens/TargetLineScreen.js` | **Delete** — replaced by per-line editing model |
| `SelectWithPreview` | `components/SelectWithPreview.js` | **Evaluate** — may be reusable for Color Picker and Separator Style |

**Preserved in widget-registry.js:**
- `INDIVIDUAL_WIDGETS` — enriched with `defaultColor` and `defaultMode` fields
- `SEPARATOR_STYLES` — needed by ThreeLinePreview and Separator screen
- `getIndividualWidgets()` — returns widget metadata for Edit Line screen

### Workflow Colors

**Architectural decision:** Colors remain in reader (CJS, self-contained) with sync copy in `defaults.js`. Existing sync test validates alignment.

**Prescribed rules:**
- No `white` in any workflow color — use `brightWhite` or another visible color
- `document-project` and `generate-project-context`: change from white to a visible color
- Closely-used workflows (`create-story`, `dev-story`, `code-review`) must have clearly distinct colors
- Repetition acceptable across different categories (spaced apart)
- Exact color table = implementation detail, not architecture

### Decision Impact Analysis

**Implementation Sequence:**
1. Internal config schema + defaults (foundation for everything)
2. Dead code removal (clean slate for new code)
3. Reader `line N` command + story formatting + workflow colors
4. Config-loader v2 + migration logic
5. Config-writer v2 (internal config + ccstatusline sync)
6. TUI state model + navigation in app.js
7. Leaf components (Breadcrumb, ShortcutBar, ThreeLinePreview)
8. ScreenLayout wrapper
9. Screens (Home, Edit Line, Color Picker, Preset, Reorder Lines, Separator)
10. ReorderList + ConfirmDialog (used by screens)
11. Installer per-line deployment + upgrade path
12. Uninstaller updates
13. Bug fixes (BF1/BF2/BF3 resolved by architecture, verified by tests)

**Cross-Component Dependencies:**
- Internal config schema is the contract between TUI (writer), reader (consumer), and installer (default creator)
- Widget registry (`INDIVIDUAL_WIDGETS`) is the contract between TUI screens and config defaults
- `SEPARATOR_STYLES` shared between ThreeLinePreview (TUI) and reader (separate copy, CJS)
- ccstatusline sync logic depends on both internal config and ccstatusline config formats

**Assumptions Documented:**
- ccstatusline >= 2.2 with `custom-command` widget type and `preserveColors` support
- `config.json` is small enough for synchronous read/write without performance concern
- Reader is always at `~/.config/bmad-statusline/bmad-sl-reader.js` (existing contract)
- All 9 individual widget extractors continue to work identically (no changes to their logic)

### Rev.4 — Monitor Architectural Decisions

_10 new decisions for the Monitor feature. Complement existing Rev.3 decisions (all preserved unchanged)._

#### Status File v2 Schema

The status file evolves from flat scalars (~1 KB) to scalars + history arrays (up to several MB). Backward compatibility: all existing scalar fields (`last_read`, `last_write`, `last_write_op`, etc.) remain and continue to be updated. The reader is unchanged — it only accesses scalars.

**New fields:**

```json
{
  "llm_state": "active|permission|waiting",
  "llm_state_since": "<ISO 8601>",
  "reads": [
    { "path": "<string>", "in_project": true, "at": "<ISO 8601>", "agent_id": "<string|null>" }
  ],
  "writes": [
    { "path": "<string>", "in_project": true, "op": "write|edit", "is_new": false, "at": "<ISO 8601>", "agent_id": "<string|null>",
      "old_string": "<string|null>", "new_string": "<string|null>" }
  ],
  "commands": [
    { "cmd": "<string>", "at": "<ISO 8601>", "agent_id": "<string|null>" }
  ]
}
```

**Rules:**
- `old_string`/`new_string` stored only for Edit operations (not Write — full file content too large)
- `is_new` = true when first Write on a file not previously seen in `reads[]`
- `agent_id` = null for main agent, payload `agent_id` value for sub-agents
- No truncation of diff content — full `old_string`/`new_string` preserved
- Safety guard: if file exceeds 10 MB, stop appending to arrays, continue updating scalars
- **Atomic write pattern:** `writeFileSync(path + '.tmp', data)` then `renameSync(path + '.tmp', path)` — prevents corruption on crash mid-write
- `"inactive"` state is never written by hook — it is computed by TUI from `updated_at` age (>5 min)

#### Hook Expansion

Hook dispatch extends from 3 event types / 5 matchers to 5 event types / 8 matchers.

**New dispatch branches:**

```js
if (hookEvent === 'PostToolUse') {
  const toolName = payload.tool_name;
  if (toolName === 'Read') handleRead();
  else if (toolName === 'Write') handleWrite();
  else if (toolName === 'Edit') handleEdit();
  else if (toolName === 'Bash') handleBash();           // NEW
} else if (hookEvent === 'Stop') {
  handleStop();                                          // NEW
} else if (hookEvent === 'Notification') {
  handleNotification();                                  // NEW
}
```

**New handlers:**

- `handleBash()` — Extracts `payload.tool_input.command`, appends to `commands[]` array. Sets `llm_state = "active"`.
- `handleStop()` — Sets `llm_state = "waiting"`, `llm_state_since = now`.
- `handleNotification()` — Checks payload for permission-type notification. If permission: sets `llm_state = "permission"`, `llm_state_since = now`.

**Extended existing handlers:**

- `handleRead()` — In addition to existing scalar update, appends to `reads[]` with `{ path, in_project, at, agent_id }`. Sets `llm_state = "active"`.
- `handleWrite()` — Appends to `writes[]` with `{ path, in_project, op: "write", is_new, at, agent_id }`. Sets `llm_state = "active"`.
- `handleEdit()` — Appends to `writes[]` with `{ path, in_project, op: "edit", is_new: false, at, agent_id, old_string, new_string }`. Sets `llm_state = "active"`.
- `handleUserPrompt()` — Sets `llm_state = "active"`. On skill change, resets arrays (`reads = [], writes = [], commands = []`).

**New hook config (defaults.js):**

```js
PostToolUse: [
  { matcher: 'Read',  hooks: [{ type: 'command', command: `node "${hookPath}"` }] },
  { matcher: 'Write', hooks: [{ type: 'command', command: `node "${hookPath}"` }] },
  { matcher: 'Edit',  hooks: [{ type: 'command', command: `node "${hookPath}"` }] },
  { matcher: 'Bash',  hooks: [{ type: 'command', command: `node "${hookPath}"` }] },
],
Stop: [
  { matcher: '', hooks: [{ type: 'command', command: `node "${hookPath}"` }] }
],
Notification: [
  { matcher: '', hooks: [{ type: 'command', command: `node "${hookPath}"` }] }
],
```

#### Monitor Sub-Boundary

The Monitor is isolated in `src/tui/monitor/` — a self-contained sub-boundary within TUI (Boundary 7). Monitor components are never imported by the main TUI screens/components. The only integration point is `app.js` routing to `MonitorScreen` when `screen === 'monitor'`.

```
src/tui/monitor/
  MonitorScreen.js            # Main screen: polling, tabs, badge, scroll orchestration
  MonitorDetailScreen.js      # Detail pages: file edit/read, bash command, chronology
  components/
    SessionTabs.js            # Two-level tab system with colors and badges
    LlmBadge.js               # 4-state LLM activity badge
    FileTreeSection.js         # Tree view with detail mode cursor navigation
    BashSection.js             # Bash commands section, color-coded by family
    ScrollableViewport.js      # Reusable viewport scroll component
    ExportPrompt.js            # Export light/full mini-menu
  monitor-utils.js            # Polling logic, cache reading, CSV generation, sorting
```

**MonitorScreen does NOT use ScreenLayout** — no BMAD header, no ThreeLinePreview. Custom layout with sticky top (title + tabs + badge) and sticky bottom (shortcut bar only).

**New boundary: TUI↔Cache direct read.** MonitorScreen reads `~/.cache/bmad-status/status-*.json` and `.alive-*` files directly. This is a new coupling — previously TUI only touched internal config (Boundary 3). The `monitor-utils.js` module encapsulates all cache I/O, keeping it isolated from the rest of the TUI.

#### Polling Architecture

```js
const POLL_INTERVAL = 1500;

function useSessionPolling(cachePath) {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    function poll() {
      try {
        const aliveFiles = fs.readdirSync(cachePath)
          .filter(f => f.startsWith('.alive-'));
        const sessionData = [];
        for (const alive of aliveFiles) {
          const sessionId = alive.slice('.alive-'.length);
          const statusPath = path.join(cachePath, `status-${sessionId}.json`);
          try {
            const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
            if (status.skill) sessionData.push(status);
          } catch { /* skip corrupted/missing */ }
        }
        setSessions(sessionData);
      } catch { /* cache dir missing */ }
    }
    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [cachePath]);

  return sessions;
}
```

**Rules:**
- Pattern 2 compliant (readFileSync)
- Only sessions with `skill` defined are shown (BMAD sessions only)
- Parse errors → skip silently (corrupted or mid-write)
- `inactive` state computed in TUI: if `llm_state` is set but `updated_at` > 5 min → display as inactive (never written to file)
- `BMAD_CACHE_DIR` env var respected (Pattern 5)
- Cleanup on unmount via `clearInterval` in useEffect return

#### ScrollableViewport Component

Reusable viewport scroll component used by MonitorScreen (file sections + bash commands) and MonitorDetailScreen (detail content, chronology).

```js
function ScrollableViewport({ items, height, scrollOffset }) {
  const visible = items.slice(scrollOffset, scrollOffset + height);
  const above = scrollOffset;
  const below = Math.max(0, items.length - scrollOffset - height);

  return e(Box, { flexDirection: 'column' },
    above > 0 && e(Text, { dimColor: true }, `▲ ${above} de plus`),
    ...visible,
    below > 0 && e(Text, { dimColor: true }, `▼ ${below} de plus`),
  );
}
```

**Rules:**
- Parent manages `scrollOffset` state and ↑↓ keybindings via `useInput`
- `height` calculated from `useStdout().rows` minus sticky zones
- Scroll indicators (▲/▼) count hidden items above/below
- Component is stateless — parent controls everything

#### Tab System Architecture

**Grouping logic:**

```js
function groupSessionsByProject(sessions) {
  const groups = new Map();
  for (const s of sessions) {
    const key = s.project || 'unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  return groups;
}
```

**Navigation modes:**
- 1 project, 1 session → no tabs displayed
- 1 project, N sessions → ←→ navigates between sessions directly
- N projects → ←→ navigates between projects, Tab/Shift+Tab between sessions within active project

**Tab colors:**
- Project tab: `config.projectColors[projectName]` or hash-based default (same as ProjectColorsScreen)
- Session sub-tab: `config.skillColors[workflowName]` → `WORKFLOW_COLORS[workflowName]` → fallback white

**Aggregate project badge:** Display priority: permission > waiting > active > inactive (worst state wins).

**Reorder:** `r` reorders project tabs, `R` reorders session sub-tabs. Both use vertical ReorderList overlay (existing component reuse).

#### LLM State Machine

```
UserPromptSubmit ──→ ACTIVE
PostToolUse      ──→ ACTIVE
Stop             ──→ WAITING
Notification     ──→ PERMISSION (if permission-type)
(timeout 5min)   ──→ INACTIVE (computed in TUI only)
```

| State | Ink Color | Text | Badge Style |
|-------|-----------|------|-------------|
| ACTIVE | `green` | `⚡ ACTIF` | Bold, full-width colored background |
| PERMISSION | `yellow` | `⏳ PERMISSION` | Bold, full-width colored background |
| WAITING | `yellowBright` | `⏸ EN ATTENTE` | Bold, full-width colored background |
| INACTIVE | `dim` | `○ INACTIF` | Dim text, no background |

Badge also displays workflow name and elapsed timer (from `started_at`).

#### Detail Mode with Tree Navigation

Detail mode preserves the tree structure. Cursor jumps between `selectable: true` items (actual files and commands), skipping tree structure lines (directories, branch characters, section headers).

```js
const treeItems = [
  { text: '── FICHIERS MODIFIÉS (5) ──', selectable: false, type: 'header' },
  { text: 'src/', selectable: false, type: 'dir' },
  { text: '├── hook/', selectable: false, type: 'dir' },
  { text: '│   └── bmad-hook.js', selectable: true, type: 'file', data: {...} },
  // ...
  { text: '── COMMANDES (4) ──', selectable: false, type: 'header' },
  { text: 'npm test (×3)', selectable: true, type: 'command', data: {...} },
];
```

Enter on a selectable item navigates to MonitorDetailScreen with the item's `data`. Detail pages use their own ScrollableViewport for long content. Edit detail renders `old_string` lines in red and `new_string` lines in green (diff view).

#### CSV Export

Generated by `monitor-utils.js`:

- **Light:** Aggregated by file/command — columns: type, path, count
- **Full:** Every event — columns: type, path, operation, timestamp, detail
- **Destination:** `{output_folder}/monitor/monitor-{light|full}-{YYYY-MM-DD-HHmmss}.csv`
- `output_folder` resolved from `_bmad/bmm/config.yaml`

Triggered by `e` key → mini-menu (`l` = light, `f` = full, `Esc` = cancel). On export completion, shortcut bar temporarily replaced by confirmation message with full file path.

#### Installer Upgrade Path (Phase 3 → Phase 4)

**Detection:** Check if `Stop` matcher exists in `~/.claude/settings.json` hooks. If absent → upgrade needed.

**Upgrade:** Add 3 new matchers (PostToolUse Bash, Stop, Notification) without duplicating existing ones. Same hook script path, same deployment location. Existing matchers preserved.

### Rev.4 Decision Impact Analysis

**Implementation Sequence:**
1. Hook expansion (status file v2 + new handlers + atomic write)
2. Installer upgrade (3 new matchers)
3. ScrollableViewport component
4. monitor-utils.js (polling, cache reading, CSV generation)
5. MonitorScreen + useSessionPolling
6. SessionTabs + LlmBadge
7. FileTreeSection + BashSection
8. Detail mode (tree navigation with cursor)
9. MonitorDetailScreen (file detail, bash detail, chronology)
10. ExportPrompt + CSV export
11. HomeScreen update (Monitor button)
12. Tests

**Cross-Component Dependencies:**
- Status file v2 schema is the contract between hook (writer) and Monitor TUI (consumer)
- monitor-utils.js encapsulates all cache I/O — MonitorScreen depends on it, nothing else does
- ScrollableViewport is shared by MonitorScreen and MonitorDetailScreen
- SessionTabs reads from config (projectColors, skillColors) via props — same config used by existing TUI
- Installer upgrade is independent of TUI changes — can be deployed separately

## Implementation Patterns & Consistency Rules

### Critical Conflict Points Identified

21 areas where AI agents implementing different stories could make incompatible choices. Patterns 0-13 preserved from Rev.2 (hook/reader/installer). Patterns 14-20 new for TUI v2.

### Preserved from Rev.2 — Patterns 0-13

#### 0. Hook Entry Point Structure

The hook script follows this exact structure: Requires → Constants → Stdin parsing (try/catch → silent exit) → Guard (`_bmad/` check) → Alive touch → Dispatch on `hook_event_name` → Handlers → Story priority helper → Status file helpers → Main entry. **Rule:** Constants → helpers → handlers → main.

#### 1. Error Handling Triad

| Component | Philosophy | Pattern |
|-----------|-----------|---------|
| Reader (`src/reader/`) | **Silent always** | Return empty string on any error. Never console.log, never throw. |
| Hook (`src/hook/`) | **Silent always** | No output ever. Exit silently on any error. |
| Installer (`src/install.js`, etc.) | **Verbose always** | Log every action with `logSuccess`/`logSkipped`/`logError`. |
| **TUI (`src/tui/`)** | **StatusMessage on error** | Display via Ink StatusMessage, persist until keypress. Never console.log. Never crash to terminal on recoverable error. |

#### 2. File I/O Pattern

**Synchronous fs everywhere. No async, no promises, no callbacks.** Applies to hook, reader, installer, AND TUI config reads/writes. Prevents race conditions.

#### 3. ANSI Color Wrapping

All ANSI coloring in the reader via `colorize()` helper. Never inline escape codes. In the TUI, use Ink's `<Text color={...}>` props — never ANSI escapes in React components.

#### 4. Config JSON Mutation Sequence — Installer Only

```
read → parse → backup(.bak) → modify in memory → stringify(null, 2) → write → reread → parse(validate)
```
Applies ONLY to ccstatusline config writes from installer and TUI ccstatusline sync. Does NOT apply to internal config writes (pattern 14).

#### 5. Path Construction

- **Installer:** `path.join()` everywhere, all paths through injected `paths` parameter.
- **Reader + Hook:** Respect `BMAD_CACHE_DIR` env var: `process.env.BMAD_CACHE_DIR || path.join(os.homedir(), '.cache', 'bmad-status')`
- **Reader + TUI (NEW):** Respect `BMAD_CONFIG_DIR` env var: `process.env.BMAD_CONFIG_DIR || path.join(os.homedir(), '.config', 'bmad-statusline')`
- **Internal config path:** `path.join(BMAD_CONFIG_DIR, 'config.json')` — same env var in reader and TUI.

#### 6. Console Output Format — Installer Only

```js
function logSuccess(target, message) { console.log(`  ✓ ${target} — ${message}`); }
function logSkipped(target, message) { console.log(`  ○ ${target} — ${message}`); }
function logError(target, message)   { console.log(`  ✗ ${target} — ${message}`); }
```

#### 7. Hook Stdin Parsing

Dispatch on `hook_event_name` first, then `tool_name`. All stdin parsing wrapped in try/catch — any failure → silent exit (exit code 0).

#### 8. Hook Status File I/O — Cache Pattern

```
read existing (or create defaults) → merge new fields → stringify(null, 2) → write
```
No backup, no validation post-write. Read-before-write mandatory. Create cache dir if absent. Synchronous.

#### 9. Hook Path Matching

All patterns on normalized paths (forward slashes). Always validate step/story path belongs to active **skill** before updating status.

```js
const skillDir = normalize(path.join(cwd, '.claude', 'skills', activeSkill));
if (!normalize(filePath).startsWith(skillDir)) return;
```

#### 10. Skill Name Normalization

```js
const SKILL_REGEX = /((?:bmad|gds|wds)-[\w-]+)/;
const workflowName = skillName.slice(skillName.indexOf('-') + 1);
```
`skillName` for path construction. `workflowName` for display + color lookup. Dynamic slicer — never hardcode `slice(5)`.

#### 11. cwd Scoping

```js
function isInProject(filePath, cwd) {
  return normalize(filePath).startsWith(normalize(cwd));
}
```
First check in Read/Write/Edit handlers, before any pattern matching.

#### 12. Story Priority Resolution

```js
function shouldUpdateStory(incomingPriority, currentPriority) {
  if (incomingPriority === 1) return true;
  if (incomingPriority === 2 && (!currentPriority || currentPriority === 3)) return true;
  if (incomingPriority === 3 && !currentPriority) return true;
  return false;
}
```
Never set story directly without priority check. Workflow gating via `STORY_WORKFLOWS`.

#### 13. Step Multi-Track Detection

```js
const STEP_REGEX = /\/steps(-[a-z])?\/step-(?:[a-z]-)?(\d+)-(.+)\.md$/;
```
Total per track directory. Recalculate if track changes.

### New for TUI v2 — Patterns 14-20

#### 14. Internal Config I/O

**Write pattern (TUI side — lightweight, our own file):**
```js
const CONFIG_DIR = process.env.BMAD_CONFIG_DIR || path.join(os.homedir(), '.config', 'bmad-statusline');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

function writeInternalConfig(config) {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
  } catch {
    // Write failure — config state is preserved in React, will retry on next interaction
    // Surface error via StatusMessage (pattern 1 — TUI error handling)
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
- `BMAD_CONFIG_DIR` env var must be used in both TUI and reader for testability and consistency.
- `JSON.stringify(config, null, 2) + '\n'` — 2-space indent, trailing newline (consistent with all other JSON writes).
- Synchronous I/O (pattern 2).

#### 15. TUI State Mutation

**Rule: Never mutate config directly. Always produce a new object.**

```js
// ✅ CORRECT — structuredClone + setConfig
function updateConfig(mutator) {
  setConfig(prev => {
    const next = structuredClone(prev);
    mutator(next);
    writeInternalConfig(next);
    syncCcstatuslineIfNeeded(prev, next);
    return next;
  });
}

// Usage in screen handler:
updateConfig(cfg => {
  cfg.lines[editingLine].widgets.push(widgetId);
  cfg.lines[editingLine].colorModes[widgetId] = { mode: 'fixed', fixedColor: getDefaultColor(widgetId) };
});

// ❌ WRONG — direct mutation
config.lines[0].widgets.push(widgetId);
setConfig(config); // React won't detect the change — same reference
```

**Rules:**
- `structuredClone` for deep copy — never spread operator (shallow copy misses nested objects).
- Disk write inside the `setConfig` callback (or `updateConfig` helper) — never in a `useEffect`.
- No `useEffect` that reads `config` and writes `config` — this is the BF2 render loop root cause.

#### 16. ccstatusline Sync Pattern

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

  // Full rebuild — simpler than incremental add/remove
  const ccConfig = readCcstatuslineConfig();
  if (!ccConfig) return; // silent failure

  for (let i = 0; i < 3; i++) {
    removeBmadLineFromCcLine(ccConfig, i);
    if (newConfig.lines[i].widgets.length > 0) {
      addBmadLineToCcLine(ccConfig, i, readerPath);
    }
  }
  writeCcstatuslineConfig(ccConfig); // pattern 4 — backup/validate
}
```

**ccstatusline widget format:**
```js
{
  id: `bmad-line-${lineIndex}`,
  type: 'custom-command',
  commandPath: `node "${readerPath}" line ${lineIndex}`,
  preserveColors: true
}
```

**Rules:**
- ccstatusline config writes follow pattern 4 (backup/validate). Internal config writes follow pattern 14 (no backup).
- Sync compares old vs new config — requires `updateConfig` to have access to both.
- On `resetToOriginal`, use `syncCcstatuslineFromScratch` — rebuild all 3 lines from scratch instead of diffing.
- The `readerPath` for `commandPath` is the deployed reader: `path.join(BMAD_CONFIG_DIR, 'bmad-sl-reader.js')`.

#### 17. Preview Override Pattern (Try-Before-You-Buy)

**Architecture:** Two-layer rendering — `config` (persisted truth) and `previewOverride` (transient).

```js
// ThreeLinePreview receives:
const effectiveConfig = previewOverride || config;

// Color Picker — on highlight (arrow key):
setPreviewOverride(() => {
  const preview = structuredClone(config);
  preview.lines[editingLine].colorModes[selectedWidget] = { mode: 'fixed', fixedColor: highlightedColor };
  return preview;
});

// Color Picker — on select (Enter):
updateConfig(cfg => {
  cfg.lines[editingLine].colorModes[selectedWidget] = { mode: 'fixed', fixedColor: selectedColor };
});
setPreviewOverride(null);

// Color Picker — on cancel (Escape):
setPreviewOverride(null);
// goBack() also clears previewOverride
```

**Rules:**
- `previewOverride` is NEVER written to disk — it's transient React state only.
- `setPreviewOverride(null)` in `goBack()` — always clear on navigation back.
- Screens that support preview-on-highlight: Color Picker, Separator Style, Preset Load.
- Screens that do NOT: Home, Edit Line (changes are immediate — h/g modify config directly).

#### 18. Screen Props Contract

**Every screen component receives a standard props interface:**

```js
// Props passed by App to every screen:
{
  config,              // current persisted config
  updateConfig,        // (mutator) => void — pattern 15
  previewOverride,     // config | null — pattern 17
  setPreviewOverride,  // (config | null) => void
  navigate,            // (screenName, context?) => void
  goBack,              // () => void
  editingLine,         // 0|1|2|null — set when in Edit Line or sub-screens
  selectedWidget,      // widget ID | null — set when in Color Picker
}
```

**Rules:**
- Screens never call `setConfig` directly — always through `updateConfig` (pattern 15).
- Screens never read ccstatusline config — only the internal config via `config` prop.
- Screens never write to disk — `updateConfig` handles persistence.
- Sub-screens (Color Picker, Preset) inherit `editingLine` from the parent Edit Line context.

#### 19. Color Resolution in Preview

**Centralized in a helper function — not duplicated per component:**

```js
function resolvePreviewColor(widgetId, colorModes) {
  const mode = colorModes[widgetId];
  if (!mode) return getDefaultColor(widgetId); // fallback to widget default
  if (mode.mode === 'dynamic') return WORKFLOW_SAMPLE_COLOR; // e.g., 'green' for 'dev-story'
  return mode.fixedColor;
}
```

**Used by:**
- `ThreeLinePreview` — for rendering colored Text segments
- `EditLineScreen` — for showing inline color status (e.g., `Project  ■ visible  cyan`)
- `PresetScreen` — for mini-preview of stored presets

**Rules:**
- `WORKFLOW_SAMPLE_COLOR` is a constant (e.g., `'green'`), not computed from WORKFLOW_COLORS. The preview doesn't know the current workflow — it shows a representative color.
- `getDefaultColor(widgetId)` reads from `INDIVIDUAL_WIDGETS[].defaultColor` — single source of truth.
- This helper lives in a shared TUI utility (e.g., `src/tui/preview-utils.js`), not duplicated per component.

#### 20. Reader Internal Config Reading

**Pattern mirrors TUI's read (pattern 14) with reader-specific constraints:**

```js
// In reader (CJS):
const CONFIG_DIR = process.env.BMAD_CONFIG_DIR || path.join(os.homedir(), '.config', 'bmad-statusline');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

function readLineConfig(lineIndex) {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    if (!config.lines || !config.lines[lineIndex]) return null;
    return {
      widgets: config.lines[lineIndex].widgets || [],
      colorModes: config.lines[lineIndex].colorModes || {},
      separator: config.separator || 'serre',
      customSeparator: config.customSeparator || null
    };
  } catch {
    return null; // silent failure — pattern 1
  }
}
```

**Separator resolution (reader-internal):**
```js
const READER_SEPARATORS = {
  serre: '\u2503',
  modere: ' \u2503 ',
  large: '  \u2503  ',
};

function resolveSeparator(style, custom) {
  if (style === 'custom' && custom) return custom;
  return READER_SEPARATORS[style] || READER_SEPARATORS.serre;
}
```

**Rules:**
- Same `BMAD_CONFIG_DIR` env var as TUI (pattern 5) — critical for testability.
- Reader NEVER writes to config.json — read-only consumer.
- Reader separator map is its OWN copy (CJS, not imported from TUI). Must stay in sync manually.
- Reader ALWAYS returns empty string on any error — config missing, malformed, line index out of bounds.

### New for TUI Process Lifecycle — Pattern 28

#### 28. TUI Process Lifecycle Management

**Multi-instance PID registry + signal handlers + TTY orphan detection.** The TUI supports multiple simultaneous instances. Orphan prevention uses three complementary mechanisms:

**A. PID Registry (`tui-pids.json` in cache directory):**

```js
// On startup — register PID, purge dead entries
const registryPath = path.join(cachePath, 'tui-pids.json');

function loadRegistry() {
  try { return JSON.parse(fs.readFileSync(registryPath, 'utf8')); }
  catch { return { pids: [] }; }
}

function saveRegistry(registry) {
  // Atomic write (Pattern 22): tmp + renameSync
  const tmp = registryPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(registry, null, 2));
  fs.renameSync(tmp, registryPath);
}

function registerPid() {
  const registry = loadRegistry();
  // Purge dead PIDs
  registry.pids = registry.pids.filter(pid => {
    try { process.kill(pid, 0); return true; }
    catch { return false; }
  });
  registry.pids.push(process.pid);
  saveRegistry(registry);
}

function unregisterPid() {
  const registry = loadRegistry();
  registry.pids = registry.pids.filter(pid => pid !== process.pid);
  saveRegistry(registry);
}
```

**B. Signal Handlers:**

```js
// Register BEFORE Ink render — cleanup on any exit path
function gracefulShutdown() {
  unregisterPid();
  restoreScreen();
  process.exit();
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.on('SIGHUP', gracefulShutdown);
process.on('uncaughtException', () => { unregisterPid(); restoreScreen(); process.exit(1); });
process.on('unhandledRejection', () => { unregisterPid(); restoreScreen(); process.exit(1); });
```

**C. TTY Orphan Detection:**

```js
// Periodic check — catches "terminal closed" on Windows where signals aren't delivered
const ttyCheckId = setInterval(() => {
  if (!process.stdout.isTTY) {
    clearInterval(ttyCheckId);
    unregisterPid();
    process.exit();
  }
}, 5000); // 5 seconds
ttyCheckId.unref(); // Don't block Node exit
```

**Rules:**
- Registry lives in cache directory (`BMAD_CACHE_DIR`), same location as `.alive-*` and `status-*.json` (Pattern 5)
- Atomic write for registry (Pattern 22) — prevents corruption if two instances start simultaneously
- `unregisterPid()` is idempotent — safe to call multiple times
- `ttyCheckId.unref()` ensures the interval doesn't prevent natural Node.js exit
- Signal handlers registered BEFORE `inkRender()` — not after
- SIGINT handler coexists with Ink's internal SIGINT handling — Ink calls `process.exit()` which triggers the `exit` event listener (existing screen restore)
- Never `process.kill(pid, 9)` live instances — only purge entries where `process.kill(pid, 0)` throws

### New for Monitor — Patterns 21-27

#### 21. Polling Lifecycle

**useEffect + setInterval + readFileSync + clearInterval cleanup.** No async polling, no forgotten cleanup.

```js
// ✅ CORRECT
useEffect(() => {
  function poll() { /* readFileSync + JSON.parse + setSessions */ }
  poll();
  const id = setInterval(poll, 1500);
  return () => clearInterval(id);
}, [cachePath]);

// ❌ WRONG — async in setInterval (violates Pattern 2)
// ❌ WRONG — no cleanup (leak on unmount)
```

Immediate first poll, then interval. Sync I/O inside interval callback (Pattern 2 compliant). Cleanup always via useEffect return function.

#### 22. Atomic Status File Write

**Write to `.tmp`, then `renameSync`.** Prevents corruption on crash mid-write for status files that can reach 500 KB+.

```js
function writeStatus(sessionId, status) {
  const filePath = path.join(CACHE_DIR, `status-${sessionId}.json`);
  const tmpPath = filePath + '.tmp';
  status.updated_at = new Date().toISOString();
  fs.writeFileSync(tmpPath, JSON.stringify(status, null, 2) + '\n');
  fs.renameSync(tmpPath, filePath);
}
```

Applies to hook status file writes only. Internal config (Pattern 14) stays small and keeps direct write.

#### 23. Monitor Cache I/O Isolation

**All cache file reads in `monitor-utils.js` only.** React components never touch the filesystem.

```js
// ✅ CORRECT — centralized in monitor-utils.js
import { pollSessions } from './monitor-utils.js';

// ❌ WRONG — reading cache in a React component
function FileTreeSection({ cachePath }) {
  const data = JSON.parse(fs.readFileSync(...)); // forbidden
}
```

`monitor-utils.js` is the sole module that reads `.alive-*` and `status-*.json` from cache. Components receive session data via props from MonitorScreen.

#### 24. Viewport Scroll Externalized State

**ScrollableViewport is stateless. Parent owns scroll offset AND keybindings.**

```js
// ✅ CORRECT — parent manages state
function MonitorScreen() {
  const [scrollOffset, setScrollOffset] = useState(0);
  useInput((input, key) => {
    if (key.upArrow) setScrollOffset(prev => Math.max(0, prev - 1));
    if (key.downArrow) setScrollOffset(prev => Math.min(maxOffset, prev + 1));
  });
  return e(ScrollableViewport, { items, height, scrollOffset });
}

// ❌ WRONG — internal state in ScrollableViewport
// ❌ WRONG — useInput inside ScrollableViewport (conflicts with parent)
```

This enables parent-controlled features: auto-scroll, jump-to-position, programmatic scroll on new data.

#### 25. Contextual Shortcut Bar

**Each Monitor mode has its own shortcut array. Never show all shortcuts at once.**

```js
const NORMAL_SHORTCUTS = [
  { key: '◄►', label: 'onglets' }, { key: '↑↓', label: 'scroll' },
  { key: 'd', label: 'détail' }, { key: 'c', label: 'chrono' },
  { key: 'e', label: 'export' }, { key: 'Esc', label: 'Back home' },
];
const DETAIL_SHORTCUTS = [
  { key: '↑↓', label: 'naviguer' }, { key: 'Enter', label: 'détail' },
  { key: 's', label: 'tri' }, { key: 'Esc', label: 'retour' },
];
```

Shortcut families color-coded: navigation (cyan), modes (yellow), actions (green), toggles (magenta), exit (dim). ShortcutBar component already supports dynamic arrays — pass different arrays per mode.

#### 26. Tree Navigation with Selectable Flag

**Preserve tree structure in detail mode. Use `selectable` flag — never flatten.**

```js
const items = [
  { text: '── FICHIERS MODIFIÉS (5) ──', selectable: false, type: 'header' },
  { text: 'src/', selectable: false, type: 'dir' },
  { text: '├── hook/', selectable: false, type: 'dir' },
  { text: '│   └── bmad-hook.js', selectable: true, type: 'file', data: {...} },
];
// ↑↓ jumps to next selectable: true item
```

Tree structure (directories, branches, section headers) is rendered but not selectable. Cursor skips to next file or command. This preserves spatial context during navigation.

#### 27. Monitor Props Contract

**Extension of Pattern 18 for MonitorScreen.**

```js
// MonitorScreen receives from app.js:
{
  config,           // for tab colors (projectColors, skillColors)
  navigate,         // for detail page navigation
  goBack,           // Esc → back to home
  isActive,         // for useInput gating
  paths: {
    cachePath,      // BMAD_CACHE_DIR resolved
    outputFolder,   // for CSV export destination
  },
}
```

MonitorScreen reads `config.projectColors` and `config.skillColors` for tab colors. It does NOT read `config.lines`, `config.presets`, or `config.separator` — those are configurator concerns, not monitor concerns.

### Enforcement Guidelines

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

**New for Monitor (Rev.4):**
- Use `monitor-utils.js` for all cache file I/O — never read cache in React components (pattern 23)
- Use atomic write (tmp + renameSync) for status file writes (pattern 22)
- Keep ScrollableViewport stateless — parent manages offset and keybindings (pattern 24)
- Show only mode-relevant shortcuts in ShortcutBar — never all 15 at once (pattern 25)
- Preserve tree structure in detail mode — use `selectable` flag, never flatten (pattern 26)
- Use cleanup function in useEffect for polling intervals — never leak timers (pattern 21)
- Respect `BMAD_CACHE_DIR` env var for cache path in monitor-utils.js (pattern 5)
- MonitorScreen receives paths via props — never resolve paths internally (pattern 27)
- Append to history arrays (`reads[]`, `writes[]`, `commands[]`) alongside scalar updates — never replace scalars-only (backward compat)

**New for TUI Process Lifecycle (Rev.5):**
- Register PID on startup, unregister on exit — never skip PID cleanup (pattern 28)
- Use atomic write (tmp + rename) for `tui-pids.json` — never direct write (pattern 22, 28)
- Only purge dead PIDs from registry — never kill live instances (pattern 28)
- Register signal handlers BEFORE `inkRender()` — never after (pattern 28)
- Use `ttyCheckId.unref()` — never block Node.js exit with orphan detection interval (pattern 28)

### Test Organization & Conventions

**Structure:** Tests in `test/` directory, mirroring `src/` layout.

```
test/
  reader.test.js        # Updated — add line N tests, story formatting, remove composite tests
  hook.test.js          # Unchanged from Rev.2
  install.test.js       # Updated — bmad-line-0 injection, upgrade from v1
  uninstall.test.js     # Updated — bmad-line-N removal
  clean.test.js         # Unchanged from Rev.2
  defaults.test.js      # Updated — new getWidgetDefinitions format
  cli.test.js           # Unchanged
  tui-app.test.js       # Updated — multi-line state, config mutation, reset
  tui-config-loader.test.js  # Updated — internal config loading, v1 migration
  tui-config-writer.test.js  # Updated — internal config writing, ccstatusline sync
  tui-widget-registry.test.js # Updated — dead code removed, defaults added
  tui-components.test.js      # NEW — ThreeLinePreview, ReorderList, ConfirmDialog
  tui-screens.test.js         # NEW — EditLine, ColorPicker, Preset, ReorderLines
  fixtures/
    internal-config-default.json    # NEW — default internal config
    internal-config-multiline.json  # NEW — multi-line config with presets
    ccstatusline-settings-v1.json   # NEW — legacy individual widgets (migration test)
    (all existing fixtures preserved)
```

**TUI test patterns:**
- Use `ink-testing-library` for component rendering tests
- Test `updateConfig` mutation produces correct config shape
- Test ccstatusline sync triggers only on empty/non-empty transitions
- Test `previewOverride` clears on goBack
- Test `resetToOriginal` produces identical config to snapshot

## Project Structure & Boundaries

### Complete Project Directory Structure

```
bmad-statusline/
  .claude/
    settings.local.json                         # UNCHANGED
  .github/
    workflows/
      test.yml                                  # UNCHANGED
  .gitignore                                    # UNCHANGED
  LICENSE                                       # UNCHANGED
  README.md                                     # MODIFIED — document TUI v2, line N command
  package.json                                  # UNCHANGED
  package-lock.json                             # UNCHANGED
  bin/
    cli.js                                      # UNCHANGED — dispatch only
  src/
    hook/
      bmad-hook.js                              # MODIFIED (Rev.4) — handleBash, handleStop, handleNotification, array history, atomic write, llm_state
      package.json                              # UNCHANGED — CJS marker
    reader/
      bmad-sl-reader.js                         # MODIFIED — add line N, remove compact/full/minimal, story formatting, color fixes
      package.json                              # UNCHANGED — CJS marker
    tui/
      app.js                                    # MODIFIED (Rev.3+4) — multi-line state, updateConfig, navigation, Monitor route + paths prop
      config-loader.js                          # MODIFIED — load internal config, v1→v2 migration
      config-writer.js                          # MODIFIED — write internal config + ccstatusline sync
      widget-registry.js                        # MODIFIED — remove dead code, add defaultColor/defaultMode to INDIVIDUAL_WIDGETS
      preview-utils.js                          # NEW — resolvePreviewColor(), SAMPLE_VALUES, separator resolution
      components/
        Breadcrumb.js                           # UNCHANGED (exists from v1)
        ConfirmDialog.js                        # UNCHANGED (exists from v1)
        ThreeLinePreview.js                     # NEW — replaces DualPreview
        ShortcutBar.js                          # UNCHANGED (exists from v1)
        ScreenLayout.js                         # MODIFIED — uses ThreeLinePreview instead of DualPreview
        ReorderList.js                          # UNCHANGED (exists from v1)
        DualPreview.js                          # DELETED — replaced by ThreeLinePreview
        SelectWithPreview.js                    # EVALUATE — keep if reusable, else delete
      screens/
        HomeScreen.js                           # MODIFIED (Rev.3+4) — menu options + Monitor button
        EditLineScreen.js                       # NEW — per-line widget list, h/g/c/s/l shortcuts
        ColorPickerScreen.js                    # MODIFIED — simplified, Dynamic for workflow only
        PresetScreen.js                         # NEW — save/load with 3 shared slots
        ReorderLinesScreen.js                   # NEW — swap entire line contents
        SeparatorStyleScreen.js                 # UNCHANGED
        WidgetsListScreen.js                    # DELETED — replaced by EditLineScreen
        WidgetDetailScreen.js                   # DELETED — absorbed by EditLineScreen shortcuts
        ColorModeScreen.js                      # DELETED — dynamic/fixed is widget-determined
        WidgetOrderScreen.js                    # DELETED — replaced by ReorderList in EditLineScreen
        TargetLineScreen.js                     # DELETED — replaced by per-line editing model
        PlaceholderScreen.js                    # DELETED — no longer needed
        PresetsScreen.js                        # DELETED — replaced by PresetScreen (split save/load)
      monitor/                                    # NEW (Rev.4) — Monitor sub-boundary
        MonitorScreen.js                          # NEW — main: polling, tabs, badge, scroll orchestration
        MonitorDetailScreen.js                    # NEW — detail pages (file edit/read, bash, chronology)
        components/
          SessionTabs.js                          # NEW — 2-level tabs with colors and badges
          LlmBadge.js                             # NEW — 4-state LLM activity badge
          FileTreeSection.js                      # NEW — tree view + detail mode cursor navigation
          BashSection.js                          # NEW — bash commands, color-coded by family
          ScrollableViewport.js                   # NEW — reusable viewport scroll component
          ExportPrompt.js                         # NEW — export light/full mini-menu
        monitor-utils.js                          # NEW — cache I/O, polling, CSV generation, sorting
    defaults.js                                 # MODIFIED (Rev.3+4) — getWidgetDefinitions, default colors, new hook matchers
    install.js                                  # MODIFIED (Rev.3+4) — per-line deployment, internal config, Phase 3→4 upgrade
    uninstall.js                                # MODIFIED — remove bmad-line-N, remove internal config
    clean.js                                    # UNCHANGED (Rev.2 — .alive-based cleanup)
  test/
    reader.test.js                              # MODIFIED — line N tests, story formatting, remove composite tests
    hook.test.js                                # MODIFIED (Rev.4) — new handlers, array history, atomic write, llm_state
    install.test.js                             # MODIFIED — bmad-line-0 injection, upgrade path, internal config creation
    uninstall.test.js                           # MODIFIED — bmad-line-N removal, internal config deletion
    defaults.test.js                            # MODIFIED — new getWidgetDefinitions format
    clean.test.js                               # UNCHANGED (Rev.2)
    cli.test.js                                 # UNCHANGED
    tui-app.test.js                             # MODIFIED — multi-line state, updateConfig, reset, navigation
    tui-config-loader.test.js                   # MODIFIED — internal config loading, v1 migration
    tui-config-writer.test.js                   # MODIFIED — internal config writing, ccstatusline sync
    tui-widget-registry.test.js                 # MODIFIED — dead code removed, defaults enriched
    tui-preview-utils.test.js                   # NEW — color resolution, sample values
    tui-components.test.js                      # NEW — ThreeLinePreview, ReorderList rendering
    tui-screens.test.js                         # NEW — EditLine, ColorPicker, Preset, ReorderLines
    fixtures/
      .gitkeep                                  # UNCHANGED
      claude-settings-empty.json                # UNCHANGED
      claude-settings-with-statusline.json      # UNCHANGED
      claude-settings-with-hooks.json           # UNCHANGED (Rev.2 — 5-matcher)
      claude-settings-with-hooks-phase2.json    # UNCHANGED (Rev.2 — upgrade tests)
      ccstatusline-settings-empty.json          # UNCHANGED
      ccstatusline-settings-with-bmad.json      # UNCHANGED — legacy v1 individual widgets
      ccstatusline-settings-with-bmad-v2.json   # NEW — bmad-line-N composite widgets
      claude-md-with-block.md                   # UNCHANGED — backward compat
      claude-md-without-block.md                # UNCHANGED — backward compat
      status-sample.json                        # UNCHANGED (Rev.2)
      status-empty.json                         # UNCHANGED
      internal-config-default.json              # NEW — default internal config
      internal-config-multiline.json            # NEW — multi-line with presets populated
      internal-config-v1-migration.json         # NEW — expected output of v1→v2 migration
      spike-preserve-colors.js                  # UNCHANGED
      spike-userpromptsubmit-payload.json       # UNCHANGED — hook payload examples
      status-with-history.json                  # NEW (Rev.4) — status file v2 with arrays
      status-multi-session.json                 # NEW (Rev.4) — multiple sessions fixture
      claude-settings-with-hooks-phase4.json    # NEW (Rev.4) — 8-matcher hook config
```

**New test files (Rev.4):**

```
test/
  tui-monitor.test.js                           # NEW — MonitorScreen, polling, tabs, scroll
  tui-monitor-detail.test.js                    # NEW — detail pages, chronology, export
  tui-monitor-components.test.js                # NEW — ScrollableViewport, LlmBadge, SessionTabs, etc.
```

### Architectural Boundaries

**Boundary 1: Hook (runtime, standalone) — THE WRITER**
- `src/hook/bmad-hook.js` — deployed to `~/.config/bmad-statusline/`
- CommonJS, zero dependencies, self-contained
- **MODIFIED in Rev.4** — new handlers (Bash, Stop, Notification), history arrays (reads[], writes[], commands[]), llm_state tracking, atomic write pattern (Pattern 22)
- The **sole** writer of status data and `.alive` files

**Boundary 2: Reader (runtime, standalone) — THE CONSUMER**
- `src/reader/bmad-sl-reader.js` — deployed to `~/.config/bmad-statusline/`
- CommonJS, zero dependencies, self-contained
- **MODIFIED in Rev.3** — adds `line N` command, reads internal config, removes legacy composites
- Contains its **own copies** of color maps AND separator maps (not imported)
- Communication: ccstatusline stdin JSON → status file read + internal config read → stdout text

**Boundary 3: Internal Config (runtime, shared file) — THE CONTRACT**
- `~/.config/bmad-statusline/config.json` — NEW boundary in Rev.3
- **Written by:** TUI (every interaction) and installer (default on first install)
- **Read by:** Reader (for `line N` output) and TUI (on launch)
- Schema defined in "Internal Config Architecture" decision
- This file is the coupling point between TUI and reader — both must agree on schema

**Boundary 4: CLI Entry Point (dispatch only)**
- `bin/cli.js` — routes: `install`, `uninstall`, `clean`, `--help`, no-arg→TUI
- No business logic. **UNCHANGED.**

**Boundary 5: Command Modules (install-time)**
- `src/install.js`, `src/uninstall.js`, `src/clean.js`
- Each receives `paths` parameter (injected, testable)
- **MODIFIED:** Install creates internal config + deploys bmad-line-0. Uninstall removes bmad-line-N + deletes internal config. Clean unchanged.

**Boundary 6: Defaults (shared data, install-time only)**
- `src/defaults.js` — all config templates
- **MODIFIED:** `getWidgetDefinitions()` returns bmad-line-0 format

**Boundary 7: TUI (configurator + monitor, ESM)**
- `src/tui/` — React/Ink components, ESM
- **MAJOR CHANGES in Rev.3** — multi-line state model, new screens, new components
- **EXTENDED in Rev.4** — Monitor sub-boundary adds real-time dashboard capability
- Writes to internal config (Boundary 3) and ccstatusline config
- **Rev.4: Also READS cache status files** via Boundary 8 (monitor-utils.js)
- Sub-boundaries within TUI:
  - `app.js` — state management, navigation, persistence orchestration
  - `config-loader.js` / `config-writer.js` — I/O layer for internal + ccstatusline configs
  - `preview-utils.js` — shared rendering logic for preview and inline status
  - `components/` — reusable layout/interaction components
  - `screens/` — screen-level compositions
  - `monitor/` **(NEW Rev.4)** — isolated Monitor sub-boundary (Pattern 23). Own screens, components, utils. Reads cache via monitor-utils.js only.

**Boundary 8: TUI↔Cache Read Path (NEW Rev.4)**
- `src/tui/monitor/monitor-utils.js` — sole module that reads cache from TUI
- **Read-only:** TUI never modifies status files or .alive files
- Reads `~/.cache/bmad-status/.alive-*` and `status-*.json`
- `BMAD_CACHE_DIR` env var respected (Pattern 5)
- Encapsulates: session discovery, status parsing, error handling, CSV generation
- Separated from Boundary 3 (internal config) — two distinct I/O paths

### Data Flow

**Install flow (updated Rev.4):**
```
npx bmad-statusline install
  → bin/cli.js → src/install.js → defaults.js for templates
  → write hooks to ~/.claude/settings.json (8 matchers — Rev.4 adds Bash, Stop, Notification)
  → write statusLine config (unchanged)
  → create internal config ~/.config/bmad-statusline/config.json (defaults)
  → write bmad-line-0 to ccstatusline settings
  → copy reader + hook to ~/.config/bmad-statusline/
  → create ~/.cache/bmad-status/
```

**TUI flow (new):**
```
npx bmad-statusline (no args)
  → bin/cli.js → src/tui/app.js
  → config-loader: read internal config (or migrate v1 / create defaults)
  → capture snapshot for reset
  → render Home with ThreeLinePreview
  → user interactions → updateConfig(mutator)
    → structuredClone → mutate → writeInternalConfig
    → if line empty/non-empty changed → syncCcstatusline
  → q/Ctrl+C → exit (all changes already persisted)
```

**Reader flow (updated):**
```
ccstatusline refresh → stdin JSON → node bmad-sl-reader.js line 0
  → parse stdin → extract session_id → read status file
  → read internal config → extract line 0 config
  → for each visible widget: call individual extractor → apply color
  → join with separator → stdout
```

**Monitor flow (NEW Rev.4):**
```
npx bmad-statusline (no args) → Home → Monitor button
  → app.js routes to MonitorScreen with config + paths
  → useSessionPolling(cachePath) — immediate poll + setInterval(1500ms)
    → readdir .alive-* → read status-{id}.json for each alive session
    → filter: only sessions with skill defined (BMAD sessions)
    → compute: inactive override if updated_at > 5 min
    → setSessions(data) → re-render
  → SessionTabs groups by project, resolves colors from config
  → LlmBadge shows worst-state badge for active session
  → ScrollableViewport renders file sections + bash commands
  → Detail mode: cursor on tree items (selectable flag)
    → Enter → navigate to MonitorDetailScreen(itemData)
  → Chronology: navigate to MonitorDetailScreen(chronology mode)
  → Export: ExportPrompt → monitor-utils.generateCsv() → write to output_folder/monitor/
  → Esc → goBack() to Home
```

**Hook flow — MODIFIED in Rev.4 (extended from Rev.2):**
```
Claude Code event → stdin JSON → node bmad-hook.js
  → parse stdin → extract session_id → touchAlive
  → dispatch on hook_event_name:
    UserPromptSubmit → detect skill, set llm_state="active", reset arrays on skill change
    PostToolUse Read → update last_read + append to reads[], set llm_state="active"
    PostToolUse Write → update last_write + append to writes[], set llm_state="active"
    PostToolUse Edit → update last_write + append to writes[] with old/new_string, set llm_state="active"
    PostToolUse Bash → append to commands[], set llm_state="active"           (NEW)
    Stop → set llm_state="waiting"                                            (NEW)
    Notification → if permission type, set llm_state="permission"             (NEW)
    SessionStart → no-op (alive already touched)
  → atomic write: writeFileSync(.tmp) + renameSync                            (NEW)
```

### Requirements to Structure Mapping

| Requirement | Files |
|-------------|-------|
| FR1-6: Widget config per line | `src/tui/screens/EditLineScreen.js`, `src/tui/app.js`, `src/tui/widget-registry.js` |
| FR7-9: 3-line preview | `src/tui/components/ThreeLinePreview.js`, `src/tui/preview-utils.js` |
| FR10-14: Presets | `src/tui/screens/PresetScreen.js`, `src/tui/components/ConfirmDialog.js` |
| FR15-19: Navigation | `src/tui/app.js`, `src/tui/screens/HomeScreen.js`, `src/tui/components/Breadcrumb.js`, `src/tui/components/ShortcutBar.js` |
| FR20-22: ccstatusline integration | `src/tui/config-writer.js`, `src/defaults.js` |
| FR23: Reader line N | `src/reader/bmad-sl-reader.js` |
| FR24: Story name formatting | `src/reader/bmad-sl-reader.js` |
| FR25: Workflow colors | `src/reader/bmad-sl-reader.js`, `src/defaults.js` |
| FR26: Remove legacy composites | `src/reader/bmad-sl-reader.js`, `src/tui/widget-registry.js` |
| FR27: BF1 hidden widgets | `src/tui/screens/EditLineScreen.js`, `src/tui/widget-registry.js` |
| FR28: BF2 reset loop | `src/tui/app.js` |
| FR29: BF3 preview colors | `src/tui/components/ThreeLinePreview.js` |
| FR30-31: Installer per-line | `src/install.js`, `src/uninstall.js`, `src/defaults.js` |

### Uninstall Operations (Updated)

| Component | Detection | Action |
|-----------|-----------|--------|
| `~/.claude/settings.json` statusLine | Key present | **Do not touch** |
| `~/.claude/settings.json` hooks (Rev.2) | `bmad-hook.js` in any event type | Remove matching entries |
| `~/.claude/settings.json` hooks (Phase 2 legacy) | PostToolUse Skill matcher | **Backward compat** — remove |
| `~/.config/bmad-statusline/config.json` | File exists | **Delete** (NEW) |
| `~/.config/bmad-statusline/` | Directory exists | Delete entirely (reader + hook + config) |
| `~/.cache/bmad-status/` | Directory exists | Delete entirely |
| `~/.config/ccstatusline/settings.json` | `id` matching `bmad-line-*` | Remove bmad-line-N widgets (NEW) |
| `~/.config/ccstatusline/settings.json` | `id` matching `bmad-*` (individual) | **Backward compat** — remove old widgets |
| `.claude/CLAUDE.md` block | Markers present | **Backward compat (Phase 1)** |
| `.claude/settings.local.json` permissions | Rules matching `BMAD_PROJ_DIR` | **Backward compat (Phase 1)** |

## Architecture Validation Results

### Coherence Validation

**Decision Compatibility (Rev.3):** All technology choices remain compatible. CJS standalone for hook and reader. ESM for package and TUI. Internal config schema is the single coupling point between TUI (writer) and reader (consumer) — both use `BMAD_CONFIG_DIR` env var for path resolution. Dead code removal (buildWidgetConfig, composites) only affects functions replaced by the new internal config write path.

**Decision Compatibility (Rev.4):** All Rev.4 decisions are additive — no Rev.3 decisions modified or contradicted. Hook expansion adds new handlers without changing existing dispatch logic. Status file v2 is backward-compatible: existing scalar fields preserved and updated alongside new arrays. Monitor sub-boundary (`src/tui/monitor/`) is isolated from configurator TUI — no imports cross the boundary. Boundary 8 (TUI↔Cache) creates a new coupling but encapsulated in a single module (`monitor-utils.js`).

**Pattern Consistency:** All 28 implementation patterns (0-27) are non-contradictory. Patterns 21-27 (Monitor) complement patterns 0-20 (hook/reader/TUI v2). Pattern 22 (atomic write) enhances Pattern 8 (cache write) for larger files — same direction, not conflicting. Pattern 23 (cache I/O isolation) mirrors Pattern 20 (reader internal config reading) — same encapsulation philosophy. Pattern 24 (externalized scroll state) aligns with Pattern 15 (externalized config mutation) — parent-controlled state pattern.

**Structure Alignment:** 8 boundaries with no circular dependencies. Boundary 8 (TUI↔Cache read path) is new — couples TUI to cache but through a single module. File structure maps cleanly: `src/tui/monitor/` → Boundary 7 sub-domain + Boundary 8 (via monitor-utils.js). All other boundary mappings preserved from Rev.3.

### Requirements Coverage

**Rev.3 (31 FR + 12 NFR):**

- **FR1-6** (widget config per line): EditLineScreen + internal config schema + widget-registry INDIVIDUAL_WIDGETS
- **FR7-9** (3-line preview): ThreeLinePreview + preview-utils + previewOverride pattern
- **FR10-14** (presets): PresetScreen + config schema presets array + ConfirmDialog
- **FR15-19** (navigation): NavStack + screen tree + Breadcrumb + ShortcutBar
- **FR20-22** (ccstatusline integration): bmad-line-N composites + reader line N + syncCcstatuslineIfNeeded
- **FR23-26** (reader): line N command, story formatting, workflow colors, legacy removal
- **FR27-29** (bug fixes): Eliminated by architecture (BF1/BF2/BF3)
- **FR30-31** (installer): per-line deployment, internal config creation

**Rev.4 (36 FR + 5 NFR):**

- **FR32-33** (monitor access/layout): HomeScreen + MonitorScreen + app.js routing
- **FR34-38** (tabs): SessionTabs + monitor-utils grouping logic
- **FR39-40** (LLM badge): LlmBadge + bmad-hook.js (handleStop/handleNotification)
- **FR41-48** (file sections): FileTreeSection + monitor-utils
- **FR49-51** (bash commands): BashSection + bmad-hook.js (handleBash)
- **FR52-54** (scroll): ScrollableViewport + MonitorScreen
- **FR55-60** (detail mode): FileTreeSection cursor + MonitorDetailScreen
- **FR61-62** (chronology): MonitorDetailScreen + monitor-utils
- **FR63-66** (export): ExportPrompt + monitor-utils CSV generation
- **FR67** (shortcut bar): MonitorScreen shortcut arrays per mode
- **FR68-71** (toggles): MonitorScreen state toggles
- **FR72-79** (hooks/polling): bmad-hook.js + defaults.js + install.js + monitor-utils

**NFR coverage (Rev.3+4):** Performance (sync I/O, <50ms reader, <20ms polling), Reliability (fallback to defaults, silent failure, 10MB guard), Compatibility (cross-platform, Node 20, ccstatusline 2.2), Maintainability (zero runtime deps, scoped TUI deps, isolated monitor sub-boundary), Integrity (atomic writes for status file).

### Implementation Readiness

**Decision Completeness:** 20 architectural decisions total (10 Rev.3 + 10 Rev.4) documented with rationale, code snippets, and schema definitions. Status file v2 schema fully specified with field types and rules. Hook dispatch extended with new handler signatures. Polling architecture with lifecycle management. Viewport scroll as reusable stateless component. Tab system with 3 navigation modes. LLM state machine with 4 states and transition rules.

**Structure Completeness:** Full directory tree with 9 new files, 5 modified files, 3 new test files. 8 boundaries defined (Boundary 8 new). 5 data flows documented (install, TUI, reader, hook, monitor). FR-to-file mapping for all 67 requirements.

**Pattern Completeness:** 28 patterns with code examples. Enforcement guidelines for all patterns (hook/reader/installer preserved, TUI v2 preserved, Monitor new). Test organization documented with new fixture files.

### Gap Analysis

**Critical Gaps: None.** All blocking decisions are made.

**Important Gaps (non-blocking):**
1. **Notification payload structure for permission detection** — Exact payload format from Claude Code not fully documented. Implementation must inspect real payloads to identify permission-type notifications. Fallback: if type cannot be determined, no state transition (stays ACTIVE).
2. **`is_new` detection for written files** — Heuristic based on file not appearing in `reads[]` before first Write. May produce false positives if existing file is overwritten without prior read. Acceptable for a visual indicator (`*`).
3. **SelectWithPreview disposition** (Rev.3) — Kept and used in SeparatorStyleScreen. Resolved.

**Phase 2 (explicitly deferred):**
- File deletion/rename/move detection via Bash command parsing (~60-70% coverage, too fragile for MVP)
- Sections "Fichiers supprimés", "Fichiers renommés", "Fichiers déplacés"

**Nice-to-Have:**
1. Bash command family classification regex patterns — can be refined during implementation.
2. Auto-scroll behavior specifics when new data arrives — implementation decision.

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Evolution context analyzed (Rev.2 → Rev.3 → Rev.4)
- [x] Scale and complexity assessed (Medium-High with Monitor)
- [x] Technical constraints updated (3 new hook events, Ink scroll, sub-agent tracking)
- [x] Cross-cutting concerns mapped (7 Rev.3 + 5 Rev.4 = 12 total)

**Architectural Decisions**
- [x] 10 TUI v2 decisions documented with rationale and code (Rev.3)
- [x] 10 Monitor decisions documented with rationale and code (Rev.4)
- [x] Rev.2 hook/reader/installer decisions preserved with key contracts
- [x] Status file v2 schema fully specified (backward compatible)
- [x] Hook expansion dispatch + handlers documented
- [x] Polling architecture with lifecycle management
- [x] Viewport scroll as reusable component
- [x] Tab system with 2-level grouping
- [x] LLM state machine with 4 states

**Implementation Patterns**
- [x] 29 patterns (0-28): 14 Rev.2, 7 Rev.3, 7 Rev.4, 1 Rev.5
- [x] Error handling triad extended for TUI
- [x] Enforcement guidelines updated for all 3 revisions
- [x] Test organization documented with new fixtures

**Project Structure**
- [x] Complete directory structure with change delta (9 new + 5 modified + 3 new tests)
- [x] 8 boundaries defined (Boundary 8 new)
- [x] 5 data flows documented (monitor flow new)
- [x] FR-to-structure mapping complete for all 67 FRs
- [x] Uninstall covers all generations + new config

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Key Strengths:**
- Clean separation: Monitor isolated in sub-boundary, cache I/O encapsulated in single module
- Backward compatible: reader works unchanged with status file v2, existing TUI screens unaffected
- All Rev.3 bug fixes preserved (BF1/BF2/BF3 eliminated by architecture)
- 29 prescriptive patterns prevent agent implementation conflicts
- Atomic writes protect status file integrity at scale
- Paradigm evolution (configurator → configurator + live dashboard) cleanly separated by boundary

**Areas for Future Enhancement:**
- File deletion/rename/move detection via Bash parsing — Phase 2
- Custom widget creation (user-defined reader commands) — post-MVP
- Import/export presets to file — post-MVP
- TUI theming — post-MVP
