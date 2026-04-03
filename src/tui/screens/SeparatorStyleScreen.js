// SeparatorStyleScreen.js — Choose separator style between widgets (v2 props, dual-mode: select + TextInput)

import React, { useState } from 'react';
import { Text, useInput } from 'ink';
import { TextInput } from '@inkjs/ui';
import { ScreenLayout } from '../components/ScreenLayout.js';
import { SelectWithPreview } from '../components/SelectWithPreview.js';

const e = React.createElement;

const SEPARATOR_OPTIONS = [
  { label: 'tight      myproject\u2503dev-story\u25034.2 - Auth Login', value: 'serre' },
  { label: 'moderate   myproject \u2503 dev-story \u2503 4.2 - Auth Login', value: 'modere' },
  { label: 'wide       myproject  \u2503  dev-story  \u2503  4.2 - Auth Login', value: 'large' },
  { label: 'custom     Enter custom separator string', value: 'custom' },
];

const SEPARATOR_SHORTCUTS = [
  { key: '\u2191\u2193', label: 'Navigate' },
  { key: 'Enter', label: 'Select' },
  { key: 'Esc', label: 'Back' },
];

const TEXTINPUT_SHORTCUTS = [
  { key: 'Enter', label: 'Confirm' },
  { key: 'Esc', label: 'Cancel' },
];

function getCurrentSeparatorContent(config) {
  if (config.separator === 'custom' && config.customSeparator) {
    return config.customSeparator;
  }
  return '';
}

export function SeparatorStyleScreen({ config, updateConfig, previewOverride, setPreviewOverride, goBack, isActive }) {
  const [mode, setMode] = useState('select');

  const handleHighlight = (value) => {
    const preview = structuredClone(config);
    preview.separator = value;
    setPreviewOverride(preview);
  };

  const handleSelect = (value) => {
    if (value === 'custom') {
      setMode('textInput');
      return;
    }
    updateConfig(cfg => {
      cfg.separator = value;
      cfg.customSeparator = null;
    });
    setPreviewOverride(null);
    goBack();
  };

  const handleCustomSubmit = (value) => {
    if (!value) {
      setMode('select');
      setPreviewOverride(null);
      return;
    }
    updateConfig(cfg => {
      cfg.separator = 'custom';
      cfg.customSeparator = value;
    });
    setPreviewOverride(null);
    goBack();
  };

  useInput((_input, key) => {
    if (key.escape) {
      if (mode === 'textInput') {
        setMode('select');
        setPreviewOverride(null);
      } else {
        goBack();
      }
    }
  }, { isActive });

  if (mode === 'textInput') {
    return e(ScreenLayout, {
      screenName: 'Separator Style',
    screenColor: 'yellow',
      config,
      previewOverride,
      shortcuts: TEXTINPUT_SHORTCUTS,
    },
      e(Text, null, 'Enter custom separator:'),
      e(Text, null, ' '),
      e(TextInput, {
        defaultValue: getCurrentSeparatorContent(config),
        onSubmit: handleCustomSubmit,
      })
    );
  }

  return e(ScreenLayout, {
    screenName: 'Separator Style',
    screenColor: 'yellow',
    config,
    previewOverride,
    shortcuts: SEPARATOR_SHORTCUTS,
  },
    e(SelectWithPreview, {
      options: SEPARATOR_OPTIONS,
      defaultValue: config.separator,
      onChange: handleSelect,
      onHighlight: handleHighlight,
      isActive,
    })
  );
}
