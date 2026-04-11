import { MessageResponse } from "@/types";
import { messagesToMarkdown, downloadMarkdown } from "@/lib/utils/export";
import { Button } from "@/components/ui/button";

interface ExportButtonProps {
  messages: MessageResponse[];
  sessionTitle: string;
}

export function ExportButton({ messages, sessionTitle }: ExportButtonProps) {
  const handleExport = () => {
    const markdown = messagesToMarkdown(messages, sessionTitle);
    downloadMarkdown(markdown, sessionTitle.toLowerCase().replace(/\s+/g, "-"));
  };

  return (
    <Button
      onClick={handleExport}
      disabled={messages.length === 0}
      variant="outline"
    >
      Export Markdown
    </Button>
  );
}
