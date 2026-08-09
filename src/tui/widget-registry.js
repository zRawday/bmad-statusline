// widget-registry.js — Widget metadata and config builder

import { SEPARATOR_VALUES } from '../defaults.js';

const INDIVIDUAL_WIDGETS = [
  { id: 'bmad-llmstate',    command: 'llmstate',    name: 'LLM State',     hint: 'LLM needs attention signal',           defaultEnabled: false, defaultColor: null,         defaultMode: 'dynamic' },
  { id: 'bmad-project',      command: 'project',      name: 'Project',       hint: 'Name from BMAD config.yaml',           defaultEnabled: true,  defaultColor: null,         defaultMode: 'dynamic' },
  { id: 'bmad-workflow',     command: 'workflow',     name: 'Initial Skill', hint: 'Skill invoked by user prompt',         defaultEnabled: true,  defaultColor: null,         defaultMode: 'dynamic' },
  { id: 'bmad-activeskill', command: 'activeskill', name: 'Active Skill',  hint: 'Skill actually running',               defaultEnabled: true,  defaultColor: null,         defaultMode: 'dynamic' },
  { id: 'bmad-story',        command: 'story',        name: 'Story',         hint: 'create-story, dev-story, code-review', defaultEnabled: true,  defaultColor: 'magenta',    defaultMode: 'fixed' },
  { id: 'bmad-docname',      command: 'docname',      name: 'Document',      hint: 'File being worked on in output folders', defaultEnabled: true,  defaultColor: 'brightYellow', defaultMode: 'fixed' },
  { id: 'bmad-progressstep', command: 'progressstep', name: 'Step',          hint: 'Skills with BMAD /step format only',   defaultEnabled: true,  defaultColor: 'brightCyan', defaultMode: 'fixed' },
  { id: 'bmad-nextstep',     command: 'nextstep',     name: 'Next Step',     hint: 'Skills with BMAD /step format only',   defaultEnabled: false, defaultColor: 'yellow',     defaultMode: 'fixed' },
  { id: 'bmad-fileread',     command: 'fileread',     name: 'File Read',     hint: 'Last file read by LLM',                  defaultEnabled: false, defaultColor: 'cyan',        defaultMode: 'fixed' },
  { id: 'bmad-filewrite',    command: 'filewrite',    name: 'File Edit/Write', hint: 'Last file written or edited',          defaultEnabled: false, defaultColor: 'brightRed',   defaultMode: 'fixed' },
  { id: 'bmad-contextpct',   command: 'contextpct',   name: 'Context %',     hint: 'Context window usage',                    defaultEnabled: true,  defaultColor: null,          defaultMode: 'dynamic' },
  { id: 'bmad-timer',        command: 'timer',        name: 'Timer',         hint: 'Refreshes only while LLM is active',     defaultEnabled: true,  defaultColor: 'brightBlack', defaultMode: 'fixed' },
  { id: 'bmad-weeklyusage',  command: 'weeklyusage',  name: 'Weekly Usage',  hint: 'Claude plan weekly consumption vs week elapsed (subscribers)', defaultEnabled: false, defaultColor: null,          defaultMode: 'dynamic' },
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
  // contextpct is default-enabled but segregated onto its own line (line 2) below.
  const widgetsLine0 = widgets.filter(w => w.id !== 'bmad-contextpct');
  const colorModes = {};
  for (const w of widgets) {
    colorModes[w.id] = w.defaultMode === 'dynamic'
      ? { mode: 'dynamic' }
      : { mode: 'fixed', fixedColor: w.defaultColor };
  }
  const colorModesLine0 = { ...colorModes };
  delete colorModesLine0['bmad-contextpct'];
  return {
    separator: 'modere',
    customSeparator: null,
    lines: [
      { widgets: widgetsLine0.map(w => w.id), widgetOrder: [...allIds], colorModes: colorModesLine0 },
      // llmstate is hidden by default but keeps a colorMode so its color survives a
      // show/hide cycle — the schema explicitly allows colorModes for hidden widgets.
      { widgets: ['bmad-weeklyusage'], widgetOrder: [...allIds], colorModes: { 'bmad-llmstate': { mode: 'dynamic' }, 'bmad-weeklyusage': { mode: 'dynamic', displayMode: 'extended' } } },
      { widgets: ['bmad-contextpct'], widgetOrder: [...allIds], colorModes: { 'bmad-contextpct': { mode: 'dynamic', thresholdLow: 0, thresholdHigh: 100, displayMode: 'compact' } } },
    ],
    skillColors: {},
    projectColors: {},
    presets: [null, null, null],
  };
}
