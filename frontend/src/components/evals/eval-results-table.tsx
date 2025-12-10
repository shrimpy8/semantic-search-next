'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CompactScore } from './score-card';
import type { EvaluationResult } from '@/lib/api/evals';
import { cn } from '@/lib/utils';

// Helper to format preset as single letter
function formatPreset(preset: string | null | undefined): string {
  if (!preset) return '-';
  switch (preset.toLowerCase()) {
    case 'balanced':
      return 'B';
    case 'high_precision':
      return 'P';
    case 'high_recall':
      return 'R';
    case 'custom':
      return 'C';
    default:
      return preset.charAt(0).toUpperCase();
  }
}

// Helper to get full preset name
function getPresetFullName(preset: string | null | undefined): string {
  if (!preset) return 'Not specified';
  switch (preset.toLowerCase()) {
    case 'balanced':
      return 'Balanced';
    case 'high_precision':
      return 'High Precision';
    case 'high_recall':
      return 'High Recall';
    case 'custom':
      return 'Custom';
    default:
      return preset;
  }
}

// Helper to format reranker
function formatReranker(
  useReranker: boolean | null | undefined,
  provider: string | null | undefined
): string {
  if (useReranker === false) return 'NA';
  if (!provider) return useReranker ? '?' : '-';
  switch (provider.toLowerCase()) {
    case 'jina':
      return 'J';
    case 'cohere':
      return 'C';
    default:
      return provider.charAt(0).toUpperCase();
  }
}

// Helper to format judge provider
function formatJudge(provider: string): string {
  switch (provider.toLowerCase()) {
    case 'openai':
      return 'O';
    case 'anthropic':
      return 'A';
    default:
      return provider.charAt(0).toUpperCase();
  }
}

// Helper to get full judge name
function getJudgeFullName(provider: string, model: string): string {
  const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
  // Shorten model name for display
  const shortModel = model.includes('gpt-4o') ? 'gpt-4o-mini'
    : model.includes('claude-sonnet') ? 'claude-sonnet'
    : model;
  return `${providerName} (${shortModel})`;
}

// Helper to get full reranker name
function getRerankerFullName(
  useReranker: boolean | null | undefined,
  provider: string | null | undefined
): string {
  if (useReranker === false) return 'Not Applied';
  if (!provider) return useReranker ? 'Unknown' : 'Not specified';
  switch (provider.toLowerCase()) {
    case 'jina':
      return 'Jina';
    case 'cohere':
      return 'Cohere';
    default:
      return provider;
  }
}

interface EvalResultsTableProps {
  results: EvaluationResult[] | undefined;
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  className?: string;
}

