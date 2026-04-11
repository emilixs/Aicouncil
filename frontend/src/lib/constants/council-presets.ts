export interface CouncilPreset {
  id: string;
  name: string;
  description: string;
  expertTemplateIds: string[];
}

export const COUNCIL_PRESETS: CouncilPreset[] = [
  {
    id: 'preset-code-review',
    name: 'Code Review Council',
    description: 'A council focused on code quality, security, and architecture review.',
    expertTemplateIds: ['tpl-code-reviewer', 'tpl-security-analyst', 'tpl-architect'],
  },
  {
    id: 'preset-full-stack',
    name: 'Full Stack Development',
    description: 'A balanced council covering architecture, DevOps, and quality assurance.',
    expertTemplateIds: ['tpl-architect', 'tpl-devops-engineer', 'tpl-qa-engineer'],
  },
  {
    id: 'preset-product',
    name: 'Product Development',
    description: 'A product-focused council with UX research, data analysis, and documentation.',
    expertTemplateIds: ['tpl-ux-researcher', 'tpl-data-scientist', 'tpl-technical-writer'],
  },
  {
    id: 'preset-security',
    name: 'Security Audit',
    description: 'A security-focused council for comprehensive threat assessment and code hardening.',
    expertTemplateIds: ['tpl-security-analyst', 'tpl-code-reviewer', 'tpl-devops-engineer', 'tpl-qa-engineer'],
  },
];
