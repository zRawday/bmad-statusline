---
title: 'TUI per-skill color picker — module-grouped skill catalog with custom overrides'
type: 'feature'
created: '2026-04-02'
status: 'done'
baseline_commit: 'c14d2f4'
context: ['_bmad-output/project-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Skill colors are hardcoded in `WORKFLOW_COLORS` (covers ~20 of 114 skills). Users cannot customize per-skill colors. Many skills render without color in dynamic mode.

**Approach:** Add a new TUI sub-screen (Enter on Initial Skill widget) showing all 114 BMAD skills organized by module (Core, BMB, BMM, CIS, TEA, GDS, WDS). Users navigate modules, then pick colors per skill with left/right arrows. Custom overrides stored in `config.skillColors`; reader checks overrides before hardcoded defaults.

## Boundaries & Constraints

**Always:**
- Skill catalog covers ALL skills from BMAD 6.2.2 (7 modules, 114 skills excluding `setup-skill-template` which lacks hook-detectable prefix)
- Catalog key = workflow name (what hook writes to `status.workflow`, e.g. `dev-story` not `bmad-dev-story`)
- GDS skills that mirror BMM workflow names (e.g. both produce `dev-story`) share the same color key — changing one affects both
- `config.skillColors` stores only overrides (absent = use default from catalog)
- Reader is CommonJS, zero dependencies, synchronous I/O — no imports from TUI/ESM modules
- Every skill in catalog gets a sensible default color by semantic category

**Ask First:** Adding new color modes beyond the existing ANSI palette.

**Never:** Modify hook logic. Break existing `colorModes.dynamic` behavior. Add runtime dependencies.

</frozen-after-approval>

## Code Map

- `src/tui/skill-catalog.js` -- NEW: module definitions + skill→defaultColor map (static data, ESM)
- `src/tui/screens/SkillColorsScreen.js` -- NEW: two-level screen (module list → skill list with color cycling)
- `src/tui/screens/EditLineScreen.js` -- Enter on Initial Skill navigates to SkillColorsScreen
- `src/tui/app.js` -- Route for skillColors screen
- `src/tui/config-loader.js` -- Preserve `skillColors` during load/validation
- `src/reader/bmad-sl-reader.js` -- Read `config.skillColors`, check before hardcoded map in `getWorkflowColor()`
- `src/defaults.js` -- Extend `WORKFLOW_COLORS` to cover all 114 skills with default colors

## Tasks & Acceptance

**Execution:**
- [x] `src/tui/skill-catalog.js` -- Create module catalog: `SKILL_MODULES` array of `{ id, name, skills: [{ workflow, defaultColor }] }`. 7 modules, 114 skills. Default colors by semantic group: dev=cyan, review=brightRed, planning=green, product=yellow, architecture=magenta, research=blue, creative=brightYellow, docs=brightGreen, quality/test=red, cis=brightMagenta, wds=brightBlue, agents/utility=white
- [x] `src/tui/screens/SkillColorsScreen.js` -- Two-state screen: (1) module list with cursor, Enter to select; (2) skill list within module, left/right to cycle ANSI colors, `d` to reset to default, Esc to go back to module list. Show current color as colored skill name. Use ScreenLayout wrapper
- [x] `src/tui/screens/EditLineScreen.js` -- In normal mode, Enter on `bmad-workflow` widget calls `navigate('skillColors')`. Add Enter to NAVIGATE_SHORTCUTS. Guard: Enter in grab mode unchanged (drop behavior)
- [x] `src/tui/app.js` -- Add `skillColors` screen route rendering SkillColorsScreen with screenProps
- [x] `src/tui/config-loader.js` -- In `isValidV2` and `loadConfig`, preserve `config.skillColors` object (default to `{}` if absent). `ensureWidgetOrder` unchanged
- [x] `src/reader/bmad-sl-reader.js` -- In `readLineConfig`, also read `config.skillColors || {}`. In `getWorkflowColor`, check `skillColors[normalized] || skillColors[workflow]` first, mapping color names to ANSI codes via `COLOR_CODES`, before falling back to hardcoded map
- [x] `src/defaults.js` -- Extend `WORKFLOW_COLORS` to cover all 114 skills. Add missing entries grouped by semantic category
- [x] `test/` -- Tests for SkillColorsScreen (render, navigation, color cycling) and reader skillColors override

**Acceptance Criteria:**
- Given EditLineScreen with cursor on Initial Skill, when Enter pressed, then SkillColorsScreen opens showing module list
- Given SkillColorsScreen module list, when Enter pressed on a module, then skill list for that module is shown with colored names
- Given SkillColorsScreen skill list, when left/right pressed, then skill color cycles through ANSI palette and persists to `config.skillColors`
- Given a custom skillColor set in config, when reader renders workflow widget in dynamic mode, then the custom color is used instead of the hardcoded default
- Given SkillColorsScreen skill list, when `d` pressed, then skill reverts to default color (entry removed from `config.skillColors`)

## Design Notes

**Workflow name collisions:** The hook strips the first prefix (`bmad-dev-story` → `dev-story`, `gds-dev-story` → `dev-story`). GDS skills that mirror BMM skills produce identical workflow names. The catalog lists them under their respective modules for navigation, but the color key is shared. This is correct — the user sees one color for `dev-story` regardless of which module invoked it.

**Reader integration:** The reader (CJS) cannot import the ESM skill catalog. Instead, it reads `config.skillColors` from `config.json` (already loaded via `readLineConfig`). The color name → ANSI code conversion uses the existing `COLOR_CODES` map. Hardcoded `WORKFLOW_COLORS` remains as fallback for users who never open the TUI.

## Verification

**Commands:**
- `node --test test/*.test.js` -- expected: full suite green including new screen tests

## Suggested Review Order

**Skill data & catalog**

- Source of truth: 7 modules, 114 skills with semantic default colors
  [`skill-catalog.js:1`](../../bmad-statusline/src/tui/skill-catalog.js#L1)

**New TUI screen**

- Two-level navigation: module list → skill color picker with ←→ cycling
  [`SkillColorsScreen.js:1`](../../bmad-statusline/src/tui/screens/SkillColorsScreen.js#L1)

**Entry point & routing**

- Enter on Initial Skill widget opens skill colors screen
  [`EditLineScreen.js:120`](../../bmad-statusline/src/tui/screens/EditLineScreen.js#L120)

- Screen route added to app router
  [`app.js:131`](../../bmad-statusline/src/tui/app.js#L131)

**Reader integration**

- Custom skillColors checked before hardcoded map
  [`bmad-sl-reader.js:108`](../../bmad-statusline/src/reader/bmad-sl-reader.js#L108)

- readLineConfig reads skillColors from config.json
  [`bmad-sl-reader.js:214`](../../bmad-statusline/src/reader/bmad-sl-reader.js#L214)

**Config & defaults**

- ensureWidgetOrder initializes skillColors with Array.isArray guard
  [`config-loader.js:67`](../../bmad-statusline/src/tui/config-loader.js#L67)

- WORKFLOW_COLORS expanded: WDS explicit entries, CIS prefix rule, agents, quality
  [`defaults.js:57`](../../bmad-statusline/src/defaults.js#L57)

**Tests & fixtures**

- Fixtures updated with skillColors field
  [`internal-config-default.json:19`](../../bmad-statusline/test/fixtures/internal-config-default.json#L19)
