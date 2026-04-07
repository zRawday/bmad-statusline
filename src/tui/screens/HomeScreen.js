// HomeScreen.js — Home screen with menu options and ccstatusline launcher

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { ScreenLayout } from '../components/ScreenLayout.js';

const e = React.createElement;

const HOME_OPTIONS = [
  { label: '\uD83D\uDDA5  Monitor', value: 'monitor' },
  { label: '\u2500\u2500\u2500', value: '_sep0' },
  { label: '\uD83D\uDCDD Edit widget line 1', value: 'editLine1' },
  { label: '\uD83D\uDCDD Edit widget line 2', value: 'editLine2' },
  { label: '\uD83D\uDCDD Edit widget line 3', value: 'editLine3' },
  { label: '\u2500\u2500\u2500', value: '_sep1' },
  { label: '\uD83D\uDD00 Reorder lines', value: 'reorderLines' },
  { label: '\u2726  Separator style', value: 'separator' },
  { label: '\u21A9  Reset to original', value: 'reset' },
  { label: '\u2500\u2500\u2500', value: '_sep2' },
  { label: '\uD83D\uDCBE Save preset', value: 'presetSave' },
  { label: '\uD83D\uDCC2 Load preset', value: 'presetLoad' },
  { label: '\u2500\u2500\u2500', value: '_sep3' },
  { label: '\u2699  Open ccstatusline', value: 'ccstatusline' },
];

const SELECTABLE_INDICES = HOME_OPTIONS
  .map((o, i) => o.value.startsWith('_sep') ? -1 : i)
  .filter(i => i >= 0);

const HOME_SHORTCUTS = [
  { key: '\u2191\u2193', label: 'Navigate' },
  { key: 'Enter', label: 'Select' },
  { key: 'q', label: 'Quit' },
];

export function HomeScreen({ config, previewOverride, navigate, resetToOriginal, onQuit, onLaunchCcstatusline, isActive }) {
  const [cursor, setCursor] = useState(0);

  useInput((input, key) => {
    if (input === 'q') { onQuit(); return; }
    if (key.upArrow) {
      setCursor(prev => {
        const pos = SELECTABLE_INDICES.indexOf(prev);
        return pos > 0 ? SELECTABLE_INDICES[pos - 1] : prev;
      });
    } else if (key.downArrow) {
      setCursor(prev => {
        const pos = SELECTABLE_INDICES.indexOf(prev);
        return pos < SELECTABLE_INDICES.length - 1 ? SELECTABLE_INDICES[pos + 1] : prev;
      });
    } else if (key.return) {
      const value = HOME_OPTIONS[cursor].value;
      if (value === 'editLine1') navigate('editLine', { editingLine: 0 });
      else if (value === 'editLine2') navigate('editLine', { editingLine: 1 });
      else if (value === 'editLine3') navigate('editLine', { editingLine: 2 });
      else if (value === 'reorderLines') navigate('reorderLines');
      else if (value === 'separator') navigate('separator');
      else if (value === 'reset') resetToOriginal();
      else if (value === 'presetSave') navigate('presetSave');
      else if (value === 'presetLoad') navigate('presetLoad');
      else if (value === 'ccstatusline') onLaunchCcstatusline();
      else if (value === 'monitor') navigate('monitor');
    }
  }, { isActive });

  return e(ScreenLayout, {
    screenName: 'Home',
    screenColor: 'cyan',
    config,
    previewOverride,
    shortcuts: HOME_SHORTCUTS,
  },
    e(Box, { flexDirection: 'column' },
      ...HOME_OPTIONS.map((opt, i) => {
        const isSep = opt.value.startsWith('_sep');
        return e(Text, { key: opt.value, dimColor: isSep },
          i === cursor ? '\u276F ' : '  ',
          opt.label,
        );
      }),
    ),
  );
}
