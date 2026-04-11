import { useRef, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MessageResponse } from "@/types";
import { MessageItem } from "@/components/sessions/MessageItem";

interface VirtualMessageListProps {
  messages: MessageResponse[];
  consensusReached: boolean;
  loading: boolean;
}

function MessageSkeleton() {
  return (
    <div data-testid="message-skeleton" className="animate-pulse space-y-2 p-4">
      <div className="h-4 bg-muted rounded w-1/4" />
      <div className="h-4 bg-muted rounded w-3/4" />
      <div className="h-4 bg-muted rounded w-1/2" />
    </div>
  );
}

export function VirtualMessageList({
  messages,
  loading,
}: VirtualMessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });

  useEffect(() => {
    if (messages.length > 0) {
      virtualizer.scrollToIndex(messages.length - 1);
    }
  }, [messages.length, virtualizer]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <MessageSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        No messages yet
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();
  const useVirtual = virtualItems.length > 0;

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      {useVirtual ? (
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualItems.map((virtualItem) => {
            const message = messages[virtualItem.index];
            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <MessageItem message={message} />
              </div>
            );
          })}
        </div>
      ) : (
        messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))
      )}
    </div>
  );
}
