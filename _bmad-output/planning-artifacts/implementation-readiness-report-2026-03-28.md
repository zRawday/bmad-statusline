---
stepsCompleted:
  - step-01-document-discovery
  - step-02-prd-analysis
  - step-03-epic-coverage-validation
  - step-04-ux-alignment
  - step-05-epic-quality-review
  - step-06-final-assessment
documentsIncluded:
  architecture: _bmad-output/planning-artifacts/architecture.md
  epics: _bmad-output/planning-artifacts/epics.md
  brainstorming: _bmad-output/brainstorming/brainstorming-session-2026-03-28-001.md
  poc_code: bmad-sl-reader.js
  ccstatusline_config: ~/.config/ccstatusline/settings.json
  deferred_work: _bmad-output/implementation-artifacts/deferred-work.md
missingDocuments:
  - PRD (brainstorming used as reference spec)
  - UX Design (not applicable - CLI/config project)
---

# Implementation Readiness Assessment Report

**Date:** 2026-03-28
**Project:** Toulou (bmad-statusline)

## 1. Document Inventory

| Document Type | Status | File |
|---|---|---|
| PRD | ⚠️ Missing (brainstorming as substitute) | `brainstorming-session-2026-03-28-001.md` |
| Architecture | ✅ Found | `architecture.md` |
| Epics & Stories | ✅ Found | `epics.md` |
| UX Design | N/A | Not applicable (CLI/config project) |

### Supplementary Documents

- **PoC Code:** `bmad-sl-reader.js`
- **Real ccstatusline config:** `~/.config/ccstatusline/settings.json`
- **Deferred work (potentially obsolete):** `deferred-work.md`

### Duplicates

None found.

## 2. PRD Analysis (Requirements Extraction)

> Note: No formal PRD exists. Requirements extracted from Architecture document (primary) and Brainstorming session (supplementary reference spec).

### Functional Requirements

**Phase 2 — Distributable Package (9 FRs):**

| # | Requirement | Source |
|---|---|---|
| FR1 | npm package `bmad-statusline` with CLI entry point (`install`, `uninstall`, `clean` commands) | Architecture |
| FR2 | Install — configure ccstatusline in `~/.claude/settings.json`, inject BMAD widgets into `~/.config/ccstatusline/settings.json`, copy reader script to `~/.config/bmad-statusline/`, create `~/.cache/bmad-status/`, add CLAUDE.md instruction block per-project | Architecture |
| FR3 | Uninstall — clean removal of all global and per-project artifacts | Architecture |
| FR4 | Clean — manual cache purge of status and alive files | Architecture |
| FR5 | Dynamic colors — hardcoded maps for agent→color and workflow-category→color | Architecture + Brainstorming |
| FR6 | .alive cleanup system formalized in package (already implemented in reader) | Architecture |
| FR7 | Composite widgets (compact, full, minimal) integrated in default install layout | Architecture + Brainstorming |
| FR8 | Idempotent install — detect existing components, skip what's already configured | Architecture |
| FR9 | Multi-project support — global components installed once, per-project runs only add CLAUDE.md | Architecture |

**Phase 3 — Complete Experience (3 FRs):**

| # | Requirement | Source |
|---|---|---|
| FR10 | TUI configurator (React/Ink) — toggle widgets, fixed/dynamic color modes, target line, reorder, separators, live preview | Architecture + Brainstorming |
| FR11 | Party mode — multi-color rendering for agent array in composite/individual widgets | Architecture |
| FR12 | Optional bmad_init.py patch for auto fields (workflow, project, step.total) | Architecture |

### Non-Functional Requirements

| # | Requirement | Source |
|---|---|---|
| NFR1 | Zero external dependencies for reader script (Node.js stdlib only) — performance critical | Architecture |
| NFR2 | React/Ink as sole additional dependency, scoped to TUI only (Phase 3) | Architecture |
| NFR3 | Cross-platform compatibility — Windows (Git Bash), macOS, Linux | Architecture |
| NFR4 | Idempotent operations — all install/uninstall commands safe to re-run | Architecture |
| NFR5 | Silent error handling — empty string on any reader error | Architecture |
| NFR6 | No daemon, no cron — cleanup piggybacks on reader execution only | Architecture |
| NFR7 | Backup-before-write — installer creates `.bak` of external config files before modification | Architecture |
| NFR8 | Validation post-write — installer rereads and parses written JSON to confirm integrity | Architecture |

