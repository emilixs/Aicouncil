import { useEffect, useRef } from "react";
import { MessageResponse } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageItem } from "./MessageItem";
import { CheckCircle2 } from "lucide-react";

interface MessageListProps {
  messages: MessageResponse[];
  consensusReached: boolean;
  loading: boolean;
}

export function MessageList({ messages, consensusReached, loading }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <ScrollArea className="h-[600px] rounded-md border">
      <div className="p-4 space-y-3">
        {loading ? (
          // Loading skeleton
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          // Empty state
          <div className="flex items-center justify-center h-[500px] text-center">
            <div>
              <p className="text-muted-foreground">No messages yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Start the discussion to see expert messages
              </p>
            </div>
          </div>
        ) : (
          // Messages
          <>
            {messages.map((message, index) => {
              // Check if this is the consensus message by id pattern
              const isConsensusMessage = message.id.startsWith("consensus-");
              return (
                <div key={message.id}>
                  <MessageItem
                    message={message}
                    isConsensusMessage={isConsensusMessage}
                  />
                  {index < messages.length - 1 && <Separator className="my-2" />}
                </div>
              );
            })}

            {/* Consensus Alert */}
            {consensusReached && (
              <div className="mt-4">
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-900">Consensus Reached</AlertTitle>
                  <AlertDescription className="text-green-800">
                    The experts have reached a consensus on this topic.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Auto-scroll anchor */}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
    </ScrollArea>
  );
}

