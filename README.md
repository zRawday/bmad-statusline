# bmad-statusline

[![npm version](https://img.shields.io/npm/v/bmad-statusline)](https://www.npmjs.com/package/bmad-statusline)
[![license](https://img.shields.io/npm/l/bmad-statusline)](LICENSE)
[![node](https://img.shields.io/node/v/bmad-statusline)](package.json)

Custom widget pack for [ccstatusline](https://github.com/sirmalloc/ccstatusline) that adds passive BMAD activity tracking to the [Claude Code](https://claude.ai/code) status bar — automatically detects the active skill, current story, step progress, and LLM state, with zero manual action required. Includes a real-time monitor to follow all your BMAD sessions live from a separate terminal.

> **Note:** Terminal display is powered by [ccstatusline](https://github.com/sirmalloc/ccstatusline), a status line engine for Claude Code. bmad-statusline creates and injects its own custom widgets into ccstatusline. Other (non-BMAD) widgets are available directly from ccstatusline.

## Status Line

<!-- Screenshot of the 3 widget lines rendered in the terminal -->
![Status Line Widgets](https://raw.githubusercontent.com/zRawday/bmad-statusline/main/docs/images/statusline.png)

## Features

- **Passive detection via hooks** — 8 signals intercepted from the Claude Code lifecycle (prompts, reads, writes, bash, permissions, errors…). Zero manual action required.
- **Interactive TUI configurator** — full visual editor to customize the display, colors, separators, and widget order
- **11 configurable widgets across 3 lines** — LLM State, Project, Initial Skill, Active Skill, Story, Step, Next Step, Document, File Read, File Write/Edit, Timer
- **Semantic colors** — each workflow and project has its own color (cyan = dev, green = planning, yellow = product, magenta = architecture…), individually customizable
- **Real-time Monitor** — built-in multi-session dashboard to follow all active BMAD sessions live, with file read/write/edit history, command tracking, and auto-allow permission control (see [Monitor](#monitor) section)
- **Presets** — 3 slots to save and load complete layouts
- **134 recognized workflows** — BMAD, GDS, WDS, CIS, and TEA compatibility

## Prerequisites

- Node.js >= 20
- [BMAD Framework](https://github.com/bmad-code-org/BMAD-METHOD/) >= 6.2.2 

> [ccstatusline](https://github.com/sirmalloc/ccstatusline) is installed automatically via npx during setup — no manual installation needed.

## Installation

```bash
npx bmad-statusline install
```

Automatically configures:

- `~/.claude/settings.json` — statusLine command + hook entries
- `~/.config/ccstatusline/settings.json` — BMAD widget definitions
- `~/.config/bmad-statusline/` — reader, hook, and internal configuration
- `~/.cache/bmad-status/` — runtime cache directory

## TUI Configurator

```bash
npx bmad-statusline
```

<!-- Screenshot of the TUI home screen -->
![TUI Configurator](https://raw.githubusercontent.com/zRawday/bmad-statusline/main/docs/images/TUI.png)

The TUI lets you fully customize the status line display without editing any files:

### Edit Line

Each line (1, 2, 3) is configured individually:
- **Visibility** — show/hide each widget with `h`
- **Color** — cycle through 15 ANSI colors with `←/→`, or switch to dynamic mode (color resolved at runtime based on the workflow/project)
- **Order** — rearrange widgets within a line using grab mode (`g`)
- **Display mode** — some widgets have alternate modes (Story: compact/full)

### Separator Style

4 separator styles between widgets:
- **Tight** — `project│dev-story│4/12`
- **Moderate** — `project │ dev-story │ 4/12`
- **Wide** — `project  │  dev-story  │  4/12`
- **Custom** — any string

### Reorder Lines

Rearrange the order of the 3 lines with keyboard drag-and-drop.

### Presets

3 save slots to store complete layouts (widgets, order, separators). Custom colors are preserved separately.

## Monitor

<!-- Screenshot of the monitor in action -->
![Monitor](https://raw.githubusercontent.com/zRawday/bmad-statusline/main/docs/images/Monitor.png)

The Monitor is a real-time dashboard built into the TUI that lets you follow the activity of all active Claude Code sessions live. It is a full-featured tool in its own right, accessible from the TUI main menu.

### Overview

The Monitor displays for each session:
- The **active workflow** and current **story**
- The **LLM state** in real time (Active, Permission, Waiting, Error, Interrupted)
- The **file tree** of read and edited files
- The **command history** of executed bash commands
- The **elapsed time** since the session started

### Multi-Session & Multi-Project

- Up to **20 simultaneous sessions** tracked in parallel
- **Two-level navigation**: project tabs (when multiple projects are active) + session tabs
- Each tab displays the workflow name, story number, and a colored state indicator (●)
- Smooth navigation with `←/→` between sessions/projects and `Tab` to cycle
- Automatic liveness detection via Claude process PID verification

### LLM Badge

Sticky banner displayed at all times with:
- **State**: colored indicator across 5 states
  - 🟢 **Active** — the LLM is working
  - 🟡 **Permission** — waiting for user confirmation
  - 🔵 **Waiting** — idle, control returned to the user
  - 🔴 **Error** — error detected
  - 🟡 **Interrupted** — session interrupted
- **Timer** — elapsed time updated every second
- **Context** — workflow name + story number or document name

### File Tree

- **Hierarchical tree** for project files (├──, └──, │)
- **Flat list** for out-of-project files
- **Visual indicators**:
  - `*` (green) — file newly created during the session
  - 🔀 (cyan) — file modified by a sub-agent
- The most recent file is highlighted

### Bash Commands

- **Deduplicated history** — identical commands are grouped with a counter (`npm test (x3)`)
- **Color-coded by family**:
  - `npm` → green, `git` → yellow, `node` → cyan
  - `python/pip` → blue, file operations → dimmed, others → magenta
- **Multi-line support** — heredocs and long commands are displayed correctly
- The last executed command is highlighted

### Detail Mode

Press `d` to enter detail mode with cursor navigation:
- **Edited file** — displays all diffs (deleted lines in red, added lines in green)
- **Read file** — lists all read timestamps
- **Command** — full execution history

### Chronology

Merged timeline view of all operations (reads, writes, edits, bash commands):
- **Sort** — toggle between alphabetical and chronological with `s`
- **Time format** — toggle between absolute (HH:MM:SS) and relative ("5min ago") with `t`
- **Type indicators** — READ (cyan), WRITE (green), EDIT (yellow), BASH (dimmed)

### Auto-Allow

Toggle automatic permission approval per-session or globally, directly from the Monitor (`a` key). When enabled, permission prompts are approved automatically — sessions can proceed unattended without waiting for manual confirmation.

- **Per-session toggle** — enable or disable auto-allow for the current session only
- **Global toggle ("Always")** — enable for all sessions, with per-session override capability
- **Visual indicator** — `Auto-allow` shown in red on the monitor title line when active
- **Warning overlay** — the menu clearly warns that tools will execute without human review

### CSV Export

Export session data to CSV:
- **Light** — aggregated summary (type, path, count)
- **Full** — complete detail (type, path, operation, timestamp, content)

## Commands

| Command | Description |
|---------|-------------|
| `npx bmad-statusline` | Launch the TUI configurator |
| `npx bmad-statusline install` | Install widgets, reader, and hooks |
| `npx bmad-statusline uninstall` | Remove all components |
| `npx bmad-statusline clean` | Clean stale cache files |

## How It Works

bmad-statusline relies on a 3-layer architecture:

1. **Hooks** — intercept Claude Code lifecycle events (8 signals: UserPromptSubmit, PreToolUse, PostToolUse, PermissionRequest, Stop, StopFailure, SubagentStart/Stop) to passively detect the active skill, story, step progress, and LLM state
2. **Cache** — data is stored as JSON in `~/.cache/bmad-status/` (one status file + one alive file per session)
3. **Reader** — reads the cache and produces a formatted, ANSI-colored line for ccstatusline to display

Everything is synchronous, with zero runtime dependencies (Node.js stdlib only for hook and reader), and designed to never interfere with Claude Code's operation.

> **Note:** Due to a Claude Code limitation, the status line only refreshes when the LLM performs actions (tool calls, reads, writes…). This primarily affects the LLM State indicator and the Timer, which may appear frozen while the LLM is idle or waiting for user input.

## Configuration

Configuration files are located in `~/.config/bmad-statusline/`:
- `config.json` — widget configuration, colors, separators, and presets

Two environment variables allow customizing paths:
- `BMAD_CACHE_DIR` — cache directory (default: `~/.cache/bmad-status/`)
- `BMAD_CONFIG_DIR` — configuration directory (default: `~/.config/bmad-statusline/`)

## Uninstall

```bash
npx bmad-statusline uninstall
```

Cleanly removes all components: hooks, ccstatusline widgets, reader, scripts, and cache files.

## License

[MIT](LICENSE)
