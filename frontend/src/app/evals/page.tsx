'use client';

import { useState } from 'react';
import {
  FlaskConical,
  RefreshCw,
  Calendar,
  AlertCircle,
  TrendingUp,
  HelpCircle,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EvalStatsSummary } from '@/components/evals/score-card';
import { EvalResultsTable } from '@/components/evals/eval-results-table';
import { GroundTruthManager } from '@/components/evals/ground-truth-manager';
import { RunEvaluationDialog } from '@/components/evals/run-evaluation-dialog';
import { useEvaluationStats, useEvaluationResults } from '@/hooks';

export default function EvalsPage() {
  // Filter state
  const [days, setDays] = useState<number>(7);
  const [selectedCollection, setSelectedCollection] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch data
  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useEvaluationStats({ days });

  const {
    data: results,
    isLoading: resultsLoading,
    refetch: refetchResults,
  } = useEvaluationResults({ limit: 20 });

  const handleRefresh = () => {
    refetchStats();
    refetchResults();
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
          <h3 className="text-xl font-semibold mb-2">Failed to load evaluations</h3>
          <p className="text-muted-foreground mb-6 max-w-sm leading-relaxed">
            Unable to fetch evaluation data. Please check that the backend is running
            and evaluation is enabled.
          </p>
          <Button onClick={handleRefresh} className="rounded-xl">
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
              <FlaskConical className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Evaluations</h1>
              <p className="text-sm text-muted-foreground">
                Measure retrieval and answer quality with LLM-as-Judge
                <Link
                  href="/learn-evals"
                  className="inline-flex items-center gap-1 ml-2 text-primary hover:underline"
                >
                  <HelpCircle className="h-3 w-3" />
                  Learn more
                </Link>
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
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
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
          <RunEvaluationDialog />
        </div>
      </div>

      {/* Stats Summary */}
      <EvalStatsSummary stats={stats} isLoading={statsLoading} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="rounded-xl bg-muted/50 p-1">
          <TabsTrigger value="overview" className="rounded-lg">
            <TrendingUp className="h-4 w-4 mr-2" />
            Results
          </TabsTrigger>
          <TabsTrigger value="ground-truth" className="rounded-lg">
            <FlaskConical className="h-4 w-4 mr-2" />
            Ground Truth
          </TabsTrigger>
        </TabsList>

        {/* Results Tab */}
        <TabsContent value="overview" className="space-y-6">
          <EvalResultsTable
            results={results?.data}
            isLoading={resultsLoading}
            hasMore={results?.has_more}
            onLoadMore={() => {
              // TODO: Implement pagination with cursor
            }}
          />
        </TabsContent>

        {/* Ground Truth Tab */}
        <TabsContent value="ground-truth" className="space-y-6">
          <GroundTruthManager
            selectedCollectionId={selectedCollection}
            onCollectionChange={setSelectedCollection}
          />
        </TabsContent>
      </Tabs>

      {/* Empty State when no evaluations */}
      {!statsLoading && stats?.total_evaluations === 0 && (
        <div className="text-center py-12">
          <div className="relative mb-6 inline-block">
            <div className="absolute inset-0 bg-primary/10 rounded-2xl blur-xl" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mx-auto">
              <FlaskConical className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h3 className="text-xl font-semibold mb-2">No evaluations yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto leading-relaxed">
            Run your first evaluation to start measuring search quality. You can
            evaluate any Q&A pair to get detailed metrics on retrieval and answer
            quality.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <RunEvaluationDialog
              trigger={
                <Button className="rounded-xl">
                  <FlaskConical className="mr-2 h-4 w-4" />
                  Run First Evaluation
                </Button>
              }
            />
            <Button
              variant="outline"
              onClick={() => setActiveTab('ground-truth')}
              className="rounded-xl"
            >
              Add Ground Truth
            </Button>
          </div>
          <Link
            href="/learn-evals"
            className="inline-flex items-center gap-1.5 mt-4 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <HelpCircle className="h-4 w-4" />
            What are evaluations and how do they help?
          </Link>
        </div>
      )}
    </div>
  );
}
