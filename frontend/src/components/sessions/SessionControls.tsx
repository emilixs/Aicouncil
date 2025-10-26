import { SessionResponse, SessionStatus } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  Clock,
  Play,
  Pause,
  Square,
  Wifi,
  WifiOff,
  Users,
} from "lucide-react";

interface CurrentExpertTurn {
  expertId: string;
  expertName: string;
  turnNumber: number;
}

interface SessionControlsProps {
  session: SessionResponse;
  isConnected: boolean;
  isDiscussionActive: boolean;
  currentExpertTurn: CurrentExpertTurn | null;
  messageCount: number;
  onStartDiscussion: () => void;
  onPauseDiscussion: () => void;
  onStopDiscussion: () => void;
}

export function SessionControls({
  session,
  isConnected,
  isDiscussionActive,
  currentExpertTurn,
  messageCount,
  onStartDiscussion,
  onPauseDiscussion,
  onStopDiscussion,
}: SessionControlsProps) {
  const statusColor = {
    [SessionStatus.PENDING]: "bg-yellow-100 text-yellow-800",
    [SessionStatus.ACTIVE]: "bg-blue-100 text-blue-800",
    [SessionStatus.COMPLETED]: "bg-green-100 text-green-800",
  };

  const statusIcon = {
    [SessionStatus.PENDING]: <Clock className="h-4 w-4" />,
    [SessionStatus.ACTIVE]: <Play className="h-4 w-4" />,
    [SessionStatus.COMPLETED]: <CheckCircle2 className="h-4 w-4" />,
  };

  const progressPercentage = (messageCount / session.maxMessages) * 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Session Details</CardTitle>
            <CardDescription>Monitor and control the discussion</CardDescription>
          </div>
          <Badge className={statusColor[session.status]}>
            {statusIcon[session.status]}
            <span className="ml-1">{session.status}</span>
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Problem Statement */}
        <div>
          <h4 className="font-semibold text-sm mb-2">Problem Statement</h4>
          <p className="text-sm text-muted-foreground line-clamp-3">
            {session.problemStatement}
          </p>
        </div>

        <Separator />

        {/* Experts */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4" />
            <h4 className="font-semibold text-sm">Experts ({session.experts.length})</h4>
          </div>
          <div className="space-y-1">
            {session.experts.map((expert) => (
              <div key={expert.id} className="text-sm">
                <span className="font-medium">{expert.name}</span>
                <span className="text-muted-foreground ml-2">({expert.specialty})</span>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Message Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-sm">Message Progress</h4>
            <span className="text-xs text-muted-foreground">
              {messageCount} / {session.maxMessages}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(progressPercentage, 100)}%` }}
            />
          </div>
        </div>

        <Separator />

        {/* Status Alerts */}
        <div className="space-y-2">
          {!isConnected && (
            <Alert variant="destructive">
              <WifiOff className="h-4 w-4" />
              <AlertDescription>WebSocket disconnected</AlertDescription>
            </Alert>
          )}

          {isConnected && (
            <Alert className="border-green-200 bg-green-50">
              <Wifi className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Connected to discussion
              </AlertDescription>
            </Alert>
          )}

          {isDiscussionActive && (
            <Alert className="border-blue-200 bg-blue-50">
              <Play className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                Discussion is active
                {currentExpertTurn && (
                  <span>
                    {` - Current turn: ${currentExpertTurn.expertName} (Turn ${currentExpertTurn.turnNumber})`}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {session.consensusReached && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Consensus has been reached
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex gap-2">
        {session.status === SessionStatus.PENDING && (
          <Button
            onClick={onStartDiscussion}
            disabled={!isConnected}
            className="w-full"
          >
            <Play className="h-4 w-4 mr-2" />
            Start Discussion
          </Button>
        )}

        {session.status === SessionStatus.ACTIVE && (
          <>
            <Button
              onClick={onPauseDiscussion}
              disabled={!isConnected || !isDiscussionActive}
              variant="outline"
              className="flex-1"
            >
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </Button>
            <Button
              onClick={onStopDiscussion}
              disabled={!isConnected || !isDiscussionActive}
              variant="destructive"
              className="flex-1"
            >
              <Square className="h-4 w-4 mr-2" />
              Stop
            </Button>
          </>
        )}

        {session.status === SessionStatus.COMPLETED && (
          <Button disabled className="w-full" variant="outline">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Discussion Completed
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

