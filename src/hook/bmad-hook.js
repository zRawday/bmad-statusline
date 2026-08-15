// bmad-hook.js — 12-signal hook entry point for passive workflow detection
// CommonJS, zero dependencies, synchronous I/O only, silent always

// ─── 1. Requires ───────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── 2. Constants ──────────────────────────────────────────────────────────────
const CACHE_DIR = process.env.BMAD_CACHE_DIR || path.join(os.homedir(), '.cache', 'bmad-status');
const CONFIG_DIR = process.env.BMAD_CONFIG_DIR || path.join(os.homedir(), '.config', 'bmad-statusline');
// Auto-allow is machine-wide when the global flag is on (deliberate human decision),
// so the allowlist is the guard: only tools that never ask the human a question can
// ever be auto-approved. Anything not listed here falls through to Claude Code.
const AUTO_ALLOW_TOOLS = new Set(['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch']);
const STORY_WORKFLOWS = ['create-story', 'dev-story', 'code-review'];
const STORY_READ_WORKFLOWS = ['dev-story', 'code-review'];
const STORY_WRITE_WORKFLOWS = ['create-story'];
const STORY_PRIORITY = { SPRINT_STATUS: 1, STORY_FILE: 2, CANDIDATE: 3 };
// Single source for what a story key looks like ("2-4-export-csv", "1-1a-fix"):
// numbers capped at 1–3 digits so 4-digit years ("2026-07-retro-notes") don't match,
// slug must start with a letter. Every story detector below derives from this.
const STORY_KEY_SRC = '\\d{1,3}[a-z]?-\\d{1,3}[a-z]?-[a-zA-Z][\\w-]*';
const STORY_FILE_REGEX = new RegExp('\\/(' + STORY_KEY_SRC + ')\\.md$');
const SPRINT_READ_STORY_REGEX = new RegExp('^\\s+(' + STORY_KEY_SRC + '):\\s*in-progress\\s*(?:$|#)');
const SPRINT_WRITE_STORY_REGEX = new RegExp('^\\s+(' + STORY_KEY_SRC + '):\\s*(\\S+)');
const STORY_KEY_REGEX = new RegExp('(' + STORY_KEY_SRC + ')');
const SKILL_REGEX = /^\s*\/?((?:bmad|gds|wds)-[\w-]+)/;
const LEGACY_COMMAND_REGEX = /^\s*\/?(bmad(?::[\w-]+)+)/;
// Story id typed in a prompt (after stripping any leading skill command). Group 1
// captures an optional leading "story" keyword (an explicit signal); group 2 is the
// epic-story id ("2-4", bis "1-1a", or full slug "2-4-export-csv"). Numbers capped at
// 1–3 digits so 4-digit years ("2024-01") don't match (2-digit pairs stay ambiguous).
const PROMPT_STORY_REGEX = /^[\s:]*(story\s+)?(\d{1,3}[a-z]?-\d{1,3}[a-z]?(?:-[a-zA-Z][\w-]*)?)\b/i;
const STEP_REGEX = /\/steps(-[a-z])?\/step-(?:[a-z]-)?(\d+)[a-z]?-(.+)\.md$/;

function normalize(p) {
  let n = p.replace(/\\/g, '/').replace(/\/+$/, '');
  if (/^[A-Z]:\//.test(n)) n = n[0].toLowerCase() + n.slice(1);
  return n;
}
function isSafeId(id) { return typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id); }
const MAX_HISTORY = 500;
function trimHistory(arr) { if (arr.length > MAX_HISTORY) arr.splice(0, arr.length - MAX_HISTORY); }
// Edit payloads can carry 100KB+ old/new strings; stored verbatim they balloon the
// status file toward the 10MB cap, and BOTH hot paths (hook + reader) re-parse that
// file constantly. Mirror the 1000-char Bash command truncation.
const MAX_EDIT_STRING = 2000;
function truncateEditString(s) {
  if (typeof s !== 'string') return s ?? null;
  return s.length > MAX_EDIT_STRING ? s.slice(0, MAX_EDIT_STRING) : s;
}

// Synchronous backoff for transient FS contention (the hook is sync-only by design).
function sleepSync(ms) {
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch (_) {}
}

// Set when readStatus finds an EXISTING status file it cannot read this process
// (caught mid-write torn JSON, or locked by a concurrent rename on Windows). Guards
// writeStatus from clobbering the last-good file with default (null) values. Safe as
// module state: each hook invocation handles exactly one event, then exits.
let _statusReadUnsafe = false;

function shouldUpdateStory(incomingPriority, currentPriority) {
  if (incomingPriority === STORY_PRIORITY.SPRINT_STATUS) return true;
  if (incomingPriority === STORY_PRIORITY.STORY_FILE && (!currentPriority || currentPriority === STORY_PRIORITY.CANDIDATE)) return true;
  if (incomingPriority === STORY_PRIORITY.CANDIDATE && !currentPriority) return true;
  return false;
}

