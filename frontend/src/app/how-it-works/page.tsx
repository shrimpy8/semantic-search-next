'use client';

import Link from 'next/link';
import {
  Lightbulb,
  Search,
  Brain,
  Layers,
  Target,
  Filter,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Settings,
  Zap,
  CheckCircle2,
  BookOpen,
  TrendingUp,
  Shuffle,
  Scale,
  ShieldCheck,
  Database,
  Cpu,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function HowItWorksPage() {
  return (
    <div className="container py-8 space-y-16 max-w-5xl">
      {/* Hero Section */}
      <section className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Lightbulb className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h1 className="text-4xl font-bold tracking-tight">How It Works</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Understand the technology behind AI-powered semantic search and how we achieve
          high-quality results through layered intelligence.
        </p>
      </section>

      {/* Table of Contents */}
      <nav className="rounded-2xl border bg-muted/30 p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          On This Page
        </h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {[
            { href: '#overview', label: 'High-Level Overview', icon: Layers },
            { href: '#search-quality', label: 'Search Quality Progression', icon: TrendingUp },
            { href: '#concepts', label: 'Key Concepts Explained', icon: Brain },
            { href: '#settings', label: 'Settings Demystified', icon: Settings },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
              <ChevronRight className="h-3 w-3 ml-auto" />
            </a>
          ))}
        </div>
      </nav>

      {/* Section 1: High-Level Overview */}
      <section id="overview" className="space-y-8 scroll-mt-20">
        <div className="space-y-2">
          <Badge variant="outline" className="mb-2">Overview</Badge>
          <h2 className="text-3xl font-bold tracking-tight">High-Level Overview</h2>
          <p className="text-muted-foreground">
            Traditional search relies on keyword matching. Semantic search understands the <em>meaning</em> behind your query.
          </p>
        </div>

        {/* Traditional vs Semantic Comparison */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="rounded-2xl border-orange-500/30 bg-orange-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                <Search className="h-5 w-5" />
                Traditional Search
              </CardTitle>
              <CardDescription>Keyword matching only</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="font-mono text-sm bg-background/80 rounded-lg p-3 border">
                <div className="text-muted-foreground mb-2">Query: &quot;car maintenance&quot;</div>
                <div className="text-orange-600 dark:text-orange-400">
                  Only finds: &quot;car&quot; + &quot;maintenance&quot;
                </div>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-orange-500">✗</span>
                  Misses &quot;automobile service&quot;
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-500">✗</span>
                  Misses &quot;vehicle repair guide&quot;
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-500">✗</span>
                  No understanding of context
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-green-500/30 bg-green-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <Brain className="h-5 w-5" />
                Semantic Search
              </CardTitle>
              <CardDescription>Understands meaning</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="font-mono text-sm bg-background/80 rounded-lg p-3 border">
                <div className="text-muted-foreground mb-2">Query: &quot;car maintenance&quot;</div>
                <div className="text-green-600 dark:text-green-400">
                  Finds: Related concepts & synonyms
                </div>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  Finds &quot;automobile service&quot;
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  Finds &quot;vehicle repair guide&quot;
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  Understands intent & context
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Architecture Diagram */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              System Architecture
            </CardTitle>
            <CardDescription>
              How your query flows through the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {/* Flow Diagram */}
              <div className="flex flex-col gap-4">
                {/* Step 1: Query */}
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                    <Search className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">Your Search Query</div>
                    <div className="text-sm text-muted-foreground">
                      &quot;How does authentication work?&quot;
                    </div>
                  </div>
                  <Badge variant="secondary">Input</Badge>
                </div>

                <div className="ml-6 border-l-2 border-dashed border-muted-foreground/30 h-6" />

                {/* Step 2: Embedding */}
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
                    <Cpu className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">Query Embedding</div>
                    <div className="text-sm text-muted-foreground">
                      Convert text to 3072-dimensional vector using AI
                    </div>
                  </div>
                  <Badge variant="secondary">OpenAI</Badge>
                </div>

                <div className="ml-6 border-l-2 border-dashed border-muted-foreground/30 h-6" />

                {/* Step 3: Parallel Retrieval */}
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-500/10 text-green-500">
                    <Shuffle className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium mb-2">Parallel Retrieval</div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                        <div className="font-medium text-purple-600 dark:text-purple-400">Semantic Search</div>
                        <div className="text-muted-foreground">Vector similarity in ChromaDB</div>
                      </div>
                      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                        <div className="font-medium text-orange-600 dark:text-orange-400">BM25 Search</div>
                        <div className="text-muted-foreground">Keyword matching algorithm</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="ml-6 border-l-2 border-dashed border-muted-foreground/30 h-6" />

                {/* Step 4: Fusion */}
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                    <Scale className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">Reciprocal Rank Fusion (RRF)</div>
                    <div className="text-sm text-muted-foreground">
                      Intelligently combine both result sets with configurable weighting
                    </div>
                  </div>
                  <Badge variant="secondary">Hybrid</Badge>
                </div>

                <div className="ml-6 border-l-2 border-dashed border-muted-foreground/30 h-6" />

                {/* Step 5: Reranking */}
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-pink-500/10 text-pink-500">
                    <Target className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">Cross-Encoder Reranking</div>
                    <div className="text-sm text-muted-foreground">
                      AI-powered relevance scoring for precision
                    </div>
                  </div>
                  <Badge variant="secondary">Optional</Badge>
                </div>

                <div className="ml-6 border-l-2 border-dashed border-muted-foreground/30 h-6" />

                {/* Step 6: Results */}
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">Ranked Results</div>
                    <div className="text-sm text-muted-foreground">
                      High-confidence results with optional AI-generated answer
                    </div>
                  </div>
                  <Badge variant="default">Output</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Section 2: Search Quality Progression */}
      <section id="search-quality" className="space-y-8 scroll-mt-20">
        <div className="space-y-2">
          <Badge variant="outline" className="mb-2">Quality</Badge>
          <h2 className="text-3xl font-bold tracking-tight">Search Quality Progression</h2>
          <p className="text-muted-foreground">
            Each capability layer builds upon the previous, progressively improving search quality.
          </p>
        </div>

        {/* Quality Layers Pyramid */}
        <Card className="rounded-2xl overflow-hidden">
          <CardContent className="pt-6">
            <div className="space-y-3">
              {/* Layer 6 - Top */}
              <QualityLayer
                level={6}
                title="AI Answer + Verification"
                description="RAG-powered answers with citation checking and hallucination detection"
                icon={ShieldCheck}
                color="purple"
                improvement="+Trustworthy Answers"
                width="40%"
              />

              {/* Layer 5 */}
              <QualityLayer
                level={5}
                title="Confidence Filtering"
                description="Separate high-confidence from low-confidence results"
                icon={Filter}
                color="pink"
                improvement="+Noise Reduction"
                width="50%"
              />

              {/* Layer 4 */}
              <QualityLayer
                level={4}
                title="Cross-Encoder Reranking"
                description="AI reranker scores query-document pairs for precision"
                icon={Target}
                color="amber"
                improvement="+Precision"
                width="60%"
              />

              {/* Layer 3 */}
              <QualityLayer
                level={3}
                title="Hybrid Search (RRF)"
                description="Combine semantic and keyword search with Reciprocal Rank Fusion"
                icon={Shuffle}
                color="green"
                improvement="+Balance"
                width="70%"
              />

              {/* Layer 2 */}
              <QualityLayer
                level={2}
                title="Semantic Search"
                description="Vector embeddings capture meaning, not just words"
                icon={Brain}
                color="blue"
                improvement="+Understanding"
                width="85%"
              />

              {/* Layer 1 - Base */}
              <QualityLayer
                level={1}
                title="Keyword Search (BM25)"
                description="Traditional term frequency-based matching"
                icon={Search}
                color="gray"
                improvement="Foundation"
                width="100%"
                isBase
              />
            </div>

            {/* Legend */}
            <div className="mt-8 pt-6 border-t flex flex-wrap gap-4 justify-center text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-gray-500" />
                <span className="text-muted-foreground">Basic</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-blue-500" />
                <span className="text-muted-foreground">AI-Enhanced</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span className="text-muted-foreground">Hybrid</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-purple-500" />
                <span className="text-muted-foreground">Advanced</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Before/After Comparison */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Without These Layers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2 text-muted-foreground">
                <span className="text-red-500 shrink-0">✗</span>
                Miss relevant documents with different wording
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <span className="text-red-500 shrink-0">✗</span>
                Get irrelevant results from keyword coincidence
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <span className="text-red-500 shrink-0">✗</span>
                No way to distinguish confident vs uncertain matches
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <span className="text-red-500 shrink-0">✗</span>
                Manual reading to find the answer
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg">With All Layers Active</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-green-500 shrink-0">✓</span>
                Find documents by meaning, not just exact words
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-500 shrink-0">✓</span>
                Combine keyword precision with semantic understanding
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-500 shrink-0">✓</span>
                See confidence scores and filter uncertain results
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-500 shrink-0">✓</span>
                Get AI-synthesized answers with verified citations
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Section 3: Key Concepts Explained */}
      <section id="concepts" className="space-y-8 scroll-mt-20">
        <div className="space-y-2">
          <Badge variant="outline" className="mb-2">Concepts</Badge>
          <h2 className="text-3xl font-bold tracking-tight">Key Concepts Explained</h2>
          <p className="text-muted-foreground">
            Understanding these concepts will help you get the most out of semantic search.
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-3">
          <AccordionItem value="embeddings" className="border rounded-2xl px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
                  <Cpu className="h-5 w-5 text-purple-500" />
                </div>
                <div className="text-left">
                  <div className="font-semibold">Embeddings & Vector Space</div>
                  <div className="text-sm text-muted-foreground font-normal">
                    How AI understands text as numbers
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6">
              <div className="space-y-4 text-sm">
                <p>
                  <strong>Embeddings</strong> are numerical representations of text. When you upload a document,
                  AI converts each chunk into a list of 3,072 numbers (a &quot;vector&quot;). These numbers capture
                  the semantic meaning of the text.
                </p>
                <div className="rounded-xl bg-muted/50 p-4 font-mono text-xs">
                  <div className="text-muted-foreground mb-2">&quot;car maintenance&quot; →</div>
                  <div className="text-primary">[0.023, -0.156, 0.892, ... 3,069 more numbers]</div>
                </div>
                <p>
                  Similar concepts end up with similar vectors. &quot;car maintenance&quot; and &quot;automobile service&quot;
                  will have vectors that point in nearly the same direction in this high-dimensional space,
                  even though they share no words.
                </p>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Badge variant="outline">Model</Badge>
                  <span>OpenAI text-embedding-3-large (3072 dimensions)</span>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="bm25" className="border rounded-2xl px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">
                  <Search className="h-5 w-5 text-orange-500" />
                </div>
                <div className="text-left">
                  <div className="font-semibold">BM25 Algorithm</div>
                  <div className="text-sm text-muted-foreground font-normal">
                    Smart keyword matching with term frequency
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6">
              <div className="space-y-4 text-sm">
                <p>
                  <strong>BM25</strong> (Best Matching 25) is a ranking function that scores documents based on
                  term frequency. It&apos;s smarter than simple keyword matching because it considers:
                </p>
                <ul className="space-y-2 ml-4">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span><strong>Term Frequency (TF):</strong> How often the search term appears in a document</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span><strong>Inverse Document Frequency (IDF):</strong> Rare terms are weighted higher than common ones</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span><strong>Document Length:</strong> Normalizes for document size</span>
                  </li>
                </ul>
                <p className="text-muted-foreground">
                  BM25 excels at finding exact matches and specific terminology, which complements
                  semantic search&apos;s ability to find conceptually similar content.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="rrf" className="border rounded-2xl px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
                  <Shuffle className="h-5 w-5 text-green-500" />
                </div>
                <div className="text-left">
                  <div className="font-semibold">Reciprocal Rank Fusion (RRF)</div>
                  <div className="text-sm text-muted-foreground font-normal">
                    Combining multiple ranking systems
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6">
              <div className="space-y-4 text-sm">
                <p>
                  <strong>RRF</strong> is a technique to combine results from multiple retrieval systems.
                  Instead of trying to normalize different scoring systems, it uses rank positions:
                </p>
                <div className="rounded-xl bg-muted/50 p-4 font-mono text-xs">
                  <div className="text-muted-foreground mb-2">RRF Formula:</div>
                  <div className="text-primary">score = α × 1/(k + semantic_rank) + (1-α) × 1/(k + bm25_rank)</div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-1">
                    <div className="font-medium">α (Alpha) = 0.5</div>
                    <div className="text-muted-foreground">Balanced blend of both methods</div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium">k = 60</div>
                    <div className="text-muted-foreground">Smoothing constant (standard)</div>
                  </div>
                </div>
                <p className="text-muted-foreground">
                  Adjust α in Settings: Higher values favor semantic search, lower values favor keywords.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="reranking" className="border rounded-2xl px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                  <Target className="h-5 w-5 text-amber-500" />
                </div>
                <div className="text-left">
                  <div className="font-semibold">Cross-Encoder Reranking</div>
                  <div className="text-sm text-muted-foreground font-normal">
                    AI-powered precision refinement
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6">
              <div className="space-y-4 text-sm">
                <p>
                  A <strong>cross-encoder</strong> is a more powerful (but slower) model that looks at the
                  query and each document <em>together</em>, rather than encoding them separately.
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="rounded-xl border p-4">
                    <div className="font-medium text-blue-500 mb-2">Bi-Encoder (Embeddings)</div>
                    <div className="text-muted-foreground text-xs">
                      Encodes query and documents separately. Fast but may miss subtle relevance.
                    </div>
                  </div>
                  <div className="rounded-xl border p-4 border-primary/30 bg-primary/5">
                    <div className="font-medium text-primary mb-2">Cross-Encoder (Reranker)</div>
                    <div className="text-muted-foreground text-xs">
                      Processes query + document pairs together. Slower but more accurate.
                    </div>
                  </div>
                </div>
                <p className="text-muted-foreground">
                  The reranker runs on the top candidates from hybrid search, providing a final
                  relevance score from 0-1. This score is used for final ranking and filtering.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="confidence" className="border rounded-2xl px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/10">
                  <Filter className="h-5 w-5 text-pink-500" />
                </div>
                <div className="text-left">
                  <div className="font-semibold">Confidence Threshold</div>
                  <div className="text-sm text-muted-foreground font-normal">
                    Separating signal from noise
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6">
              <div className="space-y-4 text-sm">
                <p>
                  Not all search results are equally relevant. The <strong>confidence threshold</strong> (default: 30%)
                  separates results into two groups:
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4">
                    <div className="font-medium text-green-600 dark:text-green-400 mb-2">High Confidence</div>
                    <div className="text-muted-foreground text-xs">
                      Score ≥ threshold. Shown by default. These results are likely relevant.
                    </div>
                  </div>
                  <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
                    <div className="font-medium text-orange-600 dark:text-orange-400 mb-2">Low Confidence</div>
                    <div className="text-muted-foreground text-xs">
                      Score &lt; threshold. Hidden by default but expandable. May contain false positives.
                    </div>
                  </div>
                </div>
                <p className="text-muted-foreground">
                  Adjust the threshold in Settings based on your needs. Higher = stricter filtering.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="rag" className="border rounded-2xl px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <div className="font-semibold">RAG & Answer Verification</div>
                  <div className="text-sm text-muted-foreground font-normal">
                    AI-generated answers with citations
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6">
              <div className="space-y-4 text-sm">
                <p>
                  <strong>RAG (Retrieval-Augmented Generation)</strong> combines search with language models.
                  Instead of the LLM making up answers, it generates responses based on retrieved documents.
                </p>
                <div className="rounded-xl bg-muted/50 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="shrink-0">Step 1</Badge>
                    <span>Search retrieves relevant chunks</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="shrink-0">Step 2</Badge>
                    <span>LLM generates answer from those chunks</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="shrink-0">Step 3</Badge>
                    <span>Claims are extracted and verified against sources</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="shrink-0">Step 4</Badge>
                    <span>Citations link each claim to source documents</span>
                  </div>
                </div>
                <p className="text-muted-foreground">
                  Verification shows confidence level (High/Medium/Low) and flags any claims
                  that couldn&apos;t be verified from the source documents.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* Section 4: Settings Demystified */}
      <section id="settings" className="space-y-8 scroll-mt-20">
        <div className="space-y-2">
          <Badge variant="outline" className="mb-2">Settings</Badge>
          <h2 className="text-3xl font-bold tracking-tight">Settings Demystified</h2>
          <p className="text-muted-foreground">
            Understand what each setting controls and when to adjust them.
          </p>
        </div>

        <Tabs defaultValue="retrieval" className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="retrieval">Retrieval</TabsTrigger>
            <TabsTrigger value="display">Display</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="retrieval" className="space-y-4">
            <Card className="rounded-2xl">
              <CardContent className="pt-6 space-y-6">
                <SettingExplainer
                  name="Retrieval Preset"
                  settingsPath="Preset dropdown"
                  description="Pre-configured combinations of settings optimized for different use cases."
                  options={[
                    { value: 'High Precision', description: 'α=0.8, emphasizes semantic. Best for specific questions.' },
                    { value: 'Balanced', description: 'α=0.5, equal weight. Good general-purpose default.' },
                    { value: 'High Recall', description: 'α=0.3, emphasizes keywords. Good for exploratory search.' },
                  ]}
                />

                <div className="border-t border-muted-foreground/10" />

                <SettingExplainer
                  name="Hybrid Search Balance (Alpha)"
                  settingsPath="Alpha slider (0-100%)"
                  description="Controls the blend between semantic and keyword search in hybrid mode."
                  options={[
                    { value: '0%', description: 'Pure BM25 keyword matching' },
                    { value: '50%', description: 'Balanced blend (recommended)' },
                    { value: '100%', description: 'Pure semantic search' },
                  ]}
                />

                <div className="border-t border-muted-foreground/10" />

                <SettingExplainer
                  name="Enable Reranking"
                  settingsPath="Toggle switch"
                  description="Run cross-encoder reranker on results for improved precision. Adds slight latency but significantly improves result quality."
                  recommendation="Keep enabled unless you need fastest possible response."
                />

                <div className="border-t border-muted-foreground/10" />

                <SettingExplainer
                  name="Results to Retrieve (Top K)"
                  settingsPath="Number input"
                  description="How many candidate results to fetch and rerank. More candidates = better recall but slower."
                  recommendation="10-20 for most use cases. Increase to 30-50 for comprehensive searches."
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="display" className="space-y-4">
            <Card className="rounded-2xl">
              <CardContent className="pt-6 space-y-6">
                <SettingExplainer
                  name="Low Confidence Threshold"
                  settingsPath="Slider (0-50%)"
                  description="Results below this score are hidden by default. Shown separately as 'low confidence' results."
                  options={[
                    { value: '20%', description: 'Lenient - shows more results' },
                    { value: '30%', description: 'Balanced (default)' },
                    { value: '40%+', description: 'Strict - only high-quality matches' },
                  ]}
                />

                <div className="border-t border-muted-foreground/10" />

                <SettingExplainer
                  name="Show Relevance Scores"
                  settingsPath="Toggle switch"
                  description="Display detailed scoring breakdown (semantic, BM25, rerank, final) on each result."
                  recommendation="Enable when debugging search quality or understanding rankings."
                />

                <div className="border-t border-muted-foreground/10" />

                <SettingExplainer
                  name="Generate AI Answers"
                  settingsPath="Toggle switch"
                  description="Enable RAG-powered answer generation with citation verification. Adds ~1-2 seconds latency."
                  recommendation="Enable for Q&A use cases. Disable for pure document retrieval."
                />

                <div className="border-t border-muted-foreground/10" />

                <SettingExplainer
                  name="Context Window Size"
                  settingsPath="1/2/3 selector"
                  description="How many adjacent chunks to fetch around each matched result for fuller context."
                  options={[
                    { value: '1 (Minimal)', description: 'Fast lookups, well-structured docs' },
                    { value: '2 (Balanced)', description: 'General use, most documents' },
                    { value: '3 (Maximum)', description: 'Dense technical docs, research papers' },
                  ]}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4">
            <Card className="rounded-2xl">
              <CardContent className="pt-6 space-y-6">
                <SettingExplainer
                  name="Embedding Model"
                  settingsPath="Dropdown"
                  description="The AI model used to convert text into vectors. Different models have different quality/speed/cost tradeoffs."
                  recommendation="text-embedding-3-large for best quality. Ollama models for privacy/offline use."
                  warning="Changing model requires re-indexing all documents."
                />

                <div className="border-t border-muted-foreground/10" />

                <SettingExplainer
                  name="Chunk Size"
                  settingsPath="Slider (100-4000 chars)"
                  description="How documents are split for indexing. Smaller = more precise retrieval. Larger = more context per result."
                  options={[
                    { value: '500-1500', description: 'Optimal range for most documents' },
                    { value: '<500', description: 'Too small - loses context' },
                    { value: '>2000', description: 'Too large - less precise matching' },
                  ]}
                />

                <div className="border-t border-muted-foreground/10" />

                <SettingExplainer
                  name="Chunk Overlap"
                  settingsPath="Slider (0-1000 chars)"
                  description="How much text overlaps between adjacent chunks. Prevents information from being split at chunk boundaries."
                  recommendation="50-400 chars (10-20% of chunk size). Higher overlap = better context preservation but more storage."
                />

                <div className="border-t border-muted-foreground/10" />

                <SettingExplainer
                  name="Reranker Provider"
                  settingsPath="Dropdown"
                  description="Which cross-encoder model to use for reranking."
                  options={[
                    { value: 'Auto', description: 'Tries Jina (local) first, falls back to Cohere (cloud)' },
                    { value: 'Jina', description: 'Runs locally, no API costs, fast' },
                    { value: 'Cohere', description: 'Cloud API, highest quality, requires API key' },
                  ]}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* CTA to Settings */}
        <div className="flex justify-center">
          <Link href="/settings">
            <Button size="lg" className="rounded-xl gap-2">
              <Settings className="h-4 w-4" />
              Go to Settings
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="rounded-2xl border bg-muted/30 p-8 text-center space-y-4">
        <h2 className="text-2xl font-bold">Ready to Search?</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Now that you understand how it works, upload some documents and experience
          the power of semantic search yourself.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/collections">
            <Button variant="outline" className="rounded-xl gap-2">
              <Database className="h-4 w-4" />
              Manage Collections
            </Button>
          </Link>
          <Link href="/">
            <Button className="rounded-xl gap-2">
              <Search className="h-4 w-4" />
              Start Searching
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

