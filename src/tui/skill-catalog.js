// skill-catalog.js — Complete BMAD skill catalog organized by module
// Workflow names = what the hook writes to status.workflow (prefix stripped)
// Default colors by semantic category

export const SKILL_MODULES = [
  {
    id: 'core', name: 'Core', skills: [
      { workflow: 'advanced-elicitation', defaultColor: 'white' },
      { workflow: 'brainstorming', defaultColor: 'brightYellow' },
      { workflow: 'distillator', defaultColor: 'white' },
      { workflow: 'editorial-review-prose', defaultColor: 'white' },
      { workflow: 'editorial-review-structure', defaultColor: 'white' },
      { workflow: 'help', defaultColor: 'white' },
      { workflow: 'index-docs', defaultColor: 'brightGreen' },
      { workflow: 'init', defaultColor: 'white' },
      { workflow: 'party-mode', defaultColor: 'brightYellow' },
      { workflow: 'review-adversarial-general', defaultColor: 'brightRed' },
      { workflow: 'review-edge-case-hunter', defaultColor: 'brightRed' },
      { workflow: 'shard-doc', defaultColor: 'white' },
    ],
  },
  {
    id: 'bmb', name: 'Builder (BMB)', skills: [
      { workflow: 'agent-builder', defaultColor: 'brightCyan' },
      { workflow: 'builder-setup', defaultColor: 'cyan' },
      { workflow: 'module-builder', defaultColor: 'brightGreen' },
      { workflow: 'workflow-builder', defaultColor: 'green' },
    ],
  },
  {
    id: 'bmm', name: 'Main (BMM)', skills: [
      { workflow: 'agent-analyst', defaultColor: 'blue' },
      { workflow: 'agent-architect', defaultColor: 'magenta' },
      { workflow: 'agent-dev', defaultColor: 'cyan' },
      { workflow: 'agent-pm', defaultColor: 'yellow' },
      { workflow: 'agent-qa', defaultColor: 'red' },
      { workflow: 'agent-quick-flow-solo-dev', defaultColor: 'brightCyan' },
      { workflow: 'agent-sm', defaultColor: 'green' },
      { workflow: 'agent-tech-writer', defaultColor: 'white' },
      { workflow: 'agent-ux-designer', defaultColor: 'brightMagenta' },
      { workflow: 'check-implementation-readiness', defaultColor: 'green' },
      { workflow: 'code-review', defaultColor: 'brightRed' },
      { workflow: 'correct-course', defaultColor: 'green' },
      { workflow: 'create-architecture', defaultColor: 'magenta' },
      { workflow: 'create-epics-and-stories', defaultColor: 'green' },
      { workflow: 'create-prd', defaultColor: 'yellow' },
      { workflow: 'create-story', defaultColor: 'green' },
      { workflow: 'create-ux-design', defaultColor: 'magenta' },
      { workflow: 'dev-story', defaultColor: 'cyan' },
      { workflow: 'document-project', defaultColor: 'brightGreen' },
      { workflow: 'domain-research', defaultColor: 'blue' },
      { workflow: 'edit-prd', defaultColor: 'yellow' },
      { workflow: 'generate-project-context', defaultColor: 'brightGreen' },
      { workflow: 'market-research', defaultColor: 'blue' },
      { workflow: 'product-brief', defaultColor: 'yellow' },
      { workflow: 'qa-generate-e2e-tests', defaultColor: 'red' },
      { workflow: 'quick-dev', defaultColor: 'cyan' },
      { workflow: 'retrospective', defaultColor: 'brightYellow' },
      { workflow: 'sprint-planning', defaultColor: 'green' },
      { workflow: 'sprint-status', defaultColor: 'green' },
      { workflow: 'technical-research', defaultColor: 'blue' },
      { workflow: 'validate-prd', defaultColor: 'yellow' },
    ],
  },
  {
    id: 'cis', name: 'Creative (CIS)', skills: [
      { workflow: 'cis-agent-brainstorming-coach', defaultColor: 'brightYellow' },
      { workflow: 'cis-agent-creative-problem-solver', defaultColor: 'brightWhite' },
      { workflow: 'cis-agent-design-thinking-coach', defaultColor: 'brightGreen' },
      { workflow: 'cis-agent-innovation-strategist', defaultColor: 'brightBlue' },
      { workflow: 'cis-agent-presentation-master', defaultColor: 'yellow' },
      { workflow: 'cis-agent-storyteller', defaultColor: 'brightMagenta' },
      { workflow: 'cis-design-thinking', defaultColor: 'green' },
      { workflow: 'cis-innovation-strategy', defaultColor: 'blue' },
      { workflow: 'cis-problem-solving', defaultColor: 'magenta' },
      { workflow: 'cis-storytelling', defaultColor: 'cyan' },
    ],
  },
  {
    id: 'tea', name: 'Test (TEA)', skills: [
      { workflow: 'tea', defaultColor: 'red' },
      { workflow: 'teach-me-testing', defaultColor: 'brightRed' },
      { workflow: 'testarch-atdd', defaultColor: 'yellow' },
      { workflow: 'testarch-automate', defaultColor: 'brightYellow' },
      { workflow: 'testarch-ci', defaultColor: 'green' },
      { workflow: 'testarch-framework', defaultColor: 'magenta' },
      { workflow: 'testarch-nfr', defaultColor: 'blue' },
      { workflow: 'testarch-test-design', defaultColor: 'cyan' },
      { workflow: 'testarch-test-review', defaultColor: 'brightCyan' },
      { workflow: 'testarch-trace', defaultColor: 'brightGreen' },
    ],
  },
  {
    id: 'gds', name: 'Game Dev (GDS)', skills: [
      { workflow: 'agent-game-architect', defaultColor: 'magenta' },
      { workflow: 'agent-game-designer', defaultColor: 'yellow' },
      { workflow: 'agent-game-dev', defaultColor: 'cyan' },
      { workflow: 'agent-game-qa', defaultColor: 'red' },
      { workflow: 'agent-game-scrum-master', defaultColor: 'green' },
      { workflow: 'agent-game-solo-dev', defaultColor: 'brightCyan' },
      { workflow: 'agent-tech-writer', defaultColor: 'white' },
      { workflow: 'brainstorm-game', defaultColor: 'brightYellow' },
      { workflow: 'check-implementation-readiness', defaultColor: 'green' },
      { workflow: 'code-review', defaultColor: 'brightRed' },
      { workflow: 'correct-course', defaultColor: 'green' },
      { workflow: 'create-epics-and-stories', defaultColor: 'green' },
      { workflow: 'create-game-brief', defaultColor: 'yellow' },
      { workflow: 'create-gdd', defaultColor: 'yellow' },
      { workflow: 'create-narrative', defaultColor: 'brightYellow' },
      { workflow: 'create-story', defaultColor: 'green' },
      { workflow: 'create-ux-design', defaultColor: 'magenta' },
      { workflow: 'dev-story', defaultColor: 'cyan' },
      { workflow: 'document-project', defaultColor: 'brightGreen' },
      { workflow: 'domain-research', defaultColor: 'blue' },
      { workflow: 'e2e-scaffold', defaultColor: 'red' },
      { workflow: 'game-architecture', defaultColor: 'magenta' },
      { workflow: 'generate-project-context', defaultColor: 'brightGreen' },
      { workflow: 'performance-test', defaultColor: 'red' },
      { workflow: 'playtest-plan', defaultColor: 'brightYellow' },
      { workflow: 'quick-dev', defaultColor: 'cyan' },
      { workflow: 'quick-dev-new-preview', defaultColor: 'cyan' },
      { workflow: 'quick-spec', defaultColor: 'cyan' },
      { workflow: 'retrospective', defaultColor: 'brightYellow' },
      { workflow: 'sprint-planning', defaultColor: 'green' },
      { workflow: 'sprint-status', defaultColor: 'green' },
      { workflow: 'test-automate', defaultColor: 'red' },
      { workflow: 'test-design', defaultColor: 'red' },
      { workflow: 'test-framework', defaultColor: 'red' },
      { workflow: 'test-review', defaultColor: 'red' },
    ],
  },
  {
    id: 'wds', name: 'Web Design (WDS)', skills: [
      { workflow: '0-alignment-signoff', defaultColor: 'brightBlue' },
      { workflow: '0-project-setup', defaultColor: 'blue' },
      { workflow: '1-project-brief', defaultColor: 'cyan' },
      { workflow: '2-trigger-mapping', defaultColor: 'green' },
      { workflow: '3-scenarios', defaultColor: 'yellow' },
      { workflow: '4-ux-design', defaultColor: 'magenta' },
      { workflow: '5-agentic-development', defaultColor: 'brightCyan' },
      { workflow: '6-asset-generation', defaultColor: 'brightYellow' },
      { workflow: '7-design-system', defaultColor: 'brightMagenta' },
      { workflow: '8-product-evolution', defaultColor: 'brightGreen' },
      { workflow: 'agent-freya-ux', defaultColor: 'brightBlue' },
      { workflow: 'agent-saga-analyst', defaultColor: 'blue' },
    ],
  },
];

/**
 * Get the default color for a workflow name.
 * Returns color name string or null if not in catalog.
 */
export function getDefaultSkillColor(workflow) {
  for (const mod of SKILL_MODULES) {
    const skill = mod.skills.find(s => s.workflow === workflow);
    if (skill) return skill.defaultColor;
  }
  return null;
}
