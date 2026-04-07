// BashSection.js — Bash command section with dedup and color families (Pattern 23: no fs)

import React from 'react';
import { Text } from 'ink';
import { deduplicateCommands, getCommandFamily } from '../monitor-utils.js';

const e = React.createElement;

export function renderBashSection(commands) {
  if (!commands || commands.length === 0) return { elements: [], items: [] };

  const groups = deduplicateCommands(commands);
  const items = [];

  // Section header
  items.push({ text: `── COMMANDS (${groups.length}) ──`, selectable: false, type: 'header' });
  items.push({ text: ' ', selectable: false, type: 'spacer' });

  // Mark latest command group
  let latestIdx = -1;
  let latestTime = 0;
  for (let gi = 0; gi < groups.length; gi++) {
    const t = groups[gi].lastAt ? new Date(groups[gi].lastAt).getTime() : 0;
    if (t > latestTime) { latestTime = t; latestIdx = gi; }
  }

  // Command lines — split multi-line commands (heredocs) into continuation items
  // so each viewport row = 1 item (prevents Ink scroll desync).
  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const lines = group.cmd.split('\n');
    let firstText = `$ ${lines[0]}`;
    if (group.count > 1) firstText += ` (x${group.count})`;
    if (group.hasSubAgent) firstText += ' \u{1F500}';
    items.push({ text: firstText, selectable: true, type: 'command', data: group, isLatest: gi === latestIdx });
    for (let li = 1; li < lines.length; li++) {
      items.push({ text: `  ${lines[li]}`, selectable: false, type: 'continuation', data: group });
    }
  }

  // Convert to React elements
  const elements = items.map((item, i) => {
    const key = `cmd-${i}`;
    if (item.type === 'header') {
      return e(Text, { key, bold: true, backgroundColor: 'redBright', color: 'white' }, ` ${item.text} `);
    }
    if (item.type === 'spacer') {
      return e(Text, { key }, ' ');
    }
    // continuation lines — inherit parent command's color
    if (item.type === 'continuation') {
      const family = getCommandFamily(item.data.cmd);
      const props = { key, dimColor: true };
      if (family.color) props.color = family.color;
      return e(Text, props, item.text);
    }
    // command — apply color family, override with latest highlight
    if (item.isLatest) {
      return e(Text, { key, bold: true, color: 'cyan' }, item.text);
    }
    const family = getCommandFamily(item.data.cmd);
    const props = { key };
    if (family.dim) props.dimColor = true;
    else if (family.color) props.color = family.color;
    return e(Text, props, item.text);
  });

  return { elements, items };
}
