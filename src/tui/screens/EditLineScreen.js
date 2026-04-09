// EditLineScreen.js — Per-line widget list with h/g/←→ shortcuts (widgetOrder, inline grab, color cycle)

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { ScreenLayout } from '../components/ScreenLayout.js';
import { getIndividualWidgets, ANSI_COLORS } from '../widget-registry.js';
import { toInkColor } from '../preview-utils.js';

const e = React.createElement;

const RAINBOW_COLORS = ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta', 'white'];

const BASE_NAVIGATE_SHORTCUTS = [
  { key: '\u2191\u2193', label: 'Navigate' },
  { key: 'h', label: 'Hide/Show' },
  { key: 'g', label: 'Grab' },
  { key: '\u2190\u2192', label: 'Color' },
  { key: 'Enter', label: 'Edit skills' },
  { key: 'Esc', label: 'Back' },
];
const STORY_MODE_SHORTCUT = { key: 'm', label: 'Mode' };

const GRAB_SHORTCUTS = [
  { key: '\u2191\u2193', label: 'Move' },
  { key: 'g', label: 'Drop' },
  { key: 'Esc', label: 'Cancel' },
];

function getColorOptions(widgetId) {
  if (widgetId === 'bmad-llmstate') return [];
  if (widgetId === 'bmad-workflow' || widgetId === 'bmad-project' || widgetId === 'bmad-activeskill') return ['dynamic', ...ANSI_COLORS];
  return ANSI_COLORS;
}

function getCurrentColorValue(colorModes, widget) {
  const mode = colorModes[widget.id];
  if (mode?.mode === 'dynamic') return 'dynamic';
  return mode?.fixedColor || widget.defaultColor || 'white';
}

function renderRainbowVisible() {
  const letters = 'visible'.split('');
  return letters.map((ch, i) =>
    e(Text, { key: `r-${i}`, color: RAINBOW_COLORS[i] }, ch)
  );
}