### Additional Requirements (from Brainstorming, unnumbered)

- **17 widget definitions** with names, examples, and data sources
- **Conditional display** — Story and Request mutually exclusive in default layout
- **Default layout specification** — Line 2: Project, Agent, Workflow, Story|Request, ProgressStep
- **Data source classification** — Auto (6 fields), Hybrid (1), Agent (7)
- **13 documented edge cases** with solutions
- **Cleanup mechanism** — touch .alive + purge stale > 5 min, piggybacked on reader execution

### PRD Completeness Assessment

The project lacks a formal PRD, but the Architecture document contains well-structured FRs (12) and NFRs (8) with clear numbering and text. The Brainstorming document provides supplementary detail on widget specifications, color maps, layout, and edge cases. Combined, they provide adequate requirements coverage for implementation readiness assessment.

## 3. Epic Coverage Validation

### FR Coverage Matrix

| FR | Requirement | Epic/Story Coverage | Status |
|---|---|---|---|
| FR1 | npm package with CLI entry point | Epic 1 / Story 1.1 | ✓ Covered |
| FR2 | Install — 5 config targets | Epic 1 / Story 1.2 | ✓ Covered |
| FR3 | Uninstall — clean removal | Epic 1 / Story 1.4 | ✓ Covered |
| FR4 | Clean — cache purge | Epic 1 / Story 1.5 | ✓ Covered |
| FR5 | Dynamic colors (ANSI maps) | Epic 1 / Story 1.3 | ✓ Covered |
| FR6 | .alive cleanup system | Epic 1 / Story 1.3 | ✓ Covered |
| FR7 | Composite widgets | Epic 1 / Story 1.3 | ✓ Covered |
| FR8 | Idempotent install | Epic 1 / Story 1.2 | ✓ Covered |
| FR9 | Multi-project support | Epic 1 / Story 1.2 | ✓ Covered |
| FR10 | TUI configurator | Epic 2 / Stories 2.1 + 2.2 | ✓ Covered |
| FR11 | Party mode multi-color | Epic 1 Story 1.3 (reader) + Epic 2 Story 2.2 (TUI) | ✓ Covered |
| FR12 | bmad_init.py patch | Epic 2 / Story 2.3 | ✓ Covered |

### NFR Coverage Matrix

| NFR | Requirement | Stories Addressing | Status |
|---|---|---|---|
| NFR1 | Zero reader dependencies | Story 1.3 | ✓ Covered |
| NFR2 | React/Ink scoped to TUI | Story 2.1 | ✓ Covered |
| NFR3 | Cross-platform compatibility | Story 1.2 | ✓ Covered |
| NFR4 | Idempotent operations | Stories 1.2 + 1.4 | ✓ Covered |
| NFR5 | Silent error handling (reader) | Story 1.3 | ✓ Covered |
| NFR6 | No daemon/cron | Story 1.3 | ✓ Covered |
| NFR7 | Backup-before-write | Stories 1.2 + 1.4 | ✓ Covered |
| NFR8 | Post-write validation | Stories 1.2 + 1.4 | ✓ Covered |

### Missing Requirements

No FRs or NFRs are missing from epic coverage.

### Inconsistencies Found (cross-document)

**INC-1: Widget detection field — `label` vs `id` (CRITICAL)**
- Architecture (Install Scope Detection table): "Labels matching `Bmad*`"
- Epics Story 1.2 AC: "widgets with labels matching `Bmad*`"
- Epics Story 1.4 AC: "widgets with labels matching `Bmad*`"
- **Real ccstatusline config**: Widgets use `id` field, not `label`. PoC uses `id: "bmad-project"` (lowercase, hyphen)
- **Required fix**: All references should say "id matching `bmad-*`" (lowercase, hyphen pattern)

