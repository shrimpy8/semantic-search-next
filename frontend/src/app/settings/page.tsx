'use client';

import { useState, useEffect } from 'react';
import { useSettings, useUpdateSettings, useResetSettings, useSetupValidation } from '@/hooks';
import { Settings as SettingsIcon, RefreshCw, Save, AlertCircle, Info, ExternalLink, Sparkles, Layers, CheckCircle2, Clock, Zap, FlaskConical, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { ColorZoneSlider } from '@/components/ui/color-zone-slider';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Settings, SettingsUpdate } from '@/lib/api';

// Chunk size zones: green (optimal), yellow (caution), red (danger)
const CHUNK_SIZE_ZONES = [
  { min: 100, max: 199, color: 'red' as const, label: 'Too small' },
  { min: 200, max: 499, color: 'yellow' as const, label: 'Small' },
  { min: 500, max: 1500, color: 'green' as const, label: 'Optimal' },
  { min: 1501, max: 2500, color: 'yellow' as const, label: 'Large' },
  { min: 2501, max: 4000, color: 'red' as const, label: 'Too large' },
];

// Chunk overlap zones (relative to chunk size)
const CHUNK_OVERLAP_ZONES = [
  { min: 0, max: 49, color: 'yellow' as const, label: 'Low' },
  { min: 50, max: 400, color: 'green' as const, label: 'Optimal' },
  { min: 401, max: 800, color: 'yellow' as const, label: 'High' },
  { min: 801, max: 1000, color: 'red' as const, label: 'Excessive' },
];

// Embedding provider configurations with descriptions and URLs
const EMBEDDING_PROVIDERS = {
  openai: {
    label: 'OpenAI',
    description: 'Industry-standard cloud embeddings with excellent quality. Requires API key.',
    docsUrl: 'https://platform.openai.com/docs/guides/embeddings',
    pricingUrl: 'https://openai.com/pricing',
    requiresApiKey: true,
    envVar: 'OPENAI_API_KEY',
    models: [
      { value: 'text-embedding-3-large', label: 'text-embedding-3-large', dims: 3072, description: 'Best quality' },
      { value: 'text-embedding-3-small', label: 'text-embedding-3-small', dims: 1536, description: 'Fast & cheap' },
      { value: 'text-embedding-ada-002', label: 'text-embedding-ada-002', dims: 1536, description: 'Legacy' },
    ],
  },
  ollama: {
    label: 'Ollama (Local)',
    description: 'Run embeddings locally on your Mac. No API key needed, fully private. Great for Mac M4 with 24GB RAM.',
    docsUrl: 'https://ollama.com/library',
    downloadUrl: 'https://ollama.com/download',
    requiresApiKey: false,
    models: [
      { value: 'ollama:nomic-embed-text:v1.5', label: 'nomic-embed-text:v1.5', dims: 768, description: 'Latest, fast' },
      { value: 'ollama:nomic-embed-text', label: 'nomic-embed-text', dims: 768, description: 'Fast, good quality' },
      { value: 'ollama:mxbai-embed-large:335m', label: 'mxbai-embed-large:335m', dims: 1024, description: 'High quality' },
      { value: 'ollama:mxbai-embed-large', label: 'mxbai-embed-large', dims: 1024, description: 'High quality' },
      { value: 'ollama:embeddinggemma', label: 'embeddinggemma', dims: 768, description: 'Google Gemma' },
      { value: 'ollama:jina/jina-embeddings-v2-base-en', label: 'jina-embeddings-v2', dims: 768, description: 'Jina via Ollama' },
      { value: 'ollama:snowflake-arctic-embed', label: 'snowflake-arctic-embed', dims: 1024, description: 'Strong retrieval' },
    ],
  },
  jina: {
    label: 'Jina AI',
    description: 'Open-source embeddings with a generous free tier (1M tokens/month). Great for getting started.',
    docsUrl: 'https://jina.ai/embeddings/',
    signupUrl: 'https://jina.ai/embeddings/#apiform',
    requiresApiKey: true,
    envVar: 'JINA_API_KEY',
    models: [
      { value: 'jina:jina-embeddings-v2-base-en', label: 'jina-embeddings-v2-base-en', dims: 768, description: 'English, free tier' },
      { value: 'jina:jina-embeddings-v3', label: 'jina-embeddings-v3', dims: 1024, description: 'Latest, multilingual' },
    ],
  },
  cohere: {
    label: 'Cohere',
    description: 'Enterprise-grade embeddings optimized for search and retrieval. Trial API key available.',
    docsUrl: 'https://docs.cohere.com/docs/embeddings',
    signupUrl: 'https://dashboard.cohere.com/api-keys',
    requiresApiKey: true,
    envVar: 'COHERE_API_KEY',
    models: [
      { value: 'cohere:embed-english-v3.0', label: 'embed-english-v3.0', dims: 1024, description: 'English optimized' },
      { value: 'cohere:embed-multilingual-v3.0', label: 'embed-multilingual-v3.0', dims: 1024, description: '100+ languages' },
    ],
  },
  voyage: {
    label: 'Voyage AI',
    description: 'Embeddings specifically optimized for RAG and retrieval applications. Top performance on benchmarks.',
    docsUrl: 'https://docs.voyageai.com/docs/embeddings',
    signupUrl: 'https://dash.voyageai.com/',
    requiresApiKey: true,
    envVar: 'VOYAGE_API_KEY',
    models: [
      { value: 'voyage:voyage-large-2', label: 'voyage-large-2', dims: 1536, description: 'Best for RAG' },
      { value: 'voyage:voyage-code-2', label: 'voyage-code-2', dims: 1536, description: 'Code optimized' },
    ],
  },
};

