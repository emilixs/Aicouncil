import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSession, getSessionMessages } from "@/lib/api/sessions";
import { useWebSocket } from "@/hooks/use-websocket";
import { SessionResponse, MessageResponse, SessionStatus } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { MessageList } from "@/components/sessions/MessageList";
import { InterventionPanel } from "@/components/sessions/InterventionPanel";
import { SessionControls } from "@/components/sessions/SessionControls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [session, setSession] = useState<SessionResponse | null>(null);
  const [initialMessages, setInitialMessages] = useState<MessageResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Map statusDisplay to SessionStatus enum
  const mapStatusDisplay = (statusDisplay?: string): SessionStatus => {
    switch (statusDisplay?.toLowerCase()) {
      case "pending":
        return SessionStatus.PENDING;
      case "active":
        return SessionStatus.ACTIVE;
      case "concluded":
      case "completed":
        return SessionStatus.COMPLETED;
      default:
        return SessionStatus.PENDING;
    }
  };

  const {
    isConnected,
    error: wsError,
    messages: wsMessages,
    consensusReached,
    isDiscussionActive,
    currentExpertTurn,
    startDiscussion,
    sendIntervention,
    pauseDiscussion,
    stopDiscussion,
    disconnect,
  } = useWebSocket(id || "");

  // Fetch session and initial messages
  useEffect(() => {
    if (!id) {
      setError("Session ID not found");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setError(null);
        const [sessionData, messagesData] = await Promise.all([
          getSession(id),
          getSessionMessages(id),
        ]);
        setSession(sessionData);
        setInitialMessages(messagesData);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load session";
        setError(errorMessage);
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, toast]);

  // Merge initial messages with WebSocket messages, deduplicate by id, and sort by timestamp
  const allMessages = (() => {
    const messageMap = new Map<string, MessageResponse>();

    // Add initial messages
    initialMessages.forEach((msg) => {
      messageMap.set(msg.id, msg);
    });

    // Add/override with WebSocket messages
    wsMessages.forEach((msg) => {
      messageMap.set(msg.id, msg);
    });

    // Convert to array and sort by timestamp
    return Array.from(messageMap.values()).sort((a, b) => {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
  })();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/sessions")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="space-y-3">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/sessions")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error || "Session not found"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/sessions")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Session Details</h1>
            <p className="text-muted-foreground mt-1">
              {session.problemStatement.substring(0, 100)}...
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* WebSocket Error Alert */}
      {wsError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription>{wsError}</AlertDescription>
        </Alert>
      )}

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Messages and Intervention */}
        <div className="lg:col-span-2 space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-3">Discussion</h2>
            <MessageList
              messages={allMessages}
              consensusReached={consensusReached || session.consensusReached}
              loading={loading}
            />
          </div>

          <InterventionPanel
            onSendIntervention={sendIntervention}
            disabled={!isDiscussionActive || (session.status || mapStatusDisplay(session.statusDisplay)) === SessionStatus.COMPLETED}
            isConnected={isConnected}
          />
        </div>

        {/* Right Column - Session Controls and Expert Details */}
        <div className="space-y-4">
          <SessionControls
            session={session}
            isConnected={isConnected}
            isDiscussionActive={isDiscussionActive}
            currentExpertTurn={currentExpertTurn}
            messageCount={allMessages.length}
            onStartDiscussion={startDiscussion}
            onPauseDiscussion={pauseDiscussion}
            onStopDiscussion={stopDiscussion}
          />

          {/* Expert Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Participating Experts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {session.experts.map((expert) => (
                <div key={expert.id} className="pb-3 border-b last:border-b-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm">{expert.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {expert.specialty}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {expert.driverType}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

