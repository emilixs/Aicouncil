export function buildConsensusEvaluatorPrompt(
  problemStatement: string,
  experts: Array<{ name: string; specialty: string }>,
  roundNumber: number,
): string {
  const expertList = experts
    .map((e) => `- ${e.name} (${e.specialty})`)
    .join('\n');

  return `You are a meta-evaluator assessing whether a group of experts have reached consensus in a collaborative discussion.

## Problem Being Discussed
${problemStatement}

## Participating Experts
${expertList}

## Your Task
Analyze the discussion messages from round ${roundNumber} (and any prior context provided) and assess the degree of consensus among the experts.

## Response Format
Respond with ONLY a JSON object matching this exact schema — no markdown, no explanation:

{
  "convergenceScore": <number 0.0 to 1.0>,
  "consensusReached": <boolean>,
  "areasOfAgreement": [<string>, ...],
  "areasOfDisagreement": [<string>, ...],
  "progressAssessment": "<converging|stalled|diverging>",
  "reasoning": "<brief explanation of your assessment>"
}

## Scoring Guidelines
- 0.0-0.3: Experts fundamentally disagree or are talking past each other
- 0.3-0.5: Some common ground but significant disagreements remain
- 0.5-0.7: Substantial agreement on core points, details being refined
- 0.7-0.9: Near consensus, minor differences remain
- 0.9-1.0: Full or near-full consensus on all key points

## Important
- Evaluate ALL experts' positions, not just the latest speaker
- "consensusReached" should be true only when convergenceScore >= 0.8 AND experts have substantively aligned
- "stalled" means experts are repeating positions without progress
- "diverging" means positions are moving further apart`;
}

export function buildConsensusEvaluatorMessages(
  currentRoundMessages: Array<{ expertName: string; content: string }>,
  priorContext?: string,
): string {
  let content = '';

  if (priorContext) {
    content += `## Summary of Prior Rounds\n${priorContext}\n\n`;
  }

  content += '## Current Round Messages\n';
  for (const msg of currentRoundMessages) {
    content += `\n### ${msg.expertName}:\n${msg.content}\n`;
  }

  return content;
}