// Helper to find provider info from model value
function getProviderFromModel(modelValue: string | undefined): { key: string; provider: typeof EMBEDDING_PROVIDERS[keyof typeof EMBEDDING_PROVIDERS] } | null {
  if (!modelValue) return null;
  for (const [key, provider] of Object.entries(EMBEDDING_PROVIDERS)) {
    if (provider.models.some(m => m.value === modelValue)) {
      return { key, provider };
    }
  }
  return null;
}

// LLM Provider configurations for Answer and Eval
const LLM_PROVIDERS = {
  openai: {
    label: 'OpenAI',
    description: 'Cloud API, requires OPENAI_API_KEY',
    requiresApiKey: true,
    envVar: 'OPENAI_API_KEY',
    models: [
      { value: 'gpt-4o-mini', label: 'gpt-4o-mini', description: 'Fast & affordable', recommended: true },
      { value: 'gpt-4o', label: 'gpt-4o', description: 'Most capable' },
    ],
  },
  anthropic: {
    label: 'Anthropic',
    description: 'Claude models, requires ANTHROPIC_API_KEY',
    requiresApiKey: true,
    envVar: 'ANTHROPIC_API_KEY',
    models: [
      { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', description: 'Best value', recommended: true },
      { value: 'claude-opus-4-20250514', label: 'Claude Opus 4', description: 'Most capable' },
    ],
  },
  ollama: {
    label: 'Ollama (Local)',
    description: 'Run locally, no API key needed',
    requiresApiKey: false,
    models: [
      { value: 'llama3.2:3b', label: 'llama3.2:3b', description: 'Fast, 3B params', recommended: true },
      { value: 'deepseek-r1:8b', label: 'deepseek-r1:8b', description: 'Reasoning model' },
      { value: 'gemma3:4b', label: 'gemma3:4b', description: 'Google Gemma' },
      { value: 'ministral-3:8b', label: 'ministral-3:8b', description: 'Mistral small' },
    ],
  },
};

// Helper to get LLM provider from model value
function getLLMProviderFromModel(modelValue: string | undefined): string | null {
  if (!modelValue) return null;
  for (const [key, provider] of Object.entries(LLM_PROVIDERS)) {
    if (provider.models.some(m => m.value === modelValue)) {
      return key;
    }
  }
  return null;
}

export default function SettingsPage() {
  const { data: settings, isLoading, isError, error, refetch } = useSettings();
  const updateSettings = useUpdateSettings();
  const resetSettings = useResetSettings();
  const { data: validation } = useSetupValidation();

  // Form state
  const [formData, setFormData] = useState<SettingsUpdate>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Sync form data with settings when loaded
  useEffect(() => {
    if (settings) {
      setFormData({
        default_alpha: settings.default_alpha,
        default_use_reranker: settings.default_use_reranker,
        default_preset: settings.default_preset,
        default_top_k: settings.default_top_k,
        embedding_model: settings.embedding_model,
        chunk_size: settings.chunk_size,
        chunk_overlap: settings.chunk_overlap,
        reranker_provider: settings.reranker_provider,
        show_scores: settings.show_scores,
        results_per_page: settings.results_per_page,
        min_score_threshold: settings.min_score_threshold,
        default_generate_answer: settings.default_generate_answer,
        context_window_size: settings.context_window_size,
        eval_judge_provider: settings.eval_judge_provider,
        eval_judge_model: settings.eval_judge_model,
        answer_provider: settings.answer_provider,
        answer_model: settings.answer_model,
      });
      setHasChanges(false);
    }
  }, [settings]);

  const updateField = <K extends keyof SettingsUpdate>(field: K, value: SettingsUpdate[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateSettings.mutate(formData, {
      onSuccess: () => setHasChanges(false),
    });
  };

  const handleReset = () => {
    resetSettings.mutate(undefined, {
      onSuccess: () => setHasChanges(false),
    });
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <SettingsSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container py-8">
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-destructive/30 animate-in fade-in duration-300">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-destructive/10 rounded-2xl blur-xl" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <h3 className="text-xl font-semibold mb-2">Failed to load settings</h3>
          <p className="text-muted-foreground mb-6 max-w-sm leading-relaxed">
            {error instanceof Error ? error.message : 'An unexpected error occurred.'}
          </p>
          <Button onClick={() => refetch()} className="rounded-xl">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <SettingsIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
              <p className="text-sm text-muted-foreground">
                Configure search defaults and display options
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={resetSettings.isPending}
            className="rounded-xl"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${resetSettings.isPending ? 'animate-spin' : ''}`} />
            Reset Defaults
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateSettings.isPending}
            className="rounded-xl"
          >
            <Save className={`mr-2 h-4 w-4 ${updateSettings.isPending ? 'animate-spin' : ''}`} />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Validation Status */}
      {validation && !validation.ready && (
        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="font-medium text-destructive">{validation.summary}</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {validation.checks
                  .filter((c) => c.status === 'error' || c.status === 'warning')
                  .map((check, i) => (
                    <li key={i} className="flex items-start gap-2">
                      {check.status === 'error' ? (
                        <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      )}
                      <span><strong>{check.name}:</strong> {check.message}</span>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {validation && validation.ready && validation.checks.every(c => c.status === 'ok') && (
        <div className="mb-6 rounded-xl border border-green-500/30 bg-green-500/5 p-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-green-500" />
            <p className="text-sm text-green-600 dark:text-green-400">{validation.summary}</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Search Defaults Section */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Search Defaults</CardTitle>
            <CardDescription>
              Configure default values for search queries
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Alpha Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="alpha">Hybrid Search Balance</Label>
                <span className="text-sm text-muted-foreground">
                  {((formData.default_alpha ?? 0.5) * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                id="alpha"
                value={[formData.default_alpha ?? 0.5]}
                onValueChange={([value]) => updateField('default_alpha', value)}
                min={0}
                max={1}
                step={0.05}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Keyword-based</span>
                <span>Semantic</span>
              </div>
            </div>

            {/* Preset Select */}
            <div className="space-y-2">
              <Label htmlFor="preset">Retrieval Preset</Label>
              <Select
                value={formData.default_preset}
                onValueChange={(value) => updateField('default_preset', value as Settings['default_preset'])}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select preset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high_precision">High Precision</SelectItem>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="high_recall">High Recall</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Top K */}
            <div className="space-y-2">
              <Label htmlFor="top_k">Results to Retrieve (Top K)</Label>
              <Input
                id="top_k"
                type="number"
                min={1}
                max={50}
                value={formData.default_top_k ?? 5}
                onChange={(e) => updateField('default_top_k', parseInt(e.target.value) || 5)}
                className="rounded-xl"
              />
            </div>

            {/* Reranking Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="reranker">Enable Reranking</Label>
                <p className="text-xs text-muted-foreground">
                  Improve result quality with cross-encoder reranking
                </p>
              </div>
              <Switch
                id="reranker"
                checked={formData.default_use_reranker ?? true}
                onCheckedChange={(checked) => updateField('default_use_reranker', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Display Options Section */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Display Options</CardTitle>
            <CardDescription>
              Customize how search results are displayed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Show Scores Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show_scores">Show Relevance Scores</Label>
                <p className="text-xs text-muted-foreground">
                  Display detailed scoring information for results
                </p>
              </div>
              <Switch
                id="show_scores"
                checked={formData.show_scores ?? true}
                onCheckedChange={(checked) => updateField('show_scores', checked)}
              />
            </div>

            {/* Minimum Score Threshold */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="min_score_threshold">Low Confidence Threshold</Label>
                <span className="text-sm text-muted-foreground">
                  {((formData.min_score_threshold ?? 0.30) * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                id="min_score_threshold"
                value={[formData.min_score_threshold ?? 0.30]}
                onValueChange={([value]) => updateField('min_score_threshold', value)}
                min={0}
                max={0.5}
                step={0.05}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Results with relevance scores below this threshold are hidden by default and shown
                separately as &ldquo;low confidence&rdquo; results. Based on the final reranker score.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* AI Answer & Context Section */}
        <Card className="rounded-2xl md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle>AI Answer & Context</CardTitle>
            </div>
            <CardDescription>
              Configure AI-generated answers and contextual chunk retrieval
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Generate AI Answer Toggle */}
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <Label htmlFor="generate_answer" className="text-base">Generate AI Answers by Default</Label>
                  <p className="text-sm text-muted-foreground">
                    When enabled, search results will include an AI-synthesized answer that summarizes
                    information from the top matching chunks.
                  </p>
                </div>
                <Switch
                  id="generate_answer"
                  checked={formData.default_generate_answer ?? false}
                  onCheckedChange={(checked) => updateField('default_generate_answer', checked)}
                />
              </div>

              {/* AI Answer Info Panel */}
              <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  How AI Answers Work
                </p>
                <div className="grid gap-3 sm:grid-cols-2 text-xs">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium">Verified Citations</span>
                      <p className="text-muted-foreground">Every claim is checked against source documents with clickable references</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Zap className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium">Same Search Quality</span>
                      <p className="text-muted-foreground">Retrieval results are identical whether AI answer is on or off</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium">Added Latency</span>
                      <p className="text-muted-foreground">Adds ~1-2 seconds for LLM processing (GPT-4o-mini)</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium">Confidence Warnings</span>
                      <p className="text-muted-foreground">Low confidence answers are flagged with warnings for transparency</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-muted-foreground/10" />

            {/* Context Window Size */}
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="context_window" className="text-base">Context Window Size</Label>
                  <span className="text-sm font-medium px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                    {formData.context_window_size ?? 1} chunk{(formData.context_window_size ?? 1) > 1 ? 's' : ''} before/after
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Number of adjacent chunks to fetch around each matched result for fuller context.
                </p>
              </div>

              {/* Context Window Visual Selector */}
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { value: 1, label: 'Minimal', description: 'Fast lookups, well-structured docs', icon: Zap, color: 'text-green-500' },
                  { value: 2, label: 'Balanced', description: 'General use, most documents', icon: Layers, color: 'text-blue-500' },
                  { value: 3, label: 'Maximum', description: 'Dense technical docs, research', icon: Layers, color: 'text-purple-500' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateField('context_window_size', option.value)}
                    className={`relative flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all hover:border-primary/50 ${
                      (formData.context_window_size ?? 1) === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-muted-foreground/20'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <option.icon className={`h-4 w-4 ${option.color}`} />
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground">({option.value})</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                    {(formData.context_window_size ?? 1) === option.value && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Context Window Visual Diagram */}
              <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  What You&apos;ll See
                </p>
                <div className="font-mono text-xs space-y-1 bg-background/50 rounded-lg p-3 border">
                  {(formData.context_window_size ?? 1) >= 2 && (
                    <div className="text-muted-foreground/50 truncate">...chunk {(formData.context_window_size ?? 1) > 2 ? 'N-2' : ''}</div>
                  )}
                  {(formData.context_window_size ?? 1) >= 1 && (
                    <div className="text-muted-foreground/60 truncate italic">Previous context chunk...</div>
                  )}
                  <div className="bg-primary/10 border-l-2 border-primary px-2 py-1 rounded-r font-medium text-foreground">
                    ✓ Matched chunk (highlighted)
                  </div>
                  {(formData.context_window_size ?? 1) >= 1 && (
                    <div className="text-muted-foreground/60 truncate italic">Following context chunk...</div>
                  )}
                  {(formData.context_window_size ?? 1) >= 2 && (
                    <div className="text-muted-foreground/50 truncate">...chunk {(formData.context_window_size ?? 1) > 2 ? 'N+2' : ''}</div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {(formData.context_window_size ?? 1) === 1 && 'Each result shows 1 chunk before and 1 after the match. Click "Show context" for more.'}
                  {(formData.context_window_size ?? 1) === 2 && 'Each result shows 2 chunks before and 2 after — good for understanding argument flow.'}
                  {(formData.context_window_size ?? 1) === 3 && 'Maximum context: 3 chunks before and 3 after. Best for dense, technical documents.'}
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-muted-foreground/10" />

            {/* Answer LLM Selection - Single Grouped Dropdown */}
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-base">Answer Generation LLM</Label>
                <p className="text-sm text-muted-foreground">
                  Select the LLM for generating AI answers from search results.
                </p>
              </div>

              <Select
                value={formData.answer_model}
                onValueChange={(value) => {
                  const provider = getLLMProviderFromModel(value);
                  if (provider) {
                    updateField('answer_provider', provider as Settings['answer_provider']);
                  }
                  updateField('answer_model', value);
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LLM_PROVIDERS).map(([key, provider]) => (
                    <SelectGroup key={key}>
                      <SelectLabel className="text-xs font-semibold text-muted-foreground px-2">
                        {provider.label}
                        {provider.requiresApiKey && (
                          <span className="ml-1 text-[10px] font-normal">(requires API key)</span>
                        )}
                      </SelectLabel>
                      {provider.models.map((model) => (
                        <SelectItem key={model.value} value={model.value}>
                          <div className="flex items-center gap-2">
                            <span>{model.label}</span>
                            {model.recommended && <span className="text-amber-500">⭐</span>}
                            <span className="text-xs text-muted-foreground ml-auto">{model.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>

              {/* Provider-specific info */}
              {formData.answer_provider && (
                <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                  {formData.answer_provider === 'openai' && (
                    <p>Requires <code className="px-1 py-0.5 rounded bg-muted font-mono">OPENAI_API_KEY</code> environment variable.</p>
                  )}
                  {formData.answer_provider === 'anthropic' && (
                    <p>Requires <code className="px-1 py-0.5 rounded bg-muted font-mono">ANTHROPIC_API_KEY</code> environment variable.</p>
                  )}
                  {formData.answer_provider === 'ollama' && (
                    <p>Runs locally. Pull model: <code className="px-1 py-0.5 rounded bg-muted font-mono">ollama pull {formData.answer_model || 'llama3.2:3b'}</code></p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Advanced Settings Section */}
        <Card className="rounded-2xl md:col-span-2">
          <CardHeader>
            <CardTitle>Advanced Settings</CardTitle>
            <CardDescription>
              Configure embedding model, chunking, and reranker settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Embedding Model with Provider Groups */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="embedding_model">Embedding Model</Label>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Changing model requires re-indexing documents
                </span>
              </div>
              <Select
                value={formData.embedding_model}
                onValueChange={(value) => updateField('embedding_model', value)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EMBEDDING_PROVIDERS).map(([key, provider]) => (
                    <SelectGroup key={key}>
                      <SelectLabel className="text-xs font-semibold text-muted-foreground px-2">
                        {provider.label}
                      </SelectLabel>
                      {provider.models.map((model) => (
                        <SelectItem key={model.value} value={model.value}>
                          <div className="flex items-center justify-between w-full gap-4">
                            <span>{model.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {model.dims}d · {model.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>

              {/* Provider Info Panel */}
              {(() => {
                const providerInfo = getProviderFromModel(formData.embedding_model);
                if (!providerInfo) return null;
                const { provider } = providerInfo;
                return (
                  <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                    <p className="text-sm text-muted-foreground">{provider.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {provider.docsUrl && (
                        <a
                          href={provider.docsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Documentation
                        </a>
                      )}
                      {'downloadUrl' in provider && provider.downloadUrl && (
                        <a
                          href={provider.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Download
                        </a>
                      )}
                      {'signupUrl' in provider && provider.signupUrl && (
                        <a
                          href={provider.signupUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Get API Key
                        </a>
                      )}
                      {'pricingUrl' in provider && provider.pricingUrl && (
                        <a
                          href={provider.pricingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Pricing
                        </a>
                      )}
                    </div>
                    {provider.requiresApiKey && 'envVar' in provider && (
                      <p className="text-xs text-muted-foreground">
                        Set <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">{provider.envVar}</code> in your environment.
                      </p>
                    )}
                    {!provider.requiresApiKey && (
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                        No API key required - runs locally
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Chunking Settings with Visual Sliders */}
            <div className="grid gap-6 sm:grid-cols-2">
              {/* Chunk Size */}
              <ColorZoneSlider
                id="chunk_size"
                label="Chunk Size"
                descriptionNode={
                  <>
                    Optimal range is <span className="text-green-600 dark:text-green-400 font-medium">500-1500</span> characters for most use cases.
                  </>
                }
                value={formData.chunk_size ?? 1000}
                onChange={(value) => updateField('chunk_size', value)}
                min={100}
                max={4000}
                step={50}
                zones={CHUNK_SIZE_ZONES}
                unit=" chars"
                showRuler
                rulerConfig={{
                  smallInterval: 100,
                  largeInterval: 500,
                  showLabels: true,
                  labelValues: [100, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000],
                }}
              />

              {/* Chunk Overlap */}
              <ColorZoneSlider
                id="chunk_overlap"
                label="Chunk Overlap"
                descriptionNode={
                  <>
                    Optimal range is <span className="text-green-600 dark:text-green-400 font-medium">50-400</span> characters to preserve context across chunks.
                  </>
                }
                value={formData.chunk_overlap ?? 200}
                onChange={(value) => updateField('chunk_overlap', value)}
                min={0}
                max={1000}
                step={50}
                zones={CHUNK_OVERLAP_ZONES}
                unit=" chars"
                showRuler
                rulerConfig={{
                  smallInterval: 50,
                  largeInterval: 100,
                  showLabels: true,
                  labelValues: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
                }}
              />
            </div>

            {/* Overlap Warning */}
            {formData.chunk_overlap && formData.chunk_size &&
              formData.chunk_overlap > formData.chunk_size * 0.5 && (
              <div className="flex items-start gap-2 rounded-lg p-3 bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <strong>Warning:</strong> Overlap is greater than 50% of chunk size. This causes excessive
                  redundancy and slower indexing. Consider reducing overlap or increasing chunk size.
                </div>
              </div>
            )}

            {/* Reranker Provider */}
            <div className="space-y-2">
              <Label htmlFor="reranker_provider">Reranker Provider</Label>
              <Select
                value={formData.reranker_provider}
                onValueChange={(value) => updateField('reranker_provider', value as Settings['reranker_provider'])}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (Best Available)</SelectItem>
                  <SelectItem value="jina">Jina Reranker</SelectItem>
                  <SelectItem value="cohere">Cohere Rerank</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Auto selects the best available reranker based on configured API keys.
              </p>
            </div>

            {/* Divider */}
            <div className="border-t border-muted-foreground/10 pt-2" />

            {/* Evaluation LLM - Single Grouped Dropdown */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-primary" />
                <Label>Evaluation LLM</Label>
              </div>
              <Select
                value={formData.eval_judge_provider === 'disabled' ? 'disabled' : formData.eval_judge_model}
                onValueChange={(value) => {
                  if (value === 'disabled') {
                    updateField('eval_judge_provider', 'disabled');
                    updateField('eval_judge_model', '');
                  } else {
                    const provider = getLLMProviderFromModel(value);
                    if (provider) {
                      updateField('eval_judge_provider', provider as Settings['eval_judge_provider']);
                    }
                    updateField('eval_judge_model', value);
                  }
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select evaluation model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disabled">
                    <span className="text-muted-foreground">Disabled</span>
                  </SelectItem>
                  {Object.entries(LLM_PROVIDERS).map(([key, provider]) => (
                    <SelectGroup key={key}>
                      <SelectLabel className="text-xs font-semibold text-muted-foreground px-2">
                        {provider.label}
                        {provider.requiresApiKey && (
                          <span className="ml-1 text-[10px] font-normal">(requires API key)</span>
                        )}
                      </SelectLabel>
                      {provider.models.map((model) => (
                        <SelectItem key={model.value} value={model.value}>
                          <div className="flex items-center gap-2">
                            <span>{model.label}</span>
                            {model.recommended && <span className="text-amber-500">⭐</span>}
                            <span className="text-xs text-muted-foreground ml-auto">{model.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                LLM-as-Judge for RAG quality evaluations. Select &quot;Disabled&quot; to turn off evaluations.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Last Updated */}
      {settings?.updated_at && (
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Last updated: {new Date(settings.updated_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl md:col-span-2" />
      </div>
    </div>
  );
}
