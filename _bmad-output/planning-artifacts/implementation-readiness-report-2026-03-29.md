---
stepsCompleted: [1, 2, 3, 4, 5, 6]
status: 'complete'
completedAt: '2026-03-29'
scope: 'Epic 4 only (Stories 4.1-4.8)'
spikeCompleted: true
spikeFindings: 4
inputDocuments:
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/brainstorming/brainstorming-session-2026-03-29-002.md'
  - '_bmad-output/project-context.md'
---

# Implementation Readiness Assessment Report

**Date:** 2026-03-29
**Project:** Toulou (bmad-statusline)
**Scope:** Epic 4 — Stories 4.1 to 4.8 (Phase 4: 5-Signal Hook Evolution)
**Context:** Epics 1-3 delivered. No formal PRD (brainstorming serves as PRD). No UX design (CLI tooling). Spike 4.1 completed.

---

## 1. Document Inventory

| Document | Path | Role |
|----------|------|------|
| Architecture (Rev 2) | `planning-artifacts/architecture.md` | Technical decisions, patterns, schemas |
| Epics & Stories | `planning-artifacts/epics.md` | Story definitions with ACs |
| Brainstorming 002 | `brainstorming/brainstorming-session-2026-03-29-002.md` | Requirements source (PRD equivalent) |
| Project Context | `project-context.md` | AI agent implementation rules |

---

## 2. Spike Findings — Impact on Architecture

The spike (Story 4.1) invalidated 3 assumptions in the current architecture. These require corrections before implementation.

### S1: Field name is `prompt`, not `user_message` — CRITICAL

**What changed:** The UserPromptSubmit payload delivers the user's text in a field called `prompt`, not `user_message`.

**Documents affected:**
- Architecture: Signal 1 payload example, Discrimination Table, Pattern #10 code example
- Story 4.2: 6 ACs reference `user_message`
- Story 4.1: fixture output should use `prompt`

**Correction:** Find-replace `user_message` -> `prompt` in architecture and epics for UserPromptSubmit context.

### S2: UserPromptSubmit matcher does NOT filter — CRITICAL

**What changed:** The matcher `"(?:bmad|gds|wds)-"` on UserPromptSubmit does NOT prevent the hook from firing. ALL user prompts trigger the hook, including plain text like "hello".

