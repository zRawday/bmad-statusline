// ScreenLayout.js — Vertical layout wrapper for all screens (global header, preview, screen label)

import React from 'react';
import { Box, Text } from 'ink';
import { ShortcutBar } from './ShortcutBar.js';
import { ThreeLinePreview } from './ThreeLinePreview.js';

const e = React.createElement;

function Header() {
  return e(Box, { flexDirection: 'column', marginBottom: 1 },
    e(Text, null,
      e(Text, { color: 'cyan', bold: true }, '\u2726 BMAD-STATUSLINE'),
      e(Text, { dimColor: true }, '  \u2014  Claude Code status bar configurator'),
    ),
    e(Text, { color: 'yellow' }, 'Custom BMAD widgets for ccstatusline & real-time session monitor'),
    e(Text, { dimColor: true }, 'Works with BMAD 6.2.2+'),
  );
}

export function ScreenLayout({ screenName, screenColor, config, previewOverride, shortcuts, children }) {
  const effectiveConfig = previewOverride || config;
  return e(Box, { flexDirection: 'column' },
    e(Header),
    e(ThreeLinePreview, { config: effectiveConfig }),
    e(Text, null, ' '),
    screenName ? e(Text, { bold: true, color: screenColor }, screenName) : null,
    e(Text, null, ' '),
    children,
    e(Text, null, ' '),
    e(ShortcutBar, { actions: shortcuts }),
  );
}
