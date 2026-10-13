// current-item-migration.test.js — resolveCurrentItem + migrateLegacyWidgets (Story + Document → Current Item)
// S = bmad-story, D = bmad-docname, N = bmad-currentitem

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import * as defaults from '../src/defaults.js';
import { createDefaultConfig } from '../src/tui/widget-registry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _require = createRequire(import.meta.url);
const shared = _require(path.resolve(__dirname, '..', 'src', 'reader', 'shared-constants.cjs'));
const { resolveCurrentItem, migrateLegacyWidgets } = shared;

const LEGACY_FIXTURE = path.join(__dirname, 'fixtures', 'internal-config-legacy-story-docname.json');
const CURRENT_FIXTURE = path.join(__dirname, 'fixtures', 'internal-config-default.json');

function line(widgets, colorModes = {}, widgetOrder) {
  const l = { widgets, colorModes };
  if (widgetOrder) l.widgetOrder = widgetOrder;
  return l;
}

function configWith(line0, extra = {}) {
  return { separator: 'modere', lines: [line0, line([]), line([])], presets: [null, null, null], ...extra };
}

describe('shared bridge', () => {
  it('defaults.js re-exports the Current Item pieces from shared-constants.cjs', () => {
    assert.equal(defaults.CURRENT_ITEM_WIDGET, 'bmad-currentitem');
    assert.equal(defaults.DEFAULT_STORY_COLOR, 'magenta');
    assert.equal(defaults.DEFAULT_DOCUMENT_COLOR, 'brightYellow');
    assert.equal(defaults.resolveCurrentItem, shared.resolveCurrentItem);
    assert.equal(defaults.migrateLegacyWidgets, shared.migrateLegacyWidgets);
  });
});

describe('resolveCurrentItem', () => {
  it('story workflow with a story → story', () => {
    for (const workflow of ['create-story', 'dev-story', 'code-review']) {
      assert.deepStrictEqual(resolveCurrentItem({ workflow, story: '4-2-auth-login' }), { kind: 'story', value: '4-2-auth-login' });
    }
  });

  it('story workflow without a story → null, even with a stale document_name', () => {
    assert.equal(resolveCurrentItem({ workflow: 'dev-story', story: null, document_name: 'prd.md' }), null);
    assert.equal(resolveCurrentItem({ workflow: 'dev-story', document_name: 'prd.md' }), null);
  });

  it('other workflow with a document → document, a stale story is ignored', () => {
    assert.deepStrictEqual(resolveCurrentItem({ workflow: 'create-prd', document_name: 'prd.md', story: '4-2-x' }), { kind: 'document', value: 'prd.md' });
  });

  it('job mode (no workflow) → document kind with the job id', () => {
    assert.deepStrictEqual(resolveCurrentItem({ workflow: null, active_skill: 'autoblend-builder', document_name: 'zouzou' }), { kind: 'document', value: 'zouzou' });
  });

  it('empty or missing document_name → null', () => {
    assert.equal(resolveCurrentItem({ workflow: 'create-prd', document_name: '' }), null);
    assert.equal(resolveCurrentItem({ workflow: 'create-prd' }), null);
    assert.equal(resolveCurrentItem({}), null);
  });

  it('non-object status → null', () => {
    assert.equal(resolveCurrentItem(null), null);
    assert.equal(resolveCurrentItem(undefined), null);
    assert.equal(resolveCurrentItem('dev-story'), null);
  });
});

