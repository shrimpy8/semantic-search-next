'use client';

import { useState, useEffect } from 'react';
import { useSettings, useUpdateSettings, useResetSettings, useSetupValidation } from '@/hooks';
import { Settings as SettingsIcon, RefreshCw, Save, AlertCircle, Info, ExternalLink, Sparkles, Layers, CheckCircle2, Zap, FlaskConical, AlertTriangle, ShieldCheck, Server, Database, Container, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
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
    color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300',
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
    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
    models: [
      { value: 'ollama:nomic-embed-text-v2-moe:latest', label: 'nomic-embed-text-v2-moe', dims: 768, description: 'Latest MoE, strong retrieval' },
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
    color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
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
    color: 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300',
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
    color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300',
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
    color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300',
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
    color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
    models: [
      { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', description: 'Best value', recommended: true },
      { value: 'claude-opus-4-20250514', label: 'Claude Opus 4', description: 'Most capable' },
    ],
  },
  ollama: {
    label: 'Ollama (Local)',
    description: 'Run locally, no API key needed',
    requiresApiKey: false,
    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
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

// Helper to format LLM model display value (e.g., "OpenAI / gpt-4o-mini")
function formatLLMDisplayValue(modelValue: string | undefined): string {
  if (!modelValue) return '';
  for (const [, provider] of Object.entries(LLM_PROVIDERS)) {
    const model = provider.models.find(m => m.value === modelValue);
    if (model) {
      return `${provider.label} / ${model.label}`;
    }
  }
  return modelValue;
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
        answer_style: settings.answer_style,
        confirm_reindex: false,
      });
      setHasChanges(false);
    }
  }, [settings]);

  const updateField = <K extends keyof SettingsUpdate>(field: K, value: SettingsUpdate[K]) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'embedding_model' ? { confirm_reindex: false } : null),
    }));
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

  const embeddingModelChanged = Boolean(
    settings?.embedding_model
    && formData.embedding_model
    && formData.embedding_model !== settings.embedding_model
  );

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="flex flex-col items-center justify-center py-24 animate-in fade-in duration-300">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-primary/10 rounded-2xl blur-xl animate-pulse" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Server className="h-8 w-8 text-primary animate-pulse" />
            </div>
          </div>
          <h3 className="text-lg font-semibold mb-2">Checking Services...</h3>
          <p className="text-sm text-muted-foreground mb-4">Connecting to backend API</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container py-8">
        <div className="rounded-2xl border border-dashed border-destructive/30 animate-in fade-in duration-300 p-8">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-destructive/10 rounded-2xl blur-xl" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
                <Server className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <h3 className="text-xl font-semibold mb-2">Backend Services Unavailable</h3>
            <p className="text-muted-foreground max-w-md leading-relaxed">
              Unable to connect to the backend API. Please ensure the following services are running:
            </p>
          </div>

          {/* Required Services */}
          <div className="grid gap-4 md:grid-cols-3 mb-8">
            {/* FastAPI Backend */}
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Terminal className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h4 className="font-medium text-sm">FastAPI Backend</h4>
                  <p className="text-xs text-muted-foreground">Port 8080</p>
                </div>
              </div>
              <div className="text-xs space-y-1">
                <p className="text-muted-foreground">Python API server handling all requests</p>
                <code className="block bg-muted px-2 py-1 rounded text-[10px] font-mono">
                  uvicorn app.main:app --port 8080
                </code>
              </div>
            </div>

            {/* PostgreSQL */}
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <Database className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h4 className="font-medium text-sm">PostgreSQL</h4>
                  <p className="text-xs text-muted-foreground">Port 5432</p>
                </div>
              </div>
              <div className="text-xs space-y-1">
                <p className="text-muted-foreground">Stores documents, collections & settings</p>
                <code className="block bg-muted px-2 py-1 rounded text-[10px] font-mono">
                  docker-compose up -d postgres
                </code>
              </div>
            </div>

            {/* ChromaDB */}
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <Container className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h4 className="font-medium text-sm">ChromaDB</h4>
                  <p className="text-xs text-muted-foreground">Port 8000</p>
                </div>
              </div>
              <div className="text-xs space-y-1">
                <p className="text-muted-foreground">Vector database for semantic search</p>
                <code className="block bg-muted px-2 py-1 rounded text-[10px] font-mono">
                  docker-compose up -d chromadb
                </code>
              </div>
            </div>
          </div>

          {/* Quick Start */}
          <div className="rounded-xl border bg-muted/30 p-4 mb-6">
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Quick Start
            </h4>
            <div className="grid gap-2 text-xs font-mono">
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground shrink-0">1.</span>
                <code className="bg-background px-2 py-1 rounded border">docker-compose up -d</code>
                <span className="text-muted-foreground">Start PostgreSQL & ChromaDB</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground shrink-0">2.</span>
                <code className="bg-background px-2 py-1 rounded border">cd backend && source .venv/bin/activate</code>
                <span className="text-muted-foreground">Activate Python env</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground shrink-0">3.</span>
                <code className="bg-background px-2 py-1 rounded border">uvicorn app.main:app --reload --port 8080</code>
                <span className="text-muted-foreground">Start backend</span>
              </div>
            </div>
          </div>

          {/* Actions & Documentation Links */}
          <div className="flex flex-col items-center gap-4">
            <Button onClick={() => refetch()} className="rounded-xl">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
              <a
                href="https://github.com/shrimpy8/semantic-search-next#readme"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                README
              </a>
              <span className="text-muted-foreground">•</span>
              <a
                href="https://github.com/shrimpy8/semantic-search-next/blob/main/docs/INFRASTRUCTURE.md"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                Infrastructure Guide
              </a>
            </div>
          </div>

          {/* Error Details (collapsed) */}
          {error instanceof Error && (
            <details className="mt-6 text-xs">
              <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
                Technical details
              </summary>
              <pre className="mt-2 bg-muted p-3 rounded-lg overflow-auto text-[10px]">
                {error.message}
              </pre>
            </details>
          )}
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
            disabled={
              !hasChanges
              || updateSettings.isPending
              || (embeddingModelChanged && !formData.confirm_reindex)
            }
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
                  {((formData.min_score_threshold ?? 0.35) * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                id="min_score_threshold"
                value={[formData.min_score_threshold ?? 0.35]}
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

        {/* AI Answer & Context Section - 2-Column Layout */}
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
          <CardContent>
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left Column: All Answer Settings (3 rows) */}
              <div className="space-y-5">
                {/* Row 1: Generate AI Answers Toggle */}
                <div className="flex items-start justify-between gap-4 p-4 rounded-xl border bg-muted/20">
                  <div className="space-y-1 flex-1">
                    <Label htmlFor="generate_answer" className="text-base">Generate AI Answers by Default</Label>
                    <p className="text-sm text-muted-foreground">
                      Include an AI-synthesized answer with search results.
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /> Verified citations</span>
                      <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3 text-orange-500" /> +1-2s latency</span>
                    </div>
                  </div>
                  <Switch
                    id="generate_answer"
                    checked={formData.default_generate_answer ?? false}
                    onCheckedChange={(checked) => updateField('default_generate_answer', checked)}
                  />
                </div>

                {/* Row 2: Answer LLM Selection */}
                <div className="space-y-2">
                  <Label>Answer Generation LLM</Label>
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
                      <SelectValue placeholder="Select model">
                        {formData.answer_model && formatLLMDisplayValue(formData.answer_model)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(LLM_PROVIDERS).map(([key, provider]) => (
                        <SelectGroup key={key}>
                          <SelectLabel className={`text-xs font-bold uppercase tracking-wide px-2 py-1.5 mx-1 my-1 rounded ${provider.color}`}>
                            {provider.label}
                            {provider.requiresApiKey && (
                              <span className="ml-1.5 text-[10px] font-normal normal-case opacity-70">(API key)</span>
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
                  {formData.answer_provider && (
                    <p className="text-xs text-muted-foreground">
                      {formData.answer_provider === 'openai' && <>Requires <code className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">OPENAI_API_KEY</code></>}
                      {formData.answer_provider === 'anthropic' && <>Requires <code className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">ANTHROPIC_API_KEY</code></>}
                      {formData.answer_provider === 'ollama' && <>Run: <code className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">ollama pull {formData.answer_model}</code></>}
                    </p>
                  )}
                </div>

                {/* Row 3: Answer Style Selection */}
                <div className="space-y-2">
                  <Label>Answer Style</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'concise', label: 'Concise', desc: '1-2 paragraphs', icon: Zap },
                      { value: 'balanced', label: 'Balanced', desc: '2-4 paragraphs', icon: Layers },
                      { value: 'detailed', label: 'Detailed', desc: '4+ paragraphs', icon: Info },
                    ].map((style) => (
                      <button
                        key={style.value}
                        type="button"
                        onClick={() => updateField('answer_style', style.value as Settings['answer_style'])}
                        className={`relative rounded-lg border p-3 text-center transition-all hover:border-primary/50 ${
                          formData.answer_style === style.value
                            ? 'border-primary bg-primary/5'
                            : 'border-muted-foreground/20'
                        }`}
                      >
                        <style.icon className={`h-4 w-4 mx-auto mb-1 ${formData.answer_style === style.value ? 'text-primary' : 'text-muted-foreground'}`} />
                        <p className="font-medium text-xs">{style.label}</p>
                        <p className="text-[10px] text-muted-foreground">{style.desc}</p>
                        {formData.answer_style === style.value && (
                          <CheckCircle2 className="h-3 w-3 text-primary absolute top-1.5 right-1.5" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Context Window */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Context Window</Label>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                    ±{formData.context_window_size ?? 1} chunks
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Adjacent chunks fetched around each matched result for fuller context.
                </p>

                {/* Context Window Selector */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 1, label: 'Minimal', desc: 'Fast lookups', icon: Zap, color: 'text-green-500' },
                    { value: 2, label: 'Balanced', desc: 'General use', icon: Layers, color: 'text-blue-500' },
                    { value: 3, label: 'Maximum', desc: 'Dense docs', icon: Layers, color: 'text-purple-500' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateField('context_window_size', option.value)}
                      className={`relative rounded-lg border p-3 text-center transition-all hover:border-primary/50 ${
                        (formData.context_window_size ?? 1) === option.value
                          ? 'border-primary bg-primary/5'
                          : 'border-muted-foreground/20'
                      }`}
                    >
                      <option.icon className={`h-4 w-4 mx-auto mb-1 ${(formData.context_window_size ?? 1) === option.value ? 'text-primary' : option.color}`} />
                      <p className="font-medium text-xs">{option.label}</p>
                      <p className="text-[10px] text-muted-foreground">{option.desc}</p>
                      {(formData.context_window_size ?? 1) === option.value && (
                        <CheckCircle2 className="h-3 w-3 text-primary absolute top-1.5 right-1.5" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Context Preview */}
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <p className="text-xs font-medium flex items-center gap-1.5">
                    <Layers className="h-3 w-3 text-muted-foreground" />
                    Preview
                  </p>
                  <div className="font-mono text-[10px] space-y-0.5 bg-background/50 rounded p-2 border">
                    {(formData.context_window_size ?? 1) >= 3 && (
                      <div className="text-muted-foreground/40 truncate">...chunk N-3</div>
                    )}
                    {(formData.context_window_size ?? 1) >= 2 && (
                      <div className="text-muted-foreground/50 truncate">...chunk N-2</div>
                    )}
                    <div className="text-muted-foreground/60 truncate">Previous chunk...</div>
                    <div className="bg-primary/10 border-l-2 border-primary px-1.5 py-0.5 rounded-r font-medium text-foreground text-[11px]">
                      ✓ Matched chunk
                    </div>
                    <div className="text-muted-foreground/60 truncate">Following chunk...</div>
                    {(formData.context_window_size ?? 1) >= 2 && (
                      <div className="text-muted-foreground/50 truncate">...chunk N+2</div>
                    )}
                    {(formData.context_window_size ?? 1) >= 3 && (
                      <div className="text-muted-foreground/40 truncate">...chunk N+3</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Advanced Settings Section - 2 Column Layout */}
        <Card className="rounded-2xl md:col-span-2">
          <CardHeader>
            <CardTitle>Advanced Settings</CardTitle>
            <CardDescription>
              Configure embedding model, chunking, and reranker settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-8 lg:grid-cols-2">
              {/* Left Column: Model & Provider Settings */}
              <div className="space-y-6">
                {/* Embedding Model */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="embedding_model">Embedding Model</Label>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      Re-index after change
                    </span>
                  </div>
                  <Select
                    value={formData.embedding_model}
                    onValueChange={(value) => updateField('embedding_model', value)}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select model">
                        {formData.embedding_model && (() => {
                          const info = getProviderFromModel(formData.embedding_model);
                          if (!info) return formData.embedding_model;
                          const model = info.provider.models.find(m => m.value === formData.embedding_model);
                          return `${info.provider.label} / ${model?.label || formData.embedding_model}`;
                        })()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(EMBEDDING_PROVIDERS).map(([key, provider]) => (
                        <SelectGroup key={key}>
                          <SelectLabel className={`text-xs font-bold uppercase tracking-wide px-2 py-1.5 mx-1 my-1 rounded ${provider.color}`}>
                            {provider.label}
                            {provider.requiresApiKey && (
                              <span className="ml-1.5 text-[10px] font-normal normal-case opacity-70">(API key)</span>
                            )}
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

                  {/* Provider Info Panel - Compact */}
                  {(() => {
                    const providerInfo = getProviderFromModel(formData.embedding_model);
                    if (!providerInfo) return null;
                    const { provider } = providerInfo;
                    return (
                      <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-xs">
                        <p className="text-muted-foreground">{provider.description}</p>
                        <div className="flex flex-wrap gap-2">
                          {provider.docsUrl && (
                            <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                              <ExternalLink className="h-3 w-3" /> Docs
                            </a>
                          )}
                          {'signupUrl' in provider && provider.signupUrl && (
                            <a href={provider.signupUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                              <ExternalLink className="h-3 w-3" /> Get Key
                            </a>
                          )}
                        </div>
                        {provider.requiresApiKey && 'envVar' in provider && (
                          <p className="text-muted-foreground">
                            Set <code className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">{provider.envVar}</code>
                          </p>
                        )}
                        {!provider.requiresApiKey && (
                          <p className="text-green-600 dark:text-green-400 font-medium">No API key - runs locally</p>
                        )}
                      </div>
                    );
                  })()}

                  {embeddingModelChanged && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-xs text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5" />
                        <div className="space-y-2">
                          <p className="font-medium">Embedding model change requires re-indexing.</p>
                          <p>Existing documents will not match the new embedding model until re-indexed.</p>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={Boolean(formData.confirm_reindex)}
                              onCheckedChange={(value) => updateField('confirm_reindex', value)}
                            />
                            <span>I understand and will re-index documents</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

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

                {/* Evaluation LLM */}
                <div className="space-y-2">
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
                      <SelectValue placeholder="Select evaluation model">
                        {formData.eval_judge_provider === 'disabled'
                          ? 'Disabled'
                          : formData.eval_judge_model && formatLLMDisplayValue(formData.eval_judge_model)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="disabled">
                        <span className="text-muted-foreground">Disabled</span>
                      </SelectItem>
                      {Object.entries(LLM_PROVIDERS).map(([key, provider]) => (
                        <SelectGroup key={key}>
                          <SelectLabel className={`text-xs font-bold uppercase tracking-wide px-2 py-1.5 mx-1 my-1 rounded ${provider.color}`}>
                            {provider.label}
                            {provider.requiresApiKey && (
                              <span className="ml-1.5 text-[10px] font-normal normal-case opacity-70">(API key)</span>
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
                    LLM-as-Judge for RAG quality evaluations. &quot;Disabled&quot; turns off evaluations.
                  </p>
                </div>
              </div>

              {/* Right Column: Chunking Settings */}
              <div className="space-y-6">
                {/* Chunk Size */}
                <ColorZoneSlider
                  id="chunk_size"
                  label="Chunk Size"
                  descriptionNode={
                    <>
                      Optimal: <span className="text-green-600 dark:text-green-400 font-medium">500-1500</span> chars
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
                      Optimal: <span className="text-green-600 dark:text-green-400 font-medium">50-400</span> chars
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

                {/* Overlap Warning */}
                {formData.chunk_overlap && formData.chunk_size &&
                  formData.chunk_overlap > formData.chunk_size * 0.5 && (
                  <div className="flex items-start gap-2 rounded-lg p-3 bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <strong>Warning:</strong> Overlap &gt; 50% of chunk size causes excessive redundancy.
                    </div>
                  </div>
                )}
              </div>
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
