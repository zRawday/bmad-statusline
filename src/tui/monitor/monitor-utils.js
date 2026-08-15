// monitor-utils.js — Monitor cache I/O isolation (Pattern 23)

import fs from 'node:fs';
import path from 'node:path';
import { getDefaultSkillColor } from '../skill-catalog.js';
import { toInkColor } from '../preview-utils.js';
import { ALIVE_MAX_AGE_MS, STORY_WORKFLOWS, hashProjectColor, computeDisplayState, formatTimer as formatElapsed, formatStoryName, LLM_STATE_PRIORITY } from '../../defaults.js';

export { ALIVE_MAX_AGE_MS, STORY_WORKFLOWS, computeDisplayState, formatElapsed, formatStoryName as formatStoryTitle };

export const MONITOR_IDLE_WINDOW_MS = 4 * 60 * 60 * 1000; // 4 hours — keep idle sessions visible
const MAX_SESSIONS = 20;

function isProcessAlive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (e) { return e.code !== 'ESRCH'; }
}

// Parse cache: status files grow to hundreds of KB with history, and the monitor
// polls every 1.5s — re-parsing unchanged files is pure CPU/GC churn. Keyed by
// sessionId, invalidated on (mtimeMs, size). Stable object identity also lets
// callers detect change with cheap reference equality instead of serializing.
const statusCache = new Map();

export function pollSessions(cachePath) {
  try {
    const files = fs.readdirSync(cachePath);
    const aliveFiles = files.filter(f => f.startsWith('.alive-'));
    const now = Date.now();
    const sessions = [];
    const seen = new Set();
    for (const alive of aliveFiles) {
      const alivePath = path.join(cachePath, alive);
      let content;
      try { content = fs.readFileSync(alivePath, 'utf8').trim(); } catch { continue; }
      // PID-based check: if file contains a claude.exe PID, verify it's alive
      const pid = parseInt(content, 10);
      if (pid) {
        if (!isProcessAlive(pid)) continue; // claude.exe dead → skip
      } else {
        // No PID (detection failed or first hook hasn't fired) — mtime fallback
        let mtime;
        try { mtime = fs.statSync(alivePath).mtimeMs; } catch { continue; }
        if (now - mtime > MONITOR_IDLE_WINDOW_MS) continue;
      }
      const sessionId = alive.slice('.alive-'.length);
      const statusPath = path.join(cachePath, `status-${sessionId}.json`);
      try {
        const st = fs.statSync(statusPath);
        const cached = statusCache.get(sessionId);
        let session;
        if (cached && cached.mtimeMs === st.mtimeMs && cached.size === st.size) {
          session = cached.session;
        } else {
          const parsed = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
          // No skill filter: non-BMAD sessions have skill=null and are listed too. The
          // shape check replaces the guard the skill filter used to provide implicitly —
          // JSON.parse('null') would otherwise spread into a contentless ghost session.
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
          session = { ...parsed, sessionId };
          statusCache.set(sessionId, { mtimeMs: st.mtimeMs, size: st.size, session });
        }
        seen.add(sessionId);
        sessions.push(session);
      } catch { /* skip corrupted/missing */ }
    }
    // Evict gone sessions so the cache cannot grow unbounded
    for (const key of statusCache.keys()) {
      if (!seen.has(key)) statusCache.delete(key);
    }
    // Sort by started_at (stable) — avoids tab reordering on LLM activity. A session
    // that has not prompted yet has no anchor; sort it last so it cannot evict an
    // established session at the MAX_SESSIONS cut.
    sessions.sort((a, b) => {
      const ta = a.started_at ? new Date(a.started_at).getTime() : Infinity;
      const tb = b.started_at ? new Date(b.started_at).getTime() : Infinity;
      return ta - tb;
    });
    return sessions.slice(0, MAX_SESSIONS);
  } catch { return []; /* cache dir missing */ }
}

// --- Auto-allow resolution ---

// Same validation as the hook's isSafeId (bmad-hook.js). Duplicated rather than
// shared because the hook is a standalone zero-dependency CJS file that cannot
// import from here — keep the two regexes identical.
function isSafeId(id) { return typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id); }

// Mirrors the hook's isAutoAllowEnabled fall-through exactly (bmad-hook.js):
// session flag 'on' → true, 'off' → false, anything else/missing → global config.
// Single source for the MonitorScreen indicator so it can't lie about what the
// hook will actually do — including the session-id guard, without which the
// indicator could read an arbitrary path the hook would never look at.
export function resolveAutoAllow(cachePath, configDir, sessionId) {
  if (!isSafeId(sessionId)) return false;
  try {
    const flag = fs.readFileSync(path.join(cachePath, '.autoallow-' + sessionId), 'utf8').trim();
    if (flag === 'on') return true;
    if (flag === 'off') return false;
  } catch { /* absent — fall through */ }
  try {
    const config = JSON.parse(fs.readFileSync(path.join(configDir, 'config.json'), 'utf8'));
    return config.autoAllow === true;
  } catch { return false; }
}

