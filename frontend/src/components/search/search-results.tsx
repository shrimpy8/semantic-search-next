'use client';

import { useState } from 'react';
import { SearchResultCard } from './search-result-card';
import { ConfidenceBadge } from './confidence-badge';
import { AnswerWithCitations } from './answer-with-citations';
import { type SearchResponse } from '@/lib/api';
import { Clock, Search, Sparkles, Lightbulb, RefreshCw, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SearchResultsProps {
  data: SearchResponse | null;
  isLoading: boolean;
}

export function SearchResults({ data, isLoading }: SearchResultsProps) {
  const [showLowConfidence, setShowLowConfidence] = useState(false);
  if (isLoading) {
    return <SearchResultsSkeleton />;
  }

  if (!data) {
    return null;
  }

  // Only show "no results" when there are truly no results at all (neither high nor low confidence)
  const totalResults = data.results.length + data.low_confidence_count;

  if (totalResults === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-muted-foreground/20 animate-in fade-in duration-300">
        {/* Glowing icon */}
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-muted-foreground/10 rounded-2xl blur-xl" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-2">No results found</h3>
        <p className="text-muted-foreground max-w-sm mb-6 leading-relaxed">
          We couldn&apos;t find any matches for &quot;{data.query}&quot; in your documents.
        </p>

        {/* Suggestions */}
        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-3">Try these suggestions:</p>
          <div className="flex flex-col gap-2 items-start text-left max-w-xs">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <span>Use different or simpler keywords</span>
            </div>
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-blue-500" />
              <span>Try a different retrieval preset</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Ask a question instead of keywords</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hasLowConfidenceResults = data.low_confidence_count > 0;
  const hasHighConfidenceResults = data.results.length > 0;
  const thresholdPercent = Math.round(data.min_score_threshold * 100);

  // Special case: Only low-confidence results found
  if (!hasHighConfidenceResults && hasLowConfidenceResults) {
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {/* No high-confidence results message */}
        <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              No confident matches found
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
              Your search for &quot;{data.query}&quot; returned {data.low_confidence_count} result{data.low_confidence_count !== 1 && 's'} below
              the {thresholdPercent}% relevance threshold. These may not be relevant to your query.
            </p>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-background/50 px-2 py-1 rounded-full">
            <Clock className="h-3 w-3" />
            {data.latency_ms}ms
          </span>
        </div>

        {/* Toggle to show low confidence results */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowLowConfidence(!showLowConfidence)}
          className="w-full justify-center gap-2"
        >
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          {showLowConfidence ? (
            <>
              Hide low confidence results
              <ChevronUp className="h-4 w-4" />
            </>
          ) : (
            <>
              Show {data.low_confidence_count} low confidence result{data.low_confidence_count !== 1 && 's'}
              <ChevronDown className="h-4 w-4" />
            </>
          )}
        </Button>

        {showLowConfidence && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            {data.low_confidence_results.map((result, index) => (
              <div key={result.id} className="relative">
                <div className="absolute -left-2 top-0 bottom-0 w-1 bg-amber-400 dark:bg-amber-600 rounded-full" />
                <SearchResultCard result={result} rank={index + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Results header */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          <span className="font-medium text-foreground">{data.results.length}</span>
          {' '}result{data.results.length !== 1 && 's'} for{' '}
          <span className="font-medium text-foreground">&quot;{data.query}&quot;</span>
        </span>
        <div className="flex items-center gap-2">
          {/* Low confidence toggle button - shown inline with latency */}
          {hasLowConfidenceResults && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLowConfidence(!showLowConfidence)}
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2"
            >
              <AlertTriangle className="h-3 w-3 text-amber-500" />
              {showLowConfidence ? (
                <>
                  Hide {data.low_confidence_count} low confidence
                  <ChevronUp className="h-3 w-3" />
                </>
              ) : (
                <>
                  Show {data.low_confidence_count} low confidence
                  <ChevronDown className="h-3 w-3" />
                </>
              )}
            </Button>
          )}
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            <Clock className="h-3 w-3" />
            {data.latency_ms}ms
          </span>
        </div>
      </div>

      {/* AI Answer card with verification */}
      {data.answer && (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-sm font-semibold">AI Answer</h3>
              </div>
              {data.answer_verification && (
                <ConfidenceBadge
                  confidence={data.answer_verification.confidence}
                  coveragePercent={data.answer_verification.coverage_percent}
                  verifiedClaims={data.answer_verification.verified_claims}
                  totalClaims={data.answer_verification.total_claims}
                />
              )}
            </div>
          </CardHeader>
          <CardContent>
            {data.answer_verification ? (
              <AnswerWithCitations
                answer={data.answer}
                citations={data.answer_verification.citations}
                sources={data.sources || []}
                warning={data.answer_verification.warning}
              />
            ) : (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{data.answer}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* High-confidence results list */}
      <div className="space-y-3">
        {data.results.map((result, index) => (
          <SearchResultCard key={result.id} result={result} rank={index + 1} />
        ))}
      </div>

      {/* Low confidence results section - shown when toggled from header button */}
      {hasLowConfidenceResults && showLowConfidence && (
        <div className="pt-4 border-t border-dashed border-muted-foreground/20 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Warning banner */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              These results have relevance scores below {thresholdPercent}% and may not be relevant to your query.
              You can adjust this threshold in Settings.
            </p>
          </div>

          {/* Low confidence results */}
          {data.low_confidence_results.map((result, index) => (
            <div key={result.id} className="relative">
              <div className="absolute -left-2 top-0 bottom-0 w-1 bg-amber-400 dark:bg-amber-600 rounded-full" />
              <SearchResultCard
                result={result}
                rank={data.results.length + index + 1}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchResultsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-40" />
              </div>
              <Skeleton className="h-3 w-32 mt-1" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
