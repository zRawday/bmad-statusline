import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import uninstall from '../src/uninstall.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, 'fixtures');

function captureOutput(fn) {
  const logs = [];
  const origLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try { fn(); } finally { console.log = origLog; }
  return logs.join('\n');
}

function createPaths(baseDir) {
  return {
    claudeSettings: path.join(baseDir, 'claude', 'settings.json'),
    ccstatuslineSettings: path.join(baseDir, 'config', 'ccstatusline', 'settings.json'),
    readerDir: path.join(baseDir, 'config', 'bmad-statusline'),
    cacheDir: path.join(baseDir, 'cache', 'bmad-status'),
    claudeMd: path.join(baseDir, 'project', '.claude', 'CLAUDE.md'),
    settingsLocal: path.join(baseDir, 'project', '.claude', 'settings.local.json'),
  };
}

function copyFixture(fixtureName, destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(path.join(FIXTURES, fixtureName), destPath);
}

function setup() {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-uninstall-'));
  const paths = createPaths(baseDir);
  return { baseDir, paths };
}

function teardown(baseDir) {
  fs.rmSync(baseDir, { recursive: true, force: true });
}

// --- Target 1: statusLine preservation ---

describe('Target 1: statusLine preservation', () => {
  it('always logs preserved message', () => {
    const { baseDir, paths } = setup();
    try {
      const output = captureOutput(() => uninstall(paths));
      assert.ok(output.includes('\u25CB'), 'should contain skipped marker');
      assert.ok(output.includes('statusLine preserved'), 'should mention statusLine preserved');
    } finally { teardown(baseDir); }
  });
});

// --- Target 2: ccstatusline BMAD widget removal ---

