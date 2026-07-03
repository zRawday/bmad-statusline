// ContextPctConfigScreen.js — Threshold configuration for context percentage widget

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { ScreenLayout } from '../components/ScreenLayout.js';
import { getGradientColor } from '../../defaults.js';
import { toInkColor } from '../preview-utils.js';

const e = React.createElement;

const SHORTCUTS = [
  { key: '\u2190\u2192', label: '\u00B15%' },
  { key: '\u2191\u2193', label: 'Select' },
  { key: 'Esc', label: 'Back' },
];

export function ContextPctConfigScreen({ config, updateConfig, previewOverride, goBack, editingLine, isActive }) {
  const [cursorIndex, setCursorIndex] = useState(0);

  const line = config.lines[editingLine];
  const cm = line && line.colorModes && line.colorModes['bmad-contextpct'];
  const thresholdLow = cm && cm.thresholdLow != null ? cm.thresholdLow : 0;
  const thresholdHigh = cm && cm.thresholdHigh != null ? cm.thresholdHigh : 100;

  useInput((input, key) => {
    if (!isActive) return;

    if (key.upArrow) {
      setCursorIndex(0);
    } else if (key.downArrow) {
      setCursorIndex(1);
    } else if (key.leftArrow || key.rightArrow) {
      const delta = key.rightArrow ? 5 : -5;
      updateConfig(cfg => {
        const ln = cfg.lines[editingLine];
        if (!ln.colorModes['bmad-contextpct']) {
          ln.colorModes['bmad-contextpct'] = { mode: 'dynamic', thresholdLow: 0, thresholdHigh: 100, displayMode: 'full' };
        }
        const c = ln.colorModes['bmad-contextpct'];
        // The entry may pre-exist WITHOUT threshold fields (seeded by the 'h'
        // show-toggle) — backfill per field or `thresholdHigh - 5` is NaN.
        c.thresholdLow ??= 0;
        c.thresholdHigh ??= 100;
        if (cursorIndex === 0) {
          c.thresholdLow = Math.max(0, Math.min(c.thresholdHigh - 5, c.thresholdLow + delta));
        } else {
          c.thresholdHigh = Math.max(c.thresholdLow + 5, Math.min(100, c.thresholdHigh + delta));
        }
      });
    } else if (key.escape) {
      goBack();
    }
  }, { isActive });

  // Build preview bar: 15 █ chars, each colored by position
  const barChars = [];
  for (let i = 0; i < 15; i++) {
    const posPct = i * 100 / 14;
    const color = getGradientColor(posPct, thresholdLow, thresholdHigh);
    barChars.push(e(Text, { key: `b${i}`, color: toInkColor(color) }, '\u2588'));
  }

  const lowLabel = `${String(thresholdLow).padStart(3)}%`;
  const highLabel = `${String(thresholdHigh).padStart(3)}%`;

  return e(ScreenLayout, {
    screenName: 'Context % Thresholds',
    screenColor: 'green',
    config,
    previewOverride,
    shortcuts: SHORTCUTS,
  },
    e(Box, { flexDirection: 'column' },
      e(Text, null,
        cursorIndex === 0 ? '\u25B8 ' : '  ',
        `Seuil bas ........ [${lowLabel}]  \u2190\u2192`,
      ),
      e(Text, null,
        cursorIndex === 1 ? '\u25B8 ' : '  ',
        `Seuil haut ....... [${highLabel}]  \u2190\u2192`,
      ),
      e(Text, null, ''),
      e(Text, null,
        '    0% ',
        ...barChars,
        ' 100%',
      ),
    ),
  );
}
