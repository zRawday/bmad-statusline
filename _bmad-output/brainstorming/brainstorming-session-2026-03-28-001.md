---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments: []
session_topic: 'StatusLine BMAD contextuelle - affichage du contexte workflow par terminal'
session_goals: 'Étude de faisabilité et conception d une solution pour afficher projet/workflow/étape BMAD dans chaque terminal Claude Code'
selected_approach: 'B2 - Multiple custom-command widgets sans fork ccstatusline + TUI compagnon'
techniques_used: [feasibility-analysis, architecture-exploration]
ideas_generated: [bmad-statusline-package, bmad-sl-reader-script, tui-configurator, claude-md-instruction, alive-file-cleanup, dynamic-colors]
context_file: ''
---

## Session Overview

**Topic:** StatusLine BMAD contextuelle - affichage du contexte workflow par terminal
**Goals:** Etude de faisabilite et conception d'une solution pour afficher projet/workflow/etape BMAD dans chaque terminal Claude Code

### Context Guidance

_L'utilisateur gere plusieurs terminaux Claude Code simultanement (multi-projets et multi-fenetres par projet) et a besoin d'identifier en un clin d'oeil : projet, workflow BMAD actif, demande initiale, etape en cours, prochaine etape recommandee._

---

## Feasibility Study

### Architecture ccstatusline

- Claude Code possede un hook officiel `statusLine` dans `~/.claude/settings.json`
- Claude Code pipe un JSON via stdin (session_id, model, context_window, cwd, transcript_path...)
- ccstatusline rend des widgets formattes ANSI sur stdout
- Widget `custom-command` existant : execute une commande shell, recoit le meme JSON stdin

### Multi-terminal Resolution

- Chaque terminal a un `session_id` unique dans le JSON stdin
- Le workflow BMAD decouvre son session_id via : `basename "$(ls -t ~/.claude/projects/{slug}/*.jsonl | head -1)" .jsonl`
- Fichiers statut keyes par session_id : `~/.cache/bmad-status/status-{session_id}.json`

### Approach Selected: B2 (no fork, multiple custom-command widgets)

- Pas de fork de ccstatusline — mises a jour `@latest` conservees
- Chaque widget BMAD = un widget `custom-command` independant
- Couleur, position, on/off personnalisables individuellement
- TUI compagnon `bmad-statusline` pour configurer

---

## Widget List (17 widgets)

### Universal Widgets (all workflows)

| Widget | Example | Source |
|---|---|---|
| BmadProject | `Toulou` | Auto - config.yaml |
| BmadWorkflow | `dev-story` | Auto - skill name |
| BmadAgent | `Amelia` / `Mary, Bob, Quinn` | Hybrid - auto init + agent update (array) |
| BmadStep | `step-03 implementation` | Agent |
| BmadNextStep | `-> step-04 testing` | Agent |
| BmadProgress | `3/6` | Agent |
| BmadProgressBar | `----..` | Agent |
| BmadProgressStep | `3/6 implementation` | Agent (fused Progress + Step) |
| BmadRequest | `Auth login OAuth2` | Agent - short summary keywords |
| BmadSessionTimer | `12m` | Auto - now minus started_at |

### Development Widgets

| Widget | Example | Workflows |
|---|---|---|
| BmadStory | `2-1 Auth login page` | dev-story, create-story, quick-dev |

### Planning/Design Widgets

| Widget | Example | Workflows |
|---|---|---|
| BmadDocument | `PRD v2` | create-prd, edit-prd, create-architecture |
| ~~BmadSection~~ | ~~`User Flows`~~ | ~~DROPPED — no corresponding status file field~~ |
| ~~BmadValidation~~ | ~~`validated`~~ | ~~DROPPED — no corresponding status file field~~ |

### Composite Widgets

| Widget | Example |
|---|---|
| BmadCompact | `Toulou . dev-story . 2-1 . step-03 implementation` |
| BmadFullContext | `Toulou . dev-story . 2-1 Auth . 3/6 . -> step-04 testing` |
| BmadMinimal | `dev-story . step-03 implementation` |

### Data Source Summary

| Source | Fields |
|---|---|
| Auto (6) | session_id, project, workflow, step.total, started_at/updated_at, timer |
| Hybrid (1) | agent (auto init, agent updates for changes/party mode) |
| Agent (7) | request, story, document, step.current/current_name, step.next/next_name, step.completed |

