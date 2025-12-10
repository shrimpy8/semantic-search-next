'use client';

import Link from 'next/link';
import {
  FlaskConical,
  Search,
  Brain,
  Target,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
  BookOpen,
  Scale,
  AlertTriangle,
  Sparkles,
  Database,
  FileCheck,
  Lightbulb,
  Wrench,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function LearnEvalsPage() {
  return (
    <div className="container py-8 space-y-16 max-w-5xl">
      {/* Hero Section */}
      <section className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <FlaskConical className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Understanding Evaluations</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Measure and improve your RAG system&apos;s quality with LLM-as-Judge evaluation.
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
            { href: '#what-is-eval', label: 'What is Evaluation?', icon: FlaskConical },
            { href: '#why-evaluate', label: 'Why Evaluate?', icon: Target },
            { href: '#when-to-use', label: 'When to Use', icon: Scale },
            { href: '#understanding-scores', label: 'Understanding Scores', icon: BarChart3 },
            { href: '#acting-on-results', label: 'Acting on Results', icon: Wrench },
            { href: '#how-it-works-here', label: 'How It Works Here', icon: Sparkles },
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

      {/* Section 1: What is Evaluation? */}
      <section id="what-is-eval" className="space-y-8 scroll-mt-20">
        <div className="space-y-2">
          <Badge variant="outline" className="mb-2">Concept</Badge>
          <h2 className="text-3xl font-bold tracking-tight">What is Evaluation?</h2>
          <p className="text-muted-foreground">
            Evaluation uses an LLM to judge the quality of your RAG system&apos;s outputs.
          </p>
        </div>

        {/* Flow Diagram */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              LLM-as-Judge Pattern
            </CardTitle>
            <CardDescription>
              An AI model evaluates your search and answer quality
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              {/* Step 1: Input */}
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                  <Search className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">User Query</div>
                  <div className="text-sm text-muted-foreground">
                    &quot;What are the best practices for authentication?&quot;
                  </div>
                </div>
                <Badge variant="secondary">Input</Badge>
              </div>

              <div className="ml-6 border-l-2 border-dashed border-muted-foreground/30 h-6" />

              {/* Step 2: RAG System */}
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
                  <Database className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">RAG System</div>
                  <div className="text-sm text-muted-foreground">
                    Retrieves chunks + generates answer
                  </div>
                </div>
                <Badge variant="secondary">Process</Badge>
              </div>

              <div className="ml-6 border-l-2 border-dashed border-muted-foreground/30 h-6" />

              {/* Step 3: LLM Judge */}
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                  <Scale className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">LLM Judge</div>
                  <div className="text-sm text-muted-foreground">
                    Evaluates retrieval quality + answer quality
                  </div>
                </div>
                <Badge variant="secondary">Evaluate</Badge>
              </div>

              <div className="ml-6 border-l-2 border-dashed border-muted-foreground/30 h-6" />

              {/* Step 4: Output */}
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-500/10 text-green-500">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">Quality Scores</div>
                  <div className="text-sm text-muted-foreground">
                    Retrieval: 0.85 | Answer: 0.92 | Overall: 0.88
                  </div>
                </div>
                <Badge variant="secondary">Output</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Section 2: Why Evaluate? */}
      <section id="why-evaluate" className="space-y-8 scroll-mt-20">
        <div className="space-y-2">
          <Badge variant="outline" className="mb-2">Benefits</Badge>
          <h2 className="text-3xl font-bold tracking-tight">Why Evaluate?</h2>
          <p className="text-muted-foreground">
            Without evaluation, you&apos;re flying blind. Here&apos;s what you gain.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="rounded-2xl border-blue-500/30 bg-blue-500/5">
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 mb-2">
                <Target className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">Objective Measurement</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Move beyond &quot;it looks good&quot; to quantifiable scores. Track quality over time with consistent metrics.
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-purple-500/30 bg-purple-500/5">
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500 mb-2">
                <Lightbulb className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">Pinpoint Issues</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Know exactly whether the problem is retrieval (wrong chunks) or generation (bad answer from good chunks).
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-green-500/30 bg-green-500/5">
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10 text-green-500 mb-2">
                <TrendingUp className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">Track Improvements</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Before vs after comparison when you change chunking, prompts, or models. Prove that changes actually help.
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Section 3: When to Use */}
      <section id="when-to-use" className="space-y-8 scroll-mt-20">
        <div className="space-y-2">
          <Badge variant="outline" className="mb-2">Guidance</Badge>
          <h2 className="text-3xl font-bold tracking-tight">When to Use (& When Not)</h2>
          <p className="text-muted-foreground">
            Evaluation is powerful but not always necessary.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="rounded-2xl border-green-500/30 bg-green-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                Good For
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">&#10003;</span>
                  <span><strong>Testing changes</strong> - Did the new prompt help?</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">&#10003;</span>
                  <span><strong>Quality audits</strong> - Spot-check production queries</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">&#10003;</span>
                  <span><strong>Debugging</strong> - Why did this query fail?</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">&#10003;</span>
                  <span><strong>Benchmarking</strong> - Compare chunking strategies</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-amber-500/30 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5" />
                Not Ideal For
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">!</span>
                  <span><strong>Every query</strong> - Too expensive for real-time use</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">!</span>
                  <span><strong>User-facing feedback</strong> - Show scores internally only</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">!</span>
                  <span><strong>Tiny datasets</strong> - Results may be noisy</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">!</span>
                  <span><strong>Absolute truth</strong> - Scores are estimates, not facts</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Section 4: Understanding Scores */}
      <section id="understanding-scores" className="space-y-8 scroll-mt-20">
        <div className="space-y-2">
          <Badge variant="outline" className="mb-2">Metrics</Badge>
          <h2 className="text-3xl font-bold tracking-tight">Understanding Scores</h2>
          <p className="text-muted-foreground">
            Six metrics across two categories, combined into one overall score.
          </p>
        </div>

        <Card className="rounded-2xl">
          <CardContent className="pt-6">
            {/* Score Tree */}
            <div className="space-y-6">
              {/* Overall */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-primary/5 border border-primary/20">
                <BarChart3 className="h-6 w-6 text-primary" />
                <div>
                  <div className="font-semibold">Overall Score</div>
                  <div className="text-sm text-muted-foreground">
                    Weighted average of retrieval and answer scores
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6 pl-4 border-l-2 border-dashed border-muted-foreground/30 ml-3">
                {/* Retrieval */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                    <Database className="h-5 w-5 text-blue-500" />
                    <div>
                      <div className="font-medium text-blue-600 dark:text-blue-400">Retrieval Score</div>
                      <div className="text-xs text-muted-foreground">Are the right chunks found?</div>
                    </div>
                  </div>
                  <ul className="space-y-2 text-sm pl-4">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 font-bold">&bull;</span>
                      <span><strong>Context Relevance</strong> - How relevant are the chunks?</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 font-bold">&bull;</span>
                      <span><strong>Context Precision</strong> - Are irrelevant chunks filtered?</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 font-bold">&bull;</span>
                      <span><strong>Context Coverage</strong> - Is all needed info present?</span>
                    </li>
                  </ul>
                </div>

                {/* Answer */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                    <Sparkles className="h-5 w-5 text-green-500" />
                    <div>
                      <div className="font-medium text-green-600 dark:text-green-400">Answer Score</div>
                      <div className="text-xs text-muted-foreground">Is the answer good?</div>
                    </div>
                  </div>
                  <ul className="space-y-2 text-sm pl-4">
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 font-bold">&bull;</span>
                      <span><strong>Faithfulness</strong> - Is the answer grounded in chunks?</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 font-bold">&bull;</span>
                      <span><strong>Answer Relevance</strong> - Does it answer the question?</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 font-bold">&bull;</span>
                      <span><strong>Completeness</strong> - Is anything missing?</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Score Guide */}
        <div className="grid grid-cols-4 gap-4 text-center text-sm">
          <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">&gt;0.8</div>
            <div className="text-muted-foreground">Excellent</div>
          </div>
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">0.6-0.8</div>
            <div className="text-muted-foreground">Good</div>
          </div>
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">0.4-0.6</div>
            <div className="text-muted-foreground">Moderate</div>
          </div>
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">&lt;0.4</div>
            <div className="text-muted-foreground">Poor</div>
          </div>
        </div>
      </section>

      {/* Section 5: Acting on Results */}
      <section id="acting-on-results" className="space-y-8 scroll-mt-20">
        <div className="space-y-2">
          <Badge variant="outline" className="mb-2">Action</Badge>
          <h2 className="text-3xl font-bold tracking-tight">Acting on Results</h2>
          <p className="text-muted-foreground">
            Different problems require different fixes.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Database className="h-5 w-5" />
                Low Retrieval Score?
              </CardTitle>
              <CardDescription>The system isn&apos;t finding the right chunks</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <span>Try different chunking (smaller/larger sizes)</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <span>Adjust alpha toward semantic (higher value)</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <span>Enable reranker for better precision</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <span>Increase top_k to retrieve more candidates</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <Sparkles className="h-5 w-5" />
                Low Answer Score?
              </CardTitle>
              <CardDescription>The chunks are good but the answer isn&apos;t</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Improve the QA prompt template</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Try a more capable model (GPT-4 vs GPT-3.5)</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Add instructions for completeness</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Check for hallucination issues (faithfulness)</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Section 6: How It Works Here */}
      <section id="how-it-works-here" className="space-y-8 scroll-mt-20">
        <div className="space-y-2">
          <Badge variant="outline" className="mb-2">Implementation</Badge>
          <h2 className="text-3xl font-bold tracking-tight">How It Works Here</h2>
          <p className="text-muted-foreground">
            Three simple steps to evaluate any search.
          </p>
        </div>

        <Card className="rounded-2xl">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
              {/* Step 1 */}
              <div className="flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 mb-3">
                  <Search className="h-7 w-7" />
                </div>
                <div className="font-semibold">1. Search</div>
                <div className="text-sm text-muted-foreground">Run a query</div>
              </div>

              <ArrowRight className="h-6 w-6 text-muted-foreground hidden md:block" />
              <div className="h-6 w-0.5 bg-muted-foreground/30 md:hidden" />

              {/* Step 2 */}
              <div className="flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500 mb-3">
                  <FlaskConical className="h-7 w-7" />
                </div>
                <div className="font-semibold">2. Evaluate</div>
                <div className="text-sm text-muted-foreground">Click &quot;Evaluate&quot;</div>
              </div>

              <ArrowRight className="h-6 w-6 text-muted-foreground hidden md:block" />
              <div className="h-6 w-0.5 bg-muted-foreground/30 md:hidden" />

              {/* Step 3 */}
              <div className="flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-green-500/10 text-green-500 mb-3">
                  <BarChart3 className="h-7 w-7" />
                </div>
                <div className="font-semibold">3. Analyze</div>
                <div className="text-sm text-muted-foreground">Review scores</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30">
            <FileCheck className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <div className="font-medium">Ground Truth Support</div>
              <div className="text-sm text-muted-foreground">
                Compare against expected answers for benchmark testing
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30">
            <Brain className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <div className="font-medium">Multiple Judge Providers</div>
              <div className="text-sm text-muted-foreground">
                OpenAI, Anthropic, or Ollama (local) as evaluators. Configure in{' '}
                <Link href="/settings" className="text-primary hover:underline">Settings</Link>.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="text-center space-y-6 pt-8">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Ready to try it?</h2>
          <p className="text-muted-foreground">
            Start evaluating your search results to improve quality.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/evals">
            <Button size="lg" className="rounded-xl">
              <FlaskConical className="mr-2 h-5 w-5" />
              Go to Evaluations
            </Button>
          </Link>
          <Link href="/">
            <Button variant="outline" size="lg" className="rounded-xl">
              <Search className="mr-2 h-5 w-5" />
              Try a Search First
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