describe('Target 2: ccstatusline widget removal', () => {
  it('removes BMAD widgets when present', () => {
    const { baseDir, paths } = setup();
    try {
      copyFixture('ccstatusline-settings-with-bmad.json', paths.ccstatuslineSettings);
      const output = captureOutput(() => uninstall(paths));
      const config = JSON.parse(fs.readFileSync(paths.ccstatuslineSettings, 'utf8'));
      const allWidgets = config.lines.flat();
      const bmadWidgets = allWidgets.filter(w => w.id && (w.id.startsWith('bmad-') || w.id.startsWith('sep-bmad-')));
      assert.equal(bmadWidgets.length, 0, 'no BMAD widgets should remain');
      assert.ok(output.includes('BMAD widgets removed'));
    } finally { teardown(baseDir); }
  });

  it('skips when no BMAD widgets', () => {
    const { baseDir, paths } = setup();
    try {
      copyFixture('ccstatusline-settings-empty.json', paths.ccstatuslineSettings);
      const output = captureOutput(() => uninstall(paths));
      assert.ok(output.includes('no BMAD widgets found'));
    } finally { teardown(baseDir); }
  });

  it('skips when config file does not exist', () => {
    const { baseDir, paths } = setup();
    try {
      const output = captureOutput(() => uninstall(paths));
      assert.ok(output.includes('file not found'));
    } finally { teardown(baseDir); }
  });

  it('preserves user widgets on other lines', () => {
    const { baseDir, paths } = setup();
    try {
      const mixedConfig = {
        version: 3,
        lines: [
          [{ id: 'user-model', type: 'model', color: 'cyan' }],
          [
            { id: 'bmad-agent', type: 'custom-command', commandPath: 'node reader.js agent', color: 'white', preserveColors: true },
            { id: 'sep-bmad-1', type: 'separator' },
            { id: 'bmad-compact', type: 'custom-command', commandPath: 'node reader.js compact', color: 'white', preserveColors: true }
          ],
          [{ id: 'user-clock', type: 'clock' }]
        ]
      };
      fs.mkdirSync(path.dirname(paths.ccstatuslineSettings), { recursive: true });
      fs.writeFileSync(paths.ccstatuslineSettings, JSON.stringify(mixedConfig, null, 2));
      captureOutput(() => uninstall(paths));
      const config = JSON.parse(fs.readFileSync(paths.ccstatuslineSettings, 'utf8'));
      // User widgets preserved
      assert.equal(config.lines[0].length, 1);
      assert.equal(config.lines[0][0].id, 'user-model');
      assert.equal(config.lines[2].length, 1);
      assert.equal(config.lines[2][0].id, 'user-clock');
      // BMAD widgets removed from line 1
      assert.equal(config.lines[1].length, 0);
    } finally { teardown(baseDir); }
  });

  it('creates .bak before modification', () => {
    const { baseDir, paths } = setup();
    try {
      copyFixture('ccstatusline-settings-with-bmad.json', paths.ccstatuslineSettings);
      captureOutput(() => uninstall(paths));
      assert.ok(fs.existsSync(paths.ccstatuslineSettings + '.bak'), '.bak file should exist');
      // Backup should contain original content with BMAD widgets
      const bak = JSON.parse(fs.readFileSync(paths.ccstatuslineSettings + '.bak', 'utf8'));
      const bakBmad = bak.lines.flat().filter(w => w.id && w.id.startsWith('bmad-'));
      assert.ok(bakBmad.length > 0, 'backup should contain original BMAD widgets');
    } finally { teardown(baseDir); }
  });

  it('removes v2 bmad-line-* composite widgets', () => {
    const { baseDir, paths } = setup();
    try {
      const v2Config = {
        version: 3,
        lines: [
          [{ id: 'bmad-line-0', type: 'custom-command', commandPath: 'node reader.js line 0', preserveColors: true }],
          [{ id: 'bmad-line-1', type: 'custom-command', commandPath: 'node reader.js line 1', preserveColors: true }],
          []
        ]
      };
      fs.mkdirSync(path.dirname(paths.ccstatuslineSettings), { recursive: true });
      fs.writeFileSync(paths.ccstatuslineSettings, JSON.stringify(v2Config, null, 2));
      captureOutput(() => uninstall(paths));
      const config = JSON.parse(fs.readFileSync(paths.ccstatuslineSettings, 'utf8'));
      const allWidgets = config.lines.flat();
      const bmadWidgets = allWidgets.filter(w => w.id && w.id.startsWith('bmad-line-'));
      assert.equal(bmadWidgets.length, 0, 'no bmad-line-* widgets should remain');
    } finally { teardown(baseDir); }
  });

  it('removes mixed v1 and v2 widgets in single pass', () => {
    const { baseDir, paths } = setup();
    try {
      const mixedConfig = {
        version: 3,
        lines: [
          [{ id: 'bmad-line-0', type: 'custom-command', commandPath: 'node reader.js line 0', preserveColors: true }],
          [
            { id: 'bmad-compact', type: 'custom-command', commandPath: 'node reader.js compact', color: 'white', preserveColors: true },
            { id: 'sep-bmad-1', type: 'separator' }
          ],
          []
        ]
      };
      fs.mkdirSync(path.dirname(paths.ccstatuslineSettings), { recursive: true });
      fs.writeFileSync(paths.ccstatuslineSettings, JSON.stringify(mixedConfig, null, 2));
      captureOutput(() => uninstall(paths));
      const config = JSON.parse(fs.readFileSync(paths.ccstatuslineSettings, 'utf8'));
      const allWidgets = config.lines.flat();
      assert.equal(allWidgets.length, 0, 'all bmad widgets (v1+v2) should be removed');
    } finally { teardown(baseDir); }
  });

  it('config.json is deleted by directory deletion (Target 3)', () => {
    const { baseDir, paths } = setup();
    try {
      fs.mkdirSync(paths.readerDir, { recursive: true });
      fs.writeFileSync(path.join(paths.readerDir, 'config.json'), '{"lines":[]}');
      fs.writeFileSync(path.join(paths.readerDir, 'bmad-sl-reader.js'), '// reader');
      captureOutput(() => uninstall(paths));
      assert.ok(!fs.existsSync(path.join(paths.readerDir, 'config.json')), 'config.json should be deleted');
      assert.ok(!fs.existsSync(paths.readerDir), 'entire directory should be deleted');
    } finally { teardown(baseDir); }
  });
});

// --- Target 3: reader directory removal ---

describe('Target 3: reader directory removal', () => {
  it('deletes reader directory when exists', () => {
    const { baseDir, paths } = setup();
    try {
      fs.mkdirSync(paths.readerDir, { recursive: true });
      fs.writeFileSync(path.join(paths.readerDir, 'bmad-sl-reader.js'), '// reader');
      const output = captureOutput(() => uninstall(paths));
      assert.ok(!fs.existsSync(paths.readerDir), 'reader directory should be deleted');
      assert.ok(output.includes('\u2713'), 'should contain success marker');
    } finally { teardown(baseDir); }
  });

  it('skips when directory does not exist', () => {
    const { baseDir, paths } = setup();
    try {
      const output = captureOutput(() => uninstall(paths));
      assert.ok(output.includes('directory not found'));
    } finally { teardown(baseDir); }
  });
});

// --- Target 4: cache directory removal ---

