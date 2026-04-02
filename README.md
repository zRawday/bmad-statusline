# bmad-statusline

BMAD workflow status tracking for [Claude Code](https://claude.ai/code) — displays active skill, story, and step progress in your terminal status line via [ccstatusline](https://github.com/nicobailon/ccstatusline).

## Prerequisites

- Node.js >= 20
- [ccstatusline](https://github.com/nicobailon/ccstatusline) >= 2.2

## Installation

```bash
npx bmad-statusline install
```

This configures everything automatically:

- `~/.claude/settings.json` — statusLine command + hook entries
- `~/.config/ccstatusline/settings.json` — BMAD widget definitions
- `~/.config/bmad-statusline/` — reader, hook script, and config
- `~/.cache/bmad-status/` — runtime cache directory

## Usage

### TUI Configurator

```bash
npx bmad-statusline
```

Launch the interactive TUI to customize your status line — reorder widgets, change separators, edit line layout, save/load presets.

### Commands

| Command | Description |
|---------|-------------|
| `npx bmad-statusline` | Launch TUI configurator |
| `npx bmad-statusline install` | Install widgets, reader, and hooks |
| `npx bmad-statusline uninstall` | Remove all bmad-statusline components |
| `npx bmad-statusline clean` | Clean stale cache files |

## How It Works

bmad-statusline uses Claude Code's hook system to passively track workflow activity:

1. **Hooks** intercept tool events (Read, Write, Edit) and skill activations to detect which BMAD workflow is active, what story is being worked on, and current step progress.
2. **Cache files** store the current status as JSON in `~/.cache/bmad-status/`.
3. **Reader** reads the cache and renders a formatted, color-coded status line for ccstatusline to display.

No manual status updates needed — everything is extracted automatically from Claude Code's activity.

## Uninstall

```bash
npx bmad-statusline uninstall
```

Removes all hooks, widgets, reader, and cache files cleanly.

## License

[MIT](LICENSE)