function isAutoAllowEnabled(sid) {
  if (!isSafeId(sid)) return false;
  // 1. Per-session flag (highest priority)
  try {
    const flag = fs.readFileSync(path.join(CACHE_DIR, '.autoallow-' + sid), 'utf8').trim();
    if (flag === 'off') return false;
    if (flag === 'on') return true;
  } catch {} // absent — fall through
  // 2. Global flag in config.json
  try {
    const config = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'config.json'), 'utf8'));
    return config.autoAllow === true;
  } catch {}
  return false;
}

// Fail closed on anything that is not a non-empty string, so a malformed payload can
// never widen approval. MCP tool names are server-generated and cannot be enumerated
// in advance, hence the prefix rule.
function isAutoAllowableTool(name) {
  if (typeof name !== 'string' || !name) return false;
  return AUTO_ALLOW_TOOLS.has(name) || name.startsWith('mcp__');
}

function extractStep(filePath) {
  const match = normalize(filePath).match(STEP_REGEX);
  if (!match) return null;
  return {
    track: match[1] || '',
    number: parseInt(match[2], 10),
    name: match[3]
  };
}

// ─── 3. Stdin parsing ─────────────────────────────────────────────────────────
if (process.stdin.isTTY) process.exit(0); // Not piped — exit immediately
let payload;
try {
  const raw = fs.readFileSync(0, 'utf8');
  payload = JSON.parse(raw);
} catch (e) {
  process.exit(0);
}

// ─── 3b. Early SessionEnd: delete alive file, then exit before any cwd work ──
{
  const _ev = payload.hook_event_name;
  const _sid = payload.session_id;
  if (_ev === 'SessionEnd' && isSafeId(_sid)) {
    try { fs.unlinkSync(path.join(CACHE_DIR, '.alive-' + _sid)); } catch {}
    process.exit(0);
  }
}

// ─── 3c. Early SessionStart: auto-heal a corrupted ccstatusline npx cache ────
// Claude Code's statusLine runs `npx -y ccstatusline@latest`. On Windows the
// npx cache entry can lose its bin shims (ccstatusline.cmd/.ps1), leaving the
// status line blank while the monitor keeps working. Purge only structurally
// broken ccstatusline entries so the next npx call regenerates them cleanly.
// Runs before the _bmad walk-up, which is where cwd gets resolved. Always silent.
if (payload.hook_event_name === 'SessionStart') {
  try { healCcstatuslineNpxCache(); } catch {}
}

// ─── 4. Detect: _bmad/ existence (walk up to find it) ────────────────────────
// Detection, NOT a gate: a missing _bmad/ means a non-BMAD session, which we still
// track (project + llm state + history) so the widgets and monitor keep working.
// Path-derived fields (step, story, document_name) stay null there since nothing
// resolves against a bmadRoot. skill/workflow are prompt-derived, not path-derived,
// so a `/bmad-*` command typed outside a BMAD project still names the workflow.
let cwd = payload.cwd;
if (!cwd) process.exit(0);
let bmadRoot = cwd;
let walkDepth = 0;
let foundBmad = true;
const MAX_WALK_DEPTH = 20;
while (!fs.existsSync(path.join(bmadRoot, '_bmad'))) {
  const parent = path.dirname(bmadRoot);
  if (parent === bmadRoot) { foundBmad = false; break; } // reached filesystem root
  if (++walkDepth > MAX_WALK_DEPTH) { foundBmad = false; break; } // depth limit
  bmadRoot = parent;
}
if (foundBmad) cwd = bmadRoot; // else keep payload.cwd — non-BMAD session

// ─── 5. Alive touch ──────────────────────────────────────────────────────────
const sessionId = payload.session_id;
const clientPid = touchAlive(sessionId);

// ─── 5a. Stale session cleanup (same claude.exe PID, different session) ─────
// Only a new session can leave a stale sibling behind (e.g. /clear reuses the
// claude.exe PID under a fresh session id), so scanning the whole cache dir on
// every tool event is wasted I/O — gate it to session-start-ish events.
if (payload.hook_event_name === 'UserPromptSubmit' || payload.hook_event_name === 'SessionStart') {
  try {
    if (clientPid && /^\d+$/.test(clientPid)) {
      for (const f of fs.readdirSync(CACHE_DIR)) {
        if (!f.startsWith('.alive-')) continue;
        const otherSid = f.slice('.alive-'.length);
        if (otherSid === sessionId) continue;
        try {
          if (fs.readFileSync(path.join(CACHE_DIR, f), 'utf8').trim() === clientPid) {
            fs.unlinkSync(path.join(CACHE_DIR, f));
            // Status file preserved — orphan cleanup handles stale status files
          }
        } catch {}
      }
    }
  } catch {}
}

