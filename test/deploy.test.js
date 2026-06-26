import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  DEPLOY_FILES,
  VERSION_STAMP,
  getPackageVersion,
  getDeployedVersion,
  isDeployStale,
  syncDeploy,
} from '../src/deploy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_VERSION = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
).version;

let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-deploy-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

describe('getPackageVersion', () => {
  it('returns the package.json version', () => {
    assert.equal(getPackageVersion(), PKG_VERSION);
  });
});

describe('getDeployedVersion', () => {
  it('returns null when the stamp is absent', () => {
    assert.equal(getDeployedVersion(dir), null);
  });

  it('returns the trimmed stamp value when present', () => {
    fs.writeFileSync(path.join(dir, VERSION_STAMP), '9.9.9\n');
    assert.equal(getDeployedVersion(dir), '9.9.9');
  });
});

describe('isDeployStale', () => {
  it('is stale when code files are missing (empty dir)', () => {
    assert.equal(isDeployStale(dir, PKG_VERSION), true);
  });

  it('is stale when files exist but the stamp is absent (pre-stamp install)', () => {
    for (const f of DEPLOY_FILES) fs.writeFileSync(path.join(dir, f.name), '// stub');
    assert.equal(isDeployStale(dir, PKG_VERSION), true);
  });

  it('is stale when the stamp differs from the package version', () => {
    for (const f of DEPLOY_FILES) fs.writeFileSync(path.join(dir, f.name), '// stub');
    fs.writeFileSync(path.join(dir, VERSION_STAMP), '0.0.1\n');
    assert.equal(isDeployStale(dir, PKG_VERSION), true);
  });

  it('is fresh when all files exist and the stamp matches', () => {
    for (const f of DEPLOY_FILES) fs.writeFileSync(path.join(dir, f.name), '// stub');
    fs.writeFileSync(path.join(dir, VERSION_STAMP), PKG_VERSION + '\n');
    assert.equal(isDeployStale(dir, PKG_VERSION), false);
  });
});

describe('syncDeploy', () => {
  it('copies every deploy file and writes the version stamp', () => {
    const written = syncDeploy(dir, PKG_VERSION);
    assert.deepEqual(written, DEPLOY_FILES.map(f => f.name));
    for (const f of DEPLOY_FILES) {
      assert.ok(fs.existsSync(path.join(dir, f.name)), `${f.name} should be deployed`);
    }
    // Real reader content, not a stub
    assert.ok(fs.readFileSync(path.join(dir, 'bmad-sl-reader.js'), 'utf8').includes('use strict'));
    assert.equal(getDeployedVersion(dir), PKG_VERSION);
  });

  it('creates the deploy dir if missing and leaves a non-stale deployment', () => {
    const nested = path.join(dir, 'a', 'b');
    syncDeploy(nested, PKG_VERSION);
    assert.equal(isDeployStale(nested, PKG_VERSION), false);
  });

  it('defaults to the package version when none is passed', () => {
    syncDeploy(dir);
    assert.equal(getDeployedVersion(dir), PKG_VERSION);
  });
});
