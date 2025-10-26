import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSessions } from "@/lib/api/sessions";
import { SessionResponse } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SessionCard } from "@/components/sessions/SessionCard";
import { SessionFormDialog } from "@/components/sessions/SessionFormDialog";
import { RefreshCw, Plus } from "lucide-react";

export default function SessionsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<SessionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Fetch sessions on mount
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const data = await getSessions();
      // Sort by createdAt descending
      setSessions(data.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load sessions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewSession = (sessionId: string) => {
    navigate(`/sessions/${sessionId}`);
  };

  const handleCreateSuccess = (sessionId: string) => {
    setCreateDialogOpen(false);
    navigate(`/sessions/${sessionId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Discussion Sessions</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage expert discussion sessions
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSessions}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Session
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        // Loading skeleton grid
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        // Empty state
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">No sessions yet</h2>
            <p className="text-muted-foreground">
              Create your first discussion session to get started
            </p>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="mt-4"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create First Session
            </Button>
          </div>
        </div>
      ) : (
        // Sessions grid
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onViewSession={handleViewSession}
            />
          ))}
        </div>
      )}

      {/* Create Session Dialog */}
      <SessionFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}

