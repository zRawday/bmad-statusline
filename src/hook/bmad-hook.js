// bmad-hook.js — 8-signal hook entry point for passive workflow detection
// CommonJS, zero dependencies, synchronous I/O only, silent always

// ─── 1. Requires ───────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── 2. Constants ──────────────────────────────────────────────────────────────
const CACHE_DIR = process.env.BMAD_CACHE_DIR || path.join(os.homedir(), '.cache', 'bmad-status');
const CONFIG_DIR = process.env.BMAD_CONFIG_DIR || path.join(os.homedir(), '.config', 'bmad-statusline');
const STORY_WORKFLOWS = ['create-story', 'dev-story', 'code-review'];
const STORY_READ_WORKFLOWS = ['dev-story', 'code-review'];
const STORY_WRITE_WORKFLOWS = ['create-story'];
const STORY_PRIORITY = { SPRINT_STATUS: 1, STORY_FILE: 2, CANDIDATE: 3 };
const STORY_FILE_REGEX = /\/(\d+-\d+-[a-zA-Z][\w-]*)\.md$/;
const SKILL_REGEX = /^\s*\/?((?:bmad|gds|wds)-[\w-]+)/;
const LEGACY_COMMAND_REGEX = /^\s*\/?(bmad(?::[\w-]+)+)/;
const STEP_REGEX = /\/steps(-[a-z])?\/step-(?:[a-z]-)?(\d+)[a-z]?-(.+)\.md$/;

function normalize(p) {
  let n = p.replace(/\\/g, '/').replace(/\/+$/, '');
  if (/^[A-Z]:\//.test(n)) n = n[0].toLowerCase() + n.slice(1);
  return n;
}
function isSafeId(id) { return typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id); }
const MAX_HISTORY = 500;
function trimHistory(arr) { if (arr.length > MAX_HISTORY) arr.splice(0, arr.length - MAX_HISTORY); }

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

// ─── 4. Guard: _bmad/ existence (walk up to find it) ─────────────────────────
let cwd = payload.cwd;
if (!cwd) process.exit(0);
let bmadRoot = cwd;
let walkDepth = 0;
const MAX_WALK_DEPTH = 20;
while (!fs.existsSync(path.join(bmadRoot, '_bmad'))) {
  const parent = path.dirname(bmadRoot);
  if (parent === bmadRoot) process.exit(0); // reached filesystem root
  if (++walkDepth > MAX_WALK_DEPTH) process.exit(0); // depth limit
  bmadRoot = parent;
}
cwd = bmadRoot;

// ─── 5. Alive touch ──────────────────────────────────────────────────────────
const sessionId = payload.session_id;
touchAlive(sessionId);

// ─── 5a. Stale session cleanup (same claude.exe PID, different session) ─────
try {
  const myPid = fs.readFileSync(path.join(CACHE_DIR, '.alive-' + sessionId), 'utf8').trim();
  if (/^\d+$/.test(myPid)) {
    for (const f of fs.readdirSync(CACHE_DIR)) {
      if (!f.startsWith('.alive-')) continue;
      const otherSid = f.slice('.alive-'.length);
      if (otherSid === sessionId) continue;
      try {
        if (fs.readFileSync(path.join(CACHE_DIR, f), 'utf8').trim() === myPid) {
          fs.unlinkSync(path.join(CACHE_DIR, f));
          // Status file preserved — orphan cleanup handles stale status files
        }
      } catch {}
    }
  }
} catch {}

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
  if (pm) earlyStatus.project = pm[1].trim();
  if (!earlyStatus.project) {
    earlyStatus.project = normalize(cwd).split('/').pop();
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
    folders.push(normalize(resolved));
  }
  earlyStatus._outputFolders = folders;
  earlyDirty = true;
}
if (earlyDirty) {
  earlyStatus.session_id = sessionId;
  writeStatus(sessionId, earlyStatus);
}

// ─── 6. Dispatch on hook_event_name ───────────────────────────────────────────
const hookEvent = payload.hook_event_name;

