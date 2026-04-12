export function buildSummaryGeneratorPrompt(
  problemStatement: string,
  experts: Array<{ name: string; specialty: string }>,
  endReason: string,
): string {
  const expertList = experts
    .map((e) => `- ${e.name} (${e.specialty})`)
    .join('\n');

  return `You are summarizing a completed expert discussion.

## Problem Statement
${problemStatement}

## Participating Experts
${expertList}

## Discussion End Reason
${endReason}

## Your Task
Generate a structured summary of the discussion.

## Response Format
Respond with ONLY a JSON object matching this exact schema — no markdown, no explanation:

{
  "executiveSummary": "<one paragraph summarizing the discussion and its outcome>",
  "decisions": ["<key decision or recommendation>", ...],
  "actionItems": [
    {
      "description": "<what needs to be done>",
      "priority": "<high|medium|low>",
      "suggestedOwner": "<expert name or role, optional>"
    }
  ],
  "keyArguments": [
    {
      "expertName": "<name>",
      "position": "<their main argument or contribution>"
    }
  ],
  "openQuestions": ["<unresolved question or disagreement>", ...]
}

## Guidelines
- Be concise but comprehensive
- Capture ALL experts' key positions in keyArguments
- Action items should be concrete and actionable
- If the discussion ended without consensus, note this in executiveSummary`;
}

export function buildSummaryMessages(
  messages: Array<{ expertName: string; content: string; role: string }>,
): string {
  let content = '## Full Discussion Transcript\n';
  for (const msg of messages) {
    const prefix = msg.expertName ? `[${msg.expertName}]` : '[System]';
    content += `\n${prefix}: ${msg.content}\n`;
  }
  return content;
}

export function buildChunkSummaryPrompt(): string {
  return `Summarize the following portion of an expert discussion. Preserve key arguments, decisions, and points of agreement/disagreement. Be concise but don't lose important nuance.

Respond with a plain text summary (not JSON).`;
}