export function EvalResultsTable({
  results,
  isLoading,
  hasMore,
  onLoadMore,
  className,
}: EvalResultsTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (isLoading && !results?.length) {
    return (
      <Card className={cn('rounded-2xl', className)}>
        <CardHeader>
          <CardTitle className="text-lg">Evaluation Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-6" />
                <Skeleton className="h-4 w-6" />
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!results?.length) {
    return (
      <Card className={cn('rounded-2xl', className)}>
        <CardHeader>
          <CardTitle className="text-lg">Evaluation Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>No evaluation results yet.</p>
            <p className="text-sm mt-1">Run an evaluation to see results here.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('rounded-2xl', className)}>
      <CardHeader>
        <CardTitle className="text-lg">Evaluation Results</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Query</TableHead>
                <TableHead className="text-center">Overall</TableHead>
                <TableHead className="text-center">Retrieval</TableHead>
                <TableHead className="text-center">Answer</TableHead>
                <TableHead className="text-center">
                  <Tooltip>
                    <TooltipTrigger className="flex items-center gap-1 justify-center">
                      Alpha
                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Semantic weight (0% = BM25 only, 100% = semantic only)</p>
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-center">
                  <Tooltip>
                    <TooltipTrigger className="flex items-center gap-1 justify-center">
                      Mode
                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>B=Balanced, P=High Precision, R=High Recall, C=Custom</p>
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-center">
                  <Tooltip>
                    <TooltipTrigger className="flex items-center gap-1 justify-center">
                      Rerank
                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>J=Jina, C=Cohere, NA=Not Applied</p>
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-center">
                  <Tooltip>
                    <TooltipTrigger className="flex items-center gap-1 justify-center">
                      Chunk
                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Chunk size in characters</p>
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-center">
                  <Tooltip>
                    <TooltipTrigger className="flex items-center gap-1 justify-center">
                      Overlap
                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Chunk overlap in characters</p>
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-center">
                  <Tooltip>
                    <TooltipTrigger className="flex items-center gap-1 justify-center">
                      Judge
                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>O=OpenAI, A=Anthropic</p>
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((result) => (
                <EvalResultRow
                  key={result.id}
                  result={result}
                  isExpanded={expandedIds.has(result.id)}
                  onToggle={() => toggleExpanded(result.id)}
                />
              ))}
            </TableBody>
          </Table>
        </TooltipProvider>

        {hasMore && (
          <div className="flex justify-center pt-4 px-6">
            <Button
              variant="outline"
              onClick={onLoadMore}
              disabled={isLoading}
              className="rounded-xl"
            >
              {isLoading ? (
                <>Loading...</>
              ) : (
                <>
                  Load more
                  <ChevronDown className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface EvalResultRowProps {
  result: EvaluationResult;
  isExpanded: boolean;
  onToggle: () => void;
}

function EvalResultRow({ result, isExpanded, onToggle }: EvalResultRowProps) {
  const hasError = !!result.error_message;
  const truncatedQuery =
    result.query.length > 60 ? result.query.slice(0, 60) + '...' : result.query;
  const config = result.search_config;

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={onToggle}
      >
        <TableCell className="w-8">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            {hasError ? (
              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
            )}
            <span className="truncate max-w-[200px]" title={result.query}>
              {truncatedQuery}
            </span>
          </div>
        </TableCell>
        <TableCell className="text-center">
          <CompactScore score={result.scores.overall_score} />
        </TableCell>
        <TableCell className="text-center">
          <CompactScore score={result.scores.retrieval_score} />
        </TableCell>
        <TableCell className="text-center">
          <CompactScore score={result.scores.answer_score} />
        </TableCell>
        {/* Alpha */}
        <TableCell className="text-center text-sm text-muted-foreground">
          {config?.search_alpha != null ? `${Math.round(config.search_alpha * 100)}%` : '-'}
        </TableCell>
        {/* Mode/Preset */}
        <TableCell className="text-center">
          <Tooltip>
            <TooltipTrigger>
              <span className="text-sm font-medium">
                {formatPreset(config?.search_preset)}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{getPresetFullName(config?.search_preset)}</p>
            </TooltipContent>
          </Tooltip>
        </TableCell>
        {/* Reranker */}
        <TableCell className="text-center">
          <Tooltip>
            <TooltipTrigger>
              <span className="text-sm font-medium">
                {formatReranker(config?.search_use_reranker, config?.reranker_provider)}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{getRerankerFullName(config?.search_use_reranker, config?.reranker_provider)}</p>
            </TooltipContent>
          </Tooltip>
        </TableCell>
        {/* Chunk Size */}
        <TableCell className="text-center text-sm text-muted-foreground">
          {config?.chunk_size ?? '-'}
        </TableCell>
        {/* Chunk Overlap */}
        <TableCell className="text-center text-sm text-muted-foreground">
          {config?.chunk_overlap ?? '-'}
        </TableCell>
        {/* Judge */}
        <TableCell className="text-center">
          <Tooltip>
            <TooltipTrigger>
              <span className="text-sm font-medium">
                {formatJudge(result.judge_provider)}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{getJudgeFullName(result.judge_provider, result.judge_model)}</p>
            </TooltipContent>
          </Tooltip>
        </TableCell>
        <TableCell className="text-right text-muted-foreground text-sm">
          {formatDistanceToNow(new Date(result.created_at), { addSuffix: true })}
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={12} className="p-0">
            <EvalResultDetails result={result} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function EvalResultDetails({ result }: { result: EvaluationResult }) {
  return (
    <div className="p-4 space-y-4">
      {/* Error message */}
      {result.error_message && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{result.error_message}</span>
        </div>
      )}

      {/* Query and Answer */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="text-sm font-medium mb-2">Query</h4>
          <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
            {result.query}
          </p>
        </div>
        <div>
          <h4 className="text-sm font-medium mb-2">Generated Answer</h4>
          <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 max-h-32 overflow-y-auto">
            {result.generated_answer || 'No answer generated'}
          </p>
        </div>
      </div>

      {/* Expected Answer (if exists) */}
      {result.expected_answer && (
        <div>
          <h4 className="text-sm font-medium mb-2">Expected Answer (Ground Truth)</h4>
          <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 max-h-32 overflow-y-auto">
            {result.expected_answer}
          </p>
        </div>
      )}

      {/* Detailed Scores */}
      <div>
        <h4 className="text-sm font-medium mb-3">Detailed Scores</h4>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Retrieval Metrics */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Retrieval
            </span>
            <div className="space-y-1">
              <ScoreItem
                label="Context Relevance"
                score={result.scores.context_relevance}
              />
              <ScoreItem
                label="Context Precision"
                score={result.scores.context_precision}
              />
              <ScoreItem
                label="Context Coverage"
                score={result.scores.context_coverage}
              />
            </div>
          </div>

          {/* Answer Metrics */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Answer Quality
            </span>
            <div className="space-y-1">
              <ScoreItem label="Faithfulness" score={result.scores.faithfulness} />
              <ScoreItem label="Answer Relevance" score={result.scores.answer_relevance} />
              <ScoreItem label="Completeness" score={result.scores.completeness} />
            </div>
          </div>

          {/* Ground Truth */}
          {result.scores.ground_truth_similarity !== null && (
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Ground Truth
              </span>
              <div className="space-y-1">
                <ScoreItem
                  label="Similarity"
                  score={result.scores.ground_truth_similarity}
                />
              </div>
            </div>
          )}

          {/* Aggregate Scores */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Aggregate
            </span>
            <div className="space-y-1">
              <ScoreItem label="Overall" score={result.scores.overall_score} />
              <ScoreItem label="Retrieval" score={result.scores.retrieval_score} />
              <ScoreItem label="Answer" score={result.scores.answer_score} />
            </div>
          </div>
        </div>
      </div>

      {/* Models Used - Clear 4-model breakdown */}
      <div className="pt-3 border-t">
        <h4 className="text-sm font-medium mb-3">Models Used</h4>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Embedding Model */}
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              Embedding
            </span>
            <p className="text-sm font-medium mt-1 text-blue-900 dark:text-blue-100">
              openai/{result.search_config?.embedding_model || 'text-embedding-3-large'}
            </p>
            <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-0.5">
              Semantic search vectors
            </p>
          </div>

          {/* Reranker */}
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Rerank
            </span>
            <p className="text-sm font-medium mt-1 text-emerald-900 dark:text-emerald-100">
              {result.search_config?.search_use_reranker === false
                ? 'Disabled'
                : result.search_config?.reranker_provider
                  ? `${result.search_config.reranker_provider}/cross-encoder`
                  : 'auto/jina-reranker-v1-tiny'}
            </p>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">
              {result.search_config?.search_use_reranker === false
                ? 'Not applied to results'
                : 'Re-ordered results by relevance'}
            </p>
          </div>

          {/* Answer LLM */}
          <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
            <span className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wider">
              Answer Generation
            </span>
            <p className="text-sm font-medium mt-1 text-purple-900 dark:text-purple-100">
              openai/{result.search_config?.answer_model || 'gpt-4o-mini'}
            </p>
            <p className="text-xs text-purple-600/70 dark:text-purple-400/70 mt-0.5">
              Generated AI answer
            </p>
          </div>

          {/* Judge LLM */}
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Eval Judge
            </span>
            <p className="text-sm font-medium mt-1 text-amber-900 dark:text-amber-100">
              {result.judge_provider}/{result.judge_model}
            </p>
            <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-0.5">
              Scored the response
            </p>
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-muted-foreground">
        {result.eval_latency_ms && (
          <span>Evaluation latency: {result.eval_latency_ms}ms</span>
        )}
        {result.ground_truth_id && (
          <Badge variant="secondary" className="rounded-md">
            Has Ground Truth
          </Badge>
        )}
      </div>
    </div>
  );
}

function ScoreItem({
  label,
  score,
}: {
  label: string;
  score: number | null;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <CompactScore score={score} />
    </div>
  );
}

// Pagination component for results
interface EvalResultsPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function EvalResultsPagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: EvalResultsPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className={cn('flex items-center justify-center gap-2', className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 0}
        className="rounded-lg"
      >
        <ChevronLeft className="h-4 w-4" />
        Previous
      </Button>
      <span className="text-sm text-muted-foreground px-2">
        Page {currentPage + 1} of {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages - 1}
        className="rounded-lg"
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