export function EditLineScreen({ config, updateConfig, previewOverride, setPreviewOverride, navigate, goBack, editingLine, isActive }) {
  const [cursorIndex, setCursorIndex] = useState(0);
  const [grabMode, setGrabMode] = useState(false);
  const [grabOrder, setGrabOrder] = useState(null);

  const allWidgets = getIndividualWidgets();
  if (editingLine == null || !config.lines[editingLine]) {
    return e(ScreenLayout, { screenName: 'Edit Line', screenColor: 'green', config, previewOverride, shortcuts: [] });
  }
  const line = config.lines[editingLine];
  const widgetOrder = grabOrder || line.widgetOrder;
  const widgetList = widgetOrder.map(id => allWidgets.find(w => w.id === id)).filter(Boolean);

  function getColorName(widget) {
    const colorMode = line.colorModes[widget.id];
    if (colorMode?.mode === 'dynamic') return 'dynamic';
    return colorMode?.fixedColor || widget.defaultColor || 'white';
  }

  function deriveVisibleWidgets(order) {
    return order.filter(id => line.widgets.includes(id));
  }

  useInput((input, key) => {
    if (!isActive) return;

    // --- Grab mode ---
    if (grabMode) {
      if (key.upArrow && cursorIndex > 0) {
        const newOrder = [...grabOrder];
        [newOrder[cursorIndex - 1], newOrder[cursorIndex]] = [newOrder[cursorIndex], newOrder[cursorIndex - 1]];
        setGrabOrder(newOrder);
        setCursorIndex(cursorIndex - 1);
        const preview = structuredClone(config);
        preview.lines[editingLine].widgetOrder = newOrder;
        preview.lines[editingLine].widgets = deriveVisibleWidgets(newOrder);
        setPreviewOverride(preview);
      } else if (key.downArrow && cursorIndex < widgetList.length - 1) {
        const newOrder = [...grabOrder];
        [newOrder[cursorIndex], newOrder[cursorIndex + 1]] = [newOrder[cursorIndex + 1], newOrder[cursorIndex]];
        setGrabOrder(newOrder);
        setCursorIndex(cursorIndex + 1);
        const preview = structuredClone(config);
        preview.lines[editingLine].widgetOrder = newOrder;
        preview.lines[editingLine].widgets = deriveVisibleWidgets(newOrder);
        setPreviewOverride(preview);
      } else if (key.return || input === 'g') {
        const finalOrder = grabOrder;
        const finalWidgets = deriveVisibleWidgets(finalOrder);
        updateConfig(cfg => {
          cfg.lines[editingLine].widgetOrder = finalOrder;
          cfg.lines[editingLine].widgets = finalWidgets;
        });
        setPreviewOverride(null);
        setGrabMode(false);
        setGrabOrder(null);
      } else if (key.escape) {
        setPreviewOverride(null);
        setGrabMode(false);
        setGrabOrder(null);
      }
      return;
    }

    // --- Normal mode ---
    if (key.upArrow) {
      setCursorIndex(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setCursorIndex(prev => Math.min(widgetList.length - 1, prev + 1));
    } else if (key.return) {
      const widget = widgetList[cursorIndex];
      if (widget && (widget.id === 'bmad-workflow' || widget.id === 'bmad-activeskill')) {
        navigate('skillColors');
      } else if (widget && widget.id === 'bmad-project') {
        navigate('projectColors');
      }
    } else if (key.escape) {
      goBack();
    } else if (input === 'h') {
      const widget = widgetList[cursorIndex];
      if (!widget) return;
      updateConfig(cfg => {
        const ln = cfg.lines[editingLine];
        const idx = ln.widgets.indexOf(widget.id);
        if (idx >= 0) {
          ln.widgets.splice(idx, 1);
        } else {
          // Insert at position respecting widgetOrder
          const order = ln.widgetOrder;
          const orderIdx = order.indexOf(widget.id);
          let insertAt = 0;
          for (let i = 0; i < orderIdx; i++) {
            const wIdx = ln.widgets.indexOf(order[i]);
            if (wIdx >= 0) insertAt = wIdx + 1;
          }
          ln.widgets.splice(insertAt, 0, widget.id);
          if (!ln.colorModes[widget.id]) {
            ln.colorModes[widget.id] = widget.defaultMode === 'dynamic'
              ? { mode: 'dynamic' }
              : { mode: 'fixed', fixedColor: widget.defaultColor };
          }
        }
      });
    } else if (input === 'g') {
      setGrabOrder([...line.widgetOrder]);
      setGrabMode(true);
    } else if (input === 'm') {
      const widget = widgetList[cursorIndex];
      if (!widget || widget.id !== 'bmad-story') return;
      if (!line.widgets.includes(widget.id)) return;
      updateConfig(cfg => {
        const ln = cfg.lines[editingLine];
        if (!ln.colorModes[widget.id]) {
          ln.colorModes[widget.id] = { mode: 'fixed', fixedColor: 'magenta' };
        }
        const cm = ln.colorModes[widget.id];
        cm.displayMode = cm.displayMode === 'compact' ? 'full' : 'compact';
      });
    } else if (key.leftArrow || key.rightArrow) {
      const widget = widgetList[cursorIndex];
      if (!widget || !line.widgets.includes(widget.id)) return;
      const options = getColorOptions(widget.id);
      if (options.length === 0) return;
      const current = getCurrentColorValue(line.colorModes, widget);
      const idx = options.indexOf(current);
      const nextIdx = key.rightArrow
        ? (idx + 1) % options.length
        : (idx - 1 + options.length) % options.length;
      const nextColor = options[nextIdx];
      updateConfig(cfg => {
        const prev = cfg.lines[editingLine].colorModes[widget.id];
        const base = nextColor === 'dynamic'
          ? { mode: 'dynamic' }
          : { mode: 'fixed', fixedColor: nextColor };
        if (prev?.displayMode) base.displayMode = prev.displayMode;
        cfg.lines[editingLine].colorModes[widget.id] = base;
      });
    }
  }, { isActive });

  return e(ScreenLayout, {
    screenName: `Edit Line ${editingLine + 1}`,
    screenColor: 'green',
    config,
    previewOverride,
    shortcuts: grabMode ? GRAB_SHORTCUTS
      : widgetList[cursorIndex]?.id === 'bmad-story'
        ? [...BASE_NAVIGATE_SHORTCUTS.slice(0, 4), STORY_MODE_SHORTCUT, ...BASE_NAVIGATE_SHORTCUTS.slice(4)]
        : BASE_NAVIGATE_SHORTCUTS,
  },
    e(Box, { flexDirection: 'column' },
      ...widgetList.map((widget, i) => {
        const isVisible = line.widgets.includes(widget.id);
        const colorName = getColorName(widget);
        const isDynamic = colorName === 'dynamic';
        const prefix = i === cursorIndex ? '> ' : '  ';
        const statusIcon = isVisible ? '\u25A0' : '\u25A1';
        const statusColor = isVisible ? colorName : 'brightBlack';
        const isGrabbed = grabMode && i === cursorIndex;

        const statusParts = [];
        if (isVisible && isDynamic) {
          statusParts.push(e(Text, { key: 'icon' }, statusIcon + ' '));
          statusParts.push(...renderRainbowVisible());
        } else {
          statusParts.push(e(Text, { key: 'status', color: toInkColor(statusColor) },
            `${statusIcon} ${isVisible ? 'visible' : 'hidden'}`));
        }

        // Display mode hint for story widget — shown in name column
        const storyMode = isVisible && widget.id === 'bmad-story'
          ? (line.colorModes[widget.id]?.displayMode || 'full')
          : null;
        const displayName = storyMode ? `${widget.name} (${storyMode})` : widget.name;

        // Compute padding so hints align vertically
        const statusLen = isVisible ? 9 : 8; // "■ visible" or "□ hidden"
        const colorDisplay = widget.id === 'bmad-llmstate' ? '(auto)' : colorName;
        const colorLen = isVisible ? 2 + colorDisplay.length : 0; // "  {color}"
        const grabLen = isGrabbed ? 3 : 0; // "  ↕"
        const hintPad = ' '.repeat(Math.max(2, 26 - statusLen - colorLen - grabLen));

        return e(Text, { key: widget.id, bold: isGrabbed },
          prefix,
          e(Text, null, displayName.padEnd(18)),
          ...statusParts,
          isVisible ? e(Text, { dimColor: true }, `  ${widget.id === 'bmad-llmstate' ? '(auto)' : colorName}`) : null,
          isGrabbed ? e(Text, { dimColor: true }, '  \u2195') : null,
          widget.hint ? e(Text, { dimColor: true }, `${hintPad}${widget.hint}`) : null,
        );
      }),
      e(Text, { dimColor: true }, '\n⚠  Status line refreshes only when the LLM performs actions (Claude Code limitation)'),
    ),
  );
}
