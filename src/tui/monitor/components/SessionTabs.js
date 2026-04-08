// SessionTabs.js — Two-level tab navigation: project tabs + session sub-tabs

import React from 'react';
import { Box, Text } from 'ink';
import { resolveProjectColor, resolveSessionColor, worstState, computeDisplayState, STORY_WORKFLOWS, extractStoryNumber } from '../monitor-utils.js';

const e = React.createElement;

const STATE_ICONS = {
  active:            { icon: '\u2B24', color: 'green' },
  permission:        { icon: '\u2B24', color: 'yellowBright' },
  waiting:           { icon: '\u2B24', color: 'blueBright' },
  error:             { icon: '\u2B24', color: 'red' },
  interrupted:       { icon: '\u2B24', color: 'yellow' },
  inactive:          { icon: '\u2B24', color: 'grey' },
  'active:subagent': { icon: '\u2B24', color: 'cyan' },
};

function SessionTabs({ groups, activeProject, activeSessionIndex, config, mode, reorderTarget, reorderCursor, reorderGrabbed }) {
  if (mode === 'single-session') return null;

  const projectKeys = [...groups.keys()];
  const reorderingSessions = reorderTarget === 'sessions';
  const reorderingProjects = reorderTarget === 'projects';

  // Session sub-tabs — shown in both multi-project (below project row) and single-project (as primary)
  const projectSessions = groups.get(activeProject) || [];
  const sessionRow = e(Box, { key: 'session-row', flexDirection: 'row', gap: 1 },
    ...projectSessions.map((s, i) => {
      const isCursor = reorderingSessions && i === reorderCursor;
      const isGrabbed = isCursor && reorderGrabbed;
      const isActive = reorderingSessions ? isCursor : (i === activeSessionIndex);
      const baseLabel = s.workflow || s.skill || s.sessionId;
      const storyNum = STORY_WORKFLOWS.includes(s.workflow) ? extractStoryNumber(s.story) : '';
      const label = storyNum ? `${baseLabel} ${storyNum}` : baseLabel;
      const color = resolveSessionColor(baseLabel, config);
      const state = STATE_ICONS[computeDisplayState(s)] || STATE_ICONS.inactive;
      const suffix = isGrabbed ? ' \u25C2' : '';
      return e(Text, {
        key: s.sessionId || `s-${i}`,
        color: isActive ? color : undefined,
        dimColor: !isActive,
        bold: isActive,
        underline: isActive && !isGrabbed,
      }, '[', e(Text, { color: state.color }, state.icon), ` ${label}]${suffix}`);
    }),
  );

  if (mode === 'single-project') {
    return sessionRow;
  }

  // Multi-project: project tabs row + session sub-tabs row
  const projectRow = e(Box, { key: 'project-row', flexDirection: 'row', gap: 1 },
    ...projectKeys.map((pKey, i) => {
      const isCursor = reorderingProjects && i === reorderCursor;
      const isGrabbed = isCursor && reorderGrabbed;
      const isActive = reorderingProjects ? isCursor : (pKey === activeProject);
      const color = resolveProjectColor(pKey, config);
      const pSessions = groups.get(pKey) || [];
      const state = STATE_ICONS[worstState(pSessions)] || STATE_ICONS.inactive;
      const suffix = isGrabbed ? ' \u25C2' : '';
      return e(Text, {
        key: pKey,
        color: isActive ? color : undefined,
        dimColor: !isActive,
        bold: isActive,
        underline: isActive && !isGrabbed,
      }, '[', e(Text, { color: state.color }, state.icon), ` ${pKey}]${suffix}`);
    }),
  );

  return e(Box, { flexDirection: 'column' },
    projectRow,
    e(Text, null, ' '),
    sessionRow,
  );
}

export default SessionTabs;