**INC-2: Config format `lines.N.widgets` vs array of arrays (MEDIUM)**
- Architecture (Technical Constraints): "lines.N.widgets array structure"
- **Real ccstatusline v3 format**: `"lines": [ [...], [...], [...] ]` — array of arrays, no `.widgets` property
- **Required fix**: Clarify that `lines` is an array where each element is a widget array

**INC-3: Case sensitivity `Bmad*` vs `bmad-*` (CRITICAL — linked to INC-1)**
- Architecture and Epics use `Bmad*` (PascalCase)
- PoC widgets use `bmad-*` (lowercase with hyphens): `bmad-project`, `bmad-agent`, `bmad-workflow`, etc.
- **Required fix**: Standardize to `bmad-*` pattern to match PoC and real config

**INC-4: Widgets BmadSection and BmadValidation undefined (LOW)**
- Brainstorming defines 17 widgets including BmadSection and BmadValidation
- Neither appears in any story acceptance criteria
- Neither has a corresponding field in the status file format
- **Recommendation**: Confirm intentionally deferred or remove from brainstorming widget count

**INC-5: deferred-work.md obsolete but still referenced (LOW)**
- Listed as input document in epics frontmatter
- Content describes Windows path bug already resolved in architecture (slug resolution)
- **Required fix**: Delete or archive deferred-work.md to avoid misleading dev agents

### Coverage Statistics

- Total FRs: 12
- FRs covered in epics: 12
- FR coverage: **100%**
- Total NFRs: 8
- NFRs covered in epics: 8
- NFR coverage: **100%**
- Cross-document inconsistencies: **5 found** (2 critical, 1 medium, 2 low)

## 4. UX Alignment Assessment

### UX Document Status

**Not Found** — No UX design document exists. Confirmed N/A in document inventory.

### Phase 2 UX Assessment

Phase 2 is CLI-only (install/uninstall/clean commands). No user-facing UI exists. Console output format (✓/○/✗ markers) is fully specified in Architecture Pattern #6. **No UX document needed.**

### Phase 3 UX Assessment

Phase 3 introduces a TUI configurator (React/Ink) per FR10. TUI specifications exist in the Brainstorming document:
- Toggle widgets on/off
- Color mode per widget (Dynamic/Fixed)
- Target ccstatusline line (1, 2, or 3)
- Widget reorder
- Separator styles (Serre/Modere/Large/Custom)
- Composite mode vs individual widgets
- Live preview

These specs provide adequate direction for Phase 3 implementation, but no formal UX design document (wireframes, interaction flows, error states) exists.

### Alignment Issues

None for Phase 2.

### Warnings

- ⚠️ **Phase 3 TUI**: When Phase 3 begins, a formal UX design document is recommended to detail interaction flows, keyboard navigation, error states, and accessibility for the React/Ink TUI. Current brainstorming specs cover features but not interaction design.

## 5. Epic Quality Review

### Epic Structure Validation

| Epic | User Value | Independence | FR Traceability | Verdict |
|---|---|---|---|---|
| Epic 1: Package distributable | ✓ Developer-centric goal | ✓ Standalone | ✓ FR1-FR9 | PASS |
| Epic 2: TUI & personnalisation | ✓ Developer-centric goal | ✓ Depends on E1 output (valid) | ✓ FR10-FR12 | PASS |

No technical-milestone epics. No circular dependencies. Both epics deliver user value.

### Dependency Analysis

```
Story 1.1 (standalone)
  ├── Story 1.2 (install) ──── Story 1.4 (uninstall, reuses detection)
  ├── Story 1.3 (reader colors) [parallel with 1.2]
  └── Story 1.5 (clean) [parallel with 1.2, 1.3]

Story 2.1 (TUI foundation, depends on Epic 1)
  └── Story 2.2 (TUI colors/preview, depends on 2.1)

Story 2.3 (bmad_init.py, independent, depends on Epic 1 only)
```

No forward dependencies. All dependency arrows point backward. Parallelization opportunities correctly identified (1.2, 1.3, 1.5 after 1.1).

