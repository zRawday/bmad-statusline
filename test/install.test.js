import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import install from '../src/install.js';

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
    claudeDir: path.join(baseDir, 'claude'),
    ccstatuslineSettings: path.join(baseDir, 'config', 'ccstatusline', 'settings.json'),
    ccstatuslineDir: path.join(baseDir, 'config', 'ccstatusline'),
    readerDest: path.join(baseDir, 'config', 'bmad-statusline', 'bmad-sl-reader.js'),
    readerDir: path.join(baseDir, 'config', 'bmad-statusline'),
    hookDest: path.join(baseDir, 'config', 'bmad-statusline', 'bmad-hook.js'),
    cacheDir: path.join(baseDir, 'cache', 'bmad-status'),
  };
}

function copyFixture(fixtureName, destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(path.join(FIXTURES, fixtureName), destPath);
}

function setup() {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-install-'));
  const paths = createPaths(baseDir);
  return { baseDir, paths };
}

function teardown(baseDir) {
  fs.rmSync(baseDir, { recursive: true, force: true });
}

// --- Target 1: ~/.claude/settings.json ---

describe('Target 1: claude settings.json', () => {
  it('creates statusLine when absent', () => {
    const { baseDir, paths } = setup();
    try {
      copyFixture('claude-settings-empty.json', paths.claudeSettings);
      captureOutput(() => install(paths));
      const config = JSON.parse(fs.readFileSync(paths.claudeSettings, 'utf8'));
      assert.ok(config.statusLine, 'statusLine key should exist');
      assert.equal(config.statusLine.type, 'command');
      assert.ok(config.statusLine.command.includes('ccstatusline'));
    } finally { teardown(baseDir); }
  });

  it('skips when statusLine already present', () => {
    const { baseDir, paths } = setup();
    try {
      copyFixture('claude-settings-with-statusline.json', paths.claudeSettings);
      const output = captureOutput(() => install(paths));
      assert.ok(output.includes('statusLine already configured'), 'should log skipped for statusLine');
      // statusLine value preserved unchanged
      const config = JSON.parse(fs.readFileSync(paths.claudeSettings, 'utf8'));
      assert.equal(config.statusLine.type, 'command');
      assert.equal(config.statusLine.command, 'npx -y ccstatusline@latest');
    } finally { teardown(baseDir); }
  });

  it('creates ~/.claude/ directory and file when missing', () => {
    const { baseDir, paths } = setup();
    try {
      // Do not create claudeDir or settings.json
      captureOutput(() => install(paths));
      assert.ok(fs.existsSync(paths.claudeSettings), 'settings.json should be created');
      const config = JSON.parse(fs.readFileSync(paths.claudeSettings, 'utf8'));
      assert.ok(config.statusLine);
    } finally { teardown(baseDir); }
  });
});

// --- Target 2: ~/.config/ccstatusline/settings.json ---

