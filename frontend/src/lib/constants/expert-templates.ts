import { DriverType, LLMConfig } from '@/types/expert';

export interface ExpertTemplate {
  id: string;
  name: string;
  specialty: string;
  systemPrompt: string;
  driverType: DriverType;
  config: LLMConfig;
}

export const EXPERT_TEMPLATES: ExpertTemplate[] = [
  {
    id: 'tpl-security-analyst',
    name: 'Security Analyst',
    specialty: 'Cybersecurity',
    systemPrompt: 'You are a cybersecurity expert who identifies vulnerabilities, analyzes threats, and recommends security best practices.',
    driverType: DriverType.ANTHROPIC,
    config: { model: 'claude-sonnet-4-6', temperature: 0.5 },
  },
  {
    id: 'tpl-code-reviewer',
    name: 'Code Reviewer',
    specialty: 'Code Quality',
    systemPrompt: 'You are an expert code reviewer who identifies bugs, suggests improvements, and enforces coding standards.',
    driverType: DriverType.ANTHROPIC,
    config: { model: 'claude-sonnet-4-6', temperature: 0.3 },
  },
  {
    id: 'tpl-architect',
    name: 'Software Architect',
    specialty: 'System Design',
    systemPrompt: 'You are a software architect who designs scalable systems, evaluates trade-offs, and creates technical roadmaps.',
    driverType: DriverType.OPENAI,
    config: { model: 'gpt-5.4-mini', temperature: 0.7 },
  },
  {
    id: 'tpl-data-scientist',
    name: 'Data Scientist',
    specialty: 'Data Analysis',
    systemPrompt: 'You are a data scientist who analyzes datasets, builds models, and provides insights from data.',
    driverType: DriverType.OPENAI,
    config: { model: 'gpt-5.4-mini', temperature: 0.6 },
  },
  {
    id: 'tpl-ux-researcher',
    name: 'UX Researcher',
    specialty: 'User Experience',
    systemPrompt: 'You are a UX researcher who evaluates user interfaces, conducts usability analysis, and recommends design improvements.',
    driverType: DriverType.ANTHROPIC,
    config: { model: 'claude-sonnet-4-6', temperature: 0.7 },
  },
  {
    id: 'tpl-devops-engineer',
    name: 'DevOps Engineer',
    specialty: 'Infrastructure',
    systemPrompt: 'You are a DevOps engineer who designs CI/CD pipelines, manages infrastructure, and optimizes deployment workflows.',
    driverType: DriverType.OPENAI,
    config: { model: 'gpt-5.4-mini', temperature: 0.5 },
  },
  {
    id: 'tpl-technical-writer',
    name: 'Technical Writer',
    specialty: 'Documentation',
    systemPrompt: 'You are a technical writer who creates clear documentation, API references, and user guides.',
    driverType: DriverType.ANTHROPIC,
    config: { model: 'claude-sonnet-4-6', temperature: 0.6 },
  },
  {
    id: 'tpl-qa-engineer',
    name: 'QA Engineer',
    specialty: 'Testing',
    systemPrompt: 'You are a QA engineer who designs test strategies, writes test cases, and identifies edge cases in software.',
    driverType: DriverType.GROK,
    config: { model: 'grok-4.20-0309-reasoning', temperature: 0.4 },
  },
];