### Critical Violations (🔴)

**CRIT-1: Stories 1.2 & 1.4 — "labels matching Bmad*" (linked to INC-1/INC-3)**
- Story 1.2 Target 2 AC: "widgets with labels matching `Bmad*`"
- Story 1.4 Target 2 AC: "widgets with labels matching `Bmad*`"
- Real field is `id`, real pattern is `bmad-*` (lowercase, hyphen)
- **Impact**: Dev agent implementing this literally will search for a `label` field that doesn't exist
- **Remediation**: Replace with "widgets with `id` matching `bmad-*`" in both stories and architecture

### Major Issues (🟠)

**MAJ-1: Story 2.3 — Patch application mechanism undefined**
- AC says "a separate command or TUI option is required" without specifying which
- No CLI command defined, no TUI option specified
- **Impact**: Dev agent won't know what to implement
- **Remediation**: Define explicitly — e.g., CLI command `bmad-statusline patch-init` or TUI option in Story 2.1

**MAJ-2: Story 2.1 — Missing error handling & navigation ACs**
- No AC for corrupted/missing ccstatusline config
- No exit/cancel behavior (Escape, Ctrl+C)
- No keyboard navigation documentation (arrow keys, tab)
- **Impact**: Dev agent will need to invent these behaviors
- **Remediation**: Add ACs for error states, exit flow, and keyboard controls

### Minor Concerns (🟡)

**MIN-1: Story 1.2 — statusLine JSON content unspecified**
- AC references `getStatusLineConfig()` returning "real ccstatusline JSON" but doesn't specify the structure

**MIN-2: Story 1.4 — No explicit restore-from-backup AC on write error**
- Install story specifies restore from `.bak` on validation failure, but uninstall doesn't

**MIN-3: Story 2.2 — Party mode preview data source ambiguous**
- AC references "current status file" but TUI doesn't need a live BMAD session for preview

**MIN-4: Story 2.1 — No AC for TUI launch without prior install**
- What happens if ccstatusline config doesn't exist?

### Acceptance Criteria Quality

| Story | Format (GWT) | Testable | Complete | Specific |
|---|---|---|---|---|
| 1.1 Scaffolding | ✓ | ✓ | ✓ | ✓ |
| 1.2 Install | ✓ | ✓ | ⚠️ INC-1 | ⚠️ MIN-1 |
| 1.3 Reader colors | ✓ | ✓ | ✓ | ✓ |
| 1.4 Uninstall | ✓ | ✓ | ⚠️ INC-1, MIN-2 | ✓ |
| 1.5 Clean | ✓ | ✓ | ✓ | ✓ |
| 2.1 TUI foundation | ✓ | ✓ | ⚠️ MAJ-2, MIN-4 | ✓ |
| 2.2 TUI preview | ✓ | ✓ | ⚠️ MIN-3 | ✓ |
| 2.3 bmad_init.py | ✓ | ⚠️ MAJ-1 | ⚠️ MAJ-1 | ⚠️ MAJ-1 |

### Best Practices Compliance Summary

- ✓ Epics deliver user value (not technical milestones)
- ✓ Epic independence maintained (correct dependency direction)
- ✓ Story sizing appropriate (no epic-sized stories)
- ✓ No forward dependencies
- ✓ FR traceability maintained
- ⚠️ Acceptance criteria contain 1 critical field name error (CRIT-1)
- ⚠️ Phase 3 stories need additional specification (MAJ-1, MAJ-2)

## 6. Summary and Recommendations

### Overall Readiness Status

**PHASE 2 (Epic 1): READY — with mandatory corrections**
**PHASE 3 (Epic 2): NEEDS WORK — before story implementation**

### Consolidated Issue Registry

