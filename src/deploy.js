// deploy.js — single source of truth for the files copied into the deploy dir
// (~/.config/bmad-statusline/) plus a version stamp so callers can detect a stale
// deployment and auto-resync.
//
// Why this exists: ccstatusline executes the *deployed copy* of the reader/hook on
// every render — never the package directly (running npx per render would add a
// cold-start to every status line draw). `npx bmad-statusline` refreshes the
// *package* cache, but nothing refreshed the deploy dir except an explicit
// `install`. So a user who published a new version and ran `npx bmad-statusline`
// kept executing the old deployed reader. The stamp lets any entry point notice
// "package newer than deployed" and re-copy.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Code files deployed verbatim into the deploy dir, flat (names mirror sources).
export const DEPLOY_FILES = [
  { name: 'bmad-sl-reader.js',    src: path.join(__dirname, 'reader', 'bmad-sl-reader.js') },
  { name: 'workflow-colors.cjs',  src: path.join(__dirname, 'reader', 'workflow-colors.cjs') },
  { name: 'shared-constants.cjs', src: path.join(__dirname, 'reader', 'shared-constants.cjs') },
  { name: 'bmad-hook.js',         src: path.join(__dirname, 'hook', 'bmad-hook.js') },
];

// Stamp file recording which package version produced the deployed copy.
export const VERSION_STAMP = '.deployed-version';

// Version of THIS running package (the npx-cached one when invoked via npx).
export function getPackageVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version || null;
  } catch {
    return null;
  }
}

// Version recorded in the deploy dir, or null if unstamped/missing.
export function getDeployedVersion(readerDir) {
  try {
    return fs.readFileSync(path.join(readerDir, VERSION_STAMP), 'utf8').trim() || null;
  } catch {
    return null;
  }
}

// Stale when any code file is missing, or the stamp differs from the package
// version. The stamp-differs case covers both the "npx updated the package but
// not the deploy dir" gap and pre-stamp installs (stamp absent → null ≠ version).
export function isDeployStale(readerDir, packageVersion = getPackageVersion()) {
  for (const f of DEPLOY_FILES) {
    if (!fs.existsSync(path.join(readerDir, f.name))) return true;
  }
  return getDeployedVersion(readerDir) !== packageVersion;
}

// Copy every deploy file into readerDir and write the version stamp. Returns the
// list of file names written. Throws on I/O error — callers decide how to report.
export function syncDeploy(readerDir, packageVersion = getPackageVersion()) {
  fs.mkdirSync(readerDir, { recursive: true });
  for (const f of DEPLOY_FILES) {
    fs.copyFileSync(f.src, path.join(readerDir, f.name));
  }
  if (packageVersion) {
    fs.writeFileSync(path.join(readerDir, VERSION_STAMP), packageVersion + '\n');
  }
  return DEPLOY_FILES.map(f => f.name);
}
