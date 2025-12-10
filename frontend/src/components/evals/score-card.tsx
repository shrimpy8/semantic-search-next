'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

// Score interpretation thresholds
const SCORE_THRESHOLDS = {
  excellent: 0.8,
  good: 0.6,
  moderate: 0.4,
} as const;

type ScoreLevel = 'excellent' | 'good' | 'moderate' | 'poor';

function getScoreLevel(score: number | null | undefined): ScoreLevel {
  if (score === null || score === undefined) return 'poor';
  if (score >= SCORE_THRESHOLDS.excellent) return 'excellent';
  if (score >= SCORE_THRESHOLDS.good) return 'good';
  if (score >= SCORE_THRESHOLDS.moderate) return 'moderate';
  return 'poor';
}

function getScoreColor(level: ScoreLevel): string {
  switch (level) {
    case 'excellent':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'good':
      return 'text-blue-600 dark:text-blue-400';
    case 'moderate':
      return 'text-amber-600 dark:text-amber-400';
    case 'poor':
      return 'text-red-600 dark:text-red-400';
  }
}

function getProgressColor(level: ScoreLevel): string {
  switch (level) {
    case 'excellent':
      return 'bg-emerald-500';
    case 'good':
      return 'bg-blue-500';
    case 'moderate':
      return 'bg-amber-500';
    case 'poor':
      return 'bg-red-500';
  }
}

function getBgColor(level: ScoreLevel): string {
  switch (level) {
    case 'excellent':
      return 'bg-emerald-50 dark:bg-emerald-950/30';
    case 'good':
      return 'bg-blue-50 dark:bg-blue-950/30';
    case 'moderate':
      return 'bg-amber-50 dark:bg-amber-950/30';
    case 'poor':
      return 'bg-red-50 dark:bg-red-950/30';
  }
}

interface ScoreCardProps {
  title: string;
  score: number | null | undefined;
  description?: string;
  isLoading?: boolean;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ScoreCard({
  title,
  score,
  description,
  isLoading = false,
  showPercentage = true,
  size = 'md',
  className,
}: ScoreCardProps) {
  const level = getScoreLevel(score);
  const scoreColor = getScoreColor(level);
  const progressColor = getProgressColor(level);
  const bgColor = getBgColor(level);

  const displayValue =
    score !== null && score !== undefined
      ? showPercentage
        ? `${Math.round(score * 100)}%`
        : score.toFixed(2)
      : 'N/A';

  const progressWidth = score !== null && score !== undefined ? score * 100 : 0;

  return (
    <Card className={cn('rounded-2xl transition-all', bgColor, className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle
          className={cn(
            'font-medium text-muted-foreground',
            size === 'sm' && 'text-xs',
            size === 'md' && 'text-sm',
            size === 'lg' && 'text-base'
          )}
        >
          {title}
        </CardTitle>
        {description && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs">{description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </>
        ) : (
          <>
            <div
              className={cn(
                'font-bold',
                scoreColor,
                size === 'sm' && 'text-xl',
                size === 'md' && 'text-2xl',
                size === 'lg' && 'text-3xl'
              )}
            >
              {displayValue}
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', progressColor)}
                style={{ width: `${progressWidth}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground capitalize">{level}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Metric descriptions for tooltips
export const METRIC_DESCRIPTIONS = {
  context_relevance: 'Measures how relevant the retrieved chunks are to the query.',
  context_precision: 'Measures if the most relevant chunks are ranked higher.',
  context_coverage: 'Measures if all aspects of the query are covered by chunks.',
  faithfulness: 'Measures if the answer is grounded in the context (no hallucinations).',
  answer_relevance: 'Measures if the answer directly addresses the question.',
  completeness: 'Measures if the answer covers all aspects of the question.',
  ground_truth_similarity: 'Measures similarity to the expected ground truth answer.',
  retrieval_score: 'Aggregate retrieval quality (relevance + precision + coverage).',
  answer_score: 'Aggregate answer quality (faithfulness + relevance + completeness).',
  overall_score: 'Combined score of retrieval and answer quality.',
} as const;

// Compact score display for tables
interface CompactScoreProps {
  score: number | null | undefined;
  className?: string;
}

export function CompactScore({ score, className }: CompactScoreProps) {
  const level = getScoreLevel(score);
  const scoreColor = getScoreColor(level);

  if (score === null || score === undefined) {
    return <span className={cn('text-muted-foreground', className)}>-</span>;
  }

  return (
    <span className={cn('font-medium', scoreColor, className)}>
      {Math.round(score * 100)}%
    </span>
  );
}

// Score badge for inline use
interface ScoreBadgeProps {
  score: number | null | undefined;
  label?: string;
  className?: string;
}

export function ScoreBadge({ score, label, className }: ScoreBadgeProps) {
  const level = getScoreLevel(score);
  const bgColor = getBgColor(level);
  const textColor = getScoreColor(level);

  if (score === null || score === undefined) {
    return null;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium',
        bgColor,
        textColor,
        className
      )}
    >
      {label && <span className="text-muted-foreground">{label}:</span>}
      {Math.round(score * 100)}%
    </span>
  );
}

// Stats summary card for aggregate metrics
interface EvalStatsSummaryProps {
  stats: {
    total_evaluations: number;
    avg_overall_score: number | null;
    avg_retrieval_score: number | null;
    avg_answer_score: number | null;
    excellent_count: number;
    good_count: number;
    moderate_count: number;
    poor_count: number;
  } | null | undefined;
  isLoading?: boolean;
  className?: string;
}

export function EvalStatsSummary({ stats, isLoading, className }: EvalStatsSummaryProps) {
  if (isLoading) {
    return (
      <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-4', className)}>
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="rounded-2xl">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-4', className)}>
      <ScoreCard
        title="Overall Score"
        score={stats.avg_overall_score}
        description={METRIC_DESCRIPTIONS.overall_score}
      />
      <ScoreCard
        title="Retrieval Score"
        score={stats.avg_retrieval_score}
        description={METRIC_DESCRIPTIONS.retrieval_score}
      />
      <ScoreCard
        title="Answer Score"
        score={stats.avg_answer_score}
        description={METRIC_DESCRIPTIONS.answer_score}
      />
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Evaluations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total_evaluations}</div>
          <div className="flex items-center gap-2 mt-2 text-xs">
            <span className="text-emerald-600">{stats.excellent_count} excellent</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-blue-600">{stats.good_count} good</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-amber-600">{stats.moderate_count} moderate</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-red-600">{stats.poor_count} poor</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