// --- Session grouping ---

export function groupSessionsByProject(sessions) {
  const groups = new Map();
  for (const s of sessions) {
    const key = s.project || 'unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  return groups;
}

export function worstState(sessions) {
  let worst = 'active';
  for (const s of sessions) {
    const state = computeDisplayState(s);
    if ((LLM_STATE_PRIORITY[state] || 0) > (LLM_STATE_PRIORITY[worst] || 0)) worst = state;
  }
  return worst;
}

// --- Color resolution ---

export function resolveSessionColor(workflow, config) {
  const skillColors = config.skillColors || {};
  if (skillColors[workflow]) return toInkColor(skillColors[workflow]);
  const def = getDefaultSkillColor(workflow);
  if (def) return toInkColor(def);
  return 'white';
}

// PROJECT_COLOR_PALETTE, hashProjectColor imported from defaults.js

export function resolveProjectColor(projectName, config) {
  const projectColors = config.projectColors || {};
  if (projectColors[projectName]) return toInkColor(projectColors[projectName]);
  const hashed = hashProjectColor(projectName);
  return hashed ? toInkColor(hashed) : 'white';
}

// --- Story/document context helpers ---

// STORY_WORKFLOWS imported from defaults.js

// Tab label for a session. Non-BMAD sessions have no workflow/skill — fall back to a
// short session id rather than the full UUID, which would blow out the tab row.
export function sessionLabel(session) {
  if (!session) return '';
  if (session.workflow) return session.workflow;
  if (session.skill) return session.skill;
  return session.sessionId ? String(session.sessionId).slice(0, 8) : '';
}

export function extractStoryNumber(story) {
  if (!story) return '';
  const m = story.match(/^(\d+[a-z]?-\d+[a-z]?)/);
  return m ? m[1] : '';
}

// formatStoryTitle (aliased from formatStoryName), formatElapsed (aliased from formatTimer)
// imported and re-exported from defaults.js

// --- File tree building (Pattern 26) ---

export function buildFileTree(entries) {
  const inProject = [];
  const outProject = [];
  for (const entry of entries) {
    if (entry.in_project) inProject.push(entry);
    else outProject.push(entry);
  }

  const root = {};
  for (const entry of inProject) {
    if (!entry.path) continue;
    const parts = entry.path.split(/[/\\]/);
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node[parts[i]] || typeof node[parts[i]] !== 'object' || node[parts[i]].path) {
        node[parts[i]] = {};
      }
      node = node[parts[i]];
    }
    const leaf = parts[parts.length - 1];
    // Don't overwrite a directory node with a leaf entry
    if (!(node[leaf] && typeof node[leaf] === 'object' && !node[leaf].path)) {
      node[leaf] = entry;
    }
  }

  return { inProject: root, outProject };
}

export function renderTreeLines(tree, prefix) {
  if (prefix === undefined) prefix = '';
  const results = [];
  const keys = Object.keys(tree).sort((a, b) => {
    const aIsDir = tree[a] !== null && typeof tree[a] === 'object' && !tree[a].path;
    const bIsDir = tree[b] !== null && typeof tree[b] === 'object' && !tree[b].path;
    if (aIsDir && !bIsDir) return -1;
    if (!aIsDir && bIsDir) return 1;
    return a.localeCompare(b);
  });

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const isLast = i === keys.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? '    ' : '│   ';
    const value = tree[key];
    const isFile = value !== null && typeof value === 'object' && value.path;

    if (isFile) {
      const text = prefix + connector + key;
      const indicators = [];
      if (value.is_new) indicators.push({ text: ' *', color: 'green' });
      if (value.agent_id !== null && value.agent_id !== undefined) indicators.push({ text: ' 🔀', color: 'cyan' });
      results.push({ text, indicators, selectable: true, type: 'file', data: value });
    } else {
      results.push({ text: prefix + connector + key + '/', treePrefix: prefix + connector, dirName: key + '/', selectable: false, type: 'dir', data: null });
      results.push(...renderTreeLines(value, prefix + childPrefix));
    }
  }
  return results;
}

// --- Filtering ---

export function filterReadOnly(reads, writes) {
  const writePaths = new Set(writes.map(w => w.path));
  return reads.filter(r => !writePaths.has(r.path));
}

// --- Command processing ---

export function deduplicateCommands(commands) {
  const map = new Map();
  const order = [];
  for (const entry of commands) {
    if (!map.has(entry.cmd)) {
      const group = { cmd: entry.cmd, count: 0, hasSubAgent: false, lastAt: entry.at, entries: [] };
      map.set(entry.cmd, group);
      order.push(group);
    }
    const group = map.get(entry.cmd);
    group.count++;
    group.entries.push(entry);
    group.lastAt = entry.at;
    if (entry.agent_id !== null && entry.agent_id !== undefined) group.hasSubAgent = true;
  }
  return order;
}

