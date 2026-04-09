---
project_name: 'bmad-statusline'
user_name: 'Fred'
date: '2026-04-09'
sections_completed: ['technology_stack', 'critical_rules_patterns_0_13', 'tui_v2_patterns_14_20', 'hook_architecture', 'status_file_contract', 'internal_config_schema', 'reader_multiline', 'architectural_boundaries', 'tui_state_model', 'bug_fix_architecture', 'testing_conventions', 'code_conventions', 'installer_deployment', 'llm_state_model', 'shared_constants', 'tui_lifecycle', 'history_arrays']
status: 'complete'
completedAt: '2026-04-09'
existing_patterns_found: 28
rule_count: 85
optimized_for_llm: true
source_documents:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
  - '_bmad-output/planning-artifacts/architecture.md (Rev.5)'
  - '_bmad-output/planning-artifacts/epics.md'
epic_status: 'Epics 1-9 delivered'
---

# Project Context for AI Agents

_Critical rules and patterns that AI agents must follow when implementing code in bmad-statusline. Architecture is hook-based (passive extraction via Claude Code hooks). This document reflects the current implemented state from Architecture Rev.5, PRD v2, and UX Design Spec v2._

---

## Technology Stack & Versions

- **Runtime:** Node.js >= 20
- **Language:** JavaScript (no TypeScript)
- **Package module system:** ESM (`"type": "module"` in package.json, `import`/`export`)
- **Reader module system:** Standalone CommonJS (`require`) — deployed artifact, never imported by package code. CJS marker: `src/reader/package.json`
- **Hook module system:** Standalone CommonJS (`require`) — deployed artifact, same pattern as reader. CJS marker: `src/hook/package.json`
- **Shared constants:** `src/reader/shared-constants.cjs` — single source of truth for constants/utilities shared between CJS (reader, hook) and ESM (via `createRequire` bridge in `src/defaults.js`)
- **Workflow colors:** `src/reader/workflow-colors.cjs` — workflow color maps, CJS, imported by reader and bridged to ESM via defaults.js
- **Runtime dependencies:** Zero (Node.js stdlib only — reader, hook, installer)
- **TUI dependencies:** `ink` (v6.8.0), `react` (v19.2.4), `@inkjs/ui` (v2.0.0) — scoped to `src/tui/` only
- **Testing:** `node:test` + `node:assert/strict` (built-in, zero dev deps), `ink-testing-library` (v4.0.0) for TUI component tests
- **Build:** No build step (plain JS, no transpilation)
- **npm scripts:** `"test": "node --test --test-concurrency=4 --test-timeout=30000 test/*.test.js"`
- **Compatibility:** ccstatusline >= 2.2 (custom-command widget support, preserveColors)
- **Platform:** Cross-platform — Windows (Git Bash), macOS, Linux

---

## Critical Implementation Rules [CURRENT]

_Patterns 0-13 from Architecture Rev.5 — preserved from Rev.2 (hook/reader/installer). These are load-bearing rules that apply to all Epics._

### Pattern 0 — Hook Entry Point Structure

The hook script follows this exact structure: Requires → Constants → Stdin parsing (try/catch → silent exit) → Guard (`_bmad/` check via walk-up) → Alive touch (PID detection) → Stale session cleanup (same-PID) → Project + output folders detection → Dispatch on `hook_event_name` (13 events) → Handlers → Story priority helper → Status file helpers → Main entry. **Rule:** Constants → helpers → handlers → main.

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

Dispatch on `hook_event_name` first. 13 event types: UserPromptSubmit, PreToolUse, PostToolUse (then dispatch on `tool_name`: Read, Write, Edit, Bash), Stop, StopFailure, PermissionRequest, PermissionDenied, PostToolUseFailure, SubagentStart, SubagentStop, SessionStart, SessionEnd. All stdin parsing wrapped in try/catch — any failure → silent exit (exit code 0).

### Pattern 8 — Hook Status File I/O (Cache Pattern)

```
read existing (or create defaults) → merge new fields → stringify(null, 2) + '\n' → write to .tmp → rename to final path
```

**Atomic write pattern:** `writeFileSync(fp + '.tmp', ...)` then `renameSync(tmp, fp)`. Crash-safe — partial writes never corrupt the status file. No backup, no validation post-write. Read-before-write mandatory. Create cache dir if absent. `updated_at` set on every write. Session ID validation via `isSafeId()` (regex: `/^[a-zA-Z0-9_-]+$/`).

### Pattern 9 — Hook Path Matching

All patterns on normalized paths (forward slashes). Always validate step/story path belongs to active **skill** before updating status.

```js
function normalize(p) {
  let n = p.replace(/\\/g, '/').replace(/\/+$/, '');
  if (/^[A-Z]:\//.test(n)) n = n[0].toLowerCase() + n.slice(1);
  return n;
}
```

### Pattern 10 — Skill Name Normalization

```js
const SKILL_REGEX = /^\s*\/?((?:bmad|gds|wds)-[\w-]+)/;
const workflowName = skillName.slice(skillName.indexOf('-') + 1);
```

`skillName` for path construction. `workflowName` for display + color lookup. Dynamic slicer — never hardcode `slice(5)`.

### Pattern 11 — cwd Scoping

```js
const inProject = normPath.toLowerCase().startsWith(normCwd.toLowerCase() + '/');
```

First check in Read/Write/Edit handlers, before any pattern matching. Case-insensitive on Windows.

### Pattern 12 — Story Priority Resolution

```js
function shouldUpdateStory(incomingPriority, currentPriority) {
  if (incomingPriority === STORY_PRIORITY.SPRINT_STATUS) return true;
  if (incomingPriority === STORY_PRIORITY.STORY_FILE && (!currentPriority || currentPriority === STORY_PRIORITY.CANDIDATE)) return true;
  if (incomingPriority === STORY_PRIORITY.CANDIDATE && !currentPriority) return true;
  return false;
}
```

Never set story directly without priority check. Workflow gating via `STORY_WORKFLOWS`.

### Pattern 13 — Step Multi-Track Detection

```js
const STEP_REGEX = /\/steps(-[a-z])?\/step-(?:[a-z]-)?(\d+)[a-z]?-(.+)\.md$/;
```

