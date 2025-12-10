'use client';

import { useRef, useEffect } from 'react';
import Link from 'next/link';
import { Search, Command, Zap, Brain, Layers, ArrowRight, FolderOpen, Sparkles, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSearch, useKeyboardShortcut, useCollections, useSettings } from '@/hooks';
import {
  SearchResults,
  SearchPresetSelect,
  CollectionSelect,
} from '@/components/search';
import { SetupStatusBanner } from '@/components/setup-status-banner';
import { useSearchStore } from '@/lib/stores';

export default function Home() {
  // Use zustand store for persistent state across navigation
  const {
    query,
    setQuery,
    preset,
    setPreset,
    collectionId,
    setCollectionId,
    topK,
    setTopK,
    alpha,
    setAlpha,
    useReranker,
    setUseReranker,
    results: searchResults,
    setResults: setSearchResults,
    hasSearched,
    setHasSearched,
  } = useSearchStore();

  const searchInputRef = useRef<HTMLInputElement>(null);

  const searchMutation = useSearch();
  const { data: collectionsData } = useCollections();
  const { data: settings } = useSettings();

  // Initialize search params from settings when they load
  // Always sync with settings to respect user's configuration changes
  useEffect(() => {
    if (settings) {
      setPreset(settings.default_preset);
      setTopK(settings.default_top_k);
      setAlpha(settings.default_alpha);
      setUseReranker(settings.default_use_reranker);
    }
  }, [settings, setPreset, setTopK, setAlpha, setUseReranker]);

  const hasCollections = collectionsData && collectionsData.data.length > 0;

  // Cmd+K or Ctrl+K to focus search
  useKeyboardShortcut(
    () => {
      searchInputRef.current?.focus();
    },
    { key: 'k', metaKey: true }
  );

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setHasSearched(true);
    try {
      const response = await searchMutation.mutateAsync({
        query: query.trim(),
        preset: preset === 'custom' ? undefined : preset,
        collection_id: collectionId,
        top_k: topK,
        // Include generate_answer from settings
        generate_answer: settings?.default_generate_answer ?? false,
        // Only include custom params when using custom preset
        ...(preset === 'custom' && {
          alpha,
          use_reranker: useReranker,
        }),
      });
      setSearchResults(response);
    } catch (error) {
      // Show user-friendly error message
      const message = error instanceof Error ? error.message : 'Search failed. Please try again.';
      toast.error('Search Error', {
        description: message,
      });
      setSearchResults(null);
      setHasSearched(false);
    }
  };

  const showResults = hasSearched && (searchResults || searchMutation.isPending);

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Hero Section - Compact when showing results */}
      <div className={`transition-all duration-300 ${showResults ? 'py-6' : 'py-16 md:py-24'}`}>
        <div className="container">
          {/* Setup Validation Banner - Only show before search */}
          {!showResults && (
            <div className="mx-auto max-w-3xl mb-6">
              <SetupStatusBanner />
            </div>
          )}

          <div className="mx-auto max-w-3xl">
            {/* Title - Hide when showing results */}
            {!showResults && (
              <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                  Find anything in your documents
                </h1>
                <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                  AI-powered semantic search that understands what you mean, not just what you type.
                </p>
              </div>
            )}

            {/* Search Form */}
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-primary/10 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition duration-300" />
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <Input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Ask a question about your documents..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="h-14 pl-12 pr-20 text-base rounded-xl border-muted-foreground/20 focus:border-primary/50 shadow-sm"
                    />
                    <kbd className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 hidden h-7 select-none items-center gap-1 rounded-md border bg-muted/50 px-2 font-mono text-xs font-medium opacity-100 sm:flex">
                      <Command className="h-3 w-3" />K
                    </kbd>
                  </div>
                  <Button
                    type="submit"
                    disabled={searchMutation.isPending || !query.trim()}
                    className="h-14 px-6 rounded-xl text-base font-medium shadow-sm"
                  >
                    {searchMutation.isPending ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 border-2 border-current border-r-transparent rounded-full animate-spin" />
                        Searching
                      </span>
                    ) : (
                      'Search'
                    )}
                  </Button>
                </div>
              </div>

              {/* AI Answer Indicator */}
              {settings?.default_generate_answer && (
                <div className="flex items-center justify-center mt-3">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                    <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                    <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
                      AI Answer Enabled
                    </span>
                  </div>
                </div>
              )}

              {/* Search Options */}
              <div className="mt-6 space-y-4">
                {/* Collection Filter */}
                <div className="flex items-center justify-center">
                  <CollectionSelect value={collectionId} onValueChange={setCollectionId} />
                </div>

                {/* Preset Radio Group */}
                <SearchPresetSelect
                  value={preset}
                  onValueChange={setPreset}
                  topK={topK}
                  onTopKChange={setTopK}
                  alpha={alpha}
                  onAlphaChange={setAlpha}
                  useReranker={useReranker}
                  onUseRerankerChange={setUseReranker}
                />
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Search Results */}
      {showResults && (
        <div className="container pb-12 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="mx-auto max-w-3xl">
            <SearchResults
              data={searchResults}
              isLoading={searchMutation.isPending}
            />
          </div>
        </div>
      )}

      {/* Getting Started Section - Only show when no search */}
      {!showResults && (
        <div className="border-t bg-muted/30">
          <div className="container py-16">
            <div className="mx-auto max-w-4xl">
              {/* No Collections CTA */}
              {!hasCollections ? (
                <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-6">
                    <FolderOpen className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="text-2xl font-semibold mb-3">Get started in seconds</h2>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Create a collection, upload your documents, and start searching with AI-powered semantic understanding.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Button asChild size="lg" className="rounded-xl">
                      <Link href="/collections">
                        Create your first collection
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                    <Button variant="ghost" asChild className="rounded-xl text-muted-foreground hover:text-foreground">
                      <Link href="/learn-evals">
                        <FlaskConical className="mr-2 h-4 w-4" />
                        Learn about Evals
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Feature Cards */}
                  <div className="grid gap-6 md:grid-cols-3 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                    <FeatureCard
                      icon={Brain}
                      title="Semantic Understanding"
                      description="Goes beyond keywords to understand the meaning and context of your questions"
                    />
                    <FeatureCard
                      icon={Zap}
                      title="Hybrid Search"
                      description="Combines traditional keyword matching with AI embeddings for best results"
                    />
                    <FeatureCard
                      icon={Layers}
                      title="Smart Reranking"
                      description="AI reranks results to surface the most relevant content first"
                    />
                  </div>

                  {/* Quick Actions */}
                  <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                    <p className="text-sm text-muted-foreground">
                      {collectionsData.data.length} collection{collectionsData.data.length !== 1 && 's'} ready to search
                    </p>
                    <Button variant="outline" asChild className="rounded-xl">
                      <Link href="/collections">
                        Manage Collections
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                    <Button variant="ghost" asChild className="rounded-xl text-muted-foreground hover:text-foreground">
                      <Link href="/learn-evals">
                        <FlaskConical className="mr-2 h-4 w-4" />
                        Learn about Evals
                      </Link>
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="group relative rounded-2xl border bg-background p-6 transition-all hover:shadow-md hover:border-primary/20">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-4 group-hover:bg-primary/15 transition-colors">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
