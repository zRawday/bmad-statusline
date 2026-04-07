// ShortcutBar.js — Dim text shortcut bar with bold keys and optional color categories

import React from 'react';
import { Text } from 'ink';

const e = React.createElement;

export function ShortcutBar({ actions }) {
  const parts = [];
  for (let i = 0; i < actions.length; i++) {
    if (i > 0) parts.push(e(Text, { key: `sp-${i}`, dimColor: true }, '  '));
    const a = actions[i];
    if (a.color) {
      parts.push(e(Text, { key: `k-${i}`, color: a.color, bold: true }, a.key));
      parts.push(e(Text, { key: `l-${i}`, color: a.color }, ` ${a.label}`));
    } else {
      parts.push(e(Text, { key: `k-${i}`, bold: true }, a.key));
      parts.push(e(Text, { key: `l-${i}`, dimColor: true }, ` ${a.label}`));
    }
    if (a.checked !== undefined) {
      parts.push(a.checked
        ? e(Text, { key: `st-${i}`, color: a.color || undefined, bold: true }, ' ON')
        : e(Text, { key: `st-${i}`, dimColor: true }, ' OFF'));
    }
  }
  return e(Text, null, ...parts);
}
