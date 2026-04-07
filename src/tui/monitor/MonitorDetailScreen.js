// MonitorDetailScreen.js — Detail page for files and commands (Pattern 23: no fs)

import React, { useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { ShortcutBar } from '../components/ShortcutBar.js';
import ScrollableViewport from './components/ScrollableViewport.js';
import { formatTime, formatRelativeTime } from './monitor-utils.js';

const e = React.createElement;

const DETAIL_PAGE_SHORTCUTS = [
  { key: '↑↓', label: 'scroll', color: 'cyan' },
  { key: 'Esc', label: 'back' },
];

const CHRONO_SHORTCUTS = [
  { key: '↑↓', label: 'scroll', color: 'cyan' },
  { key: 's', label: 'sort', color: 'magenta' },
  { key: 't', label: 'time', color: 'magenta' },
  { key: 'Esc', label: 'back' },
];

const CHRONO_COLORS = {
  READ:  { color: 'cyan' },
  WRITE: { color: 'green' },
  EDIT:  { color: 'yellow' },
  BASH:  { dimColor: true },
};

function buildEditDetail(item, entries) {
  const content = [];
  content.push(e(Text, { bold: true, key: 'title' }, '── FILE DETAIL — EDITED ──'));
  content.push(e(Text, { key: 'title-sp' }, ' '));
  content.push(e(Text, { key: 'path' }, item.data.path));
  content.push(e(Text, { key: 'spacer-0' }, ' '));

  for (let idx = 0; idx < entries.length; idx++) {
    const entry = entries[idx];
    content.push(e(Text, { bold: true, dimColor: true, key: `h-${idx}` }, `── #${idx + 1} — ${formatTime(entry.at)} ──`));

    if (entry.op === 'edit' && entry.old_string) {
      const oldLines = entry.old_string.split('\n');
      for (let j = 0; j < oldLines.length; j++) {
        content.push(e(Text, { color: 'red', key: `old-${idx}-${j}` }, '- ' + oldLines[j]));
      }
      const newLines = (entry.new_string || '').split('\n');
      for (let j = 0; j < newLines.length; j++) {
        content.push(e(Text, { color: 'green', key: `new-${idx}-${j}` }, '+ ' + newLines[j]));
      }
    } else {
      content.push(e(Text, { dimColor: true, key: `created-${idx}` }, '(file created)'));
    }

    content.push(e(Text, { key: `sp-${idx}` }, ' '));
  }

  return content;
}

function buildReadDetail(item, entries) {
  const content = [];
  content.push(e(Text, { bold: true, key: 'title' }, '── FILE DETAIL — READ ──'));
  content.push(e(Text, { key: 'title-sp' }, ' '));
  content.push(e(Text, { key: 'path' }, item.data.path));
  content.push(e(Text, { key: 'spacer-0' }, ' '));

  for (let idx = 0; idx < entries.length; idx++) {
    const entry = entries[idx];
    content.push(e(Text, { key: `r-${idx}` }, formatTime(entry.at) + (entry.agent_id ? ' 🔀' : '')));
  }

  return content;
}

function buildCommandDetail(item, entries) {
  const content = [];
  content.push(e(Text, { bold: true, key: 'title' }, '── COMMAND DETAIL ──'));
  content.push(e(Text, { key: 'title-sp' }, ' '));

  for (let idx = 0; idx < entries.length; idx++) {
    const entry = entries[idx];
    content.push(e(Text, { key: `c-${idx}` }, formatTime(entry.at) + '  ' + entry.cmd + (entry.agent_id ? ' 🔀' : '')));
    content.push(e(Text, { key: `sp-${idx}` }, ' '));
  }

  return content;
}

function buildChronologyDetail(entries, sortMode, timeFormat) {
  const sorted = [...entries];
  if (sortMode === 'alpha') {
    sorted.sort((a, b) => {
      const pa = (a.path || a.cmd || '');
      const pb = (b.path || b.cmd || '');
      const cmp = pa.localeCompare(pb);
      if (cmp !== 0) return cmp;
      const ta = a.at ? new Date(a.at).getTime() : 0;
      const tb = b.at ? new Date(b.at).getTime() : 0;
      return ta - tb;
    });
  } else {
    sorted.sort((a, b) => {
      const ta = a.at ? new Date(a.at).getTime() : 0;
      const tb = b.at ? new Date(b.at).getTime() : 0;
      return ta - tb;
    });
  }

  const content = [];
  content.push(e(Text, { bold: true, key: 'chrono-title' }, '── CHRONOLOGY ──'));
  content.push(e(Text, { key: 'chrono-spacer' }, ''));

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    const time = timeFormat === 'relative'
      ? formatRelativeTime(entry.at)
      : formatTime(entry.at);
    const typePad = entry.type.padEnd(5);
    const display = entry.path || entry.cmd || '';
    let indicators = '';
    if (entry.type === 'WRITE' && entry.is_new) indicators += ' *';
    if (entry.agent_id) indicators += ' 🔀';
    const colorProps = CHRONO_COLORS[entry.type] || {};
    content.push(e(Text, { ...colorProps, key: `chrono-${i}` },
      `${time}  ${typePad}  ${display}${indicators}`));
  }

  return content;
}

export function MonitorDetailScreen({ item, entries, onBack, isActive, sortMode = 'chrono', timeFormat = 'absolute', onToggleSort, onToggleTime }) {
  const [scrollOffset, setScrollOffset] = useState(0);
  const { stdout } = useStdout();
  const rows = (stdout && stdout.rows) || 24;
  const viewportHeight = Math.max(1, rows - 4);

  const isChrono = item.type === 'chronology';
  const isWrite = item.type === 'file' && item.data?.op;
  const isRead = item.type === 'file' && !item.data?.op;

  const contentItems = isChrono
    ? buildChronologyDetail(entries, sortMode, timeFormat)
    : isWrite
      ? buildEditDetail(item, entries)
      : isRead
        ? buildReadDetail(item, entries)
        : buildCommandDetail(item, entries);

  useInput((input, key) => {
    if (key.upArrow) { setScrollOffset(prev => Math.max(0, prev - 1)); return; }
    if (key.downArrow) { setScrollOffset(prev => Math.min(Math.max(0, contentItems.length - viewportHeight), prev + 1)); return; }
    if (key.escape) { onBack(); return; }
    if (isChrono) {
      if (input === 's') { if (onToggleSort) onToggleSort(); setScrollOffset(0); return; }
      if (input === 't') { if (onToggleTime) onToggleTime(); setScrollOffset(0); return; }
    }
  }, { isActive });

  return e(Box, { flexDirection: 'column' },
    e(ScrollableViewport, { items: contentItems, height: viewportHeight, scrollOffset }),
    e(ShortcutBar, { actions: isChrono ? CHRONO_SHORTCUTS : DETAIL_PAGE_SHORTCUTS }),
  );
}
