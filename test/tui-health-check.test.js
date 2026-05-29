// tui-health-check.test.js — Tests for HealthCheckScreen

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { render } from 'ink-testing-library';
import { HealthCheckScreen } from '../src/tui/screens/HealthCheckScreen.js';
import { createDefaultConfig } from '../src/tui/widget-registry.js';

const e = React.createElement;

function makeProps(runHealthCheck, overrides = {}) {
  return {
    config: createDefaultConfig(),
    previewOverride: null,
    goBack: () => {},
    isActive: true,
    runHealthCheck,
    ...overrides,
  };
}

const flush = async () => { await act(async () => {}); };

describe('HealthCheckScreen', () => {
  test('shows a running label while the check is pending', async () => {
    // Runner that never resolves within the test → stays in loading state
    const pending = () => new Promise(() => {});
    let app;
    await act(async () => { app = render(e(HealthCheckScreen, makeProps(pending))); });
    assert.match(app.lastFrame(), /Running checks/);
    app.unmount();
  });

  test('renders ✓/✗ rows and summary after the check resolves', async () => {
    const runner = () => Promise.resolve({
      checks: [
        { id: 'reader', label: 'Reader deployed', status: 'ok', detail: 'ok-detail' },
        { id: 'npx', label: 'ccstatusline runs via npx', status: 'fail', detail: 'broken-detail' },
      ],
      healthy: false,
    });
    let app;
    await act(async () => { app = render(e(HealthCheckScreen, makeProps(runner))); });
    await flush();
    const frame = app.lastFrame();
    assert.match(frame, /Reader deployed/);
    assert.match(frame, /ccstatusline runs via npx/);
    assert.match(frame, /✓/);
    assert.match(frame, /✗/);
    assert.match(frame, /Problems found/);
    app.unmount();
  });

  test('shows healthy summary when all checks pass', async () => {
    const runner = () => Promise.resolve({
      checks: [{ id: 'reader', label: 'Reader deployed', status: 'ok', detail: 'x' }],
      healthy: true,
    });
    let app;
    await act(async () => { app = render(e(HealthCheckScreen, makeProps(runner))); });
    await flush();
    assert.match(app.lastFrame(), /healthy/i);
    app.unmount();
  });
});