// ─── 5b. Project + output folders detection ─────────────────────────────────
const earlyStatus = readStatus(sessionId);
let earlyDirty = false;
let configRaw = '';
if (!earlyStatus.project || !earlyStatus._outputFolders) {
  try {
    configRaw = fs.readFileSync(path.join(cwd, '_bmad', 'bmm', 'config.yaml'), 'utf8');
  } catch (e) { /* silent */ }
}
if (!earlyStatus.project) {
  const pm = configRaw.match(/project_name:[ \t]*['"]?([^'"\n]+)/);
  // Strip control chars (a hostile repo's config.yaml could smuggle terminal escape
  // sequences into a value the reader prints verbatim) and cap the length.
  if (pm) earlyStatus.project = pm[1].trim().replace(/[\x00-\x1f\x7f]/g, '').slice(0, 100);
  if (!earlyStatus.project) {
    // basename is '' when cwd is a filesystem root ('/' normalizes to ''), which would
    // leave project falsy and rewrite the status file on every event. Reachable now that
    // a rootless cwd no longer exits at the walk-up.
    earlyStatus.project = normalize(cwd).split('/').pop() || normalize(cwd) || 'root';
  }
  earlyDirty = true;
}
if (!earlyStatus._outputFolders) {
  const folders = [];
  const folderKeys = {
    output_folder: '_bmad-output',
    planning_artifacts: '_bmad-output/planning-artifacts',
    implementation_artifacts: '_bmad-output/implementation-artifacts',
    test_artifacts: '_bmad-output/test-artifacts',
    design_artifacts: 'design-artifacts',
  };
  for (const [key, fallback] of Object.entries(folderKeys)) {
    const m = configRaw.match(new RegExp(key + ':[ \\t]*[\'"]?([^\'"\\n]+)'));
    let resolved = m ? m[1].trim().replace(/\{project-root\}/g, cwd) : path.join(cwd, fallback);
    // A config value without {project-root} may be relative — an absolute normPath
    // can never startWith a relative folder, so document detection would go dark.
    if (!path.isAbsolute(resolved)) resolved = path.join(cwd, resolved);
    folders.push(normalize(resolved));
  }
  earlyStatus._outputFolders = folders;
  earlyDirty = true;
}
if (earlyDirty) {
  writeStatus(sessionId, earlyStatus);
}

// ─── 6. Dispatch on hook_event_name ───────────────────────────────────────────
const hookEvent = payload.hook_event_name;

if (hookEvent === 'UserPromptSubmit') {
  handleUserPrompt();
} else if (hookEvent === 'PreToolUse') {
  setLlmState('active');
} else if (hookEvent === 'PostToolUse') {
  const toolName = payload.tool_name;
  if (toolName === 'Read') {
    handleRead();
  } else if (toolName === 'Write') {
    handleWrite();
  } else if (toolName === 'Edit') {
    handleEdit();
  } else if (toolName === 'Bash') {
    handleBash();
  }
} else if (hookEvent === 'Stop') {
  setLlmState('waiting');
} else if (hookEvent === 'StopFailure') {
  setLlmState('error', { error_type: payload.error_type ?? 'unknown' });
} else if (hookEvent === 'PermissionRequest') {
  handlePermissionRequest();
} else if (hookEvent === 'PermissionDenied') {
  setLlmState('active');
} else if (hookEvent === 'PostToolUseFailure') {
  setLlmState(payload.is_interrupt === true ? 'interrupted' : 'active');
} else if (hookEvent === 'SubagentStart') {
  setLlmState('active', { subagent_type: payload.agent_type ?? 'unknown' });
} else if (hookEvent === 'SubagentStop') {
  setLlmState('active');
} else if (hookEvent === 'SessionStart') {
  // no-op — alive already touched
}
// SessionEnd never reaches this dispatcher: block 3b handles it and exits.

process.exit(0);

// ─── 7. handleUserPrompt (intent signal) ─────────────────────────────────────
function handleUserPrompt() {
  const status = earlyStatus;
  const now = new Date().toISOString();

  // Always mark active on any prompt submission
  status.llm_state = 'active';
  status.llm_state_since = now;
  status.subagent_type = null;
  status.error_type = null;

  // Timer anchor: first prompt of the session. In a BMAD session the skill-change
  // branch below overwrites this, so per-workflow timing is unchanged; outside BMAD
  // no skill ever matches, so this is the only thing that makes the timer tick.
  if (!status.started_at) status.started_at = now;

  // Skill detection — only update skill fields when prompt matches
  const prompt = payload.prompt;
  if (prompt) {
    let skillName, workflowName;
    let match = prompt.match(SKILL_REGEX);
    // A leading "/" is an unambiguous command. Without it, prose that merely starts
    // with a bmad-/gds-/wds- token ("bmad-statusline shows a bug") would register as
    // a skill change and wipe the live workflow state — accept slash-less matches
    // only when the skill actually exists in the project.
    if (match && !prompt.trimStart().startsWith('/')
        && !fs.existsSync(path.join(cwd, '.claude', 'skills', match[1]))) {
      match = null;
    }
    const legacyMatch = match ? null : prompt.match(LEGACY_COMMAND_REGEX);
    if (match) {
      skillName = match[1];
      workflowName = skillName.slice(skillName.indexOf('-') + 1);
    } else if (legacyMatch) {
      skillName = legacyMatch[1];
      const parts = skillName.split(':');
      workflowName = parts[parts.length - 1];
    }

    if (skillName) {
      // Preserve started_at if same skill; reset on skill change
      if (status.skill !== skillName) {
        status.started_at = now;
        status.step = { current: null, current_name: null, next: null, next_name: null, total: null, track: null };
        status.story = null;
        status.story_priority = null;
        status.active_skill = null;
        status.last_read = null;
        status.last_write = null;
        status.last_write_op = null;
        status.document_name = null;
        status.reads = [];
        status.writes = [];
        status.commands = [];
      }
      status.skill = skillName;
      status.workflow = workflowName;
    }

    // Prompt-based story detection (create-story / dev-story / code-review):
    // "/bmad-dev-story 2-4 ..." in this prompt, or a follow-up "2-4 ..." /
    // "story 2-4 ..." once the workflow is already active. Explicit signals (a skill
    // command bearing the id, or the "story" keyword) LOCK at STORY_FILE priority; a
    // bare follow-up id is only a CANDIDATE, so a later real story-file Read can correct
    // or enrich it (e.g. a prose "5-6 errors" false positive is recoverable).
    if (STORY_WORKFLOWS.includes(status.workflow)) {
      const cmd = match || legacyMatch;
      const rest = cmd ? prompt.slice(cmd[0].length) : prompt;
      const sm = rest.match(PROMPT_STORY_REGEX);
      if (sm) {
        const explicit = !!cmd || !!sm[1];
        const priority = explicit ? STORY_PRIORITY.STORY_FILE : STORY_PRIORITY.CANDIDATE;
        // An explicit id in a NEW prompt postdates any previous same-priority lock
        // ("/bmad-create-story 3-2" right after finishing 3-1 must switch) — only a
        // sprint-status write (priority 1) stays authoritative.
        const allow = explicit
          ? status.story_priority !== STORY_PRIORITY.SPRINT_STATUS
          : shouldUpdateStory(priority, status.story_priority);
        if (allow) {
          status.story = sm[2];
          status.story_priority = priority;
        }
      }
    }
  }

  writeStatus(sessionId, status);
}

// ─── 7b. Shared preamble for the three file events (Read/Write/Edit) ────────
// Path normalization, in-project classification, display path, active-state stamp.
function beginFileEvent(filePath) {
  const normPath = normalize(filePath);
  const normCwd = normalize(cwd);
  const inProject = normPath.toLowerCase().startsWith(normCwd.toLowerCase() + '/');
  const status = earlyStatus;
  const now = new Date().toISOString();

  // File tracking: project-relative (strip project folder prefix) or full path
  let displayPath = inProject ? normPath.slice(normCwd.length + 1) : normPath;
  if (inProject && status.project && displayPath.startsWith(status.project + '/')) {
    displayPath = displayPath.slice(status.project.length + 1);
  }

  status.llm_state = 'active';
  status.llm_state_since = now;
  status.subagent_type = null;
  status.error_type = null;

  return { status, normPath, inProject, displayPath, now };
}

// ─── 8. handleRead (data signal) ─────────────────────────────────────────────
function handleRead() {
  const filePath = payload.tool_input && payload.tool_input.file_path;
  if (!filePath || typeof filePath !== 'string') {
    return;
  }

  const { status, normPath, inProject, displayPath, now } = beginFileEvent(filePath);
  status.last_read = displayPath;

  // History: append to reads[]
  if (!Array.isArray(status.reads)) status.reads = [];
  if (canAppendHistory(sessionId)) {
    status.reads.push({ path: displayPath, in_project: inProject, at: now, agent_id: payload.agent_id || null });
    trimHistory(status.reads);
  }

  if (!inProject) {
    writeStatus(sessionId, status);
    return;
  }

  // Need active skill/workflow for step and story detection
  const activeSkill = status.skill;
  const activeWorkflow = status.workflow;

  // Active skill detection: Read from .claude/skills/{skill}/ (v6.2.2+) or _bmad/.../{skill}/ (legacy)
  const skillPathMatch = normPath.match(/\.claude\/skills\/((?:bmad|gds|wds)-[\w-]+)\//)
    || normPath.match(/\/_bmad\/(?:[^/]+\/)*?((?:bmad|gds|wds)-[\w-]+)\//);
  if (skillPathMatch && activeWorkflow && !activeWorkflow.includes('builder')) {
    const detectedSkill = skillPathMatch[1];
    const detectedWorkflow = detectedSkill.slice(detectedSkill.indexOf('-') + 1);
    // Mutation only — every exit path below ends in writeStatus, so a mid-handler
    // write here would just double the rename contention on the status file.
    if (detectedWorkflow !== activeWorkflow) {
      status.active_skill = detectedWorkflow;
    } else {
      status.active_skill = null;
    }
  }

  if (!activeWorkflow) {
    writeStatus(sessionId, status);
    return;
  }

  // Step detection (multi-track: steps/, steps-c/, steps-v/, etc.)
  const stepInfo = extractStep(filePath);
  if (stepInfo) {
    // False positive prevention: must be in active skill's steps dir
    const skillForPath = activeSkill || ('bmad-' + activeWorkflow);
    const stepsDir = path.join(cwd, '.claude', 'skills', skillForPath, 'steps' + stepInfo.track);
    const expectedPrefix = normalize(stepsDir) + '/';
    // Case-insensitive like every other path comparison in this file — on Windows a
    // casing mismatch would otherwise silently kill step tracking.
    if (!normPath.toLowerCase().startsWith(expectedPrefix.toLowerCase())) {
      writeStatus(sessionId, status);
      return;
    }

    status.step = status.step || {};
    status.step.current = stepInfo.number;
    status.step.current_name = stepInfo.name;

    // One directory scan serves both total (on first Read / track change) and next.
    const trackChanged = status.step.track !== stepInfo.track;
    const needTotal = status.step.total === null || status.step.total === undefined || trackChanged;
    try {
      const files = fs.readdirSync(stepsDir);
      const stepMap = new Map(); // number → main step (no letter suffix) when available
      for (const f of files) {
        const m = f.match(/^step-(?:[a-z]-)?(\d+)[a-z]?-(.+)\.md$/);
        if (m) {
          const num = parseInt(m[1], 10);
          if (!stepMap.has(num) || !f.match(/^step-(?:[a-z]-)?(\d+)[a-z]-/)) {
            stepMap.set(num, { number: num, name: m[2] });
          }
        }
      }
      if (needTotal) status.step.total = stepMap.size;
      const sorted = [...stepMap.values()].sort((a, b) => a.number - b.number);
      const idx = sorted.findIndex(s => s.number === stepInfo.number);
      if (idx >= 0 && idx + 1 < sorted.length) {
        status.step.next = sorted[idx + 1].number;
        status.step.next_name = sorted[idx + 1].name;
      } else {
        status.step.next = null;
        status.step.next_name = null;
      }
    } catch (e) {
      if (needTotal) status.step.total = null;
      status.step.next = null;
      status.step.next_name = null;
    }
    status.step.track = stepInfo.track;

    writeStatus(sessionId, status);
    return;
  }

  // Sprint-status Read → candidate (priority 3)
  if (normPath.match(/sprint-status[^/]*\.yaml$/)) {
    if (STORY_WORKFLOWS.includes(activeWorkflow)) {
      const content = payload.tool_response && payload.tool_response.file
        && payload.tool_response.file.content;
      if (typeof content === 'string') {
        const activeStories = [];
        const lines = content.split('\n');
        for (const line of lines) {
          const m = line.match(SPRINT_READ_STORY_REGEX);
          if (m) activeStories.push(m[1]);
        }
        if (activeStories.length === 1 && shouldUpdateStory(STORY_PRIORITY.CANDIDATE, status.story_priority)) {
          status.story = activeStories[0];
          status.story_priority = STORY_PRIORITY.CANDIDATE;
        }
      }
    }
    writeStatus(sessionId, status);
    return;
  }

  // Story file Read → priority 2 (lock)
  const storyMatch = normPath.match(STORY_FILE_REGEX);
  if (storyMatch) {
    if (STORY_READ_WORKFLOWS.includes(activeWorkflow)
        && shouldUpdateStory(STORY_PRIORITY.STORY_FILE, status.story_priority)) {
      status.story = storyMatch[1];
      status.story_priority = STORY_PRIORITY.STORY_FILE;
    }
    writeStatus(sessionId, status);
    return;
  }

  // No specific detection triggered — persist file tracking if needed
  writeStatus(sessionId, status);
}

// ─── 9. handleWrite (story confirmation signal) ─────────────────────────────
function handleWrite() {
  const filePath = payload.tool_input && payload.tool_input.file_path;
  if (!filePath || typeof filePath !== 'string') return;

  const { status, normPath, inProject, displayPath, now } = beginFileEvent(filePath);
  status.last_write = displayPath;
  status.last_write_op = 'write';

  // History: append to writes[]
  if (!Array.isArray(status.writes)) status.writes = [];
  if (!Array.isArray(status.reads)) status.reads = [];
  if (canAppendHistory(sessionId)) {
    // is_new is best-effort: after history cap, reads[] may have been truncated
    const isNew = !status.reads.some(function(r) { return r.path === displayPath; });
    status.writes.push({ path: displayPath, in_project: inProject, op: 'write', is_new: isNew, at: now, agent_id: payload.agent_id || null, old_string: null, new_string: null });
    trimHistory(status.writes);
  }

  if (!inProject) {
    writeStatus(sessionId, status);
    return;
  }

  const activeWorkflow = status.workflow;

  // Document name + step enrichment (works with or without active workflow)
  const writeContent = payload.tool_input.content;
  detectDocumentAndStep(status, normPath, writeContent);

  if (!activeWorkflow) {
    writeStatus(sessionId, status);
    return;
  }

  // Sprint-status Write → priority 1
  if (normPath.match(/sprint-status[^\/]*\.yaml$/)) {
    if (STORY_WORKFLOWS.includes(activeWorkflow)) {
      const content = writeContent;
      if (typeof content === 'string') {
        const lines = content.split('\n');
        for (const line of lines) {
          const m = line.match(SPRINT_WRITE_STORY_REGEX);
          if (m && m[2] !== 'backlog' && m[2] !== 'done') {
            if (shouldUpdateStory(STORY_PRIORITY.SPRINT_STATUS, status.story_priority)) {
              status.story = m[1];
              status.story_priority = STORY_PRIORITY.SPRINT_STATUS;
            }
            break;
          }
        }
      }
    }
    writeStatus(sessionId, status);
    return;
  }

  // Story file Write → priority 2 (lock)
  const storyMatch = normPath.match(STORY_FILE_REGEX);
  if (storyMatch) {
    if (STORY_WRITE_WORKFLOWS.includes(activeWorkflow)
        && shouldUpdateStory(STORY_PRIORITY.STORY_FILE, status.story_priority)) {
      status.story = storyMatch[1];
      status.story_priority = STORY_PRIORITY.STORY_FILE;
    }
    writeStatus(sessionId, status);
    return;
  }

  // No specific detection triggered — persist file tracking if needed
  writeStatus(sessionId, status);
}

// ─── 10. handleEdit (story confirmation signal) ─────────────────────────────
function handleEdit() {
  const filePath = payload.tool_input && payload.tool_input.file_path;
  if (!filePath || typeof filePath !== 'string') return;

  const { status, normPath, inProject, displayPath, now } = beginFileEvent(filePath);
  status.last_write = displayPath;
  status.last_write_op = 'edit';

  // History: append to writes[]
  if (!Array.isArray(status.writes)) status.writes = [];
  if (canAppendHistory(sessionId)) {
    status.writes.push({ path: displayPath, in_project: inProject, op: 'edit', is_new: false, at: now, agent_id: payload.agent_id || null, old_string: truncateEditString(payload.tool_input.old_string), new_string: truncateEditString(payload.tool_input.new_string) });
    trimHistory(status.writes);
  }

  if (!inProject) {
    writeStatus(sessionId, status);
    return;
  }

  const activeWorkflow = status.workflow;

  // Document name detection only — skip step enrichment for Edit (partial content unreliable)
  detectDocumentAndStep(status, normPath, null);

  if (!activeWorkflow) {
    writeStatus(sessionId, status);
    return;
  }

  // Sprint-status Edit → priority 1
  if (normPath.match(/sprint-status[^\/]*\.yaml$/)) {
    if (STORY_WORKFLOWS.includes(activeWorkflow)) {
      const newStr = payload.tool_input.new_string;
      const oldStr = payload.tool_input.old_string;
      const newMatch = typeof newStr === 'string' && newStr.match(STORY_KEY_REGEX);
      const oldMatch = typeof oldStr === 'string' && oldStr.match(STORY_KEY_REGEX);
      const storyKey = (newMatch && newMatch[1]) || (oldMatch && oldMatch[1]);
      if (storyKey && shouldUpdateStory(STORY_PRIORITY.SPRINT_STATUS, status.story_priority)) {
        status.story = storyKey;
        status.story_priority = STORY_PRIORITY.SPRINT_STATUS;
      }
    }
    writeStatus(sessionId, status);
    return;
  }

  // No specific detection triggered — persist file tracking if needed
  writeStatus(sessionId, status);
}


// ─── 11. handleBash (command tracking) ──────────────────────────────────────
function handleBash() {
  const command = payload.tool_input && payload.tool_input.command;
  if (!command || typeof command !== 'string') return;

  const status = earlyStatus;
  status.error_type = null;
  const now = new Date().toISOString();

  if (!Array.isArray(status.commands)) status.commands = [];
  if (canAppendHistory(sessionId)) {
    const truncated = command.length > 1000 ? command.slice(0, 1000) : command;
    status.commands.push({ cmd: truncated, at: now, agent_id: payload.agent_id || null });
    trimHistory(status.commands);
  }

  status.llm_state = 'active';
  status.llm_state_since = now;
  status.subagent_type = null;
  writeStatus(sessionId, status);
}

// ─── 12. setLlmState (shared read-set-write for the pure llm-state events) ──
// PreToolUse, Stop, StopFailure, SubagentStart/Stop, PostToolUseFailure,
// PermissionDenied and PermissionRequest all reduce to this one block.
function setLlmState(state, { subagent_type = null, error_type = null } = {}) {
  const status = earlyStatus;
  status.llm_state = state;
  status.llm_state_since = new Date().toISOString();
  status.subagent_type = subagent_type;
  status.error_type = error_type;
  writeStatus(sessionId, status);
}

// ─── 13. handlePermissionRequest (direct permission signal) ─────────────────
function handlePermissionRequest() {
  // Both conjuncts are required: auto-allow enabled AND an allowlisted tool. Either
  // missing → observe only, so a tool that asks the human a question is never
  // auto-answered. The only decision ever emitted is allow; otherwise stay silent,
  // never deny and never rewrite the tool arguments.
  if (isAutoAllowEnabled(sessionId) && isAutoAllowableTool(payload.tool_name)) {
    // Auto-allow: keep active state, respond with allow decision.
    // fs.writeSync(1, …) not process.stdout.write: the dispatcher exits immediately
    // after this returns, and stdout-to-a-pipe is asynchronous on POSIX, so a
    // buffered write can be dropped before flush. The try/catch keeps an EPIPE
    // (reader already gone) from throwing and breaking the silent-always contract.
    setLlmState('active');
    try {
      fs.writeSync(1, JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PermissionRequest',
          decision: { behavior: 'allow' }
        }
      }));
    } catch {}
    return;
  }
  setLlmState('permission');
}

// ─── Document name + step enrichment helper ─────────────────────────────────
function detectDocumentAndStep(status, normPath, content) {
  let changed = false;
  // Document name: Write/Edit in a known output folder, non-story workflow
  const outputFolders = status._outputFolders;
  if (outputFolders && !STORY_WORKFLOWS.includes(status.workflow)) {
    for (const folder of outputFolders) {
      if (normPath.toLowerCase().startsWith(folder.toLowerCase() + '/')) {
        const docName = path.basename(normPath);
        if (status.document_name !== docName) {
          status.document_name = docName;
          changed = true;
        }
        break;
      }
    }
  }
  // Step enrichment: frontmatter stepsCompleted fallback (only when no step files)
  if (status.step && status.step.total === null && typeof content === 'string') {
    const fmLines = content.split(/\r?\n/);
    let fmBody = null;
    if (fmLines[0] === '---') {
      const endIdx = fmLines.indexOf('---', 1);
      if (endIdx > 0) fmBody = fmLines.slice(1, endIdx).join('\n');
    }
    if (fmBody) {
      const scMatch = fmBody.match(/stepsCompleted:\s*\[([^\]]+)\]/);
      if (scMatch) {
        const nums = scMatch[1].split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
        if (nums.length > 0) {
          const maxStep = Math.max(...nums);
          if (status.step.current !== maxStep) {
            status.step.current = maxStep;
            status.step.current_name = 'completed';
            changed = true;
          }
        }
      }
    }
  }
  return changed;
}

