import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { SessionAnalytics } from '@/types/analytics';
import { formatSessionDate } from '@/lib/utils/date';
import { ExternalLink } from 'lucide-react';

interface SessionTableProps {
  sessions: SessionAnalytics[];
}

export function SessionTable({ sessions }: SessionTableProps) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Sessions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2 font-medium">Problem</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium text-right">Tokens</th>
                <th className="pb-2 font-medium text-right">Rounds</th>
                <th className="pb-2 font-medium text-right">Cost</th>
                <th className="pb-2 font-medium">Consensus</th>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.sessionId} className="border-b last:border-0">
                  <td className="py-2 max-w-[200px] truncate">
                    {session.problemStatement}
                  </td>
                  <td className="py-2">
                    <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-secondary">
                      {session.status}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    {session.totalTokens.toLocaleString()}
                  </td>
                  <td className="py-2 text-right">{session.totalRounds}</td>
                  <td className="py-2 text-right">
                    ${(session.estimatedCostUsd ?? 0).toFixed(2)}
                  </td>
                  <td className="py-2">
                    {session.consensusReached ? 'Yes' : 'No'}
                  </td>
                  <td className="py-2 text-muted-foreground">
                    {formatSessionDate(session.createdAt)}
                  </td>
                  <td className="py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/sessions/${session.sessionId}`)}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No session data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