describe('Target 2: ccstatusline settings.json', () => {
  it('injects bmad-line-0 on line 0 when absent', () => {
    const { baseDir, paths } = setup();
    try {
      copyFixture('ccstatusline-settings-empty.json', paths.ccstatuslineSettings);
      captureOutput(() => install(paths));
      const config = JSON.parse(fs.readFileSync(paths.ccstatuslineSettings, 'utf8'));
      const bmadWidgets = config.lines[0].filter(w => w.id && w.id.startsWith('bmad-'));
      assert.equal(bmadWidgets.length, 1, 'exactly 1 bmad widget on line 0');
      assert.equal(bmadWidgets[0].id, 'bmad-line-0');
      assert.equal(bmadWidgets[0].preserveColors, true);
      assert.equal(bmadWidgets[0].color, undefined, 'no color property');
    } finally { teardown(baseDir); }
  });

  it('skips when bmad-line-0 already present', () => {
    const { baseDir, paths } = setup();
    try {
      copyFixture('ccstatusline-settings-with-bmad.json', paths.ccstatuslineSettings);
      const before = fs.readFileSync(paths.ccstatuslineSettings, 'utf8');
      const output = captureOutput(() => install(paths));
      const after = fs.readFileSync(paths.ccstatuslineSettings, 'utf8');
      assert.equal(before, after, 'file should not change');
      assert.ok(output.includes('bmad-line-* already present'), 'should log specific skip message');
    } finally { teardown(baseDir); }
  });

  it('upgrades v1 widgets to v2 composite', () => {
    const { baseDir, paths } = setup();
    try {
      copyFixture('ccstatusline-settings-v1.json', paths.ccstatuslineSettings);
      const output = captureOutput(() => install(paths));
      const config = JSON.parse(fs.readFileSync(paths.ccstatuslineSettings, 'utf8'));
      const allWidgets = config.lines.flat();
      // Old v1 widgets removed
      const v1Widgets = allWidgets.filter(w => w.id && w.id.startsWith('bmad-') && !w.id.startsWith('bmad-line-'));
      assert.equal(v1Widgets.length, 0, 'all v1 individual widgets should be removed');
      const separators = allWidgets.filter(w => w.id && w.id.startsWith('sep-bmad-'));
      assert.equal(separators.length, 0, 'all sep-bmad-* separators should be removed');
      // v2 composite injected on line 0
      const v2Widgets = config.lines[0].filter(w => w.id === 'bmad-line-0');
      assert.equal(v2Widgets.length, 1, 'bmad-line-0 should be on line 0');
      assert.ok(output.includes('upgraded'), 'should log upgrade message');
    } finally { teardown(baseDir); }
  });

  it('creates directory hierarchy when missing', () => {
    const { baseDir, paths } = setup();
    try {
      captureOutput(() => install(paths));
      assert.ok(fs.existsSync(paths.ccstatuslineSettings), 'settings.json should be created');
      const config = JSON.parse(fs.readFileSync(paths.ccstatuslineSettings, 'utf8'));
      assert.equal(config.version, 3);
      assert.ok(Array.isArray(config.lines));
    } finally { teardown(baseDir); }
  });

  it('preserves existing user widgets on other lines', () => {
    const { baseDir, paths } = setup();
    try {
      const userConfig = {
        version: 3,
        lines: [
          [{ id: 'user-model', type: 'model', color: 'cyan' }],
          [],
          [{ id: 'user-clock', type: 'clock' }]
        ]
      };
      fs.mkdirSync(paths.ccstatuslineDir, { recursive: true });
      fs.writeFileSync(paths.ccstatuslineSettings, JSON.stringify(userConfig, null, 2));
      captureOutput(() => install(paths));
      const config = JSON.parse(fs.readFileSync(paths.ccstatuslineSettings, 'utf8'));
      // User widget on line 0 preserved alongside bmad-line-0
      assert.ok(config.lines[0].some(w => w.id === 'user-model'), 'user widget on line 0 preserved');
      assert.ok(config.lines[0].some(w => w.id === 'bmad-line-0'), 'bmad-line-0 injected on line 0');
      // User widget on line 2 preserved
      assert.equal(config.lines[2][0].id, 'user-clock');
    } finally { teardown(baseDir); }
  });
});

// --- Target 7: ~/.config/bmad-statusline/config.json ---

describe('Target 7: internal config creation', () => {
  it('creates config.json with defaults on fresh install', () => {
    const { baseDir, paths } = setup();
    try {
      captureOutput(() => install(paths));
      const configPath = path.join(paths.readerDir, 'config.json');
      assert.ok(fs.existsSync(configPath), 'config.json should be created');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      assert.ok(Array.isArray(config.lines), 'should have lines array');
      assert.equal(config.lines.length, 3, 'should have 3 lines');
      assert.ok(Array.isArray(config.presets), 'should have presets array');
    } finally { teardown(baseDir); }
  });

  it('skips when config.json already exists (idempotent)', () => {
    const { baseDir, paths } = setup();
    try {
      fs.mkdirSync(paths.readerDir, { recursive: true });
      const existing = { custom: true };
      fs.writeFileSync(path.join(paths.readerDir, 'config.json'), JSON.stringify(existing));
      const output = captureOutput(() => install(paths));
      assert.ok(output.includes('already exists'), 'should log skipped');
      const config = JSON.parse(fs.readFileSync(path.join(paths.readerDir, 'config.json'), 'utf8'));
      assert.equal(config.custom, true, 'existing config should not be overwritten');
    } finally { teardown(baseDir); }
  });

  it('logs success with created default configuration message', () => {
    const { baseDir, paths } = setup();
    try {
      const output = captureOutput(() => install(paths));
      assert.ok(output.includes('created default configuration'), 'should log success message');
    } finally { teardown(baseDir); }
  });
});