describe('Target 4: cache directory removal', () => {
  it('deletes cache directory when exists', () => {
    const { baseDir, paths } = setup();
    try {
      fs.mkdirSync(paths.cacheDir, { recursive: true });
      fs.writeFileSync(path.join(paths.cacheDir, 'status-test.json'), '{}');
      const output = captureOutput(() => uninstall(paths));
      assert.ok(!fs.existsSync(paths.cacheDir), 'cache directory should be deleted');
      assert.ok(output.includes('\u2713'), 'should contain success marker');
    } finally { teardown(baseDir); }
  });

  it('skips when directory does not exist', () => {
    const { baseDir, paths } = setup();
    try {
      const output = captureOutput(() => uninstall(paths));
      assert.ok(output.includes('directory not found'));
    } finally { teardown(baseDir); }
  });
});

// --- Target 5: hook config removal ---

describe('Target 5: hook config removal', () => {
  it('removes bmad-hook PostToolUse entries when present', () => {
    const { baseDir, paths } = setup();
    try {
      copyFixture('claude-settings-with-hooks.json', paths.claudeSettings);
      const output = captureOutput(() => uninstall(paths));
      const config = JSON.parse(fs.readFileSync(paths.claudeSettings, 'utf8'));
      assert.ok(config.hooks, 'hooks key should be preserved');
      assert.deepEqual(config.hooks.UserPromptSubmit, [], 'UserPromptSubmit should be empty array');
      assert.deepEqual(config.hooks.PostToolUse, [], 'PostToolUse should be empty array');
      assert.deepEqual(config.hooks.SessionStart, [], 'SessionStart should be empty array');
      assert.ok(output.includes('hook config removed'));
    } finally { teardown(baseDir); }
  });

  it('preserves non-bmad hooks in PostToolUse', () => {
    const { baseDir, paths } = setup();
    try {
      const mixedHooks = {
        permissions: {},
        hooks: {
          PostToolUse: [
            { matcher: 'Skill', hooks: [{ type: 'command', command: 'node other-hook.js' }] },
            { matcher: 'Skill', hooks: [{ type: 'command', command: 'node "~/.config/bmad-statusline/bmad-hook.js"' }] },
            { matcher: 'Read', hooks: [{ type: 'command', command: 'node "~/.config/bmad-statusline/bmad-hook.js"' }] }
          ]
        }
      };
      fs.mkdirSync(path.dirname(paths.claudeSettings), { recursive: true });
      fs.writeFileSync(paths.claudeSettings, JSON.stringify(mixedHooks, null, 2));
      captureOutput(() => uninstall(paths));
      const config = JSON.parse(fs.readFileSync(paths.claudeSettings, 'utf8'));
      assert.ok(config.hooks, 'hooks key should remain');
      assert.equal(config.hooks.PostToolUse.length, 1, 'only non-bmad hook should remain');
      assert.ok(config.hooks.PostToolUse[0].hooks[0].command.includes('other-hook.js'));
    } finally { teardown(baseDir); }
  });

  it('skips when no hook entries present', () => {
    const { baseDir, paths } = setup();
    try {
      copyFixture('claude-settings-with-statusline.json', paths.claudeSettings);
      const output = captureOutput(() => uninstall(paths));
      assert.ok(output.includes('no hook config found'));
    } finally { teardown(baseDir); }
  });

  it('skips when settings.json does not exist', () => {
    const { baseDir, paths } = setup();
    try {
      const output = captureOutput(() => uninstall(paths));
      assert.ok(output.includes('~/.claude/settings.json hooks'));
    } finally { teardown(baseDir); }
  });

  it('creates .bak before modification', () => {
    const { baseDir, paths } = setup();
    try {
      copyFixture('claude-settings-with-hooks.json', paths.claudeSettings);
      captureOutput(() => uninstall(paths));
      assert.ok(fs.existsSync(paths.claudeSettings + '.bak'), '.bak file should exist');
      const bak = JSON.parse(fs.readFileSync(paths.claudeSettings + '.bak', 'utf8'));
      assert.ok(bak.hooks && bak.hooks.PostToolUse, 'backup should contain original hooks');
    } finally { teardown(baseDir); }
  });

  it('removes Phase 2 Skill+Read matchers from PostToolUse only', () => {
    const { baseDir, paths } = setup();
    try {
      copyFixture('claude-settings-with-hooks-phase2.json', paths.claudeSettings);
      const output = captureOutput(() => uninstall(paths));
      const config = JSON.parse(fs.readFileSync(paths.claudeSettings, 'utf8'));
      assert.ok(config.hooks, 'hooks object should be preserved');
      assert.deepEqual(config.hooks.PostToolUse, [], 'PostToolUse should be empty array');
      assert.equal(config.hooks.UserPromptSubmit, undefined, 'UserPromptSubmit should not exist');
      assert.equal(config.hooks.SessionStart, undefined, 'SessionStart should not exist');
      assert.ok(output.includes('hook config removed'));
    } finally { teardown(baseDir); }
  });

  it('preserves empty arrays and hooks object after removal', () => {
    const { baseDir, paths } = setup();
    try {
      copyFixture('claude-settings-with-hooks.json', paths.claudeSettings);
      captureOutput(() => uninstall(paths));
      const config = JSON.parse(fs.readFileSync(paths.claudeSettings, 'utf8'));
      assert.ok(config.hooks, 'hooks object should be preserved');
      assert.deepEqual(config.hooks.UserPromptSubmit, [], 'empty array preserved');
      assert.deepEqual(config.hooks.PostToolUse, [], 'empty array preserved');
      assert.deepEqual(config.hooks.SessionStart, [], 'empty array preserved');
      assert.ok(config.permissions !== undefined, 'other keys should be preserved');
    } finally { teardown(baseDir); }
  });
});

