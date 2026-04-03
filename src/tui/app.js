// app.js — TUI v2 configurator for BMAD statusline

import React, { useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { StatusMessage } from '@inkjs/ui';
import { loadConfig } from './config-loader.js';
import { writeInternalConfig, syncCcstatuslineIfNeeded, syncCcstatuslineFromScratch } from './config-writer.js';
import { HomeScreen } from './screens/HomeScreen.js';
import { EditLineScreen } from './screens/EditLineScreen.js';
import { SeparatorStyleScreen } from './screens/SeparatorStyleScreen.js';
import { PresetSaveScreen } from './screens/PresetSaveScreen.js';
import { PresetLoadScreen } from './screens/PresetLoadScreen.js';
import { ReorderLinesScreen } from './screens/ReorderLinesScreen.js';
import { SkillColorsScreen } from './screens/SkillColorsScreen.js';
import { ProjectColorsScreen } from './screens/ProjectColorsScreen.js';

const e = React.createElement;

function FallbackScreen({ screen, goBack, isActive }) {
  useInput(() => { goBack(); }, { isActive });
  return e(Box, { flexDirection: 'column' },
    e(Text, null, `Screen "${screen}" is not available.`),
    e(Text, { color: 'gray' }, 'Press any key to go back.'),
  );
}

export function App({ paths }) {
  const { exit } = useApp();

  // v2 state model — BF2-safe: no useEffect for config loading
  const [config, setConfig] = useState(() => loadConfig(paths));
  const [snapshot] = useState(() => structuredClone(config));
  const [previewOverride, setPreviewOverride] = useState(null);
  const [screen, setScreen] = useState('home');
  const [navStack, setNavStack] = useState([]);
  const [editingLine, setEditingLine] = useState(null);
  const [selectedWidget, setSelectedWidget] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  // Pattern 15 — updateConfig(mutator): structuredClone -> mutate -> write -> sync -> return
  function updateConfig(mutator) {
    setConfig(prev => {
      const next = structuredClone(prev);
      mutator(next);
      writeInternalConfig(next, paths);
      syncCcstatuslineIfNeeded(prev, next, paths);
      return next;
    });
  }

  // BF2-safe reset — no useEffect involved
  function resetToOriginal() {
    const restored = structuredClone(snapshot);
    setConfig(restored);
    writeInternalConfig(restored, paths);
    syncCcstatuslineFromScratch(restored, paths);
    setPreviewOverride(null);
  }

  // Navigation — sets context vars from context object
  function navigate(screenName, context = {}) {
    setNavStack(prev => [...prev, screen]);
    setScreen(screenName);
    if (context.editingLine !== undefined) setEditingLine(context.editingLine);
    if (context.selectedWidget !== undefined) setSelectedWidget(context.selectedWidget);
  }

  // goBack — always clears previewOverride (pattern 17)
  function goBack() {
    setPreviewOverride(null);
    if (navStack.length > 0) {
      setScreen(navStack[navStack.length - 1]);
      setNavStack(prev => prev.slice(0, -1));
    }
  }

  // Dismiss status message on any keypress
  useInput(() => {
    if (statusMessage) setStatusMessage(null);
  }, { isActive: !!statusMessage });

  // Standard screen props (pattern 18)
  const screenProps = {
    config,
    updateConfig,
    previewOverride,
    setPreviewOverride,
    navigate,
    goBack,
    editingLine,
    selectedWidget,
    isActive: !statusMessage,
  };

  // Status message overlay
  if (statusMessage) {
    return e(Box, { flexDirection: 'column' },
      e(StatusMessage, { variant: statusMessage.variant }, statusMessage.text),
    );
  }

  // Screen router
  if (screen === 'home') {
    return e(HomeScreen, {
      ...screenProps,
      onQuit: () => exit(),
      resetToOriginal,
      onLaunchCcstatusline: () => { exit(); launchCcstatuslineAfterExit = true; },
    });
  }

  if (screen === 'editLine') {
    return e(EditLineScreen, { ...screenProps });
  }

  if (screen === 'separator') {
    return e(SeparatorStyleScreen, { ...screenProps });
  }

  if (screen === 'presetSave') {
    return e(PresetSaveScreen, { ...screenProps });
  }

  if (screen === 'presetLoad') {
    return e(PresetLoadScreen, { ...screenProps });
  }

  if (screen === 'reorderLines') {
    return e(ReorderLinesScreen, { ...screenProps });
  }

  if (screen === 'skillColors') {
    return e(SkillColorsScreen, { ...screenProps });
  }

  if (screen === 'projectColors') {
    return e(ProjectColorsScreen, { ...screenProps });
  }

  // Fallback for unknown screens
  return e(FallbackScreen, { screen, goBack, isActive: !statusMessage });
}

let launchCcstatuslineAfterExit = false;

export default async function launchTui(paths) {
  const { render: inkRender } = await import('ink');
  const restoreScreen = () => process.stdout.write('\x1b[?1049l');
  // Enter alternate screen buffer
  process.stdout.write('\x1b[?1049h');
  process.on('exit', restoreScreen);
  const instance = inkRender(e(App, { paths }));
  await instance.waitUntilExit();
  restoreScreen();
  process.removeListener('exit', restoreScreen);
  if (launchCcstatuslineAfterExit) {
    launchCcstatuslineAfterExit = false;
    try {
      const { execSync } = await import('node:child_process');
      execSync('npx ccstatusline', { stdio: 'inherit' });
    } catch { /* user sees terminal error directly */ }
  }
}
