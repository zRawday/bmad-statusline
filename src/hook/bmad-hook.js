// bmad-hook.js — 5-signal hook entry point for passive workflow detection
// CommonJS, zero dependencies, synchronous I/O only, silent always

// ─── 1. Requires ───────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── 2. Constants ──────────────────────────────────────────────────────────────
const CACHE_DIR = process.env.BMAD_CACHE_DIR || path.join(os.homedir(), '.cache', 'bmad-status');
const STORY_WORKFLOWS = ['create-story', 'dev-story', 'code-review'];
const STORY_READ_WORKFLOWS = ['dev-story', 'code-review'];
const STORY_WRITE_WORKFLOWS = ['create-story'];
const STORY_PRIORITY = { SPRINT_STATUS: 1, STORY_FILE: 2, CANDIDATE: 3 };
const STORY_FILE_REGEX = /\/(\d+-\d+-[a-zA-Z][\w-]*)\.md$/;
const SKILL_REGEX = /^\s*\/?((?:bmad|gds|wds)-[\w-]+)/;
const LEGACY_COMMAND_REGEX = /^\s*\/?(bmad(?::[\w-]+)+)/;
const ALIVE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const STEP_REGEX = /\/steps(-[a-z])?\/step-(?:[a-z]-)?(\d+)[a-z]?-(.+)\.md$/;

function normalize(p) { return p.replace(/\\/g, '/').replace(/\/+$/, ''); }
function isSafeId(id) { return typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id); }

function shouldUpdateStory(incomingPriority, currentPriority) {
  if (incomingPriority === STORY_PRIORITY.SPRINT_STATUS) return true;
  if (incomingPriority === STORY_PRIORITY.STORY_FILE && (!currentPriority || currentPriority === STORY_PRIORITY.CANDIDATE)) return true;
  if (incomingPriority === STORY_PRIORITY.CANDIDATE && !currentPriority) return true;
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
while (!fs.existsSync(path.join(bmadRoot, '_bmad'))) {
  const parent = path.dirname(bmadRoot);
  if (parent === bmadRoot) process.exit(0); // reached filesystem root
  bmadRoot = parent;
}
cwd = bmadRoot;

// ─── 5. Alive touch ──────────────────────────────────────────────────────────
const sessionId = payload.session_id;
touchAlive(sessionId);

// ─── 5b. Project + output folders detection (first event only) ──────────────
const earlyStatus = readStatus(sessionId);
if (!earlyStatus.project) {
  let configRaw = '';
  try {
    configRaw = fs.readFileSync(path.join(cwd, '_bmad', 'bmm', 'config.yaml'), 'utf8');
    const pm = configRaw.match(/project_name:[ \t]*['"]?([^'"\n]+)/);
    if (pm) earlyStatus.project = pm[1].trim();
  } catch (e) { /* silent */ }
  if (!earlyStatus.project) {
    earlyStatus.project = normalize(cwd).split('/').pop();
  }
  // Resolve output folder paths from config.yaml
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
  earlyStatus.session_id = sessionId;
  writeStatus(sessionId, earlyStatus);
}

// ─── 6. Dispatch on hook_event_name ───────────────────────────────────────────
const hookEvent = payload.hook_event_name;

if (hookEvent === 'UserPromptSubmit') {
  handleUserPrompt();
} else if (hookEvent === 'PostToolUse') {
  const toolName = payload.tool_name;
  if (toolName === 'Read') {
    handleRead();
  } else if (toolName === 'Write') {
    handleWrite();
  } else if (toolName === 'Edit') {
    handleEdit();
  }
} else if (hookEvent === 'SessionStart') {
  // no-op — alive already touched
}

process.exit(0);

// ─── 7. handleUserPrompt (intent signal) ─────────────────────────────────────
function handleUserPrompt() {
  const prompt = payload.prompt;
  if (!prompt) return;

  let skillName, workflowName;
  const match = prompt.match(SKILL_REGEX);
  if (match) {
    skillName = match[1];
    workflowName = skillName.slice(skillName.indexOf('-') + 1);
  } else {
    // Legacy .claude/commands/ format: /bmad:bmm:workflows:create-story
    const legacyMatch = prompt.match(LEGACY_COMMAND_REGEX);
    if (!legacyMatch) return;
    skillName = legacyMatch[1];
    const parts = skillName.split(':');
    workflowName = parts[parts.length - 1];
  }

  const status = readStatus(sessionId);

  // Preserve started_at if same skill; reset on skill change
  if (status.skill !== skillName) {
    status.started_at = new Date().toISOString();
    status.step = { current: null, current_name: null, next: null, next_name: null, total: null, track: null };
    status.story = null;
    status.story_priority = null;
    status.active_skill = null;
    status.last_read = null;
    status.last_write = null;
    status.last_write_op = null;
    status.document_name = null;
  }

  status.session_id = sessionId;
  status.skill = skillName;
  status.workflow = workflowName;

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

  if (!inProject) {
    if (readChanged) writeStatus(sessionId, status);
    return;
  }

  // Need active skill/workflow for step and story detection
  const activeSkill = status.skill;
  const activeWorkflow = status.workflow;

  // Active skill detection: Read from .claude/skills/{skill}/ (v6.2.2+) or _bmad/.../{skill}/ (legacy)
  const skillPathMatch = normPath.match(/\.claude\/skills\/((?:bmad|gds|wds)-[\w-]+)\//)
    || normPath.match(/\/_bmad\/(?:[^/]+\/)*?((?:bmad|gds|wds)-[\w-]+)\//);
  if (skillPathMatch && activeWorkflow) {
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
    if (readChanged) writeStatus(sessionId, status);
    return;
  }

  // Step detection (multi-track: steps/, steps-c/, steps-v/, etc.)
  const stepInfo = extractStep(filePath);
  if (stepInfo) {
    // False positive prevention: must be in active skill's steps dir
    const skillForPath = activeSkill || ('bmad-' + activeWorkflow);
    const stepsDir = path.join(cwd, '.claude', 'skills', skillForPath, 'steps' + stepInfo.track);
    const expectedPrefix = normalize(stepsDir) + '/';
    if (!normPath.startsWith(expectedPrefix)) return;

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
          writeStatus(sessionId, status);
        }
      }
    }
    return;
  }

  // Story file Read → priority 2 (lock)
  const storyMatch = normPath.match(STORY_FILE_REGEX);
  if (storyMatch) {
    let changed = false;
    if (STORY_READ_WORKFLOWS.includes(activeWorkflow)
        && shouldUpdateStory(STORY_PRIORITY.STORY_FILE, status.story_priority)) {
      status.session_id = sessionId;
      status.story = storyMatch[1];
      status.story_priority = STORY_PRIORITY.STORY_FILE;
      changed = true;
    }
    if (changed || readChanged) writeStatus(sessionId, status);
    return;
  }

  // No specific detection triggered — persist file tracking if needed
  if (readChanged) writeStatus(sessionId, status);
}

// ─── 9. handleWrite (story confirmation signal) ─────────────────────────────
function handleWrite() {
  const filePath = payload.tool_input && payload.tool_input.file_path;
  if (!filePath || typeof filePath !== 'string') return;

  const normPath = normalize(filePath);
  const normCwd = normalize(cwd);
  const inProject = normPath.toLowerCase().startsWith(normCwd.toLowerCase() + '/');
  const status = readStatus(sessionId);

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

  if (!inProject) {
    if (writeChanged) writeStatus(sessionId, status);
    return;
  }

  const activeWorkflow = status.workflow;

  // Document name + step enrichment (works with or without active workflow)
  const writeContent = payload.tool_input.content;
  const docStepChanged = detectDocumentAndStep(status, normPath, writeContent);
  if (docStepChanged) status.session_id = sessionId;

  if (!activeWorkflow) {
    if (writeChanged || docStepChanged) writeStatus(sessionId, status);
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
              writeStatus(sessionId, status);
            }
            break;
          }
        }
      }
    }
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
      writeStatus(sessionId, status);
    }
    return;
  }

  // No specific detection triggered — persist file tracking if needed
  if (writeChanged || docStepChanged) writeStatus(sessionId, status);
}

