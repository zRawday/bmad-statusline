import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getIndividualWidgets,
  createDefaultConfig,
  ANSI_COLORS,
} from '../src/tui/widget-registry.js';

describe('widget-registry', () => {
  it('getIndividualWidgets returns all 11 individual widgets', () => {
    const widgets = getIndividualWidgets();
    assert.equal(widgets.length, 11);
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
      'bmad-filewrite': 'brightRed',
    };
    for (const w of widgets) {
      assert.equal(w.defaultColor, expected[w.id], `${w.id} defaultColor`);
    }
  });

  it('widget defaultMode values match specification', () => {
    const widgets = getIndividualWidgets();
    for (const w of widgets) {
      if (w.id === 'bmad-llmstate' || w.id === 'bmad-workflow' || w.id === 'bmad-project' || w.id === 'bmad-activeskill') {
        assert.equal(w.defaultMode, 'dynamic', `${w.id} is dynamic`);
      } else {
        assert.equal(w.defaultMode, 'fixed', `${w.id} is fixed`);
      }
    }
  });

  it('dynamic defaultMode widgets are llmstate, workflow, project and activeskill', () => {
    const widgets = getIndividualWidgets();
    const dynamicWidgets = widgets.filter(w => w.defaultMode === 'dynamic');
    assert.equal(dynamicWidgets.length, 4);
    const ids = dynamicWidgets.map(w => w.id).sort();
    assert.deepStrictEqual(ids, ['bmad-activeskill', 'bmad-llmstate', 'bmad-project', 'bmad-workflow']);
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
    const expectedWidgets = ['bmad-project', 'bmad-workflow', 'bmad-story', 'bmad-progressstep', 'bmad-timer'];
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

  it('line 1 has llmstate, line 2 is empty by default', () => {
    const config = createDefaultConfig();
    assert.deepStrictEqual(config.lines[1].widgets, ['bmad-llmstate']);
    assert.deepStrictEqual(config.lines[2].widgets, []);
    assert.deepStrictEqual(config.lines[1].colorModes, { 'bmad-llmstate': { mode: 'dynamic' } });
    assert.deepStrictEqual(config.lines[2].colorModes, {});
    assert.equal(config.lines[1].widgetOrder.length, 11);
    assert.equal(config.lines[2].widgetOrder.length, 11);
  });

  it('returns a new object on each call (not shared reference)', () => {
    const a = createDefaultConfig();
    const b = createDefaultConfig();
    a.separator = 'changed';
    assert.equal(b.separator, 'modere');
  });
});