// --- Target 6: CLAUDE.md marker block removal (backward compat) ---

describe('Target 6: CLAUDE.md marker removal (backward compat)', () => {
  it('removes marker block and preserves surrounding content', () => {
    const { baseDir, paths } = setup();
    try {
      copyFixture('claude-md-with-block.md', paths.claudeMd);
      const output = captureOutput(() => uninstall(paths));
      const after = fs.readFileSync(paths.claudeMd, 'utf8');
      assert.ok(!after.includes('<!-- bmad-statusline:start -->'), 'start marker should be removed');
      assert.ok(!after.includes('<!-- bmad-statusline:end -->'), 'end marker should be removed');
      assert.ok(!after.includes('Old BMAD Status Tracking'), 'block content should be removed');
      assert.ok(after.includes('Some existing content here'), 'content before block preserved');
      assert.ok(after.includes('More content after the block'), 'content after block preserved');
      assert.ok(output.includes('instruction block removed'));
    } finally { teardown(baseDir); }
  });

  it('skips silently when no markers present', () => {
    const { baseDir, paths } = setup();
    try {
      copyFixture('claude-md-without-block.md', paths.claudeMd);
      const output = captureOutput(() => uninstall(paths));
      const after = fs.readFileSync(paths.claudeMd, 'utf8');
      assert.ok(after.includes('Some existing content here'), 'content should be unchanged');
      assert.ok(!output.includes('CLAUDE.md'), 'should not mention CLAUDE.md when silently skipping');
    } finally { teardown(baseDir); }
  });

  it('skips silently when file does not exist', () => {
    const { baseDir, paths } = setup();
    try {
      const output = captureOutput(() => uninstall(paths));
      assert.ok(!output.includes('CLAUDE.md'), 'should not mention CLAUDE.md when file missing');
    } finally { teardown(baseDir); }
  });
});

// --- Target 7: settings.local.json backward compat ---

describe('Target 7: settings.local.json backward compat', () => {
  it('removes BMAD_PROJ_DIR rules when present', () => {
    const { baseDir, paths } = setup();
    try {
      copyFixture('settings-local-with-bmad.json', paths.settingsLocal);
      const output = captureOutput(() => uninstall(paths));
      assert.ok(!fs.existsSync(paths.settingsLocal), 'file should be deleted when empty after rule removal');
      assert.ok(output.includes('BMAD permission rules removed'));
    } finally { teardown(baseDir); }
  });

  it('skips silently when no matching rules', () => {
    const { baseDir, paths } = setup();
    try {
      const noMatch = { permissions: { allow: ['Bash(OTHER_RULE=*)'] } };
      fs.mkdirSync(path.dirname(paths.settingsLocal), { recursive: true });
      fs.writeFileSync(paths.settingsLocal, JSON.stringify(noMatch, null, 2));
      const output = captureOutput(() => uninstall(paths));
      assert.ok(!output.includes('settings.local.json'), 'should not mention settings.local.json when silently skipping');
    } finally { teardown(baseDir); }
  });

  it('skips silently when file does not exist', () => {
    const { baseDir, paths } = setup();
    try {
      const output = captureOutput(() => uninstall(paths));
      assert.ok(!output.includes('settings.local.json'), 'should not mention settings.local.json when file missing');
    } finally { teardown(baseDir); }
  });

  it('deletes file when empty after rule removal', () => {
    const { baseDir, paths } = setup();
    try {
      copyFixture('settings-local-with-bmad.json', paths.settingsLocal);
      captureOutput(() => uninstall(paths));
      assert.ok(!fs.existsSync(paths.settingsLocal), 'file should be deleted');
    } finally { teardown(baseDir); }
  });

  it('preserves other config when only BMAD rules removed', () => {
    const { baseDir, paths } = setup();
    try {
      const mixed = {
        permissions: { allow: ['Bash(BMAD_PROJ_DIR=*)', 'Read(*)'] },
        other: { key: 'value' }
      };
      fs.mkdirSync(path.dirname(paths.settingsLocal), { recursive: true });
      fs.writeFileSync(paths.settingsLocal, JSON.stringify(mixed, null, 2));
      captureOutput(() => uninstall(paths));
      const config = JSON.parse(fs.readFileSync(paths.settingsLocal, 'utf8'));
      assert.deepEqual(config.permissions.allow, ['Read(*)'], 'non-BMAD rules preserved');
      assert.deepEqual(config.other, { key: 'value' }, 'other config preserved');
    } finally { teardown(baseDir); }
  });
});

