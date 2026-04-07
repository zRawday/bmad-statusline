// FileTreeSection.js — Tree view for file sections (Pattern 23: no fs, Pattern 26: selectable items)

import React from 'react';
import { Text } from 'ink';
import { buildFileTree, renderTreeLines } from '../monitor-utils.js';

const e = React.createElement;

export function renderFileSection(label, entries) {
  if (!entries || entries.length === 0) return { elements: [], items: [] };

  const { inProject, outProject } = buildFileTree(entries);
  const items = [];

  // Section header
  items.push({ text: `── ${label} (${entries.length}) ──`, selectable: false, type: 'header' });
  items.push({ text: ' ', selectable: false, type: 'spacer' });

  // In-project tree lines
  items.push(...renderTreeLines(inProject));

  // Out-of-project flat paths
  for (const entry of outProject) {
    const text = entry.path;
    const indicators = [];
    if (entry.is_new) indicators.push({ text: ' *', color: 'green' });
    if (entry.agent_id !== null && entry.agent_id !== undefined) indicators.push({ text: ' \u{1F500}', color: 'cyan' });
    items.push({ text, indicators, selectable: true, type: 'file', data: entry });
  }

  // Mark the most recent file entry as latest
  let latestIdx = -1;
  let latestTime = 0;
  for (let i = 0; i < items.length; i++) {
    if (items[i].selectable && items[i].data && items[i].data.at) {
      const t = new Date(items[i].data.at).getTime();
      if (t > latestTime) { latestTime = t; latestIdx = i; }
    }
  }
  if (latestIdx >= 0) items[latestIdx].isLatest = true;

  // Convert to React elements
  const elements = items.map((item, i) => {
    const key = `${label}-${i}`;
    if (item.type === 'header') {
      return e(Text, { key, bold: true, backgroundColor: 'magenta', color: 'white' }, ` ${item.text} `);
    }
    if (item.type === 'spacer') {
      return e(Text, { key }, ' ');
    }
    if (item.type === 'dir') {
      return e(Text, { key }, item.treePrefix, e(Text, { dimColor: true }, item.dirName));
    }
    // file — with latest highlight and/or colored indicators
    const latestProps = item.isLatest ? { bold: true, color: 'cyan' } : {};
    if (item.indicators && item.indicators.length > 0) {
      return e(Text, { key, ...latestProps }, item.text,
        ...item.indicators.map((ind, j) => e(Text, { key: `${key}-i${j}`, color: ind.color }, ind.text)));
    }
    return e(Text, { key, ...latestProps }, item.text);
  });

  return { elements, items };
}
