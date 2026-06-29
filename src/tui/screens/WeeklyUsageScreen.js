// WeeklyUsageScreen.js — read-only dashboard: weekly plan-consumption usage bar + time bar with day ticks

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ScreenLayout } from '../components/ScreenLayout.js';
import { toInkColor } from '../preview-utils.js';
import { computeWeeklyUsage, computeWeekDayTicks } from '../../defaults.js';

const e = React.createElement;

const WIDTH = 40;
const USAGE_GUTTER = 'Usage '; // 6 chars — keep all rows column-aligned
const TIME_GUTTER = 'Time  '; // 6 chars
const LABEL_GUTTER = '      '; // 6 spaces

const SHORTCUTS = [{ key: 'Esc', label: 'Back' }];

// Pattern 2 — synchronous, read-only, never throws (→ null on any error / missing file / invalid JSON)
function readSnapshot(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

export function WeeklyUsageScreen({ config, previewOverride, goBack, isActive, paths }) {
  // AC5 — defensive cache-dir resolution (paths is undefined in production unless app.js passes { cachePath })
  const cacheDir = (paths && paths.cachePath) || process.env.BMAD_CACHE_DIR || path.join(os.homedir(), '.cache', 'bmad-status');
  const usagePath = path.join(cacheDir, 'weekly-usage.json');

  const [snapshot, setSnapshot] = useState(() => readSnapshot(usagePath));

  // AC6 — low-frequency render-only refresh: re-read the cache snapshot every ~60s so the time bar advances.
  // BF2-exempt (re-reads a cache file into local state; never reads+writes config).
  useEffect(() => {
    const id = setInterval(() => setSnapshot(readSnapshot(usagePath)), 60000);
    id.unref?.();
    return () => clearInterval(id);
  }, [usagePath]);

  // AC7 — Esc → back; isActive guards against ghost input on the unfocused screen
  useInput((input, key) => {
    if (key.escape) goBack();
  }, { isActive });

  // Recomputing Date.now() each render is what advances the time bar between refreshes.
  const u = computeWeeklyUsage(snapshot, Date.now());

  let body;
  if (!u) {
    // AC4 — empty state: grey placeholder bar + waiting message, no zone color, no tick compute on null
    body = e(Box, { flexDirection: 'column' },
      e(Text, { dimColor: true }, USAGE_GUTTER + '░'.repeat(WIDTH)),
      e(Text, { dimColor: true }, 'Weekly: --'),
      e(Text, { dimColor: true }, 'Waiting for usage data (subscribers only; appears after the first API response).'),
    );
  } else {
    const ticks = snapshot.resets_at != null ? computeWeekDayTicks(snapshot.resets_at, Date.now()) : [];

    // AC1 — usage bar: fixed-width, filled to usagePct, zone-colored
    const usageFill = Math.round((u.usagePct / 100) * WIDTH);
    const usageCells = [];
    for (let i = 0; i < WIDTH; i++) {
      const filled = i < usageFill;
      usageCells.push(e(Text, { key: `u${i}`, color: filled ? toInkColor(u.color) : undefined, dimColor: !filled },
        filled ? '█' : '░'));
    }
    const usageRow = e(Text, null, USAGE_GUTTER, ...usageCells, ' ' + u.usagePct.toFixed(1) + '%');

    // AC1 — time bar: same width, neutral/dim fill to timePct, with │ day-tick glyphs overlaid
    const timeFill = Math.round((u.timePct / 100) * WIDTH);
    const tickCols = new Set(ticks.map(t => Math.round((t.positionPct / 100) * (WIDTH - 1))));
    const timeCells = [];
    for (let i = 0; i < WIDTH; i++) {
      let glyph;
      if (tickCols.has(i)) glyph = '│'; // │ day boundary
      else glyph = i < timeFill ? '█' : '░';
      timeCells.push(e(Text, { key: `t${i}`, dimColor: true }, glyph));
    }
    const timeRow = e(Text, null, TIME_GUTTER, ...timeCells);

    // AC1/AC3 — day-tick label row (short WEEKDAY_LABELS form), placed under each tick column
    const labelBuf = Array(WIDTH).fill(' ');
    for (const t of ticks) {
      const col = Math.round((t.positionPct / 100) * (WIDTH - 1));
      for (let k = 0; k < t.label.length && col + k < WIDTH; k++) {
        labelBuf[col + k] = t.label[k];
      }
    }
    const labelRow = e(Text, { dimColor: true }, LABEL_GUTTER + labelBuf.join(''));

    // AC2 — zone status line, matches the widget's compact form ('Weekly: ' + status);
    // the dashboard shows the % on its own usage-bar row above, so no extended variant here.
    const statusLine = e(Text, { color: toInkColor(u.color) }, 'Weekly: ' + u.status);

    body = e(Box, { flexDirection: 'column' },
      usageRow,
      timeRow,
      labelRow,
      e(Text, null, ' '),
      statusLine,
    );
  }

  return e(ScreenLayout, {
    screenName: 'Weekly Usage',
    screenColor: 'cyan',
    config,
    previewOverride,
    shortcuts: SHORTCUTS,
  }, body);
}