**Documents affected:**
- Architecture: Hook config section assumes matcher filters. Performance concern — hook now launches on every prompt, not just skill invocations.
- Story 4.2: AC "Given a prompt that does NOT match... Then the hook does NOT fire (matcher filters it out)" is **wrong**. The hook fires; it must filter internally and exit silently.
- Story 4.1: AC about non-matching prompt confirmed but mechanism is different (hook fires + regex rejects, not hook doesn't fire).

**Correction:**
1. Architecture: Document that matcher is best-effort, hook MUST filter internally. Update or remove the matcher regex from hook config (it has no effect).
2. Story 4.2: Rewrite the non-matching AC: "Given the hook receives a UserPromptSubmit for a prompt not matching the regex, When processed, Then the hook exits silently (internal filtering)."
3. Document performance: Node process launch (~50ms) on every user prompt. Acceptable but a known cost.

### S3: `file_path` uses backslashes on Windows — MEDIUM

**What changed:** Both `cwd` AND `tool_input.file_path` use backslashes on Windows. The project-context.md states `file_path` uses forward slashes — this is wrong.

**Documents affected:**
- Project-context.md: Pattern #3 rationale states "`tool_input.file_path` uses forward slashes on Windows, but `cwd` uses backslashes" — both use backslashes.
- Architecture: Path Normalization pattern code is correct (normalizes everything to forward slashes) but documented rationale is inaccurate.

**Correction:** Fix rationale in project-context.md. No code impact — normalization already handles both directions.

### S4: SessionStart confirmed — OK

`source: "resume"`, same `session_id` preserved, no `permission_mode`. Conforms to architecture. No correction needed.

---

## 3. Architecture-to-Stories Coherence

### 3.1 Discrimination Table Coverage

Every row in the architecture's discrimination table maps to at least one story AC.

| Discrimination Row | Story | Covered |
|---|---|---|
| UserPromptSubmit — matching skill + steps exists | 4.2 | Yes |
| UserPromptSubmit — matching skill, no steps | 4.2 | Yes |
| UserPromptSubmit — no match | 4.2 | Yes (needs AC rewrite per S2) |
| Read step file (multi-track) | 4.3 | Yes |
| Read stories (priority 2, workflow-gated) | 4.4 | Yes |
| Read sprint-status (priority 3, candidate) | 4.4 | Yes |
| Read config.yaml | Phase 2 (unchanged) | N/A |
| Write sprint-status (priority 1) | 4.5 | Yes |
| Write story file (create-story, priority 2) | 4.5 | Yes |
| Edit sprint-status (priority 1) | 4.5 | Yes |
| SessionStart resume | 4.2 | Yes |
| cwd scoping (all Read/Write/Edit) | 4.2 + 4.5 | Yes |

### 3.2 Story Priority System

- `shouldUpdateStory()`: prescriptive code in architecture, truth table tested in Story 4.4 ACs.
- Workflow gating: `STORY_READ_WORKFLOWS` in 4.4, `STORY_WRITE_WORKFLOWS` in 4.5.
- Priority 1 overwrite of locks: Story 4.4 AC (e) explicitly tests this.

### 3.3 Multi-Module Support

- `SKILL_REGEX` tested for bmad, gds, wds in Story 4.2.
- Dynamic slicer verified for all 3 prefixes in Story 4.2.
- Status file stores both `skill` (full) and `workflow` (stripped) per Story 4.2 AC.

### 3.4 Install / Uninstall / Clean

- 5 matchers across 3 event types — Story 4.6.
- Upgrade path Phase 2 -> 4 — Story 4.6.
- 3-generation backward compat uninstall — Story 4.7.
- Alive-based cleanup — Story 4.8.

### 3.5 FR Coverage Map

All Phase 4 functional requirements (FR19-FR36) are mapped to stories. No orphan FRs.

| FRs | Story | Description |
|-----|-------|-------------|
| FR19-21, FR28-30 | 4.2 | UserPromptSubmit, multi-module, cwd guard, SessionStart, alive |
| FR22-23 | 4.3 | Multi-track step detection + total |
| FR24-25 | 4.4 | Story priority & locking |
| FR26-27 | 4.5 | Write & Edit handlers |
| FR31-33 | 4.6 | Installer 5-matcher + upgrade |
| FR34-35 | 4.7 | Uninstaller 3-generation |
| FR36 | 4.8 | Clean alive-based + README |

### 3.6 Brainstorming-to-Architecture Alignment

All 8 brainstorming decisions are reflected in the architecture. No drift.

| Decision | Aligned |
|---|---|
| 5 hooks (UPS, Read, Write, Edit, SessionStart) | Yes |
| Multi-module regex `/((?:bmad\|gds\|wds)-[\w-]+)/` | Yes |
| Dynamic slicer after first `-` | Yes |
| Story priority 3-level system | Yes |
| Multi-track step regex | Yes |
| cwd scoping bug fix | Yes |
| Session resume 7-day alive | Yes |
| ~32 skills without step tracking | Yes |

---

## 4. Story Dependencies

```
4.1 (spike) -----> 4.2 (hook entry + UPS + cwd + alive)
                     |
              +------+------+
              |             |
             4.3           4.4
        (multi-track)  (story priority)
              |             |
              +------+------+
                     |
                    4.5 (Write/Edit handlers)
                     |
                    4.6 (installer 5-matcher)
                     |
                    4.7 (uninstaller 3-gen)
                     |
                    4.8 (clean + README)
```

Dependencies are logical and correctly ordered. 4.3 and 4.4 are parallelizable after 4.2.

---

## 5. AC Testability Assessment

| Story | ACs | Testable | Issues |
|---|---|---|---|
| 4.1 | 6 | All | Completed (spike done) |
| 4.2 | 14 | 13/14 | 1 AC needs rewrite (S2: matcher filtering) |
| 4.3 | 9 | 8/9 | Sort order for next step unspecified (G4) |
| 4.4 | 10 | 9/10 | "9 combinations" should be 12 (G3) |
| 4.5 | 11 | 9/11 | Edit extraction underspecified (G1), active status undefined (G2) |
| 4.6 | 8 | All | Clean |
| 4.7 | 9 | All | Clean |
| 4.8 | 7 | All | Clean |

---

## 6. Findings

### CRITICAL — Require correction before implementation

| # | Finding | Stories | Action |
|---|---------|---------|--------|
| S1 | Field is `prompt`, not `user_message` | 4.2 | Find-replace in architecture + epics |
| S2 | Matcher does NOT filter UserPromptSubmit — hook fires on every prompt | 4.2 | Rewrite AC + document internal filtering + performance note |
| S3 | `file_path` uses backslashes on Windows (project-context rationale wrong) | 4.2 | Fix rationale (no code impact) |

### HIGH — Require clarification before Stories 4.4/4.5

| # | Finding | Stories | Action |
|---|---------|---------|--------|
| G1 | Edit sprint-status story extraction underspecified — AC says "extracts the story key near the status change" but `tool_input.new_string` is a replacement fragment that may not contain the story identifier. No regex defined. | 4.5 | Define extraction regex or fallback when story key absent from diff |
| G2 | Sprint-status "active status" values undefined — no definition of which YAML status values qualify as "active" (`in-progress`? `started`?). No sprint-status schema documented. | 4.4, 4.5 | Define the list of active status values or reference the schema |

### MEDIUM — Should be fixed, non-blocking

| # | Finding | Stories | Action |
|---|---------|---------|--------|
| G3 | `shouldUpdateStory` "all 9 combinations" is actually 12 — 3 priorities x 4 states (null, 1, 2, 3) | 4.4 | Fix AC to "all priority/state combinations" |
| G4 | Sort order for next step derivation unspecified — `readdirSync` returns OS-dependent order | 4.3 | Add AC: "files sorted alphanumerically before deriving next step" |
| G5 | Multiple skill names in single prompt — first regex match wins, edge case undocumented | 4.2 | Document as known edge case |

### LOW — Informational

| # | Finding | Stories | Action |
|---|---------|---------|--------|
| G6 | Story 2.4 (health check) appears after Epic 4 stories, numbered 2.4 not 4.x | N/A | Confirm out of scope for Epic 4 |
| G7 | project-context.md describes Phase 2 state (2-signal hook) | N/A | Update after Epic 4 implementation |

### RISK — Known, documented

| # | Risk | Mitigation | Status |
|---|------|------------|--------|
| R1 | UserPromptSubmit payload format | Spike completed — format known. Corrections S1-S3 needed. | Validated |
| R2 | Sub-agent session_id sharing | Unknown if sub-agents share parent session_id. cwd scoping mitigates partially. | Deferred (documented in architecture) |

---

## 7. Verdict

### Overall Status: READY FOR IMPLEMENTATION

The specs are comprehensive, well-aligned, and cover all functional requirements. The architecture provides prescriptive code patterns, the stories have concrete Given/When/Then ACs, and all brainstorming decisions are fully reflected.

### Conditions

**Before starting Story 4.2:**
- Apply spike corrections S1, S2, S3 to architecture.md, epics.md, and project-context.md

**Before starting Stories 4.4/4.5:**
- Clarify G1 (Edit sprint-status extraction regex) and G2 (active status values)

**Non-blocking (fix during implementation):**
- G3 (test count label), G4 (sort order), G5 (multi-match edge case)
