import { MessageResponse, MessageRole } from "@/types";
import { formatMessageTimestamp } from "@/lib/utils/date";
import { Badge } from "@/components/ui/badge";
import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface MessageItemProps {
  message: MessageResponse;
  isConsensusMessage?: boolean;
}

export function MessageItem({ message, isConsensusMessage }: MessageItemProps) {
  const isIntervention = message.isIntervention;
  const isSystem = message.role === MessageRole.SYSTEM;

  // Determine background color based on message type
  const bgColor = isConsensusMessage
    ? "bg-green-50 border-l-4 border-green-500"
    : isIntervention
      ? "bg-blue-50 border-l-4 border-blue-500"
      : isSystem
        ? "bg-gray-50 border-l-4 border-gray-400"
        : "bg-white border-l-4 border-gray-200";

  // Determine sender name and icon
  const senderName = isIntervention ? "You" : message.expertName || "System";
  const senderIcon = isIntervention ? (
    <User className="h-4 w-4 text-blue-500" />
  ) : isSystem ? (
    <Bot className="h-4 w-4 text-gray-500" />
  ) : (
    <Bot className="h-4 w-4 text-purple-500" />
  );

  return (
    <div className={`p-4 rounded-md ${bgColor}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {senderIcon}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{senderName}</span>
            {message.expertSpecialty && !isIntervention && (
              <Badge variant="outline" className="text-xs">
                {message.expertSpecialty}
              </Badge>
            )}
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatMessageTimestamp(message.timestamp)}
        </span>
      </div>

      {/* Badges */}
      <div className="flex gap-2 mb-2">
        {isIntervention && (
          <Badge variant="secondary" className="text-xs">
            User Intervention
          </Badge>
        )}
        {isConsensusMessage && (
          <Badge className="text-xs bg-green-600">
            Consensus
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="text-sm text-gray-700 prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown
          components={{
            p: ({ node, ...props }: any) => <p className="mb-2" {...props} />,
            ul: ({ node, ...props }: any) => <ul className="list-disc list-inside mb-2" {...props} />,
            ol: ({ node, ...props }: any) => <ol className="list-decimal list-inside mb-2" {...props} />,
            li: ({ node, ...props }: any) => <li className="mb-1" {...props} />,
            code: ({ node, inline, ...props }: any) =>
              inline ? (
                <code className="bg-gray-200 px-1 py-0.5 rounded text-xs" {...props} />
              ) : (
                <code className="block bg-gray-200 p-2 rounded mb-2 overflow-x-auto" {...props} />
              ),
            blockquote: ({ node, ...props }: any) => (
              <blockquote className="border-l-4 border-gray-300 pl-4 italic mb-2" {...props} />
            ),
            a: ({ node, ...props }: any) => (
              <a className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />
            ),
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

