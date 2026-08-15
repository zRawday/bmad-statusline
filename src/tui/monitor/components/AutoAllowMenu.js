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

function writeSessionFlag(cachePath, sessionId, value) {
  try {
    if (value === null) {
      fs.unlinkSync(path.join(cachePath, '.autoallow-' + sessionId));
    } else {
      fs.writeFileSync(path.join(cachePath, '.autoallow-' + sessionId), value);
    }
  } catch {}
}

// The global flag is App-owned config state, reached through setAutoAllow — this
// component must NEVER write config.json itself. App loads the config once and
// full-replaces the file on quit and on every edit, so a direct write here is
// silently reverted; turning the flag off and quitting would restore autoAllow:true
// while the user believes machine-wide auto-approval is off. The per-session
// .autoallow-{sid} flag is not App-owned and stays a direct cache write.
export function AutoAllowMenu({ sessionId, cachePath, globalFlag: globalFlagProp, setAutoAllow, isActive, onClose }) {
  const [cursor, setCursor] = useState(0);
  const [, forceRender] = useState(0);

  const globalFlag = globalFlagProp === true;
  // Session flag is read on each render (synchronous, fast read)
  const sessionFlag = readSessionFlag(cachePath, sessionId);

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
        // Toggle "Always" — through App-owned config, never a direct disk write
        if (setAutoAllow) setAutoAllow(!globalFlag);
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
    // The hook allows only its allowlisted tools — a banner that promised more than
    // that would be a defect. Keep this wording in step with AUTO_ALLOW_TOOLS, and
    // keep the scope line: "Always" is machine-wide, which is what made the
    // allowlist necessary in the first place.
    e(Text, { dimColor: true }, 'Only Bash, Read, Write, Edit, Glob, Grep, WebFetch and mcp__* tools'),
    e(Text, { dimColor: true }, 'have their permission prompts approved automatically, without review.'),
    e(Text, { dimColor: true }, '"Always" applies to every session on this machine, in any directory.'),
    e(Text, null, ' '),
    row(0, 'This session', sessionDisplay, sessionSuffix),
    row(1, 'Always      ', globalFlag, ''),
    e(Text, null, ' '),
    e(Text, { dimColor: true }, 'up/down navigate - Enter toggle - Esc close'),
  );
}
