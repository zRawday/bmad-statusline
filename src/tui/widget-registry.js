// widget-registry.js — Widget metadata and config builder

import { WORKFLOW_COLORS, SEPARATOR_VALUES } from '../defaults.js';

const INDIVIDUAL_WIDGETS = [
  { id: 'bmad-llmstate',    command: 'llmstate',    name: 'LLM State',     hint: 'LLM needs attention signal',           defaultEnabled: true,  defaultColor: null,         defaultMode: 'dynamic' },
  { id: 'bmad-project',      command: 'project',      name: 'Project',       hint: 'Name from BMAD config.yaml',           defaultEnabled: true,  defaultColor: null,         defaultMode: 'dynamic' },
  { id: 'bmad-workflow',     command: 'workflow',     name: 'Initial Skill', hint: 'Skill invoked by user prompt',         defaultEnabled: true,  defaultColor: null,         defaultMode: 'dynamic' },
  { id: 'bmad-activeskill', command: 'activeskill', name: 'Active Skill',  hint: 'Skill actually running',               defaultEnabled: false, defaultColor: null,         defaultMode: 'dynamic' },
  { id: 'bmad-story',        command: 'story',        name: 'Story',         hint: 'create-story, dev-story, code-review', defaultEnabled: true,  defaultColor: 'magenta',    defaultMode: 'fixed' },
  { id: 'bmad-docname',      command: 'docname',      name: 'Document',      hint: 'File being worked on in output folders', defaultEnabled: false, defaultColor: 'brightYellow', defaultMode: 'fixed' },
  { id: 'bmad-progressstep', command: 'progressstep', name: 'Step',          hint: 'Skills with BMAD /step format only',   defaultEnabled: true,  defaultColor: 'brightCyan', defaultMode: 'fixed' },
  { id: 'bmad-nextstep',     command: 'nextstep',     name: 'Next Step',     hint: 'Skills with BMAD /step format only',   defaultEnabled: false, defaultColor: 'yellow',     defaultMode: 'fixed' },
  { id: 'bmad-fileread',     command: 'fileread',     name: 'File Read',     hint: 'Last file read by LLM',                  defaultEnabled: false, defaultColor: 'cyan',        defaultMode: 'fixed' },
  { id: 'bmad-filewrite',    command: 'filewrite',    name: 'File Edit/Write', hint: 'Last file written or edited',          defaultEnabled: false, defaultColor: 'brightRed',   defaultMode: 'fixed' },
  { id: 'bmad-timer',        command: 'timer',        name: 'Timer',         hint: 'Refreshes only while LLM is active',     defaultEnabled: true,  defaultColor: 'brightBlack', defaultMode: 'fixed' },
];

export { SEPARATOR_VALUES };

export const ANSI_COLORS = [
  'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
  'brightRed', 'brightGreen', 'brightYellow', 'brightBlue',
  'brightMagenta', 'brightCyan', 'brightWhite', 'brightBlack',
];

export function getIndividualWidgets() {
  return INDIVIDUAL_WIDGETS.map(w => ({ ...w }));
}

export function createDefaultConfig() {
  const allIds = INDIVIDUAL_WIDGETS.map(w => w.id);
  const widgets = INDIVIDUAL_WIDGETS.filter(w => w.defaultEnabled);
  const widgetsLine1 = widgets.filter(w => w.id !== 'bmad-llmstate');
  const colorModes = {};
  for (const w of widgets) {
    colorModes[w.id] = w.defaultMode === 'dynamic'
      ? { mode: 'dynamic' }
      : { mode: 'fixed', fixedColor: w.defaultColor };
  }
  const colorModesLine1 = { ...colorModes };
  delete colorModesLine1['bmad-llmstate'];
  return {
    separator: 'modere',
    customSeparator: null,
    lines: [
      { widgets: widgetsLine1.map(w => w.id), widgetOrder: [...allIds], colorModes: colorModesLine1 },
      { widgets: ['bmad-llmstate'], widgetOrder: [...allIds], colorModes: { 'bmad-llmstate': { mode: 'dynamic' } } },
      { widgets: [], widgetOrder: [...allIds], colorModes: {} },
    ],
    skillColors: {},
    projectColors: {},
    presets: [null, null, null],
  };
}