// --- Cursor navigation (Pattern 26) ---

export function findNextSelectable(items, currentIndex, direction) {
  let i = currentIndex + direction;
  while (i >= 0 && i < items.length) {
    if (items[i].selectable) return i;
    i += direction;
  }
  return currentIndex;
}

export function findFirstSelectable(items) {
  return items.findIndex(item => item.selectable);
}

export function formatTime(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return d.toTimeString().slice(0, 8);
  } catch { return ''; }
}

export function getCommandFamily(cmd) {
  const first = cmd.split(/\s/)[0];
  if (/^npm$/.test(first)) return { color: 'green', dim: false };
  if (/^git$/.test(first)) return { color: 'yellow', dim: false };
  if (/^node$/.test(first)) return { color: 'cyan', dim: false };
  if (/^(ls|rm|mkdir|rmdir|cp|mv|cat|touch|chmod|chown|find|head|tail)$/.test(first)) return { color: undefined, dim: true };
  if (/^python\d*$|^pip$/.test(first)) return { color: 'blue', dim: false };
  return { color: 'magenta', dim: false };
}

// --- Chronology & CSV utilities (Story 7.8) ---

export function mergeChronology(writes, reads, commands) {
  const entries = [];
  for (const r of (reads || [])) {
    entries.push({
      at: r.at, type: 'READ', path: r.path || null, cmd: null,
      agent_id: r.agent_id || null, is_new: false, op: null,
      old_string: null, new_string: null,
    });
  }
  for (const w of (writes || [])) {
    const type = w.op === 'edit' ? 'EDIT' : 'WRITE';
    entries.push({
      at: w.at, type, path: w.path || null, cmd: null,
      agent_id: w.agent_id || null, is_new: !!w.is_new, op: w.op || null,
      old_string: w.old_string || null, new_string: w.new_string || null,
    });
  }
  for (const c of (commands || [])) {
    entries.push({
      at: c.at, type: 'BASH', path: null, cmd: c.cmd || null,
      agent_id: c.agent_id || null, is_new: false, op: null,
      old_string: null, new_string: null,
    });
  }
  entries.sort((a, b) => {
    const ta = a.at ? new Date(a.at).getTime() || 0 : 0;
    const tb = b.at ? new Date(b.at).getTime() || 0 : 0;
    return ta - tb;
  });
  return entries;
}

export function formatRelativeTime(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 0) return 'now';
    if (diff < 60) return `${diff}s ago`;
    const min = Math.floor(diff / 60);
    if (min < 60) return `${min}min ago`;
    const hr = Math.floor(min / 60);
    const remMin = min % 60;
    if (hr < 24) return `${hr}h${remMin}m ago`;
    const days = Math.floor(hr / 24);
    return `${days}d ago`;
  } catch { return ''; }
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function generateCsv(mode, writes, reads, commands) {
  const merged = mergeChronology(writes, reads, commands);
  if (mode === 'light') {
    const counts = new Map();
    for (const e of merged) {
      const key = e.type + '\0' + (e.path || e.cmd || '');
      if (!counts.has(key)) counts.set(key, { type: e.type, path: e.path || e.cmd || '', count: 0 });
      counts.get(key).count++;
    }
    const rows = ['type,path,count'];
    for (const v of counts.values()) {
      rows.push(`${csvEscape(v.type)},${csvEscape(v.path)},${v.count}`);
    }
    return rows.join('\n');
  }
  // full mode
  const rows = ['type,path,operation,timestamp,detail'];
  for (const e of merged) {
    let detail = '';
    if (e.type === 'EDIT') {
      const oldLine = (e.old_string || '').split('\n')[0];
      const newLine = (e.new_string || '').split('\n')[0];
      detail = oldLine + ' → ' + newLine;
      if (detail.length > 100) detail = detail.slice(0, 97) + '...';
    } else if (e.type === 'WRITE' && e.is_new) {
      detail = 'file created';
    }
    const op = e.type === 'EDIT' ? 'edit' : e.type === 'WRITE' ? 'write' : e.type === 'BASH' ? 'execute' : e.type === 'READ' ? 'read' : '';
    rows.push([csvEscape(e.type), csvEscape(e.path || e.cmd || ''), csvEscape(op), csvEscape(e.at || ''), csvEscape(detail)].join(','));
  }
  return rows.join('\n');
}

export function writeCsvExport(outputFolder, mode, csvContent) {
  const now = new Date();
  const pad = (n, w) => String(n).padStart(w || 2, '0');
  const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}${pad(now.getMilliseconds(), 3)}`;
  const dir = path.join(outputFolder, 'monitor');
  const filePath = path.join(dir, `monitor-${mode}-${ts}.csv`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, csvContent, 'utf8');
  return filePath;
}
