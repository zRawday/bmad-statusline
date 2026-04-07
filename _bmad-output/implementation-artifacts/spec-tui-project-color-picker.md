---
title: 'TUI per-project color picker — dynamic mode with cache-based project detection'
type: 'feature'
created: '2026-04-02'
status: 'done'
baseline_commit: '17ef2fb'
context: ['_bmad-output/project-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The project widget uses a single fixed color (yellow) for all BMAD projects. Users working across multiple projects cannot visually distinguish them at a glance.

**Approach:** Add dynamic color mode to the project widget (default), with per-project color customization via a new TUI sub-screen. Detect known projects by scanning cached status files. Each project gets a deterministic default color via name hashing. Custom overrides stored in `config.projectColors`.

## Boundaries & Constraints

**Always:**
- Detect projects from `~/.cache/bmad-status/status-*.json` files (hook already writes `project` field there)
- `config.projectColors` stores only overrides (absent = hash-based default)
- Dynamic mode is the new default for the project widget; existing `fixed` configs preserved
- Reader is CJS, zero deps, sync I/O
- Hash-based default color is deterministic (same project name → same color across sessions)

**Ask First:** Scanning directories beyond the cache for project detection.

**Never:** Modify hook logic. Add runtime dependencies. Break existing fixed-color behavior.

</frozen-after-approval>

## Code Map

- `src/tui/screens/ProjectColorsScreen.js` -- NEW: project list with color cycling, scans cache on mount
- `src/tui/screens/EditLineScreen.js` -- Enter on bmad-project navigates to projectColors screen
- `src/tui/app.js` -- Route for projectColors screen
- `src/tui/widget-registry.js` -- Project widget: defaultMode → 'dynamic', defaultColor → null
- `src/tui/config-loader.js` -- Preserve `projectColors` (same pattern as skillColors)
- `src/reader/bmad-sl-reader.js` -- COMMANDS.project applies dynamic color via `getProjectColor()`, readLineConfig reads projectColors

## Tasks & Acceptance

**Execution:**
- [x] `src/tui/screens/ProjectColorsScreen.js` -- Create screen: scan cache dir for unique project names from status files. Show project list with colored names, ←→ cycle ANSI colors, `d` reset to hash default. Sort: active projects first (have .alive file), then alphabetical
- [x] `src/tui/screens/EditLineScreen.js` -- Enter on `bmad-project` navigates to `projectColors`. Update `getColorOptions` to return `['dynamic', ...ANSI_COLORS]` for bmad-project
- [x] `src/tui/app.js` -- Add `projectColors` screen route
- [x] `src/tui/widget-registry.js` -- Change project widget: `defaultMode: 'dynamic'`, `defaultColor: null`
- [x] `src/tui/config-loader.js` -- In `ensureWidgetOrder`, init `config.projectColors = {}` if absent (same guard as skillColors)
- [x] `src/reader/bmad-sl-reader.js` -- Add `getProjectColor(project, projectColors)`: check custom override, then hash-based default. Update `COMMANDS.project` to `(s, lc) => colorize(s.project || '', getProjectColor(s.project, lc && lc.projectColors))`. readLineConfig reads `config.projectColors || {}`
- [x] `test/` -- Update fixtures with projectColors, test reader getProjectColor, test project dynamic default

**Acceptance Criteria:**
- Given EditLineScreen with cursor on Project, when Enter pressed, then ProjectColorsScreen opens showing detected projects
- Given ProjectColorsScreen, when ←→ pressed, then project color cycles and persists to `config.projectColors`
- Given ProjectColorsScreen, when `d` pressed, then project reverts to hash-based default
- Given project widget in dynamic mode, when reader renders, then per-project color is applied (custom or hash default)
- Given project widget in fixed mode, when reader renders, then fixed color overrides dynamic (backward compat)
- Given project widget in EditLineScreen, when ←→ pressed, then 'dynamic' is available as first color option

## Verification

**Commands:**
- `node --test test/*.test.js` -- expected: full suite green

## Suggested Review Order

**Reader foundation**

- Hash-based default + custom override for project color
  [`bmad-sl-reader.js:122`](../../bmad-statusline/src/reader/bmad-sl-reader.js#L122)

- COMMANDS.project applies dynamic color via getProjectColor
  [`bmad-sl-reader.js:342`](../../bmad-statusline/src/reader/bmad-sl-reader.js#L342)

- readLineConfig reads projectColors from config
  [`bmad-sl-reader.js:253`](../../bmad-statusline/src/reader/bmad-sl-reader.js#L253)

**TUI new screen**

- Cache-based project detection + color picker
  [`ProjectColorsScreen.js:1`](../../bmad-statusline/src/tui/screens/ProjectColorsScreen.js#L1)

**Entry point & config**

- Enter on Project widget + dynamic in getColorOptions
  [`EditLineScreen.js:37`](../../bmad-statusline/src/tui/screens/EditLineScreen.js#L37)

- Project widget: defaultMode dynamic, defaultColor null
  [`widget-registry.js:6`](../../bmad-statusline/src/tui/widget-registry.js#L6)

- projectColors init in ensureWidgetOrder
  [`config-loader.js:70`](../../bmad-statusline/src/tui/config-loader.js#L70)

**Tests**

- Reader tests updated for dynamic project color
  [`reader.test.js:100`](../../bmad-statusline/test/reader.test.js#L100)