// --- Target 3: bmad-sl-reader.js ---

describe('Target 3: reader deployment', () => {
  it('copies reader when absent', () => {
    const { baseDir, paths } = setup();
    try {
      const output = captureOutput(() => install(paths));
      assert.ok(fs.existsSync(paths.readerDest), 'reader should be copied');
      assert.ok(output.includes('installed'));
    } finally { teardown(baseDir); }
  });

  it('overwrites when present and logs updated', () => {
    const { baseDir, paths } = setup();
    try {
      // Pre-create reader with dummy content
      fs.mkdirSync(paths.readerDir, { recursive: true });
      fs.writeFileSync(paths.readerDest, '// old version');
      const output = captureOutput(() => install(paths));
      const content = fs.readFileSync(paths.readerDest, 'utf8');
      assert.ok(!content.includes('old version'), 'should be overwritten');
      assert.ok(content.includes('use strict'), 'should contain real reader');
      assert.ok(output.includes('updated'));
    } finally { teardown(baseDir); }
  });
});

// --- Target 4: ~/.cache/bmad-status/ ---

describe('Target 4: cache directory', () => {
  it('creates cache dir when absent', () => {
    const { baseDir, paths } = setup();
    try {
      const output = captureOutput(() => install(paths));
      assert.ok(fs.existsSync(paths.cacheDir), 'cache dir should be created');
      assert.ok(output.includes('created'));
    } finally { teardown(baseDir); }
  });

  it('skips when present', () => {
    const { baseDir, paths } = setup();
    try {
      fs.mkdirSync(paths.cacheDir, { recursive: true });
      const output = captureOutput(() => install(paths));
      assert.ok(output.includes('\u25CB'), 'should contain skipped marker');
      assert.ok(output.includes('already exists'));
    } finally { teardown(baseDir); }
  });
});

// --- Target 5: ~/.claude/settings.json hooks ---

