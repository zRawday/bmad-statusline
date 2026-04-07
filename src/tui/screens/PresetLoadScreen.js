// PresetLoadScreen.js — Load a full layout preset with try-before-you-buy preview

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { ScreenLayout } from '../components/ScreenLayout.js';
import { getPresetSlotData } from '../preview-utils.js';

const e = React.createElement;

const SHORTCUTS = [
  { key: '\u2191\u2193', label: 'Navigate' },
  { key: 'Enter', label: 'Load' },
  { key: 'Esc', label: 'Back' },
];

function renderSlot(slotIndex, slotData, isCursor) {
  const prefix = isCursor ? '> ' : '  ';
  if (slotData.isEmpty) {
    return e(Box, { key: `slot-${slotIndex}`, flexDirection: 'column' },
      e(Text, { dimColor: true }, `${prefix}${slotIndex + 1}. (empty)`),
    );
  }
  const children = [
    e(Text, { key: 'header' }, `${prefix}${slotIndex + 1}. ${slotData.name}`),
  ];
  slotData.lineSummaries.forEach((names, li) => {
    const summary = names.length > 0 ? names.join(' \u00b7 ') : '\u2500';
    children.push(e(Text, { key: `line-${li}`, dimColor: true }, `     L${li + 1}: ${summary}`));
  });
  return e(Box, { key: `slot-${slotIndex}`, flexDirection: 'column' }, ...children);
}

export function PresetLoadScreen({ config, updateConfig, previewOverride, setPreviewOverride, goBack, isActive }) {
  const [cursorIndex, setCursorIndex] = useState(0);
  const presets = config.presets || [null, null, null];

  useEffect(() => { applyPreviewForSlot(0); }, []);

  function applyPreviewForSlot(index) {
    const preset = presets[index];
    if (!preset || !preset.lines) {
      setPreviewOverride(null);
      return;
    }
    const preview = structuredClone(config);
    for (let i = 0; i < 3; i++) {
      preview.lines[i].widgets = [...preset.lines[i].widgets];
      preview.lines[i].widgetOrder = [...preset.lines[i].widgetOrder];
    }
    preview.separator = preset.separator;
    preview.customSeparator = preset.customSeparator;
    // Colors (colorModes, skillColors, projectColors) are NOT touched
    setPreviewOverride(preview);
  }

  useInput((input, key) => {
    if (key.upArrow) {
      const next = Math.max(0, cursorIndex - 1);
      if (next !== cursorIndex) {
        setCursorIndex(next);
        applyPreviewForSlot(next);
      }
    }
    if (key.downArrow) {
      const next = Math.min(2, cursorIndex + 1);
      if (next !== cursorIndex) {
        setCursorIndex(next);
        applyPreviewForSlot(next);
      }
    }
    if (key.return) {
      const preset = presets[cursorIndex];
      if (!preset || !preset.lines) return; // empty or old-format slot — no-op
      updateConfig(cfg => {
        for (let i = 0; i < 3; i++) {
          cfg.lines[i].widgets = [...preset.lines[i].widgets];
          cfg.lines[i].widgetOrder = [...preset.lines[i].widgetOrder];
        }
        cfg.separator = preset.separator;
        cfg.customSeparator = preset.customSeparator;
        // Colors preserved — not touched
      });
      setPreviewOverride(null);
      goBack();
    }
    if (key.escape) goBack();
  }, { isActive });

  const slots = [0, 1, 2].map(i => getPresetSlotData(presets[i]));

  return e(ScreenLayout, {
    screenName: 'Load Preset',
    screenColor: 'brightCyan',
    config,
    previewOverride,
    shortcuts: SHORTCUTS,
  },
    ...slots.map((slot, i) => renderSlot(i, slot, i === cursorIndex))
  );
}
