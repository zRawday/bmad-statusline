// doctor.js — status line health check & npx cache auto-repair (shared by CLI + TUI)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { G, R, D, B, _, logSuccess, logError, logSection } from './cli-utils.js';

const home = os.homedir();

function defaultNpxCacheDir() {
  if (process.env.BMAD_NPX_CACHE_DIR) return process.env.BMAD_NPX_CACHE_DIR;
  if (process.platform === 'win32') {
    return path.join(home, 'AppData', 'Local', 'npm-cache', '_npx');
  }
  return path.join(home, '.npm', '_npx');
}

export const defaultPaths = {
  claudeSettings: path.join(home, '.claude', 'settings.json'),
  ccstatuslineSettings: path.join(home, '.config', 'ccstatusline', 'settings.json'),
  // Honor BMAD_CONFIG_DIR so doctor inspects the same dir the reader/hook actually read from.
  readerDir: process.env.BMAD_CONFIG_DIR || path.join(home, '.config', 'bmad-statusline'),
  npxCacheDir: defaultNpxCacheDir(),
};

const READER_FILES = ['bmad-sl-reader.js', 'shared-constants.cjs', 'workflow-colors.cjs'];
const INSTALL_HINT = 'run: npx bmad-statusline install';

function truncate(s, n = 120) {
  const t = (s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
}

// --- Functional check: does `npx -y ccstatusline@latest` actually run? ---

export function defaultRunStatusline() {
  const input = JSON.stringify({
    session_id: 'bmad-doctor-check',
    workspace: { current_dir: process.cwd() },
    model: { display_name: 'Doctor' },
    transcript_path: '',
  });
  return new Promise((resolve) => {
    let child;
    try {
      // On Windows npx resolves to npx.cmd, which needs a shell. With shell:true the
      // command must be a single string (passing an args array triggers DEP0190).
      const useShell = process.platform === 'win32';
      child = useShell
        ? spawn('npx -y ccstatusline@latest', { shell: true })
        : spawn('npx', ['-y', 'ccstatusline@latest']);
    } catch (err) {
      resolve({ ok: false, error: String(err && err.message || err) });
      return;
    }
    let stderr = '';
    const timer = setTimeout(() => {
      try { child.kill(); } catch {}
      resolve({ ok: false, error: 'timed out after 60s' });
    }, 60000);
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, error: String(err && err.message || err) });
    });
    if (child.stderr) child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, error: stderr });
    });
    // Swallow async stdin errors (e.g. EPIPE if the child closes stdin first) so they
    // don't surface as an unhandled stream 'error' event and crash the process.
    if (child.stdin) child.stdin.on('error', () => {});
    try { child.stdin.write(input); child.stdin.end(); } catch {}
  });
}

// --- npx cache repair (safe: cache is regenerable) ---

export function purgeCcstatuslineNpxCache(npxCacheDir) {
  const purged = [];
  let entries;
  try {
    entries = fs.readdirSync(npxCacheDir, { withFileTypes: true });
  } catch {
    return purged;
  }
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const dir = path.join(npxCacheDir, ent.name);
    let pkg;
    try {
      pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    } catch {
      continue;
    }
    const specs = pkg && pkg._npx && pkg._npx.packages;
    if (!Array.isArray(specs)) continue;
    const isCcstatusline = specs.some(s =>
      typeof s === 'string' && (s === 'ccstatusline' || s.startsWith('ccstatusline@')));
    if (!isCcstatusline) continue;
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      purged.push(ent.name);
    } catch {}
  }
  return purged;
}

// --- Core: structured results consumed by both CLI and TUI ---

