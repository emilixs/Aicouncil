import { MessageResponse, MessageRole } from "@/types";
import { formatMessageTimestamp } from "@/lib/utils/date";
import { Badge } from "@/components/ui/badge";
import { Bot, User } from "lucide-react";

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

  return (
    <div className={`p-4 rounded-md ${bgColor}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isSystem ? (
            <Bot className="h-4 w-4 text-gray-500" />
          ) : (
            <User className="h-4 w-4 text-blue-500" />
          )}
          <div className="flex items-center gap-2">
            {message.expertName && (
              <span className="font-semibold text-sm">{message.expertName}</span>
            )}
            {message.expertSpecialty && (
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
      <div className="text-sm whitespace-pre-wrap text-gray-700">
        {message.content}
      </div>
    </div>
  );
}