describe('migrateLegacyWidgets — lines', () => {
  it('both visible: one widget at the first slot, both colors and the story mode kept', () => {
    const cfg = configWith(line(
      ['a', 'bmad-story', 'bmad-docname', 'b'],
      {
        'bmad-story': { mode: 'fixed', fixedColor: 'red', displayMode: 'compact' },
        'bmad-docname': { mode: 'fixed', fixedColor: 'blue' },
        a: { mode: 'dynamic' },
      },
    ));
    assert.equal(migrateLegacyWidgets(cfg), true);
    assert.deepStrictEqual(cfg.lines[0].widgets, ['a', 'bmad-currentitem', 'b']);
    assert.deepStrictEqual(cfg.lines[0].colorModes, {
      a: { mode: 'dynamic' },
      'bmad-currentitem': { mode: 'fixed', fixedColor: 'red', documentColor: 'blue', displayMode: 'compact' },
    });
  });

  it('only Story visible: the document color falls back to its default', () => {
    const cfg = configWith(line(['bmad-story', 'b'], { 'bmad-story': { mode: 'fixed', fixedColor: 'red' } }));
    migrateLegacyWidgets(cfg);
    assert.deepStrictEqual(cfg.lines[0].widgets, ['bmad-currentitem', 'b']);
    assert.deepStrictEqual(cfg.lines[0].colorModes['bmad-currentitem'], { mode: 'fixed', fixedColor: 'red', documentColor: 'brightYellow' });
  });

  it('only Document visible: the story color falls back to its default, no displayMode invented', () => {
    const cfg = configWith(line(['a', 'bmad-docname'], { 'bmad-docname': { mode: 'fixed', fixedColor: 'blue' } }));
    migrateLegacyWidgets(cfg);
    assert.deepStrictEqual(cfg.lines[0].widgets, ['a', 'bmad-currentitem']);
    assert.deepStrictEqual(cfg.lines[0].colorModes['bmad-currentitem'], { mode: 'fixed', fixedColor: 'magenta', documentColor: 'blue' });
  });

  it('only one visible: the hidden widget saved colorMode wins over the default', () => {
    const cfg = configWith(line(['bmad-story'], {
      'bmad-story': { mode: 'fixed', fixedColor: 'red' },
      'bmad-docname': { mode: 'fixed', fixedColor: 'cyan' },
    }));
    migrateLegacyWidgets(cfg);
    assert.deepStrictEqual(cfg.lines[0].colorModes['bmad-currentitem'], { mode: 'fixed', fixedColor: 'red', documentColor: 'cyan' });
  });

  it('neither visible: hidden, colors carried over, old keys gone', () => {
    const cfg = configWith(line(['a'], {
      'bmad-story': { mode: 'fixed', fixedColor: 'green', displayMode: 'compact' },
      'bmad-docname': { mode: 'fixed', fixedColor: 'yellow' },
    }, ['a', 'bmad-story', 'bmad-docname']));
    migrateLegacyWidgets(cfg);
    assert.deepStrictEqual(cfg.lines[0].widgets, ['a']);
    assert.deepStrictEqual(cfg.lines[0].widgetOrder, ['a', 'bmad-currentitem']);
    assert.deepStrictEqual(cfg.lines[0].colorModes, {
      'bmad-currentitem': { mode: 'fixed', fixedColor: 'green', documentColor: 'yellow', displayMode: 'compact' },
    });
  });

  it('order: the first of the two takes the slot', () => {
    const cfg = configWith(line([], {}, ['bmad-docname', 'x', 'bmad-story']));
    migrateLegacyWidgets(cfg);
    assert.deepStrictEqual(cfg.lines[0].widgetOrder, ['bmad-currentitem', 'x']);

    const cfg2 = configWith(line([], {}, ['x', 'bmad-story', 'y', 'bmad-docname', 'z']));
    migrateLegacyWidgets(cfg2);
    assert.deepStrictEqual(cfg2.lines[0].widgetOrder, ['x', 'bmad-currentitem', 'y', 'z']);
  });

  it('widgets keeps its display order: D then S lands at the first one', () => {
    const cfg = configWith(line(['bmad-docname', 'x', 'bmad-story']));
    migrateLegacyWidgets(cfg);
    assert.deepStrictEqual(cfg.lines[0].widgets, ['bmad-currentitem', 'x']);
  });

  it('a widget with no colorMode on the line gets none invented', () => {
    const cfg = configWith(line(['bmad-story', 'bmad-docname'], {}));
    assert.equal(migrateLegacyWidgets(cfg), true);
    assert.deepStrictEqual(cfg.lines[0].widgets, ['bmad-currentitem']);
    assert.deepStrictEqual(cfg.lines[0].colorModes, {});
  });

  it('each line is converted on its own (Story on one line, Document on another)', () => {
    const cfg = {
      lines: [
        line(['bmad-story'], { 'bmad-story': { mode: 'fixed', fixedColor: 'red' } }),
        line(['bmad-docname'], { 'bmad-docname': { mode: 'fixed', fixedColor: 'blue' } }),
        line([]),
      ],
      presets: [null, null, null],
    };
    migrateLegacyWidgets(cfg);
    assert.deepStrictEqual(cfg.lines[0].widgets, ['bmad-currentitem']);
    assert.deepStrictEqual(cfg.lines[1].widgets, ['bmad-currentitem']);
    assert.deepStrictEqual(cfg.lines[0].colorModes['bmad-currentitem'], { mode: 'fixed', fixedColor: 'red', documentColor: 'brightYellow' });
    assert.deepStrictEqual(cfg.lines[1].colorModes['bmad-currentitem'], { mode: 'fixed', fixedColor: 'magenta', documentColor: 'blue' });
  });

  it('a dynamic or colorless legacy colorMode falls back to the default color', () => {
    const cfg = configWith(line(['bmad-story', 'bmad-docname'], {
      'bmad-story': { mode: 'dynamic' },
      'bmad-docname': { mode: 'fixed' },
    }));
    migrateLegacyWidgets(cfg);
    assert.deepStrictEqual(cfg.lines[0].colorModes['bmad-currentitem'], { mode: 'fixed', fixedColor: 'magenta', documentColor: 'brightYellow' });
  });

  it('other widgets and their colorModes are untouched', () => {
    const cfg = configWith(line(['p', 'bmad-story', 't'], {
      p: { mode: 'dynamic' },
      t: { mode: 'fixed', fixedColor: 'brightBlack' },
      'bmad-story': { mode: 'fixed', fixedColor: 'red' },
    }, ['p', 'bmad-story', 'bmad-docname', 't']));
    cfg.skillColors = { 'dev-story': 'red' };
    cfg.projectColors = { alpha: 'blue' };
    migrateLegacyWidgets(cfg);
    assert.deepStrictEqual(cfg.lines[0].colorModes.p, { mode: 'dynamic' });
    assert.deepStrictEqual(cfg.lines[0].colorModes.t, { mode: 'fixed', fixedColor: 'brightBlack' });
    assert.deepStrictEqual(cfg.lines[0].widgetOrder, ['p', 'bmad-currentitem', 't']);
    assert.deepStrictEqual(cfg.skillColors, { 'dev-story': 'red' });
    assert.deepStrictEqual(cfg.projectColors, { alpha: 'blue' });
    assert.equal(cfg.separator, 'modere');
  });
});

