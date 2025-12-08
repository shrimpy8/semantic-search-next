'use client';

import { use, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  FileText,
  ArrowLeft,
  ChevronUp,
  ChevronDown,
  Layers,
  FileBox,
  Clock,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  Hash,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useDocument, useDocumentContent, useCollection } from '@/hooks';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function DocumentDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const highlightChunk = searchParams.get('chunk');

  // Fetch document and content
  const { data: document, isLoading: docLoading, isError: docError, refetch: refetchDoc } = useDocument(id);
  const { data: content, isLoading: contentLoading, refetch: refetchContent } = useDocumentContent(id);
  const { data: collection } = useCollection(document?.collection_id ?? '');

  // UI state
  const [expandedChunks, setExpandedChunks] = useState<Set<number>>(new Set());
  const [copiedChunk, setCopiedChunk] = useState<number | null>(null);
  const chunkRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Scroll to highlighted chunk on load
  useEffect(() => {
    if (highlightChunk && content?.chunks) {
      const chunkIndex = parseInt(highlightChunk, 10);
      if (!isNaN(chunkIndex)) {
        // Expand the chunk
        setExpandedChunks(new Set([chunkIndex]));
        // Scroll after render
        setTimeout(() => {
          const ref = chunkRefs.current.get(chunkIndex);
          if (ref) {
            ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    }
  }, [highlightChunk, content]);

  const toggleChunk = (index: number) => {
    setExpandedChunks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    if (content?.chunks) {
      setExpandedChunks(new Set(content.chunks.map((_, i) => i)));
    }
  };

  const collapseAll = () => {
    setExpandedChunks(new Set());
  };

  const copyChunkContent = async (content: string, index: number) => {
    await navigator.clipboard.writeText(content);
    setCopiedChunk(index);
    setTimeout(() => setCopiedChunk(null), 2000);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (docError) {
    return (
      <div className="container py-8">
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-destructive/30 animate-in fade-in duration-300">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-destructive/10 rounded-2xl blur-xl" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <h3 className="text-xl font-semibold mb-2">Document not found</h3>
          <p className="text-muted-foreground mb-6 max-w-sm leading-relaxed">
            The document you&apos;re looking for doesn&apos;t exist or has been deleted.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => refetchDoc()} className="rounded-xl">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>
            <Link href="/collections">
              <Button className="rounded-xl">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Collections
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-6">
      {/* Header with back button */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          {document?.collection_id && (
            <Link
              href={`/collections/${document.collection_id}`}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to {collection?.name || 'Collection'}
            </Link>
          )}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              {docLoading ? (
                <>
                  <Skeleton className="h-7 w-48 mb-1" />
                  <Skeleton className="h-4 w-32" />
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-bold tracking-tight">{document?.filename}</h1>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge
                      variant={document?.status === 'ready' ? 'default' : document?.status === 'error' ? 'destructive' : 'secondary'}
                      className="rounded-md text-xs"
                    >
                      {document?.status}
                    </Badge>
                    <span>{formatFileSize(document?.file_size ?? 0)}</span>
                    {document?.page_count && <span>{document.page_count} pages</span>}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={expandAll} className="rounded-lg">
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll} className="rounded-lg">
            Collapse All
          </Button>
        </div>
      </div>

      {/* Document Info Card */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileBox className="h-4 w-4 text-muted-foreground" />
            Document Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Collection</p>
              {docLoading ? (
                <Skeleton className="h-5 w-24" />
              ) : (
                <Link
                  href={`/collections/${document?.collection_id}`}
                  className="text-sm font-medium hover:underline"
                >
                  {collection?.name || 'Loading...'}
                </Link>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Chunks</p>
              {docLoading ? (
                <Skeleton className="h-5 w-12" />
              ) : (
                <p className="text-sm font-medium">{document?.chunk_count ?? 0}</p>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Uploaded</p>
              {docLoading ? (
                <Skeleton className="h-5 w-24" />
              ) : (
                <p className="text-sm font-medium flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  {document?.uploaded_at
                    ? formatDistanceToNow(new Date(document.uploaded_at), { addSuffix: true })
                    : 'Unknown'}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">File Hash</p>
              {docLoading ? (
                <Skeleton className="h-5 w-32" />
              ) : (
                <p className="text-sm font-mono text-muted-foreground truncate" title={document?.file_hash}>
                  {document?.file_hash?.slice(0, 16)}...
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chunks Section */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Document Content
          </CardTitle>
          <CardDescription>
            {contentLoading
              ? 'Loading chunks...'
              : `${content?.total_chunks ?? 0} chunks extracted from this document`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {contentLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : content?.chunks?.length ? (
            content.chunks.map((chunk, index) => {
              const isExpanded = expandedChunks.has(index);
              const isHighlighted = highlightChunk === String(chunk.chunk_index);

              return (
                <div
                  key={chunk.id}
                  ref={(el) => {
                    if (el) chunkRefs.current.set(chunk.chunk_index, el);
                  }}
                  className={cn(
                    'rounded-xl border transition-all',
                    isHighlighted && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                    isExpanded ? 'bg-muted/30' : 'bg-background'
                  )}
                >
                  {/* Chunk Header */}
                  <button
                    onClick={() => toggleChunk(index)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-medium">
                        <Hash className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="font-medium">Chunk {chunk.chunk_index + 1}</span>
                        {chunk.page && (
                          <span className="text-muted-foreground text-sm ml-2">
                            (Page {chunk.page})
                          </span>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs rounded-md">
                        {chunk.content.length} chars
                      </Badge>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>

                  {/* Chunk Content */}
                  {isExpanded && (
                    <>
                      <Separator />
                      <div className="p-4 space-y-3">
                        <div className="relative">
                          <pre className="text-sm whitespace-pre-wrap font-sans bg-muted/50 rounded-lg p-4 max-h-96 overflow-y-auto">
                            {chunk.content}
                          </pre>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 h-8 w-8 rounded-md"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyChunkContent(chunk.content, index);
                            }}
                          >
                            {copiedChunk === index ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        {chunk.start_index !== null && (
                          <p className="text-xs text-muted-foreground">
                            Character offset: {chunk.start_index}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Layers className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No chunks available</p>
              <p className="text-sm text-muted-foreground/70">
                This document may still be processing or has no extractable content.
              </p>
              <Button variant="outline" className="mt-4 rounded-xl" onClick={() => refetchContent()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