if (hookEvent === 'UserPromptSubmit') {
  handleUserPrompt();
} else if (hookEvent === 'PreToolUse') {
  handlePreToolUse();
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
  handleStop();
} else if (hookEvent === 'StopFailure') {
  handleStopFailure();
} else if (hookEvent === 'PermissionRequest') {
  handlePermissionRequest();
} else if (hookEvent === 'PermissionDenied') {
  handlePermissionDenied();
} else if (hookEvent === 'PostToolUseFailure') {
  handlePostToolUseFailure();
} else if (hookEvent === 'SubagentStart') {
  handleSubagentStart();
} else if (hookEvent === 'SubagentStop') {
  handleSubagentStop();
} else if (hookEvent === 'SessionStart') {
  // no-op — alive already touched
} else if (hookEvent === 'SessionEnd') {
  handleSessionEnd();
}

process.exit(0);

// ─── 7. handleUserPrompt (intent signal) ─────────────────────────────────────
function handleUserPrompt() {
  const status = readStatus(sessionId);
  const now = new Date().toISOString();

  // Always mark active on any prompt submission
  status.llm_state = 'active';
  status.llm_state_since = now;
  status.subagent_type = null;
  status.error_type = null;
  status.session_id = sessionId;

  // Skill detection — only update skill fields when prompt matches
  const prompt = payload.prompt;
  if (prompt) {
    let skillName, workflowName;
    const match = prompt.match(SKILL_REGEX);
    if (match) {
      skillName = match[1];
      workflowName = skillName.slice(skillName.indexOf('-') + 1);
    } else {
      const legacyMatch = prompt.match(LEGACY_COMMAND_REGEX);
      if (legacyMatch) {
        skillName = legacyMatch[1];
        const parts = skillName.split(':');
        workflowName = parts[parts.length - 1];
      }
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
  }

  writeStatus(sessionId, status);
}

// ─── 8. handleRead (data signal) ─────────────────────────────────────────────
function handleRead() {
  const filePath = payload.tool_input && payload.tool_input.file_path;
  if (!filePath || typeof filePath !== 'string') {
    return;
  }

  const normPath = normalize(filePath);
  const normCwd = normalize(cwd);
  const inProject = normPath.toLowerCase().startsWith(normCwd.toLowerCase() + '/');
  const status = readStatus(sessionId);
  status.error_type = null;

  // File tracking: project-relative (strip project folder prefix) or full path
  let displayPath = inProject ? normPath.slice(normCwd.length + 1) : normPath;
  if (inProject && status.project && displayPath.startsWith(status.project + '/')) {
    displayPath = displayPath.slice(status.project.length + 1);
  }
  const readChanged = status.last_read !== displayPath;
  if (readChanged) {
    status.last_read = displayPath;
    status.session_id = sessionId;
  }

  // History: append to reads[] + set llm_state active
  const now = new Date().toISOString();
  if (!Array.isArray(status.reads)) status.reads = [];
  if (canAppendHistory(sessionId)) {
    status.reads.push({ path: displayPath, in_project: inProject, at: now, agent_id: payload.agent_id || null });
    trimHistory(status.reads);
  }
  status.llm_state = 'active';
  status.llm_state_since = now;
  status.subagent_type = null;
  status.session_id = sessionId;

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
    if (detectedWorkflow !== activeWorkflow) {
      if (status.active_skill !== detectedWorkflow) {
        status.active_skill = detectedWorkflow;
        status.session_id = sessionId;
        writeStatus(sessionId, status);
      }
    } else if (status.active_skill) {
      status.active_skill = null;
      status.session_id = sessionId;
      writeStatus(sessionId, status);
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
    if (!normPath.startsWith(expectedPrefix)) {
      writeStatus(sessionId, status);
      return;
    }

    status.session_id = sessionId;
    status.step = status.step || {};
    status.step.current = stepInfo.number;
    status.step.current_name = stepInfo.name;

    // Track change or first Read: calculate total from parent dir
    const trackChanged = status.step.track !== stepInfo.track;
    if (status.step.total === null || status.step.total === undefined || trackChanged) {
      try {
        const files = fs.readdirSync(stepsDir);
        const stepNumbers = new Set();
        for (const f of files) {
          const m = f.match(/^step-(?:[a-z]-)?(\d+)[a-z]?-.+\.md$/);
          if (m) stepNumbers.add(m[1]);
        }
        status.step.total = stepNumbers.size;
      } catch (e) {
        status.step.total = null;
      }
    }
    status.step.track = stepInfo.track;

    // Derive next step from unique step numbers
    try {
      const files = fs.readdirSync(stepsDir);
      const stepMap = new Map(); // number → first filename with that number (main step)
      for (const f of files) {
        const m = f.match(/^step-(?:[a-z]-)?(\d+)[a-z]?-(.+)\.md$/);
        if (m) {
          const num = parseInt(m[1], 10);
          // Keep the main step (no letter suffix) if available
          if (!stepMap.has(num) || !f.match(/^step-(?:[a-z]-)?(\d+)[a-z]-/)) {
            stepMap.set(num, { number: num, name: m[2] });
          }
        }
      }
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
      status.step.next = null;
      status.step.next_name = null;
    }

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
          const m = line.match(/^\s+(\d+-\d+-[\w-]+):\s*in-progress\s*(?:$|#)/);
          if (m) activeStories.push(m[1]);
        }
        if (activeStories.length === 1 && shouldUpdateStory(STORY_PRIORITY.CANDIDATE, status.story_priority)) {
          status.session_id = sessionId;
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
      status.session_id = sessionId;
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

  const normPath = normalize(filePath);
  const normCwd = normalize(cwd);
  const inProject = normPath.toLowerCase().startsWith(normCwd.toLowerCase() + '/');
  const status = readStatus(sessionId);
  status.error_type = null;

  // File tracking: project-relative (strip project folder prefix) or full path
  let displayPath = inProject ? normPath.slice(normCwd.length + 1) : normPath;
  if (inProject && status.project && displayPath.startsWith(status.project + '/')) {
    displayPath = displayPath.slice(status.project.length + 1);
  }
  const writeChanged = status.last_write !== displayPath || status.last_write_op !== 'write';
  if (writeChanged) {
    status.last_write = displayPath;
    status.last_write_op = 'write';
    status.session_id = sessionId;
  }

  // History: append to writes[] + set llm_state active
  const now = new Date().toISOString();
  if (!Array.isArray(status.writes)) status.writes = [];
  if (!Array.isArray(status.reads)) status.reads = [];
  if (canAppendHistory(sessionId)) {
    // is_new is best-effort: after history cap, reads[] may have been truncated
    const isNew = !status.reads.some(function(r) { return r.path === displayPath; });
    status.writes.push({ path: displayPath, in_project: inProject, op: 'write', is_new: isNew, at: now, agent_id: payload.agent_id || null, old_string: null, new_string: null });
    trimHistory(status.writes);
  }
  status.llm_state = 'active';
  status.llm_state_since = now;
  status.subagent_type = null;
  status.session_id = sessionId;

  if (!inProject) {
    writeStatus(sessionId, status);
    return;
  }

  const activeWorkflow = status.workflow;

  // Document name + step enrichment (works with or without active workflow)
  const writeContent = payload.tool_input.content;
  const docStepChanged = detectDocumentAndStep(status, normPath, writeContent);
  if (docStepChanged) status.session_id = sessionId;

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
          const m = line.match(/^\s+(\d+-\d+-[a-zA-Z][\w-]*):\s*(\S+)/);
          if (m && m[2] !== 'backlog' && m[2] !== 'done') {
            if (shouldUpdateStory(STORY_PRIORITY.SPRINT_STATUS, status.story_priority)) {
              status.session_id = sessionId;
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
      status.session_id = sessionId;
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

  const normPath = normalize(filePath);
  const normCwd = normalize(cwd);
  const inProject = normPath.toLowerCase().startsWith(normCwd.toLowerCase() + '/');
  const status = readStatus(sessionId);
  status.error_type = null;

  // File tracking: project-relative (strip project folder prefix) or full path
  let displayPath = inProject ? normPath.slice(normCwd.length + 1) : normPath;
  if (inProject && status.project && displayPath.startsWith(status.project + '/')) {
    displayPath = displayPath.slice(status.project.length + 1);
  }
  const editChanged = status.last_write !== displayPath || status.last_write_op !== 'edit';
  if (editChanged) {
    status.last_write = displayPath;
    status.last_write_op = 'edit';
    status.session_id = sessionId;
  }

  // History: append to writes[] + set llm_state active
  const now = new Date().toISOString();
  if (!Array.isArray(status.writes)) status.writes = [];
  if (canAppendHistory(sessionId)) {
    status.writes.push({ path: displayPath, in_project: inProject, op: 'edit', is_new: false, at: now, agent_id: payload.agent_id || null, old_string: payload.tool_input.old_string ?? null, new_string: payload.tool_input.new_string ?? null });
    trimHistory(status.writes);
  }
  status.llm_state = 'active';
  status.llm_state_since = now;
  status.subagent_type = null;
  status.session_id = sessionId;

  if (!inProject) {
    writeStatus(sessionId, status);
    return;
  }

  const activeWorkflow = status.workflow;

  // Document name detection only — skip step enrichment for Edit (partial content unreliable)
  const docStepChanged = detectDocumentAndStep(status, normPath, null);
  if (docStepChanged) status.session_id = sessionId;

  if (!activeWorkflow) {
    writeStatus(sessionId, status);
    return;
  }

  // Sprint-status Edit → priority 1
  if (normPath.match(/sprint-status[^\/]*\.yaml$/)) {
    if (STORY_WORKFLOWS.includes(activeWorkflow)) {
      const newStr = payload.tool_input.new_string;
      const oldStr = payload.tool_input.old_string;
      const storyKeyRegex = /(\d+-\d+-[a-zA-Z][\w-]*)/;
      const newMatch = typeof newStr === 'string' && newStr.match(storyKeyRegex);
      const oldMatch = typeof oldStr === 'string' && oldStr.match(storyKeyRegex);
      const storyKey = (newMatch && newMatch[1]) || (oldMatch && oldMatch[1]);
      if (storyKey && shouldUpdateStory(STORY_PRIORITY.SPRINT_STATUS, status.story_priority)) {
        status.session_id = sessionId;
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

  const status = readStatus(sessionId);
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
  status.session_id = sessionId;
  writeStatus(sessionId, status);
}

// ─── 11b. handlePreToolUse (clear permission on tool start) ─────────────────
function handlePreToolUse() {
  const status = readStatus(sessionId);
  status.error_type = null;
  const now = new Date().toISOString();

  status.llm_state = 'active';
  status.llm_state_since = now;
  status.subagent_type = null;
  status.session_id = sessionId;
  writeStatus(sessionId, status);
}

// ─── 12. handleStop (waiting state) ─────────────────────────────────────────
function handleStop() {
  const status = readStatus(sessionId);
  status.error_type = null;
  const now = new Date().toISOString();

  status.llm_state = 'waiting';
  status.llm_state_since = now;
  status.subagent_type = null;
  status.session_id = sessionId;
  writeStatus(sessionId, status);
}

// ─── 13. handlePermissionRequest (direct permission signal) ─────────────────
function handlePermissionRequest() {
  const status = readStatus(sessionId);
  const now = new Date().toISOString();

  if (isAutoAllowEnabled(sessionId)) {
    // Auto-allow: keep active state, respond with allow decision
    status.llm_state = 'active';
    status.llm_state_since = now;
    status.subagent_type = null;
    status.error_type = null;
    status.session_id = sessionId;
    writeStatus(sessionId, status);
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        decision: { behavior: 'allow' }
      }
    }));
    return;
  }

  status.llm_state = 'permission';
  status.llm_state_since = now;
  status.subagent_type = null;
  status.error_type = null;
  status.session_id = sessionId;
  writeStatus(sessionId, status);
}

// ─── 15. handleStopFailure (error state) ────────────────────────────────────
function handleStopFailure() {
  const status = readStatus(sessionId);
  const now = new Date().toISOString();

  status.llm_state = 'error';
  status.error_type = payload.error_type ?? 'unknown';
  status.subagent_type = null;
  status.llm_state_since = now;
  status.session_id = sessionId;
  writeStatus(sessionId, status);
}

// ─── 16. handleSessionEnd (session cleanup) ─────────────────────────────────
// Only delete alive file — preserve status for resume. Orphan cleanup handles stale status files.
function handleSessionEnd() {
  if (!isSafeId(sessionId)) return;
  try { fs.unlinkSync(path.join(CACHE_DIR, '.alive-' + sessionId)); } catch {}
}


// ─── 17. handleSubagentStart (subagent lifecycle) ──────────────────────────
function handleSubagentStart() {
  const status = readStatus(sessionId);
  const now = new Date().toISOString();
  status.llm_state = 'active';
  status.subagent_type = payload.agent_type ?? 'unknown';
  status.error_type = null;
  status.llm_state_since = now;
  status.session_id = sessionId;
  writeStatus(sessionId, status);
}

// ─── 18. handleSubagentStop (subagent lifecycle) ───────────────────────────
function handleSubagentStop() {
  const status = readStatus(sessionId);
  const now = new Date().toISOString();
  status.llm_state = 'active';
  status.subagent_type = null;
  status.error_type = null;
  status.llm_state_since = now;
  status.session_id = sessionId;
  writeStatus(sessionId, status);
}

// ─── 19. handlePostToolUseFailure (tool failure / user interrupt) ──────────
function handlePostToolUseFailure() {
  const status = readStatus(sessionId);
  const now = new Date().toISOString();
  status.llm_state = payload.is_interrupt === true ? 'interrupted' : 'active';
  status.subagent_type = null;
  status.error_type = null;
  status.llm_state_since = now;
  status.session_id = sessionId;
  writeStatus(sessionId, status);
}

// ─── 20. handlePermissionDenied (auto-mode denied) ─────────────────────────
function handlePermissionDenied() {
  const status = readStatus(sessionId);
  const now = new Date().toISOString();
  status.llm_state = 'active';
  status.subagent_type = null;
  status.error_type = null;
  status.llm_state_since = now;
  status.session_id = sessionId;
  writeStatus(sessionId, status);
}

// ─── Document name + step enrichment helper ─────────────────────────────────
function detectDocumentAndStep(status, normPath, content) {
  let changed = false;
  // Document name: Write/Edit in a known output folder, non-story workflow
  const outputFolders = status._outputFolders || earlyStatus._outputFolders;
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

function touchAlive(sid) {
  if (!isSafeId(sid)) return;
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const alivePath = path.join(CACHE_DIR, '.alive-' + sid);
    // Fast path: PID already cached — just touch mtime
    let cached = '';
    try { cached = fs.readFileSync(alivePath, 'utf8').trim(); } catch {}
    if (/^\d+$/.test(cached)) {
      // Verify cached PID is still alive — stale PIDs cause monitor to skip the session
      const cachedPid = parseInt(cached, 10);
      let alive = false;
      try { process.kill(cachedPid, 0); alive = true; } catch (e) { alive = e.code !== 'ESRCH'; }
      if (alive) {
        const now = new Date();
        fs.utimesSync(alivePath, now, now);
        return;
      }
      // Cached PID is dead — fall through to re-detect
    }
    // First call: find claude.exe ancestor PID (one-time ~700ms wmic query)
    const claudePid = findClaudeAncestorPid();
    fs.writeFileSync(alivePath, claudePid ? String(claudePid) : '');
  } catch (e) {
    // Silent
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
function readStatus(sid) {
  if (!isSafeId(sid)) return {
    session_id: null, project: null, skill: null, workflow: null,
    active_skill: null, story: null, story_priority: null,
    step: { current: null, current_name: null, next: null, next_name: null, total: null, track: null },
    last_read: null, last_write: null, last_write_op: null, document_name: null,
    started_at: null, updated_at: null,
    llm_state: null, llm_state_since: null,
    subagent_type: null, error_type: null,
    reads: [], writes: [], commands: []
  };
  try {
    const fp = path.join(CACHE_DIR, 'status-' + sid + '.json');
    const raw = fs.readFileSync(fp, 'utf8');
    const status = JSON.parse(raw);
    status.subagent_type = status.subagent_type ?? null;
    status.error_type = status.error_type ?? null;
    return status;
  } catch (e) {
    return {
      session_id: sid,
      project: null,
      skill: null,
      workflow: null,
      active_skill: null,
      story: null,
      story_priority: null,
      step: {
        current: null,
        current_name: null,
        next: null,
        next_name: null,
        total: null,
        track: null
      },
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
}

function writeStatus(sid, status) {
  if (!isSafeId(sid)) return;
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    status.updated_at = new Date().toISOString();
    const fp = path.join(CACHE_DIR, 'status-' + sid + '.json');
    const tmpPath = fp + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(status, null, 2) + '\n');
    fs.renameSync(tmpPath, fp);
  } catch (e) {
    // Silent — never interfere with Claude Code
  }
}
