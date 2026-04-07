// PresetSaveScreen.js — Save full layout (all 3 lines + separator) to one of 3 preset slots

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { TextInput } from '@inkjs/ui';
import { ScreenLayout } from '../components/ScreenLayout.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import { getPresetSlotData } from '../preview-utils.js';

const e = React.createElement;

const SHORTCUTS = [
  { key: '\u2191\u2193', label: 'Navigate' },
  { key: 'Enter', label: 'Save here' },
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

export function PresetSaveScreen({ config, updateConfig, previewOverride, goBack, isActive }) {
  const [cursorIndex, setCursorIndex] = useState(0);
  const [phase, setPhase] = useState('list'); // 'list' | 'naming' | 'confirm' | 'renaming'

  const presets = config.presets || [null, null, null];

  useInput((input, key) => {
    if (phase !== 'list') return;
    if (key.upArrow) setCursorIndex(prev => Math.max(0, prev - 1));
    if (key.downArrow) setCursorIndex(prev => Math.min(2, prev + 1));
    if (key.return) {
      if (presets[cursorIndex]) {
        setPhase('confirm');
      } else {
        setPhase('naming');
      }
    }
    if (key.escape) goBack();
  }, { isActive });

  // Handle naming/renaming escape — TextInput doesn't have onCancel, so we use a separate useInput
  useInput((input, key) => {
    if (phase !== 'naming' && phase !== 'renaming') return;
    if (key.escape) setPhase('list');
  }, { isActive });

  function handleNameSubmit(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    updateConfig(cfg => {
      cfg.presets[cursorIndex] = {
        name: trimmed,
        lines: cfg.lines.map(line => ({
          widgets: [...line.widgets],
          widgetOrder: [...line.widgetOrder],
        })),
        separator: cfg.separator,
        customSeparator: cfg.customSeparator,
      };
    });
    goBack();
  }

  function handleConfirm() {
    // Overwrite confirmed — show TextInput for optional rename
    setPhase('renaming');
  }

  function handleRenameSubmit(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    updateConfig(cfg => {
      cfg.presets[cursorIndex] = {
        name: trimmed,
        lines: cfg.lines.map(line => ({
          widgets: [...line.widgets],
          widgetOrder: [...line.widgetOrder],
        })),
        separator: cfg.separator,
        customSeparator: cfg.customSeparator,
      };
    });
    goBack();
  }

  function handleCancelConfirm() {
    setPhase('list');
  }

  const slots = [0, 1, 2].map(i => getPresetSlotData(presets[i]));

  const children = [];

  // Slot list
  for (let i = 0; i < 3; i++) {
    children.push(renderSlot(i, slots[i], i === cursorIndex));
  }

  // TextInput for naming
  if (phase === 'naming') {
    children.push(
      e(Box, { key: 'naming', marginTop: 1 },
        e(Text, null, 'Preset name: '),
        e(TextInput, { placeholder: 'Enter name', onSubmit: handleNameSubmit, isDisabled: !isActive }),
      )
    );
  }

  // ConfirmDialog for overwrite
  if (phase === 'confirm') {
    const slotName = presets[cursorIndex]?.name || '';
    children.push(
      e(Box, { key: 'confirm', marginTop: 1 },
        e(ConfirmDialog, {
          message: `Overwrite slot ${cursorIndex + 1} (${slotName})?`,
          onConfirm: handleConfirm,
          onCancel: handleCancelConfirm,
          isActive,
        })
      )
    );
  }

  // TextInput for rename after overwrite confirm
  if (phase === 'renaming') {
    const existingName = presets[cursorIndex]?.name || '';
    children.push(
      e(Box, { key: 'renaming', marginTop: 1 },
        e(Text, null, 'Preset name: '),
        e(TextInput, { defaultValue: existingName, placeholder: 'Enter name', onSubmit: handleRenameSubmit, isDisabled: !isActive }),
      )
    );
  }

  return e(ScreenLayout, {
    screenName: 'Save Preset',
    screenColor: 'blue',
    config,
    previewOverride,
    shortcuts: SHORTCUTS,
  }, ...children);
}