describe('migrateLegacyWidgets — presets', () => {
  it('a preset line follows the same replacement rule (widgets and widgetOrder)', () => {
    const cfg = configWith(line([]), {
      presets: [{
        name: 'p1',
        lines: [
          { widgets: ['a', 'bmad-story', 'bmad-docname'], widgetOrder: ['bmad-docname', 'a', 'bmad-story'] },
          { widgets: ['bmad-docname'], widgetOrder: ['bmad-story', 'x', 'bmad-docname'] },
          { widgets: [], widgetOrder: ['x'] },
        ],
        separator: 'serre',
        customSeparator: null,
      }, null, null],
    });
    assert.equal(migrateLegacyWidgets(cfg), true);
    const p = cfg.presets[0];
    assert.deepStrictEqual(p.lines[0], { widgets: ['a', 'bmad-currentitem'], widgetOrder: ['bmad-currentitem', 'a'] });
    assert.deepStrictEqual(p.lines[1], { widgets: ['bmad-currentitem'], widgetOrder: ['bmad-currentitem', 'x'] });
    assert.deepStrictEqual(p.lines[2], { widgets: [], widgetOrder: ['x'] });
    assert.equal(p.name, 'p1');
    assert.equal(p.separator, 'serre');
  });

  it('only presets mention the old ids: still reported as changed', () => {
    const cfg = configWith(line(['a']), {
      presets: [null, { name: 'x', lines: [{ widgets: ['bmad-story'], widgetOrder: ['bmad-story'] }] }, null],
    });
    assert.equal(migrateLegacyWidgets(cfg), true);
    assert.deepStrictEqual(cfg.presets[1].lines[0].widgets, ['bmad-currentitem']);
  });

  it('null slot, v1-shaped preset and garbage are skipped without throwing', () => {
    const v1Preset = { name: 'dev-focus', widgets: ['bmad-story'], colorModes: { 'bmad-story': { mode: 'fixed', fixedColor: 'red' } } };
    const cfg = configWith(line([]), {
      presets: [null, v1Preset, { name: 'bad', lines: 'nope' }, { name: 'bad2', lines: [null, 7, 'x', { widgets: 'nope', widgetOrder: null }] }, 42, 'str'],
    });
    assert.doesNotThrow(() => migrateLegacyWidgets(cfg));
    assert.equal(migrateLegacyWidgets(cfg), false);
    assert.deepStrictEqual(cfg.presets[1], v1Preset, 'untouched');
  });
});