// ─── Alive helper ─────────────────────────────────────────────────────────────
function findClaudeAncestorPid() {
  if (process.platform !== 'win32') return null; // wmic is Windows-only
  try {
    const { execSync } = require('child_process');
    const out = execSync('wmic process get ProcessId,ParentProcessId,Name /FORMAT:CSV', { encoding: 'utf8', timeout: 5000 });
    const procs = new Map();
    for (const line of out.split('\n')) {
      const parts = line.trim().split(',');
      if (parts.length < 4 || parts[0] === 'Node') continue;
      procs.set(parseInt(parts[3]), { name: parts[1], ppid: parseInt(parts[2]) });
    }
    let pid = process.ppid;
    for (let i = 0; i < 15; i++) {
      const p = procs.get(pid);
      if (!p) break;
      if (p.name.toLowerCase().includes('claude')) return pid;
      pid = p.ppid;
    }
  } catch {}
  return null;
}

// Returns the claude.exe ancestor PID (as a string) when known, else null.
function touchAlive(sid) {
  if (!isSafeId(sid)) return null;
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const alivePath = path.join(CACHE_DIR, '.alive-' + sid);
    // Fast path: alive file already exists — just touch mtime
    let cached = null;
    try { cached = fs.readFileSync(alivePath, 'utf8').trim(); } catch {}
    if (cached !== null) {
      if (/^\d+$/.test(cached)) {
        // Verify cached PID is still alive — stale PIDs cause monitor to skip the session
        const cachedPid = parseInt(cached, 10);
        let alive = false;
        try { process.kill(cachedPid, 0); alive = true; } catch (e) { alive = e.code !== 'ESRCH'; }
        if (alive) {
          const now = new Date();
          fs.utimesSync(alivePath, now, now);
          return cached;
        }
        // Cached PID is dead — fall through to re-detect
      } else {
        // Detection already ran for this session and found nothing. Retrying would
        // re-spawn the expensive process scan on EVERY hook event — just touch.
        const now = new Date();
        fs.utimesSync(alivePath, now, now);
        return null;
      }
    }
    // First call: find claude.exe ancestor PID (one-time ~700ms wmic query).
    // An empty file caches a failed detection so it is attempted at most once.
    const claudePid = findClaudeAncestorPid();
    fs.writeFileSync(alivePath, claudePid ? String(claudePid) : '');
    return claudePid ? String(claudePid) : null;
  } catch (e) {
    return null; // Silent
  }
}