// ─── 10. handleEdit (story confirmation signal) ─────────────────────────────
function handleEdit() {
  const filePath = payload.tool_input && payload.tool_input.file_path;
  if (!filePath || typeof filePath !== 'string') return;

  const normPath = normalize(filePath);
  const normCwd = normalize(cwd);
  const inProject = normPath.toLowerCase().startsWith(normCwd.toLowerCase() + '/');
  const status = readStatus(sessionId);

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

  if (!inProject) {
    if (editChanged) writeStatus(sessionId, status);
    return;
  }

  const activeWorkflow = status.workflow;

  // Document name + step enrichment (Edit: use new_string as content)
  const editContent = payload.tool_input.new_string;
  const docStepChanged = detectDocumentAndStep(status, normPath, editContent);
  if (docStepChanged) status.session_id = sessionId;

  if (!activeWorkflow) {
    if (editChanged || docStepChanged) writeStatus(sessionId, status);
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
        writeStatus(sessionId, status);
      }
    }
    return;
  }

  // No specific detection triggered — persist file tracking if needed
  if (editChanged || docStepChanged) writeStatus(sessionId, status);
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
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (fmMatch) {
      const scMatch = fmMatch[1].match(/stepsCompleted:\s*\[([^\]]+)\]/);
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
function touchAlive(sid) {
  if (!isSafeId(sid)) return;
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(path.join(CACHE_DIR, '.alive-' + sid), '');
  } catch (e) {
    // Silent
  }
}

// ─── Status helpers ───────────────────────────────────────────────────────────
function readStatus(sid) {
  if (!isSafeId(sid)) return {
    session_id: null, project: null, skill: null, workflow: null,
    active_skill: null, story: null, story_priority: null,
    step: { current: null, current_name: null, next: null, next_name: null, total: null, track: null },
    last_read: null, last_write: null, last_write_op: null, document_name: null,
    started_at: null, updated_at: null
  };
  try {
    const fp = path.join(CACHE_DIR, 'status-' + sid + '.json');
    const raw = fs.readFileSync(fp, 'utf8');
    return JSON.parse(raw);
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
      updated_at: null
    };
  }
}

function writeStatus(sid, status) {
  if (!isSafeId(sid)) return;
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    status.updated_at = new Date().toISOString();
    const fp = path.join(CACHE_DIR, 'status-' + sid + '.json');
    fs.writeFileSync(fp, JSON.stringify(status, null, 2), 'utf8');
  } catch (e) {
    // Silent — never interfere with Claude Code
  }
}
