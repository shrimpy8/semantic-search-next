'use client';

import { useCollections } from '@/hooks';
import {
  CollectionCard,
  CreateCollectionDialog,
  EmptyState,
  CollectionListSkeleton,
} from '@/components/collections';
import { AlertCircle, FolderOpen, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CollectionsPage() {
  const { data, isLoading, isError, error, refetch } = useCollections();

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Collections</h1>
              <p className="text-sm text-muted-foreground">
                {data?.total ? (
                  <span>{data.total} collection{data.total !== 1 && 's'}</span>
                ) : (
                  'Organize and search your documents'
                )}
              </p>
            </div>
          </div>
        </div>
        {data && data.data.length > 0 && <CreateCollectionDialog />}
      </div>

      {isLoading && <CollectionListSkeleton />}

      {isError && (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-destructive/30 animate-in fade-in duration-300">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-destructive/10 rounded-2xl blur-xl" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <h3 className="text-xl font-semibold mb-2">Failed to load collections</h3>
          <p className="text-muted-foreground mb-6 max-w-sm leading-relaxed">
            {error instanceof Error ? error.message : 'An unexpected error occurred while loading your collections.'}
          </p>
          <Button onClick={() => refetch()} className="rounded-xl">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      )}

      {data && data.data.length === 0 && <EmptyState />}

      {data && data.data.length > 0 && (
        <div className="-mx-1 px-1">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {data.data.map((collection) => (
              <CollectionCard key={collection.id} collection={collection} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
