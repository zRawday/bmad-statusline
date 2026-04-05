'use strict';

// Single source of truth for workflow and skill color maps.
// Shared between the reader (CJS) and defaults.js (ESM via createRequire).

const WORKFLOW_COLORS = {
  // Dev (cyan)
  'dev-story': '\x1b[36m',
  'quick-dev': '\x1b[36m',
  'quick-dev-new-preview': '\x1b[36m',
  'quick-spec': '\x1b[36m',
  // Review (brightRed)
  'code-review': '\x1b[91m',
  'review-adversarial-general': '\x1b[91m',
  'review-edge-case-hunter': '\x1b[91m',
  // Planning (green)
  'sprint-planning': '\x1b[32m',
  'sprint-status': '\x1b[32m',
  'create-story': '\x1b[32m',
  'create-epics': '\x1b[32m',
  'create-epics-and-stories': '\x1b[32m',
  'check-implementation-readiness': '\x1b[32m',
  'correct-course': '\x1b[32m',
  // Product (yellow)
  'create-prd': '\x1b[33m',
  'edit-prd': '\x1b[33m',
  'validate-prd': '\x1b[33m',
  'product-brief': '\x1b[33m',
  'create-game-brief': '\x1b[33m',
  'create-gdd': '\x1b[33m',
  // Architecture (magenta)
  'create-architecture': '\x1b[35m',
  'create-ux-design': '\x1b[35m',
  'game-architecture': '\x1b[35m',
  // Research (blue)
  'domain-research': '\x1b[34m',
  'technical-research': '\x1b[34m',
  'market-research': '\x1b[34m',
  // Agents — BMM (role-colored)
  'agent-analyst': '\x1b[34m',
  'agent-architect': '\x1b[35m',
  'agent-dev': '\x1b[36m',
  'agent-pm': '\x1b[33m',
  'agent-qa': '\x1b[31m',
  'agent-quick-flow-solo-dev': '\x1b[96m',
  'agent-sm': '\x1b[32m',
  'agent-ux-designer': '\x1b[95m',
  // Agents — GDS
  'agent-game-architect': '\x1b[35m',
  'agent-game-designer': '\x1b[33m',
  'agent-game-dev': '\x1b[36m',
  'agent-game-qa': '\x1b[31m',
  'agent-game-scrum-master': '\x1b[32m',
  'agent-game-solo-dev': '\x1b[96m',
  // Creative (brightYellow)
  'brainstorming': '\x1b[93m',
  'party-mode': '\x1b[93m',
  'retrospective': '\x1b[93m',
  'brainstorm-game': '\x1b[93m',
  'create-narrative': '\x1b[93m',
  'playtest-plan': '\x1b[93m',
  // Documentation (brightGreen)
  'document-project': '\x1b[92m',
  'generate-project-context': '\x1b[92m',
  'index-docs': '\x1b[92m',
  // Quality / Test (red)
  'tea': '\x1b[31m',
  'teach-me-testing': '\x1b[31m',
  'e2e-scaffold': '\x1b[31m',
  'performance-test': '\x1b[31m',
  'test-automate': '\x1b[31m',
  'test-design': '\x1b[31m',
  'test-framework': '\x1b[31m',
  'test-review': '\x1b[31m',
  // WDS (brightBlue) — explicit entries because hook strips wds- prefix
  '0-alignment-signoff': '\x1b[94m',
  '0-project-setup': '\x1b[94m',
  '1-project-brief': '\x1b[94m',
  '2-trigger-mapping': '\x1b[94m',
  '3-scenarios': '\x1b[94m',
  '4-ux-design': '\x1b[94m',
  '5-agentic-development': '\x1b[94m',
  '6-asset-generation': '\x1b[94m',
  '7-design-system': '\x1b[94m',
  '8-product-evolution': '\x1b[94m',
  'agent-freya-ux': '\x1b[94m',
  'agent-saga-analyst': '\x1b[94m',
  // Builder (brightCyan)
  'agent-builder': '\x1b[96m',
  'builder-setup': '\x1b[96m',
  'module-builder': '\x1b[96m',
  'workflow-builder': '\x1b[96m',
};

const WORKFLOW_PREFIX_COLORS = [
  { prefix: 'testarch-', color: '\x1b[31m' },       // Quality (red)
  { prefix: 'qa-generate-', color: '\x1b[31m' },     // Quality (red)
  { prefix: 'cis-', color: '\x1b[95m' },             // CIS (brightMagenta)
  { prefix: 'wds-', color: '\x1b[94m' },             // WDS (brightBlue)
];

module.exports = { WORKFLOW_COLORS, WORKFLOW_PREFIX_COLORS };
