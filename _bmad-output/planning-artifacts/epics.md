---
stepsCompleted: [1, 2, 3, 4, 'e6-step-01', 'e6-step-02', 'e6-step-03', 'e6-step-04']
status: 'complete'
completedAt: '2026-03-31'
inputDocuments:
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/brainstorming/brainstorming-session-2026-03-29-001.md'
  - '_bmad-output/brainstorming/brainstorming-session-2026-03-29-002.md'
  - '_bmad-output/project-context.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
  - '_bmad-output/planning-artifacts/prd.md'
---

# Toulou (bmad-statusline pivot) - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for the bmad-statusline pivot from LLM-driven status writing to passive hook-based extraction. Requirements are derived from the Architecture Decision Document and the Brainstorming spec. Epics 1-2 (package distributable + TUI) are already implemented. Epic 3 (hook pivot + cleanup) is delivered. Epic 4 covers Phase 4: 5-signal hook evolution with multi-module support, story intelligence, and session resume.

## Requirements Inventory

### Functional Requirements

**Hook Script (new component):**
FR1: Single PostToolUse hook triggered on every Read and Skill event
FR2: Detect workflow start via path pattern `skills/bmad-{name}/workflow.md` — set workflow, list `steps/` for total, reset `started_at` if workflow changed
FR3: Detect step change via path pattern `steps/step-XX-*.md` — set step.current, step.current_name, derive next and next_name
FR4: Detect story via path pattern `stories/*.md` — set story from filename slug
FR5: Extract project from config.yaml content in payload (zero I/O — content available in tool_response.file.content)
FR6: Guard: check `_bmad/` exists in cwd at first event, ignore non-BMAD projects silently
FR7: Guard: only reacts to meaningful BMAD paths, ignores all other Reads silently
FR8: Write status file to `~/.cache/bmad-status/status-{session_id}.json`

**Reader (existing, modified):**
FR9: Remove agent, request, document extractors from composite widgets (compact/full/minimal)
FR10: Simplify composites to: project + workflow + progressstep + story
FR11: Keep individual extractors for remaining fields (project, workflow, step, nextstep, progress, progressbar, progressstep, story, timer)
FR12: Retain dynamic colors (workflow colorization) and timer

