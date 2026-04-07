// tui-lifecycle.js — PID registry, signal handlers, TTY orphan detection (Pattern 28)

import fs from 'node:fs';
import path from 'node:path';

const REGISTRY_FILE = 'tui-pids.json';

export function loadRegistry(cachePath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(cachePath, REGISTRY_FILE), 'utf8'));
  } catch {
    return { pids: [] };
  }
}

export function saveRegistry(cachePath, registry) {
  try {
    fs.mkdirSync(cachePath, { recursive: true });
    const registryPath = path.join(cachePath, REGISTRY_FILE);
    const tmp = registryPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(registry, null, 2));
    fs.renameSync(tmp, registryPath);
  } catch { /* best-effort — lifecycle is non-critical */ }
}

export function registerPid(cachePath) {
  const registry = loadRegistry(cachePath);
  registry.pids = registry.pids.filter(pid => {
    try { process.kill(pid, 0); return true; }
    catch (e) { return e.code !== 'ESRCH'; }
  });
  registry.pids.push(process.pid);
  saveRegistry(cachePath, registry);
}

export function unregisterPid(cachePath) {
  const registry = loadRegistry(cachePath);
  registry.pids = registry.pids.filter(pid => pid !== process.pid);
  saveRegistry(cachePath, registry);
}

let ttyCheckId = null;

export function setupSignalHandlers(cachePath, restoreScreen) {
  function gracefulShutdown() {
    unregisterPid(cachePath);
    try { restoreScreen(); } catch {}
    process.exit();
  }

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGHUP', gracefulShutdown);
  process.on('uncaughtException', () => {
    unregisterPid(cachePath);
    try { restoreScreen(); } catch {}
    process.exit(1);
  });
  process.on('unhandledRejection', () => {
    unregisterPid(cachePath);
    try { restoreScreen(); } catch {}
    process.exit(1);
  });
}

export function startTtyWatch(cachePath, restoreScreen) {
  ttyCheckId = setInterval(() => {
    if (!process.stdout.isTTY) {
      clearInterval(ttyCheckId);
      ttyCheckId = null;
      unregisterPid(cachePath);
      try { restoreScreen(); } catch {}
      process.exit();
    }
  }, 5000);
  ttyCheckId.unref();
}

export function stopTtyWatch() {
  if (ttyCheckId !== null) {
    clearInterval(ttyCheckId);
    ttyCheckId = null;
  }
}
