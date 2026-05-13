export const EMBEDDING_PROVIDERS = {
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

export const LLM_PROVIDERS = {
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

export function getProviderFromModel(
  modelValue: string | undefined
): { key: string; provider: typeof EMBEDDING_PROVIDERS[keyof typeof EMBEDDING_PROVIDERS] } | null {
  if (!modelValue) return null;
  for (const [key, provider] of Object.entries(EMBEDDING_PROVIDERS)) {
    if (provider.models.some((m) => m.value === modelValue)) {
      return { key, provider };
    }
  }
  return null;
}

export function getLLMProviderFromModel(modelValue: string | undefined): string | null {
  if (!modelValue) return null;
  for (const [key, provider] of Object.entries(LLM_PROVIDERS)) {
    if (provider.models.some((m) => m.value === modelValue)) {
      return key;
    }
  }
  return null;
}

export function formatLLMDisplayValue(modelValue: string | undefined): string {
  if (!modelValue) return '';
  for (const [, provider] of Object.entries(LLM_PROVIDERS)) {
    const model = provider.models.find((m) => m.value === modelValue);
    if (model) {
      return `${provider.label} / ${model.label}`;
    }
  }
  return modelValue;
}
