// AutoAllowMenu.js — Auto-allow toggle overlay (Pattern 2: synchronous I/O)

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import fs from 'node:fs';
import path from 'node:path';

const e = React.createElement;

function readSessionFlag(cachePath, sessionId) {
  try {
    return fs.readFileSync(path.join(cachePath, '.autoallow-' + sessionId), 'utf8').trim();
  } catch { return null; }
}

function readGlobalFlag(configDir) {
  try {
    const config = JSON.parse(fs.readFileSync(path.join(configDir, 'config.json'), 'utf8'));
    return config.autoAllow === true;
  } catch { return false; }
}

function writeSessionFlag(cachePath, sessionId, value) {
  try {
    if (value === null) {
      fs.unlinkSync(path.join(cachePath, '.autoallow-' + sessionId));
    } else {
      fs.writeFileSync(path.join(cachePath, '.autoallow-' + sessionId), value);
    }
  } catch {}
}

function writeGlobalFlag(configDir, value) {
  try {
    const configPath = path.join(configDir, 'config.json');
    let config = {};
    try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}
    config.autoAllow = value;
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  } catch {}
}

export function AutoAllowMenu({ sessionId, cachePath, configDir, isActive, onClose }) {
  const [cursor, setCursor] = useState(0);
  const [, forceRender] = useState(0);

  // Read current state on each render (synchronous, fast reads)
  const sessionFlag = readSessionFlag(cachePath, sessionId);
  const globalFlag = readGlobalFlag(configDir);

  // Compute effective display states
  let sessionDisplay, sessionSuffix;
  if (sessionFlag === 'on') {
    sessionDisplay = true;
    sessionSuffix = '';
  } else if (sessionFlag === 'off') {
    sessionDisplay = false;
    sessionSuffix = globalFlag ? ' (override)' : '';
  } else {
    // null — inherit from global
    sessionDisplay = globalFlag;
    sessionSuffix = '';
  }

  useInput((input, key) => {
    if (key.escape) { onClose(); return; }
    if (key.upArrow || key.downArrow) { setCursor(prev => prev === 0 ? 1 : 0); return; }
    if (key.return) {
      if (cursor === 0) {
        // Toggle "This session"
        if (sessionFlag === 'on') {
          // Turn off — if global is on, write explicit 'off'; otherwise delete
          writeSessionFlag(cachePath, sessionId, globalFlag ? 'off' : null);
        } else if (sessionFlag === 'off') {
          // Turn on — write explicit 'on'
          writeSessionFlag(cachePath, sessionId, 'on');
        } else {
          // null (inherited) — if global is on, override to off; if off, enable
          writeSessionFlag(cachePath, sessionId, globalFlag ? 'off' : 'on');
        }
      } else {
        // Toggle "Always"
        writeGlobalFlag(configDir, !globalFlag);
      }
      forceRender(n => n + 1);
      return;
    }
  }, { isActive });

  const row = (idx, label, isOn, suffix) => e(Box, { key: idx },
    e(Text, { color: 'cyan' }, cursor === idx ? '> ' : '  '),
    e(Text, null, label),
    e(Text, null, '    '),
    e(Text, { color: isOn ? 'green' : 'gray' }, isOn ? '* ON' : '  OFF'),
    suffix ? e(Text, { dimColor: true }, suffix) : null,
  );

  return e(Box, { flexDirection: 'column' },
    e(Text, { color: 'red', bold: true }, '\u26A0  WARNING'),
    e(Text, { dimColor: true }, 'All permission prompts will be approved automatically.'),
    e(Text, { dimColor: true }, 'Tools will execute without human review.'),
    e(Text, null, ' '),
    row(0, 'This session', sessionDisplay, sessionSuffix),
    row(1, 'Always      ', globalFlag, ''),
    e(Text, null, ' '),
    e(Text, { dimColor: true }, 'up/down navigate - Enter toggle - Esc close'),
  );
}