// ─── History guard ────────────────────────────────────────────────────────
function canAppendHistory(sid) {
  try {
    const fp = path.join(CACHE_DIR, 'status-' + sid + '.json');
    return fs.statSync(fp).size < 10 * 1024 * 1024;
  } catch (e) { return true; }
}

// ─── Status helpers ───────────────────────────────────────────────────────────
function defaultStatus(sid) {
  return {
    session_id: sid ?? null,
    project: null,
    skill: null,
    workflow: null,
    active_skill: null,
    story: null,
    story_priority: null,
    step: { current: null, current_name: null, next: null, next_name: null, total: null, track: null },
    last_read: null,
    last_write: null,
    last_write_op: null,
    document_name: null,
    started_at: null,
    updated_at: null,
    llm_state: null,
    llm_state_since: null,
    subagent_type: null,
    error_type: null,
    reads: [],
    writes: [],
    commands: []
  };
}

function readStatus(sid) {
  _statusReadUnsafe = false; // reset per read — only the latest read gates the next write
  if (!isSafeId(sid)) return defaultStatus(null);
  const fp = path.join(CACHE_DIR, 'status-' + sid + '.json');
  let sawError = false;
  let sawParseError = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const raw = fs.readFileSync(fp, 'utf8');
      const status = JSON.parse(raw);
      status.subagent_type = status.subagent_type ?? null;
      status.error_type = status.error_type ?? null;
      return status;
    } catch (e) {
      // Genuinely no file on the first look → brand-new session, defaults are correct.
      if (e && e.code === 'ENOENT' && !sawError) return defaultStatus(sid);
      sawError = true;
      // A completed read that won't parse = corrupt content (only possible from a
      // legacy pre-fix torn write, since writes are now atomic). A read that throws =
      // the file is locked mid-rename (EBUSY/EACCES/EPERM on Windows) — transient.
      if (e instanceof SyntaxError) sawParseError = true;
      if (attempt < 4) sleepSync(8 * (attempt + 1)); // no wasted sleep after the last try
    }
  }
  // Unreadable after retries. Preserve the last-good file ONLY when it is locked
  // (transient) — persisting defaults would clobber a live session. A persistently
  // corrupt file must instead be allowed through so writeStatus can REPAIR it, else the
  // status line stays blank forever for anyone carrying a torn file from the old bug.
  if (!sawParseError) _statusReadUnsafe = true;
  return defaultStatus(sid);
}

