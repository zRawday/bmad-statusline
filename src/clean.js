import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ALIVE_MAX_AGE_MS } from './defaults.js';

const DEFAULT_PATHS = {
  cacheDir: process.env.BMAD_CACHE_DIR || path.join(os.homedir(), '.cache', 'bmad-status'),
  homeDir: os.homedir()
};

function logSuccess(target, message) { console.log(`  \u2713 ${target} \u2014 ${message}`); }
function logSkipped(target, message) { console.log(`  \u25CB ${target} \u2014 ${message}`); }
function logError(target, message)   { console.log(`  \u2717 ${target} \u2014 ${message}`); }

export default function clean(paths = DEFAULT_PATHS) {
  const cacheDir = paths.cacheDir;
  const homeDir = paths.homeDir || os.homedir();
  const displayDir = cacheDir.replace(homeDir, '~');

  if (!fs.existsSync(cacheDir)) {
    logSkipped(displayDir, 'directory not found');
    return;
  }

  const entries = fs.readdirSync(cacheDir, { withFileTypes: true });

  // Build session ID maps
  const statusFiles = new Map(); // sid -> filename
  const aliveFiles = new Map();  // sid -> filename

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const statusMatch = entry.name.match(/^status-(.+)\.json$/);
    if (statusMatch) {
      statusFiles.set(statusMatch[1], entry.name);
      continue;
    }
    const aliveMatch = entry.name.match(/^\.alive-(.+)$/);
    if (aliveMatch) {
      aliveFiles.set(aliveMatch[1], entry.name);
    }
  }

  if (statusFiles.size === 0 && aliveFiles.size === 0) {
    logSkipped(displayDir, 'already clean');
    return;
  }

  const now = Date.now();
  let deleted = 0;

  // Collect all session IDs
  const allSids = new Set([...statusFiles.keys(), ...aliveFiles.keys()]);

  for (const sid of allSids) {
    const hasStatus = statusFiles.has(sid);
    const hasAlive = aliveFiles.has(sid);

    if (hasStatus && hasAlive) {
      // Paired — check alive mtime
      const alivePath = path.join(cacheDir, aliveFiles.get(sid));
      let aliveStat;
      try {
        aliveStat = fs.statSync(alivePath);
      } catch {
        // Alive file disappeared between readdirSync and statSync — treat as orphaned status
        try {
          fs.unlinkSync(path.join(cacheDir, statusFiles.get(sid)));
          deleted++;
        } catch (err) {
          logError(statusFiles.get(sid), `failed to delete — ${err.code || err.message}`);
        }
        continue;
      }
      const isExpired = (now - aliveStat.mtimeMs) > ALIVE_MAX_AGE_MS;

      if (isExpired) {
        // Expired pair — delete both
        try {
          fs.unlinkSync(path.join(cacheDir, statusFiles.get(sid)));
          deleted++;
        } catch (err) {
          logError(statusFiles.get(sid), `failed to delete — ${err.code || err.message}`);
        }
        try {
          fs.unlinkSync(alivePath);
          deleted++;
        } catch (err) {
          logError(aliveFiles.get(sid), `failed to delete — ${err.code || err.message}`);
        }
      }
      // Active pair — skip both (do nothing)
    } else if (hasStatus && !hasAlive) {
      // Orphaned status — delete
      try {
        fs.unlinkSync(path.join(cacheDir, statusFiles.get(sid)));
        deleted++;
      } catch (err) {
        logError(statusFiles.get(sid), `failed to delete — ${err.code || err.message}`);
      }
    } else if (!hasStatus && hasAlive) {
      // Orphaned alive — delete
      try {
        fs.unlinkSync(path.join(cacheDir, aliveFiles.get(sid)));
        deleted++;
      } catch (err) {
        logError(aliveFiles.get(sid), `failed to delete — ${err.code || err.message}`);
      }
    }
  }

  if (deleted > 0) {
    logSuccess(displayDir, `${deleted} file(s) purged`);
  } else {
    logSkipped(displayDir, 'already clean');
  }
}
