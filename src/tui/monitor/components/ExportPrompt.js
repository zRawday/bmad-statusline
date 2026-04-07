// ExportPrompt.js — Inline export mode selector (Pattern 23: no fs, pure React)

import React from 'react';
import { Text, useInput } from 'ink';

const e = React.createElement;

export function ExportPrompt({ onSelect, onCancel, isActive }) {
  useInput((input, key) => {
    if (input === 'l') { onSelect('light'); return; }
    if (input === 'f') { onSelect('full'); return; }
    if (key.escape) { onCancel(); return; }
  }, { isActive });

  return e(Text, null,
    e(Text, { bold: true }, 'Export:'),
    e(Text, null, '  '),
    e(Text, { bold: true }, 'l'),
    e(Text, { dimColor: true }, ' light'),
    e(Text, null, '  '),
    e(Text, { bold: true }, 'f'),
    e(Text, { dimColor: true }, ' full'),
    e(Text, null, '  '),
    e(Text, { bold: true }, 'Esc'),
    e(Text, { dimColor: true }, ' cancel'),
  );
}
