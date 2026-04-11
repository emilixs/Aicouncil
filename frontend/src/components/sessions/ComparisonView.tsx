import type { SessionResponse, MessageResponse } from "@/types/session";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface ComparisonViewProps {
  session: SessionResponse;
  messages: MessageResponse[];
  isConnected: boolean;
}

export function ComparisonView({ session, messages, isConnected }: ComparisonViewProps) {
  const experts = session.experts;

  const getExpertMessage = (expertId: string): MessageResponse | undefined => {
    return messages.find((m) => m.expertId === expertId);
  };

  const formatDuration = (ms: number | null | undefined): string => {
    if (ms == null) return "-";
    const seconds = ms / 1000;
    // Remove trailing zeros: 1.50 → 1.5, 0.95 → 0.95
    return `${parseFloat(seconds.toFixed(2))}s`;
  };

  const gridCols = experts.length <= 2 ? "grid-cols-2" : "grid-cols-3";

  return (
    <div className="space-y-4">
      <div className={`grid ${gridCols} gap-4`}>
        {experts.map((expert) => {
          const message = getExpertMessage(expert.id);

          return (
            <Card key={expert.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{expert.name}</CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {expert.specialty}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {message ? (
                  <div className="space-y-3">
                    {/* Metrics */}
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {message.durationMs != null && (
                        <span>{formatDuration(message.durationMs)}</span>
                      )}
                      {message.tokenCount != null && (
                        <span>{message.tokenCount} tokens</span>
                      )}
                      {message.modelUsed && (
                        <Badge variant="secondary" className="text-xs">
                          {message.modelUsed}
                        </Badge>
                      )}
                    </div>
                    {/* Response content */}
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <div data-testid="expert-loading" className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