// Windows can fail rename when the destination is briefly open by a concurrent reader
// (the statusline) — EPERM/EACCES/EBUSY. Retry a few times before giving up.
function renameWithRetry(tmp, fp) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try { fs.renameSync(tmp, fp); return; }
    catch (e) {
      if (attempt === 4) throw e;
      sleepSync(8 * (attempt + 1));
    }
  }
}

function writeStatus(sid, status) {
  if (!isSafeId(sid)) return;
  // Preserve the last-good file: if the current state could not be safely read this
  // process, writing would clobber a real session with default (null) values.
  if (_statusReadUnsafe) return;
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    status.session_id = sid; // single authoritative spot — handlers no longer set it
    status.updated_at = new Date().toISOString();
    const fp = path.join(CACHE_DIR, 'status-' + sid + '.json');
    // Per-process temp: concurrent hooks (many parallel subagents) must not share one
    // temp or they tear each other's write. Each writer owns a private temp; only the
    // rename is shared, and rename is atomic. (Mirrors the weekly-usage.json fix.)
    // Compact JSON: this file is rewritten on every hook event and parsed by the
    // reader on every statusline refresh — pretty-printing adds ~30% for nothing.
    const tmpPath = fp + '.' + process.pid + '.tmp';
    try {
      fs.writeFileSync(tmpPath, JSON.stringify(status) + '\n');
      renameWithRetry(tmpPath, fp);
    } catch (e) {
      try { fs.unlinkSync(tmpPath); } catch (_) {} // don't leak our temp on failure
      throw e;
    }
  } catch (e) {
    // Silent — never interfere with Claude Code
  }
}