describe('Target 5: hook config injection', () => {
  it('injects 15 matchers across 12 event types when hooks absent (Rev.5)', () => {
    const { baseDir, paths } = setup();
    try {
      copyFixture('claude-settings-empty.json', paths.claudeSettings);
      captureOutput(() => install(paths));
      const config = JSON.parse(fs.readFileSync(paths.claudeSettings, 'utf8'));
      assert.ok(config.hooks, 'hooks key should exist');
      // 12 event types
      const eventTypes = Object.keys(config.hooks);
      assert.equal(eventTypes.length, 12, 'should have 12 event types');
      // UserPromptSubmit — regex
      assert.equal(config.hooks.UserPromptSubmit.length, 1);
      assert.equal(config.hooks.UserPromptSubmit[0].matcher, '(?:bmad|gds|wds)[:-]');
      // PreToolUse — single wildcard
      assert.equal(config.hooks.PreToolUse.length, 1, 'PreToolUse: 1 wildcard matcher');
      assert.equal(config.hooks.PreToolUse[0].matcher, '');
      // PostToolUse — 4 tool-specific
      assert.equal(config.hooks.PostToolUse.length, 4);
      assert.deepEqual(config.hooks.PostToolUse.map(e => e.matcher), ['Read', 'Write', 'Edit', 'Bash']);
      // 7 new event types — wildcard
      for (const evt of ['PermissionRequest', 'PermissionDenied', 'PostToolUseFailure', 'StopFailure', 'SubagentStart', 'SubagentStop', 'SessionEnd']) {
        assert.ok(Array.isArray(config.hooks[evt]), `${evt} should be array`);
        assert.equal(config.hooks[evt].length, 1, `${evt}: 1 matcher`);
        assert.equal(config.hooks[evt][0].matcher, '', `${evt} should have wildcard matcher`);
      }
      // Existing event types
      assert.equal(config.hooks.Stop.length, 1);
      assert.equal(config.hooks.Stop[0].matcher, '');
      assert.equal(config.hooks.SessionStart.length, 1);
      assert.equal(config.hooks.SessionStart[0].matcher, 'resume');
      // All commands reference bmad-hook.js
      for (const event of eventTypes) {
        for (const entry of config.hooks[event]) {
          assert.ok(entry.hooks[0].command.includes('bmad-hook.js'), `${event} command should reference bmad-hook.js`);
        }
      }
      // Total: 15 matchers
      const total = Object.values(config.hooks).reduce((sum, arr) => sum + arr.length, 0);
      assert.equal(total, 15, 'total matchers should be 15');
    } finally { teardown(baseDir); }
  });

  it('upgrades Phase 3 hooks (5 matchers) to Rev.5 (adds new event types)', () => {
    const { baseDir, paths } = setup();
    try {
      copyFixture('claude-settings-with-hooks.json', paths.claudeSettings);
      const output = captureOutput(() => install(paths));
      assert.ok(output.includes('hook config injected'), 'should log injected for upgrade');
      const config = JSON.parse(fs.readFileSync(paths.claudeSettings, 'utf8'));
      // PreToolUse: wildcard added alongside existing specific matchers
      assert.ok(config.hooks.PreToolUse.length >= 1, 'PreToolUse has matchers');
      assert.ok(config.hooks.PreToolUse.some(e => e.matcher === ''), 'PreToolUse wildcard added');
      // PostToolUse upgraded
      assert.equal(config.hooks.PostToolUse.length, 4, 'PostToolUse upgraded to 4 matchers');
      assert.equal(config.hooks.UserPromptSubmit.length, 1);
      assert.equal(config.hooks.Stop.length, 1, 'Stop added');
      assert.equal(config.hooks.SessionStart.length, 1);
      // 7 new Rev.5 event types
      for (const evt of ['PermissionRequest', 'PermissionDenied', 'PostToolUseFailure', 'StopFailure', 'SubagentStart', 'SubagentStop', 'SessionEnd']) {
        assert.ok(Array.isArray(config.hooks[evt]), `${evt} should be added`);
        assert.equal(config.hooks[evt].length, 1, `${evt}: 1 matcher`);
      }
    } finally { teardown(baseDir); }
  });

  it('preserves existing non-bmad Write hook alongside bmad Write/Edit matchers', () => {
    const { baseDir, paths } = setup();
    try {
      const existing = {
        statusLine: { type: 'command', command: 'npx -y ccstatusline@latest', padding: 0 },
        hooks: {
          PostToolUse: [
            { matcher: 'Write', hooks: [{ type: 'command', command: 'node other-tool.js' }] }
          ]
        }
      };
      fs.mkdirSync(paths.claudeDir, { recursive: true });
      fs.writeFileSync(paths.claudeSettings, JSON.stringify(existing, null, 2) + '\n');
      captureOutput(() => install(paths));
      const config = JSON.parse(fs.readFileSync(paths.claudeSettings, 'utf8'));
      // 1 existing non-bmad + 4 bmad (Read, Write, Edit, Bash)
      assert.equal(config.hooks.PostToolUse.length, 5, 'should have 5 entries (1 non-bmad + 4 bmad)');
      assert.equal(config.hooks.PostToolUse[0].matcher, 'Write', 'existing non-bmad hook preserved at index 0');
      assert.ok(config.hooks.PostToolUse[0].hooks[0].command.includes('other-tool.js'), 'non-bmad command preserved');
      // UserPromptSubmit and SessionStart created
      assert.equal(config.hooks.UserPromptSubmit.length, 1);
      assert.equal(config.hooks.SessionStart.length, 1);
      // Rev.5 event types also created
      for (const evt of ['PermissionRequest', 'PermissionDenied', 'PostToolUseFailure', 'StopFailure', 'SubagentStart', 'SubagentStop', 'SessionEnd']) {
        assert.ok(Array.isArray(config.hooks[evt]), `${evt} should be created`);
      }
    } finally { teardown(baseDir); }
  });

  it('creates hooks structure when only statusLine exists', () => {
    const { baseDir, paths } = setup();
    try {
      const existing = {
        statusLine: { type: 'command', command: 'npx -y ccstatusline@latest', padding: 0 }
      };
      fs.mkdirSync(paths.claudeDir, { recursive: true });
      fs.writeFileSync(paths.claudeSettings, JSON.stringify(existing, null, 2) + '\n');
      captureOutput(() => install(paths));
      const config = JSON.parse(fs.readFileSync(paths.claudeSettings, 'utf8'));
      assert.ok(config.statusLine, 'statusLine preserved');
      assert.ok(config.hooks, 'hooks key created');
      assert.equal(config.hooks.UserPromptSubmit.length, 1, '1 UserPromptSubmit matcher');
      assert.equal(config.hooks.PreToolUse.length, 1, '1 PreToolUse wildcard matcher');
      assert.equal(config.hooks.PostToolUse.length, 4, '4 PostToolUse matchers');
      assert.equal(config.hooks.Stop.length, 1, '1 Stop matcher');
      assert.equal(config.hooks.SessionStart.length, 1, '1 SessionStart matcher');
      // Rev.5 event types
      const total = Object.values(config.hooks).reduce((sum, arr) => sum + arr.length, 0);
      assert.equal(total, 15, '15 total matchers');
    } finally { teardown(baseDir); }
  });

  it('upgrades from Phase 2: removes Skill, keeps Read, adds all Rev.5 matchers', () => {
    const { baseDir, paths } = setup();
    try {
      copyFixture('claude-settings-with-hooks-phase2.json', paths.claudeSettings);
      captureOutput(() => install(paths));
      const config = JSON.parse(fs.readFileSync(paths.claudeSettings, 'utf8'));
      // Skill matcher removed, Read kept, Write+Edit added
      const ptuMatchers = config.hooks.PostToolUse.map(e => e.matcher);
      assert.ok(!ptuMatchers.includes('Skill'), 'Skill matcher should be removed');
      assert.ok(ptuMatchers.includes('Read'), 'Read matcher should be kept');
      assert.ok(ptuMatchers.includes('Write'), 'Write matcher should be added');
      assert.ok(ptuMatchers.includes('Edit'), 'Edit matcher should be added');
      assert.ok(ptuMatchers.includes('Bash'), 'Bash matcher should be added');
      assert.equal(config.hooks.PostToolUse.length, 4, 'should have 4 PostToolUse matchers');
      // UserPromptSubmit, Stop, SessionStart added
      assert.equal(config.hooks.UserPromptSubmit.length, 1);
      assert.equal(config.hooks.UserPromptSubmit[0].matcher, '(?:bmad|gds|wds)[:-]');
      assert.equal(config.hooks.Stop.length, 1, 'Stop matcher added');
      assert.equal(config.hooks.SessionStart.length, 1);
      assert.equal(config.hooks.SessionStart[0].matcher, 'resume');
      // PreToolUse wildcard added
      assert.ok(config.hooks.PreToolUse.some(e => e.matcher === ''), 'PreToolUse wildcard added');
      // Rev.5 event types
      for (const evt of ['PermissionRequest', 'PermissionDenied', 'PostToolUseFailure', 'StopFailure', 'SubagentStart', 'SubagentStop', 'SessionEnd']) {
        assert.ok(Array.isArray(config.hooks[evt]), `${evt} should be added`);
        assert.equal(config.hooks[evt].length, 1, `${evt}: 1 matcher`);
      }
    } finally { teardown(baseDir); }
  });

  it('partial install: adds only missing event types', () => {
    const { baseDir, paths } = setup();
    try {
      // PostToolUse complete, but no UserPromptSubmit or SessionStart
      const partial = {
        hooks: {
          PostToolUse: [
            { matcher: 'Read', hooks: [{ type: 'command', command: `node "${paths.hookDest}"` }] },
            { matcher: 'Write', hooks: [{ type: 'command', command: `node "${paths.hookDest}"` }] },
            { matcher: 'Edit', hooks: [{ type: 'command', command: `node "${paths.hookDest}"` }] }
          ]
        }
      };
      fs.mkdirSync(paths.claudeDir, { recursive: true });
      fs.writeFileSync(paths.claudeSettings, JSON.stringify(partial, null, 2) + '\n');
      const output = captureOutput(() => install(paths));
      assert.ok(output.includes('hook config injected'), 'should inject missing event types');
      const config = JSON.parse(fs.readFileSync(paths.claudeSettings, 'utf8'));
      assert.equal(config.hooks.PostToolUse.length, 4, 'PostToolUse: Bash added');
      assert.equal(config.hooks.UserPromptSubmit.length, 1, 'UserPromptSubmit added');
      assert.equal(config.hooks.PreToolUse.length, 1, 'PreToolUse wildcard added');
      assert.equal(config.hooks.Stop.length, 1, 'Stop added');
      assert.equal(config.hooks.SessionStart.length, 1, 'SessionStart added');
      // Rev.5 event types
      for (const evt of ['PermissionRequest', 'PermissionDenied', 'PostToolUseFailure', 'StopFailure', 'SubagentStart', 'SubagentStop', 'SessionEnd']) {
        assert.ok(Array.isArray(config.hooks[evt]), `${evt} should be added`);
      }
    } finally { teardown(baseDir); }
  });

  it('Phase 3→Rev.5 upgrade adds PreToolUse wildcard, 7 new event types', () => {
    const { baseDir, paths } = setup();
    try {
      copyFixture('claude-settings-with-hooks.json', paths.claudeSettings);
      captureOutput(() => install(paths));
      const config = JSON.parse(fs.readFileSync(paths.claudeSettings, 'utf8'));
      // PreToolUse: wildcard added
      assert.ok(Array.isArray(config.hooks.PreToolUse), 'PreToolUse should be array');
      assert.ok(config.hooks.PreToolUse.some(e => e.matcher === ''), 'PreToolUse wildcard added');
      // PostToolUse: Read/Write/Edit preserved + Bash added
      assert.equal(config.hooks.PostToolUse.length, 4, 'PostToolUse should have 4 matchers');
      assert.deepEqual(config.hooks.PostToolUse.map(e => e.matcher), ['Read', 'Write', 'Edit', 'Bash']);
      // Stop: new event type
      assert.ok(Array.isArray(config.hooks.Stop), 'Stop should be array');
      assert.equal(config.hooks.Stop.length, 1);
      assert.equal(config.hooks.Stop[0].matcher, '');
      // UserPromptSubmit and SessionStart unchanged
      assert.equal(config.hooks.UserPromptSubmit.length, 1, 'UserPromptSubmit unchanged');
      assert.equal(config.hooks.SessionStart.length, 1, 'SessionStart unchanged');
      // 7 new Rev.5 event types
      for (const evt of ['PermissionRequest', 'PermissionDenied', 'PostToolUseFailure', 'StopFailure', 'SubagentStart', 'SubagentStop', 'SessionEnd']) {
        assert.ok(Array.isArray(config.hooks[evt]), `${evt} should be added`);
        assert.equal(config.hooks[evt].length, 1, `${evt}: 1 matcher`);
        assert.equal(config.hooks[evt][0].matcher, '', `${evt} should have wildcard matcher`);
      }
      // Total: 15 matchers after upgrade
      const total = Object.values(config.hooks).reduce((sum, arr) => sum + arr.length, 0);
      assert.equal(total, 15, '15 total matchers after Phase 3 upgrade');
    } finally { teardown(baseDir); }
  });

  it('Rev.4→Rev.5 upgrade adds 7 new event types, preserves existing matchers', () => {
    const { baseDir, paths } = setup();
    try {
      copyFixture('claude-settings-with-hooks-phase4.json', paths.claudeSettings);
      const output = captureOutput(() => install(paths));
      assert.ok(output.includes('hook config injected'), 'should log injected for upgrade');
      const config = JSON.parse(fs.readFileSync(paths.claudeSettings, 'utf8'));
      // Existing Rev.4 matchers preserved
      assert.equal(config.hooks.UserPromptSubmit.length, 1, 'UserPromptSubmit preserved');
      assert.equal(config.hooks.UserPromptSubmit[0].matcher, '(?:bmad|gds|wds)[:-]', 'UserPromptSubmit matcher preserved');
      // PreToolUse: existing 4 specific + 1 new wildcard = 5
      assert.equal(config.hooks.PreToolUse.length, 5, 'PreToolUse: 4 existing + 1 wildcard');
      assert.ok(config.hooks.PreToolUse.some(e => e.matcher === ''), 'PreToolUse wildcard added');
      assert.ok(config.hooks.PreToolUse.some(e => e.matcher === 'Read'), 'PreToolUse Read preserved');
      // PostToolUse unchanged
      assert.equal(config.hooks.PostToolUse.length, 4, 'PostToolUse still 4');
      assert.equal(config.hooks.Stop.length, 1, 'Stop preserved');
      assert.equal(config.hooks.Notification.length, 1, 'Notification preserved');
      assert.equal(config.hooks.SessionStart.length, 1, 'SessionStart preserved');
      // 7 new Rev.5 event types added
      for (const evt of ['PermissionRequest', 'PermissionDenied', 'PostToolUseFailure', 'StopFailure', 'SubagentStart', 'SubagentStop', 'SessionEnd']) {
        assert.ok(Array.isArray(config.hooks[evt]), `${evt} should be added`);
        assert.equal(config.hooks[evt].length, 1, `${evt}: 1 matcher`);
        assert.equal(config.hooks[evt][0].matcher, '', `${evt} wildcard matcher`);
      }
    } finally { teardown(baseDir); }
  });

  it('Rev.5 idempotent — no changes when all 15 matchers present', () => {
    const { baseDir, paths } = setup();
    try {
      copyFixture('claude-settings-with-hooks-phase5.json', paths.claudeSettings);
      const output = captureOutput(() => install(paths));
      assert.ok(output.includes('hook config already present'), 'should log skipped');
      const config = JSON.parse(fs.readFileSync(paths.claudeSettings, 'utf8'));
      // All counts unchanged
      assert.equal(config.hooks.UserPromptSubmit.length, 1, 'UserPromptSubmit still 1');
      assert.equal(config.hooks.PreToolUse.length, 1, 'PreToolUse still 1');
      assert.equal(config.hooks.PostToolUse.length, 4, 'PostToolUse still 4');
      assert.equal(config.hooks.Stop.length, 1, 'Stop still 1');
      assert.equal(config.hooks.SessionStart.length, 1, 'SessionStart still 1');
      for (const evt of ['PermissionRequest', 'PermissionDenied', 'PostToolUseFailure', 'StopFailure', 'SubagentStart', 'SubagentStop', 'SessionEnd']) {
        assert.equal(config.hooks[evt].length, 1, `${evt} still 1`);
      }
      const total = Object.values(config.hooks).reduce((sum, arr) => sum + arr.length, 0);
      assert.equal(total, 15, 'total still 15');
    } finally { teardown(baseDir); }
  });
});

