export function buildVoteExtractorPrompt(proposal: string): string {
  return `An expert was asked to vote on the following proposal in a discussion:

"${proposal}"

The expert responded with a natural-language message. Extract their structured vote from the response.

## Response Format
Respond with ONLY a JSON object matching this exact schema — no markdown, no explanation:

{
  "vote": "<agree|disagree|agree_with_reservations>",
  "reasoning": "<brief summary of their reasoning>"
}

## Guidelines
- "agree": Expert clearly supports the proposal
- "disagree": Expert clearly opposes the proposal
- "agree_with_reservations": Expert supports but has conditions or concerns
- If the vote is ambiguous, default to "agree_with_reservations"`;
}