Total per track directory. Recalculate if track changes.

---

## TUI v2 Implementation Patterns [CURRENT]

_Patterns 14-20 from Architecture Rev.5 — implemented in Epics 6-8. These govern all TUI v2 code._

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
// CORRECT — structuredClone + setConfig with debounced write
const writeTimerRef = React.useRef(null);
function updateConfig(mutator) {
  setConfig(prev => {
    const next = structuredClone(prev);
    mutator(next);
    syncCcstatuslineIfNeeded(prev, next, paths);
    if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    writeTimerRef.current = setTimeout(() => writeInternalConfig(next, paths), 300);
    return next;
  });
}

// WRONG — direct mutation
config.lines[0].widgets.push(widgetId);
setConfig(config); // React won't detect the change — same reference
```

**Rules:**
- `structuredClone` for deep copy — never spread operator (shallow copy misses nested objects).
- Disk write debounced 300ms inside `setConfig` callback — never in a `useEffect`.
- `syncCcstatuslineIfNeeded` runs synchronously before the debounced write.
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

Every screen component receives a standard props interface. HomeScreen has additional props:

```js
// Standard screen props
{
  config,              // current persisted config
  updateConfig,        // (mutator) => void — pattern 15
  previewOverride,     // config | null — pattern 17
  setPreviewOverride,  // (config | null) => void
  navigate,            // (screenName, context?) => void
  goBack,              // () => void
  editingLine,         // 0|1|2|null
  selectedWidget,      // widget ID | null
  isActive,            // boolean — controls useInput hook activation
}

// HomeScreen-specific additional props
{
  resetToOriginal,     // () => void — Pattern 15 reset
  onQuit,              // () => void — exit without save
  onLaunchCcstatusline, // () => void — spawn ccstatusline TUI
}
```

**Rules:**
- Screens never call `setConfig` directly — always through `updateConfig`.
- Screens never read ccstatusline config — only internal config via `config` prop.
- Screens never write to disk — `updateConfig` handles persistence.
- All screens receive `isActive` — must pass to `useInput({ isActive })` to prevent ghost input when screen is not focused.

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
    return {
      widgets: config.lines[lineIndex].widgets || [],
      colorModes: config.lines[lineIndex].colorModes || {},
      separator: config.separator || 'serre',
      customSeparator: config.customSeparator ?? null,
      skillColors: config.skillColors || {},
      projectColors: config.projectColors || {},
    };
  } catch { return null; }
}
```

**Rules:**
- Reader NEVER writes to config.json — read-only consumer.
- Reader separator map is sourced from `shared-constants.cjs` (SEPARATOR_VALUES).
- Reader ALWAYS returns empty string on any error.
- `skillColors` used for per-workflow custom color overrides.
- `projectColors` used for per-project custom color overrides.

---

## Hook Architecture [CURRENT]

The hook is the **central component** — sole writer of status data.

### Signal Architecture (13 event types)

| Signal | Event | Purpose | Key Fields | LLM State Set |
|--------|-------|---------|------------|---------------|
| **UserPromptSubmit** | `hook_event_name: "UserPromptSubmit"` | Sets active workflow, resets on skill change | `prompt` | `active` |
| **PreToolUse** | `hook_event_name: "PreToolUse"` | Clears permission state when tool starts | — | `active` |
| **PostToolUse Read** | `tool_name: "Read"` | File tracking, step/story/active-skill detection | `tool_input.file_path` | `active` |
| **PostToolUse Write** | `tool_name: "Write"` | File tracking, story confirmation, document name | `tool_input.file_path`, `tool_input.content` | `active` |
| **PostToolUse Edit** | `tool_name: "Edit"` | File tracking, story confirmation, document name | `tool_input.file_path`, `tool_input.old_string`, `tool_input.new_string` | `active` |
| **PostToolUse Bash** | `tool_name: "Bash"` | Command history tracking | `tool_input.command` | `active` |
| **Stop** | `hook_event_name: "Stop"` | LLM finished — waiting for user | — | `waiting` |
| **StopFailure** | `hook_event_name: "StopFailure"` | LLM errored | `error_type` | `error` |
| **PermissionRequest** | `hook_event_name: "PermissionRequest"` | Tool needs user approval | — | `permission` |
| **PermissionDenied** | `hook_event_name: "PermissionDenied"` | User denied permission | — | `active` |
| **PostToolUseFailure** | `hook_event_name: "PostToolUseFailure"` | Tool failed or user interrupted | `is_interrupt` | `interrupted` if interrupt, else `active` |
| **SubagentStart** | `hook_event_name: "SubagentStart"` | Subagent spawned | `agent_type` | `active` + sets `subagent_type` |
| **SubagentStop** | `hook_event_name: "SubagentStop"` | Subagent completed | — | `active` + clears `subagent_type` |
| **SessionStart** | `hook_event_name: "SessionStart"` | Session alive touch (resume only) | — | no-op (alive already touched) |
| **SessionEnd** | `hook_event_name: "SessionEnd"` | Delete alive file, preserve status for resume | — | no write — only deletes `.alive-{id}` |

