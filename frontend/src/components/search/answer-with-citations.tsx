'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, FileText, Quote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type Citation } from '@/lib/api/search';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AnswerWithCitationsProps {
  answer: string;
  citations: Citation[];
  sources: string[];
  warning?: string | null;
  className?: string;
}

export function AnswerWithCitations({
  answer,
  citations,
  sources,
  warning,
  className,
}: AnswerWithCitationsProps) {
  const [showCitations, setShowCitations] = useState(false);

  const verifiedCitations = citations.filter((c) => c.verified);
  const unverifiedCitations = citations.filter((c) => !c.verified);

  return (
    <div className={cn('space-y-3', className)}>
      {/* Warning banner */}
      {warning && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-400">{warning}</p>
        </div>
      )}

      {/* Answer text */}
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{answer}</p>

      {/* Citation summary and toggle */}
      {citations.length > 0 && (
        <Collapsible open={showCitations} onOpenChange={setShowCitations}>
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              <span>
                Verified against{' '}
                <span className="font-medium text-foreground">
                  {sources.length} source{sources.length !== 1 && 's'}
                </span>
              </span>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs">
                {showCitations ? (
                  <>
                    Hide citations
                    <ChevronUp className="h-3 w-3" />
                  </>
                ) : (
                  <>
                    Show {citations.length} citation{citations.length !== 1 && 's'}
                    <ChevronDown className="h-3 w-3" />
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent className="pt-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="space-y-2">
              {/* Verified citations */}
              {verifiedCitations.length > 0 && (
                <div className="space-y-2">
                  {verifiedCitations.map((citation, index) => (
                    <CitationCard
                      key={index}
                      citation={citation}
                      index={index}
                    />
                  ))}
                </div>
              )}

              {/* Unverified citations */}
              {unverifiedCitations.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-dashed border-border/50">
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3" />
                    Unverified claims
                  </p>
                  {unverifiedCitations.map((citation, index) => (
                    <CitationCard
                      key={`unverified-${index}`}
                      citation={citation}
                      index={verifiedCitations.length + index}
                      isUnverified
                    />
                  ))}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Source list */}
      {sources.length > 0 && !showCitations && (
        <div className="flex flex-wrap gap-1.5 pt-2">
          {sources.map((source, index) => (
            <TooltipProvider key={index}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-md text-muted-foreground hover:text-foreground transition-colors cursor-default">
                    <span className="font-medium text-primary">[{index + 1}]</span>
                    <span className="truncate max-w-[120px]">{source}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">{source}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      )}
    </div>
  );
}

interface CitationCardProps {
  citation: Citation;
  index: number;
  isUnverified?: boolean;
}

function CitationCard({ citation, index: _index, isUnverified }: CitationCardProps) {
  return (
    <div
      className={cn(
        'p-3 rounded-lg border text-xs',
        isUnverified
          ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50'
          : 'bg-muted/50 border-border/50'
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            'font-medium shrink-0',
            isUnverified ? 'text-amber-600 dark:text-amber-400' : 'text-primary'
          )}
        >
          [{citation.source_index >= 0 ? citation.source_index + 1 : '?'}]
        </span>
        <div className="space-y-1.5 min-w-0">
          <p className="font-medium text-foreground">{citation.claim}</p>
          {citation.quote && (
            <div className="flex items-start gap-1.5 text-muted-foreground">
              <Quote className="h-3 w-3 shrink-0 mt-0.5" />
              <p className="italic line-clamp-2">&quot;{citation.quote}&quot;</p>
            </div>
          )}
          <p className="text-muted-foreground">
            Source: <span className="font-medium">{citation.source_name}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
