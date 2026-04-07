// SkillColorsScreen.js — Two-level screen: module list → skill color picker

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { ScreenLayout } from '../components/ScreenLayout.js';
import { SKILL_MODULES, getDefaultSkillColor } from '../skill-catalog.js';
import { ANSI_COLORS } from '../widget-registry.js';
import { toInkColor } from '../preview-utils.js';

const e = React.createElement;

const MODULE_SHORTCUTS = [
  { key: '\u2191\u2193', label: 'Navigate' },
  { key: 'Enter', label: 'Select' },
  { key: 'Esc', label: 'Back' },
];

const SKILL_SHORTCUTS = [
  { key: '\u2191\u2193', label: 'Navigate' },
  { key: '\u2190\u2192', label: 'Color' },
  { key: 'd', label: 'Default' },
  { key: 'Esc', label: 'Back' },
];

function getSkillColor(skillColors, workflow, defaultColor) {
  if (skillColors && skillColors[workflow]) return skillColors[workflow];
  return defaultColor;
}

export function SkillColorsScreen({ config, updateConfig, previewOverride, navigate, goBack, isActive }) {
  const [selectedModule, setSelectedModule] = useState(null);
  const [moduleCursor, setModuleCursor] = useState(0);
  const [skillCursor, setSkillCursor] = useState(0);

  const skillColors = config.skillColors || {};

  useInput((input, key) => {
    if (!isActive) return;

    if (selectedModule === null) {
      // --- Module list ---
      if (key.upArrow) {
        setModuleCursor(prev => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setModuleCursor(prev => Math.min(SKILL_MODULES.length - 1, prev + 1));
      } else if (key.return) {
        setSelectedModule(SKILL_MODULES[moduleCursor]);
        setSkillCursor(0);
      } else if (key.escape) {
        goBack();
      }
    } else {
      // --- Skill list ---
      const skills = selectedModule.skills;
      if (key.upArrow) {
        setSkillCursor(prev => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setSkillCursor(prev => Math.min(skills.length - 1, prev + 1));
      } else if (key.leftArrow || key.rightArrow) {
        const skill = skills[skillCursor];
        if (!skill) return;
        const current = getSkillColor(skillColors, skill.workflow, skill.defaultColor);
        const idx = ANSI_COLORS.indexOf(current);
        const nextIdx = key.rightArrow
          ? (idx + 1) % ANSI_COLORS.length
          : (idx - 1 + ANSI_COLORS.length) % ANSI_COLORS.length;
        updateConfig(cfg => {
          if (!cfg.skillColors) cfg.skillColors = {};
          cfg.skillColors[skill.workflow] = ANSI_COLORS[nextIdx];
        });
      } else if (input === 'd') {
        const skill = skills[skillCursor];
        if (!skill) return;
        updateConfig(cfg => {
          if (cfg.skillColors) {
            delete cfg.skillColors[skill.workflow];
          }
        });
      } else if (key.escape) {
        setSelectedModule(null);
      }
    }
  }, { isActive });

  if (selectedModule === null) {
    // Module list view
    return e(ScreenLayout, {
      screenName: 'Skill Colors',
      screenColor: 'magenta',
      config,
      previewOverride,
      shortcuts: MODULE_SHORTCUTS,
    },
      e(Box, { flexDirection: 'column' },
        ...SKILL_MODULES.map((mod, i) => {
          const prefix = i === moduleCursor ? '> ' : '  ';
          const customCount = mod.skills.filter(s => skillColors[s.workflow]).length;
          const countLabel = customCount > 0 ? ` (${customCount} custom)` : '';
          return e(Text, { key: mod.id },
            prefix,
            e(Text, { bold: i === moduleCursor }, mod.name),
            e(Text, { dimColor: true }, `  ${mod.skills.length} skills${countLabel}`),
          );
        }),
      ),
    );
  }

  // Skill list view
  const skills = selectedModule.skills;
  return e(ScreenLayout, {
    screenName: `Skill Colors \u2014 ${selectedModule.name}`,
    screenColor: 'magenta',
    config,
    previewOverride,
    shortcuts: SKILL_SHORTCUTS,
  },
    e(Box, { flexDirection: 'column' },
      ...skills.map((skill, i) => {
        const prefix = i === skillCursor ? '> ' : '  ';
        const currentColor = getSkillColor(skillColors, skill.workflow, skill.defaultColor);
        const isCustom = !!skillColors[skill.workflow];
        return e(Text, { key: skill.workflow },
          prefix,
          e(Text, { color: toInkColor(currentColor) }, skill.workflow.padEnd(36)),
          e(Text, { dimColor: true }, `  ${currentColor}`),
          isCustom ? e(Text, { dimColor: true }, '  *') : null,
        );
      }),
    ),
  );
}