### Conditional Display

- Story and Request are mutually exclusive in default layout
- Story present -> show Story, hide Request
- Story null -> show Request, hide Story

---

## Status File Format

**Location:** `~/.cache/bmad-status/status-{session_id}.json`

```json
{
  "session_id": "<session_id>",
  "project": "<from config.yaml>",
  "workflow": "<skill name>",
  "agent": ["<active agent(s)>"],
  "request": "<short summary, 3-5 keywords>",
  "story": "<story id + title or null>",
  "document": "<document name or null>",
  "step": {
    "current": "<step file>",
    "current_name": "<readable name>",
    "next": "<next step file>",
    "next_name": "<readable next name>",
    "completed": 0,
    "total": 0
  },
  "started_at": "<ISO 8601>",
  "updated_at": "<ISO 8601>"
}
```

---

## Script bmad-sl-reader

- Language: Node.js (same runtime as ccstatusline)
- Input: stdin JSON from Claude Code, argv[1] = field name
- Logic: extract session_id from stdin -> read status file -> return field
- Empty string returned when file missing or field null (widget hides)
- Commands: project, workflow, agent, step, nextstep, progress, progressbar, progressstep, story, request, document, timer, compact, full, minimal

---

## TUI Configurator

### Features

- Toggle widgets on/off
- Color mode per widget: Dynamic (hardcoded map) or Fixed (user choice)
- Target ccstatusline line (1, 2, or 3)
- Widget reorder
- Separator: Serre (3 spaces), Modere (6 spaces), Large (15 spaces), Custom (free text)
- Composite mode vs individual widgets
- Live preview
- Install/Uninstall commands

### Dynamic Colors

**Agents:**
| Agent | Color |
|---|---|
| Amelia (dev) | cyan |
| Bob (scrum master) | green |
| John (PM) | yellow |
| Quinn (QA) | red |
| Winston (architect) | magenta |
| Mary (analyst) | blue |
| Sally (UX) | brightMagenta |
| Paige (tech writer) | white |
| Barry (quick flow) | brightCyan |
| Carson (brainstorming) | brightYellow |
| Murat (test architect) | brightRed |
| Maya (design thinking) | brightGreen |
| Victor (innovation) | brightBlue |
| Sophia (storyteller) | brightMagenta |
| Dr. Quinn (problem solver) | brightWhite |
| Caravaggio (presentation) | yellow |

**Workflows by category:**
| Category | Workflows | Color |
|---|---|---|
| Dev | dev-story, quick-dev | cyan |
| Review | code-review | brightRed |
| Planning | sprint-planning, sprint-status, create-story, create-epics | green |
| Product | create-prd, edit-prd, validate-prd | yellow |
| Architecture | create-architecture, create-ux-design | magenta |
| Research | domain-research, technical-research, market-research | blue |
| Quality | testarch-*, qa-generate-* | red |
| Creative | brainstorming, party-mode, retrospective | brightYellow |
| Documentation | document-project, generate-project-context | white |
| WDS | wds-* | brightBlue |

Default: Agent and Workflow in Dynamic mode, others in Fixed mode.

---

## CLAUDE.md Instruction

```
## BMAD Status Tracking

When executing any BMAD workflow or agent skill, maintain a status file for
the current session. This enables real-time workflow tracking in the terminal.

### When to update

- At workflow start (after config loading)
- At each step transition
- When agents change (including party mode)
- At workflow completion (set step.completed = step.total)

### How to update

1. Discover session_id:
   SESSION_ID=$(basename "$(ls -t ~/.claude/projects/$(echo "$PWD" | sed 's/[:\\/]/-/g' | sed 's/^-//')/*.jsonl | head -1)" .jsonl)

2. Write to ~/.cache/bmad-status/status-${SESSION_ID}.json

### Rules

- Keep request concise: topic keywords, not a full sentence
- agent is an array: ["Amelia"] or ["Amelia", "Bob"] in party mode
- Set null for story/document when not applicable
- Do NOT skip updates to save time -- the write is fast
- Create ~/.cache/bmad-status/ directory if it doesn't exist
```

---

## Default Layout

```
Line 1: [model]  [spacing]  [context-%]          (unchanged from ccstatusline)
Line 2: [Project] [Agent] [Workflow] [Story|Request] [ProgressStep]
```