// --- Mixed-generation cleanup ---

describe('mixed-generation cleanup', () => {
  it('cleans all 3 generations in single pass', () => {
    const { baseDir, paths } = setup();
    try {
      // Phase 4: hooks with all 3 event types
      copyFixture('claude-settings-with-hooks.json', paths.claudeSettings);
      // Phase 1: CLAUDE.md with markers
      copyFixture('claude-md-with-block.md', paths.claudeMd);
      // Phase 1: settings.local.json with BMAD_PROJ_DIR
      copyFixture('settings-local-with-bmad.json', paths.settingsLocal);

      const output = captureOutput(() => uninstall(paths));

      // Target 5: hooks cleaned, empty arrays preserved
      const config = JSON.parse(fs.readFileSync(paths.claudeSettings, 'utf8'));
      assert.ok(config.hooks, 'hooks object should be preserved');
      assert.deepEqual(config.hooks.UserPromptSubmit, [], 'empty array preserved');
      assert.deepEqual(config.hooks.PostToolUse, [], 'empty array preserved');
      assert.deepEqual(config.hooks.SessionStart, [], 'empty array preserved');

      // Target 6: CLAUDE.md markers removed
      const claudeMd = fs.readFileSync(paths.claudeMd, 'utf8');
      assert.ok(!claudeMd.includes('<!-- bmad-statusline:start -->'), 'start marker removed');
      assert.ok(!claudeMd.includes('<!-- bmad-statusline:end -->'), 'end marker removed');

      // Target 7: BMAD_PROJ_DIR rules removed
      assert.ok(!fs.existsSync(paths.settingsLocal), 'settings.local.json deleted (was empty)');

      // All 3 targets reported success
      assert.ok(output.includes('hook config removed'), 'Target 5 success');
      assert.ok(output.includes('instruction block removed'), 'Target 6 success');
      assert.ok(output.includes('BMAD permission rules removed'), 'Target 7 success');
    } finally { teardown(baseDir); }
  });
});

// --- Idempotency ---

describe('idempotency', () => {
  it('second uninstall run shows all skipped', () => {
    const { baseDir, paths } = setup();
    try {
      // Set up all 7 targets
      copyFixture('ccstatusline-settings-with-bmad.json', paths.ccstatuslineSettings);
      fs.mkdirSync(paths.readerDir, { recursive: true });
      fs.writeFileSync(path.join(paths.readerDir, 'reader.js'), '// reader');
      fs.mkdirSync(paths.cacheDir, { recursive: true });
      copyFixture('claude-settings-with-hooks.json', paths.claudeSettings);
      copyFixture('claude-md-with-block.md', paths.claudeMd);
      copyFixture('settings-local-with-bmad.json', paths.settingsLocal);

      // First run removes everything
      captureOutput(() => uninstall(paths));

      // Second run: all skipped
      const output = captureOutput(() => uninstall(paths));
      const targetLines = output.split('\n').filter(l => l.includes('\u2014'));
      for (const line of targetLines) {
        assert.ok(line.includes('\u25CB'), `expected skipped marker in: "${line}"`);
      }
    } finally { teardown(baseDir); }
  });
});

// --- Path injection ---

describe('path injection', () => {
  it('uses injected paths instead of real home directory', () => {
    const { baseDir, paths } = setup();
    try {
      // Create reader dir in temp location
      fs.mkdirSync(paths.readerDir, { recursive: true });
      captureOutput(() => uninstall(paths));
      // Verify it used injected path (reader dir deleted from temp, not from real home)
      assert.ok(!fs.existsSync(paths.readerDir), 'injected reader dir should be deleted');
      // Real home reader dir should be unaffected (we can't assert this without checking real fs,
      // but the fact that we're using temp paths proves injection works)
    } finally { teardown(baseDir); }
  });
});