// --- Target 6: ~/.config/bmad-statusline/bmad-hook.js ---

describe('Target 6: hook script deployment', () => {
  it('copies hook script when absent', () => {
    const { baseDir, paths } = setup();
    try {
      const output = captureOutput(() => install(paths));
      assert.ok(fs.existsSync(paths.hookDest), 'hook script should be copied');
      assert.ok(output.includes('installed'), 'should log installed for hook');
    } finally { teardown(baseDir); }
  });

  it('overwrites when present and logs updated', () => {
    const { baseDir, paths } = setup();
    try {
      // Pre-create hook with dummy content
      fs.mkdirSync(paths.readerDir, { recursive: true });
      fs.writeFileSync(paths.hookDest, '// old hook version');
      const output = captureOutput(() => install(paths));
      const content = fs.readFileSync(paths.hookDest, 'utf8');
      assert.ok(!content.includes('old hook version'), 'should be overwritten');
      assert.ok(output.includes('updated'), 'should log updated for hook');
    } finally { teardown(baseDir); }
  });
});

// --- Idempotency ---

describe('idempotency', () => {
  it('no duplication when install runs 3 times', () => {
    const { baseDir, paths } = setup();
    try {
      captureOutput(() => install(paths));
      captureOutput(() => install(paths));
      captureOutput(() => install(paths));

      // Claude settings: statusLine not duplicated
      const claudeConfig = JSON.parse(fs.readFileSync(paths.claudeSettings, 'utf8'));
      assert.ok(claudeConfig.statusLine);

      // ccstatusline: no widget duplication
      const ccConfig = JSON.parse(fs.readFileSync(paths.ccstatuslineSettings, 'utf8'));
      const allBmad = ccConfig.lines.flat().filter(w => w.id && w.id.startsWith('bmad-'));
      // Compare with a fresh single-run to get expected count
      const { baseDir: bd2, paths: p2 } = setup();
      try {
        captureOutput(() => install(p2));
        const ref = JSON.parse(fs.readFileSync(p2.ccstatuslineSettings, 'utf8'));
        const refBmad = ref.lines.flat().filter(w => w.id && w.id.startsWith('bmad-'));
        assert.equal(allBmad.length, refBmad.length, 'BMAD widget count should not grow');
      } finally { teardown(bd2); }

      // Hook matchers: no duplication after 3 runs — 15 matchers across 12 event types
      assert.equal(claudeConfig.hooks.UserPromptSubmit.length, 1, 'UserPromptSubmit: 1 matcher after 3 runs');
      assert.equal(claudeConfig.hooks.PreToolUse.length, 1, 'PreToolUse: 1 matcher after 3 runs');
      assert.equal(claudeConfig.hooks.PostToolUse.length, 4, 'PostToolUse: 4 matchers after 3 runs');
      assert.equal(claudeConfig.hooks.Stop.length, 1, 'Stop: 1 matcher after 3 runs');
      assert.equal(claudeConfig.hooks.SessionStart.length, 1, 'SessionStart: 1 matcher after 3 runs');
      // Rev.5 event types: no duplication
      for (const evt of ['PermissionRequest', 'PermissionDenied', 'PostToolUseFailure', 'StopFailure', 'SubagentStart', 'SubagentStop', 'SessionEnd']) {
        assert.equal(claudeConfig.hooks[evt].length, 1, `${evt}: 1 matcher after 3 runs`);
      }
      const total = Object.values(claudeConfig.hooks).reduce((sum, arr) => sum + arr.length, 0);
      assert.equal(total, 15, '15 total matchers after 3 runs');
    } finally { teardown(baseDir); }
  });
});