| ID | Severity | Scope | Issue | Documents Affected |
|---|---|---|---|---|
| INC-1/INC-3/CRIT-1 | 🔴 CRITICAL | Architecture + Epics | Widget detection uses `label`/`Bmad*` — must be `id`/`bmad-*` | architecture.md (line 199), epics.md (Stories 1.2, 1.4) |
| INC-2 | 🟠 MEDIUM | Architecture | `lines.N.widgets` description incorrect — real format is array of arrays | architecture.md (line 64) |
| MAJ-1 | 🟠 MEDIUM | Epics (Phase 3) | Story 2.3 patch mechanism undefined | epics.md (Story 2.3) |
| MAJ-2 | 🟠 MEDIUM | Epics (Phase 3) | Story 2.1 missing TUI error handling & navigation ACs | epics.md (Story 2.1) |
| INC-4 | 🟡 LOW | Brainstorming | BmadSection & BmadValidation widgets defined but absent from stories/status format | brainstorming-session.md |
| INC-5 | 🟡 LOW | Implementation artifacts | deferred-work.md obsolete, still referenced | deferred-work.md, epics.md frontmatter |
| MIN-1 | 🟡 LOW | Epics | Story 1.2 — statusLine JSON content unspecified | epics.md |
| MIN-2 | 🟡 LOW | Epics | Story 1.4 — no restore-from-backup on write error | epics.md |
| MIN-3 | 🟡 LOW | Epics | Story 2.2 — party mode preview data source ambiguous | epics.md |
| MIN-4 | 🟡 LOW | Epics | Story 2.1 — no AC for TUI launch without prior install | epics.md |

### Critical Issues Requiring Immediate Action (before Phase 2 sprint)

1. **Fix `label` → `id` and `Bmad*` → `bmad-*` in architecture and epics** — This is the only blocking issue for Phase 2. Without this correction, Stories 1.2 and 1.4 will produce code that searches for a non-existent `label` field, causing install/uninstall widget detection to silently fail.

2. **Correct `lines.N.widgets` description in architecture** — While less critical (the code structure and examples are correct elsewhere), this description could confuse a dev agent reading the Technical Constraints section.

3. **Delete or archive deferred-work.md** — The bug it describes is resolved. Its continued existence may cause a dev agent to "fix" something already fixed.

### Recommended Next Steps

1. **Immediate (before sprint planning):**
   - Fix INC-1/INC-3/CRIT-1: Replace "labels matching `Bmad*`" with "`id` matching `bmad-*`" in architecture Install Scope Detection table and Stories 1.2, 1.4
   - Fix INC-2: Correct config format description in architecture Technical Constraints
   - Delete `_bmad-output/implementation-artifacts/deferred-work.md`

2. **Before Phase 2 implementation:**
   - Run sprint planning on Epic 1 with corrected stories
   - Confirm INC-4 decision: are BmadSection/BmadValidation deferred to Phase 3+ or dropped?

3. **Before Phase 3 implementation:**
   - Resolve MAJ-1: Define patch mechanism for Story 2.3
   - Resolve MAJ-2: Add TUI error handling and navigation ACs to Story 2.1
   - Create formal UX design document for TUI
   - Address MIN-3, MIN-4

### Strengths Noted

- **FR/NFR coverage is 100%** — no requirements fall through the cracks
- **Architecture quality is high** — clear boundaries, implementation patterns, conflict prevention
- **Story structure is sound** — proper GWT format, dependency analysis, parallelization opportunities
- **Epic design follows best practices** — user value focus, correct independence direction
- **The PoC validates the core concept** — reader works, ccstatusline integration confirmed

### Final Note

This assessment identified **10 issues** across **3 severity levels**: 1 critical (consolidated from 3 related findings), 3 medium, and 6 low. The critical issue is a terminology mismatch that is straightforward to fix — a text correction in 2 documents, not a structural redesign. Once corrected, **Phase 2 (Epic 1) is ready for sprint planning and implementation**. Phase 3 (Epic 2) needs additional specification work on 2 stories before it is implementation-ready.

---

**Assessment Date:** 2026-03-28
**Assessed By:** PM/Scrum Master Agent (Implementation Readiness Workflow)
**Documents Analyzed:** architecture.md, epics.md, brainstorming-session-2026-03-28-001.md, bmad-sl-reader.js, ccstatusline settings.json, deferred-work.md
