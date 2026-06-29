import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SAMPLE_VALUES,
  WORKFLOW_SAMPLE_COLOR,
  SEPARATOR_MAP,
  resolvePreviewColor,
  getSampleValue,
} from '../src/tui/preview-utils.js';

describe('preview-utils', () => {
  describe('SAMPLE_VALUES', () => {
    test('has all 13 widget keys', () => {
      const expectedKeys = [
        'bmad-llmstate', 'bmad-project', 'bmad-workflow', 'bmad-activeskill', 'bmad-nextstep',
        'bmad-progressstep', 'bmad-story', 'bmad-docname', 'bmad-timer',
        'bmad-fileread', 'bmad-filewrite', 'bmad-contextpct', 'bmad-weeklyusage',
      ];
      for (const key of expectedKeys) {
        assert.ok(key in SAMPLE_VALUES, `missing key: ${key}`);
        assert.equal(typeof SAMPLE_VALUES[key], 'string', `${key} should be a string`);
      }
    });

    test('has exactly 13 keys', () => {
      assert.equal(Object.keys(SAMPLE_VALUES).length, 13);
    });

    test('bmad-weeklyusage sample is the compact SWEET SPOT zone text', () => {
      assert.equal(SAMPLE_VALUES['bmad-weeklyusage'], 'Weekly: SWEET SPOT');
    });
  });

  describe('getSampleValue — bmad-weeklyusage displayMode', () => {
    test('compact (or unset) returns the no-percentage sample', () => {
      assert.equal(getSampleValue('bmad-weeklyusage', {}), 'Weekly: SWEET SPOT');
      assert.equal(
        getSampleValue('bmad-weeklyusage', { 'bmad-weeklyusage': { displayMode: 'compact' } }),
        'Weekly: SWEET SPOT',
      );
    });

    test('extended returns the sample with a percentage', () => {
      assert.equal(
        getSampleValue('bmad-weeklyusage', { 'bmad-weeklyusage': { displayMode: 'extended' } }),
        'Weekly: 53.0% SWEET SPOT',
      );
    });
  });

  describe('WORKFLOW_SAMPLE_COLOR', () => {
    test('is a string', () => {
      assert.equal(typeof WORKFLOW_SAMPLE_COLOR, 'string');
    });

    test('is green', () => {
      assert.equal(WORKFLOW_SAMPLE_COLOR, 'green');
    });
  });

  describe('SEPARATOR_MAP', () => {
    test('has 3 keys: serre, modere, large', () => {
      assert.equal(Object.keys(SEPARATOR_MAP).length, 3);
      assert.ok('serre' in SEPARATOR_MAP);
      assert.ok('modere' in SEPARATOR_MAP);
      assert.ok('large' in SEPARATOR_MAP);
    });

    test('uses Unicode box drawing characters', () => {
      assert.ok(SEPARATOR_MAP.serre.includes('\u2503'));
      assert.ok(SEPARATOR_MAP.modere.includes('\u2503'));
      assert.ok(SEPARATOR_MAP.large.includes('\u2503'));
    });
  });

  describe('resolvePreviewColor', () => {
    test('returns WORKFLOW_SAMPLE_COLOR for dynamic mode', () => {
      const colorModes = { 'bmad-workflow': { mode: 'dynamic' } };
      assert.equal(resolvePreviewColor('bmad-workflow', colorModes), WORKFLOW_SAMPLE_COLOR);
    });

    test('returns fixedColor for fixed mode', () => {
      const colorModes = { 'bmad-project': { mode: 'fixed', fixedColor: 'red' } };
      assert.equal(resolvePreviewColor('bmad-project', colorModes), 'red');
    });

    test('returns red for project default (dynamic widget with no entry)', () => {
      const colorModes = {};
      assert.equal(resolvePreviewColor('bmad-project', colorModes), 'red');
    });

    test('returns WORKFLOW_SAMPLE_COLOR for workflow default (dynamic widget with no entry)', () => {
      const colorModes = {};
      assert.equal(resolvePreviewColor('bmad-workflow', colorModes), WORKFLOW_SAMPLE_COLOR);
    });

    test('returns red when project fixed mode has no fixedColor', () => {
      const colorModes = { 'bmad-project': { mode: 'fixed' } };
      assert.equal(resolvePreviewColor('bmad-project', colorModes), 'red');
    });

    test('returns white for unknown widget with no colorModes entry', () => {
      const colorModes = {};
      assert.equal(resolvePreviewColor('bmad-unknown', colorModes), 'white');
    });

    test('returns blue for bmad-weeklyusage regardless of mode (self-colored)', () => {
      assert.equal(
        resolvePreviewColor('bmad-weeklyusage', { 'bmad-weeklyusage': { mode: 'dynamic' } }),
        'blue'
      );
      assert.equal(
        resolvePreviewColor('bmad-weeklyusage', { 'bmad-weeklyusage': { mode: 'fixed', fixedColor: 'red' } }),
        'blue'
      );
    });
  });
});
