// ThreeLinePreview.js — Renders 3-line boxed preview with ANSI colors (pattern 3, 19)

import React from 'react';
import { Box, Text } from 'ink';
import { SAMPLE_VALUES, SEPARATOR_MAP, resolvePreviewColor, toInkColor } from '../preview-utils.js';

const e = React.createElement;

function renderLine(line, separator, lineIndex) {
  const label = e(Text, { key: `label-${lineIndex}`, dimColor: true }, `Line ${lineIndex + 1} `);
  if (!line.widgets || line.widgets.length === 0) {
    return e(Text, { key: lineIndex }, label, e(Text, { dimColor: true }, '(empty)'));
  }
  const segments = [label];
  for (const widgetId of line.widgets) {
    const value = SAMPLE_VALUES[widgetId];
    if (!value) continue;
    const color = resolvePreviewColor(widgetId, line.colorModes);
    if (segments.length > 1) segments.push(e(Text, { key: `sep-${widgetId}` }, separator));
    if ((widgetId === 'bmad-fileread' || widgetId === 'bmad-filewrite') && value.includes(' ')) {
      const sp = value.indexOf(' ');
      segments.push(e(Text, { key: widgetId },
        e(Text, { color: 'white' }, value.substring(0, sp)),
        e(Text, { color: toInkColor(color) }, value.substring(sp)),
      ));
    } else {
      segments.push(e(Text, { key: widgetId, color: toInkColor(color) }, value));
    }
  }
  return e(Text, { key: lineIndex }, ...segments);
}

export function ThreeLinePreview({ config }) {
  const separator = config.separator === 'custom' && config.customSeparator
    ? config.customSeparator
    : (SEPARATOR_MAP[config.separator] || SEPARATOR_MAP.modere);

  return e(Box, { flexDirection: 'column' },
    e(Text, null, '  Preview'),
    e(Box, { borderStyle: 'round', borderColor: 'dim', flexDirection: 'column' },
      ...config.lines.map((line, i) => renderLine(line, separator, i))
    )
  );
}