// Quality Layer Component for the Pyramid
function QualityLayer({
  level,
  title,
  description,
  icon: Icon,
  color,
  improvement,
  width,
  isBase = false,
}: {
  level: number;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  improvement: string;
  width: string;
  isBase?: boolean;
}) {
  const colorClasses: Record<string, string> = {
    gray: 'bg-gray-500/10 border-gray-500/30 text-gray-600 dark:text-gray-400',
    blue: 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400',
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
    pink: 'bg-pink-500/10 border-pink-500/30 text-pink-600 dark:text-pink-400',
    purple: 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400',
  };

  return (
    <div className="flex justify-center">
      <div
        className={`rounded-xl border p-4 transition-all hover:scale-[1.02] ${colorClasses[color]}`}
        style={{ width }}
      >
        <div className="flex items-center gap-3">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colorClasses[color]}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">{title}</span>
              <Badge variant="outline" className="shrink-0 text-xs">
                L{level}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground truncate">{description}</div>
          </div>
          <Badge
            variant={isBase ? 'secondary' : 'default'}
            className="shrink-0 text-xs"
          >
            {improvement}
          </Badge>
        </div>
      </div>
    </div>
  );
}

// Setting Explainer Component
function SettingExplainer({
  name,
  settingsPath,
  description,
  options,
  recommendation,
  warning,
}: {
  name: string;
  settingsPath: string;
  description: string;
  options?: { value: string; description: string }[];
  recommendation?: string;
  warning?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-medium">{name}</div>
          <div className="text-xs text-muted-foreground">Settings → {settingsPath}</div>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>

      {options && (
        <div className="grid gap-2">
          {options.map((opt) => (
            <div key={opt.value} className="flex items-start gap-2 text-sm">
              <Badge variant="outline" className="shrink-0 font-mono text-xs">
                {opt.value}
              </Badge>
              <span className="text-muted-foreground">{opt.description}</span>
            </div>
          ))}
        </div>
      )}

      {recommendation && (
        <div className="flex items-start gap-2 text-sm text-green-600 dark:text-green-400">
          <Zap className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{recommendation}</span>
        </div>
      )}

      {warning && (
        <div className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
          <BarChart3 className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{warning}</span>
        </div>
      )}
    </div>
  );
}
