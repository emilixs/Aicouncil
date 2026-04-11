import { MessageResponse, MessageRole } from "@/types";

export function messagesToMarkdown(
  messages: MessageResponse[],
  sessionTitle: string,
): string {
  const lines: string[] = [];

  lines.push(`# ${sessionTitle}`);
  lines.push("");
  lines.push(`**Date:** ${new Date().toLocaleDateString()}`);
  lines.push(`**Messages:** ${messages.length}`);
  lines.push("");

  if (messages.length === 0) {
    lines.push("_No messages in this session._");
    return lines.join("\n");
  }

  lines.push("---");
  lines.push("");

  for (const msg of messages) {
    const d = new Date(msg.timestamp);
    const time = d.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");

    if (msg.role === MessageRole.SYSTEM) {
      lines.push(`### 🔧 System — ${time}`);
    } else if (msg.isIntervention) {
      lines.push(`### ⚡ Intervention — ${time}`);
    } else {
      const name = msg.expertName ?? "Unknown";
      lines.push(`### ${name} (${msg.role}) — ${time}`);
    }

    lines.push("");
    lines.push(msg.content);
    lines.push("");
  }

  return lines.join("\n");
}

export function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