// ─── ccstatusline npx cache auto-heal ───────────────────────────────────────
function ccstatuslineNpxCacheDir() {
  if (process.env.BMAD_NPX_CACHE_DIR) return process.env.BMAD_NPX_CACHE_DIR;
  // Honor a relocated npm cache (`npm config set cache …`) and a moved %LOCALAPPDATA%
  // — otherwise the heal silently inspects a directory npx never uses.
  if (process.env.npm_config_cache) return path.join(process.env.npm_config_cache, '_npx');
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(local, 'npm-cache', '_npx');
  }
  return path.join(os.homedir(), '.npm', '_npx');
}

// Match exactly like doctor.js: ccstatusline or ccstatusline@* (NOT ccstatusline-*)
function isCcstatuslineEntry(pkg) {
  const specs = pkg && pkg._npx && pkg._npx.packages;
  if (!Array.isArray(specs)) return false;
  return specs.some(s =>
    typeof s === 'string' && (s === 'ccstatusline' || s.startsWith('ccstatusline@')));
}

// Broken = the bin shim npx needs to launch ccstatusline is missing. On Windows
// that's the .cmd wrapper (the documented failure); elsewhere the bare shim.
function ccstatuslineShimMissing(dir) {
  const binName = process.platform === 'win32' ? 'ccstatusline.cmd' : 'ccstatusline';
  return !fs.existsSync(path.join(dir, 'node_modules', '.bin', binName));
}

// Don't race a concurrent `npx` install. A genuinely corrupted entry was left
// by a PAST session, so its dir is settled (old mtime). An entry written in the
// last minute may be mid-install (package.json present, shim not yet) — deleting
// it would corrupt the in-flight install. Skip recently-touched entries; a still
// truly-broken one heals next session once its mtime has settled.
function recentlyModified(dir) {
  try {
    // 60s window: long enough to cover an in-flight `npx` install. Inline literal
    // (not a module const) because this runs in the early SessionStart block,
    // before a late `const` declaration would be initialized (TDZ).
    return (Date.now() - fs.statSync(dir).mtimeMs) < 60000;
  } catch {
    return false;
  }
}

function healCcstatuslineNpxCache() {
  const cacheDir = ccstatuslineNpxCacheDir();
  let entries;
  try {
    entries = fs.readdirSync(cacheDir, { withFileTypes: true });
  } catch {
    return; // cache dir absent — nothing to heal
  }
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const dir = path.join(cacheDir, ent.name);
    let pkg;
    try {
      pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    } catch {
      continue;
    }
    if (!isCcstatuslineEntry(pkg)) continue;
    if (ccstatuslineShimMissing(dir) && !recentlyModified(dir)) {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  }
}
