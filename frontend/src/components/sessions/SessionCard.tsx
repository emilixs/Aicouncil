import { SessionResponse, SessionStatus } from "@/types";
import { formatSessionDate } from "@/lib/utils/date";
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
import { CheckCircle2, Clock, Play, Users } from "lucide-react";

interface SessionCardProps {
  session: SessionResponse;
  onViewSession: (sessionId: string) => void;
}

export function SessionCard({ session, onViewSession }: SessionCardProps) {
  const statusConfig = {
    [SessionStatus.PENDING]: {
      color: "bg-yellow-100 text-yellow-800 border-yellow-300",
      icon: <Clock className="h-4 w-4" />,
      label: "Pending",
    },
    [SessionStatus.ACTIVE]: {
      color: "bg-blue-100 text-blue-800 border-blue-300 animate-pulse",
      icon: <Play className="h-4 w-4" />,
      label: "Active",
    },
    [SessionStatus.COMPLETED]: {
      color: "bg-green-100 text-green-800 border-green-300",
      icon: <CheckCircle2 className="h-4 w-4" />,
      label: "Completed",
    },
  };

  const config = statusConfig[session.status];
  const borderColor = {
    [SessionStatus.PENDING]: "border-yellow-300 hover:border-yellow-400",
    [SessionStatus.ACTIVE]: "border-blue-300 hover:border-blue-400",
    [SessionStatus.COMPLETED]: "border-green-300 hover:border-green-400",
  };

  const truncatedProblem =
    session.problemStatement.length > 100
      ? session.problemStatement.substring(0, 100) + "..."
      : session.problemStatement;

  const displayedExperts = session.experts.slice(0, 3);
  const remainingExperts = session.experts.length - 3;

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-lg border-2 ${borderColor[session.status]}`}
      onClick={() => onViewSession(session.id)}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-base line-clamp-2">
              {truncatedProblem}
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {formatSessionDate(session.createdAt)}
            </CardDescription>
          </div>
          <Badge className={config.color}>
            {config.icon}
            <span className="ml-1">{config.label}</span>
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Experts */}
        <div>
          <div className="flex items-center gap-1 mb-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">
              Experts
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {displayedExperts.map((expert) => (
              <Badge key={expert.id} variant="outline" className="text-xs">
                {expert.name}
              </Badge>
            ))}
            {remainingExperts > 0 && (
              <Badge variant="secondary" className="text-xs">
                +{remainingExperts} more
              </Badge>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Max Messages:</span>
            <p className="font-semibold">{session.maxMessages}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Consensus:</span>
            <p className="font-semibold">
              {session.consensusReached ? "✓ Reached" : "Pending"}
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter>
        <Button
          variant="outline"
          className="w-full"
          onClick={(e) => {
            e.stopPropagation();
            onViewSession(session.id);
          }}
        >
          View Details
        </Button>
      </CardFooter>
    </Card>
  );
}