describe('migrateLegacyWidgets — idempotence and no-ops', () => {
  it('a config already using Current Item is unchanged and reports no change', () => {
    const cfg = configWith(line(['a', 'bmad-currentitem'], {
      'bmad-currentitem': { mode: 'fixed', fixedColor: 'red', documentColor: 'blue' },
    }, ['a', 'bmad-currentitem']));
    const before = structuredClone(cfg);
    assert.equal(migrateLegacyWidgets(cfg), false);
    assert.deepStrictEqual(cfg, before);
  });

  it('converting twice changes nothing the second time', () => {
    const cfg = JSON.parse(fs.readFileSync(LEGACY_FIXTURE, 'utf8'));
    assert.equal(migrateLegacyWidgets(cfg), true);
    const afterFirst = structuredClone(cfg);
    assert.equal(migrateLegacyWidgets(cfg), false);
    assert.deepStrictEqual(cfg, afterFirst);
  });

  it('a mixed state keeps the existing Current Item colorMode and drops the leftovers', () => {
    const cfg = configWith(line(['bmad-currentitem', 'bmad-story'], {
      'bmad-currentitem': { mode: 'fixed', fixedColor: 'cyan', documentColor: 'green' },
      'bmad-story': { mode: 'fixed', fixedColor: 'red' },
    }));
    assert.equal(migrateLegacyWidgets(cfg), true);
    assert.deepStrictEqual(cfg.lines[0].widgets, ['bmad-currentitem']);
    assert.deepStrictEqual(cfg.lines[0].colorModes, { 'bmad-currentitem': { mode: 'fixed', fixedColor: 'cyan', documentColor: 'green' } });
  });

  it('the v1.8.0 default config converts to exactly the current default config', () => {
    const cfg = JSON.parse(fs.readFileSync(LEGACY_FIXTURE, 'utf8'));
    migrateLegacyWidgets(cfg);
    assert.deepStrictEqual(cfg, JSON.parse(fs.readFileSync(CURRENT_FIXTURE, 'utf8')));
    assert.deepStrictEqual(cfg, createDefaultConfig());
  });

  it('never throws on malformed input and reports no change', () => {
    for (const bad of [null, undefined, 0, 'x', [], {}, { lines: null }, { lines: 'x' }, { lines: [null, 3, 'x', []] },
      { lines: [{ widgets: 'bmad-story', widgetOrder: 7, colorModes: null }] },
      { lines: [{ widgets: null, colorModes: [] }] },
      { presets: 'x' }, { presets: {} }]) {
      assert.doesNotThrow(() => migrateLegacyWidgets(bad), JSON.stringify(bad));
      assert.equal(migrateLegacyWidgets(bad), false, JSON.stringify(bad));
    }
  });

  it('malformed pieces next to convertible ones: the convertible part still converts', () => {
    const cfg = {
      lines: [
        null,
        { widgets: ['bmad-story'], widgetOrder: 'oops', colorModes: { 'bmad-story': null, 'bmad-docname': 'blue' } },
        line([]),
      ],
    };
    assert.doesNotThrow(() => migrateLegacyWidgets(cfg));
    assert.deepStrictEqual(cfg.lines[1].widgets, ['bmad-currentitem']);
    assert.deepStrictEqual(cfg.lines[1].colorModes, { 'bmad-currentitem': { mode: 'fixed', fixedColor: 'magenta', documentColor: 'brightYellow' } });
  });
});
