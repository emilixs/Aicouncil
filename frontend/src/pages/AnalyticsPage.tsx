import { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OverviewCards } from '@/components/analytics/OverviewCards';
import { SessionTable } from '@/components/analytics/SessionTable';
import { TokenUsageChart } from '@/components/analytics/TokenUsageChart';
import { ParticipationChart } from '@/components/analytics/ParticipationChart';
import { ConsensusChart } from '@/components/analytics/ConsensusChart';
import { DateRangeFilter } from '@/components/analytics/DateRangeFilter';
import {
  getAnalyticsOverview,
  getAnalyticsSessions,
  getAnalyticsExperts,
  getAnalyticsComparisons,
} from '@/lib/api/analytics';
import type {
  OverviewStats,
  SessionAnalytics,
  ExpertStats,
  ComparisonStats,
  DateRangeFilter as DateRangeFilterType,
} from '@/types/analytics';
import { RefreshCw } from 'lucide-react';

export default function AnalyticsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [sessions, setSessions] = useState<SessionAnalytics[]>([]);
  const [experts, setExperts] = useState<ExpertStats[]>([]);
  const [comparisons, setComparisons] = useState<ComparisonStats[]>([]);
  const [dateFilter, setDateFilter] = useState<DateRangeFilterType>({});

  const fetchData = useCallback(
    async (filter?: DateRangeFilterType) => {
      try {
        setLoading(true);
        const [overviewResult, sessionsResult, expertsResult, comparisonsResult] =
          await Promise.allSettled([
            getAnalyticsOverview(filter),
            getAnalyticsSessions(),
            getAnalyticsExperts(),
            getAnalyticsComparisons(),
          ]);

        if (overviewResult.status === 'fulfilled') {
          setOverview(overviewResult.value);
        } else {
          toast({ title: 'Error', description: 'Failed to load overview metrics', variant: 'destructive' });
        }
        if (sessionsResult.status === 'fulfilled') {
          setSessions(sessionsResult.value);
        } else {
          toast({ title: 'Error', description: 'Failed to load sessions', variant: 'destructive' });
        }
        if (expertsResult.status === 'fulfilled') {
          setExperts(expertsResult.value);
        } else {
          toast({ title: 'Error', description: 'Failed to load expert data', variant: 'destructive' });
        }
        if (comparisonsResult.status === 'fulfilled') {
          setComparisons(comparisonsResult.value);
        } else {
          toast({ title: 'Error', description: 'Failed to load comparisons', variant: 'destructive' });
        }
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    fetchData(dateFilter);
  }, [fetchData, dateFilter]);

  const handleFilterChange = (filter: DateRangeFilterType) => {
    setDateFilter(filter);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="mt-1 text-muted-foreground">
            Discussion session insights and metrics
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <DateRangeFilter onFilter={handleFilterChange} />
          <span className="text-xs text-muted-foreground">
            Date filter applies to overview metrics only
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(dateFilter)}
            disabled={loading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-[400px] w-full rounded-lg" />
        </div>
      ) : (
        <>
          {overview && <OverviewCards data={overview} />}

          <Tabs defaultValue="sessions">
            <TabsList>
              <TabsTrigger value="sessions">Sessions</TabsTrigger>
              <TabsTrigger value="tokens">Token Usage</TabsTrigger>
              <TabsTrigger value="participation">Participation</TabsTrigger>
              <TabsTrigger value="consensus">Consensus</TabsTrigger>
            </TabsList>

            <TabsContent value="sessions" className="mt-4">
              <SessionTable sessions={sessions} />
            </TabsContent>

            <TabsContent value="tokens" className="mt-4">
              <TokenUsageChart sessions={sessions} />
            </TabsContent>

            <TabsContent value="participation" className="mt-4">
              <ParticipationChart experts={experts} />
            </TabsContent>

            <TabsContent value="consensus" className="mt-4">
              <ConsensusChart comparisons={comparisons} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
