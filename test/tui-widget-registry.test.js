import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  getIndividualWidgets,
  createDefaultConfig,
  ANSI_COLORS,
} from '../src/tui/widget-registry.js';
import { loadConfig } from '../src/tui/config-loader.js';

describe('widget-registry', () => {
  it('getIndividualWidgets returns all 13 individual widgets', () => {
    const widgets = getIndividualWidgets();
    assert.equal(widgets.length, 13);
    for (const w of widgets) {
      assert.ok(w.id.startsWith('bmad-'), `widget id ${w.id} should start with bmad-`);
      assert.ok(w.command, `widget ${w.id} should have a command`);
      assert.ok(w.name, `widget ${w.id} should have a name`);
      assert.equal(typeof w.defaultEnabled, 'boolean');
    }
  });

  it('getIndividualWidgets returns copies (not references)', () => {
    const a = getIndividualWidgets();
    const b = getIndividualWidgets();
    a[0].name = 'MUTATED';
    assert.notEqual(b[0].name, 'MUTATED');
  });

  it('ANSI_COLORS export exists and contains expected colors', () => {
    assert.ok(Array.isArray(ANSI_COLORS));
    assert.ok(ANSI_COLORS.length >= 15);
    assert.ok(ANSI_COLORS.includes('white'));
    assert.ok(ANSI_COLORS.includes('red'));
    assert.ok(ANSI_COLORS.includes('cyan'));
    assert.ok(ANSI_COLORS.includes('brightRed'));
    assert.ok(ANSI_COLORS.includes('brightWhite'));
    assert.ok(ANSI_COLORS.includes('brightBlack'));
  });

  it('each widget has defaultColor and defaultMode fields', () => {
    const widgets = getIndividualWidgets();
    for (const w of widgets) {
      assert.ok('defaultColor' in w, `widget ${w.id} should have defaultColor`);
      assert.ok('defaultMode' in w, `widget ${w.id} should have defaultMode`);
      assert.ok(w.defaultMode === 'fixed' || w.defaultMode === 'dynamic',
        `widget ${w.id} defaultMode should be fixed or dynamic`);
    }
  });

  it('widget defaultColor values match specification', () => {
    const widgets = getIndividualWidgets();
    const expected = {
      'bmad-llmstate': null,
      'bmad-project': null,
      'bmad-workflow': null,
      'bmad-activeskill': null,
      'bmad-story': 'magenta',
      'bmad-docname': 'brightYellow',
      'bmad-progressstep': 'brightCyan',
      'bmad-nextstep': 'yellow',
      'bmad-timer': 'brightBlack',
      'bmad-fileread': 'cyan',
      'bmad-contextpct': null,
      'bmad-filewrite': 'brightRed',
      'bmad-weeklyusage': null,
    };
    for (const w of widgets) {
      assert.equal(w.defaultColor, expected[w.id], `${w.id} defaultColor`);
    }
  });

  it('widget defaultMode values match specification', () => {
    const widgets = getIndividualWidgets();
    for (const w of widgets) {
      if (w.id === 'bmad-llmstate' || w.id === 'bmad-workflow' || w.id === 'bmad-project' || w.id === 'bmad-activeskill' || w.id === 'bmad-contextpct' || w.id === 'bmad-weeklyusage') {
        assert.equal(w.defaultMode, 'dynamic', `${w.id} is dynamic`);
      } else {
        assert.equal(w.defaultMode, 'fixed', `${w.id} is fixed`);
      }
    }
  });

  it('dynamic defaultMode widgets are llmstate, workflow, project, activeskill, contextpct and weeklyusage', () => {
    const widgets = getIndividualWidgets();
    const dynamicWidgets = widgets.filter(w => w.defaultMode === 'dynamic');
    assert.equal(dynamicWidgets.length, 6);
    const ids = dynamicWidgets.map(w => w.id).sort();
    assert.deepStrictEqual(ids, ['bmad-activeskill', 'bmad-contextpct', 'bmad-llmstate', 'bmad-project', 'bmad-weeklyusage', 'bmad-workflow']);
  });
});

