import { PrismaClient, DriverType } from '@prisma/client';

const prisma = new PrismaClient();

const EXPERT_TEMPLATES = [
  {
    name: 'Security Analyst',
    specialty: 'Cybersecurity',
    systemPrompt:
      'You are a cybersecurity expert who identifies vulnerabilities, analyzes threats, and recommends security best practices.',
    driverType: DriverType.ANTHROPIC,
    config: { model: 'claude-sonnet-4-6', temperature: 0.5 },
  },
  {
    name: 'Code Reviewer',
    specialty: 'Code Quality',
    systemPrompt:
      'You are an expert code reviewer who identifies bugs, suggests improvements, and enforces coding standards.',
    driverType: DriverType.ANTHROPIC,
    config: { model: 'claude-sonnet-4-6', temperature: 0.3 },
  },
  {
    name: 'Software Architect',
    specialty: 'System Design',
    systemPrompt:
      'You are a software architect who designs scalable systems, evaluates trade-offs, and creates technical roadmaps.',
    driverType: DriverType.OPENAI,
    config: { model: 'gpt-5.4-mini', temperature: 0.7 },
  },
  {
    name: 'Data Scientist',
    specialty: 'Data Analysis',
    systemPrompt:
      'You are a data scientist who analyzes datasets, builds models, and provides insights from data.',
    driverType: DriverType.OPENAI,
    config: { model: 'gpt-5.4-mini', temperature: 0.6 },
  },
  {
    name: 'UX Researcher',
    specialty: 'User Experience',
    systemPrompt:
      'You are a UX researcher who evaluates user interfaces, conducts usability analysis, and recommends design improvements.',
    driverType: DriverType.ANTHROPIC,
    config: { model: 'claude-sonnet-4-6', temperature: 0.7 },
  },
  {
    name: 'DevOps Engineer',
    specialty: 'Infrastructure',
    systemPrompt:
      'You are a DevOps engineer who designs CI/CD pipelines, manages infrastructure, and optimizes deployment workflows.',
    driverType: DriverType.OPENAI,
    config: { model: 'gpt-5.4-mini', temperature: 0.5 },
  },
  {
    name: 'Technical Writer',
    specialty: 'Documentation',
    systemPrompt:
      'You are a technical writer who creates clear documentation, API references, and user guides.',
    driverType: DriverType.ANTHROPIC,
    config: { model: 'claude-sonnet-4-6', temperature: 0.6 },
  },
  {
    name: 'QA Engineer',
    specialty: 'Testing',
    systemPrompt:
      'You are a QA engineer who designs test strategies, writes test cases, and identifies edge cases in software.',
    driverType: DriverType.GROK,
    config: { model: 'grok-4.20-0309-reasoning', temperature: 0.4 },
  },
];

async function main() {
  console.log('Seeding expert templates...');

  for (const template of EXPERT_TEMPLATES) {
    const existing = await prisma.expert.findFirst({
      where: { name: template.name, specialty: template.specialty },
    });

    if (existing) {
      console.log(`  Skipping "${template.name}" — already exists`);
      continue;
    }

    await prisma.expert.create({ data: template });
    console.log(`  Created "${template.name}"`);
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
