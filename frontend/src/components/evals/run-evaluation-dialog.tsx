'use client';

import { useState, useEffect } from 'react';
import {
  FlaskConical,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useRunEvaluation, useEvalProviders, useGroundTruths } from '@/hooks';
import { useCollections } from '@/hooks';
import { ScoreCard, CompactScore, METRIC_DESCRIPTIONS } from './score-card';
import type { EvaluateRequest, ChunkForEvaluation, EvaluationResult } from '@/lib/api/evals';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface RunEvaluationDialogProps {
  trigger?: React.ReactNode;
  // Optional pre-filled values from search
  initialQuery?: string;
  initialAnswer?: string;
  initialChunks?: ChunkForEvaluation[];
  searchQueryId?: string;
  className?: string;
  // Search configuration (optional - captured for comparison)
  searchAlpha?: number | null;
  searchPreset?: string | null;
  searchUseReranker?: boolean | null;
  rerankerProvider?: string | null;
  chunkSize?: number | null;
  chunkOverlap?: number | null;
  embeddingModel?: string | null;
  answerModel?: string | null;
}

export function RunEvaluationDialog({
  trigger,
  initialQuery = '',
  initialAnswer = '',
  initialChunks = [],
  searchQueryId,
  className,
  searchAlpha,
  searchPreset,
  searchUseReranker,
  rerankerProvider,
  chunkSize,
  chunkOverlap,
  embeddingModel,
  answerModel,
}: RunEvaluationDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [result, setResult] = useState<EvaluationResult | null>(null);

  // Form state
  const [query, setQuery] = useState(initialQuery);
  const [answer, setAnswer] = useState(initialAnswer);
  const [chunksText, setChunksText] = useState(
    initialChunks.map((c) => c.content).join('\n---\n')
  );
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedGroundTruth, setSelectedGroundTruth] = useState<string>('');
  const [selectedCollection, setSelectedCollection] = useState<string>('');

  // Fetch data
  const { data: providers } = useEvalProviders();
  const { data: collections } = useCollections();
  const { data: groundTruths } = useGroundTruths({
    collection_id: selectedCollection || undefined,
    limit: 100,
  });

  // Mutation
  const evalMutation = useRunEvaluation();

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery);
      setAnswer(initialAnswer);
      setChunksText(initialChunks.map((c) => c.content).join('\n---\n'));
      setResult(null);
    }
  }, [isOpen, initialQuery, initialAnswer, initialChunks]);

  const parseChunks = (text: string): ChunkForEvaluation[] => {
    return text
      .split('\n---\n')
      .map((content) => content.trim())
      .filter(Boolean)
      .map((content) => ({ content }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const chunks = parseChunks(chunksText);
    if (chunks.length === 0) {
      toast.error('Please provide at least one chunk');
      return;
    }

    const request: EvaluateRequest = {
      query,
      answer,
      chunks,
      ground_truth_id: selectedGroundTruth || undefined,
      search_query_id: searchQueryId,
      provider: selectedProvider || undefined,
      // Include search configuration if provided
      search_alpha: searchAlpha ?? undefined,
      search_preset: searchPreset ?? undefined,
      search_use_reranker: searchUseReranker ?? undefined,
      reranker_provider: rerankerProvider ?? undefined,
      chunk_size: chunkSize ?? undefined,
      chunk_overlap: chunkOverlap ?? undefined,
      embedding_model: embeddingModel ?? undefined,
      answer_model: answerModel ?? undefined,
    };

    try {
      const evalResult = await evalMutation.mutateAsync(request);
      setResult(evalResult);
      toast.success('Evaluation complete');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Evaluation failed';
      toast.error(message);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setResult(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className={cn('rounded-xl', className)}>
            <FlaskConical className="mr-2 h-4 w-4" />
            Run Evaluation
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            Run Evaluation
          </DialogTitle>
          <DialogDescription>
            Evaluate a Q&A pair using LLM-as-Judge to measure retrieval and answer
            quality.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <EvaluationResultView result={result} onClose={handleClose} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Query */}
            <div className="space-y-2">
              <Label htmlFor="eval-query">Query *</Label>
              <Textarea
                id="eval-query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="The search query to evaluate"
                className="rounded-xl min-h-[60px]"
                required
              />
            </div>

            {/* Answer */}
            <div className="space-y-2">
              <Label htmlFor="eval-answer">Generated Answer *</Label>
              <Textarea
                id="eval-answer"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="The AI-generated answer to evaluate"
                className="rounded-xl min-h-[100px]"
                required
              />
            </div>

            {/* Chunks */}
            <div className="space-y-2">
              <Label htmlFor="eval-chunks">Retrieved Chunks *</Label>
              <Textarea
                id="eval-chunks"
                value={chunksText}
                onChange={(e) => setChunksText(e.target.value)}
                placeholder="Paste retrieved chunks here. Separate multiple chunks with '---' on its own line."
                className="rounded-xl min-h-[120px] font-mono text-sm"
                required
              />
              <p className="text-xs text-muted-foreground">
                Separate multiple chunks with &quot;---&quot; on its own line
              </p>
            </div>

            {/* Advanced Options */}
            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between text-muted-foreground"
                >
                  Advanced Options
                  {showAdvanced ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                {/* Provider Selection */}
                <div className="space-y-2">
                  <Label>Judge Provider</Label>
                  <Select
                    value={selectedProvider || '__default__'}
                    onValueChange={(v) => setSelectedProvider(v === '__default__' ? '' : v)}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Default (from config)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default__">Default</SelectItem>
                      {providers?.available.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Ground Truth Selection */}
                <div className="space-y-2">
                  <Label>Compare to Ground Truth</Label>
                  <div className="flex gap-2">
                    <Select
                      value={selectedCollection || '__all__'}
                      onValueChange={(v) => {
                        setSelectedCollection(v === '__all__' ? '' : v);
                        setSelectedGroundTruth('');
                      }}
                    >
                      <SelectTrigger className="w-[150px] rounded-xl">
                        <SelectValue placeholder="Collection" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All</SelectItem>
                        {collections?.data?.map((col) => (
                          <SelectItem key={col.id} value={col.id}>
                            {col.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={selectedGroundTruth || '__none__'}
                      onValueChange={(v) => setSelectedGroundTruth(v === '__none__' ? '' : v)}
                    >
                      <SelectTrigger className="flex-1 rounded-xl">
                        <SelectValue placeholder="Select ground truth" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {groundTruths?.data.map((gt) => (
                          <SelectItem key={gt.id} value={gt.id}>
                            {gt.query.length > 50
                              ? gt.query.slice(0, 50) + '...'
                              : gt.query}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Compare against an expected answer for ground truth similarity
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <DialogFooter className="gap-2 sm:gap-0 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={evalMutation.isPending || !query || !answer || !chunksText}
                className="rounded-xl"
              >
                {evalMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Evaluating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Run Evaluation
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface EvaluationResultViewProps {
  result: EvaluationResult;
  onClose: () => void;
}

function EvaluationResultView({ result, onClose }: EvaluationResultViewProps) {
  const hasError = !!result.error_message;

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div
        className={cn(
          'flex items-center gap-3 p-4 rounded-xl',
          hasError ? 'bg-destructive/10' : 'bg-emerald-500/10'
        )}
      >
        {hasError ? (
          <AlertCircle className="h-5 w-5 text-destructive" />
        ) : (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        )}
        <div>
          <p className={cn('font-medium', hasError ? 'text-destructive' : 'text-emerald-600')}>
            {hasError ? 'Evaluation completed with errors' : 'Evaluation successful'}
          </p>
          {result.eval_latency_ms && (
            <p className="text-sm text-muted-foreground">
              Completed in {result.eval_latency_ms}ms using {result.judge_provider}/
              {result.judge_model}
            </p>
          )}
        </div>
      </div>

      {/* Error Message */}
      {hasError && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {result.error_message}
        </div>
      )}

      {/* Score Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <ScoreCard
          title="Overall Score"
          score={result.scores.overall_score}
          description={METRIC_DESCRIPTIONS.overall_score}
          size="lg"
        />
        <ScoreCard
          title="Retrieval Score"
          score={result.scores.retrieval_score}
          description={METRIC_DESCRIPTIONS.retrieval_score}
        />
        <ScoreCard
          title="Answer Score"
          score={result.scores.answer_score}
          description={METRIC_DESCRIPTIONS.answer_score}
        />
      </div>

      {/* Detailed Metrics */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Retrieval Metrics */}
        <div className="p-4 rounded-xl bg-muted/30 space-y-3">
          <h4 className="text-sm font-medium">Retrieval Metrics</h4>
          <div className="space-y-2">
            <MetricRow label="Context Relevance" score={result.scores.context_relevance} />
            <MetricRow label="Context Precision" score={result.scores.context_precision} />
            <MetricRow label="Context Coverage" score={result.scores.context_coverage} />
          </div>
        </div>

        {/* Answer Metrics */}
        <div className="p-4 rounded-xl bg-muted/30 space-y-3">
          <h4 className="text-sm font-medium">Answer Metrics</h4>
          <div className="space-y-2">
            <MetricRow label="Faithfulness" score={result.scores.faithfulness} />
            <MetricRow label="Answer Relevance" score={result.scores.answer_relevance} />
            <MetricRow label="Completeness" score={result.scores.completeness} />
          </div>
        </div>
      </div>

      {/* Ground Truth Similarity */}
      {result.scores.ground_truth_similarity !== null && (
        <div className="p-4 rounded-xl bg-muted/30 space-y-3">
          <h4 className="text-sm font-medium">Ground Truth Comparison</h4>
          <MetricRow
            label="Similarity to Expected Answer"
            score={result.scores.ground_truth_similarity}
          />
        </div>
      )}

      {/* Close Button */}
      <DialogFooter>
        <Button onClick={onClose} className="rounded-xl w-full sm:w-auto">
          Done
        </Button>
      </DialogFooter>
    </div>
  );
}

function MetricRow({ label, score }: { label: string; score: number | null }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <CompactScore score={score} />
    </div>
  );
}

// Quick evaluation button for search results
interface QuickEvalButtonProps {
  query: string;
  answer: string;
  chunks: ChunkForEvaluation[];
  searchQueryId?: string;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'icon';
  className?: string;
}

export function QuickEvalButton({
  query,
  answer,
  chunks,
  searchQueryId,
  variant = 'ghost',
  size = 'sm',
  className,
}: QuickEvalButtonProps) {
  return (
    <RunEvaluationDialog
      initialQuery={query}
      initialAnswer={answer}
      initialChunks={chunks}
      searchQueryId={searchQueryId}
      trigger={
        <Button variant={variant} size={size} className={cn('rounded-lg', className)}>
          <FlaskConical className="h-4 w-4" />
          {size !== 'icon' && <span className="ml-2">Evaluate</span>}
        </Button>
      }
    />
  );
}