### Hook Config (13 event types, deployed via installer)

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "matcher": "(?:bmad|gds|wds)[:-]", "hooks": [{ "type": "command", "command": "node <hookPath>" }] }
    ],
    "PreToolUse": [
      { "matcher": "", "hooks": [{ "type": "command", "command": "node <hookPath>" }] }
    ],
    "PostToolUse": [
      { "matcher": "Read", "hooks": [...] },
      { "matcher": "Write", "hooks": [...] },
      { "matcher": "Edit", "hooks": [...] },
      { "matcher": "Bash", "hooks": [...] }
    ],
    "PermissionRequest": [{ "matcher": "", "hooks": [...] }],
    "PermissionDenied": [{ "matcher": "", "hooks": [...] }],
    "PostToolUseFailure": [{ "matcher": "", "hooks": [...] }],
    "Stop": [{ "matcher": "", "hooks": [...] }],
    "StopFailure": [{ "matcher": "", "hooks": [...] }],
    "SubagentStart": [{ "matcher": "", "hooks": [...] }],
    "SubagentStop": [{ "matcher": "", "hooks": [...] }],
    "SessionStart": [{ "matcher": "resume", "hooks": [...] }],
    "SessionEnd": [{ "matcher": "", "hooks": [...] }]
  }
}
```

**Key rule:** UserPromptSubmit has skill-matching matcher `(?:bmad|gds|wds)[:-]`. All other events use empty matcher (fire always). SessionStart uses `"resume"` matcher only.

### Discrimination Logic (Complete Truth Table)

| Event | Condition | Action |
|-------|-----------|--------|
| **UserPromptSubmit** | Prompt matches `SKILL_REGEX` or `LEGACY_COMMAND_REGEX` AND skill changed | Reset step, story, reads/writes/commands, set new workflow, `llm_state=active` |
| **UserPromptSubmit** | Prompt matches, same skill | Set `llm_state=active`, preserve state |
| **UserPromptSubmit** | No match | Set `llm_state=active` only |
| **PreToolUse** | Always | Set `llm_state=active`, clear subagent_type, clear error_type |
| **Read** `steps*/step-*.md` | Path in `steps*/` of active skill | Update `step.current`, `step.current_name`, derive `next`; calculate total if first Read or track change |
| **Read** (any file) | Always | Append to `reads[]` history, update `last_read`, set `llm_state=active` |
| **Read** (skill path) | Path in `.claude/skills/{skill}/` and workflow differs | Set `active_skill` for Active Skill widget |
| **Read** `stories/*.md` | Workflow in `STORY_READ_WORKFLOWS` AND priority check passes | Set story (priority 2) |
| **Read** `sprint-status*.yaml` | Unique in-progress candidate AND no story set | Set story (priority 3) |
| **Write/Edit** (any file) | Always | Append to `writes[]` history (with `op`, `is_new`, `old_string`/`new_string` for Edit), update `last_write`+`last_write_op`, set `llm_state=active` |
| **Write/Edit** (output folder) | Path in `_outputFolders` AND non-story workflow | Set `document_name` from basename |
| **Write** `sprint-status*.yaml` | Workflow in `STORY_WORKFLOWS`, parse YAML | Set story (priority 1) |
| **Write** `stories/*.md` | Workflow in `STORY_WRITE_WORKFLOWS`, priority check | Set story (priority 2) |
| **Edit** `sprint-status*.yaml` | Workflow in `STORY_WORKFLOWS`, `new_string`/`old_string` contains story key | Set story (priority 1) |
| **Bash** | Always | Append to `commands[]` history (truncated at 1000 chars), set `llm_state=active` |
| **Stop** | Always | Set `llm_state=waiting` |
| **StopFailure** | Always | Set `llm_state=error`, store `error_type` |
| **PermissionRequest** | Always | Set `llm_state=permission` |
| **PermissionDenied** | Always | Set `llm_state=active` |
| **PostToolUseFailure** | `is_interrupt === true` | Set `llm_state=interrupted` |
| **PostToolUseFailure** | `is_interrupt !== true` | Set `llm_state=active` |
| **SubagentStart** | Always | Set `llm_state=active`, store `subagent_type` |
| **SubagentStop** | Always | Set `llm_state=active`, clear `subagent_type` |
| **SessionStart** | Always (matcher ensures resume only) | No-op — alive already touched on entry |
| **SessionEnd** | Always | Delete `.alive-{session_id}`, preserve status file for resume recovery |

All Read/Write/Edit gated by cwd scoping (pattern 11). History appends gated by `canAppendHistory()` (10MB max file size).

---

## Status File Schema [CURRENT] (Hook↔Reader↔Monitor Interface Contract)

The status file is the **only coupling** between the hook (writer), reader (consumer), and monitor (consumer). All must agree on this exact schema.

Location: `~/.cache/bmad-status/status-{session_id}.json`

```json
{
  "session_id": "<string>",
  "project": "<string>",
  "skill": "<full skill name — hook-internal>",
  "workflow": "<stripped name for display>",
  "active_skill": "<stripped name of detected active skill, or null>",
  "story": "<slug or null>",
  "story_priority": "<1|2|3|null — hook-internal>",
  "step": {
    "current": 3, "current_name": "starter",
    "next": 4, "next_name": "decisions",
    "total": 8, "track": "-c"
  },
  "last_read": "<project-relative path or full path>",
  "last_write": "<project-relative path or full path>",
  "last_write_op": "<'write'|'edit'|null>",
  "document_name": "<basename of file in output folder, or null>",
  "llm_state": "<'active'|'waiting'|'permission'|'error'|'interrupted'>",
  "llm_state_since": "<ISO 8601>",
  "subagent_type": "<string|null — e.g. 'unknown', agent_type from payload>",
  "error_type": "<string|null — from StopFailure payload>",
  "started_at": "<ISO 8601>",
  "updated_at": "<ISO 8601>",
  "reads": [
    { "path": "<display path>", "in_project": true, "at": "<ISO 8601>", "agent_id": "<string|null>" }
  ],
  "writes": [
    { "path": "<display path>", "in_project": true, "op": "<'write'|'edit'>", "is_new": false,
      "at": "<ISO 8601>", "agent_id": "<string|null>",
      "old_string": "<string|null — Edit only>", "new_string": "<string|null — Edit only>" }
  ],
  "commands": [
    { "cmd": "<truncated at 1000 chars>", "at": "<ISO 8601>", "agent_id": "<string|null>" }
  ],
  "_outputFolders": ["<normalized absolute paths — hook-internal>"]
}
```

**Type rules:**
- `step.current`, `step.next`, `step.total` are **numbers** (not strings)
- `story` is **null** when no story is active (not empty string, not absent)
- `workflow` is the stripped name (`create-architecture`, not `bmad-create-architecture`)
- `llm_state` defaults to `'waiting'` in `computeDisplayState()` when null/absent
- `subagent_type` and `error_type` are always normalized to `null` on read if absent (via `?? null`)
- `reads`, `writes`, `commands` are arrays, capped at 500 entries via `trimHistory()`
- `writes[].is_new` is best-effort — after history cap, `reads[]` may have been truncated
- `writes[].old_string`/`new_string` are null for Write ops, populated for Edit ops
- `_outputFolders` is hook-internal — derived from `_bmad/bmm/config.yaml` folder keys
- Reader-visible: `session_id`, `project`, `workflow`, `active_skill`, `story`, `step.*`, `last_read`, `last_write`, `last_write_op`, `document_name`, `llm_state`, `llm_state_since`, `subagent_type`, `started_at`, `updated_at`
- Monitor-visible: all fields including `reads`, `writes`, `commands`
- Hook-internal: `skill`, `story_priority`, `step.track`, `_outputFolders`

**Progress calculation:** Reader uses `step.current / step.total` — displayed as `Step 3/8 name`.

**History guard:** `canAppendHistory()` checks `status-{sid}.json` file size < 10MB before appending. Prevents runaway growth on very long sessions.

---

## Internal Config Schema [CURRENT] (TUI↔Reader Contract)

Location: `~/.config/bmad-statusline/config.json`
Written by: TUI (every interaction, debounced 300ms) and installer (default on first install)
Read by: Reader (for `line N` command) and TUI (on launch)

```json
{
  "separator": "modere",
  "customSeparator": null,
  "lines": [
    {
      "widgets": ["bmad-project", "bmad-workflow", "bmad-story", "bmad-progressstep", "bmad-timer"],
      "widgetOrder": ["bmad-project", "bmad-workflow", "bmad-story", "...all 11 widget IDs..."],
      "colorModes": {
        "bmad-project": { "mode": "dynamic" },
        "bmad-workflow": { "mode": "dynamic" },
        "bmad-story": { "mode": "fixed", "fixedColor": "magenta" },
        "bmad-progressstep": { "mode": "fixed", "fixedColor": "brightCyan" },
        "bmad-timer": { "mode": "fixed", "fixedColor": "brightBlack" }
      }
    },
    {
      "widgets": ["bmad-llmstate"],
      "widgetOrder": ["...all 11 widget IDs..."],
      "colorModes": { "bmad-llmstate": { "mode": "dynamic" } }
    },
    { "widgets": [], "widgetOrder": ["...all 11 widget IDs..."], "colorModes": {} }
  ],
  "skillColors": {},
  "projectColors": {},
  "presets": [null, null, null]
}
```

**Schema rules:**
- `separator` is global (top-level). Values: `"serre"`, `"modere"`, `"large"`, `"custom"`. Default: `"modere"`.
- `customSeparator` is a string, only used when `separator === "custom"`. Null otherwise.
- `lines` is always length 3. Each line has `widgets`, `widgetOrder`, and `colorModes`.
- `widgets` array contains only **visible** widgets in **display order**. A widget not in any line's `widgets` is hidden everywhere.
- `widgetOrder` array contains **all 11 widget IDs** — controls the order widgets appear in the Edit Line screen (including hidden ones). Managed by `ensureWidgetOrder()` on load: prunes stale IDs, appends new widgets.
- `colorModes` contains entries for all widgets configured on this line (including hidden ones — preserves color across hide/show cycles).
- `colorModes[id].mode` is `"dynamic"` (valid for `bmad-workflow`, `bmad-project`, `bmad-activeskill`, `bmad-llmstate`) or `"fixed"`. When `"fixed"`, `fixedColor` is an ANSI color name.
- `skillColors` is a top-level object — maps workflow name (e.g. `"dev-story"`) to ANSI color name. Overrides hardcoded `WORKFLOW_COLORS`.
- `projectColors` is a top-level object — maps project name to ANSI color name. Overrides `hashProjectColor()` deterministic default.
- `presets` is always length 3. Each slot is null (empty) or a preset object `{ name, widgets, colorModes }`.

**11 widgets (widget registry):**

| Widget ID | Command | Name | Default Enabled | Default Color | Default Mode |
|-----------|---------|------|----------------|---------------|-------------|
| `bmad-llmstate` | `llmstate` | LLM State | true (line 1) | — | dynamic |
| `bmad-project` | `project` | Project | true | — | dynamic |
| `bmad-workflow` | `workflow` | Initial Skill | true | — | dynamic |
| `bmad-activeskill` | `activeskill` | Active Skill | false | — | dynamic |
| `bmad-story` | `story` | Story | true | magenta | fixed |
| `bmad-docname` | `docname` | Document | false | brightYellow | fixed |
| `bmad-progressstep` | `progressstep` | Step | true | brightCyan | fixed |
| `bmad-nextstep` | `nextstep` | Next Step | false | yellow | fixed |
| `bmad-fileread` | `fileread` | File Read | false | cyan | fixed |
| `bmad-filewrite` | `filewrite` | File Edit/Write | false | brightRed | fixed |
| `bmad-timer` | `timer` | Timer | true | brightBlack | fixed |

Default layout: Line 0 = [project, workflow, story, progressstep, timer]. Line 1 = [llmstate]. Line 2 = empty.

---

## LLM State 5-State Model [CURRENT]

The hook tracks LLM state transitions via `llm_state` field in status files. The reader renders this as a colored badge.

### State Definitions

| State | Trigger Event | Badge Color | Meaning |
|-------|--------------|-------------|---------|
| `active` | UserPromptSubmit, PreToolUse, PostToolUse (Read/Write/Edit/Bash), PermissionDenied, SubagentStart/Stop, PostToolUseFailure (non-interrupt) | Green text | LLM is working |
| `waiting` | Stop | Blue bg, white text | LLM finished, waiting for user input |
| `permission` | PermissionRequest | Yellow bg, black text | Tool needs user approval |
| `error` | StopFailure | Red bg, white text | LLM encountered an error |
| `interrupted` | PostToolUseFailure (`is_interrupt === true`) | Orange bg, black text | User interrupted via Escape |

### State Resolution

```js
// shared-constants.cjs — single source of truth
function computeDisplayState(status) {
  return status.llm_state || 'waiting';
}

const LLM_STATE_PRIORITY = {
  active: 0,
  waiting: 1,
  interrupted: 1,
  error: 2,
  permission: 2,
};
```

**Rules:**
- Default state is `'waiting'` when `llm_state` is null/absent (new session).
- `llm_state_since` is always set alongside `llm_state` — used by timer widget.
- `error_type` is only set by StopFailure, cleared by all other events.
- `subagent_type` is only set by SubagentStart, cleared by all other events.
- PreToolUse → `active` is critical: it clears `permission` state when a tool starts executing after user approval.
- PermissionDenied → `active` (not `permission`): user denied = LLM resumes with different approach.
- PostToolUseFailure with `is_interrupt` → `interrupted`: distinguishes user Escape from tool failure.
- `LLM_STATE_PRIORITY` used by TUI monitor for color sorting — higher priority = more attention-worthy.

### Reader Badge Rendering

```js
const LLM_STATES = {
  permission:  { bg: '\x1b[103m', fg: '\x1b[30m', label: 'PERMISSION' },
  waiting:     { bg: '\x1b[104m', fg: '\x1b[97m', label: 'WAITING' },
  error:       { bg: '\x1b[101m', fg: '\x1b[97m', label: 'ERROR' },
  interrupted: { bg: '\x1b[43m',  fg: '\x1b[30m', label: 'INTERRUPTED' },
  active:      { color: '\x1b[32m', label: 'ACTIVE' },
};
```

**Rule:** `active` uses foreground color only (green text). All other states use background+foreground (block badge). This visual distinction is intentional — `active` is the normal state and should not draw attention.

---

## Shared Constants Pattern [CURRENT]

`src/reader/shared-constants.cjs` is the single source of truth for constants and utilities shared between CJS runtime modules (reader, hook) and ESM modules.

### Exports

| Export | Type | Used by |
|--------|------|---------|
| `ALIVE_MAX_AGE_MS` | `7 * 24 * 60 * 60 * 1000` (7 days) | Reader (purge stale), TUI (cleanup) |
| `STORY_WORKFLOWS` | `['create-story', 'dev-story', 'code-review']` | Hook (story gating) — **also declared locally in hook** |
| `PROJECT_COLOR_PALETTE` | 12 ANSI color names | Reader + TUI (project hash colors) |
| `SEPARATOR_VALUES` | `{ serre, modere, large }` | Reader + TUI (separator rendering) |
| `LLM_STATE_PRIORITY` | `{ active: 0, waiting: 1, ... }` | TUI monitor (badge sorting) |
| `isValidSessionId(id)` | Regex validator | Reader (safety check) |
| `hashProjectColor(name)` | Deterministic hash → color | Reader + TUI (default project colors) |
| `computeDisplayState(status)` | `status.llm_state \|\| 'waiting'` | Reader (LLM badge) |
| `formatTimer(startedAt)` | Duration formatter | Reader (timer widget) |
| `formatStoryName(slug, displayMode)` | Story slug → display name | Reader (story widget) |

### ESM Bridge

```js
// defaults.js — ESM bridge via createRequire
import { createRequire } from 'node:module';
const _require = createRequire(import.meta.url);
const _sc = _require('./reader/shared-constants.cjs');
export const ALIVE_MAX_AGE_MS = _sc.ALIVE_MAX_AGE_MS;
// ... all other exports re-exported
```

**Rules:**
- Hook declares its own `STORY_WORKFLOWS` locally (cannot require shared-constants at deploy time — standalone CJS).
- Reader imports directly via `require('./shared-constants.cjs')`.
- ESM modules (TUI, installer, defaults) access via the `defaults.js` bridge.
- **Never duplicate** constants that exist in shared-constants — always import from the source.
- `formatStoryName(slug, 'compact')` returns just the number prefix (e.g. `"5-3"`). Default mode returns full `"5-3 Auth Login"`.

---

## TUI Process Lifecycle [CURRENT] (Pattern 28)

`src/tui/tui-lifecycle.js` — PID registry, signal handlers, and TTY orphan detection to prevent zombie TUI processes.

### PID Registry

Location: `~/.cache/bmad-status/tui-pids.json`

```json
{ "pids": [12345, 67890] }
```

**Lifecycle:**
1. `registerPid(cachePath)` — On TUI launch: load registry, prune dead PIDs (via `process.kill(pid, 0)`), append `process.pid`, save.
2. `unregisterPid(cachePath)` — On TUI exit: load registry, filter out `process.pid`, save.
3. Registry writes use atomic pattern: `.tmp` + `renameSync`.

### Signal Handlers

`setupSignalHandlers(cachePath, restoreScreen)` installs handlers for:
- `SIGINT`, `SIGTERM`, `SIGHUP` — graceful shutdown: unregister PID, restore screen, exit
- `uncaughtException`, `unhandledRejection` — emergency cleanup: unregister PID, restore screen, exit(1)

**Rule:** `restoreScreen()` is wrapped in try/catch — screen restore is best-effort, PID cleanup is critical.

### TTY Orphan Detection

`startTtyWatch(cachePath, restoreScreen)` — polls `process.stdout.isTTY` every 5 seconds. If TTY is lost (parent terminal closed), triggers graceful shutdown. Timer is `.unref()`'d to not prevent Node exit.

`stopTtyWatch()` — clears the interval. Called before intentional exit.

**Rules:**
- PID registry is non-critical — all operations are wrapped in try/catch with silent failure.
- App.js calls `registerPid` at component mount (via `useState` initializer side-effect).
- App.js calls `unregisterPid` + `stopTtyWatch` in quit handler before `exit()`.
- The `restoreScreen` callback typically calls Ink's `unmount()` to restore terminal state.

---

## History Arrays & Guards [CURRENT]

The hook tracks three history arrays in the status file for the Monitor feature.

### Arrays

| Array | Appended by | Entry shape | Purpose |
|-------|------------|-------------|---------|
| `reads[]` | handleRead | `{ path, in_project, at, agent_id }` | File read history for Monitor file tree |
| `writes[]` | handleWrite, handleEdit | `{ path, in_project, op, is_new, at, agent_id, old_string, new_string }` | File write/edit history for Monitor file tree |
| `commands[]` | handleBash | `{ cmd, at, agent_id }` | Bash command history for Monitor bash section |

### Guards

```js
const MAX_HISTORY = 500;
function trimHistory(arr) {
  if (arr.length > MAX_HISTORY) arr.splice(0, arr.length - MAX_HISTORY);
}

function canAppendHistory(sid) {
  try {
    const fp = path.join(CACHE_DIR, 'status-' + sid + '.json');
    return fs.statSync(fp).size < 10 * 1024 * 1024; // 10MB
  } catch (e) { return true; }
}
```

**Rules:**
- `trimHistory()` trims from the **front** (oldest entries removed first) — FIFO.
- `canAppendHistory()` is a hard cap — stops all history appends when status file exceeds 10MB.
- `agent_id` is `payload.agent_id || null` — tracks which subagent performed the operation.
- `writes[].is_new` is best-effort: checks if `displayPath` exists in `reads[]`, but reads may have been trimmed.
- `writes[].old_string`/`new_string` are null for Write ops, populated for Edit ops (for Monitor diff view).
- `commands[].cmd` is truncated to 1000 chars to prevent bloat from large heredocs.
- History arrays are initialized as `[]` on first access: `if (!Array.isArray(status.reads)) status.reads = [];`
- On skill change (UserPromptSubmit with different skill), all three arrays are **reset to `[]`**.

---

## Reader Multi-Line Architecture [CURRENT]

### `line N` Command

**Invocation:** `node bmad-sl-reader.js line 0` (argv[2] = `"line"`, argv[3] = `"0"|"1"|"2"`)

**Execution sequence:**
1. Ensure cache dir exists
2. Parse stdin for `session_id`
3. `touchAlive(sessionId)` — PID detection + same-PID stale session cleanup (piggybacking)
4. `purgeStale()` — remove `.alive-*` files older than 7 days (piggybacking)
5. Read status file
6. Read internal config `config.json` (pattern 20)
7. Extract line config: `internalConfig.lines[lineIndex]`
8. If line has no widgets or config missing → return empty string
9. Resolve separator from config
10. For each widget ID in `line.widgets`: call extractor, apply color from `colorModes`
11. Join non-empty segments with separator
12. Output to stdout

**Color application in `line N`:**
- `mode: "dynamic"` AND widget is `bmad-llmstate` → leave as-is (LLM badge has its own bg/fg coloring)
- `mode: "dynamic"` AND widget is `bmad-workflow`/`bmad-project`/`bmad-activeskill` → extractor applies color internally via `getWorkflowColor()`/`getProjectColor()`
- `mode: "fixed"` → `colorize(stripAnsi(value), fixedColor)` — strip any existing ANSI first
- Special case: `bmad-fileread`/`bmad-filewrite` with fixed color → icon in white, path in fixedColor (split at first space)

**Workflow color resolution:**
1. Strip `bmad-` prefix for lookup
2. Check `skillColors` (custom overrides from internal config) → return if found
3. Check `WORKFLOW_COLORS` hardcoded map → return if found
4. Check `WORKFLOW_PREFIX_COLORS` prefix matches → return if found
5. Return null (no color)

**Project color resolution:**
1. Check `projectColors` (custom overrides from internal config) → return if found
2. `hashProjectColor(name)` → deterministic hash from `PROJECT_COLOR_PALETTE` (12 colors)

**Reader piggybacking cleanup:**
- `touchAlive()` — on first call per session: detect Claude ancestor PID via `wmic` (Windows), write to alive file. Same-PID cleanup: delete alive files from old sessions of the same Claude process.
- `purgeStale()` — delete `.alive-*` files older than `ALIVE_MAX_AGE_MS` (7 days). Status files preserved — orphan cleanup handles those separately.

**Removed commands:** `compact`, `full`, `minimal`, `agent`, `request`, `document` — all return empty string. Unknown commands fall through to empty output.

---

## Architectural Boundaries [CURRENT]

### Boundary 1: Hook (runtime, standalone) — THE WRITER

- `src/hook/bmad-hook.js` — deployed to `~/.config/bmad-statusline/`
- CommonJS, zero dependencies, self-contained
- 13 event handlers, LLM state management, history tracking
- The **sole** writer of status data and `.alive` files
- Declares its own `STORY_WORKFLOWS` (cannot import shared-constants at deploy time)

### Boundary 2: Reader (runtime, standalone) — THE CONSUMER

- `src/reader/bmad-sl-reader.js` — deployed to `~/.config/bmad-statusline/`
- CommonJS, zero dependencies except local CJS modules
- Imports from `shared-constants.cjs` and `workflow-colors.cjs` (deployed alongside)
- `line N` command reads internal config for widget layout + color modes
- Piggybacking cleanup: alive touch + stale purge on every invocation

### Boundary 3: Shared Constants (runtime, CJS) — THE BRIDGE

- `src/reader/shared-constants.cjs` — deployed alongside reader
- Single source of truth for constants shared between CJS and ESM
- CJS modules import directly; ESM modules access via `createRequire` bridge in `defaults.js`

### Boundary 4: Internal Config (runtime, shared file) — THE CONTRACT

- `~/.config/bmad-statusline/config.json`
- **Written by:** TUI (debounced 300ms) and installer (default on first install)
- **Read by:** Reader (for `line N` output) and TUI (on launch)
- This file is the coupling point between TUI and reader — both must agree on schema

### Boundary 5: CLI Entry Point (dispatch only)

- `bin/cli.js` — routes: `install`, `uninstall`, `clean`, `--help`, `monitor`, no-arg→TUI
- No business logic.

### Boundary 6: Command Modules (install-time)

- `src/install.js`, `src/uninstall.js`, `src/clean.js`
- Each receives `paths` parameter (injected, testable)
- Install creates internal config + deploys bmad-line-0/1/2 + deploys shared-constants.cjs + workflow-colors.cjs
- Uninstall removes bmad-line-N + deletes internal config
- Clean removes cache dir

### Boundary 7: Defaults (shared data, install-time + runtime)

- `src/defaults.js` — config templates + ESM bridge for shared constants
- `getWidgetDefinitions()` returns `bmad-line-0/1/2` format
- `getHookConfig()` returns 13-event hook configuration
- Re-exports all shared-constants via `createRequire` bridge

### Boundary 8: TUI (configurator + monitor, ESM)

- `src/tui/` — React/Ink components, ESM
- Configurator: multi-line state model, screens, components
- Monitor: `src/tui/monitor/` — real-time session dashboard, cache read-only
- Writes to internal config (Boundary 4) and ccstatusline config
- Monitor reads status files directly (Boundary 1 output) — read-only consumer

### Boundary 9: TUI Lifecycle (process management)

- `src/tui/tui-lifecycle.js` — PID registry, signal handlers, TTY detection
- Registry file: `~/.cache/bmad-status/tui-pids.json`
- Non-critical — all operations best-effort with silent failure

---

## TUI Multi-Line State Model [CURRENT]

### State Separation

```js
// === Config state (persisted to config.json) ===
const [config, setConfig] = useState(() => loadConfig(paths));
// Shape: { separator, customSeparator, lines: [{widgets, widgetOrder, colorModes}x3], skillColors, projectColors, presets: [x3] }

// === Snapshot for Reset (captured once at mount, never updated) ===
const [snapshot] = useState(() => structuredClone(config));

// === Preview override for try-before-you-buy (transient) ===
const [previewOverride, setPreviewOverride] = useState(null);

// === Navigation (React-only) ===
const [screen, setScreen] = useState('home');
const [navStack, setNavStack] = useState([]);
const [editingLine, setEditingLine] = useState(null);     // 0|1|2
const [selectedWidget, setSelectedWidget] = useState(null); // widget ID
const [statusMessage, setStatusMessage] = useState(null);
```

### Navigation Model

**Screen tree (max depth 2):**

```
home
├── monitor                        (full-screen, own navigation)
├── editLine(lineIndex: 0|1|2)
│   ├── colorPicker(widgetId)
│   ├── presetSave
│   └── presetLoad
├── reorderLines
├── separator
├── skillColors
├── projectColors
└── ccstatusline                   (spawns external process)
```

`resetToOriginal` is an action from Home, not a screen.

### Reset to Original

```js
function resetToOriginal() {
  const restored = structuredClone(snapshot);
  setConfig(restored);
  writeInternalConfig(restored, paths);
  syncCcstatuslineFromScratch(restored, paths);
  setPreviewOverride(null);
}
```

Atomic replacement. `snapshot` is immutable. No render loop possible.

---

## Bug Fix Architecture [ELIMINATED BY DESIGN]

Three bugs from TUI v1 are eliminated by architectural decisions in v2. Documented here to prevent regression.

| Bug | Root Cause (v1) | Elimination (v2) |
|-----|----------------|-------------------|
| **BF1:** Hidden widgets can't be shown | `widgetOrder` derived from ccstatusline — hidden widgets absent | Edit Line renders all 11 widgets from `INDIVIDUAL_WIDGETS`. Visibility = presence in `config.lines[N].widgets`. |
| **BF2:** Reset causes infinite render loop | `setTuiState(snapshot)` triggers re-render → effect → write → re-render | No `useEffect` that reads+writes config. Write inside `setConfig` callback. `snapshot` via `useState` — never changes. |
| **BF3:** Preview shows no colors | Color values not mapped to Ink `<Text>` props | `resolvePreviewColor()` (pattern 19) + `<Text color={resolved}>`. Centralized in `preview-utils.js`. |

**Anti-regression rules:**
- Never add a `useEffect` that reads `config` and calls `setConfig` or `writeInternalConfig`
- Never derive widget list from ccstatusline config — always from `INDIVIDUAL_WIDGETS` registry
- Never duplicate color resolution logic — always use `preview-utils.js`

---

## Testing Conventions

**Framework:** `node:test` + `node:assert/strict` (built-in). `ink-testing-library` for TUI components.

**Test organization:**

```
test/
  hook.test.js                    # 8-signal hook: all event handlers, history, LLM state
  reader.test.js                  # line N, color resolution, widget extractors, story formatting
  llmstate-widget.test.js         # LLM state badge rendering, 5-state model
  install.test.js                 # bmad-line-0/1/2 injection, hook config (13 events), upgrade v1→v2
  uninstall.test.js               # bmad-line-N removal, config cleanup
  clean.test.js                   # Cache dir cleanup
  defaults.test.js                # Widget definitions, hook config shape, shared constants bridge
  cli.test.js                     # CLI command routing
  tui-app.test.js                 # Multi-line state, config mutation, reset, lifecycle
  tui-config-loader.test.js       # Internal config loading, v1 migration, ensureWidgetOrder
  tui-config-writer.test.js       # Internal config writing, ccstatusline sync
  tui-widget-registry.test.js     # Widget metadata, createDefaultConfig, ANSI_COLORS
  tui-preview-utils.test.js       # Color resolution, sample values
  tui-components.test.js          # ThreeLinePreview, ShortcutBar rendering
  tui-edit-line.test.js           # EditLineScreen widget toggle, reorder, color
  tui-separator.test.js           # SeparatorStyleScreen
  tui-preset.test.js              # PresetSave/Load screens
  tui-reorder-lines.test.js       # ReorderLinesScreen
  tui-select-preview.test.js      # SelectWithPreview component
  tui-widget-order.test.js        # Widget order persistence, drag operations
  tui-lifecycle.test.js           # PID registry, signal handlers, TTY watch
  tui-monitor.test.js             # MonitorScreen polling, session grouping
  tui-monitor-components.test.js  # Monitor components: FileTree, BashSection, LlmBadge
  tui-monitor-detail.test.js      # MonitorDetailScreen, chronology, export
  fixtures/                       # JSON fixtures for config states, status files
```

**Test patterns:**
- Test file naming: `{module}.test.js` for core, `tui-{module}.test.js` for TUI
- Structure: `describe()` blocks with behavior-focused `it()` names
- Hook/reader tests: spawn as child process via `execSync` with mocked stdin + env vars
- TUI component tests: `ink-testing-library` render + `lastFrame()` assertions
- Async TUI tests: `await delay(50)` between stdin writes and assertions
- Helper: `captureOutput(fn)` for console.log capture in installer tests
- Environment isolation: `BMAD_CACHE_DIR` and `BMAD_CONFIG_DIR` env vars for testability
- Assertions: `assert.equal()`, `assert.deepEqual()`, `assert.ok()`, `assert.match()` — strict mode only
- Concurrency: `--test-concurrency=4` — 4 parallel test files
- Timeout: `--test-timeout=30000` — 30s per test (accommodates wmic PID detection on Windows)

---

## Code Conventions

**File naming:**
- kebab-case for utilities: `bmad-hook.js`, `config-loader.js`, `widget-registry.js`, `shared-constants.cjs`
- PascalCase for React components: `HomeScreen.js`, `ThreeLinePreview.js`, `LlmBadge.js`
- Test suffix: `.test.js`
- CJS marker: `.cjs` extension for standalone CommonJS modules shared at runtime

**Naming conventions:**
- `camelCase` for functions/variables: `loadConfig()`, `readStatus()`, `computeDisplayState()`
- `UPPER_SNAKE_CASE` for constants: `ALIVE_MAX_AGE_MS`, `STORY_WORKFLOWS`, `LLM_STATE_PRIORITY`, `MAX_HISTORY`
- `PascalCase` for React components: `HomeScreen()`, `MonitorScreen()`, `LlmBadge()`

**Code style (no linter — manual adherence):**
- 2-space indentation
- Single quotes (except JSON)
- Semicolons always
- `const e = React.createElement;` — JSX-less React pattern
- Node.js built-in imports use `node:` prefix: `import fs from 'node:fs'`
- Relative imports use explicit `.js` extensions
- CJS modules use `'use strict';` at top

**Comment style:**
- One-line file header: `// app.js — Screen router TUI configurator for BMAD statusline`
- Section markers in CJS: `// ─── 1. Requires ──────────`
- Pattern references: `// Pattern 15 — updateConfig(mutator):`
- Inline comments explain "why", not "what"

---

## Installer Per-Line Deployment [CURRENT]

### Install Targets (v2)

| # | Target | Behavior |
|---|--------|----------|
| 1 | `~/.claude/settings.json` statusLine | Add config if absent, skip if present |
| 2 | `~/.config/ccstatusline/settings.json` widgets | Inject `bmad-line-0`, `bmad-line-1`, `bmad-line-2` |
| 3 | `~/.config/bmad-statusline/bmad-sl-reader.js` | **Always overwrite** (deploy latest) |
| 4 | `~/.config/bmad-statusline/shared-constants.cjs` | **Always overwrite** (deploy latest) |
| 5 | `~/.config/bmad-statusline/workflow-colors.cjs` | **Always overwrite** (deploy latest) |
| 6 | `~/.cache/bmad-status/` | Create dir if absent |
| 7 | `~/.claude/settings.json` hooks | Merge 13 event types if absent |
| 8 | `~/.config/bmad-statusline/bmad-hook.js` | **Always overwrite** (deploy latest) |
| 9 | `~/.config/bmad-statusline/config.json` | Create with defaults if absent |

### Upgrade Path (v1 → v2)

- Detect old individual `bmad-*` widgets in ccstatusline → remove all + separators
- Inject `bmad-line-0` composite
- Create internal config via migration logic (structure detection, no version field)
- Hook config upgrade: old 5-matcher → 13-event (additive merge)

### Uninstall (v2)

| Component | Detection | Action |
|-----------|-----------|--------|
| ccstatusline widgets | `id` matching `bmad-line-*` | Remove |
| ccstatusline widgets | `id` matching `bmad-*` (individual) | **Backward compat** — remove old |
| Internal config | `config.json` exists | Delete |
| Deployed reader + hook + CJS | Files exist | Delete |
| All other targets | (unchanged) | (unchanged) |

### Config Migration v1→v2

Detection (no version field — structure-based):
1. If `config.json` exists with `lines` array → v2, load directly
2. If absent → scan ccstatusline for `bmad-*` widgets
3. If bmad widgets found → v1, migrate (widgets to line 0, lines 1-2 empty)
4. If nothing found → first install, create defaults

---

## Enforcement Guidelines

**All AI Agents MUST:**

**Core rules (hook/reader/installer):**
- Check error handling philosophy before writing error-related code (pattern 1)
- Use `colorize()` for all ANSI output in reader — never inline escape codes (pattern 3)
- Follow the full config mutation sequence for ccstatusline JSON modifications (pattern 4)
- Use `path.join()` for all paths, `paths` parameter in installer (pattern 5)
- Use synchronous fs operations only (pattern 2)
- Use atomic write (.tmp + rename) for status files (pattern 8)
- Normalize paths to forward slashes in hook before matching (pattern 9)
- Validate cwd scoping before any pattern matching in Read/Write/Edit (pattern 11)
- Validate step/story paths belong to active **skill** (pattern 9)
- Use dynamic slicer for skill name normalization — never hardcode `slice(5)` (pattern 10)
- Use `shouldUpdateStory()` for all story updates (pattern 12)
- Use multi-track step regex (pattern 13)
- Import constants from `shared-constants.cjs` — never duplicate (except hook's local STORY_WORKFLOWS)

**LLM state rules:**
- Always set `llm_state` AND `llm_state_since` together
- Always clear `error_type` on non-error events (`status.error_type = null`)
- Always clear `subagent_type` on non-subagent events (`status.subagent_type = null`)
- Use `computeDisplayState()` from shared-constants for display — never read `llm_state` raw in reader/TUI

**History rules:**
- Always guard with `canAppendHistory()` before appending to reads/writes/commands
- Always call `trimHistory()` after each append
- Always initialize arrays with `if (!Array.isArray(status.reads)) status.reads = [];`
- Always include `agent_id: payload.agent_id || null` in history entries
- Truncate bash commands to 1000 chars before storing

**TUI rules:**
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
- Pass `isActive` to all `useInput()` hooks — prevents ghost input on unfocused screens
- Use PID lifecycle (register/unregister/signal handlers) in any new TUI entry point (pattern 28)

---

## Usage Guidelines

**For AI Agents:**
- Read this file before implementing any code in bmad-statusline
- Follow ALL patterns exactly as documented — they prevent known bugs and architectural violations
- When in doubt between patterns, the numbered pattern takes precedence
- All sections are [CURRENT] — they describe what exists in code today

**For Humans:**
- Keep this file lean and focused on agent needs
- Update when architecture decisions change
- Remove rules that become obvious from the codebase over time

Last Updated: 2026-04-09
