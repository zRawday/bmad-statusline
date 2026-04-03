// ReorderLinesScreen.js — Reorder the 3 statusline lines by swapping entire line contents

import React, { useState, useMemo } from 'react';
import { useInput } from 'ink';
import { ScreenLayout } from '../components/ScreenLayout.js';
import { ReorderList } from '../components/ReorderList.js';
import { getIndividualWidgets } from '../widget-registry.js';

const e = React.createElement;

const NAVIGATE_SHORTCUTS = [
  { key: '\u2191\u2193', label: 'Navigate' },
  { key: 'Enter', label: 'Grab' },
  { key: 'Esc', label: 'Back' },
];

const MOVING_SHORTCUTS = [
  { key: '\u2191\u2193', label: 'Move' },
  { key: 'Enter', label: 'Drop' },
  { key: 'Esc', label: 'Cancel' },
];

function buildLineLabel(line) {
  if (!line.widgets || line.widgets.length === 0) return '(empty)';
  const allWidgets = getIndividualWidgets();
  return line.widgets.map(id => {
    const w = allWidgets.find(wd => wd.id === id);
    return w ? w.name : id;
  }).join(' \u00b7 ');
}

export function ReorderLinesScreen({ config, updateConfig, previewOverride, setPreviewOverride, goBack, isActive }) {
  const [shortcuts, setShortcuts] = useState(NAVIGATE_SHORTCUTS);

  const items = useMemo(() =>
    config.lines.map((line, i) => ({
      id: String(i),
      label: `Line ${i + 1}: ${buildLineLabel(line)}`,
    })),
    [config]
  );

  function handleMove(newOrder) {
    const preview = structuredClone(config);
    const reordered = newOrder.map(id => config.lines[Number(id)]);
    preview.lines = reordered.map(l => structuredClone(l));
    setPreviewOverride(preview);
  }

  function handleDrop(newOrder) {
    updateConfig(cfg => {
      const reordered = newOrder.map(id => structuredClone(cfg.lines[Number(id)]));
      cfg.lines = reordered;
    });
    setPreviewOverride(null);
    goBack();
  }

  function handleCancel() {
    setPreviewOverride(null);
  }

  function handleBack() {
    goBack();
  }

  function handleModeChange(mode) {
    setShortcuts(mode === 'moving' ? MOVING_SHORTCUTS : NAVIGATE_SHORTCUTS);
  }

  // Escape handled by ReorderList's onBack in navigate mode
  useInput(() => {}, { isActive: false });

  return e(ScreenLayout, {
    screenName: 'Reorder Lines',
    screenColor: 'magenta',
    config,
    previewOverride,
    shortcuts,
  },
    e(ReorderList, {
      items,
      isActive,
      onMove: handleMove,
      onDrop: handleDrop,
      onCancel: handleCancel,
      onBack: handleBack,
      onModeChange: handleModeChange,
    })
  );
}
