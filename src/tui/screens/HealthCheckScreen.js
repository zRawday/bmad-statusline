// HealthCheckScreen.js — runs the doctor health check and renders results in-TUI

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { Spinner } from '@inkjs/ui';
import { ScreenLayout } from '../components/ScreenLayout.js';
import { runHealthCheck as defaultRunHealthCheck } from '../../doctor.js';

const e = React.createElement;

const SHORTCUTS = [
  { key: 'r', label: 'Re-run' },
  { key: 'Esc', label: 'Back' },
];

const STATUS_GLYPH = {
  ok: { glyph: '✓', color: 'green' },
  repaired: { glyph: '✓', color: 'yellow' },
  fail: { glyph: '✗', color: 'red' },
};

export function HealthCheckScreen({ config, previewOverride, goBack, isActive, paths, runHealthCheck = defaultRunHealthCheck }) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);

  const runChecks = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setResult(null);
    Promise.resolve(runHealthCheck(paths)).then(res => {
      if (!cancelled) { setResult(res); setLoading(false); }
    }).catch(() => {
      if (!cancelled) { setResult({ checks: [], healthy: false }); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [runHealthCheck, paths]);

  useEffect(() => runChecks(), [runChecks]);

  useInput((input, key) => {
    if (key.escape) { goBack(); return; }
    if ((input === 'r' || input === 'R') && !loading) { runChecks(); }
  }, { isActive });

  let body;
  if (loading) {
    body = e(Spinner, { label: 'Running checks…' });
  } else {
    const rows = (result && result.checks || []).map(c => {
      const s = STATUS_GLYPH[c.status] || STATUS_GLYPH.fail;
      return e(Text, { key: c.id },
        e(Text, { color: s.color }, `${s.glyph} `),
        c.label,
        e(Text, { dimColor: true }, `  —  ${c.detail}`),
      );
    });
    const summary = result && result.healthy
      ? e(Text, { color: 'green', bold: true }, '✓ Status line healthy.')
      : e(Text, { color: 'red', bold: true }, '⚠  Problems found — see above.');
    body = e(Box, { flexDirection: 'column' }, ...rows, e(Text, null, ' '), summary);
  }

  return e(ScreenLayout, {
    screenName: 'Health Check',
    screenColor: 'cyan',
    config,
    previewOverride,
    shortcuts: SHORTCUTS,
  }, body);
}