describe('createDefaultConfig', () => {
  it('returns valid default config shape', () => {
    const config = createDefaultConfig();
    assert.equal(config.separator, 'modere');
    assert.equal(config.customSeparator, null);
    assert.ok(Array.isArray(config.lines));
    assert.equal(config.lines.length, 3);
    assert.ok(Array.isArray(config.presets));
    assert.equal(config.presets.length, 3);
    assert.deepStrictEqual(config.presets, [null, null, null]);
  });

  it('line 0 contains default-enabled widgets without llmstate', () => {
    const config = createDefaultConfig();
    const expectedWidgets = ['bmad-project', 'bmad-workflow', 'bmad-activeskill', 'bmad-story', 'bmad-progressstep', 'bmad-timer'];
    assert.deepStrictEqual(config.lines[0].widgets, expectedWidgets);
  });

  it('line 0 colorModes match widget defaults (no llmstate)', () => {
    const config = createDefaultConfig();
    const cm = config.lines[0].colorModes;
    assert.equal(cm['bmad-llmstate'], undefined);
    assert.deepStrictEqual(cm['bmad-project'], { mode: 'dynamic' });
    assert.deepStrictEqual(cm['bmad-workflow'], { mode: 'dynamic' });
    assert.deepStrictEqual(cm['bmad-progressstep'], { mode: 'fixed', fixedColor: 'brightCyan' });
    assert.deepStrictEqual(cm['bmad-story'], { mode: 'fixed', fixedColor: 'magenta' });
    assert.deepStrictEqual(cm['bmad-timer'], { mode: 'fixed', fixedColor: 'brightBlack' });
  });

  it('line 1 has llmstate, line 2 has contextpct by default', () => {
    const config = createDefaultConfig();
    assert.deepStrictEqual(config.lines[1].widgets, ['bmad-llmstate']);
    assert.deepStrictEqual(config.lines[2].widgets, ['bmad-contextpct']);
    assert.deepStrictEqual(config.lines[1].colorModes, { 'bmad-llmstate': { mode: 'dynamic' } });
    assert.deepStrictEqual(config.lines[2].colorModes, {
      'bmad-contextpct': { mode: 'dynamic', thresholdLow: 0, thresholdHigh: 100, displayMode: 'compact' },
    });
    assert.equal(config.lines[1].widgetOrder.length, 13);
    assert.equal(config.lines[2].widgetOrder.length, 13);
  });

  it('bmad-contextpct appears in registry before bmad-timer', () => {
    const widgets = getIndividualWidgets();
    const contextIdx = widgets.findIndex(w => w.id === 'bmad-contextpct');
    const timerIdx = widgets.findIndex(w => w.id === 'bmad-timer');
    assert.ok(contextIdx >= 0, 'contextpct exists in registry');
    assert.ok(contextIdx < timerIdx, 'contextpct should be before timer');
  });

  it('returns a new object on each call (not shared reference)', () => {
    const a = createDefaultConfig();
    const b = createDefaultConfig();
    a.separator = 'changed';
    assert.equal(b.separator, 'modere');
  });
});

describe('10.3 — bmad-weeklyusage registry + preview integration', () => {
  it('AC1: 13th INDIVIDUAL_WIDGETS entry has exact fields', () => {
    const widgets = getIndividualWidgets();
    assert.equal(widgets.length, 13);
    const w = widgets[12];
    assert.deepStrictEqual(w, {
      id: 'bmad-weeklyusage',
      command: 'weeklyusage',
      name: 'Weekly Usage',
      hint: 'Claude plan weekly consumption vs week elapsed (subscribers)',
      defaultEnabled: false,
      defaultColor: null,
      defaultMode: 'dynamic',
    });
  });

  it('AC2: bmad-weeklyusage is on no default line widgets but is in every widgetOrder', () => {
    const config = createDefaultConfig();
    for (const line of config.lines) {
      assert.ok(!line.widgets.includes('bmad-weeklyusage'), 'must not be a default widget on any line');
      assert.ok(line.widgetOrder.includes('bmad-weeklyusage'), 'must be selectable via widgetOrder');
      assert.equal(line.widgetOrder.length, 13);
    }
  });

  it('AC3: ensureWidgetOrder appends bmad-weeklyusage to a legacy config that omits it', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-tui-1003-'));
    try {
      // pre-10.3 registry order (12 ids, omitting bmad-weeklyusage)
      const legacyOrder = [
        'bmad-llmstate', 'bmad-project', 'bmad-workflow', 'bmad-activeskill', 'bmad-story',
        'bmad-docname', 'bmad-progressstep', 'bmad-nextstep', 'bmad-fileread', 'bmad-filewrite',
        'bmad-contextpct', 'bmad-timer',
      ];
      const legacy = {
        separator: 'modere',
        customSeparator: null,
        lines: [
          { widgets: ['bmad-project'], widgetOrder: [...legacyOrder], colorModes: { 'bmad-project': { mode: 'dynamic' } } },
          { widgets: ['bmad-llmstate'], widgetOrder: [...legacyOrder], colorModes: { 'bmad-llmstate': { mode: 'dynamic' } } },
          { widgets: ['bmad-contextpct'], widgetOrder: [...legacyOrder], colorModes: { 'bmad-contextpct': { mode: 'dynamic' } } },
        ],
        skillColors: {},
        projectColors: {},
        presets: [null, null, null],
      };
      const cfgPath = path.join(tmpDir, 'config.json');
      fs.writeFileSync(cfgPath, JSON.stringify(legacy));

      const loaded = loadConfig({ internalConfig: cfgPath });

      for (const line of loaded.lines) {
        assert.ok(line.widgetOrder.includes('bmad-weeklyusage'), 'weeklyusage appended on load');
        assert.equal(line.widgetOrder[line.widgetOrder.length - 1], 'bmad-weeklyusage', 'appended at the end');
        assert.equal(line.widgetOrder.length, 13);
        for (const id of legacyOrder) {
          assert.ok(line.widgetOrder.includes(id), `original id ${id} preserved`);
        }
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
