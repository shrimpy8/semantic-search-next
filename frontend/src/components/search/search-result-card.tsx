'use client';

import { FileText, ChevronDown, ChevronUp, CheckCircle2, Hash, Layers, BarChart2, ExternalLink, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { type SearchResult } from '@/lib/api';
import { cn } from '@/lib/utils';

interface SearchResultCardProps {
  result: SearchResult;
  rank: number;
  defaultShowScores?: boolean;
}

function ScoreIndicator({ score, label }: { score: number | null | undefined; label: string }) {
  const hasScore = score != null;
  const percentage = hasScore ? Math.min(score * 100, 100) : 0;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground w-16">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden relative">
        {hasScore ? (
          <div
            className="h-full bg-primary/70 rounded-full transition-all duration-500"
            style={{ width: `${Math.max(percentage, 2)}%` }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-medium text-red-500 dark:text-red-400">N/A</span>
          </div>
        )}
      </div>
      <span className={cn(
        "w-10 text-right tabular-nums",
        hasScore ? "text-muted-foreground" : "text-red-500 dark:text-red-400 font-medium"
      )}>
        {hasScore ? `${percentage.toFixed(0)}%` : 'N/A'}
      </span>
    </div>
  );
}

function RelevanceBadge({ percent }: { percent: number }) {
  const getColor = (p: number) => {
    if (p >= 80) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    if (p >= 50) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium tabular-nums",
      getColor(percent)
    )}>
      {percent}% match
    </span>
  );
}

function ChunkPositionBadge({ index, total }: { index: number; total: number }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-muted-foreground">
      <Layers className="h-3 w-3" />
      Chunk {index + 1} of {total}
    </span>
  );
}

export function SearchResultCard({ result, rank, defaultShowScores = false }: SearchResultCardProps) {
  const [showFullContent, setShowFullContent] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [showScores, setShowScores] = useState(defaultShowScores);

  const scores = result.scores;
  const relevancePercent = scores.relevance_percent;

  // Check if context is available
  const hasContextBefore = result.context_before && result.context_before.trim().length > 0;
  const hasContextAfter = result.context_after && result.context_after.trim().length > 0;
  const hasContext = hasContextBefore || hasContextAfter;
  const hasChunkPosition = result.chunk_index != null && result.total_chunks != null;

  return (
    <Card className={cn(
      "transition-all duration-200 hover:shadow-md border-muted-foreground/10",
      "hover:border-primary/20"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {/* Rank Badge */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
            {rank}
          </div>

          {/* Document Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="font-medium truncate">
                {result.document_name}
              </span>
            </div>
            {/* Metadata row with badges */}
            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {result.page && (
                <span>Page {result.page}</span>
              )}
              {result.section && (
                <span className="flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  {result.section}
                </span>
              )}
              {result.collection_name && (
                <span className="text-muted-foreground/70 inline-flex items-center gap-1">
                  in {result.collection_name}
                  {result.source_trusted ? (
                    <span className="inline-flex items-center gap-0.5 text-green-600 dark:text-green-400" role="status" aria-label="From trusted source">
                      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                      <span className="text-[11px]">Trusted</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-muted-foreground/50" role="status" aria-label="From unverified source">
                      <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                      <span className="text-[11px]">Unverified</span>
                    </span>
                  )}
                </span>
              )}
              <RelevanceBadge percent={relevancePercent} />
              {hasChunkPosition && (
                <span className="hidden sm:inline-flex">
                  <ChunkPositionBadge
                    index={result.chunk_index!}
                    total={result.total_chunks!}
                  />
                </span>
              )}
              {result.verified && (
                <span className="hidden sm:inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Verified
                </span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Context + Content Section */}
        <div className="space-y-0">
          {/* Context Before (dimmed, shown when toggled) */}
          {showContext && hasContextBefore && (
            <div className="relative animate-in fade-in slide-in-from-top-1 duration-200">
              <p className="text-sm text-muted-foreground/60 whitespace-pre-wrap leading-relaxed pb-2 border-b border-dashed border-muted-foreground/20 mb-2 italic">
                {result.context_before}
              </p>
            </div>
          )}

          {/* Main Content (highlighted when context shown) */}
          <div className={cn(
            "relative transition-all duration-200",
            showContext && hasContext && "pl-3 border-l-2 border-primary bg-primary/5 -ml-3 px-3 py-2 rounded-r-lg"
          )}>
            <p className={cn(
              "text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed",
              !showFullContent && !showContext && "line-clamp-3"
            )}>
              {result.content}
            </p>
          </div>

          {/* Context After (dimmed, shown when toggled) */}
          {showContext && hasContextAfter && (
            <div className="relative animate-in fade-in slide-in-from-bottom-1 duration-200">
              <p className="text-sm text-muted-foreground/60 whitespace-pre-wrap leading-relaxed pt-2 border-t border-dashed border-muted-foreground/20 mt-2 italic">
                {result.context_after}
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-2 border-t border-muted-foreground/10 flex items-center gap-2 flex-wrap">
          {/* Show Full Content Toggle (only if content is long and context not shown) */}
          {result.content.length > 200 && !showContext && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowFullContent(!showFullContent)}
            >
              {showFullContent ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Show more
                </>
              )}
            </Button>
          )}

          {/* Context Toggle (only if context available) */}
          {hasContext && (
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-2 text-xs",
                showContext
                  ? "text-primary hover:text-primary/80"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => {
                setShowContext(!showContext);
                if (!showContext) setShowFullContent(true);
              }}
            >
              <Layers className="h-3 w-3 mr-1" />
              {showContext ? 'Hide context' : 'Show context'}
            </Button>
          )}

          {/* Score Breakdown Toggle */}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2 text-xs",
              showScores
                ? "text-primary hover:text-primary/80"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setShowScores(!showScores)}
          >
            <BarChart2 className="h-3 w-3 mr-1" />
            {showScores ? 'Hide scores' : 'Score breakdown'}
          </Button>

          {/* View Document Link - Push to right */}
          <div className="flex-1" />
          <Link
            href={`/documents/${result.document_id}${result.chunk_index != null ? `?chunk=${result.chunk_index}` : ''}`}
          >
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View Document
            </Button>
          </Link>
        </div>

        {/* Detailed Scores - Show when toggled */}
        {showScores && (
          <div className="p-3 rounded-lg bg-muted/50 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <p className="text-xs font-medium text-muted-foreground mb-2">Score Breakdown</p>
            <ScoreIndicator score={scores.semantic_score} label="Semantic" />
            <ScoreIndicator score={scores.bm25_score} label="Keyword" />
            <ScoreIndicator score={scores.rerank_score} label="Rerank" />
            <div className="pt-2 border-t border-muted-foreground/10">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Final Score</span>
                <span className="font-medium">{(scores.final_score * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
