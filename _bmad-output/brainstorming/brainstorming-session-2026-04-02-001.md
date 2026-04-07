---
stepsCompleted: [1, 2, 3]
inputDocuments: []
session_topic: 'New TUI widgets: File Read, File Edit/Write, Document Name + Step enrichment'
session_goals: 'Add file tracking widgets, document name detection, and frontmatter-based step enrichment'
selected_approach: 'ai-recommended'
techniques_used: ['BMAD skill cartography', 'Morphological Analysis', 'Constraint Mapping', 'SCAMPER']
ideas_generated: ['File Read widget', 'File Edit/Write widget', 'Document Name widget', 'Document Path (dropped — redundant)', 'skill-to-document mapping by output folder', 'frontmatter stepsCompleted parsing for Step enrichment', 'config.yaml resolution for output paths', 'CIS skills excluded (no frontmatter)']
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Fred
**Date:** 2026-04-02

## Session Overview

**Topic:** New TUI widgets for bmad-statusline — file tracking and document awareness
**Goals:** Add widgets to display file operations and workflow documents, enrich Step widget with document state

## Implemented During Session

### File Read (`bmad-fileread`)
- Universal widget, no skill mapping
- Displays: `read {project-relative-path}`
- Color: cyan (fixed)
- Position: between Next Step and Timer
- Default: disabled, on line 2

### File Edit/Write (`bmad-filewrite`)
- Universal widget, no skill mapping
- Displays: `write {path}` or `edit {path}`
- Color: brightRed (fixed), prefix in white
- Position: between File Read and Timer
- Default: disabled, on line 3

## Design — Document Name Widget

### Detection Mechanism
- Hook intercepts **Write/Edit** in known output folders (resolved from config.yaml)
- Workflow NOT in `STORY_WORKFLOWS` → populates `status.document_name`
- Displays **exact filename with extension** (e.g., `prd-v2.md`, `brainstorming-session-2026-04-03-001.md`)

### Output Folder Resolution (from module config.yaml)
| Module | Variable | Default |
|--------|----------|---------|
| core | `output_folder` | `{project-root}/_bmad-output` |
| bmm/gds | `planning_artifacts` | `{project-root}/_bmad-output/planning-artifacts` |
| bmm/gds | `implementation_artifacts` | `{project-root}/_bmad-output/implementation-artifacts` |
| tea | `test_artifacts` | `{project-root}/_bmad-output/test-artifacts` |
| wds | `design_artifacts` | `{project-root}/design-artifacts` |

### Conflict Prevention
- Mapping by **output folder**, not by workflow name
- Write/Edit only (not Read) — avoids contextual reads of old files
- Story workflows filtered out — Story widget handles those

### Document Clusters (Morphological Analysis)

**Singletons (fixed name):** prd.md, architecture.md, ux-design-specification.md, epics.md, sprint-status.yaml, project-context.md
**Dated (multi-session):** brainstorming-session-{date}.md, domain-{topic}-research-{date}.md, all TEA/CIS outputs
**Story-based (filtered):** {epic}-{story}-{title}.md — handled by Story widget
**Versioned:** prd-v2.md, architecture-v2.md — detected by same folder-based mechanism

## Design — Step Widget Enrichment

### Mechanism
- When `step.total` is null (no step files) AND document Write/Edit contains YAML frontmatter with `stepsCompleted[]`
- Parse `content` from payload (no extra I/O)
- `step.current = max(stepsCompleted)`
- Display: `Step 3 completed` (no total known)

### Source Priority
1. **Step files** (current mechanism) — primary, always wins
2. **Frontmatter `stepsCompleted[]`** — fallback when no step files

### CIS Skills (4) — Excluded
- bmad-cis-design-thinking, innovation-strategy, problem-solving, storytelling
- No YAML frontmatter, no step files → Step widget stays empty for these
- Acceptable gap: 4 skills out of 71

## Key Decisions

- Document Path widget **dropped** — redundant with File Read/Write
- File Read: **no filtering**, always shows raw path (technical widget)
- Document Name: exact filename with extension, not a readable label
- Config.yaml paths resolved once and cached (like project detection)
- CIS skills excluded from Step enrichment (no frontmatter)