export async function runHealthCheck(paths = defaultPaths, runStatusline = defaultRunStatusline) {
  const checks = [];

  // 1. Reader files deployed
  const missingReader = READER_FILES.filter(f => !fs.existsSync(path.join(paths.readerDir, f)));
  checks.push(missingReader.length === 0
    ? { id: 'reader', label: 'Reader deployed', status: 'ok', detail: paths.readerDir }
    : { id: 'reader', label: 'Reader deployed', status: 'fail', detail: `missing ${missingReader.join(', ')} — ${INSTALL_HINT}` });

  // 2. config.json valid
  try {
    JSON.parse(fs.readFileSync(path.join(paths.readerDir, 'config.json'), 'utf8'));
    checks.push({ id: 'config', label: 'config.json valid', status: 'ok', detail: 'parsed' });
  } catch {
    checks.push({ id: 'config', label: 'config.json valid', status: 'fail', detail: `missing or invalid — ${INSTALL_HINT}` });
  }

  // 3. statusLine configured in Claude settings
  try {
    const s = JSON.parse(fs.readFileSync(paths.claudeSettings, 'utf8'));
    if (s && typeof s === 'object' && s.statusLine && typeof s.statusLine === 'object') {
      const cmd = typeof s.statusLine.command === 'string' ? s.statusLine.command : 'present';
      checks.push({ id: 'statusline', label: 'statusLine configured', status: 'ok', detail: cmd });
    } else {
      checks.push({ id: 'statusline', label: 'statusLine configured', status: 'fail', detail: `no statusLine key — ${INSTALL_HINT}` });
    }
  } catch {
    checks.push({ id: 'statusline', label: 'statusLine configured', status: 'fail', detail: `settings.json missing or invalid — ${INSTALL_HINT}` });
  }

  // 4. bmad widgets registered in ccstatusline settings
  try {
    const cc = JSON.parse(fs.readFileSync(paths.ccstatuslineSettings, 'utf8'));
    const widgets = Array.isArray(cc.lines) ? cc.lines.flat() : [];
    const hasBmad = widgets.some(w => w && typeof w.id === 'string' && w.id.startsWith('bmad-line-'));
    checks.push(hasBmad
      ? { id: 'widgets', label: 'ccstatusline widgets registered', status: 'ok', detail: 'bmad-line-* present' }
      : { id: 'widgets', label: 'ccstatusline widgets registered', status: 'fail', detail: `no bmad-line-* widgets — ${INSTALL_HINT}` });
  } catch {
    checks.push({ id: 'widgets', label: 'ccstatusline widgets registered', status: 'fail', detail: `ccstatusline settings missing or invalid — ${INSTALL_HINT}` });
  }

  // 5. Functional npx check + auto-repair
  let run = await runStatusline();
  if (run.ok) {
    checks.push({ id: 'npx', label: 'ccstatusline runs via npx', status: 'ok', detail: 'npx -y ccstatusline@latest exits 0' });
  } else {
    const purged = purgeCcstatuslineNpxCache(paths.npxCacheDir);
    if (purged.length === 0) {
      checks.push({ id: 'npx', label: 'ccstatusline runs via npx', status: 'fail', detail: `npx failed, no ccstatusline cache to purge — ${truncate(run.error)}` });
    } else {
      run = await runStatusline();
      checks.push(run.ok
        ? { id: 'npx', label: 'ccstatusline runs via npx', status: 'repaired', detail: `purged ${purged.length} broken npx cache entr${purged.length === 1 ? 'y' : 'ies'}; npx now runs` }
        : { id: 'npx', label: 'ccstatusline runs via npx', status: 'fail', detail: `purged cache but still failing — ${INSTALL_HINT}. ${truncate(run.error)}` });
    }
  }

  const healthy = checks.every(c => c.status !== 'fail');
  return { checks, healthy };
}

// --- CLI wrapper ---

export default async function doctor(paths = defaultPaths, runStatusline = defaultRunStatusline) {
  console.log(`\n  ${B}🩺 bmad-statusline doctor${_}`);
  logSection('🔍', 'Health check');

  const { checks, healthy } = await runHealthCheck(paths, runStatusline);
  for (const c of checks) {
    if (c.status === 'ok') logSuccess(c.label, c.detail);
    else if (c.status === 'repaired') logSuccess(c.label, `repaired — ${c.detail}`);
    else logError(c.label, c.detail);
  }

  console.log(`\n  ${D}${'─'.repeat(38)}${_}`);
  if (!healthy) {
    console.log(`\n  ${R}${B}⚠  Problems found — see above.${_}\n`);
    process.exit(1);
  }
  console.log(`\n  ${G}${B}✓ Status line healthy.${_}\n`);
}