Default separator: Serre (3 spaces)
Default color mode: Dynamic for Agent and Workflow, Fixed for others

**With story (dev-story):**
```
Opus 4.6 (1M context)                              ctx: 42%
Toulou   Amelia   dev-story   2-1 Auth login   3/6 implementation
```

**Without story (brainstorming):**
```
Opus 4.6 (1M context)                              ctx: 42%
Toulou   Carson   brainstorming   Idees rebrand logo   1/5 technique
```

---

## Distribution Strategy

### Package: `bmad-statusline` (published on npmjs.com)

```
npx bmad-statusline install   # One-time setup (global + per-project)
npx bmad-statusline           # TUI configurator (Phase 3)
npx bmad-statusline clean     # Manual cache purge
npx bmad-statusline uninstall # Clean removal
```

### Scope: Global vs Per-Project

| Component | Scope | Location |
|---|---|---|
| ccstatusline config in Claude Code | Global (once) | ~/.claude/settings.json |
| ccstatusline widget config | Global (once) | ~/.config/ccstatusline/settings.json |
| bmad-sl-reader script | Global (once) | ~/.config/bmad-statusline/bmad-sl-reader |
| Cache directory | Global (once) | ~/.cache/bmad-status/ |
| CLAUDE.md instruction | Per-project | {project}/.claude/CLAUDE.md |

### Install does:

1. ccstatusline not configured in Claude Code?
   -> Writes statusLine config directly into ~/.claude/settings.json
   -> ccstatusline downloads automatically on first Claude Code launch via npx
   (No TUI imbrication — we write the same JSON files ccstatusline's TUI would)
2. Copies bmad-sl-reader to ~/.config/bmad-statusline/
3. Injects BMAD custom-command widgets into ~/.config/ccstatusline/settings.json
   (preserves existing user widgets on other lines)
4. Creates ~/.cache/bmad-status/ directory
5. Adds BMAD Status Tracking instruction to ./.claude/CLAUDE.md

### Multi-Project Install

```bash
cd ~/project-A && npx bmad-statusline install  # Global + CLAUDE.md
cd ~/project-B && npx bmad-statusline install  # Skip global, CLAUDE.md only
cd ~/project-C && npx bmad-statusline install  # Skip global, CLAUDE.md only
```

Idempotent — safe to re-run on any project.

### Backward Compatibility

- Works with any BMAD version (relies on CLAUDE.md, not workflow modifications)
- Phase 3: optional bmad_init.py patch for auto fields

---

## Edge Cases

| Case | Solution |
|---|---|
| Session without BMAD workflow | No status file -> widgets empty -> line 2 blank |
| Workflow crash | Last known state preserved, updated_at goes stale |
| Terminal closed | .alive file not refreshed -> cleanup by next active terminal |
| Long session (days) | .alive refreshed continuously -> file preserved |
| Orphan files | Auto-purge: .alive not touched > 5 min -> delete status + alive |
| 2 workflows same project | Separate session_ids -> separate files |
| Party mode | Cumulative agent array, all displayed with individual colors |
| Corrupted status file | JSON parse error caught -> return empty |
| ccstatusline not installed | Install detects and configures automatically |
| CLAUDE.md missing | Install re-injects, idempotent |
| bmad_init.py not patched | Auto fields empty, agent fills via CLAUDE.md |

### Cleanup Mechanism

Script bmad-sl-reader piggybacks cleanup on every call:
1. Touch `.alive-{session_id}` for current session
2. Scan: if any `.alive-*` older than 5 min -> delete corresponding `status-*.json` + `.alive-*`

No cron, no daemon needed.

---

## MVP Phases

### Phase 1 - Proof of Concept

- bmad-sl-reader script (Node.js)
- CLAUDE.md instruction (manual)
- ccstatusline config (manual)
- Validate: does the agent follow instructions and update the file?

### Phase 2 - Distributable Package

- npm package bmad-statusline
- install/uninstall commands
- Dynamic colors (hardcoded maps)
- .alive cleanup system
- Composite widgets

### Phase 3 - Complete Experience

- TUI configurator (React/Ink)
- Separators (Serre/Modere/Large/Custom)
- Fixed/Dynamic color toggle
- Party mode multi-color rendering
- bmad_init.py patch for auto fields
