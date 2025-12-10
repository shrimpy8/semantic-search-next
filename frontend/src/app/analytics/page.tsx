'use client';

import { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useSearchStats,
  useSearchHistory,
  useSearchTrends,
  useTopQueries,
} from '@/hooks';
import { formatDistanceToNow } from 'date-fns';

export default function AnalyticsPage() {
  // Filter state
  const [days, setDays] = useState<number>(2);
  const [historyPage, setHistoryPage] = useState(0);
  const historyLimit = 10;

  // Fetch data
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useSearchStats({ days });
  const { data: history, isLoading: historyLoading, refetch: refetchHistory } = useSearchHistory({
    limit: historyLimit,
    offset: historyPage * historyLimit,
  });
  const { data: trends, isLoading: trendsLoading } = useSearchTrends({ days, granularity: days <= 7 ? 'hour' : 'day' });
  const { data: topQueries, isLoading: topQueriesLoading } = useTopQueries({ limit: 5, days });

  // Derived values
  const maxTrendCount = useMemo(() => {
    if (!trends?.data?.length) return 1;
    return Math.max(...trends.data.map(d => d.search_count), 1);
  }, [trends]);

  const maxQueryCount = useMemo(() => {
    if (!topQueries?.data?.length) return 1;
    return Math.max(...topQueries.data.map(d => d.count), 1);
  }, [topQueries]);

  const handleRefresh = () => {
    refetchStats();
    refetchHistory();
  };

  if (statsError) {
    return (
      <div className="container py-8">
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-destructive/30 animate-in fade-in duration-300">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-destructive/10 rounded-2xl blur-xl" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <h3 className="text-xl font-semibold mb-2">Failed to load analytics</h3>
          <p className="text-muted-foreground mb-6 max-w-sm leading-relaxed">
            Unable to fetch analytics data. Please try again.
          </p>
          <Button onClick={() => handleRefresh()} className="rounded-xl">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
              <p className="text-sm text-muted-foreground">
                Search performance and usage insights
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-[140px] rounded-xl">
              <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">Last 2 days</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            className="rounded-xl"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Searches */}
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Searches
            </CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats?.total_searches.toLocaleString() ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              in the last {days} days
            </p>
          </CardContent>
        </Card>

        {/* Average Latency */}
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Latency
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats?.avg_latency_ms.toFixed(0) ?? 0}ms</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              response time
            </p>
          </CardContent>
        </Card>

        {/* Success Rate */}
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Success Rate
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats?.success_rate.toFixed(1) ?? 0}%</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              searches with results
            </p>
          </CardContent>
        </Card>

        {/* Zero Results */}
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Zero Results
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats?.zero_results_count ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              searches with no matches
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Search Trends Chart */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Search Volume
            </CardTitle>
            <CardDescription>
              {days <= 7 ? 'Hourly' : 'Daily'} search activity over the last {days} days
            </CardDescription>
          </CardHeader>
          <CardContent>
            {trendsLoading ? (
              <div className="h-48 flex items-end gap-1">
                {[40, 65, 30, 80, 55, 45, 70, 35, 60, 50, 75, 25, 85, 40].map((h, i) => (
                  <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
                ))}
              </div>
            ) : trends?.data?.length ? (
              <div className="space-y-2">
                {/* Chart with Y-axis */}
                <div className="flex gap-2">
                  {/* Y-axis labels */}
                  <div className="flex flex-col justify-between text-xs text-muted-foreground w-8 text-right pr-1 h-48">
                    <span>{maxTrendCount}</span>
                    <span>{Math.round(maxTrendCount / 2)}</span>
                    <span>0</span>
                  </div>
                  {/* Bars */}
                  <div className="flex-1 h-48 flex items-end gap-0.5">
                    {trends.data.slice(-28).map((point, index) => {
                      const height = (point.search_count / maxTrendCount) * 100;
                      const date = new Date(point.period);
                      return (
                        <div
                          key={index}
                          className="flex-1 group relative h-full flex items-end"
                        >
                          <div
                            className="w-full bg-primary/80 hover:bg-primary rounded-t transition-all"
                            style={{ height: `${Math.max(height, 2)}%` }}
                          />
                          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                            <div className="bg-popover border rounded-lg p-2 shadow-lg text-xs whitespace-nowrap">
                              <div className="font-medium">{point.search_count} searches</div>
                              <div className="text-muted-foreground">
                                {days <= 7
                                  ? date.toLocaleString('en-US', { hour: 'numeric', day: 'numeric', month: 'short' })
                                  : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                }
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* X-axis labels */}
                <div className="flex gap-2">
                  {/* Spacer for Y-axis width */}
                  <div className="w-8" />
                  {/* X-axis time labels */}
                  <div className="flex-1 flex justify-between text-xs text-muted-foreground px-1">
                    {(() => {
                      const dataSlice = trends.data.slice(-28);
                      if (dataSlice.length === 0) return null;
                      // Show first, middle, and last labels
                      const firstDate = new Date(dataSlice[0].period);
                      const lastDate = new Date(dataSlice[dataSlice.length - 1].period);
                      const midIndex = Math.floor(dataSlice.length / 2);
                      const midDate = new Date(dataSlice[midIndex].period);

                      const formatLabel = (date: Date) =>
                        days <= 7
                          ? date.toLocaleString('en-US', { hour: 'numeric', day: 'numeric', month: 'short' })
                          : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                      return (
                        <>
                          <span>{formatLabel(firstDate)}</span>
                          <span>{formatLabel(midDate)}</span>
                          <span>{formatLabel(lastDate)}</span>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No search data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Queries */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Top Queries
            </CardTitle>
            <CardDescription>
              Most frequent search queries
            </CardDescription>
          </CardHeader>
          <CardContent>
            {topQueriesLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-10" />
                  </div>
                ))}
              </div>
            ) : topQueries?.data?.length ? (
              <div className="space-y-3">
                {topQueries.data.map((query, index) => {
                  const width = (query.count / maxQueryCount) * 100;
                  return (
                    <div key={index} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate max-w-[200px] font-medium" title={query.query}>
                          {query.query}
                        </span>
                        <span className="text-muted-foreground ml-2 shrink-0">
                          {query.count}x
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span>{query.avg_latency_ms.toFixed(0)}ms avg</span>
                        <span>{query.avg_results.toFixed(1)} results avg</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No queries yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Searches by Preset */}
      {stats?.searches_by_preset && Object.keys(stats.searches_by_preset).length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Searches by Retrieval Method</CardTitle>
            <CardDescription>
              Distribution of search methods used
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(stats.searches_by_preset).map(([preset, count]) => (
                <Badge
                  key={preset}
                  variant="secondary"
                  className="text-sm px-3 py-1.5 rounded-lg"
                >
                  {preset}: {count.toLocaleString()}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search History Table */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Recent Searches</CardTitle>
          <CardDescription>
            Showing {historyPage * historyLimit + 1}-{Math.min((historyPage + 1) * historyLimit, history?.total ?? 0)} of {history?.total ?? 0} searches
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : history?.data?.length ? (
            <>
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Query</th>
                      <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Method</th>
                      <th className="px-4 py-3 text-right font-medium">Results</th>
                      <th className="px-4 py-3 text-right font-medium">Latency</th>
                      <th className="px-4 py-3 text-right font-medium hidden md:table-cell">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {history.data.map((query) => (
                      <tr key={query.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 max-w-[200px] truncate font-medium" title={query.query_text}>
                          {query.query_text}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <Badge variant="outline" className="rounded-md text-xs">
                            {query.retrieval_method ?? 'unknown'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={query.results_count === 0 ? 'text-destructive' : ''}>
                            {query.results_count ?? 0}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {query.latency_ms}ms
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">
                          {formatDistanceToNow(new Date(query.created_at), { addSuffix: true })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {history.total > historyLimit && (
                <div className="flex items-center justify-between mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setHistoryPage((p) => Math.max(0, p - 1))}
                    disabled={historyPage === 0}
                    className="rounded-lg"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {historyPage + 1} of {Math.ceil(history.total / historyLimit)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setHistoryPage((p) => p + 1)}
                    disabled={!history.has_more}
                    className="rounded-lg"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No search history yet</p>
              <p className="text-sm text-muted-foreground/70">
                Perform some searches to see analytics data
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
