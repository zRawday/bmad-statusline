// LlmBadge.js — 4-state LLM badge: active, permission, waiting, inactive

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { formatElapsed } from '../monitor-utils.js';

const e = React.createElement;

const LLM_BADGE_CONFIG = {
  active:     { bgColor: 'green',       fgColor: 'white', icon: '\u2B24', label: 'ACTIVE' },
  permission: { bgColor: 'yellowBright', fgColor: 'black', icon: '\u2B24', label: 'PERMISSION' },
  waiting:    { bgColor: 'blueBright',   fgColor: 'white', icon: '\u2B24', label: 'WAITING' },
  inactive:   { color: 'grey',                             icon: '\u2B24', label: 'INACTIVE' },
};

function LlmBadge({ state, workflow, startedAt, contextLabel }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (state === 'inactive') return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [state]);

  const cfg = LLM_BADGE_CONFIG[state] || LLM_BADGE_CONFIG.inactive;
  const elapsed = formatElapsed(startedAt);
  const suffix = [workflow, elapsed].filter(Boolean).join(' ');

  if (!cfg.bgColor) {
    return e(Box, { flexDirection: 'row' },
      e(Text, { dimColor: true },
        ' ', e(Text, { color: cfg.color }, cfg.icon), `  ${cfg.label}`,
        suffix ? ` ${suffix}` : null, ' ',
      ),
      contextLabel ? e(Text, { dimColor: true }, `  ${contextLabel}`) : null,
    );
  }

  return e(Box, { flexDirection: 'row' },
    e(Text, { bold: true, backgroundColor: cfg.bgColor, color: cfg.fgColor },
      ' ', e(Text, { color: cfg.fgColor }, cfg.icon), `  ${cfg.label}`,
      suffix ? e(Text, { bold: false, backgroundColor: cfg.bgColor, color: cfg.fgColor }, ` ${suffix}`) : null,
      ' ',
    ),
    contextLabel ? e(Text, null, `  ${contextLabel}`) : null,
  );
}

export default LlmBadge;