// --- Backup creation ---

describe('backup creation', () => {
  it('creates .bak files for existing JSON targets', () => {
    const { baseDir, paths } = setup();
    try {
      copyFixture('claude-settings-empty.json', paths.claudeSettings);
      copyFixture('ccstatusline-settings-empty.json', paths.ccstatuslineSettings);
      captureOutput(() => install(paths));
      assert.ok(fs.existsSync(paths.claudeSettings + '.bak'), 'claude settings .bak exists');
      assert.ok(fs.existsSync(paths.ccstatuslineSettings + '.bak'), 'ccstatusline .bak exists');
    } finally { teardown(baseDir); }
  });
});

// --- Post-write validation ---

describe('post-write validation', () => {
  it('all written JSON files parse without error', () => {
    const { baseDir, paths } = setup();
    try {
      captureOutput(() => install(paths));
      // Verify all JSON files are valid
      const claudeConfig = JSON.parse(fs.readFileSync(paths.claudeSettings, 'utf8'));
      assert.ok(claudeConfig.statusLine);
      const ccConfig = JSON.parse(fs.readFileSync(paths.ccstatuslineSettings, 'utf8'));
      assert.equal(ccConfig.version, 3);
      assert.ok(Array.isArray(ccConfig.lines));
    } finally { teardown(baseDir); }
  });
});
