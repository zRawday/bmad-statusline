// ProjectColorsScreen.js — Per-project color picker with cache-based detection

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ScreenLayout } from '../components/ScreenLayout.js';
import { ANSI_COLORS } from '../widget-registry.js';
import { hashProjectColor } from '../../defaults.js';
import { toInkColor } from '../preview-utils.js';

const e = React.createElement;

const CACHE_DIR = process.env.BMAD_CACHE_DIR || path.join(os.homedir(), '.cache', 'bmad-status');

const SHORTCUTS = [
  { key: '\u2191\u2193', label: 'Navigate' },
  { key: '\u2190\u2192', label: 'Color' },
  { key: 'd', label: 'Default' },
  { key: 'Esc', label: 'Back' },
];

// hashProjectColor imported from defaults.js

function detectProjects() {
  try {
    const files = fs.readdirSync(CACHE_DIR);
    const projects = new Map();
    for (const file of files) {
      if (!file.startsWith('status-') || !file.endsWith('.json')) continue;
      const sid = file.slice(7, -5);
      try {
        const raw = fs.readFileSync(path.join(CACHE_DIR, file), 'utf8');
        const status = JSON.parse(raw);
        if (!status.project) continue;
        const alive = files.includes(`.alive-${sid}`);
        const existing = projects.get(status.project);
        if (!existing || (!existing.alive && alive)) {
          projects.set(status.project, { name: status.project, alive });
        }
      } catch { /* skip corrupt files */ }
    }
    const list = [...projects.values()];
    list.sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return list;
  } catch {
    return [];
  }
}

function getProjectColor(projectColors, name) {
  if (projectColors && projectColors[name]) return projectColors[name];
  return hashProjectColor(name);
}

export function ProjectColorsScreen({ config, updateConfig, previewOverride, goBack, isActive }) {
  const [projects] = useState(() => detectProjects());
  const [cursor, setCursor] = useState(0);

  const projectColors = config.projectColors || {};

  useInput((input, key) => {
    if (!isActive) return;

    if (key.upArrow) {
      setCursor(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setCursor(prev => Math.min(projects.length - 1, prev + 1));
    } else if (key.leftArrow || key.rightArrow) {
      const project = projects[cursor];
      if (!project) return;
      const current = getProjectColor(projectColors, project.name);
      const idx = ANSI_COLORS.indexOf(current);
      const nextIdx = key.rightArrow
        ? (idx + 1) % ANSI_COLORS.length
        : (idx - 1 + ANSI_COLORS.length) % ANSI_COLORS.length;
      updateConfig(cfg => {
        if (!cfg.projectColors) cfg.projectColors = {};
        cfg.projectColors[project.name] = ANSI_COLORS[nextIdx];
      });
    } else if (input === 'd') {
      const project = projects[cursor];
      if (!project) return;
      updateConfig(cfg => {
        if (cfg.projectColors) {
          delete cfg.projectColors[project.name];
        }
      });
    } else if (key.escape) {
      goBack();
    }
  }, { isActive });

  if (projects.length === 0) {
    return e(ScreenLayout, {
      screenName: 'Project Colors',
      screenColor: 'yellow',
      config,
      previewOverride,
      shortcuts: [{ key: 'Esc', label: 'Back' }],
    },
      e(Box, { flexDirection: 'column' },
        e(Text, { dimColor: true }, 'No BMAD projects detected in cache.'),
        e(Text, { dimColor: true }, 'Projects appear here after running a BMAD skill.'),
      ),
    );
  }

  return e(ScreenLayout, {
    screenName: 'Project Colors',
    screenColor: 'yellow',
    config,
    previewOverride,
    shortcuts: SHORTCUTS,
  },
    e(Box, { flexDirection: 'column' },
      ...projects.map((project, i) => {
        const prefix = i === cursor ? '> ' : '  ';
        const currentColor = getProjectColor(projectColors, project.name);
        const isCustom = !!projectColors[project.name];
        return e(Text, { key: project.name },
          prefix,
          e(Text, { color: toInkColor(currentColor) }, project.name.padEnd(30)),
          e(Text, { dimColor: true }, `  ${currentColor}`),
          isCustom ? e(Text, { dimColor: true }, '  *') : null,
          project.alive ? e(Text, { color: 'green' }, '  \u25CF') : null,
        );
      }),
    ),
  );
}