**Installer (existing, modified):**
FR13: Add hook configuration to `~/.claude/settings.json` under `hooks.PostToolUse`
FR14: Deploy hook script to `~/.config/bmad-statusline/` alongside reader
FR15: Remove CLAUDE.md instruction block injection (replaced by hook)
FR16: Remove permission rules injection (hook doesn't need Bash permissions)
FR17: Idempotent hook install — detect existing hook, skip if present
FR18: Uninstall must remove hook from settings.json and delete hook script

**Phase 4 — Hook Evolution (FR19-FR36):**

**Hook Script (evolved):**
FR19: UserPromptSubmit handler — regex `/((?:bmad|gds|wds)-[\w-]+)/` on `prompt` field to detect active workflow (replaces PostToolUse Skill). Matcher does NOT filter — hook must filter internally.
FR20: Multi-module support — `bmad-*`, `gds-*`, `wds-*` via dynamic slicer `skill.slice(skill.indexOf('-') + 1)` instead of `slice(5)`
FR21: cwd scoping — verify `filePath.startsWith(cwd)` on all Read/Write/Edit before pattern matching (bug fix)
FR22: Multi-track step detection — regex `/steps(-[a-z])?/step-(?:[a-z]-)?(\d+)-(.+)\.md$/` covering `steps/`, `steps-c/`, `steps-v/`, `steps-e/`
FR23: Step total calculated at first Read of a step file (from parent dir), not at Skill event. Recalculate on track change.
FR24: Story intelligence — 3-level priority system (P1: Write/Edit sprint-status, P2: first Read/Write story file + lock, P3: Read sprint-status unique candidate)
FR25: `shouldUpdateStory(incoming, current)` — priority resolution with locking
FR26: Write handler — parse YAML from `tool_input.content` for story confirmation (sprint-status), detect story file creation (create-story)
FR27: Edit handler — regex on `tool_input.new_string` for story confirmation via sprint-status
FR28: SessionStart resume handler — touch `.alive-{session_id}`, matcher `"resume"` only
FR29: `.alive-{session_id}` touched on every hook invocation (belt) + dedicated SessionStart (suspenders)
FR30: Status file — new fields `skill` (full name), `story_priority` (1/2/3/null), `step.track` ("-c"/"-v"/etc.)

**Installer (evolved):**
FR31: Hook config — 5 matchers across 3 event types (UserPromptSubmit, PostToolUse Read/Write/Edit, SessionStart)
FR32: Upgrade path Phase 2→4 — detect old PostToolUse Skill matcher → remove it, add new matchers
FR33: Idempotency — scan all 3 event type keys to detect existing hooks, add only missing ones

**Uninstaller (evolved):**
FR34: Remove matchers from 3 event type keys (UserPromptSubmit, PostToolUse, SessionStart)
FR35: Backward compat 3 generations — Phase 1 (CLAUDE.md/permissions), Phase 2 (PostToolUse Skill+Read), Phase 4 (5-matcher)

**Clean (evolved):**
FR36: `.alive`-based cleanup — `ALIVE_MAX_AGE_MS = 7 days`. Status files without `.alive` or with expired `.alive` are eligible for cleanup.

### NonFunctional Requirements

NFR1: Zero LLM friction — hook is invisible to the LLM, no instructions needed
NFR2: Zero external dependencies for hook script (Node.js stdlib only)
NFR3: Near-zero I/O — hook parses payload content directly, only I/O is readdirSync(steps/) + status file write
NFR4: Silent failure — empty/no-op on any error, never blocks Claude Code
NFR5: Cross-platform (Windows Git Bash, macOS, Linux) — same as existing
NFR6: Idempotent install/uninstall for hook config
NFR7: Backward-compatible uninstall — remove old CLAUDE.md markers from previous installs

### Additional Requirements

- Pivot in place — not greenfield, modify existing codebase
- Hook entry point structure prescribed (pattern 0): Requires → Constants → Stdin parsing → Guard → Dispatch → Handlers → Status helpers → Main
- Error handling triad: reader=silent, hook=silent, installer=verbose
- Synchronous I/O mandatory — correctness guarantee, not style choice
- Path normalization to forward slashes before all matching
- Status file schema is the interface contract between hook (writer) and reader (consumer)
- Skill name normalization: strip `bmad-` prefix identically in hook and reader
- Trackable skill detection via `steps/` directory existence (no whitelist)
- Story gating: only tracked in create-story, dev-story, code-review workflows
- Config JSON mutation sequence for installer: read → parse → backup → modify → stringify → write → reread → validate
- Hook status file I/O: cache pattern (no backup, read-before-write mandatory)
- Dual matchers in hooks config (Skill + Read) — single script handles both
- `updated_at` must be set on every status file write
- Reader `getStoryOrRequest()` simplified to just return story
- Files to remove: src/patch-init.js, test/patch-init.test.js, test/fixtures/bmad-init-original.py

**Phase 4 — Additional Requirements (Architecture Rev.2):**
- No new runtime files — logic evolution within existing files only
- Hook entry point structure (pattern 0) extended: 14 sections (up from 9)
- New implementation patterns: cwd scoping (#11), story priority (#12), step multi-track (#13)
- Status file schema extended with 3 hook-internal fields (`skill`, `story_priority`, `step.track`)
- New fixture: `claude-settings-with-hooks-phase2.json` for upgrade tests
- Modified fixture: `claude-settings-with-hooks.json` → 5 matchers
- Modified fixture: `status-sample.json` → includes `skill`, `story_priority`, `step.track`
- Critical gap: **UserPromptSubmit payload format** — must be validated empirically via spike before implementation

### UX Design Requirements

N/A — CLI tooling project, no UI design document (Epics 1-4).

## TUI Redesign Requirements (Epic 5)

_Source documents: ux-design-specification.md, architecture.md (Boundary 6)_

### Functional Requirements (TUI Redesign)

FR-TUI1: Modal navigation model — Replace 6-section dashboard with single-screen-per-decision navigation tree
FR-TUI2: Home screen — Display top-level options (Widgets, Presets, Widget Order, Target Line, Separator Style, Reset to original) with Select component
FR-TUI3: Widgets list screen — Display 9 widgets with inline status (■/□ visibility, color mode text) and contextual shortcut (h = hide/show toggle)
FR-TUI4: Widget detail screen — Show Color Mode and Visibility options for the selected widget
FR-TUI5: Color mode selection screen — Choose between dynamic and fixed color modes for a widget
FR-TUI6: Fixed color picker screen — Select from 14 ANSI colors (red through brightWhite)
FR-TUI7: Presets screen — Factory Default + 3 custom preset slots with save (s), load (Enter), delete (d)
FR-TUI8: Widget order screen — Dual-mode reorder list (navigate → grab → move → drop) via ReorderList custom component
FR-TUI9: Target line selection screen — Choose status bar line (0, 1, 2)
FR-TUI10: Separator style screen — Choose tight / moderate / wide / custom, with TextInput for custom value
FR-TUI11: Reset to original — Restore config snapshot taken at TUI launch
FR-TUI12: Dual-pattern preview — 2 preview lines (Complete + Steps patterns) visible on every screen, rendered with actual ANSI colors from config
FR-TUI13: Preview on highlight (try-before-you-buy) — Preview updates temporarily on arrow navigation, persists on Enter, reverts on Escape
FR-TUI14: Breadcrumb — Dim grey navigation path displayed at top of every screen (e.g. Home > Widgets > timer > Color Mode)
FR-TUI15: Shortcut bar — Bottom line showing available keyboard shortcuts for current screen context, dynamic per screen/state
FR-TUI16: Universal navigation contract — Escape always back, Enter always forward, ↑↓ navigate, q quit (Home only)
FR-TUI17: Immediate persistence — Every selection writes to config file immediately, no save step
FR-TUI18: Config snapshot at launch — Capture full config state for Reset to original safety net
FR-TUI19: First launch behavior — Load Default preset automatically when no config file exists
FR-TUI20: Preset overwrite confirmation — ConfirmDialog only for saving to non-empty preset slot
FR-TUI21: Error display — StatusMessage component for errors, persists until user presses any key, no auto-dismiss
FR-TUI22: Write failure recovery — React state is source of truth, silent retry on next write operation

### Non-Functional Requirements (TUI Redesign)

NFR-TUI1: Stack — React 19 + Ink 6.8 + @inkjs/ui 2.0 (already in package.json)
NFR-TUI2: 100% keyboard-driven — no mouse interaction
NFR-TUI3: Boundary isolation — all changes within src/tui/ and test/tui-*.test.js only
NFR-TUI4: Reuse config-loader.js and config-writer.js from existing TUI
NFR-TUI5: No interaction with reader or hook at runtime (Architecture Boundary 6)
NFR-TUI6: Cross-platform (Windows Git Bash, macOS, Linux)

### Additional Requirements (TUI Redesign — from Architecture)

- Boundary 6: TUI is an isolated boundary — src/tui/ directory, ESM modules
- Entry point: `npx bmad-statusline` (no args) → bin/cli.js routes to TUI
- Existing app.js (693 lines, 6 simultaneous sections) must be replaced by modular screen architecture
- No new runtime dependencies — use existing React 19 + Ink 6.8 + @inkjs/ui 2.0

### UX Design Requirements (TUI Redesign)

UX-DR1: ScreenLayout component — Wrapper enforcing universal screen template (Breadcrumb + title + content slot + DualPreview + ShortcutBar)
UX-DR2: Breadcrumb component — Dim grey path with ' > ' separator, purely passive display
UX-DR3: DualPreview component — Renders 2 statusline patterns (Complete + Steps) with actual ANSI colors, updates on highlight (temp) and Enter (persist)
UX-DR4: ShortcutBar component — Dynamic bottom line with {key, label} pairs, dim text with bold key names
UX-DR5: ReorderList component — Dual-mode list (navigate/moving) with '← moving' visual marker, useInput state toggle
UX-DR6: ConfirmDialog component — Inline 'Overwrite X? Enter / Esc', visible/hidden states, used only by Presets screen
UX-DR7: Home screen — Select with 6 options: Widgets, Presets, Widget Order, Target Line, Separator Style, Reset to original
UX-DR8: Widgets List screen — 9 widgets with inline status (■/□ visible/hidden + color mode), h shortcut for hide/show toggle
UX-DR9: Widget Detail screen — 2 options: Color Mode (current value) + Visibility (current state)
UX-DR10: Color Mode screen — dynamic / fixed selection for the widget
UX-DR11: Color Picker screen — 14 ANSI colors list (red, green, yellow, blue, magenta, cyan, white + 7 bright variants)
UX-DR12: Presets screen — Default + Custom 1/2/3 with s=save current, d=delete, Enter=load complete snapshot
UX-DR13: Widget Order screen — Numbered list, navigate state (Enter=Grab, Esc=Back), moving state (Enter=Drop, Esc=Cancel), dynamic ShortcutBar
UX-DR14: Target Line screen — Select Line 0 (top) / Line 1 (middle) / Line 2 (bottom)
UX-DR15: Separator Style screen — Select tight/moderate/wide/custom, custom opens TextInput pre-filled with current separator
UX-DR16: Try-before-you-buy pattern — All list screens update DualPreview on arrow highlight (temporary), Enter persists, Escape reverts to persisted value
UX-DR17: Screen layout template — Vertical structure: breadcrumb → empty line → title → empty line → content → empty line → Preview Complete → Preview Steps → empty line → shortcut bar
UX-DR18: Navigation contract — ↑↓ navigate/move, Enter select/confirm/grab/drop, Escape back/cancel/revert, q quit (Home only). No hidden shortcuts.
UX-DR19: Widget visibility direct toggle — h key from Widgets List toggles visibility without entering sub-screen
UX-DR20: Error recovery — Config corruption → load Default + StatusMessage explaining fallback. Write failure → StatusMessage, user presses key, retry on next write.
UX-DR21: Preset snapshot model — Each preset stores complete config (widgets visibility + colors, order, target line, separator)
UX-DR22: Empty states — Empty preset slot shows '(empty)' dim, all widgets hidden shows empty preview, no config → silent Default load
UX-DR23: TextInput patterns — Custom separator pre-filled with current value, preset name empty or pre-filled. Enter=confirm+persist, Escape=cancel+discard.

## TUI v2 Requirements (Epic 6)

_Source documents: prd.md (TUI v2), ux-design-specification.md (Rev.2), architecture.md (Rev.3)_

### Functional Requirements (TUI v2)

**Widget Configuration Per Line:**
FR-V2-1: Developer can show/hide any of the 9 individual widgets on any line
FR-V2-2: Developer can reorder widgets within a line via grab-and-move
FR-V2-3: Developer can set a fixed ANSI color for any widget (except workflow)
FR-V2-4: Developer can set workflow widget to dynamic color mode (workflow-specific ANSI colors)
FR-V2-5: Developer can configure widgets independently on each of the 3 lines
FR-V2-6: All widgets default to sensible fixed colors on first install (except workflow = dynamic)

**Preview:**
FR-V2-7: A 3-line preview box is always visible at the top of every screen
FR-V2-8: Preview reflects the current configuration with actual ANSI colors
FR-V2-9: Preview updates within the same render cycle as any configuration change

**Presets:**
FR-V2-10: Developer can save the current line's configuration to one of 3 shared preset slots
FR-V2-11: Developer can load a preset into the current line being edited
FR-V2-12: Preset slots show a mini-preview of their stored line content
FR-V2-13: Presets persist across TUI sessions
FR-V2-14: Loading a preset replaces only the current line, not all lines

**Navigation:**
FR-V2-15: Home screen offers: Edit widget line 1/2/3, Reorder lines, Separator style, Reset to original
FR-V2-16: Edit widget line screen provides: visibility toggle (h), grab reorder (g), color picker (c), save preset (s), load preset (l)
FR-V2-17: Reorder lines screen allows swapping entire line contents between lines
FR-V2-18: Escape always goes back one level
FR-V2-19: Breadcrumb always shows current position

**ccstatusline Integration:**
FR-V2-20: Each non-empty line injects exactly one composite widget into ccstatusline
FR-V2-21: The composite widget calls the reader with a `line N` command
FR-V2-22: Native ccstatusline widgets coexist on the same line without interference

**Reader:**
FR-V2-23: Reader supports `line N` command that outputs composed widgets for line N
FR-V2-24: Reader formats story names as "X-Y Title Case" (not raw slugs)
FR-V2-25: All workflows in WORKFLOW_COLORS have visible, distinct colors
FR-V2-26: Legacy composite commands (compact, full, minimal) are removed

**Bug Fixes:**
FR-V2-27: All 9 widgets can be toggled visible/hidden regardless of initial defaultEnabled state
FR-V2-28: Reset to original restores launch configuration without render loop errors
FR-V2-29: Preview renders colors correctly in the terminal

**Installer:**
FR-V2-30: Installer deploys one composite bmad widget per configured non-empty line
FR-V2-31: Uninstaller removes all bmad-line-N widgets from ccstatusline config

### Non-Functional Requirements (TUI v2)

**Performance:**
NFR-V2-1: TUI launch time under 500ms (current baseline)
NFR-V2-2: Preview update within the same render cycle as user input (no perceptible delay)
NFR-V2-3: Reader `line N` command completes under 50ms

**Reliability:**
NFR-V2-4: Corrupted internal config falls back to defaults without crash
NFR-V2-5: Missing preset slots default to empty without error
NFR-V2-6: Reader returns empty string on any error (silent failure)

**Compatibility:**
NFR-V2-7: Cross-platform: Windows (Git Bash), macOS, Linux
NFR-V2-8: Node.js >= 20
NFR-V2-9: ccstatusline >= 2.2 (custom-command widget support)

**Maintainability:**
NFR-V2-10: Zero external runtime dependencies for reader/hook/installer
NFR-V2-11: TUI dependencies scoped to src/tui/ only
NFR-V2-12: All state management centralized in app.js

### Additional Requirements (TUI v2 — from Architecture Rev.3)

- Internal config schema at `~/.config/bmad-statusline/config.json` — contract between TUI (writer) and reader (consumer)
- `BMAD_CONFIG_DIR` env var for testability in both TUI and reader (pattern 5)
- Config migration v1→v2 via structure detection (no version field)
- TUI state separation: config (persisted), snapshot (immutable at mount), previewOverride (transient), navigation (React-only)
- `updateConfig(mutator)` pattern with `structuredClone` — never `setConfig` directly (pattern 15)
- `syncCcstatuslineIfNeeded` only on empty↔non-empty transitions (pattern 16)
- Dead code removal: 14 elements — COMPOSITE_WIDGETS, getCompositeWidgets(), buildWidgetConfig(), applyColorMode(), compact/full/minimal handlers, bmad-compact definition, DualPreview, WidgetDetailScreen, ColorModeScreen, TargetLineScreen, SelectWithPreview (evaluate), PlaceholderScreen, PresetsScreen, WidgetsListScreen, WidgetOrderScreen
- Screen props contract: config, updateConfig, previewOverride, setPreviewOverride, navigate, goBack, editingLine, selectedWidget (pattern 18)
- Internal config I/O: no backup before write, no validation post-write, corrupted → defaults (pattern 14)
- ccstatusline config writes follow backup/validate sequence (pattern 4)
- Preview override pattern for try-before-you-buy (pattern 17)
- Color resolution via centralized `resolvePreviewColor()` helper in `preview-utils.js` (pattern 19)
- Reader internal config reading via same `BMAD_CONFIG_DIR` env var, reader NEVER writes config (pattern 20)
- Installer upgrade path: detect old bmad-* individual widgets → replace with bmad-line-0, create internal config with defaults

### UX Design Requirements (TUI v2)

**Components:**
UX-DR-V2-1: ScreenLayout — Wrapper enforcing universal screen template (Breadcrumb + ThreeLinePreview at top + content slot + ShortcutBar)
UX-DR-V2-2: Breadcrumb — Dim grey navigation path with ` > ` separator, purely passive display
UX-DR-V2-3: ThreeLinePreview — Replaces DualPreview, 3-line boxed frame with actual ANSI colors, "Preview" label, updates on highlight (temp) and Enter (persist)
UX-DR-V2-4: ShortcutBar — Contextual keyboard shortcut display, dim text with bold key names, dynamic per screen/state
UX-DR-V2-5: ReorderList — Dual-mode list (navigate/grab) with `← moving` marker, used by Edit Line (widget reorder) and Reorder Lines (line swap)
UX-DR-V2-6: ConfirmDialog — Inline `Overwrite slot N (name)? Enter / Esc`, used only by Preset Save for non-empty slots

**Screens:**
UX-DR-V2-7: Home Screen — 6 options with emoji prefixes (📝 Edit widget line 1/2/3, 🔀 Reorder lines, ✦ Separator style, ↩ Reset to original) + 3-line preview
UX-DR-V2-8: Edit Widget Line — All 9 widgets listed with inline status (■/□ visible/hidden + color name/dynamic), shortcuts h/g/c/s/l
UX-DR-V2-9: Color Picker — "Dynamic" option only for bmad-workflow, 14 ANSI colors for all widgets, preview-on-highlight
UX-DR-V2-10: Preset Save/Load — Separate save (s) and load (l) sub-screens, 3 shared slots with mini-preview, name prompt for empty slot
UX-DR-V2-11: Reorder Lines — Swap entire line contents via grab/drop, preview updates live during swap
UX-DR-V2-12: Separator Style — serre/modere/large/custom with TextInput for custom, preview-on-highlight

**Interaction Patterns:**
UX-DR-V2-13: Preview-on-highlight (try-before-you-buy) — Arrow = temporary preview, Enter = persist, Escape = revert. Applies to Color Picker, Separator Style, Preset Load.
UX-DR-V2-14: Friendly UI — Measured emojis (one per menu item max), ANSI colors for hierarchy, vertical spacing, muted chrome (dim breadcrumb/shortcut bar)
UX-DR-V2-15: Default widget colors — project=cyan, workflow=dynamic, step=yellow, nextstep=yellow, progress=green, progressbar=green, progressstep=brightCyan, story=magenta, timer=brightBlack
UX-DR-V2-16: Navigation contract — ↑↓ navigate/move, Enter select/confirm/grab/drop, Escape back/cancel/revert, q quit (Home only). Letter shortcuts contextual per screen.

**UX Patterns:**
UX-DR-V2-17: Empty states — Empty preset slot shows `(empty)` dim, no config → load defaults silently, empty line → blank preview line
UX-DR-V2-18: Error recovery — Config corruption → load defaults + StatusMessage. Write failure → StatusMessage, retry on next write.
UX-DR-V2-19: Write failure recovery — React state is source of truth. Write failure preserves in-memory state. Next write silently retries.
UX-DR-V2-20: First launch defaults — All default-enabled widgets on line 1, lines 2-3 empty, default colors per widget, no wizard
UX-DR-V2-21: Dual-mode grab — Edit Line and Reorder Lines share grab/drop pattern. ShortcutBar transitions between navigate and moving states.
UX-DR-V2-22: Widget inline status — Each widget shows `Name  ■ visible  cyan` or `Name  □ hidden  brightBlack` in Edit Line screen
UX-DR-V2-23: TextInput patterns — Custom separator pre-filled with current value, preset name empty for new slot. Enter=confirm+persist, Escape=cancel+discard.

### FR Coverage Map

| FR | Story | Description |
|---|---|---|
| FR1-FR8 | 3.1 | Hook passif (dual-signal Skill+Read, guards, status file write) |
| FR9-FR12 | 3.2 | Reader (remove agent/request/document, simplify composites, step.completed→current-1) |
| FR13 (prep) | 3.3 | defaults.js (getHookConfig export for install) |
| FR13-FR17 | 3.4 | Install pivot (hook config injection, hook deploy, remove CLAUDE.md + permissions targets) |
| FR15-FR16 | 3.4 | Remove old install targets (CLAUDE.md block, permission rules) |
| FR18, NFR7 | 3.5 | Uninstall pivot (hook removal + backward compat old CLAUDE.md/permissions) |
| — (TUI) | 3.6 | TUI adaptation (remove dead widgets, update composites, fix step.completed refs) |
| — (cleanup) | 3.7 | CLI cleanup + dead code + README.md update |
| FR19-21, FR28-30 | 4.2 | Hook entry point + UserPromptSubmit + multi-module + cwd guard + SessionStart + alive |
| FR22-23 | 4.3 | Multi-track step detection + total from parent dir |
| FR24-25 | 4.4 | Story priority & locking (shouldUpdateStory + workflow gating) |
| FR26-27 | 4.5 | Write & Edit handlers (sprint-status + story file signals) |
| FR31-33 | 4.6 | Defaults + Installer — 5-matcher config + upgrade path |
| FR34-35 | 4.7 | Uninstaller — 3-generation backward compat |
| FR36 | 4.8 | Clean — alive-based cleanup + README |
| FR-TUI1-6 | 5 | Modal navigation + Home + Widget screens (list, detail, color mode, color picker) |
| FR-TUI7-11 | 5 | Presets, widget order, target line, separator, reset to original |
| FR-TUI12-19 | 5 | Shared components (ScreenLayout, Breadcrumb, DualPreview, ShortcutBar) + try-before-you-buy + persistence + first launch |
| FR-TUI20-22 | 5 | Preset overwrite confirmation + error display + write failure recovery |
| FR-V2-6, FR-V2-26 (dead code) | 6.1 | Internal config schema, widget defaults, dead code removal |
| FR-V2-23-26 | 6.2 | Reader `line N` command, story formatting, workflow colors, remove legacy composites |
| FR-V2-20, NFR-V2-4 | 6.3 | Config-loader v2 + config-writer v2 + migration v1→v2 + ccstatusline sync |
| FR-V2-1,2,5,7-9,15-16,18-19,27-29 | 6.4 | TUI v2 core: state model, shared components, Home + Edit Line, bug fixes BF1/BF2/BF3 |
| FR-V2-3,4,10-14,17 | 6.5 | Color Picker, Presets save/load, Reorder Lines |
| FR-V2-20-22,30-31 | 6.6 | Installer per-line deployment, upgrade path, uninstaller cleanup |

## Epic List

### Epic 3: Pivot hook passif bmad-statusline

Le développeur bénéficie d'un tracking BMAD 100% passif via hook — zéro friction LLM, install/uninstall gèrent le hook automatiquement, le TUI reflète les widgets simplifiés, et le code mort de l'ancienne approche est nettoyé.

**FRs covered:** FR1-FR18
**NFRs addressed:** NFR1-NFR7

**Stories:**
- 3.1: Hook script (`bmad-hook.js`) — composant nouveau + tests
- 3.2: Reader simplification — retirer extractors agent/request/document, simplifier composites, step.completed→current-1 + tests
- 3.3: defaults.js pivot — retirer generateClaudeMdBlock/getPermissionRules, ajouter getHookConfig + tests
- 3.4: Install pivot — remplacer targets CLAUDE.md/permissions par hook targets + tests
- 3.5: Uninstall pivot — hook removal + backward compat anciens installs + tests
- 3.6: TUI adaptation — retirer widgets morts (agent/request/document), adapter preview/composites, fixer refs step.completed + tests
- 3.7: CLI cleanup + dead code — retirer route patch-init, supprimer fichiers morts, update README.md + tests

**Dependencies:** 3.2 and 3.3 parallelizable. 3.4 and 3.5 depend on 3.3. 3.6 depends on 3.2 and 3.3. 3.7 independent (after 3.1).

### Epic 4: 5-Signal Hook Evolution — Multi-Module, Story Intelligence, Session Resume

The developer benefits from expanded hook intelligence covering multi-module workflows (bmad/gds/wds), multi-track steps, smart story detection with priority locking, cwd scoping, and session persistence — with seamless install/uninstall/clean supporting all new signals.

**FRs covered:** FR19-FR36
**NFRs addressed:** NFR1-NFR7 (unchanged)

**Stories:**
- 4.1: Spike — UserPromptSubmit payload validation (empirical test)
- 4.2: Hook entry point + UserPromptSubmit handler + multi-module regex + dynamic slicer + cwd guard + SessionStart + alive touch + tests
- 4.3: Hook — Multi-track step detection + total from parent dir + track change recalculation + tests
- 4.4: Hook — Story intelligence (3-level priority with locking, shouldUpdateStory, workflow gating) + tests
- 4.5: Hook — Write & Edit handlers (sprint-status YAML parse, story file detection) + tests
- 4.6: Defaults + Installer — 5-matcher config across 3 event types + upgrade path Phase 2→4 + tests
- 4.7: Uninstaller — 3-generation backward compat (Phase 1/2/4) + tests
- 4.8: Clean + README — alive-based cleanup with ALIVE_MAX_AGE_MS + documentation update + tests

**Dependencies:** 4.1 first (spike). 4.2 depends on 4.1. 4.3 and 4.4 parallelizable after 4.2. 4.5 depends on 4.4. 4.6 depends on 4.2-4.5. 4.7 depends on 4.6. 4.8 after all others.

### Epic 5: TUI Redesign — Modal Navigation, Widget Configuration, Layout & Presets

The developer can launch the redesigned TUI (`npx bmad-statusline`), navigate a modal tree of configuration screens with breadcrumb orientation and dual-pattern live preview, fully configure individual widgets (visibility, color mode, fixed color), reorder widgets, choose target line, customize separator, manage presets (save/load/delete), and reset to original. Replaces the current 693-line dashboard with a modular screen-per-decision architecture.

**FRs covered:** FR-TUI1-22
**NFRs addressed:** NFR-TUI1-6
**UX-DRs covered:** UX-DR1-23

**Stories:**
- 5.1: App shell + shared components (ScreenLayout, Breadcrumb, DualPreview, ShortcutBar) + Home screen
- 5.2: Widgets List screen with inline status and visibility toggle
- 5.3: Widget Detail + Color Mode + Color Picker screens
- 5.4: Target Line + Separator Style + Reset to original
- 5.5: Widget Order screen with ReorderList
- 5.6: Presets screen with ConfirmDialog

**Dependencies:** None (isolated TUI boundary). Reuses existing config-loader.js and config-writer.js.

### Epic 6: TUI v2 — Multi-Line Configuration, 3-Line Preview, Presets & Per-Line Deployment

Le développeur peut lancer le TUI v2 redesigné (`npx bmad-statusline`), configurer des widgets individuels indépendamment sur chacune des 3 lignes ccstatusline (visibilité, couleur, ordre), voir une preview 3 lignes boxée en temps réel avec couleurs ANSI, sauvegarder/charger des presets par ligne depuis un pool partagé, réordonner les lignes par swap, et bénéficier d'un reader amélioré (commande `line N`, story name formatting, couleurs workflow complètes). L'installer déploie un composite par ligne non-vide, avec upgrade path v1→v2 automatique.

**FRs covered:** FR-V2-1 à FR-V2-31
**NFRs addressed:** NFR-V2-1 à NFR-V2-12
**UX-DRs covered:** UX-DR-V2-1 à UX-DR-V2-23

**Stories:**
- 6.1: Foundation — Internal config schema, widget registry defaults, dead code removal
- 6.2: Reader — `line N` command, story name formatting, workflow colors, remove legacy composites
- 6.3: Config system — config-loader v2, config-writer v2, migration v1→v2, ccstatusline sync
- 6.4: TUI v2 Core — App shell, state model, shared components, Home + Edit Line screens (+ bug fixes BF1/BF2/BF3)
- 6.5: TUI v2 Sub-screens — Color Picker, Preset Save/Load, Reorder Lines
- 6.6: Installer & Uninstaller — Per-line deployment, internal config creation, upgrade path v1→v2

**Dependencies:** 6.1 first (foundation). 6.2 and 6.3 parallelizable after 6.1. 6.4 depends on 6.3. 6.5 depends on 6.4. 6.6 after 6.5 (needs full TUI functional).

### Epic 7: Monitor — Real-Time Session Supervision

Le développeur peut accéder à un écran Monitor depuis le TUI, superviser en temps réel les sessions Claude Code actives avec workflows BMAD, voir l'état d'activité du LLM (actif/permission/attente/inactif), naviguer dans l'arborescence des fichiers lus/écrits et les commandes Bash exécutées, ouvrir des pages de détail avec diff et horodatage, visualiser une chronologie unifiée, et exporter les données en CSV.

**FRs covered:** FR32-FR67
**NFRs addressed:** NFR13-NFR17

**Stories:**
- 7.1: Hook expansion — handleBash, handleStop, handleNotification, history arrays, llm_state, atomic write
- 7.2: Installer upgrade — 3 nouveaux matchers (Bash, Stop, Notification), upgrade path Phase 3→4
- 7.3: ScrollableViewport — Composant réutilisable stateless, viewport scroll, indicateurs ▲/▼
- 7.4: Monitor foundation — MonitorScreen, useSessionPolling, monitor-utils.js, HomeScreen button, app.js routing
- 7.5: Tabs & Badge — SessionTabs (2 niveaux, couleurs, badges, réordonnancement), LlmBadge (4 états)
- 7.6: File & Bash sections — FileTreeSection (arborescence, hors-projet, compteurs), BashSection (color per family, dédupliqué, ×N)
- 7.7: Detail mode & pages — Navigation arborescente avec curseur (selectable flag), MonitorDetailScreen (fichier édité avec diff, fichier lu, commande bash)
- 7.8: Chronology & Export — Page chronologie (timeline unifiée), ExportPrompt, CSV generation (light/full), confirmation message
- 7.9: Toggles & polish — Auto-scroll (a), bell (b), timestamp toggle (t), sort (s), contextual shortcut bar colors, tests d'intégration

**Dependencies:** 7.1 first (hook foundation). 7.2 depends on 7.1. 7.3 independent (composant). 7.4 depends on 7.1 + 7.3. 7.5 depends on 7.4. 7.6 depends on 7.4 + 7.3. 7.7 depends on 7.6 + 7.3. 7.8 depends on 7.7. 7.9 after all.

## Epic 4: 5-Signal Hook Evolution — Multi-Module, Story Intelligence, Session Resume

The developer benefits from expanded hook intelligence covering multi-module workflows (bmad/gds/wds), multi-track steps, smart story detection with priority locking, cwd scoping, and session persistence — with seamless install/uninstall/clean supporting all new signals.

### Story 4.1: Spike — Validate UserPromptSubmit payload format

As a **bmad-statusline developer**,
I want **to empirically validate the exact payload format delivered by Claude Code's UserPromptSubmit hook event**,
So that **the hook handler implementation is based on verified field names and matcher behavior, not assumptions**.

**Acceptance Criteria:**

**Given** a temporary hook configured in `~/.claude/settings.json` with `UserPromptSubmit` matcher `"(?:bmad|gds|wds)-"`
**When** the user types a prompt containing `/bmad-create-architecture`
**Then** the spike script captures the full JSON payload to a log file in `~/.cache/bmad-status/spike-log.json`

**Given** the captured payload
**When** inspected
**Then** the spike documents: (a) the exact field name containing the user's prompt text (confirmed: `prompt`), (b) presence of `session_id` and `cwd` fields, (c) the exact value of `hook_event_name`

**Given** a prompt that does NOT match `(?:bmad|gds|wds)-` (e.g. a plain text question)
**When** the user types it
**Then** the hook does NOT fire (matcher filters it out — confirmed by absence of log entry)

**Given** the spike script
**When** the user types `/bmad-help` (a utility skill with no steps/ directory)
**Then** the payload is captured and the `prompt` field contains the full prompt text including the `/` prefix (confirmed by spike)

**Given** the spike is complete
**When** the findings are documented
**Then** a `test/fixtures/spike-userpromptsubmit-payload.json` file is created with a sanitized real payload for use as a test fixture in subsequent stories

**Given** the spike explores sub-agent behavior
**When** the developer triggers an Agent tool call within an active session
**Then** the spike documents whether the sub-agent's tool events share the parent `session_id` or use a different one

### Story 4.2: Hook dispatch evolution — 5-signal entry point, UserPromptSubmit, multi-module, cwd guard, SessionStart, alive

As a **developer using BMAD, GDS, or WDS workflows**,
I want **the hook to detect workflow activation from any module via UserPromptSubmit, scope all file events to the current project, and persist session liveness**,
So that **my status tracking works across all BMAD ecosystem modules with no cross-project contamination and survives session resume**.

**Acceptance Criteria:**

**Given** the hook receives a `UserPromptSubmit` event with `prompt` containing `/bmad-create-architecture`
**When** `{cwd}/.claude/skills/bmad-create-architecture/steps/` exists
**Then** the status file sets `skill: "bmad-create-architecture"`, `workflow: "create-architecture"`, and `started_at` to now

**Given** the hook receives a `UserPromptSubmit` event with `prompt` containing `/gds-code-review`
**When** `{cwd}/.claude/skills/gds-code-review/steps/` exists
**Then** the status file sets `skill: "gds-code-review"`, `workflow: "code-review"` (dynamic slicer after first `-`)

**Given** the hook receives a `UserPromptSubmit` event with `prompt` containing `/wds-4-ux-design`
**When** `{cwd}/.claude/skills/wds-4-ux-design/steps/` exists
**Then** the status file sets `skill: "wds-4-ux-design"`, `workflow: "4-ux-design"`

**Given** the active workflow is already `create-architecture` from skill `bmad-create-architecture`
**When** the hook receives another UserPromptSubmit for `/bmad-create-architecture`
**Then** `started_at` is preserved (not reset) — only resets when skill name changes

**Given** the hook receives a UserPromptSubmit for `/bmad-help`
**When** `{cwd}/.claude/skills/bmad-help/steps/` does NOT exist (no `steps*/` directory)
**Then** the hook ignores the event entirely and preserves the current status

**Given** the hook receives a UserPromptSubmit with a `prompt` that does NOT match `/((?:bmad|gds|wds)-[\w-]+)/` (e.g., "hello")
**When** processed
**Then** the hook exits silently — the matcher does NOT filter UserPromptSubmit events, so the hook fires on every prompt and must filter internally via regex

**Given** the hook receives a PostToolUse Read event with `tool_input.file_path` pointing to a file outside `payload.cwd`
**When** both paths are normalized to forward slashes
**Then** the hook ignores the event (cwd scoping — `!normalizedPath.startsWith(normalizedCwd)`)

**Given** the hook receives a PostToolUse Read event with `tool_input.file_path` inside `payload.cwd`
**When** processed
**Then** the existing Read handler logic proceeds (step/story/project extraction unchanged from Phase 2)

**Given** the hook receives any event that passes the `_bmad/` guard
**When** processed
**Then** it touches `.alive-{session_id}` in the cache directory via `fs.writeFileSync`

**Given** the hook receives a `SessionStart` event (matcher `"resume"`)
**When** processed
**Then** it touches `.alive-{session_id}` and exits (no status file modification)

**Given** the hook source code
**When** inspected
**Then** the dispatch branches on `hook_event_name` first (`UserPromptSubmit` → `handleUserPrompt`, `PostToolUse` → branch on `tool_name`, `SessionStart` → `handleSessionStart`), not on `tool_name` first

**Given** the hook source code
**When** inspected
**Then** the `SKILL_REGEX` constant is `/((?:bmad|gds|wds)-[\w-]+)/` and the dynamic slicer uses `skillName.slice(skillName.indexOf('-') + 1)`

**Given** the hook source code
**When** inspected
**Then** it stores both `skill` (full name) and `workflow` (stripped name) in the status file, plus `story_priority: null` as initial value

**Given** the hook source code
**When** inspected
**Then** the `ALIVE_MAX_AGE_MS` constant is `7 * 24 * 60 * 60 * 1000` (7 days)

**Given** `test/hook.test.js`
**When** updated for this story
**Then** it tests: (a) UserPromptSubmit with bmad/gds/wds skills, (b) utility skill ignored, (c) non-matching prompt ignored, (d) cwd scoping (inside vs outside), (e) alive file creation, (f) SessionStart alive touch, (g) started_at preservation vs reset, (h) dispatch routing for all 5 event types

**Given** `test/fixtures/status-sample.json`
**When** updated for this story
**Then** it includes the new fields: `skill`, `story_priority`, `step.track`

### Story 4.3: Hook — Multi-track step detection with total calculation

As a **developer using BMAD workflows with multiple step tracks (steps/, steps-c/, steps-v/)**,
I want **the hook to detect step progress across any track directory and calculate the correct total per track**,
So that **my step progress is accurate regardless of which track my workflow follows**.

**Acceptance Criteria:**

**Given** an active workflow and the hook receives a Read event for `{cwd}/.claude/skills/bmad-create-architecture/steps/step-03-starter.md`
**When** processed
**Then** the status file sets `step.current: 3`, `step.current_name: "starter"`, `step.track: ""`

**Given** an active workflow and the hook receives a Read event for `{cwd}/.claude/skills/bmad-tea/steps-c/step-c-01-init.md`
**When** processed
**Then** the status file sets `step.current: 1`, `step.current_name: "init"`, `step.track: "-c"`

**Given** an active workflow and the hook receives a Read event for `{cwd}/.claude/skills/bmad-tea/steps-v/step-v-03-validate.md`
**When** processed
**Then** the status file sets `step.current: 3`, `step.current_name: "validate"`, `step.track: "-v"`

**Given** a Read event matching a step file and `step.total` is not yet set for the current track
**When** processed
**Then** the hook reads the parent directory via `fs.readdirSync`, counts files matching `/^step-(?:[a-z]-)?(\d+)-.+\.md$/`, and sets `step.total` to the count

**Given** `step.track` in the status file is `""` (default steps/) and a new Read matches a step in `steps-c/`
**When** processed
**Then** the hook detects the track change, recalculates `step.total` from the `steps-c/` directory, and updates `step.track: "-c"`

**Given** a Read event for `steps/step-01b-continue.md` (sub-step with letter after number)
**When** the path is matched against the step regex `/\/steps(-[a-z])?\/step-(?:[a-z]-)?(\d+)-(.+)\.md$/`
**Then** it does NOT match — sub-steps are excluded by design

**Given** an active workflow with 8 steps in the current track
**When** the hook receives a Read for the last step (`step-08-*.md`)
**Then** the status file sets `step.current: 8`, `step.next: null`, `step.next_name: null`

**Given** an active workflow with 8 steps
**When** the hook receives a Read for step 3
**Then** the status file derives `step.next: 4` and `step.next_name` from the next file in the alphanumerically sorted directory listing

**Given** a Read event for a step file belonging to a DIFFERENT skill's steps directory than the active skill
**When** the path is validated against the active skill directory
**Then** the hook ignores the event (false positive prevention — `normalizedPath.startsWith(skillDir)` check)

**Given** `test/hook.test.js`
**When** updated for this story
**Then** it tests: (a) default track step detection, (b) `-c` and `-v` track detection, (c) sub-step exclusion, (d) total calculation from parent dir, (e) track change recalculation, (f) last step next=null, (g) next step derivation, (h) cross-skill false positive prevention

### Story 4.4: Hook — Story intelligence with 3-level priority and locking

As a **developer running story-aware workflows (dev-story, code-review, create-story)**,
I want **the hook to detect the active story through a 3-level priority system with locking, ensuring the most authoritative signal wins**,
So that **my statusline shows the correct story even when multiple story-related files are read during a workflow**.

**Acceptance Criteria:**

**Given** the hook source code
**When** inspected
**Then** it defines `STORY_PRIORITY = { SPRINT_STATUS: 1, STORY_FILE: 2, CANDIDATE: 3 }` and `shouldUpdateStory(incomingPriority, currentPriority)` that returns:
- `true` if incoming is 1 (always overwrites)
- `true` if incoming is 2 AND current is null or 3 (first lock)
- `true` if incoming is 3 AND current is null (candidate fallback)
- `false` otherwise

**Given** the hook source code
**When** inspected
**Then** it defines `STORY_READ_WORKFLOWS = ['dev-story', 'code-review']` and `STORY_WRITE_WORKFLOWS = ['create-story']` for workflow gating

**Given** the active workflow is `dev-story` and no story is set (`story_priority: null`)
**When** the hook receives a Read event for `stories/1-3-user-auth.md`
**Then** the status file sets `story: "1-3-user-auth"`, `story_priority: 2` (locked)

**Given** the active workflow is `dev-story` and story is locked at priority 2
**When** the hook receives a Read event for a different story file `stories/1-4-dashboard.md`
**Then** the story is NOT updated — priority 2 lock prevents another priority 2 from overwriting

**Given** the active workflow is `create-architecture` (not in story-tracking lists)
**When** the hook receives a Read event for `stories/1-3-user-auth.md`
**Then** the hook ignores the event — workflow not in `STORY_READ_WORKFLOWS`

**Given** the active workflow is `create-story`
**When** the hook receives a Read event for a story file
**Then** the hook ignores it — `create-story` is NOT in `STORY_READ_WORKFLOWS` (it reads the previous story, not the one being created)

**Given** no story is set (`story_priority: null`)
**When** the hook receives a Read event for `sprint-status.yaml` containing a single story with active status
**Then** the status file sets `story` to that story key, `story_priority: 3` (candidate)

**Given** a story is set at priority 3 (candidate from sprint-status Read)
**When** the hook receives a Read event for `stories/1-3-user-auth.md` in a `dev-story` workflow
**Then** the status file updates `story: "1-3-user-auth"`, `story_priority: 2` — priority 2 overwrites priority 3

**Given** a story is locked at priority 2
**When** a Write or Edit event on sprint-status sets a different story (priority 1)
**Then** the status file updates the story — priority 1 always overwrites, even a lock

**Given** the story file regex
**When** tested against filenames
**Then** `/(\d+-\d+-[\w-]+)\.md$/` matches `1-3-user-auth.md` → slug `1-3-user-auth` and does NOT match `sprint-status.yaml` or `step-03-starter.md`

**Given** a Read event for `sprint-status.yaml` containing multiple stories with active status
**When** parsed
**Then** the hook does NOT set a candidate — candidate (priority 3) requires a unique active story

**Given** `test/hook.test.js`
**When** updated for this story
**Then** it tests: (a) shouldUpdateStory truth table (all priority/state combinations), (b) workflow gating for Read story, (c) priority 2 locking, (d) priority 3 candidate, (e) priority 1 overwrite of lock, (f) priority 3→2 upgrade, (g) create-story Read ignored, (h) non-story workflow ignored, (i) multi-candidate sprint-status ignored

### Story 4.5: Hook — Write & Edit handlers for story confirmation

As a **developer running story-aware workflows**,
I want **the hook to detect story confirmation signals from Write and Edit events on sprint-status and story files**,
So that **the statusline reflects the definitive story assignment when sprint-status is updated or a new story file is created**.

**Acceptance Criteria:**

**Given** the hook receives a PostToolUse Write event for a file matching `/sprint-status[^/]*\.yaml$/` AND the active workflow is in `STORY_WORKFLOWS`
**When** `tool_input.content` contains YAML with a story key whose status changed (delta detection)
**Then** the status file sets `story` to that story key and `story_priority: 1` (always overwrites, even a lock)

**Given** the hook receives a PostToolUse Write event for `sprint-status.yaml` AND the active workflow is in `STORY_WORKFLOWS`
**When** `tool_input.content` contains multiple stories with changed status
**Then** the hook sets `story` to the first changed story found (priority 1 still applies)

**Given** the hook receives a PostToolUse Write event for `sprint-status.yaml` AND the active workflow is NOT in `STORY_WORKFLOWS` (e.g., sprint-planning, BMad Master)
**When** processed
**Then** the hook ignores the event — sprint-status signals are gated by story-aware workflows

**Given** the hook receives a PostToolUse Edit event for a file matching `/sprint-status[^/]*\.yaml$/` AND the active workflow is in `STORY_WORKFLOWS`
**When** `tool_input.new_string` contains a story key (extracted via regex)
**Then** the hook sets `story` to that key with `story_priority: 1`. If `new_string` does not contain a story key, fallback to `tool_input.old_string`. If neither contains a story key, skip silently.

**Given** the active workflow is `create-story`
**When** the hook receives a PostToolUse Write event for `stories/2-1-new-feature.md`
**Then** the status file sets `story: "2-1-new-feature"`, `story_priority: 2` (first Write locks) — using the story file regex on `tool_input.file_path`

**Given** the active workflow is `create-story` and story is already locked at priority 2
**When** the hook receives another Write for a different story file
**Then** the story is NOT updated — priority 2 lock holds

**Given** the active workflow is `dev-story`
**When** the hook receives a Write event for `stories/1-3-user-auth.md`
**Then** the hook ignores it — `dev-story` is NOT in `STORY_WRITE_WORKFLOWS`

**Given** the hook receives a Write event for a file outside `payload.cwd`
**When** the path is checked against cwd
**Then** the hook ignores the event (cwd scoping applies to Write, same as Read)

**Given** the hook receives an Edit event for a file outside `payload.cwd`
**When** the path is checked against cwd
**Then** the hook ignores the event (cwd scoping applies to Edit, same as Read)

**Given** the hook receives a Write event for a non-sprint-status, non-story file
**When** processed
**Then** the hook ignores the event silently

**Given** the hook receives an Edit event for a non-sprint-status file
**When** processed
**Then** the hook ignores the event silently

**Given** `test/hook.test.js`
**When** updated for this story
**Then** it tests: (a) Write sprint-status → priority 1 story set, (b) Edit sprint-status → priority 1 story set, (c) Write story file in create-story → priority 2, (d) Write story file in dev-story → ignored, (e) priority 2 lock on second Write, (f) cwd scoping for Write and Edit, (g) non-matching files ignored

### Story 4.6: Defaults + Installer — 5-matcher hook config with upgrade path

As a **developer installing bmad-statusline**,
I want **`npx bmad-statusline install` to configure all 5 hook matchers across 3 event types and handle upgrades from Phase 2 installs**,
So that **all hook signals are registered with Claude Code and existing Phase 2 users can upgrade seamlessly**.

**Acceptance Criteria:**

**Given** `getHookConfig(hookPath)` in `src/defaults.js`
**When** called
**Then** it returns a config with 3 event type keys: `UserPromptSubmit` (1 matcher with regex `(?:bmad|gds|wds)-`), `PostToolUse` (3 matchers: Read, Write, Edit), `SessionStart` (1 matcher: `resume`) — all pointing to `node "{hookPath}"`

**Given** `test/defaults.test.js`
**When** updated
**Then** it validates `getHookConfig()` returns the 5-matcher structure across 3 event type keys, and the old 2-matcher test is removed

**Given** `~/.claude/settings.json` has no `hooks` key
**When** install runs
**Then** it creates `hooks` with all 3 event type keys and their matchers, creates `.bak` backup before writing, validates post-write

**Given** `~/.claude/settings.json` has `hooks.PostToolUse` with existing non-bmad hooks
**When** install runs
**Then** it appends the 3 bmad matchers (Read, Write, Edit) to the existing array without removing other hooks, and creates `UserPromptSubmit` and `SessionStart` arrays

**Given** `~/.claude/settings.json` already has all 5 bmad-hook matchers across 3 event types
**When** install runs
**Then** it skips hook injection and logs `○ skipped`

**Given** `~/.claude/settings.json` has old Phase 2 config: PostToolUse with Skill + Read matchers for bmad-hook.js
**When** install runs (upgrade path)
**Then** it removes the old Skill matcher, keeps the Read matcher, adds Write and Edit matchers to PostToolUse, adds UserPromptSubmit and SessionStart keys — no duplicate matchers

**Given** install detects partial bmad-hook presence (e.g., PostToolUse matchers exist but no UserPromptSubmit key)
**When** install runs
**Then** it adds only the missing matchers/event type keys

**Given** `~/.config/bmad-statusline/bmad-hook.js` exists or not
**When** install runs
**Then** it always overwrites with the latest `src/hook/bmad-hook.js` and logs `✓ updated`

**Given** `test/install.test.js`
**When** updated
**Then** it tests: (a) fresh install with 5 matchers, (b) idempotency skip, (c) upgrade from Phase 2 (Skill+Read → full 5-matcher), (d) partial install completion, (e) preservation of non-bmad hooks

**Given** `test/fixtures/claude-settings-with-hooks.json`
**When** updated
**Then** it contains the 5-matcher config across 3 event types

**Given** a new fixture `test/fixtures/claude-settings-with-hooks-phase2.json`
**When** created
**Then** it contains the old Phase 2 config (PostToolUse with Skill + Read matchers) for upgrade path tests

### Story 4.7: Uninstaller — 3-generation backward compat

As a **developer removing bmad-statusline**,
I want **`npx bmad-statusline uninstall` to cleanly remove hook config from all 3 event types and handle artifacts from Phase 1, Phase 2, and Phase 4 installs**,
So that **my system is fully clean regardless of which version was originally installed**.

**Acceptance Criteria:**

**Given** `~/.claude/settings.json` contains bmad-hook entries across `UserPromptSubmit`, `PostToolUse`, and `SessionStart`
**When** uninstall runs
**Then** it removes only entries with command containing `bmad-hook.js` from all 3 event type arrays, preserving all other hooks
**And** creates a `.bak` backup before writing
**And** validates post-write by rereading and parsing

**Given** `~/.claude/settings.json` has bmad-hook entries only in `PostToolUse` (Phase 2 install — Skill + Read matchers)
**When** uninstall runs
**Then** it removes the matching entries from `PostToolUse` and does not error on missing `UserPromptSubmit` or `SessionStart` keys

**Given** `~/.claude/settings.json` has no bmad-hook entries in any event type
**When** uninstall runs
**Then** it skips and logs `○ skipped`

**Given** an event type array (e.g., `PostToolUse`) becomes empty after removing bmad entries
**When** uninstall runs
**Then** the empty array is left in place (not deleted) — other tools may expect the key to exist

**Given** `.claude/CLAUDE.md` contains `<!-- bmad-statusline:start -->` markers from a Phase 1 install
**When** uninstall runs
**Then** it removes the markers and content between them, logs `✓` (backward compat Phase 1)

**Given** `.claude/settings.local.json` contains permission rules matching `BMAD_PROJ_DIR`
**When** uninstall runs
**Then** it removes the matching rules, logs `✓` (backward compat Phase 1)

**Given** a system with both Phase 4 hook entries AND Phase 1 CLAUDE.md markers
**When** uninstall runs
**Then** both are cleaned in a single pass — all 3 generations handled

**Given** uninstall has already been run
**When** uninstall is run a second time
**Then** all targets show `○ skipped`, exit 0 (idempotent)

**Given** `test/uninstall.test.js`
**When** updated
**Then** it tests: (a) removal from 3 event type keys, (b) Phase 2 only removal, (c) no entries skip, (d) Phase 1 CLAUDE.md backward compat, (e) Phase 1 permissions backward compat, (f) mixed-generation cleanup, (g) idempotency, (h) preservation of non-bmad hooks

### Story 4.8: Clean — alive-based cleanup + README update

As a **developer maintaining bmad-statusline**,
I want **the clean command to use `.alive` file timestamps for session expiry decisions and the README to document the 5-signal hook architecture**,
So that **stale sessions are cleaned based on actual activity (not arbitrary timeouts) and the documentation reflects the current system**.

**Acceptance Criteria:**

**Given** `~/.cache/bmad-status/` contains `status-abc123.json` and `.alive-abc123` with mtime less than 7 days old
**When** `npx bmad-statusline clean` runs
**Then** both files are preserved — session is still alive

**Given** `~/.cache/bmad-status/` contains `status-abc123.json` and `.alive-abc123` with mtime older than 7 days
**When** `npx bmad-statusline clean` runs
**Then** both `status-abc123.json` and `.alive-abc123` are deleted and logged `✓`

**Given** `~/.cache/bmad-status/` contains `status-abc123.json` with NO corresponding `.alive-abc123`
**When** `npx bmad-statusline clean` runs
**Then** the orphaned status file is deleted — no alive file means no proof of activity

**Given** `~/.cache/bmad-status/` contains `.alive-xyz789` with NO corresponding `status-xyz789.json`
**When** `npx bmad-statusline clean` runs
**Then** the orphaned alive file is deleted

**Given** `src/clean.js` source code
**When** inspected
**Then** it uses `ALIVE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000` and checks `.alive` mtime via `fs.statSync(alivePath).mtimeMs`

**Given** `~/.cache/bmad-status/` is empty or does not exist
**When** clean runs
**Then** it logs `○ nothing to clean` and exits 0

**Given** `test/clean.test.js`
**When** updated
**Then** it tests: (a) alive + fresh → preserved, (b) alive + expired → deleted, (c) status without alive → deleted, (d) alive without status → deleted, (e) empty cache dir, (f) ALIVE_MAX_AGE_MS boundary

**Given** `README.md`
**When** updated
**Then** it describes the 5-signal hook architecture (UserPromptSubmit, Read, Write, Edit, SessionStart) instead of the dual-signal approach
**And** documents multi-module support (bmad/gds/wds)
**And** documents story intelligence (3-level priority)
**And** install/uninstall documentation reflects the 5-matcher config across 3 event types
**And** clean documentation describes alive-based expiry with 7-day retention

### Story 2.4: Reader health check indicator

As a **developer using BMAD statusline**,
I want **a `health` command in the reader that shows whether the status file is actively being updated**,
So that **I can tell at a glance if the hook is working or if the status data is stale**.

**Acceptance Criteria:**

**Given** the reader is called with command `health`
**When** the status file `updated_at` timestamp is less than 60 seconds old
**Then** the output is `●` (green dot, ANSI green)

**Given** the reader is called with command `health`
**When** the status file `updated_at` timestamp is between 60 and 300 seconds old
**Then** the output is `●` (yellow dot, ANSI yellow)

**Given** the reader is called with command `health`
**When** the status file `updated_at` is older than 300 seconds or missing
**Then** the output is `○` (dim dot, ANSI brightBlack)

**Given** the reader is called with command `health`
**When** no status file exists for the session
**Then** the output is an empty string

**Given** the `health` command implementation
**When** inspected
**Then** it uses the `colorize()` helper with appropriate ANSI codes, consistent with existing reader patterns

**Given** `test/reader.test.js`
**When** updated
**Then** it tests the three health states (fresh, stale, expired) using fixture status files with controlled `updated_at` timestamps

## Epic 3: Pivot hook passif bmad-statusline

Le développeur bénéficie d'un tracking BMAD 100% passif via hook — zéro friction LLM, install/uninstall gèrent le hook automatiquement, le TUI reflète les widgets simplifiés, et le code mort de l'ancienne approche est nettoyé.

### Story 3.1: Hook script — détection passive via PostToolUse

As a **developer using BMAD workflows**,
I want **a PostToolUse hook that passively detects workflow, step, and story changes from Claude Code events**,
So that **my BMAD status is tracked automatically with zero LLM friction**.

**Acceptance Criteria:**

**Given** the hook receives a Skill event with `tool_input.skill = "bmad-create-architecture"`
**When** `{cwd}/.claude/skills/bmad-create-architecture/steps/` exists and no active workflow is set
**Then** the status file sets `workflow: "create-architecture"`, `step.total` to the count of `step-*.md` files, and sets `started_at` to now

**Given** the active workflow is already `create-architecture`
**When** the hook receives a new Skill event for `bmad-create-architecture`
**Then** `started_at` is preserved (not reset) — only resets when workflow name changes

**Given** the hook receives a Skill event with `tool_input.skill = "bmad-help"`
**When** `{cwd}/.claude/skills/bmad-help/steps/` does NOT exist
**Then** the hook ignores the event entirely and preserves the current status

**Given** an active workflow `create-architecture` is set
**When** the hook receives a Read event for `{cwd}/.claude/skills/bmad-create-architecture/steps/step-03-starter.md`
**Then** the status file sets `step.current: 3`, `step.current_name: "starter"`, and derives `step.next: 4`, `step.next_name` from the next file in the steps listing

**Given** an active workflow with 8 steps
**When** the hook receives a Read event for the last step (`step-08-*.md`)
**Then** the status file sets `step.current: 8` and `step.next: null`, `step.next_name: null`

**Given** an active workflow `create-architecture` is set
**When** the hook receives a Read event for a step file belonging to a DIFFERENT skill's steps directory
**Then** the hook ignores the event (false positive prevention)

**Given** the active workflow is `dev-story`
**When** the hook receives a Read event for a stories file
**Then** the status file sets `story` to the slug parsed from the filename

**Given** the active workflow is `create-architecture` (not in story-tracking list)
**When** the hook receives a Read event for a stories file
**Then** the hook ignores the event

**Given** the hook receives a Read event for `_bmad/bmm/config.yaml`
**When** the file content in `tool_response.file.content` contains `project_name: 'Toulou'`
**Then** the status file sets `project: "Toulou"` with zero additional I/O

**Given** the hook receives any event
**When** `{cwd}/_bmad/` does not exist
**Then** the hook exits silently with no output and no status file written

**Given** the hook receives a Read event for any non-BMAD path
**When** the path doesn't match any detection pattern
**Then** the hook exits silently

**Given** no status file exists for the current session
**When** the first BMAD event fires
**Then** the hook creates `~/.cache/bmad-status/status-{session_id}.json` with defaults and `mkdirSync(CACHE_DIR, { recursive: true })`

**Given** a status file already exists
**When** a new event fires
**Then** the hook reads the existing file, merges only the changed fields, writes back, and sets `updated_at` to the current ISO 8601 timestamp

**Given** stdin contains malformed JSON
**When** the hook attempts to parse
**Then** it exits silently with exit code 0, no output to stdout or stderr

**Given** `tool_input.file_path` uses forward slashes and `cwd` uses backslashes
**When** the hook processes paths
**Then** all paths are normalized to forward slashes before any pattern matching

**Given** the `BMAD_CACHE_DIR` environment variable is set
**When** the hook writes a status file
**Then** it uses the env var path instead of the default `~/.cache/bmad-status/`

**Given** the hook source code
**When** inspected
**Then** it follows: Requires → Constants → Stdin parsing (try/catch → silent exit) → Guard (`_bmad/`) → Dispatch (branch on `tool_name`) → Handlers → Status helpers → Main

### Story 3.2: Reader simplification — composites et extractors

As a **developer using BMAD statusline**,
I want **the reader to display simplified composites without the removed fields (agent, request, document)**,
So that **the statusline shows only hook-derivable information with no stale or empty widgets**.

**Acceptance Criteria:**

**Given** the reader is called with command `agent`, `request`, or `document`
**When** these commands are invoked
**Then** they are not present in the COMMANDS map and the reader returns an empty string

**Given** the reader source code
**When** inspected
**Then** `AGENT_COLORS` map is removed from the reader (dead code — agent extractor no longer exists). Only `WORKFLOW_COLORS` and `WORKFLOW_PREFIX_COLORS` remain.

**Given** the reader is called with command `compact`
**When** the status file contains project, workflow, story, and step data
**Then** the output is `project · workflow(colored) · progressstep · story` with uncolored ` · ` separators

**Given** the reader is called with command `full`
**When** the status file contains all fields
**Then** the output is `project · workflow(colored) · progressstep · story · timer`

**Given** the reader is called with command `minimal`
**When** the status file contains workflow and step data
**Then** the output is `workflow(colored) · progressstep`

**Given** a composite command is called
**When** any segment field is null or empty
**Then** that segment is omitted and separators adjust (no double separators, no trailing separator)

**Given** the status file uses the new schema with `step.current` (number) and no `step.completed` field
**When** the reader calculates progress
**Then** it uses `(step.current - 1) / step.total` for progress ratio (reading step N means N-1 is completed)

**Given** the reader is called with command `progressstep`
**When** `step.current: 3`, `step.current_name: "starter"`, `step.total: 8`
**Then** the output is `2/8 starter` (completed = current - 1)

**Given** the reader is called with command `progressbar`
**When** `step.current: 1`, `step.total: 6`
**Then** completed = 0, the progressbar shows all empty segments (no progress yet)

**Given** the status file has `step.current: 0` or `step` is missing/null
**When** the reader calculates progress
**Then** it returns a safe fallback (empty string or 0/total), never throws

**Given** the reader helper `getStoryOrRequest()`
**When** called
**Then** it returns `status.story || ''` (request field no longer exists in schema)

**Given** the reader is called with any of: `project`, `workflow`, `step`, `nextstep`, `progress`, `progressbar`, `progressstep`, `story`, `timer`
**When** the status file contains valid data
**Then** each returns the correct formatted output, with `workflow` colorized via WORKFLOW_COLORS

**Given** `WORKFLOW_COLORS` keys in `src/reader/bmad-sl-reader.js` and `src/defaults.js`
**When** the sync test compares both sets
**Then** the workflow category lists match exactly (agent color maps remain for reference but sync test scope reduced to workflow only)

**Given** `test/fixtures/status-sample.json`
**When** updated for this story
**Then** it uses the new schema: `step.current` (number), no `step.completed`, no `agent`, no `request`, no `document` fields

### Story 3.3: defaults.js pivot — hook config export

As a **bmad-statusline maintainer**,
I want **defaults.js to export hook configuration instead of CLAUDE.md block and permission rules**,
So that **the install command can inject the hook config into `~/.claude/settings.json`**.

**Acceptance Criteria:**

**Given** `src/defaults.js`
**When** inspected
**Then** `generateClaudeMdBlock()`, `generateClaudeMdBlockPatched()`, and `getPermissionRules()` are removed

**Given** `getHookConfig(hookPath)` is called with a hook script path
**When** it returns
**Then** the result is the hook configuration object with two PostToolUse matchers (Skill + Read), each pointing to `node "{hookPath}"`

**Given** the returned hook config
**When** serialized to JSON
**Then** it matches the format: `{ hooks: { PostToolUse: [{ matcher: "Skill", hooks: [{ type: "command", command: "node {hookPath}" }] }, { matcher: "Read", hooks: [...] }] } }`

**Given** `src/defaults.js`
**When** inspected
**Then** `getStatusLineConfig()`, `getWidgetDefinitions(readerPath)`, `AGENT_COLORS`, `WORKFLOW_COLORS`, and `WORKFLOW_PREFIX_COLORS` remain unchanged

**Given** `test/defaults.test.js`
**When** updated
**Then** it tests `getHookConfig()` output structure and removes tests for the deleted exports

### Story 3.4: Install pivot — hook targets

As a **developer setting up BMAD statusline**,
I want **`npx bmad-statusline install` to inject the hook config and deploy the hook script instead of writing CLAUDE.md instructions and permission rules**,
So that **status tracking works passively via hook without any per-project LLM instructions**.

**Acceptance Criteria:**

**Given** `~/.claude/settings.json` exists without hook entries for `bmad-hook.js`
**When** install runs
**Then** it merges the two PostToolUse matchers (Skill + Read) into `hooks.PostToolUse`, preserving any existing hooks

**Given** `~/.claude/settings.json` has no `hooks` key, or `hooks` has no `PostToolUse` key
**When** install runs
**Then** it creates the missing structure (`hooks.PostToolUse` array) before injecting matchers
**And** creates a `.bak` backup before writing
**And** validates post-write by rereading and parsing

**Given** `~/.claude/settings.json` already contains hook entries with command matching `bmad-hook.js`
**When** install runs
**Then** it skips hook injection and logs `○ skipped`

**Given** `~/.config/bmad-statusline/bmad-hook.js` does not exist
**When** install runs
**Then** it copies `src/hook/bmad-hook.js` to `~/.config/bmad-statusline/bmad-hook.js`

**Given** hook script already exists at destination
**When** install runs
**Then** it always overwrites with the latest version and logs `✓ updated`

**Given** install runs
**When** processing targets
**Then** there is no CLAUDE.md block injection (target removed)
**And** there is no `settings.local.json` permission rules injection (target removed)

**Given** install has already been run successfully
**When** install is run a second time
**Then** hook config shows `○ skipped`, hook script shows `✓ updated` (always deploy latest), no duplication of matchers in `hooks.PostToolUse`

**Given** install runs
**When** processing statusLine config (target 1), ccstatusline widgets (target 2), reader deployment (target 3), cache dir (target 4)
**Then** these targets behave identically to the pre-pivot install

**Given** `test/install.test.js`
**When** updated
**Then** it tests hook config injection, idempotency, and uses new fixture `claude-settings-with-hooks.json`
**And** removes tests for CLAUDE.md block and permission rules injection

### Story 3.5: Uninstall pivot — hook removal + backward compat

As a **developer removing BMAD statusline**,
I want **`npx bmad-statusline uninstall` to remove hook config and hook script, plus clean up old CLAUDE.md markers from previous installs**,
So that **my system is fully clean regardless of which version was installed**.

**Acceptance Criteria:**

**Given** `~/.claude/settings.json` contains PostToolUse entries with command matching `bmad-hook.js`
**When** uninstall runs
**Then** it removes only the matching entries from `hooks.PostToolUse`, preserving all other hooks
**And** creates a `.bak` backup before writing
**And** validates post-write

**Given** `~/.claude/settings.json` has no bmad-hook entries
**When** uninstall runs
**Then** it skips and logs `○ skipped`

**Given** `~/.config/bmad-statusline/bmad-hook.js` exists
**When** uninstall runs
**Then** it deletes the file (reader cleanup is unchanged — entire directory deleted)

**Given** `.claude/CLAUDE.md` contains `<!-- bmad-statusline:start -->` markers from a previous install
**When** uninstall runs
**Then** it removes the markers and content between them, logs `✓`

**Given** `.claude/CLAUDE.md` has no markers
**When** uninstall runs
**Then** it skips and logs `○ skipped`

**Given** `.claude/settings.local.json` contains rules matching `BMAD_PROJ_DIR`
**When** uninstall runs
**Then** it removes the matching rules, logs `✓`

**Given** `~/.claude/settings.json` has hook entries AND `.claude/CLAUDE.md` has old markers from a previous version
**When** uninstall runs
**Then** both are cleaned in a single pass — hook entries removed AND old markers removed

**Given** uninstall has already been run
**When** uninstall is run a second time
**Then** all targets show `○ skipped`, exit 0

**Given** `test/uninstall.test.js`
**When** updated
**Then** it tests hook config removal, backward compat for old markers and permission rules, and idempotency

### Story 3.6: TUI adaptation — widgets simplifiés

As a **developer using the TUI configurator**,
I want **the TUI to reflect the simplified widget set (no agent/request/document) and the new status schema**,
So that **the configurator only shows widgets that actually produce output**.

**Acceptance Criteria:**

**Given** `INDIVIDUAL_WIDGETS` in widget-registry.js
**When** inspected
**Then** `bmad-agent`, `bmad-request`, and `bmad-document` entries are removed

**Given** `coloredExtractors` in `buildWidgetConfig()`
**When** inspected
**Then** only `'workflow'` remains (agent removed)

**Given** `COMPOSITE_WIDGETS` descriptions
**When** inspected
**Then** `full` description is updated to `'Project + workflow + progressstep + story + timer'` (no agent)

**Given** `PREVIEW_DATA` in app.js
**When** inspected
**Then** `agent`, `request`, and `document` fields are removed
**And** `step` uses the new schema: `{ current: 3, current_name: 'color modes', total: 6 }` (no `completed`)

**Given** `renderWidgetText()`
**When** inspected
**Then** cases for `agent`, `request`, and `document` are removed

**Given** `renderComposite('full')`
**When** called
**Then** it renders `project · workflow · progressstep · story · timer` (no agent segment)

**Given** `getAgentInkColor()` and `renderAgentSegment()`
**When** inspected
**Then** both functions are removed

**Given** the `AGENT_COLORS` import from `../defaults.js`
**When** inspected
**Then** the import is removed (no longer needed by app.js)

**Given** `getAgentColors()` export in widget-registry.js
**When** inspected
**Then** it is removed along with its `AGENT_COLORS` import from defaults.js

**Given** all `statusData.step.completed` references in app.js
**When** updated
**Then** they use `statusData.step.current - 1` for progress display

**Given** `test/tui-widget-registry.test.js`
**When** updated
**Then** references to `bmad-agent` widget assertions are removed and `coloredExtractors` test reflects workflow-only

### Story 3.7: CLI cleanup + dead code + README

As a **bmad-statusline maintainer**,
I want **all dead code from the old LLM-write approach removed and the README updated**,
So that **the codebase is clean and the documentation reflects the hook-based architecture**.

**Acceptance Criteria:**

**Given** `bin/cli.js`
**When** inspected
**Then** the `patch-init` route and its `--revert` flag handling are removed
**And** the USAGE text no longer lists `patch-init`

**Given** the following files exist
**When** this story is completed
**Then** they are deleted: `src/patch-init.js`, `test/patch-init.test.js`, `test/fixtures/bmad-init-original.py`

**Given** `test/cli.test.js`
**When** updated
**Then** tests for the `patch-init` route are removed

**Given** `README.md`
**When** updated
**Then** it describes the hook-based approach (passive PostToolUse extraction) instead of the LLM-write approach
**And** install/uninstall documentation reflects the new hook targets
**And** `patch-init` command is removed from CLI documentation

**Given** all remaining source files
**When** inspected
**Then** no file imports from `src/patch-init.js` or references `generateClaudeMdBlock`/`generateClaudeMdBlockPatched`/`getPermissionRules`

## Epic 5: TUI Redesign — Modal Navigation, Widget Configuration, Layout & Presets

The developer can launch the redesigned TUI (`npx bmad-statusline`), navigate a modal tree of configuration screens with breadcrumb orientation and dual-pattern live preview, fully configure individual widgets (visibility, color mode, fixed color), reorder widgets, choose target line, customize separator, manage presets (save/load/delete), and reset to original. Replaces the current 693-line dashboard with a modular screen-per-decision architecture.

### Story 5.1: App shell + shared components + Home screen

As a **developer using bmad-statusline**,
I want **a redesigned TUI with modal navigation, dual-pattern preview, and a Home screen with clear configuration options**,
So that **I can launch the configurator and understand all available actions at a glance, replacing the confusing 6-section dashboard**.

**Acceptance Criteria:**

**Given** the developer runs `npx bmad-statusline` (no arguments)
**When** the TUI launches with an existing config file
**Then** the Home screen displays:
- Breadcrumb showing `Home` (dim grey text)
- Title "bmad-statusline configurator" (bold)
- Select list with 6 options: Widgets, Presets, Widget Order, Target Line, Separator Style, Reset to original
- Dual preview lines labeled "Complete:" and "Steps:" rendered with actual ANSI colors from config
- Shortcut bar: `↑↓ Navigate  Enter Select  q Quit` (dim text, bold keys)

**Given** the Home screen is displayed
**When** the developer presses `q`
**Then** the TUI exits cleanly to the terminal

**Given** the Home screen is displayed
**When** the developer presses Enter on any option (except Reset to original)
**Then** the screen transitions to the corresponding screen (placeholder for screens not yet built — display screen title with Escape to go back)

**Given** the TUI launches
**When** a config snapshot is taken
**Then** the full current config state is stored in memory for Reset to original (deep copy, not reference)

**Given** no config file exists (first launch)
**When** the TUI launches
**Then** the Default preset is loaded automatically and the Home screen displays with default configuration

**Given** the config file is corrupted (invalid JSON)
**When** the TUI launches
**Then** the Default preset is loaded and a StatusMessage with type="error" explains the fallback
**And** the StatusMessage persists until the developer presses any key

**Given** a config write fails (I/O error)
**When** the error occurs
**Then** a StatusMessage "Could not save configuration. Press any key." is displayed
**And** React state retains the new value (no data loss)
**And** the next write operation silently retries

**Given** the ScreenLayout component
**When** rendered on any screen
**Then** it enforces the vertical structure: breadcrumb → empty line → title → empty line → content area → empty line → Preview Complete → Preview Steps → empty line → shortcut bar

**Given** the DualPreview component with current config
**When** rendered
**Then** it displays "Complete:" (story workflow pattern with all visible widgets) and "Steps:" (step-only pattern) with actual ANSI colors and configured separator

**Given** the new app.js architecture
**When** inspected
**Then** it replaces the old 693-line dashboard with a screen router managing navigation state (current screen + navigation stack for Escape back-tracking)
**And** config-loader.js and config-writer.js are reused

**Given** `test/tui-*.test.js`
**When** updated for this story
**Then** tests cover: (a) ScreenLayout renders all structural elements, (b) Breadcrumb renders path with dim style, (c) DualPreview renders both pattern lines with correct widgets, (d) ShortcutBar renders actions with correct styles, (e) Home screen renders 6 options, (f) q quits, (g) first launch loads Default, (h) corrupted config shows StatusMessage fallback

### Story 5.2: Widgets List screen with inline status and visibility toggle

As a **developer configuring the statusline**,
I want **to see all 9 widgets with their current status and quickly toggle visibility without entering sub-screens**,
So that **I can scan my widget configuration at a glance and hide/show widgets with a single keypress**.

**Acceptance Criteria:**

**Given** the Home screen is displayed
**When** the developer presses Enter on "Widgets"
**Then** the Widgets List screen displays:
- Breadcrumb: `Home > Widgets`
- Title: "Select a widget to configure"
- 9 widgets: project, workflow, step, nextstep, progress, progressbar, progressstep, story, timer
- Each with inline status: `■ visible` or `□ hidden` + color mode text (e.g. "dynamic", "red")
- Shortcut bar: `↑↓ Navigate  Enter Configure  h Hide/Show  Esc Back`

**Given** the Widgets List screen is displayed
**When** the developer navigates to a visible widget and presses `h`
**Then** the widget toggles to hidden (`□ hidden`)
**And** the DualPreview updates immediately to exclude the widget
**And** the config is persisted to file

**Given** the Widgets List screen is displayed
**When** the developer navigates to a hidden widget and presses `h`
**Then** the widget toggles to visible (`■ visible`)
**And** the DualPreview updates immediately to include the widget
**And** the config is persisted to file

**Given** the Widgets List screen is displayed
**When** the developer presses Enter on a widget
**Then** the screen transitions to the Widget Detail screen for that widget

**Given** the Widgets List screen is displayed
**When** the developer presses Escape
**Then** the screen returns to Home

**Given** a widget with color mode "fixed" and color "red"
**When** the Widgets List renders
**Then** the inline status shows `red` (not "fixed")

**Given** `test/tui-*.test.js`
**When** updated for this story
**Then** tests cover: (a) renders 9 widgets with correct inline status, (b) h toggles visibility and updates preview, (c) Enter navigates to Widget Detail, (d) Escape returns to Home, (e) inline status reflects color mode correctly

### Story 5.3: Widget Detail + Color Mode + Color Picker screens

As a **developer configuring a specific widget**,
I want **to change its color mode and pick a fixed ANSI color with live preview showing the result before I commit**,
So that **I can fine-tune each widget's appearance with confidence, seeing the exact result in the preview**.

**Acceptance Criteria:**

**Given** the developer presses Enter on "timer" in the Widgets List
**When** the Widget Detail screen loads
**Then** it displays:
- Breadcrumb: `Home > Widgets > timer`
- Title: "timer configuration"
- Select with 2 options: "Color Mode" (showing current value) and "Visibility" (showing current state)
- Shortcut bar: `↑↓ Navigate  Enter Select  Esc Back`

**Given** the Widget Detail screen is displayed
**When** the developer presses Enter on "Visibility"
**Then** the visibility toggles immediately, DualPreview updates, and config is persisted

**Given** the Widget Detail screen is displayed
**When** the developer presses Enter on "Color Mode"
**Then** the Color Mode screen displays:
- Breadcrumb: `Home > Widgets > timer > Color Mode`
- Title: "Choose color mode for timer"
- Select: "dynamic" ("Color changes with workflow") and "fixed" ("Choose a fixed color")

**Given** the Color Mode screen is displayed
**When** the developer highlights "dynamic" or "fixed" with arrow keys
**Then** the DualPreview updates temporarily to show the highlighted option's effect (try-before-you-buy)

**Given** the Color Mode screen is displayed
**When** the developer presses Enter on "dynamic"
**Then** the color mode is set to dynamic, config is persisted, screen returns to Widget Detail showing updated value

**Given** the Color Mode screen is displayed
**When** the developer presses Enter on "fixed"
**Then** the Color Picker screen displays:
- Breadcrumb: `Home > Widgets > timer > Color Mode > Fixed`
- Title: "Choose color for timer"
- Select with 14 ANSI colors: red, green, yellow, blue, magenta, cyan, white, brightRed, brightGreen, brightYellow, brightBlue, brightMagenta, brightCyan, brightWhite

**Given** the Color Picker screen is displayed
**When** the developer highlights a color with arrow keys
**Then** the DualPreview updates temporarily to show the widget in the highlighted color

**Given** the Color Picker screen is displayed
**When** the developer presses Enter on a color (e.g. "red")
**Then** the color is persisted, the screen returns to the Color Mode screen, and the DualPreview shows the committed color

**Given** the Color Picker screen is displayed
**When** the developer presses Escape
**Then** the DualPreview reverts to the last persisted value and the screen returns to Color Mode

**Given** any screen at depth 2+
**When** the developer presses Escape
**Then** the screen goes back exactly one level and the breadcrumb updates accordingly

**Given** `test/tui-*.test.js`
**When** updated for this story
**Then** tests cover: (a) Widget Detail renders for any widget with correct values, (b) Color Mode renders dynamic/fixed, (c) Color Picker renders 14 colors, (d) try-before-you-buy: highlight updates preview temporarily, (e) Enter persists and navigates correctly, (f) Escape reverts preview and goes back one level, (g) breadcrumb correct at all 4 depth levels

### Story 5.4: Target Line + Separator Style + Reset to original

As a **developer customizing the statusline layout**,
I want **to choose which terminal line the status bar occupies, customize the separator between widgets, and reset all changes to the original launch state**,
So that **I can control the visual layout of my statusline and safely experiment knowing I can revert everything**.

**Acceptance Criteria:**

**Given** the Home screen is displayed
**When** the developer presses Enter on "Target Line"
**Then** the Target Line screen displays:
- Breadcrumb: `Home > Target Line`
- Title: "Choose which status bar line to use"
- Select with 3 options: "Line 0 (top)", "Line 1 (middle)", "Line 2 (bottom)"
- Current selection highlighted
- Shortcut bar: `↑↓ Navigate  Enter Select  Esc Back`

**Given** the Target Line screen is displayed
**When** the developer highlights a line option with arrow keys
**Then** the DualPreview updates temporarily to reflect the highlighted target line (try-before-you-buy)

**Given** the Target Line screen is displayed
**When** the developer presses Enter on a line option
**Then** the target line is persisted to config and the DualPreview shows the committed value

**Given** the Target Line screen is displayed
**When** the developer presses Escape
**Then** the DualPreview reverts to the last persisted value and the screen returns to Home

**Given** the Home screen is displayed
**When** the developer presses Enter on "Separator Style"
**Then** the Separator Style screen displays:
- Breadcrumb: `Home > Separator Style`
- Title: "Choose separator between widgets"
- Select with 4 options showing preview of each: "tight" (`myproject┃dev-story`), "moderate" (`myproject ┃ dev-story`), "wide" (`myproject  ┃  dev-story`), "custom" ("Enter custom separator string")
- Shortcut bar: `↑↓ Navigate  Enter Select  Esc Back`

**Given** the Separator Style screen is displayed
**When** the developer highlights a separator option with arrow keys
**Then** the DualPreview updates temporarily with the highlighted separator style

**Given** the Separator Style screen is displayed
**When** the developer presses Enter on "tight", "moderate", or "wide"
**Then** the separator is persisted to config and the DualPreview shows the committed separator

**Given** the Separator Style screen is displayed
**When** the developer presses Enter on "custom"
**Then** a TextInput appears pre-filled with the current separator value
**And** Enter confirms and persists the custom separator
**And** Escape cancels and discards the input

**Given** the Home screen is displayed
**When** the developer presses Enter on "Reset to original"
**Then** the config snapshot taken at TUI launch is restored to the config file
**And** the DualPreview updates to show the original configuration
**And** the Home screen remains displayed (user can continue editing)

**Given** `test/tui-*.test.js`
**When** updated for this story
**Then** tests cover: (a) Target Line renders 3 options with correct selection, (b) Separator Style renders 4 options with inline preview text, (c) custom separator TextInput pre-fills current value, (d) try-before-you-buy on both screens, (e) Reset restores launch snapshot and updates preview, (f) Escape reverts and returns to Home

### Story 5.5: Widget Order screen with ReorderList

As a **developer customizing widget display order**,
I want **to grab, move, and drop widgets in the sequence I prefer using a dual-mode keyboard interaction**,
So that **my statusline displays widgets in the exact order I want, with live preview showing the result of each move**.

**Acceptance Criteria:**

**Given** the Home screen is displayed
**When** the developer presses Enter on "Widget Order"
**Then** the Widget Order screen displays:
- Breadcrumb: `Home > Widget Order`
- Title: "Reorder widgets (move selected widget)"
- Numbered list of visible widgets in current order
- Shortcut bar (navigate state): `↑↓ Navigate  Enter Grab  Esc Back`

**Given** the Widget Order screen in navigate state
**When** the developer presses Enter on a widget
**Then** the widget enters moving state:
- The grabbed widget shows a visual marker (`← moving`, bold or inverted)
- Shortcut bar changes to: `↑↓ Move  Enter Drop  Esc Cancel`

**Given** the Widget Order screen in moving state
**When** the developer presses ↑ or ↓
**Then** the grabbed widget moves up or down in the list
**And** the DualPreview updates on each position change to show the new order

**Given** the Widget Order screen in moving state
**When** the developer presses Enter
**Then** the widget is dropped at its current position
**And** the new order is persisted to config
**And** the screen returns to navigate state with updated shortcut bar

**Given** the Widget Order screen in moving state
**When** the developer presses Escape
**Then** the widget returns to its original position (before grab)
**And** the DualPreview reverts to the persisted order
**And** the screen returns to navigate state

**Given** the Widget Order screen in navigate state
**When** the developer presses Escape
**Then** the screen returns to Home

**Given** the ReorderList component
**When** inspected
**Then** it uses `useInput` hook with internal state toggle (navigate/moving), not @inkjs/ui Select (Select does not support grab/move semantics)

**Given** `test/tui-*.test.js`
**When** updated for this story
**Then** tests cover: (a) renders visible widgets in numbered list, (b) Enter grabs widget and switches to moving state, (c) ↑↓ moves widget and updates preview, (d) Enter drops and persists, (e) Escape cancels and reverts position, (f) shortcut bar changes between states, (g) Escape in navigate state returns to Home

### Story 5.6: Presets screen with ConfirmDialog

As a **developer managing statusline configurations**,
I want **to save my current configuration to named presets, load them instantly, and delete unused ones**,
So that **I can quickly switch between different statusline setups for different workflows without reconfiguring from scratch**.

**Acceptance Criteria:**

**Given** the Home screen is displayed
**When** the developer presses Enter on "Presets"
**Then** the Presets screen displays:
- Breadcrumb: `Home > Presets`
- Title: "Load or manage configuration presets"
- Select with 4 entries: "Default" (factory defaults), "Custom 1", "Custom 2", "Custom 3"
- Saved presets show their name (e.g. `Custom 1  dev-focus (saved)`), empty slots show `(empty)` in dim text
- Shortcut bar: `↑↓ Navigate  Enter Load  s Save current here  d Delete  Esc Back`

**Given** the Presets screen is displayed
**When** the developer presses Enter on "Default"
**Then** the factory default configuration is loaded, applied to config, persisted to file
**And** the DualPreview updates immediately to show the default configuration

**Given** the Presets screen is displayed
**When** the developer presses Enter on a saved custom preset (e.g. "Custom 1 dev-focus")
**Then** the preset's complete snapshot is loaded (widgets visibility + colors, order, target line, separator)
**And** the config is persisted and the DualPreview updates

**Given** the Presets screen is displayed with the cursor on an empty slot
**When** the developer presses `s`
**Then** a TextInput appears for the preset name
**And** Enter confirms: the current config is saved to that slot with the given name, no confirmation needed
**And** Escape cancels the save

**Given** the Presets screen is displayed with the cursor on a saved preset
**When** the developer presses `s`
**Then** a ConfirmDialog appears: "Overwrite Custom 1 (dev-focus)? Enter / Esc"
**And** Enter overwrites the preset with the current config
**And** Escape cancels, no change

**Given** the Presets screen is displayed with the cursor on a saved custom preset
**When** the developer presses `d`
**Then** the preset is deleted, the slot shows `(empty)` in dim text

**Given** the Presets screen is displayed with the cursor on "Default"
**When** the developer presses `d`
**Then** nothing happens — the Default preset cannot be deleted

**Given** the Presets screen is displayed
**When** the developer presses Escape
**Then** the screen returns to Home

**Given** the ConfirmDialog component
**When** visible
**Then** it replaces the current screen content with the confirmation message and Enter/Esc options

**Given** `test/tui-*.test.js`
**When** updated for this story
**Then** tests cover: (a) renders 4 preset entries with correct status (saved/empty), (b) Enter loads preset and updates config + preview, (c) s on empty slot opens TextInput, (d) s on saved slot shows ConfirmDialog, (e) d deletes custom preset, (f) d on Default is ignored, (g) ConfirmDialog Enter/Esc behavior, (h) Escape returns to Home

## Epic 6: TUI v2 — Multi-Line Configuration, 3-Line Preview, Presets & Per-Line Deployment

Le développeur peut lancer le TUI v2 redesigné (`npx bmad-statusline`), configurer des widgets individuels indépendamment sur chacune des 3 lignes ccstatusline (visibilité, couleur, ordre), voir une preview 3 lignes boxée en temps réel avec couleurs ANSI, sauvegarder/charger des presets par ligne depuis un pool partagé, réordonner les lignes par swap, et bénéficier d'un reader amélioré (commande `line N`, story name formatting, couleurs workflow complètes). L'installer déploie un composite par ligne non-vide, avec upgrade path v1→v2 automatique.

### Story 6.1: Foundation — Internal config schema, widget registry defaults, dead code removal

As a **bmad-statusline developer**,
I want **the internal config schema defined, widget defaults enriched, dead code from TUI v1 removed, and shared preview utilities created**,
So that **all subsequent stories build on a clean codebase with the foundational data structures in place**.

**Acceptance Criteria:**

**Given** `widget-registry.js` contains `COMPOSITE_WIDGETS`, `getCompositeWidgets()`, `buildWidgetConfig()`, `applyColorMode()`
**When** dead code removal is applied
**Then** all four are deleted, no remaining imports or references in any file
**And** `INDIVIDUAL_WIDGETS` is preserved and enriched with `defaultColor` and `defaultMode` per widget (project=cyan/fixed, workflow=dynamic, step=yellow/fixed, nextstep=yellow/fixed, progress=green/fixed, progressbar=green/fixed, progressstep=brightCyan/fixed, story=magenta/fixed, timer=brightBlack/fixed)
**And** `SEPARATOR_STYLES` and `getIndividualWidgets()` are preserved

**Given** the TUI v1 screens and components that are replaced in v2
**When** dead code removal is applied
**Then** the following files are deleted: `DualPreview.js`, `WidgetDetailScreen.js`, `ColorModeScreen.js`, `TargetLineScreen.js`, `WidgetsListScreen.js`, `WidgetOrderScreen.js`, `PlaceholderScreen.js`, `PresetsScreen.js`
**And** `SelectWithPreview.js` is evaluated — kept if its `onHighlight` callback supports preview-override pattern, deleted otherwise
**And** all imports/references to deleted files are removed from `app.js` and any other consuming files

**Given** the Architecture Rev.3 internal config schema
**When** a `createDefaultConfig()` function is implemented in `config-loader.js` or a shared utility
**Then** it returns a valid default config object: separator `"serre"`, customSeparator `null`, 3 lines (line 0 with all default-enabled widgets + colorModes, lines 1-2 empty), presets `[null, null, null]`
**And** default-enabled widgets for line 0 are: `bmad-project`, `bmad-workflow`, `bmad-progressstep`, `bmad-story`, `bmad-timer`

**Given** the need for shared preview logic across TUI components
**When** `src/tui/preview-utils.js` is created
**Then** it exports `SAMPLE_VALUES` (9 widget sample strings), `resolvePreviewColor(widgetId, colorModes)`, `WORKFLOW_SAMPLE_COLOR` constant, and `SEPARATOR_MAP` for preview rendering
**And** `resolvePreviewColor` returns: widget default color if no colorModes entry, `WORKFLOW_SAMPLE_COLOR` if mode=dynamic, `fixedColor` if mode=fixed

**Given** tests need to validate the changes
**When** tests are executed
**Then** `tui-widget-registry.test.js` is updated: tests for deleted functions removed, new tests for `defaultColor`/`defaultMode` on each of the 9 widgets
**And** `tui-preview-utils.test.js` is created: tests for `resolvePreviewColor` (dynamic, fixed, fallback to default), `SAMPLE_VALUES` has all 9 keys
**And** new fixtures `internal-config-default.json` and `internal-config-multiline.json` are created in `test/fixtures/`
**And** all existing tests pass (`npm test`)

### Story 6.2: Reader — `line N` command, story name formatting, workflow colors, remove legacy composites

As a **developer using ccstatusline with bmad-statusline**,
I want **the reader to support a `line N` command that outputs composed widgets for a specific line from the internal config, format story names readably, and display all workflows with visible distinct colors**,
So that **ccstatusline displays my multi-line configuration correctly with readable story names and no invisible workflow colors**.

**Acceptance Criteria:**

**Given** the reader receives `argv[2] = "line"` and `argv[3] = "0"`
**When** the internal config exists at `BMAD_CONFIG_DIR/config.json` with visible widgets on line 0
**Then** the reader reads the status file (existing pattern) AND the internal config, extracts line 0's widget list, calls each individual extractor in order, applies color per `colorModes` (dynamic = leave ANSI as-is, fixed = `colorize(value, fixedColor)`), joins non-empty segments with the configured separator, and outputs the result to stdout
**And** empty extractor results are skipped (no double separators)

**Given** the reader receives `line 1` but line 1 has no widgets in the internal config
**When** the reader processes the command
**Then** it returns an empty string (silent — no error, no output)

**Given** the internal config file is missing or corrupted
**When** the reader receives any `line N` command
**Then** it returns an empty string (silent failure — pattern 1)

**Given** `BMAD_CONFIG_DIR` env var is set
**When** the reader reads the internal config
**Then** it reads from `$BMAD_CONFIG_DIR/config.json` instead of `~/.config/bmad-statusline/config.json`

**Given** a reader separator map defined in CJS (own copy, not imported)
**When** the internal config specifies `separator: "serre"` / `"modere"` / `"large"` / `"custom"`
**Then** the reader resolves: serre=`┃`, modere=` ┃ `, large=`  ┃  `, custom=`customSeparator` value

**Given** a story slug `5-3-auth-login` in the status file
**When** the `story` individual extractor processes it
**Then** it returns `5-3 Auth Login` (numeric prefix preserved, remaining dashes→spaces, each word capitalized)
**And** `4-2-user-registration-flow` → `4-2 User Registration Flow`
**And** non-matching slugs (no `X-Y-` prefix) are returned as-is

**Given** `WORKFLOW_COLORS` in the reader
**When** all workflow entries are reviewed
**Then** no workflow has `white` as its color (use `brightWhite` or another visible color)
**And** `document-project` and `generate-project-context` are changed from white to a visible color
**And** `create-story`, `dev-story`, `code-review` have clearly distinct colors
**And** the same color assignments are applied in `defaults.js` `WORKFLOW_COLORS`
**And** the existing sync test (color maps in reader vs defaults) passes

**Given** the reader currently handles `compact`, `full`, `minimal` commands
**When** those handlers are removed
**Then** calling the reader with `compact`, `full`, or `minimal` falls through to empty output (existing default for unknown commands)
**And** all individual widget commands (`project`, `workflow`, `step`, `nextstep`, `progress`, `progressbar`, `progressstep`, `story`, `timer`) remain unchanged

**Given** tests need to validate the changes
**When** tests are executed
**Then** `reader.test.js` is updated: new tests for `line 0`/`line 1`/`line 2` with fixture internal config, test for empty line, test for missing config, test for story name formatting, tests for removed composite commands returning empty
**And** `defaults.test.js` color sync test updated if workflow colors changed
**And** new fixture `internal-config-default.json` is used for reader `line N` tests (from 6.1)
**And** all existing tests pass (`npm test`)

### Story 6.3: Config system — config-loader v2, config-writer v2, migration v1→v2

As a **developer upgrading from TUI v1 or launching for the first time**,
I want **the config system to load internal multi-line config (or migrate from v1, or create defaults), persist changes to internal config, and sync ccstatusline only when line occupancy changes**,
So that **my existing configuration is preserved during upgrade, and ccstatusline always reflects the correct number of composite widgets per line**.

**Acceptance Criteria:**

**Given** `~/.config/bmad-statusline/config.json` exists with a valid v2 structure (has `lines` array of 3)
**When** config-loader loads the config
**Then** it returns the parsed config object directly, no migration needed

**Given** `config.json` does not exist but ccstatusline config contains individual `bmad-*` widgets (v1 layout)
**When** config-loader detects the v1 structure
**Then** it migrates: extracts bmad widgets from the ccstatusline line where they are found, builds line 0 with those widgets + colorModes, lines 1-2 empty, detects separator style, sets presets to `[null, null, null]`
**And** writes the migrated config as `config.json`
**And** replaces old individual `bmad-*` widgets in ccstatusline with a single `bmad-line-0` composite

**Given** neither `config.json` nor bmad widgets in ccstatusline exist (first install)
**When** config-loader runs
**Then** it calls `createDefaultConfig()` (from 6.1) and returns the default config
**And** writes the default config as `config.json`

**Given** `config.json` exists but is corrupted JSON
**When** config-loader attempts to read it
**Then** it falls back to `createDefaultConfig()` defaults without crash (NFR-V2-4)

**Given** `BMAD_CONFIG_DIR` env var is set
**When** config-loader or config-writer accesses internal config
**Then** it reads/writes at `$BMAD_CONFIG_DIR/config.json` instead of `~/.config/bmad-statusline/config.json`

**Given** `writeInternalConfig(config)` is called
**When** writing the config to disk
**Then** it creates `CONFIG_DIR` if absent (`mkdirSync recursive`), writes `JSON.stringify(config, null, 2) + '\n'`, synchronous I/O (pattern 2)
**And** no backup before write, no validation post-write (pattern 14)

**Given** `syncCcstatuslineIfNeeded(oldConfig, newConfig)` is called
**When** a line changes from empty (widgets.length === 0) to non-empty (or vice versa)
**Then** ccstatusline config is updated: add `bmad-line-N` widget for newly non-empty lines, remove `bmad-line-N` for newly empty lines
**And** ccstatusline config write follows backup/validate sequence (pattern 4)
**And** the `bmad-line-N` widget format is: `{ id: "bmad-line-N", type: "custom-command", commandPath: "node \"readerPath\" line N", preserveColors: true }`

**Given** a config change that does NOT change line emptiness (e.g., color change, widget reorder within non-empty line)
**When** `syncCcstatuslineIfNeeded` compares old and new config
**Then** no ccstatusline config write occurs

**Given** `syncCcstatuslineFromScratch(config)` is called (used by reset)
**When** rebuilding ccstatusline config
**Then** all existing `bmad-line-*` widgets are removed from ccstatusline, then one `bmad-line-N` is added per non-empty line in `config`

**Given** tests need to validate the changes
**When** tests are executed
**Then** `tui-config-loader.test.js` is updated: tests for v2 config load, v1 migration, first-install defaults, corrupted config fallback
**And** `tui-config-writer.test.js` is updated: tests for `writeInternalConfig`, `syncCcstatuslineIfNeeded` (add/remove/no-op), `syncCcstatuslineFromScratch`
**And** new fixture `ccstatusline-settings-v1.json` (legacy individual bmad-* widgets) is used for migration tests
**And** new fixture `ccstatusline-settings-with-bmad-v2.json` (bmad-line-N composites) is created
**And** all existing tests pass (`npm test`)

### Story 6.4: TUI v2 Core — App shell, state model, shared components, Home + Edit Line

As a **developer launching the TUI**,
I want **to see a 3-line preview at the top of every screen, navigate a flat Home menu with 6 options, and edit widgets per line with inline hide/show and grab-reorder shortcuts**,
So that **I can configure my multi-line statusline layout intuitively with instant visual feedback and no navigation confusion**.

**Acceptance Criteria:**

**Given** the developer runs `npx bmad-statusline` (no args)
**When** the TUI launches
**Then** `config-loader` loads the internal config (v2, migrated, or defaults — from 6.3)
**And** a snapshot is captured via `useState` initializer (`structuredClone(initialConfig)`) — immutable for the session
**And** the Home screen displays with the 3-line boxed preview at the top and 6 menu options below

**Given** the Home screen is displayed
**When** the user sees the menu
**Then** 6 options are shown: `📝 Edit widget line 1`, `📝 Edit widget line 2`, `📝 Edit widget line 3`, `🔀 Reorder lines`, `✦ Separator style`, `↩ Reset to original`
**And** the shortcut bar shows `↑↓ Navigate  Enter Select  q Quit`
**And** the breadcrumb shows `Home`

**Given** the ThreeLinePreview component renders
**When** it receives the config (or previewOverride if non-null)
**Then** it displays a boxed frame with "Preview" label, 3 lines inside showing composed widget output per line
**And** each widget is colored via `resolvePreviewColor()` from preview-utils.js (pattern 19)
**And** widgets are joined with the configured separator
**And** empty lines show blank inside the frame
**And** ANSI colors render correctly via Ink `<Text color={...}>` — not escape codes (BF3 fix)

**Given** the user selects "Edit widget line 1" from Home
**When** the Edit Line screen opens
**Then** the breadcrumb shows `Home > Edit Line 1`
**And** all 9 widgets from `INDIVIDUAL_WIDGETS` are listed (not just configured ones — BF1 fix)
**And** each widget shows inline status: `Name  ■ visible  cyan` or `Name  □ hidden  brightBlack`
**And** visible widgets appear in their config order, followed by hidden widgets
**And** the shortcut bar shows `↑↓ Navigate  h Hide/Show  g Grab to reorder  c Color  s Save preset  l Load preset  Esc Back`

**Given** the user presses `h` on a visible widget in Edit Line
**When** the toggle is processed
**Then** the widget is removed from `config.lines[N].widgets` via `updateConfig(mutator)` (pattern 15)
**And** its `colorModes` entry is preserved (not deleted — preserves color across hide/show cycles)
**And** the preview updates in the same render cycle (FR-V2-9)
**And** the inline status changes to `□ hidden`

**Given** the user presses `h` on a hidden widget
**When** the toggle is processed
**Then** the widget is added to `config.lines[N].widgets` with its preserved colorModes (or default color if first time)
**And** the preview and inline status update instantly

**Given** the user presses `g` on a widget in Edit Line
**When** grab mode activates
**Then** the shortcut bar changes to `↑↓ Move  Enter Drop  Esc Cancel`
**And** the grabbed widget shows a `← moving` marker
**And** arrow keys swap the widget position with adjacent widgets in the `widgets` array
**And** the preview updates live during reorder
**And** Enter drops the widget at current position (persisted via `updateConfig`)
**And** Escape cancels and restores original order

**Given** the user presses `c`, `s`, or `l` in Edit Line
**When** the navigation processes the shortcut
**Then** `navigate('colorPicker', { selectedWidget })`, `navigate('presetSave')`, or `navigate('presetLoad')` is called
**And** the screen routing in app.js dispatches to the corresponding screen (implemented in 6.5)

**Given** the user selects "Reset to original" from Home
**When** the reset executes
**Then** `setConfig(structuredClone(snapshot))` restores the launch config atomically
**And** `writeInternalConfig(restored)` persists to disk
**And** `syncCcstatuslineFromScratch(restored)` rebuilds ccstatusline widgets
**And** `previewOverride` is cleared
**And** no render loop occurs (BF2 fix — no `useEffect` reads config and writes config)
**And** the user remains on Home with the restored preview

**Given** Escape is pressed on any screen except Home
**When** `goBack()` is called
**Then** `previewOverride` is cleared, navStack is popped, previous screen is restored

**Given** `q` is pressed on the Home screen
**When** the TUI processes the key
**Then** the TUI exits cleanly to terminal

**Given** the Separator Style screen is accessed from Home
**When** the user navigates to it
**Then** the existing separator style screen (from v1) is rendered within the new ScreenLayout wrapper
**And** preview-on-highlight works via `previewOverride` (pattern 17)

**Given** tests need to validate the changes
**When** tests are executed
**Then** `tui-app.test.js` is updated: tests for multi-line state initialization, `updateConfig` produces correct shape, `resetToOriginal` matches snapshot, navigation push/pop, `previewOverride` cleared on goBack
**And** `tui-components.test.js` is created: ThreeLinePreview renders 3 lines with correct colors, empty line handling, ReorderList navigate/grab/drop modes
**And** all existing tests pass (`npm test`)

### Story 6.5: TUI v2 Sub-screens — Color Picker, Preset Save/Load, Reorder Lines

As a **developer configuring widget colors, saving presets, and rearranging line layout**,
I want **a color picker with Dynamic option for workflow, preset save/load from 3 shared slots with mini-preview, and a line reorder screen that swaps entire line contents**,
So that **I can fully customize my statusline appearance, quickly switch between configurations, and arrange lines to my preference**.

**Acceptance Criteria:**

**Given** the user presses `c` on the `bmad-workflow` widget in Edit Line
**When** the Color Picker screen opens
**Then** the breadcrumb shows `Home > Edit Line N > Color: Workflow`
**And** the list shows `Dynamic` as the first option, followed by 14 ANSI colors (red, green, yellow, blue, magenta, cyan, white, brightRed, brightGreen, brightYellow, brightBlue, brightMagenta, brightCyan, brightWhite)
**And** the current color mode is pre-highlighted
**And** the shortcut bar shows `↑↓ Navigate  Enter Select  Esc Back`

**Given** the user presses `c` on any widget other than `bmad-workflow`
**When** the Color Picker screen opens
**Then** the `Dynamic` option is NOT shown — only 14 fixed ANSI colors
**And** the current `fixedColor` is pre-highlighted

**Given** the user navigates the Color Picker list with arrow keys
**When** each color is highlighted
**Then** `previewOverride` updates to show the highlighted color on the widget (try-before-you-buy — pattern 17)
**And** the 3-line preview reflects the temporary color in real time

**Given** the user presses Enter on a color in Color Picker
**When** the selection is confirmed
**Then** `updateConfig` sets the widget's colorMode to `{ mode: "fixed", fixedColor: selectedColor }` (or `{ mode: "dynamic" }` if Dynamic selected)
**And** `previewOverride` is cleared
**And** the screen returns to Edit Line

**Given** the user presses Escape in Color Picker
**When** the cancel is processed
**Then** `previewOverride` is cleared (reverts to persisted config)
**And** no config change occurs
**And** the screen returns to Edit Line

**Given** the user presses `s` in Edit Line
**When** the Preset Save screen opens
**Then** the breadcrumb shows `Home > Edit Line N > Save Preset`
**And** 3 slots are listed, each showing: slot number + name + mini-preview of stored widgets (or `(empty)` dim)
**And** the shortcut bar shows `↑↓ Navigate  Enter Save here  Esc Back`

**Given** the user selects an empty preset slot for save
**When** Enter is pressed
**Then** a TextInput prompt appears for naming the preset
**And** on Enter: the current line's `widgets` + `colorModes` are saved to the slot with the given name, config is persisted
**And** on Escape: naming is cancelled, no save occurs

**Given** the user selects a non-empty preset slot for save
**When** Enter is pressed
**Then** a ConfirmDialog appears: `Overwrite slot N (name)? Enter / Esc`
**And** Enter confirms: current line config replaces the slot, name preserved (or updated via TextInput)
**And** Escape cancels: no change

**Given** the user presses `l` in Edit Line
**When** the Preset Load screen opens
**Then** the breadcrumb shows `Home > Edit Line N > Load Preset`
**And** 3 slots are listed with mini-previews
**And** the shortcut bar shows `↑↓ Navigate  Enter Load  Esc Back`

**Given** the user highlights a non-empty preset slot in Preset Load
**When** arrow keys move to it
**Then** `previewOverride` shows the current line replaced with the preset's content (try-before-you-buy)

**Given** the user presses Enter on a non-empty preset slot in Preset Load
**When** the load is confirmed
**Then** `updateConfig` replaces `config.lines[editingLine].widgets` and `config.lines[editingLine].colorModes` with the preset's stored values (FR-V2-14: current line only)
**And** `previewOverride` is cleared
**And** the screen returns to Edit Line

**Given** the user presses Enter on an empty preset slot in Preset Load
**When** the action is processed
**Then** nothing happens (no-op — empty slot cannot be loaded)

**Given** the user selects "Reorder lines" from Home
**When** the Reorder Lines screen opens
**Then** the breadcrumb shows `Home > Reorder Lines`
**And** 3 lines are listed, each showing a summary of widget names (or `(empty)`)
**And** the shortcut bar shows `↑↓ Navigate  Enter Grab  Esc Back`

**Given** the user presses Enter on a line in Reorder Lines
**When** grab mode activates
**Then** the shortcut bar changes to `↑↓ Move  Enter Drop  Esc Cancel`
**And** the grabbed line shows a `← moving` marker
**And** arrow keys swap entire line contents (widgets, colorModes) with the adjacent line
**And** the 3-line preview updates live during swap
**And** Enter drops, persisting the swap via `updateConfig`
**And** Escape cancels, restoring original line positions

**Given** presets persist across TUI sessions (FR-V2-13)
**When** the user saves a preset and relaunches the TUI
**Then** the preset is loaded from `config.json` presets array with name and content intact

**Given** tests need to validate the changes
**When** tests are executed
**Then** `tui-screens.test.js` is created: tests for ColorPicker (dynamic shown for workflow only, fixed colors for others, preview-on-highlight, selection persists), PresetScreen save (empty slot, overwrite confirm), PresetScreen load (replaces current line only, empty slot no-op), ReorderLinesScreen (swap contents, preview updates)
**And** all existing tests pass (`npm test`)

### Story 6.6: Installer & Uninstaller — Per-line deployment, internal config creation, upgrade path v1→v2

As a **developer installing or upgrading bmad-statusline**,
I want **the installer to deploy one composite `bmad-line-N` widget per configured non-empty line, create the internal config with defaults on first install, and automatically upgrade from v1 individual widgets to v2 composites**,
So that **ccstatusline displays my configured lines correctly after install/upgrade, and uninstall cleanly removes all bmad artifacts**.

**Acceptance Criteria:**

**Given** the developer runs `npx bmad-statusline install` on a fresh system (no prior bmad-statusline)
**When** the installer runs target 2 (ccstatusline widgets)
**Then** `getWidgetDefinitions(readerPath)` returns `[{ id: "bmad-line-0", type: "custom-command", commandPath: "node \"readerPath\" line 0", preserveColors: true }]`
**And** `bmad-line-0` is injected into ccstatusline line 0

**Given** fresh install
**When** the installer runs the internal config target (NEW)
**Then** if `~/.config/bmad-statusline/config.json` does not exist, it creates it with `createDefaultConfig()` defaults
**And** if it already exists, it is skipped (idempotent)
**And** `logSuccess("internal config", "created default configuration")` or `logSkipped("internal config", "already exists")`

**Given** the developer runs install on a system with v1 individual `bmad-*` widgets in ccstatusline
**When** the installer detects old widgets (ids matching `bmad-*` with `type: "custom-command"` but NOT `bmad-line-*`)
**Then** all old individual `bmad-*` widgets are removed from ccstatusline
**And** a single `bmad-line-0` composite is injected on the line where the old widgets were found
**And** internal config is created via migration logic (from 6.3) if `config.json` does not exist
**And** `logSuccess("ccstatusline", "upgraded v1 widgets to v2 composite")`

**Given** the developer runs install on a system already at v2 (has `bmad-line-0` in ccstatusline)
**When** the installer checks for existing composites
**Then** it skips widget injection (idempotent — `bmad-line-0` already present)
**And** `logSkipped("ccstatusline", "bmad-line-0 already present")`

**Given** the installer deploys the reader and hook
**When** the deploy targets run
**Then** `bmad-sl-reader.js` and `bmad-hook.js` are always overwritten to `~/.config/bmad-statusline/` (existing behavior, unchanged)

**Given** the ccstatusline config write during install
**When** the installer modifies ccstatusline settings.json
**Then** it follows pattern 4: read → parse → backup(.bak) → modify → stringify(null, 2) → write → reread → validate
**And** on validation failure: restore from `.bak`, `logError`, exit 1

**Given** the developer runs `npx bmad-statusline uninstall`
**When** the uninstaller processes ccstatusline widgets
**Then** it removes all widgets with `id` matching `bmad-line-*` (v2 composites)
**And** it removes all widgets with `id` matching `bmad-*` that are NOT `bmad-line-*` (v1 backward compat)
**And** `logSuccess("ccstatusline", "removed bmad widgets")`

**Given** the uninstaller processes internal config
**When** `~/.config/bmad-statusline/` is deleted (existing behavior — removes reader + hook)
**Then** `config.json` is also deleted as part of the directory deletion (no separate target needed — same directory)

**Given** the uninstaller processes backward compat
**When** checking for Phase 1 artifacts (CLAUDE.md block, settings.local.json permissions) and Phase 2 artifacts (PostToolUse Skill matcher)
**Then** all backward compat detection and removal from Epic 3/5 is preserved unchanged

**Given** `defaults.js` `getWidgetDefinitions(readerPath)`
**When** the function is called
**Then** it returns the v2 format: single `bmad-line-0` composite (not individual widgets, not `bmad-compact`)
**And** no `color` property on the widget — `preserveColors: true` means reader ANSI output is used

**Given** tests need to validate the changes
**When** tests are executed
**Then** `install.test.js` is updated: test for `bmad-line-0` injection, test for v1→v2 upgrade (detect old widgets, replace with composite), test for idempotency (skip if present), test for internal config creation
**And** `uninstall.test.js` is updated: test for `bmad-line-*` removal, test for `bmad-*` backward compat removal, test that directory deletion covers config.json
**And** `defaults.test.js` is updated: test that `getWidgetDefinitions` returns `bmad-line-0` format
**And** all existing tests pass (`npm test`)

## Epic 7: Monitor — Real-Time Session Supervision

Le développeur peut accéder à un écran Monitor depuis le TUI, superviser en temps réel les sessions Claude Code actives avec workflows BMAD, voir l'état d'activité du LLM (actif/permission/attente/inactif), naviguer dans l'arborescence des fichiers lus/écrits et les commandes Bash exécutées, ouvrir des pages de détail avec diff et horodatage, visualiser une chronologie unifiée, et exporter les données en CSV.

**FRs covered:** FR32-FR67
**NFRs addressed:** NFR13-NFR17
**Architecture:** Rev.4 — Patterns 21-27, Boundaries 1 (modified) + 8 (new)

### Story 7.1: Hook expansion — History arrays, LLM state, atomic write

As a **bmad-statusline Monitor user**,
I want **the hook to track full file history, bash commands, and LLM activity state**,
So that **the Monitor TUI can display comprehensive session activity in real time**.

**Acceptance Criteria:**

**Given** a PostToolUse event with `tool_name = "Bash"`
**When** the hook processes it
**Then** the command string from `payload.tool_input.command` is appended to `status.commands[]` as `{ cmd, at: ISO8601, agent_id: payload.agent_id || null }`
**And** `status.llm_state` is set to `"active"` with `llm_state_since` updated

**Given** a Stop event
**When** the hook processes it
**Then** `status.llm_state` is set to `"waiting"` and `llm_state_since` is updated
**And** no other status fields are modified

**Given** a Notification event with a permission-type payload
**When** the hook processes it
**Then** `status.llm_state` is set to `"permission"` and `llm_state_since` is updated

**Given** a PostToolUse Read event
**When** the hook processes it
**Then** the existing scalar `last_read` is updated (backward compat)
**And** a new entry is appended to `status.reads[]` as `{ path, in_project, at: ISO8601, agent_id }`
**And** `status.llm_state` is set to `"active"`

**Given** a PostToolUse Write event
**When** the hook processes it
**Then** the existing scalar `last_write`/`last_write_op` are updated (backward compat)
**And** a new entry is appended to `status.writes[]` as `{ path, in_project, op: "write", is_new, at, agent_id, old_string: null, new_string: null }`
**And** `is_new` is true if the file path has not appeared in `reads[]` before this Write

**Given** a PostToolUse Edit event
**When** the hook processes it
**Then** the existing scalars are updated (backward compat)
**And** a new entry is appended to `status.writes[]` as `{ path, in_project, op: "edit", is_new: false, at, agent_id, old_string: payload.tool_input.old_string, new_string: payload.tool_input.new_string }`

**Given** a UserPromptSubmit event that changes the active skill
**When** the hook processes it
**Then** `reads`, `writes`, and `commands` arrays are reset to `[]`
**And** `llm_state` is set to `"active"`

**Given** the status file is written
**When** `writeStatus()` is called
**Then** it writes to `status-{sessionId}.json.tmp` first, then calls `fs.renameSync` to the final path (Pattern 22)

**Given** the status file exceeds 10 MB
**When** a new array entry would be appended
**Then** the append is skipped but scalar fields continue to be updated

**Given** tests need to validate the changes
**When** tests are executed
**Then** `hook.test.js` is updated with tests for all new handlers, array appending, atomic write, llm_state transitions, skill-change reset, 10MB guard, agent_id propagation
**And** new fixture `status-with-history.json` is created
**And** all existing hook tests continue to pass (`npm test`)

### Story 7.2: Installer upgrade — Bash, Stop, Notification matchers

As a **bmad-statusline user upgrading from Phase 3**,
I want **the installer to add the new hook matchers for Bash, Stop, and Notification events**,
So that **the Monitor feature receives all the data it needs from Claude Code**.

**Acceptance Criteria:**

**Given** `defaults.js` `getHookConfig(hookPath)`
**When** the function is called
**Then** it returns a config with 8 matchers across 5 event types: UserPromptSubmit (1), PostToolUse Read/Write/Edit/Bash (4), Stop (1), Notification (1), SessionStart (1)

**Given** `~/.claude/settings.json` has Phase 3 hooks (5 matchers, 3 event types)
**When** the installer runs
**Then** it detects that `Stop` matcher is absent and adds PostToolUse Bash, Stop, and Notification matchers without duplicating existing ones

**Given** `~/.claude/settings.json` already has Phase 4 hooks (8 matchers)
**When** the installer runs
**Then** it skips (idempotent)

**Given** tests need to validate
**When** tests are executed
**Then** `install.test.js` updated with Phase 3→4 upgrade and idempotency tests
**And** fixture `claude-settings-with-hooks-phase4.json` created
**And** all existing tests pass (`npm test`)

### Story 7.3: ScrollableViewport — Reusable stateless scroll component

As a **TUI developer building Monitor screens**,
I want **a reusable ScrollableViewport component**,
So that **both MonitorScreen and MonitorDetailScreen display scrollable content consistently**.

**Acceptance Criteria:**

**Given** ScrollableViewport receives `items`, `height`, `scrollOffset`
**When** rendered
**Then** it displays `items.slice(scrollOffset, scrollOffset + height)`
**And** shows `▲ {N} de plus` if scrollOffset > 0, `▼ {N} de plus` if items remain below

**Given** component design
**When** implemented
**Then** it is stateless (no useState), does not call useInput (Pattern 24), lives at `src/tui/monitor/components/ScrollableViewport.js`

**Given** tests
**When** executed
**Then** `tui-monitor-components.test.js` created with render tests for all indicator states

### Story 7.4: Monitor foundation — Polling, routing, HomeScreen integration

As a **bmad-statusline user**,
I want **to access a Monitor screen from Home that shows active BMAD sessions in real time**,
So that **I can see which sessions are running**.

**Acceptance Criteria:**

**Given** HomeScreen
**When** rendered
**Then** "Monitor" option navigates to screen `'monitor'`

**Given** MonitorScreen mounts
**When** `useSessionPolling` executes
**Then** immediate poll + 1500ms interval, reads `.alive-*` + `status-*.json`, filters BMAD sessions only, cleanup on unmount

**Given** `monitor-utils.js`
**When** implemented
**Then** exports `pollSessions(cachePath)` encapsulating all cache I/O (Pattern 23)

**Given** MonitorScreen with no sessions
**When** rendered
**Then** shows "MONITOR" title + no active sessions message, Esc returns to Home

**Given** tests
**When** executed
**Then** `tui-monitor.test.js` created: render, empty state, polling, Esc navigation

### Story 7.5: Tabs & Badge — Two-level session navigation with LLM state

As a **developer monitoring multiple sessions**,
I want **sessions grouped by project with colored tabs and LLM state badges**,
So that **I can quickly identify which session needs attention**.

**Acceptance Criteria:**

**Given** multiple projects → ←→ project tabs, Tab/Shift+Tab session sub-tabs. 1 project → ←→ sessions directly. 1 session → no tabs.
**And** project tab color from `config.projectColors`, session color from `config.skillColors`/`WORKFLOW_COLORS`
**And** project badge = worst state (permission > waiting > active > inactive)
**And** LlmBadge: ACTIVE green `⚡`, PERMISSION yellow `⏳`, WAITING yellowBright `⏸`, INACTIVE dim `○` + workflow name + timer
**And** inactive override if `updated_at` > 5 min
**And** `r` reorders projects, `R` reorders sessions

**Given** tests
**When** executed
**Then** tests for grouping, flat mode, colors, badge states, timeout override, reorder

### Story 7.6: File & Bash sections — Tree view and command display

As a **developer monitoring a session**,
I want **organized file tree and bash command sections with counts**,
So that **I have a clear picture of session activity**.

**Acceptance Criteria:**

**Given** writes[] → tree view in-project + flat absolute hors-projet, `*` for new, `🔀` for sub-agent, counts in headers
**And** reads[] minus files in writes[] → same format for read-only
**And** commands[] → deduplicated with `(×N)`, color by family (npm=green, git=yellow, node=cyan, filesystem=dim, python=blue, other=magenta)
**And** all sections scroll together in single ScrollableViewport, sticky top (title+tabs+badge) + sticky bottom (shortcut bar)

**Given** tests
**When** executed
**Then** tests for tree rendering, new indicator, reads filtering, dedup+count, color families, sub-agent indicator

### Story 7.7: Detail mode & pages — Tree navigation and file/command details

As a **developer wanting specifics about a file or command**,
I want **to navigate the tree and view detailed history with diffs**,
So that **I can see exactly what edits were made and when**.

**Acceptance Criteria:**

**Given** `d` activates detail mode → cursor `❯` on first selectable, ↑↓ skip non-selectable (Pattern 26), shortcut bar switches (Pattern 25)
**And** Enter on edited file → "DÉTAIL FICHIER — ÉDITÉ", each edit with `── #N — HH:MM:SS ──`, `-` red old lines, `+` green new lines, Write shows `(fichier créé)`
**And** Enter on read file → timestamps list
**And** Enter on bash command → full unsimplified command list with timestamps
**And** Esc returns to detail mode, same cursor position
**And** detail pages have own ScrollableViewport

**Given** tests
**When** executed
**Then** tests for mode activation, cursor navigation, edit diff rendering, read timestamps, bash full commands, Esc return position

### Story 7.8: Chronology & Export — Timeline and CSV generation

As a **developer reviewing session activity**,
I want **a unified timeline and CSV export capability**,
So that **I can review activity flow and archive records**.

**Acceptance Criteria:**

**Given** `c` → chronology page: merged arrays sorted by timestamp, `HH:MM:SS TYPE path`, color-coded (READ cyan, WRITE green, EDIT yellow, BASH dim), `*` new, `🔀` sub-agent, scrollable, `s` sort toggle, `t` timestamp toggle
**And** `e` → ExportPrompt replaces shortcut bar: `l` = light CSV (type,path,count), `f` = full CSV (type,path,operation,timestamp,detail)
**And** destination `{outputFolder}/monitor/monitor-{mode}-{timestamp}.csv`, mkdir if needed
**And** confirmation replaces shortcut bar with path, returns on keypress

**Given** tests
**When** executed
**Then** tests for chronology merge+sort, color coding, CSV content (light+full), directory creation, confirmation display

### Story 7.9: Toggles & polish — Auto-scroll, bell, contextual shortcuts

As a **developer actively monitoring sessions**,
I want **real-time UX enhancements for sustained supervision**,
So that **the Monitor is practical for long-running use**.

**Acceptance Criteria:**

**Given** `a` toggle → `[AUTO]` indicator, scroll jumps to latest on new data
**And** `b` toggle → `[bell]` / `[bell off]`, emits `\x07` on state transition to permission/waiting
**And** `t` toggle → absolute `14:23:07` ↔ relative `il y a 2min`
**And** `s` toggle → alphabetical ↔ chronological sort
**And** shortcut bar color-coded: navigation (cyan), modes (yellow), actions (green), toggles (magenta), Esc (dim)
**And** contextual shortcuts per mode (Pattern 25)
**And** `Esc` in normal mode → goBack() to Home

**Given** tests
**When** executed
**Then** tests for all toggles on/off, bell emit, timestamp/sort switching, shortcut colors, contextual arrays, Esc navigation
**And** all existing tests pass (`npm test`)

## Epic 8: LLM State Machine v2 — Direct Hook Signal Detection

Le hook évolue pour capturer les signaux directs de Claude Code (PermissionRequest, Stop, StopFailure, SessionEnd, SubagentStart/Stop, PostToolUseFailure, PermissionDenied) au lieu de les inférer par timeout. Le reader et le monitor s'adaptent pour afficher les nouveaux états.

**Architecture:** Rev.5 — extends hook dispatch table and LLM state machine
**Stories:** 8.1–8.6 (see sprint-status.yaml and story files in implementation-artifacts/)

### Story 8.6: Hook — Interrupted State Detection & Permission-to-Active Transition Fix

As a **developer monitoring Claude Code sessions**,
I want **the status line to show "interrupted" when I cancel or deny an action, and to return to "active" as soon as I accept a permission**,
So that **the Monitor and reader accurately reflect user-initiated interruptions and permission acceptance instead of showing stale states**.

_Note: Epic 8 stories were created directly from conversation-driven specifications. Full acceptance criteria are in individual story files._

## Epic 9: TUI Process Lifecycle — Orphan Prevention & Graceful Shutdown

Le TUI n'a actuellement aucune protection contre les processus orphelins. Quand l'utilisateur ferme le terminal brutalement (Ctrl+C, fermeture de fenêtre, crash), les processus Node.js persistent en arrière-plan. Avec plusieurs instances simultanées légitimes, il faut un mécanisme qui nettoie les orphelins sans tuer les instances actives.

**Architecture:** Rev.5 — Pattern 28
**Stories:** 9.1

### Story 9.1: TUI Process Lifecycle — PID Registry, Signal Handlers, TTY Detection

As a **developer running one or more TUI instances**,
I want **orphaned TUI processes to be automatically cleaned up**,
So that **closing terminals or crashing doesn't leave zombie Node.js processes consuming resources**.

**Acceptance Criteria:**

**Given** the TUI starts
**When** `launchTui()` is called in `app.js`
**Then** the current PID is registered in `tui-pids.json` in the cache directory (`BMAD_CACHE_DIR` / `~/.cache/bmad-status/`)
**And** before registering, all existing PIDs in the registry are checked for liveness via `process.kill(pid, 0)`
**And** dead PIDs (orphans from previous crashes) are removed from the registry
**And** the registry file is written atomically (tmp + rename, Pattern 22)

**Given** multiple TUI instances are running simultaneously
**When** a new instance starts
**Then** it does NOT kill or interfere with existing live instances
**And** only dead PIDs are purged from the registry
**And** all live instances coexist without conflict

**Given** the TUI exits normally (user presses `q` or Esc from HomeScreen)
**When** the quit handler fires
**Then** the current PID is removed from `tui-pids.json`
**And** the config is flushed (existing debounce behavior preserved)
**And** the alternate screen buffer is restored

**Given** the TUI receives SIGINT, SIGTERM, or SIGHUP
**When** the signal handler fires
**Then** the current PID is removed from `tui-pids.json`
**And** the alternate screen buffer is restored
**And** the process exits cleanly via `process.exit()`

**Given** an uncaught exception or unhandled rejection occurs
**When** the error handler fires
**Then** the current PID is removed from `tui-pids.json`
**And** the alternate screen buffer is restored
**And** the process exits with code 1

**Given** the user closes the terminal window (no signal delivered on Windows)
**When** a periodic TTY check runs (every 5-10 seconds)
**Then** `process.stdout.isTTY` returns falsy
**And** the TUI initiates graceful shutdown: removes PID from registry, restores screen buffer, exits

**Given** tests
**When** executed
**Then** tests for PID registration on startup, dead PID cleanup, PID removal on normal exit, PID removal on signal, TTY detection triggering exit, multi-instance coexistence, atomic write of registry file
**And** all existing tests pass (`npm test`)
